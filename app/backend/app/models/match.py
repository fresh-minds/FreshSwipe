"""Match database model."""
import os
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Uuid

from app.database import Base


def _user_fk_ondelete() -> str:
    engine = os.getenv("DB_ENGINE", "").strip().lower()
    if engine in {"mssql", "azure-sql", "sqlserver"}:
        return "NO ACTION"
    return "CASCADE"


class Match(Base):
    """Cached match results between two users."""
    
    __tablename__ = "matches"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_a_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete=_user_fk_ondelete()),
        nullable=False,
    )
    user_b_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete=_user_fk_ondelete()),
        nullable=False,
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)
    reasons: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    match_type: Mapped[str] = mapped_column(String(50), nullable=False)  # peer or mentor
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Relationships
    user_a: Mapped["User"] = relationship("User", foreign_keys=[user_a_id])
    user_b: Mapped["User"] = relationship("User", foreign_keys=[user_b_id])


# Import at end to avoid circular imports
from app.models.user import User
