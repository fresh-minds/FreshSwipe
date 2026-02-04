"""Swipes API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_user, is_admin_user
from app.models.swipe import Swipe, SwipeDirection
from app.models.user import User
from app.schemas.swipe import SwipeCreate, SwipeResponse, SwipeBatch
from app.utils.user_helpers import resolve_user_id

router = APIRouter(prefix="/swipes", tags=["swipes"])


@router.post("/", response_model=SwipeResponse, status_code=status.HTTP_201_CREATED)
async def create_swipe(
    swipe_data: SwipeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a swipe."""
    real_user_id = current_user.id

    # Check if swipe already exists for this user/target_user
    result = await db.execute(
        select(Swipe).where(
            Swipe.user_id == real_user_id,
            Swipe.target_user_id == swipe_data.target_user_id,
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        # Update existing swipe
        existing.direction = swipe_data.direction
        await db.flush()
        await db.refresh(existing)
        return existing
    
    # Create new swipe
    # Use resolved real_user_id
    swipe = Swipe(
        user_id=real_user_id,
        target_user_id=swipe_data.target_user_id,
        direction=swipe_data.direction
    )
    db.add(swipe)
    await db.flush()
    await db.refresh(swipe)
    return swipe


@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def create_batch_swipes(
    batch: SwipeBatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record multiple swipes at once."""
    created = []
    user_id = current_user.id
    
    for swipe_item in batch.swipes:
        # Check if swipe already exists
        result = await db.execute(
            select(Swipe).where(
                Swipe.user_id == user_id,
                Swipe.target_user_id == swipe_item.target_user_id,
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            existing.direction = swipe_item.direction
            created.append(existing)
        else:
            swipe = Swipe(
                user_id=user_id,
                target_user_id=swipe_item.target_user_id,
                direction=swipe_item.direction,
            )
            db.add(swipe)
            created.append(swipe)
    
    await db.flush()
    return {"created": len(created)}


@router.get("/user/{user_id}", response_model=list[SwipeResponse])
async def get_user_swipes(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all swipes for a user."""
    real_user_id = await resolve_user_id(db, user_id)
    if real_user_id != current_user.id and not is_admin_user(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    
    result = await db.execute(
        select(Swipe)
        .options(selectinload(Swipe.target_user))
        .where(Swipe.user_id == real_user_id)
        .order_by(Swipe.created_at.desc())
    )
    swipes = result.scalars().all()
    
    # Add target user names
    return [
        SwipeResponse(
            id=s.id,
            user_id=s.user_id,
            target_user_id=s.target_user_id,
            direction=s.direction,
            created_at=s.created_at,
            target_user_name=s.target_user.name if s.target_user else None,
        )
        for s in swipes
    ]


@router.get("/user/{user_id}/interests", response_model=list[SwipeResponse])
async def get_user_interests(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get users a user is interested in (right or super swipes)."""
    real_user_id = await resolve_user_id(db, user_id)
    
    result = await db.execute(
        select(Swipe)
        .options(selectinload(Swipe.target_user))
        .where(
            Swipe.user_id == real_user_id,
            Swipe.direction.in_([SwipeDirection.RIGHT, SwipeDirection.SUPER]),
        )
        .order_by(Swipe.created_at.desc())
    )
    swipes = result.scalars().all()
    
    return [
        SwipeResponse(
            id=s.id,
            user_id=s.user_id,
            target_user_id=s.target_user_id,
            direction=s.direction,
            created_at=s.created_at,
            target_user_name=s.target_user.name if s.target_user else None,
        )
        for s in swipes
    ]
