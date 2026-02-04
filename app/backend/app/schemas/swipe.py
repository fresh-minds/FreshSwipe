"""Swipe Pydantic schemas."""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from typing import Optional

from app.models.swipe import SwipeDirection


class SwipeCreate(BaseModel):
    """Schema for creating a new swipe."""
    user_id: str
    target_user_id: UUID
    direction: SwipeDirection


class SwipeResponse(BaseModel):
    """Schema for swipe response."""
    id: UUID
    user_id: UUID
    target_user_id: UUID
    direction: SwipeDirection
    created_at: datetime
    target_user_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class SwipeItem(BaseModel):
    """Schema for a single swipe in a batch."""
    target_user_id: UUID
    direction: SwipeDirection


class SwipeBatch(BaseModel):
    """Schema for batch swipe recording."""
    user_id: UUID
    swipes: list[SwipeItem]
