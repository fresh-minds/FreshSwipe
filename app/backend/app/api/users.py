"""Users API endpoints."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
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


@router.get("/me", response_model=UserWithSkills)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user profile with skills."""
    # We need to reload user with skills to ensure they are fetched
    result = await db.execute(
        select(User)
        .options(selectinload(User.skills).selectinload(UserSkill.skill))
        .where(User.id == current_user.id)
    )
    user = result.scalar_one_or_none()
    
    # Build response with skills
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
        name=user.name,
        email=user.email,
        unit=user.unit,
        created_at=user.created_at,
        updated_at=user.updated_at,
        current_skills=current_skills,
        growth_skills=growth_skills,
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update current user profile."""
    # Update basic fields
    for field, value in user_update.model_dump(exclude_unset=True).items():
        if field not in ['current_skills', 'growth_skills']:
            setattr(current_user, field, value)
    
    # Update Current Skills
    if user_update.current_skills is not None:
        # Delete existing current skills
        await db.execute(
            delete(UserSkill).where(
                UserSkill.user_id == current_user.id,
                UserSkill.skill_type == SkillType.CURRENT
            )
        )
        # Verify db.commit is not needed here if we flush later?
        # Actually standard practice is delete -> flush/add -> commit
        
        # Add new current skills
        for skill_id in user_update.current_skills:
            db.add(UserSkill(
                user_id=current_user.id,
                skill_id=skill_id,
                skill_type=SkillType.CURRENT
            ))

    # Update Growth Skills
    if user_update.growth_skills is not None:
        # Delete existing growth skills
        await db.execute(
            delete(UserSkill).where(
                UserSkill.user_id == current_user.id,
                UserSkill.skill_type == SkillType.GROWTH
            )
        )
        
        # Add new growth skills
        for skill_id in user_update.growth_skills:
            db.add(UserSkill(
                user_id=current_user.id,
                skill_id=skill_id,
                skill_type=SkillType.GROWTH
            ))
    
    # Invalidate match cache so matches are recomputed with new skills next time
    await MatchingService.invalidate_cache(db, current_user.id)

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create a new user."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
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
async def onboard_user(onboarding: UserOnboarding, db: AsyncSession = Depends(get_db)):
    """Complete user onboarding with skills. Updates existing user if email matches."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == onboarding.email))
    user = result.scalar_one_or_none()
    
    # If not found by email, try to find by OID
    if not user and onboarding.entra_oid:
         result = await db.execute(select(User).where(User.entra_oid == onboarding.entra_oid))
         user = result.scalar_one_or_none()
    
    if user:
        # Update existing user details
        user.name = onboarding.name
        user.email = onboarding.email # Ensure email is updated if we found by OID
        user.unit = onboarding.unit
        if onboarding.entra_oid:
             user.entra_oid = onboarding.entra_oid
        
        # Clear existing skills to replace them
        await db.execute(delete(UserSkill).where(UserSkill.user_id == user.id))
    else:
        # Create new user
        user = User(
            entra_oid=onboarding.entra_oid,
            name=onboarding.name,
            email=onboarding.email,
            unit=onboarding.unit,
        )
        db.add(user)
    
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email or ID already exists",
        )
    
    # Add current skills
    for skill_id in onboarding.current_skills:
        user_skill = UserSkill(
            user_id=user.id,
            skill_id=skill_id,
            skill_type=SkillType.CURRENT,
        )
        db.add(user_skill)
    
    # Add growth skills
    for skill_id in onboarding.growth_skills:
        user_skill = UserSkill(
            user_id=user.id,
            skill_id=skill_id,
            skill_type=SkillType.GROWTH,
        )
        db.add(user_skill)
    
    # Invalidate match cache to ensure fresh matches for the new/updated user
    await MatchingService.invalidate_cache(db, user.id)

    await db.flush()
    await db.refresh(user)
    return user


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

    response = []
    for user in users:
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
        
        response.append(UserWithSkills(
            id=user.id,
            name=user.name,
            email=user.email,
            unit=user.unit,
            created_at=user.created_at,
            updated_at=user.updated_at,
            seniority=user.seniority,
            availability=user.availability,
            current_skills=current_skills,
            growth_skills=growth_skills,
        ))
    
    return response


@router.get("/{user_id}", response_model=UserWithSkills)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a user by ID with their skills."""
    real_user_id = await resolve_user_id(db, user_id)
    # Allow any authenticated user to view profiles (needed for matches/networking)
    # if real_user_id != current_user.id and not is_admin_user(current_user):
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    
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
    
    # Build response with skills
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
        name=user.name,
        email=user.email,
        unit=user.unit,
        created_at=user.created_at,
        updated_at=user.updated_at,
        current_skills=current_skills,
        growth_skills=growth_skills,
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
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return user
