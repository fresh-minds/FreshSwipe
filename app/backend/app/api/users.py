"""Users API endpoints."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.api.deps import get_current_user, is_admin_user
from app.models.user import User, UserSkill, SkillType
from app.models.skill import Skill
from app.models.swipe import Swipe

from app.utils.user_helpers import resolve_user_id
from app.services.matching import MatchingService
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserOnboarding,
    UserWithSkills,
    UserSkillResponse,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


def _build_user_with_skills(
    user: User,
    *,
    include_email: bool,
    is_admin: bool = False,
) -> UserWithSkills:
    current_skills = []
    growth_skills = []

    for us in user.skills:
        skill_response = UserSkillResponse(
            id=us.id,
            skill_id=us.skill_id,
            skill_type=us.skill_type,
            skill_name=us.skill.name if us.skill else None,
        )
        if us.skill_type == SkillType.CURRENT:
            current_skills.append(skill_response)
        else:
            growth_skills.append(skill_response)

    return UserWithSkills(
        id=user.id,
        entra_oid=user.entra_oid,
        name=user.name,
        email=user.email if include_email else None,
        unit=user.unit,
        seniority=user.seniority,
        availability=user.availability,
        looking_for=user.looking_for or [],
        offering=user.offering or [],
        is_searchable=user.is_searchable,
        show_email=user.show_email,
        is_admin=is_admin,
        created_at=user.created_at,
        updated_at=user.updated_at,
        current_skills=current_skills,
        growth_skills=growth_skills,
    )


@router.get("/me", response_model=UserWithSkills)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user profile with skills."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.skills).selectinload(UserSkill.skill))
        .where(User.id == current_user.id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return _build_user_with_skills(
        user,
        include_email=True,
        is_admin=is_admin_user(user),
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update current user profile."""
    for field, value in user_update.model_dump(exclude_unset=True).items():
        if field not in ['current_skills', 'growth_skills']:
            setattr(current_user, field, value)
    
    # Update Current Skills
    if user_update.current_skills is not None:
        await db.execute(
            delete(UserSkill).where(
                UserSkill.user_id == current_user.id,
                UserSkill.skill_type == SkillType.CURRENT
            )
        )
        for skill_id in dict.fromkeys(user_update.current_skills):
            db.add(UserSkill(
                user_id=current_user.id,
                skill_id=skill_id,
                skill_type=SkillType.CURRENT
            ))

    # Update Growth Skills
    if user_update.growth_skills is not None:
        await db.execute(
            delete(UserSkill).where(
                UserSkill.user_id == current_user.id,
                UserSkill.skill_type == SkillType.GROWTH
            )
        )
        for skill_id in dict.fromkeys(user_update.growth_skills):
            db.add(UserSkill(
                user_id=current_user.id,
                skill_id=skill_id,
                skill_type=SkillType.GROWTH
            ))
    
    # Invalidate match cache so matches are recomputed with new skills next time
    await MatchingService.invalidate_cache(db, current_user.id)

    await db.commit()
    await db.refresh(current_user)
    return UserResponse(
        id=current_user.id,
        entra_oid=current_user.entra_oid,
        name=current_user.name,
        email=current_user.email,
        unit=current_user.unit,
        seniority=current_user.seniority,
        availability=current_user.availability,
        looking_for=current_user.looking_for or [],
        offering=current_user.offering or [],
        is_searchable=current_user.is_searchable,
        show_email=current_user.show_email,
        is_admin=is_admin_user(current_user),
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
    )


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new user (admin only)."""
    if not is_admin_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    # Check if email already exists (case-insensitive)
    result = await db.execute(
        select(User).where(func.lower(User.email) == user_data.email.lower())
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )
    
    user = User(**user_data.model_dump())
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/onboard", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def onboard_user(
    onboarding: UserOnboarding,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Complete onboarding for the currently authenticated user."""
    current_user.name = onboarding.name
    current_user.unit = onboarding.unit
    if onboarding.seniority is not None:
        current_user.seniority = onboarding.seniority
    if onboarding.availability is not None:
        current_user.availability = onboarding.availability

    # Clear existing skills to replace them
    await db.execute(delete(UserSkill).where(UserSkill.user_id == current_user.id))
    
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to update user profile due to a conflict",
        )
    
    # Add deduplicated current skills
    for skill_id in dict.fromkeys(onboarding.current_skills):
        db.add(UserSkill(
            user_id=current_user.id,
            skill_id=skill_id,
            skill_type=SkillType.CURRENT,
        ))
    
    # Add deduplicated growth skills
    for skill_id in dict.fromkeys(onboarding.growth_skills):
        db.add(UserSkill(
            user_id=current_user.id,
            skill_id=skill_id,
            skill_type=SkillType.GROWTH,
        ))
    
    # Invalidate match cache to ensure fresh matches for the updated user
    await MatchingService.invalidate_cache(db, current_user.id)

    await db.commit()
    await db.refresh(current_user)
    return UserResponse(
        id=current_user.id,
        entra_oid=current_user.entra_oid,
        name=current_user.name,
        email=current_user.email,
        unit=current_user.unit,
        seniority=current_user.seniority,
        availability=current_user.availability,
        looking_for=current_user.looking_for or [],
        offering=current_user.offering or [],
        is_searchable=current_user.is_searchable,
        show_email=current_user.show_email,
        is_admin=is_admin_user(current_user),
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
    )


@router.get("/", response_model=list[UserResponse])
async def list_users(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum records to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all users with pagination."""
    if not is_admin_user(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/candidates", response_model=list[UserWithSkills])
async def get_candidates(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get candidate users for swiping."""
    # Subquery to find users already swiped by current user
    subquery = select(Swipe.target_user_id).where(Swipe.user_id == current_user.id)
    
    # Query users:
    # 1. Not current user
    # 2. Not already swiped
    # 3. Is searchable
    result = await db.execute(
        select(User)
        .options(selectinload(User.skills).selectinload(UserSkill.skill))
        .where(User.id != current_user.id)
        .where(User.id.not_in(subquery))
        .where(User.is_searchable == True)
        .limit(limit)
    )
    users = result.scalars().all()

    return [
        _build_user_with_skills(user, include_email=bool(user.show_email))
        for user in users
    ]


@router.get("/{user_id}", response_model=UserWithSkills)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a user by ID with their skills."""
    real_user_id = await resolve_user_id(db, user_id)
    
    result = await db.execute(
        select(User)
        .options(selectinload(User.skills).selectinload(UserSkill.skill))
        .where(User.id == real_user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    is_self_or_admin = user.id == current_user.id or is_admin_user(current_user)
    if not user.is_searchable and not is_self_or_admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return _build_user_with_skills(
        user,
        include_email=(is_self_or_admin or bool(user.show_email)),
        is_admin=is_admin_user(user) if is_self_or_admin else False,
    )


@router.get("/by-email/{email}", response_model=UserResponse)
async def get_user_by_email(
    email: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a user by email."""
    if email.lower() != (current_user.email or "").lower() and not is_admin_user(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    result = await db.execute(select(User).where(func.lower(User.email) == email.lower()))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return user
