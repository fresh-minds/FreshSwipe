"""Swipe database model."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Uuid
import enum

from app.database import Base


class SwipeDirection(str, enum.Enum):
    """Swipe direction types."""
    LEFT = "left"
    RIGHT = "right"
    SUPER = "super"


import os

def _user_fk_ondelete() -> str:
    engine = os.getenv("DB_ENGINE", "").strip().lower()
    if engine in {"mssql", "azure-sql", "sqlserver"}:
        return "NO ACTION"
    return "CASCADE"


class Swipe(Base):
    """Swipe model representing a user's interest in a user."""
    
    __tablename__ = "swipes"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete=_user_fk_ondelete()),
        nullable=False,
    )
    target_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete=_user_fk_ondelete()),
        nullable=False,
    )
    direction: Mapped[SwipeDirection] = mapped_column(
        Enum(SwipeDirection),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="swipes_made")
    target_user: Mapped["User"] = relationship("User", foreign_keys=[target_user_id], back_populates="swipes_received")


# Import at end to avoid circular imports
from app.models.user import User
