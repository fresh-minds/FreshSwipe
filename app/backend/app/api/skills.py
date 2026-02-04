"""Skills API endpoints."""
import asyncio
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, OperationalError

from app.database import get_db
from app.models.skill import Skill
from app.schemas.skill import SkillCreate, SkillResponse
from app.utils.db_errors import is_transient_db_error

router = APIRouter(prefix="/skills", tags=["skills"])


@router.post("/", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(skill_data: SkillCreate, db: AsyncSession = Depends(get_db)):
    """Create a new skill."""
    # Check if skill name already exists
    result = await db.execute(select(Skill).where(Skill.name == skill_data.name))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skill with this name already exists",
        )
    
    skill = Skill(**skill_data.model_dump())
    db.add(skill)
    await db.flush()
    await db.refresh(skill)
    return skill


@router.get("/", response_model=list[SkillResponse])
async def list_skills(
    active_only: bool = True,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum records to return"),
    db: AsyncSession = Depends(get_db)
):
    """List all skills with pagination."""
    query = select(Skill).order_by(Skill.display_order, Skill.name)
    if active_only:
        query = query.where(Skill.is_active == True)

    query = query.offset(skip).limit(limit)

    # Azure SQL serverless can take a short time to wake after inactivity.
    for attempt in range(1, 6):
        try:
            result = await db.execute(query)
            return result.scalars().all()
        except (OperationalError, DBAPIError) as exc:
            if not is_transient_db_error(exc):
                raise
            if attempt == 5:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Database is temporarily unavailable and waking up. Please retry in 30-60 seconds.",
                )
            await asyncio.sleep(attempt * 2)


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """List all skill categories."""
    result = await db.execute(
        select(Skill.category).distinct().order_by(Skill.category)
    )
    return [row[0] for row in result.all()]


@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(skill_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a skill by ID."""
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found",
        )
    
    return skill


@router.get("/for-user/{user_id}", response_model=list[SkillResponse])
async def get_skills_for_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get skills that a user hasn't swiped on yet."""
    from app.models.swipe import Swipe
    
    # Get skill IDs the user has already swiped on
    swiped_result = await db.execute(
        select(Swipe.skill_id).where(Swipe.user_id == user_id)
    )
    swiped_ids = [row[0] for row in swiped_result.all()]
    
    # Get skills not in swiped list
    query = select(Skill).where(
        Skill.is_active == True
    ).order_by(Skill.display_order, Skill.name)
    
    if swiped_ids:
        query = query.where(Skill.id.notin_(swiped_ids))
    
    result = await db.execute(query)
    return result.scalars().all()
