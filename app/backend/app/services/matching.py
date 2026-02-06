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


class MatchingService:
    """Service to compute and manage user matches."""

    @staticmethod
    async def get_cached_matches(
        db: AsyncSession, 
        user_id: uuid.UUID,
        match_type: Optional[str] = None
    ) -> Optional[List[Match]]:
        """Get cached matches if they exist and are still valid."""
        query = (
            select(Match)
            .options(selectinload(Match.user_b))
            .where(Match.user_a_id == user_id)
        )
        
        if match_type:
            query = query.where(Match.match_type == match_type)
        
        result = await db.execute(query)
        matches = list(result.scalars().all())
        
        if not matches:
            return None
        
        # Deduplicate by user_b_id (keep highest score if duplicates exist)
        unique_matches = {}
        for m in matches:
            if m.user_b_id not in unique_matches or m.score > unique_matches[m.user_b_id].score:
                unique_matches[m.user_b_id] = m
        matches = list(unique_matches.values())

        # Check if cache is still valid (based on oldest match)
        oldest_match = min(matches, key=lambda m: m.created_at)
        if oldest_match.created_at < datetime.now(timezone.utc) - MATCH_CACHE_TTL:
            # Cache expired, delete old matches
            await db.execute(delete(Match).where(Match.user_a_id == user_id))
            await db.commit()
            return None
        
        return sorted(matches, key=lambda x: x.score, reverse=True)

    @staticmethod
    async def invalidate_cache(db: AsyncSession, user_id: uuid.UUID) -> None:
        """Invalidate cached matches for a user (call when swipes change)."""
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
        """Compute matches for a user and cache them in the database."""
        # Delete existing cached matches (preserve mutual ones)
        await db.execute(
            delete(Match).where(
                Match.user_a_id == user_id,
                Match.match_type != 'mutual'
            )
        )
        
        # Compute fresh matches
        matches = await MatchingService._compute_all_matches(db, user_id)
        
        # Save to database
        for match in matches:
            db.add(match)
        await db.commit()
        
        return matches

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
            reasons.append(f"Both are in the {user_a.unit} unit")

        match_type = "mentor" if is_mentor_match else "peer"
        return score, reasons, match_type
