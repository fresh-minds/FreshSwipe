
import pytest
from httpx import AsyncClient
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.swipe import Swipe, SwipeDirection
from app.models.match import Match
from app.models.user import User, UnitType

@pytest.mark.asyncio
async def test_reset_swipes(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User
):
    """Test resetting swipes and matches."""
    # 1. Setup Data
    # Add test_user_2 to DB
    db_session.add(test_user_2)
    
    # Create a 3rd user to verify their data isn't deleted
    user_3 = User(
        id=uuid4(),
        entra_oid="user3",
        name="User 3",
        email="user3@example.com",
        unit=UnitType.DATA,
        seniority="Junior",
        availability="1h",
    )
    db_session.add(user_3)
    await db_session.commit()
    
    # Create swipes
    # User 1 -> User 2 (Right)
    swipe_1 = Swipe(
        user_id=test_user.id,
        target_user_id=test_user_2.id,
        direction=SwipeDirection.RIGHT
    )
    # User 2 -> User 1 (Right)
    swipe_2 = Swipe(
        user_id=test_user_2.id,
        target_user_id=test_user.id,
        direction=SwipeDirection.RIGHT
    )
    # User 3 -> User 2 (Left) - Should remain
    swipe_3 = Swipe(
        user_id=user_3.id,
        target_user_id=test_user_2.id,
        direction=SwipeDirection.LEFT
    )
    
    db_session.add_all([swipe_1, swipe_2, swipe_3])
    
    # Create a match between User 1 and User 2
    match_1 = Match(
        user_a_id=test_user.id,
        user_b_id=test_user_2.id,
        score=100.0,
        reasons=["Test"],
        match_type="mutual"
    )
    # Create a match involving User 3 (unrelated to User 1) - e.g. User 3 and User 2
    match_2 = Match(
        user_a_id=user_3.id,
        user_b_id=test_user_2.id,
        score=50.0,
        reasons=["Test"],
        match_type="mutual"
    )
    
    db_session.add_all([match_1, match_2])
    await db_session.commit()
    
    # Verify initial state
    result = await db_session.execute(select(Swipe))
    assert len(result.scalars().all()) == 3
    result = await db_session.execute(select(Match))
    assert len(result.scalars().all()) == 2
    
    # 2. Call Reset Endpoint
    response = await authenticated_client.delete("/api/v1/swipes/")
    assert response.status_code == 204
    
    # 3. Verify Deletion
    # User 1's swipe should be gone
    result = await db_session.execute(
        select(Swipe).where(Swipe.user_id == test_user.id)
    )
    assert len(result.scalars().all()) == 0
    
    # User 2's swipe should still be there (or maybe we only clear swipes MADE by the user?)
    # "Reset all swipes and matches for the current user" -> swipes MADE by them basically.
    # What about swipes RECEIVED? The prompt said "option to swipe all over".
    # Typically this means resetting YOUR actions.
    # If I reset, I want to see everyone again.
    # So my swipes (User 1 -> Others) must be deleted.
    # Matches involving me must be deleted.
    
    # Checking remaining swipes
    result = await db_session.execute(select(Swipe))
    swipes = result.scalars().all()
    # swipe_1 (User 1 -> 2) should be gone.
    # swipe_2 (User 2 -> 1) should remain? 
    # If User 2 swipe remains, when User 1 swipes User 2 again, it will match immediately if Right.
    # That seems correct for "swipe all over".
    
    assert len(swipes) == 2
    assert swipe_1.id not in [s.id for s in swipes]
    assert swipe_2.id in [s.id for s in swipes]
    assert swipe_3.id in [s.id for s in swipes]
    
    # Checking matches
    # match_1 (involving User 1) should be gone.
    # match_2 (User 3 <-> User 2) should remain.
    result = await db_session.execute(select(Match))
    matches = result.scalars().all()
    assert len(matches) == 1
    assert matches[0].id == match_2.id
