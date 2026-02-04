"""Match Pydantic schemas."""
from uuid import UUID
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class MatchResponse(BaseModel):
    """Schema for match details."""
    id: UUID
    user_a_id: UUID
    user_b_id: UUID
    score: float
    reasons: List[str]
    match_type: str
    user_b_name: Optional[str] = None
    user_b_email: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
