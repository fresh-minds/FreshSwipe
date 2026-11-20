"""Analytics API endpoints."""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
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
    
    # Count searchable colleagues who can mentor each skill (CURRENT skill supply excluding self)
    mentor_subquery = (
        select(
            UserSkill.skill_id,
            func.count(func.distinct(UserSkill.user_id)).label("mentor_count"),
        )
        .join(User, User.id == UserSkill.user_id)
        .where(
            UserSkill.skill_type == SkillType.CURRENT,
            User.is_searchable == True,
            User.id != user_id,
        )
        .group_by(UserSkill.skill_id)
        .subquery()
    )

    # Get top interests (GROWTH skills) alongside available mentors count
    interests_result = await db.execute(
        select(
            Skill.name,
            Skill.category,
            func.coalesce(mentor_subquery.c.mentor_count, 0).label("mentor_count"),
        )
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .outerjoin(mentor_subquery, Skill.id == mentor_subquery.c.skill_id)
        .where(
            UserSkill.user_id == user_id,
            UserSkill.skill_type == SkillType.GROWTH,
        )
        .order_by(func.coalesce(mentor_subquery.c.mentor_count, 0).desc(), Skill.name)
    )
    
    interests = [
        {
            "name": row.name,
            "category": row.category,
            "is_super": False,
            "mentor_count": row.mentor_count,
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
            UserSkill.skill_type == SkillType.GROWTH,
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
    growth_query = (
        select(Skill.id, func.count(UserSkill.id).label("growth_count"))
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .where(UserSkill.skill_type == SkillType.GROWTH)
    )
    if unit:
        growth_query = growth_query.join(User, User.id == UserSkill.user_id).where(User.unit == unit)
    growth_subquery = growth_query.group_by(Skill.id).subquery()

    # Supply (Current Skills)
    current_query = (
        select(Skill.id, func.count(UserSkill.id).label("current_count"))
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .where(UserSkill.skill_type == SkillType.CURRENT)
    )
    if unit:
        current_query = current_query.join(User, User.id == UserSkill.user_id).where(User.unit == unit)
    current_subquery = current_query.group_by(Skill.id).subquery()
    
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
        .order_by(func.coalesce(growth_subquery.c.growth_count, 0).desc(), Skill.name)
    )

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
            "demand": demand,
            "supply": supply,
            "total_swipes": total,  # Legacy field name for compatibility
            "right_swipes": demand,  # Maps to Interest/Growth
            "super_swipes": 0,  # Concept removed
            "left_swipes": supply,  # Maps to Supply/Current
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
    
    return {(row.unit.value if row.unit else "Unknown"): row.count for row in result.all()}


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
