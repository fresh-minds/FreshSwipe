from collections import defaultdict
import time
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.ai_service import AIAgentService

router = APIRouter(prefix="/chat", tags=["chat"])
ai_service = AIAgentService()

# Lightweight per-user sliding-window rate limiter (20 requests / 60s)
_RATE_LIMIT_WINDOW_SECONDS = 60
_RATE_LIMIT_MAX_REQUESTS = 20
_user_request_timestamps: dict[str, list[float]] = defaultdict(list)


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: Optional[list[ChatHistoryItem]] = Field(default=None, max_length=12)


class ChatResponse(BaseModel):
    response: str


def _enforce_rate_limit(user_key: str) -> None:
    now = time.monotonic()
    cutoff = now - _RATE_LIMIT_WINDOW_SECONDS
    recent = [ts for ts in _user_request_timestamps[user_key] if ts > cutoff]
    if len(recent) >= _RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many chat requests. Please wait a moment and try again.",
        )
    recent.append(now)
    _user_request_timestamps[user_key] = recent


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Handle chat messages and return AI responses."""
    if not request.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty")

    _enforce_rate_limit(str(current_user.id))

    history_payload = (
        [{"role": item.role, "content": item.content} for item in request.history]
        if request.history
        else None
    )
    if history_payload:
        response = await ai_service.generate_response(db, request.message, history=history_payload)
    else:
        response = await ai_service.generate_response(db, request.message)
    return ChatResponse(response=response)
