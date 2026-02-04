"""Coffee Dates API endpoints."""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.coffee_date import CoffeeDate, CoffeeDateStatus
from app.models.match import Match
from app.services.matching import MatchingService
from app.schemas.coffee_date import (
    CoffeeDateSuggestion,
    CoffeeDateRequest,
    CoffeeDateResponse,
    CoffeeDateOut,
)

router = APIRouter(prefix="/coffee-dates", tags=["coffee-dates"])


@router.get("/suggestions", response_model=List[CoffeeDateSuggestion])
async def get_coffee_date_suggestions(
    limit: int = Query(10, ge=1, le=50, description="Maximum suggestions to return"),
    match_type: Optional[str] = Query(None, description="Filter by 'peer' or 'mentor'"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get suggested colleagues for coffee dates based on skill matching."""
    # Get matches using the existing matching service
    matches = await MatchingService.get_matches(db, current_user.id, match_type)
    
    # Filter out users who already have pending coffee date requests
    existing_requests = await db.execute(
        select(CoffeeDate.recipient_id).where(
            CoffeeDate.requester_id == current_user.id,
            CoffeeDate.status.in_([
                CoffeeDateStatus.REQUESTED, 
                CoffeeDateStatus.ACCEPTED
            ])
        )
    )
    pending_recipient_ids = set(row[0] for row in existing_requests.fetchall())
    
    suggestions = []
    for match in matches[:limit * 2]:  # Get extra in case we filter some out
        if match.user_b_id in pending_recipient_ids:
            continue
            
        # Get the matched user details
        user_result = await db.execute(
            select(User).where(User.id == match.user_b_id)
        )
        matched_user = user_result.scalar_one_or_none()
        
        if matched_user and matched_user.is_searchable:
            suggestions.append(CoffeeDateSuggestion(
                user_id=matched_user.id,
                user_name=matched_user.name,
                user_email=matched_user.email if matched_user.show_email else "",
                user_unit=matched_user.unit.value if matched_user.unit else "Unknown",
                user_seniority=matched_user.seniority,
                user_availability=matched_user.availability,
                score=match.score,
                reasons=match.reasons,
                match_type=match.match_type,
            ))
            
            if len(suggestions) >= limit:
                break
    
    return suggestions


@router.post("/auto-match", response_model=CoffeeDateOut, status_code=status.HTTP_201_CREATED)
async def auto_match_coffee_date(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ensure the user has at least one coffee date match (requested or accepted)."""
    existing = await db.execute(
        select(CoffeeDate)
        .options(selectinload(CoffeeDate.requester), selectinload(CoffeeDate.recipient))
        .where(
            or_(
                CoffeeDate.requester_id == current_user.id,
                CoffeeDate.recipient_id == current_user.id,
            ),
            CoffeeDate.status.in_([CoffeeDateStatus.REQUESTED, CoffeeDateStatus.ACCEPTED]),
        )
        .order_by(CoffeeDate.created_at.desc())
        .limit(1)
    )
    coffee_date = existing.scalar_one_or_none()
    if coffee_date:
        return CoffeeDateOut(
            id=coffee_date.id,
            requester_id=coffee_date.requester_id,
            requester_name=coffee_date.requester.name,
            requester_email=coffee_date.requester.email,
            recipient_id=coffee_date.recipient_id,
            recipient_name=coffee_date.recipient.name,
            recipient_email=coffee_date.recipient.email if coffee_date.recipient.show_email else "",
            status=coffee_date.status,
            proposed_time=coffee_date.proposed_time,
            location=coffee_date.location,
            message=coffee_date.message,
            match_score=coffee_date.match_score,
            match_reasons=coffee_date.match_reasons,
            created_at=coffee_date.created_at,
            updated_at=coffee_date.updated_at,
        )

    matches = await MatchingService.get_matches(db, current_user.id)
    recipient = None
    match_info = None
    for match in matches:
        if match.user_b_id == current_user.id:
            continue
        user_result = await db.execute(select(User).where(User.id == match.user_b_id))
        candidate = user_result.scalar_one_or_none()
        if candidate and candidate.is_searchable:
            recipient = candidate
            match_info = match
            break

    if not recipient:
        # Fallback: Find a random searchable user
        from sqlalchemy.sql.expression import func
        from app.config import get_settings
        
        settings = get_settings()
        # Use NEWID() for MSSQL, random() for others (SQLite/Postgres)
        if "mssql" in settings.database_url:
            order_func = func.newid()
        else:
            order_func = func.random()
            
        random_user_query = (
            select(User)
            .where(User.id != current_user.id)
            .where(User.is_searchable == True)
            .order_by(order_func)
            .limit(1)
        )
        random_user_result = await db.execute(random_user_query)
        recipient = random_user_result.scalar_one_or_none()

    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No suitable coffee date match found",
        )

    coffee_date = CoffeeDate(
        requester_id=current_user.id,
        recipient_id=recipient.id,
        match_id=match_info.id if match_info else None,
        status=CoffeeDateStatus.REQUESTED,
        proposed_time=None,
        location="Teams call",
        message="Hey! I'd love to grab a virtual coffee and chat about our shared interests!",
        match_score=match_info.score if match_info else 0.0,
        match_reasons=match_info.reasons if match_info else [],
    )
    db.add(coffee_date)
    await db.commit()
    await db.refresh(coffee_date)

    return CoffeeDateOut(
        id=coffee_date.id,
        requester_id=current_user.id,
        requester_name=current_user.name,
        requester_email=current_user.email,
        recipient_id=recipient.id,
        recipient_name=recipient.name,
        recipient_email=recipient.email if recipient.show_email else "",
        status=coffee_date.status,
        proposed_time=coffee_date.proposed_time,
        location=coffee_date.location,
        message=coffee_date.message,
        match_score=coffee_date.match_score,
        match_reasons=coffee_date.match_reasons,
        created_at=coffee_date.created_at,
        updated_at=coffee_date.updated_at,
    )


@router.post("/request", response_model=CoffeeDateOut, status_code=status.HTTP_201_CREATED)
async def create_coffee_date_request(
    request: CoffeeDateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a coffee date request to a colleague."""
    # Check if recipient exists
    recipient_result = await db.execute(
        select(User).where(User.id == request.recipient_id)
    )
    recipient = recipient_result.scalar_one_or_none()
    
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient user not found"
        )
    
    if recipient.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send coffee date request to yourself"
        )
    
    # Check for existing pending request
    existing = await db.execute(
        select(CoffeeDate).where(
            CoffeeDate.requester_id == current_user.id,
            CoffeeDate.recipient_id == request.recipient_id,
            CoffeeDate.status.in_([CoffeeDateStatus.REQUESTED, CoffeeDateStatus.ACCEPTED])
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending or accepted coffee date with this user"
        )
    
    # Get match info for context
    matches = await MatchingService.get_matches(db, current_user.id)
    match_info = next((m for m in matches if m.user_b_id == request.recipient_id), None)
    
    coffee_date = CoffeeDate(
        requester_id=current_user.id,
        recipient_id=request.recipient_id,
        match_id=match_info.id if match_info else None,
        status=CoffeeDateStatus.REQUESTED,
        proposed_time=request.proposed_time,
        location=request.location,
        message=request.message,
        match_score=match_info.score if match_info else 0.0,
        match_reasons=match_info.reasons if match_info else [],
    )
    
    db.add(coffee_date)
    await db.commit()
    await db.refresh(coffee_date)
    
    return CoffeeDateOut(
        id=coffee_date.id,
        requester_id=current_user.id,
        requester_name=current_user.name,
        requester_email=current_user.email,
        recipient_id=recipient.id,
        recipient_name=recipient.name,
        recipient_email=recipient.email if recipient.show_email else "",
        status=coffee_date.status,
        proposed_time=coffee_date.proposed_time,
        location=coffee_date.location,
        message=coffee_date.message,
        match_score=coffee_date.match_score,
        match_reasons=coffee_date.match_reasons,
        created_at=coffee_date.created_at,
        updated_at=coffee_date.updated_at,
    )


@router.get("/", response_model=List[CoffeeDateOut])
async def list_coffee_dates(
    status_filter: Optional[CoffeeDateStatus] = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all coffee dates (sent and received)."""
    query = select(CoffeeDate).where(
        or_(
            CoffeeDate.requester_id == current_user.id,
            CoffeeDate.recipient_id == current_user.id
        )
    ).options(
        selectinload(CoffeeDate.requester),
        selectinload(CoffeeDate.recipient)
    ).order_by(CoffeeDate.created_at.desc())
    
    if status_filter:
        query = query.where(CoffeeDate.status == status_filter)
    
    result = await db.execute(query)
    coffee_dates = result.scalars().all()
    
    return [
        CoffeeDateOut(
            id=cd.id,
            requester_id=cd.requester_id,
            requester_name=cd.requester.name,
            requester_email=cd.requester.email,
            recipient_id=cd.recipient_id,
            recipient_name=cd.recipient.name,
            recipient_email=cd.recipient.email if cd.recipient.show_email else "",
            status=cd.status,
            proposed_time=cd.proposed_time,
            location=cd.location,
            message=cd.message,
            match_score=cd.match_score,
            match_reasons=cd.match_reasons,
            created_at=cd.created_at,
            updated_at=cd.updated_at,
        )
        for cd in coffee_dates
    ]


@router.patch("/{coffee_date_id}/respond", response_model=CoffeeDateOut)
async def respond_to_coffee_date(
    coffee_date_id: UUID,
    response: CoffeeDateResponse,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Accept or decline a coffee date request."""
    if response.status not in [CoffeeDateStatus.ACCEPTED, CoffeeDateStatus.DECLINED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'accepted' or 'declined'"
        )
    
    result = await db.execute(
        select(CoffeeDate)
        .options(selectinload(CoffeeDate.requester), selectinload(CoffeeDate.recipient))
        .where(CoffeeDate.id == coffee_date_id)
    )
    coffee_date = result.scalar_one_or_none()
    
    if not coffee_date:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coffee date not found"
        )
    
    if coffee_date.recipient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the recipient can respond to this coffee date request"
        )
    
    if coffee_date.status != CoffeeDateStatus.REQUESTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot respond to a coffee date with status '{coffee_date.status.value}'"
        )
    
    coffee_date.status = response.status
    coffee_date.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(coffee_date)
    
    return CoffeeDateOut(
        id=coffee_date.id,
        requester_id=coffee_date.requester_id,
        requester_name=coffee_date.requester.name,
        requester_email=coffee_date.requester.email,
        recipient_id=coffee_date.recipient_id,
        recipient_name=coffee_date.recipient.name,
        recipient_email=coffee_date.recipient.email if coffee_date.recipient.show_email else "",
        status=coffee_date.status,
        proposed_time=coffee_date.proposed_time,
        location=coffee_date.location,
        message=coffee_date.message,
        match_score=coffee_date.match_score,
        match_reasons=coffee_date.match_reasons,
        created_at=coffee_date.created_at,
        updated_at=coffee_date.updated_at,
    )


@router.patch("/{coffee_date_id}/complete", response_model=CoffeeDateOut)
async def complete_coffee_date(
    coffee_date_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a coffee date as completed."""
    result = await db.execute(
        select(CoffeeDate)
        .options(selectinload(CoffeeDate.requester), selectinload(CoffeeDate.recipient))
        .where(CoffeeDate.id == coffee_date_id)
    )
    coffee_date = result.scalar_one_or_none()
    
    if not coffee_date:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coffee date not found"
        )
    
    # Either party can mark as complete
    if coffee_date.requester_id != current_user.id and coffee_date.recipient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only participants can mark this coffee date as complete"
        )
    
    if coffee_date.status != CoffeeDateStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only accepted coffee dates can be marked as complete"
        )
    
    coffee_date.status = CoffeeDateStatus.COMPLETED
    coffee_date.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(coffee_date)
    
    return CoffeeDateOut(
        id=coffee_date.id,
        requester_id=coffee_date.requester_id,
        requester_name=coffee_date.requester.name,
        requester_email=coffee_date.requester.email,
        recipient_id=coffee_date.recipient_id,
        recipient_name=coffee_date.recipient.name,
        recipient_email=coffee_date.recipient.email if coffee_date.recipient.show_email else "",
        status=coffee_date.status,
        proposed_time=coffee_date.proposed_time,
        location=coffee_date.location,
        message=coffee_date.message,
        match_score=coffee_date.match_score,
        match_reasons=coffee_date.match_reasons,
        created_at=coffee_date.created_at,
        updated_at=coffee_date.updated_at,
    )
