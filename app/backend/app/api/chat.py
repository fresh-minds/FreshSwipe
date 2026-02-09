from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.ai_service import AIAgentService

router = APIRouter(prefix="/chat", tags=["chat"])
ai_service = AIAgentService()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Handle chat messages and return AI responses."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
        
    response = await ai_service.generate_response(db, request.message)
    return ChatResponse(response=response)
