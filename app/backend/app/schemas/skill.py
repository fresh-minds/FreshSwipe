"""Skill Pydantic schemas."""
from uuid import UUID
from pydantic import BaseModel
from typing import Optional


class SkillCreate(BaseModel):
    """Schema for creating a new skill."""
    name: str
    category: str
    description: Optional[str] = None
    icon: Optional[str] = None
    display_order: int = 0
    is_active: bool = True


class SkillResponse(BaseModel):
    """Schema for skill response."""
    id: UUID
    name: str
    category: str
    description: Optional[str] = None
    icon: Optional[str] = None
    display_order: int
    is_active: bool
    
    class Config:
        from_attributes = True


class SkillWithStats(SkillResponse):
    """Schema for skill response with analytics."""
    total_swipes: int = 0
    right_swipes: int = 0
    super_swipes: int = 0
    interest_rate: float = 0.0
