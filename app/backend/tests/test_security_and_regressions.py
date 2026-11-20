"""Regression tests covering security, privacy, and stability fixes."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.coffee_date import CoffeeDate, CoffeeDateStatus
from app.models.match import Match
from app.models.skill import Skill
from app.models.swipe import Swipe, SwipeDirection
from app.models.user import SkillType, UnitType, User, UserSkill
from app.services.matching import MatchingService


@pytest.mark.asyncio
async def test_analytics_non_admin_returns_403_not_500(
    authenticated_client: AsyncClient,
):
    """Non-admin requests to admin analytics must return 403 (status imported)."""
    resp_skills = await authenticated_client.get("/api/v1/analytics/organization/skills")
    assert resp_skills.status_code == 403

    resp_units = await authenticated_client.get("/api/v1/analytics/organization/units")
    assert resp_units.status_code == 403

    resp_other = await authenticated_client.get(f"/api/v1/analytics/user/{uuid4()}/summary")
    assert resp_other.status_code == 403


@pytest.mark.asyncio
async def test_analytics_unit_filter_actually_filters(
    admin_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
    test_skill: Skill,
):
    """Filtering org skill stats by unit should only count skills for users in that unit."""
    db_session.add_all([test_user_2, test_skill])
    await db_session.flush()
    # test_user is DATA (growth skill), test_user_2 is SOFTWARE (current skill)
    db_session.add_all([
        UserSkill(user_id=test_user.id, skill_id=test_skill.id, skill_type=SkillType.GROWTH),
        UserSkill(user_id=test_user_2.id, skill_id=test_skill.id, skill_type=SkillType.CURRENT),
    ])
    await db_session.commit()

    resp_data = await admin_client.get("/api/v1/analytics/organization/skills?unit=Data")
    assert resp_data.status_code == 200
    skill_row_data = next(s for s in resp_data.json() if s["name"] == test_skill.name)
    assert skill_row_data["demand"] == 1
    assert skill_row_data["supply"] == 0

    resp_sw = await admin_client.get("/api/v1/analytics/organization/skills?unit=Software")
    assert resp_sw.status_code == 200
    skill_row_sw = next(s for s in resp_sw.json() if s["name"] == test_skill.name)
    assert skill_row_sw["demand"] == 0
    assert skill_row_sw["supply"] == 1


@pytest.mark.asyncio
async def test_swipes_interests_requires_auth(unauthenticated_client: AsyncClient):
    """GET /swipes/user/{id}/interests must reject unauthenticated callers."""
    unauth = await unauthenticated_client.get(f"/api/v1/swipes/user/{uuid4()}/interests")
    assert unauth.status_code == 401


@pytest.mark.asyncio
async def test_swipes_list_and_interests_work_and_enforce_ownership(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
):
    """GET /swipes/user/{id} and /interests load target_user without NameError and enforce ownership."""
    db_session.add(test_user_2)
    db_session.add(Swipe(user_id=test_user.id, target_user_id=test_user_2.id, direction=SwipeDirection.RIGHT))
    await db_session.commit()

    resp_all = await authenticated_client.get(f"/api/v1/swipes/user/{test_user.id}")
    assert resp_all.status_code == 200
    assert resp_all.json()[0]["target_user_name"] == test_user_2.name

    resp_int = await authenticated_client.get(f"/api/v1/swipes/user/{test_user.id}/interests")
    assert resp_int.status_code == 200
    assert len(resp_int.json()) == 1
    assert resp_int.json()[0]["target_user_name"] == test_user_2.name

    forbidden = await authenticated_client.get(f"/api/v1/swipes/user/{test_user_2.id}/interests")
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_swipe_update_triggers_mutual_match_and_undo_removes_it(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
):
    """Updating a left swipe to right creates a mutual match; undo removes both."""
    db_session.add(test_user_2)
    db_session.add(Swipe(user_id=test_user_2.id, target_user_id=test_user.id, direction=SwipeDirection.RIGHT))
    await db_session.commit()

    # Swipe left first -> no match
    r1 = await authenticated_client.post(
        "/api/v1/swipes/",
        json={"target_user_id": str(test_user_2.id), "direction": "left"},
    )
    assert r1.status_code == 201
    assert r1.json()["is_match"] is False

    # Change swipe to right -> mutual match created!
    r2 = await authenticated_client.post(
        "/api/v1/swipes/",
        json={"target_user_id": str(test_user_2.id), "direction": "right"},
    )
    assert r2.status_code == 201
    assert r2.json()["is_match"] is True

    # Re-swiping right shouldn't duplicate mutual match rows
    r3 = await authenticated_client.post(
        "/api/v1/swipes/",
        json={"target_user_id": str(test_user_2.id), "direction": "right"},
    )
    assert r3.status_code == 201
    matches_res = await db_session.execute(
        select(Match).where(Match.user_a_id == test_user.id, Match.user_b_id == test_user_2.id)
    )
    assert len(matches_res.scalars().all()) == 1

    # Undo removes swipe and mutual match
    undo = await authenticated_client.delete(f"/api/v1/swipes/{test_user_2.id}")
    assert undo.status_code == 204
    matches_after = await db_session.execute(select(Match).where(Match.match_type == "mutual"))
    assert len(matches_after.scalars().all()) == 0


@pytest.mark.asyncio
async def test_match_cache_expiry_preserves_mutual_matches(
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
):
    """Expired algorithmic match cache must NOT delete mutual swipe matches."""
    db_session.add_all([test_user, test_user_2])
    await db_session.flush()

    old_time = datetime.now(timezone.utc) - timedelta(hours=3)
    mutual = Match(
        user_a_id=test_user.id,
        user_b_id=test_user_2.id,
        score=100.0,
        reasons=["Mutual Swipe!"],
        match_type="mutual",
        created_at=old_time,
    )
    stale_algo = Match(
        user_a_id=test_user.id,
        user_b_id=test_user_2.id,
        score=6.0,
        reasons=["Stale algo"],
        match_type="mentor",
        created_at=old_time,
    )
    db_session.add_all([mutual, stale_algo])
    await db_session.commit()

    matches = await MatchingService.get_matches(db_session, test_user.id)
    assert any(m.match_type == "mutual" and m.user_b_id == test_user_2.id for m in matches)


@pytest.mark.asyncio
async def test_onboard_and_skills_create_reject_unauthenticated(
    unauthenticated_client: AsyncClient,
):
    """Unauthenticated onboard & skill creation must be rejected with 401."""
    unauth_onboard = await unauthenticated_client.post(
        "/api/v1/users/onboard",
        json={
            "name": "Hijacker",
            "email": "someone@freshminds.nl",
            "unit": "Software",
            "current_skills": [],
            "growth_skills": [],
        },
    )
    assert unauth_onboard.status_code == 401

    unauth_skill = await unauthenticated_client.post(
        "/api/v1/skills/",
        json={"name": "Rogue Skill", "category": "Data"},
    )
    assert unauth_skill.status_code == 401


@pytest.mark.asyncio
async def test_onboard_updates_only_self_and_skills_create_requires_admin(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
    test_skill: Skill,
):
    """Non-admin skill creation returns 403; onboard only updates current_user."""
    db_session.add_all([test_user_2, test_skill])
    await db_session.commit()

    non_admin_skill = await authenticated_client.post(
        "/api/v1/skills/",
        json={"name": "Rogue Skill", "category": "Data"},
    )
    assert non_admin_skill.status_code == 403

    # Authenticated onboard updates ONLY current_user even if another email is passed
    resp = await authenticated_client.post(
        "/api/v1/users/onboard",
        json={
            "name": "Updated Self",
            "email": test_user_2.email,
            "unit": "Cloud",
            "current_skills": [str(test_skill.id)],
            "growth_skills": [],
        },
    )
    assert resp.status_code == 201
    assert resp.json()["id"] == str(test_user.id)
    assert resp.json()["email"] == test_user.email


@pytest.mark.asyncio
async def test_privacy_show_email_and_is_searchable(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    """show_email=False masks email in candidates, user detail, and coffee dates; non-searchable returns 404."""
    private_user = User(
        id=uuid4(),
        entra_oid="oid-private",
        name="Private Colleague",
        email="private@freshminds.nl",
        unit=UnitType.SECURITY,
        seniority="Principal",
        availability="Monthly",
        is_searchable=True,
        show_email=False,
    )
    hidden_user = User(
        id=uuid4(),
        entra_oid="oid-hidden",
        name="Hidden Colleague",
        email="hidden@freshminds.nl",
        unit=UnitType.CLOUD,
        is_searchable=False,
        show_email=False,
    )
    db_session.add_all([private_user, hidden_user])
    await db_session.flush()
    db_session.add(
        CoffeeDate(
            requester_id=private_user.id,
            recipient_id=test_user.id,
            status=CoffeeDateStatus.REQUESTED,
            location="Teams",
            message="Hi!",
        )
    )
    await db_session.commit()

    # User profile returns seniority & availability, masks email
    detail = await authenticated_client.get(f"/api/v1/users/{private_user.id}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["email"] is None
    assert body["seniority"] == "Principal"
    assert body["availability"] == "Monthly"

    # Hidden user returns 404
    hidden_resp = await authenticated_client.get(f"/api/v1/users/{hidden_user.id}")
    assert hidden_resp.status_code == 404

    # Candidates mask email
    cands = await authenticated_client.get("/api/v1/users/candidates")
    assert cands.status_code == 200
    private_cand = next(c for c in cands.json() if c["id"] == str(private_user.id))
    assert private_cand["email"] is None

    # Coffee dates mask requester_email when requester has show_email=False
    dates = await authenticated_client.get("/api/v1/coffee-dates/")
    assert dates.status_code == 200
    assert dates.json()[0]["requester_email"] == ""


@pytest.mark.asyncio
async def test_skills_for_user_no_attribute_error(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_skill: Skill,
):
    """GET /skills/for-user/{user_id} returns unselected skills without Swipe.skill_id AttributeError."""
    other_skill = Skill(name="Kubernetes", category="Cloud", is_active=True)
    db_session.add_all([test_skill, other_skill])
    await db_session.flush()
    db_session.add(UserSkill(user_id=test_user.id, skill_id=test_skill.id, skill_type=SkillType.CURRENT))
    await db_session.commit()

    resp = await authenticated_client.get(f"/api/v1/skills/for-user/{test_user.id}")
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert "Kubernetes" in names
    assert test_skill.name not in names
