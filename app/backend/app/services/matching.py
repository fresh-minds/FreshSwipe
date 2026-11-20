"""Matching service for computing user-to-user matches."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Tuple, Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User, UserSkill, SkillType, UnitType
from app.models.swipe import SwipeDirection
from app.models.match import Match

# Cache TTL: matches are recomputed after this duration
MATCH_CACHE_TTL = timedelta(hours=1)


def _ensure_utc(dt: datetime) -> datetime:
    """Normalize naive datetimes (e.g. from SQLite) to UTC-aware datetimes."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _merge_and_deduplicate(matches: List[Match]) -> List[Match]:
    """Deduplicate matches per user_b_id, preferring mutual matches then highest score."""
    unique_matches: dict[uuid.UUID, Match] = {}
    for m in matches:
        existing = unique_matches.get(m.user_b_id)
        if existing is None:
            unique_matches[m.user_b_id] = m
        elif m.match_type == "mutual" and existing.match_type != "mutual":
            unique_matches[m.user_b_id] = m
        elif existing.match_type != "mutual" and m.score > existing.score:
            unique_matches[m.user_b_id] = m
    return sorted(
        unique_matches.values(),
        key=lambda x: (1 if x.match_type == "mutual" else 0, x.score),
        reverse=True,
    )


class MatchingService:
    """Service to compute and manage user matches."""

    @staticmethod
    async def get_cached_matches(
        db: AsyncSession, 
        user_id: uuid.UUID,
        match_type: Optional[str] = None
    ) -> Optional[List[Match]]:
        """Get cached matches if algorithmic cache exists and is still valid."""
        query = (
            select(Match)
            .options(selectinload(Match.user_b))
            .where(Match.user_a_id == user_id)
        )
        
        result = await db.execute(query)
        all_matches = list(result.scalars().all())
        
        if not all_matches:
            return None

        # Only mutual matches requested: return directly without triggering algorithmic recompute
        if match_type == "mutual":
            mutual_only = [m for m in all_matches if m.match_type == "mutual"]
            return _merge_and_deduplicate(mutual_only)

        algo_matches = [m for m in all_matches if m.match_type != "mutual"]
        if not algo_matches:
            # We only have mutual matches cached; compute algorithmic matches too
            return None

        # Check TTL strictly on algorithmic matches — NEVER wipe mutual matches on expiry
        oldest_algo = min(algo_matches, key=lambda m: _ensure_utc(m.created_at))
        if _ensure_utc(oldest_algo.created_at) < datetime.now(timezone.utc) - MATCH_CACHE_TTL:
            await db.execute(
                delete(Match).where(
                    Match.user_a_id == user_id,
                    Match.match_type != "mutual",
                )
            )
            await db.commit()
            return None

        merged = _merge_and_deduplicate(all_matches)
        if match_type:
            merged = [m for m in merged if m.match_type == match_type]
        return merged

    @staticmethod
    async def invalidate_cache(db: AsyncSession, user_id: uuid.UUID) -> None:
        """Invalidate cached matches for a user (call when swipes or skills change)."""
        # Only delete algorithmic matches (mentor/peer), preserve mutual ones
        await db.execute(
            delete(Match).where(
                Match.user_a_id == user_id, 
                Match.match_type != 'mutual'
            )
        )
        await db.commit()

    @staticmethod
    async def compute_and_cache_matches(db: AsyncSession, user_id: uuid.UUID) -> List[Match]:
        """Compute matches for a user, cache algorithmic ones, and return merged with mutuals."""
        # Delete existing cached algorithmic matches (preserve mutual ones)
        await db.execute(
            delete(Match).where(
                Match.user_a_id == user_id,
                Match.match_type != 'mutual'
            )
        )
        
        # Compute fresh algorithmic matches
        algo_matches = await MatchingService._compute_all_matches(db, user_id)
        
        # Save to database
        for match in algo_matches:
            db.add(match)
        await db.commit()

        # Load preserved mutual matches so the caller receives the full combined list
        mutual_result = await db.execute(
            select(Match)
            .options(selectinload(Match.user_b))
            .where(
                Match.user_a_id == user_id,
                Match.match_type == "mutual",
            )
        )
        mutual_matches = list(mutual_result.scalars().all())
        return _merge_and_deduplicate(mutual_matches + algo_matches)

    @staticmethod
    async def get_matches(
        db: AsyncSession, 
        user_id: uuid.UUID,
        match_type: Optional[str] = None
    ) -> List[Match]:
        """Get matches for a user, using cache if available."""
        # Try to get from cache
        cached = await MatchingService.get_cached_matches(db, user_id, match_type)
        if cached is not None:
            return cached
        
        # Compute and cache new matches
        matches = await MatchingService.compute_and_cache_matches(db, user_id)
        
        # Filter by type if requested
        if match_type:
            matches = [m for m in matches if m.match_type == match_type]
        
        return matches

    @staticmethod
    async def _compute_all_matches(db: AsyncSession, user_id: uuid.UUID) -> List[Match]:
        """Compute matches for a specific user against all other users (internal)."""
        # Get target user with skills
        result = await db.execute(
            select(User)
            .options(
                selectinload(User.skills).selectinload(UserSkill.skill)
            )
            .where(User.id == user_id)
        )
        user_a = result.scalar_one_or_none()
        if not user_a:
            return []

        # Get all other searchable users
        result = await db.execute(
            select(User)
            .options(
                selectinload(User.skills).selectinload(UserSkill.skill)
            )
            .where(User.id != user_id)
            .where(User.is_searchable == True)
        )
        other_users = result.scalars().all()

        matches = []
        for user_b in other_users:
            try:
                score, reasons, match_type = MatchingService.calculate_score(user_a, user_b)
                # Only create match if there's a positive score
                if score > 0:
                    match = Match(
                        user_a_id=user_a.id,
                        user_b_id=user_b.id,
                        user_b=user_b,
                        score=score,
                        reasons=reasons,
                        match_type=match_type
                    )
                    matches.append(match)
            except Exception as e:
                print(f"Error computing match between {user_id} and {user_b.id}: {e}")
                continue

        # Sort by score descending
        matches.sort(key=lambda x: x.score, reverse=True)
        return matches

    @staticmethod
    def calculate_score(user_a: User, user_b: User) -> Tuple[float, List[str], str]:
        """Calculate match score between two users."""
        score = 0.0
        reasons = []
        is_mentor_match = False

        # 1. Interests Overlap (REMOVED: Old legacy logic relying on swipes.skill_id)
        # TODO: Implement new interest matching based on current User/Skill structure if needed.
        
        # 2. Complementary Skills (Mentor/Mentee)
        # A offers X (Current), B wants X (Growth)
        a_current = {s.skill_id: s.skill.name for s in user_a.skills if s.skill_type == SkillType.CURRENT}
        b_growth = {s.skill_id: s.skill.name for s in user_b.skills if s.skill_type == SkillType.GROWTH}
        
        mentor_for_b = set(a_current.keys()) & set(b_growth.keys())
        for skill_id in mentor_for_b:
            score += 6
            reasons.append(f"{user_a.name} can mentor {user_b.name} in {a_current[skill_id]}")
            is_mentor_match = True

        # B offers X (Current), A wants X (Growth)
        b_current = {s.skill_id: s.skill.name for s in user_b.skills if s.skill_type == SkillType.CURRENT}
        a_growth = {s.skill_id: s.skill.name for s in user_a.skills if s.skill_type == SkillType.GROWTH}
        
        mentor_for_a = set(b_current.keys()) & set(a_growth.keys())
        for skill_id in mentor_for_a:
            score += 6
            reasons.append(f"{user_b.name} can mentor {user_a.name} in {b_current[skill_id]}")
            is_mentor_match = True

        # 3. Unit weight
        if user_a.unit == user_b.unit and user_a.unit != UnitType.STAFF:
            score += 1
            unit_label = user_a.unit.value if hasattr(user_a.unit, "value") else str(user_a.unit)
            reasons.append(f"Both are in the {unit_label} unit")

        match_type = "mentor" if is_mentor_match else "peer"
        return score, reasons, match_type
