"""Coffee Date Pydantic schemas."""
from uuid import UUID
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from app.models.coffee_date import CoffeeDateStatus


class CoffeeDateSuggestion(BaseModel):
    """Schema for a suggested coffee date match."""
    user_id: UUID
    user_name: str
    user_email: str
    user_unit: str
    user_seniority: Optional[str] = None
    user_availability: Optional[str] = None
    score: float
    reasons: List[str]
    match_type: str  # "mentor", "mentee", "peer"


class CoffeeDateRequest(BaseModel):
    """Schema for creating a coffee date request."""
    recipient_id: UUID
    proposed_time: Optional[datetime] = None
    location: Optional[str] = None
    message: Optional[str] = None


class CoffeeDateResponse(BaseModel):
    """Schema for responding to a coffee date request."""
    status: CoffeeDateStatus  # Only "accepted" or "declined" allowed


class CoffeeDateOut(BaseModel):
    """Schema for coffee date details."""
    id: UUID
    requester_id: UUID
    requester_name: str
    requester_email: str
    recipient_id: UUID
    recipient_name: str
    recipient_email: str
    status: CoffeeDateStatus
    proposed_time: Optional[datetime] = None
    location: Optional[str] = None
    message: Optional[str] = None
    match_score: float
    match_reasons: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
