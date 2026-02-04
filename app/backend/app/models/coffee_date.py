"""Coffee Date database model."""
import os
import uuid
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, Float, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Uuid

from app.database import Base


def _user_fk_ondelete() -> str:
    engine = os.getenv("DB_ENGINE", "").strip().lower()
    if engine in {"mssql", "azure-sql", "sqlserver"}:
        return "NO ACTION"
    return "CASCADE"


class CoffeeDateStatus(str, enum.Enum):
    """Status of a coffee date request."""
    SUGGESTED = "suggested"    # System suggested this match
    REQUESTED = "requested"    # User sent a coffee date request
    ACCEPTED = "accepted"      # Recipient accepted
    DECLINED = "declined"      # Recipient declined
    COMPLETED = "completed"    # Coffee date happened


class CoffeeDate(Base):
    """Coffee Date model for tracking colleague meetups."""
    
    __tablename__ = "coffee_dates"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    requester_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete=_user_fk_ondelete()),
        nullable=False,
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete=_user_fk_ondelete()),
        nullable=False,
    )
    match_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("matches.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[CoffeeDateStatus] = mapped_column(
        default=CoffeeDateStatus.SUGGESTED,
        nullable=False,
    )
    proposed_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Cached match info at time of request
    match_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    match_reasons: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    
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
    requester: Mapped["User"] = relationship("User", foreign_keys=[requester_id])
    recipient: Mapped["User"] = relationship("User", foreign_keys=[recipient_id])
    match: Mapped["Match"] = relationship("Match", foreign_keys=[match_id])


# Import at end to avoid circular imports
from app.models.user import User
from app.models.match import Match
