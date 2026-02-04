"""User and UserSkill database models."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, Enum, JSON, Unicode
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Uuid
import enum

from app.database import Base


class UnitType(str, enum.Enum):
    """Employee unit types."""
    SOFTWARE = "Software"
    DATA = "Data"
    CLOUD = "Cloud"
    SECURITY = "Security"
    STAFF = "Staff"


class SkillType(str, enum.Enum):
    """User skill relationship types."""
    CURRENT = "current"
    GROWTH = "growth"


class User(Base):
    """User model representing an employee."""
    
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    entra_oid: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(Unicode(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    unit: Mapped[UnitType] = mapped_column(Enum(UnitType), nullable=False, default=UnitType.STAFF)
    
    # Profile fields for matching
    seniority: Mapped[Optional[str]] = mapped_column(Unicode(50))
    availability: Mapped[Optional[str]] = mapped_column(Unicode(100))
    looking_for: Mapped[list[str]] = mapped_column(JSON, default=list)
    offering: Mapped[list[str]] = mapped_column(JSON, default=list)
    
    # Privacy
    is_searchable: Mapped[bool] = mapped_column(default=True)
    show_email: Mapped[bool] = mapped_column(default=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Relationships
    skills: Mapped[list["UserSkill"]] = relationship(
        "UserSkill",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    swipes_made: Mapped[list["Swipe"]] = relationship(
        "Swipe",
        foreign_keys="Swipe.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    swipes_received: Mapped[list["Swipe"]] = relationship(
        "Swipe",
        foreign_keys="Swipe.target_user_id",
        back_populates="target_user",
        cascade="all, delete-orphan",
    )


class UserSkill(Base):
    """Association between users and their skills (current or growth)."""
    
    __tablename__ = "user_skills"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
    )
    skill_type: Mapped[SkillType] = mapped_column(
        Enum(SkillType),
        nullable=False,
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="skills")
    skill: Mapped["Skill"] = relationship("Skill", back_populates="user_skills")


# Import at end to avoid circular imports
from app.models.skill import Skill
from app.models.swipe import Swipe
