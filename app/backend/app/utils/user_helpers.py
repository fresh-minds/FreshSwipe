from uuid import UUID
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.models.user import User

async def resolve_user_id(db: AsyncSession, user_identifier: str) -> UUID:
    """
    Resolves a user ID from a string that could be a UUID or an Entra OID.
    Raises 404 if not found.
    """
    user_id_str = str(user_identifier)
    
    try:
        # If it looks like a UUID, check both ID and OID
        uuid_obj = UUID(user_id_str)
        query = select(User.id).where(
            or_(
                User.id == uuid_obj,
                User.entra_oid == user_id_str
            )
        )
    except ValueError:
        # Not a UUID, only check OID
        query = select(User.id).where(User.entra_oid == user_id_str)
        
    result = await db.execute(query)
    user_id = result.scalar_one_or_none()
    
    if not user_id:
        raise HTTPException(status_code=404, detail=f"User {user_identifier} not found")
        
    return user_id
