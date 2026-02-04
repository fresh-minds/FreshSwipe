"""Feedback schemas."""
from datetime import datetime
from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    """Create feedback."""
    message: str = Field(..., min_length=3, max_length=2000)
    rating: int | None = Field(default=None, ge=1, le=5)
    category: str | None = Field(default=None, max_length=50)
    page: str | None = Field(default=None, max_length=255)


class FeedbackResponse(BaseModel):
    """Feedback response model."""
    id: str
    user_id: str
    user_name: str
    user_email: str
    message: str
    rating: int | None
    category: str | None
    page: str | None
    created_at: datetime
