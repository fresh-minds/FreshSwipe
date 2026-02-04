"""Feedback API endpoints."""
import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_user, is_admin_user
from app.config import get_settings
from app.models.feedback import Feedback
from app.models.user import User
from app.schemas.feedback import FeedbackCreate, FeedbackResponse

router = APIRouter(prefix="/feedback", tags=["feedback"])
settings = get_settings()


@router.post("/", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    payload: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feedback = Feedback(
        user_id=current_user.id,
        message=payload.message,
        rating=payload.rating,
        category=payload.category,
        page=payload.page,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return FeedbackResponse(
        id=str(feedback.id),
        user_id=str(current_user.id),
        user_name=current_user.name,
        user_email=current_user.email,
        message=feedback.message,
        rating=feedback.rating,
        category=feedback.category,
        page=feedback.page,
        created_at=feedback.created_at,
    )


@router.get("/", response_model=list[FeedbackResponse])
async def list_feedback(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_admin_user(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    result = await db.execute(
        select(Feedback)
        .options(selectinload(Feedback.user))
        .order_by(Feedback.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        FeedbackResponse(
            id=str(row.id),
            user_id=str(row.user_id),
            user_name=row.user.name if row.user else "",
            user_email=row.user.email if row.user else "",
            message=row.message,
            rating=row.rating,
            category=row.category,
            page=row.page,
            created_at=row.created_at,
        )
        for row in rows
    ]
