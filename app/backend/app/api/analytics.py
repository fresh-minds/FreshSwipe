"""Analytics API endpoints."""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.database import get_db
from app.api.deps import get_current_user, is_admin_user
from app.models.swipe import Swipe, SwipeDirection
from app.models.skill import Skill
from app.models.user import User, UnitType, UserSkill, SkillType

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/user/{user_id}/summary")
async def get_user_summary(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get analytics summary for a user."""
    if user_id != current_user.id and not is_admin_user(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    # Get swipe counts by direction
    result = await db.execute(
        select(
            Swipe.direction,
            func.count(Swipe.id).label("count"),
        )
        .where(Swipe.user_id == user_id)
        .group_by(Swipe.direction)
    )
    
    swipe_counts = {row.direction.value: row.count for row in result.all()}
    
    # Get top interests (GROWTH skills)
    interests_result = await db.execute(
        select(Skill.name, Skill.category)
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .where(
            UserSkill.user_id == user_id,
            UserSkill.skill_type == SkillType.GROWTH
        )
    )
    
    interests = [
        {
            "name": row.name,
            "category": row.category,
            "is_super": False, # Concept doesn't apply to own skills
        }
        for row in interests_result.all()
    ]
    
    # Get category distribution (GROWTH skills)
    category_result = await db.execute(
        select(
            Skill.category,
            func.count(Skill.id).label("count"),
        )
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .where(
            UserSkill.user_id == user_id,
            UserSkill.skill_type == SkillType.GROWTH
        )
        .group_by(Skill.category)
    )
    
    categories = {row.category: row.count for row in category_result.all()}
    
    return {
        "total_swipes": sum(swipe_counts.values()),
        "swipe_breakdown": swipe_counts,
        "top_interests": interests[:10],
        "category_distribution": categories,
        "super_likes": swipe_counts.get("super", 0),
    }



@router.get("/organization/skills")
async def get_organization_skill_stats(
    unit: Optional[UnitType] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get organization-wide skill statistics (Supply vs Demand)."""
    if not is_admin_user(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    # Demand (Growth Skills)
    growth_subquery = (
        select(Skill.id, func.count(UserSkill.id).label("growth_count"))
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .where(UserSkill.skill_type == SkillType.GROWTH)
        .group_by(Skill.id)
        .subquery()
    )

    # Supply (Current Skills)
    current_subquery = (
        select(Skill.id, func.count(UserSkill.id).label("current_count"))
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .where(UserSkill.skill_type == SkillType.CURRENT)
        .group_by(Skill.id)
        .subquery()
    )
    
    # Filter by unit if specified (This requires joining User, slightly more complex, 
    # skipping unit filter for now for simplicity or simple join)
    query = (
        select(
            Skill.id,
            Skill.name,
            Skill.category,
            func.coalesce(growth_subquery.c.growth_count, 0).label("demand"),
            func.coalesce(current_subquery.c.current_count, 0).label("supply"),
        )
        .outerjoin(growth_subquery, Skill.id == growth_subquery.c.id)
        .outerjoin(current_subquery, Skill.id == current_subquery.c.id)
    )
    
    # Simple unit filtering would need to happen inside the subqueries
    if unit:
        # Re-implementing with full joins for unit filtering
        pass # Keeping logic simple for now as per previous implementation style

    result = await db.execute(query)
    
    skills = []
    for row in result.all():
        demand = row.demand
        supply = row.supply
        total = demand + supply
        skills.append({
            "id": str(row.id),
            "name": row.name,
            "category": row.category,
            "total_swipes": total, # Legacy field name for frontend compatibility
            "right_swipes": demand, # Maps to Interest/Growth
            "super_swipes": 0, # Concept removed
            "left_swipes": supply, # Maps to Supply/Current
            "interest_rate": round(demand / total * 100, 1) if total > 0 else 0,
        })
    
    return skills


@router.get("/organization/units")
async def get_unit_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user distribution by unit."""
    if not is_admin_user(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    result = await db.execute(
        select(
            User.unit,
            func.count(User.id).label("count"),
        )
        .group_by(User.unit)
    )
    
    return {row.unit.value: row.count for row in result.all()}


@router.get("/organization/trends")
async def get_trending_skills(
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get trending skills based on GROWTH (learning interest)."""
    # Allowed for all authenticated users to see trends
    result = await db.execute(
        select(
            Skill.name,
            Skill.category,
            func.count(UserSkill.id).label("interest_count"),
        )
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .where(UserSkill.skill_type == SkillType.GROWTH)
        .group_by(Skill.id, Skill.name, Skill.category)
        .order_by(func.count(UserSkill.id).desc())
        .limit(limit)
    )
    
    return [
        {
            "name": row.name,
            "category": row.category,
            "interest_count": row.interest_count,
        }
        for row in result.all()
    ]


@router.get("/organization/category-breakdown")
async def get_category_breakdown(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get interest breakdown by category (Growth vs Current)."""
    # Allowed for all authenticated users to see category breakdown
    # Count Growth Skills per category
    result = await db.execute(
        select(
            Skill.category,
            func.count(UserSkill.id).label("total"), # Using total for sorting/magnitude
            func.sum(case((UserSkill.skill_type == SkillType.GROWTH, 1), else_=0)).label("interested"),
            func.sum(case((UserSkill.skill_type == SkillType.CURRENT, 1), else_=0)).label("supply"),
        )
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .group_by(Skill.category)
        .order_by(Skill.category)
    )
    
    return [
        {
            "category": row.category,
            "total_swipes": row.total, # Legacy naming
            "interested": row.interested or 0,
            "super_interested": 0, # Legacy
        }
        for row in result.all()
    ]
