import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UnitType, SkillType, UserSkill
from app.models.match import Match
from app.models.skill import Skill

@pytest.mark.asyncio
async def test_match_cache_invalidation_on_profile_update(
    authenticated_client: AsyncClient,
    test_user: User,  # The user authenticated in the client
    db_session: AsyncSession,
):
    """
    Test that updating a user profile invalidates their match cache.
    """
    # 1. Setup: Create a dummy match in the database for the test user
    # This simulates a cached match
    match = Match(
        user_a_id=test_user.id,
        user_b_id=test_user.id, # Self match just for cache testing logic (normally invalid) or use uuid
        score=50.0,
        reasons=["Legacy Match"],
        match_type="peer"
    )
    db_session.add(match)
    await db_session.commit()
    
    # Verify match exists
    result = await db_session.execute(select(Match).where(Match.user_a_id == test_user.id))
    assert result.scalar_one_or_none() is not None, "Match should exist before update"

    # 2. Action: Update the user's profile
    # We'll update their unit or something simple
    update_payload = {
        "unit": UnitType.SECURITY,
        # We must send some skill data or at least empty lists if the endpoint expects it, 
        # but the patch endpoint handles partial updates.
        "availability": "Always"
    }

    response = await authenticated_client.patch("/api/v1/users/me", json=update_payload)
    assert response.status_code == 200

    # 3. Verification: Check if the match was deleted (invalidated)
    # The `invalidate_cache` function we mocked/implemented deletes matches where match_type != 'mutual'
    result = await db_session.execute(
        select(Match).where(
            Match.user_a_id == test_user.id,
            Match.match_type == "peer" # types other than mutual are deleted
        )
    )
    match_after = result.scalar_one_or_none()
    
    assert match_after is None, "Match cache should be invalidated (deleted) after profile update"
