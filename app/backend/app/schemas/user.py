"""User Pydantic schemas."""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.models.user import UnitType, SkillType


class UserSkillCreate(BaseModel):
    """Schema for creating a user-skill relationship."""
    skill_id: UUID
    skill_type: SkillType


class UserSkillResponse(BaseModel):
    """Schema for user-skill response."""
    id: UUID
    skill_id: UUID
    skill_type: SkillType
    skill_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    """Schema for creating a new user."""
    name: str
    email: EmailStr
    unit: UnitType


class UserOnboarding(BaseModel):
    """Schema for complete user onboarding."""
    entra_oid: Optional[str] = None
    name: str
    email: EmailStr
    unit: UnitType
    current_skills: list[UUID] = []
    growth_skills: list[UUID] = []


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    name: Optional[str] = None
    unit: Optional[UnitType] = None
    seniority: Optional[str] = None
    availability: Optional[str] = None
    looking_for: Optional[list[str]] = None
    offering: Optional[list[str]] = None
    is_searchable: Optional[bool] = None
    show_email: Optional[bool] = None
    current_skills: Optional[list[UUID]] = None
    growth_skills: Optional[list[UUID]] = None


class UserResponse(BaseModel):
    """Schema for user response."""
    id: UUID
    entra_oid: Optional[str] = None
    name: str
    email: str
    unit: UnitType
    seniority: Optional[str] = None
    availability: Optional[str] = None
    looking_for: list[str] = []
    offering: list[str] = []
    is_searchable: bool = True
    show_email: bool = True
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserWithSkills(UserResponse):
    """Schema for user response including skills."""
    current_skills: list[UserSkillResponse] = []
    growth_skills: list[UserSkillResponse] = []
