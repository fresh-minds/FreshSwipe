"""Skill database model."""
import uuid
from sqlalchemy import String, Integer, Boolean, Text, Unicode, UnicodeText
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Uuid

from app.database import Base


class Skill(Base):
    """Skill model representing a professional skill or domain."""
    
    __tablename__ = "skills"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(Unicode(100), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(Unicode(50), nullable=False)
    description: Mapped[str] = mapped_column(UnicodeText, nullable=True)
    icon: Mapped[str] = mapped_column(Unicode(50), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Relationships
    user_skills: Mapped[list["UserSkill"]] = relationship(
        "UserSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )

# Import at end to avoid circular imports
from app.models.user import UserSkill
