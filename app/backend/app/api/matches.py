"""Matches API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.match import Match
from app.models.swipe import Swipe
from app.models.skill import Skill
from app.services.matching import MatchingService
from app.schemas.match import MatchResponse

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("/", response_model=List[MatchResponse])
async def list_matches(
    match_type: Optional[str] = Query(None, description="Filter by 'peer' or 'mentor'"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get matches for the current user with caching."""
    matches = await MatchingService.get_matches(db, current_user.id, match_type)
    
    return [
        MatchResponse(
            id=m.id,
            user_a_id=m.user_a_id,
            user_b_id=m.user_b_id,
            score=m.score,
            reasons=m.reasons,
            match_type=m.match_type,
            user_b_name=m.user_b.name if m.user_b else "Unknown",
            user_b_email=(m.user_b.email if m.user_b and m.user_b.show_email else None),
            created_at=m.created_at
        )
        for m in matches[:limit]
    ]


@router.get("/stats")
async def get_match_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin analytics: match volume and participation."""
    # Count active users (users who have swiped)
    active_users_result = await db.execute(
        select(func.count(func.distinct(Swipe.user_id)))
    )
    total_active_users = active_users_result.scalar() or 0
    
    # Count total cached matches
    matches_result = await db.execute(
        select(func.count(Match.id))
    )
    total_matches_generated = matches_result.scalar() or 0
    
    # Top matched users (Replacing Top Skills logic)
    # Count who has received the most right/super swipes
    top_users_result = await db.execute(
        select(User.name, func.count(Swipe.id).label('count'))
        .join(Swipe, Swipe.target_user_id == User.id)
        .where(Swipe.direction.in_(['right', 'super']))
        .group_by(User.id, User.name)
        .order_by(func.count(Swipe.id).desc())
        .limit(5)
    )
    top_users = [row[0] for row in top_users_result.fetchall()]
    
    return {
        "total_active_users": total_active_users,
        "total_matches_generated": total_matches_generated,
        "top_skills": top_users # Renaming conceptually in frontend might be needed, but keeping key for compatibility
    }

