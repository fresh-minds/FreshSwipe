"""Tests for Coffee Dates API endpoints."""
import pytest
from uuid import uuid4
from datetime import datetime, timezone
from httpx import AsyncClient

from app.models.coffee_date import CoffeeDate, CoffeeDateStatus
from app.models.user import User, UnitType
from app.models.skill import Skill
from app.models.user import UserSkill, SkillType
from app.models.swipe import Swipe, SwipeDirection
from app.models.match import Match


class TestCoffeeDatesSuggestionsEndpoint:
    """Tests for GET /coffee-dates/suggestions endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_suggestions_unauthenticated(self, unauthenticated_client: AsyncClient):
        """Test that unauthenticated requests are rejected."""
        response = await unauthenticated_client.get("/api/v1/coffee-dates/suggestions")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_suggestions_authenticated_empty(self, authenticated_client: AsyncClient):
        """Test getting suggestions when no matches exist."""
        response = await authenticated_client.get("/api/v1/coffee-dates/suggestions")
        assert response.status_code == 200
        assert response.json() == []
    
    @pytest.mark.asyncio
    async def test_get_suggestions_with_limit(self, authenticated_client: AsyncClient):
        """Test limit parameter works."""
        response = await authenticated_client.get("/api/v1/coffee-dates/suggestions?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 5


class TestCoffeeDatesRequestEndpoint:
    """Tests for POST /coffee-dates/request endpoint."""
    
    @pytest.mark.asyncio
    async def test_create_request_unauthenticated(self, unauthenticated_client: AsyncClient):
        """Test that unauthenticated requests are rejected."""
        response = await unauthenticated_client.post(
            "/api/v1/coffee-dates/request",
            json={"recipient_id": str(uuid4())}
        )
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_create_request_nonexistent_recipient(
        self, authenticated_client: AsyncClient
    ):
        """Test creating request for non-existent user fails."""
        response = await authenticated_client.post(
            "/api/v1/coffee-dates/request",
            json={"recipient_id": str(uuid4())}
        )
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_create_request_to_self(
        self, authenticated_client: AsyncClient, test_user: User
    ):
        """Test creating request to yourself fails."""
        response = await authenticated_client.post(
            "/api/v1/coffee-dates/request",
            json={"recipient_id": str(test_user.id)}
        )
        assert response.status_code == 400
        assert "yourself" in response.json()["detail"].lower()


class TestCoffeeDatesListEndpoint:
    """Tests for GET /coffee-dates/ endpoint."""
    
    @pytest.mark.asyncio
    async def test_list_coffee_dates_unauthenticated(self, unauthenticated_client: AsyncClient):
        """Test that unauthenticated requests are rejected."""
        response = await unauthenticated_client.get("/api/v1/coffee-dates/")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_list_coffee_dates_empty(self, authenticated_client: AsyncClient):
        """Test listing coffee dates when none exist."""
        response = await authenticated_client.get("/api/v1/coffee-dates/")
        assert response.status_code == 200
        assert response.json() == []
    
    @pytest.mark.asyncio
    async def test_list_coffee_dates_with_status_filter(self, authenticated_client: AsyncClient):
        """Test filtering by status."""
        response = await authenticated_client.get("/api/v1/coffee-dates/?status_filter=requested")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestCoffeeDatesRespondEndpoint:
    """Tests for PATCH /coffee-dates/{id}/respond endpoint."""
    
    @pytest.mark.asyncio
    async def test_respond_unauthenticated(self, unauthenticated_client: AsyncClient):
        """Test that unauthenticated requests are rejected."""
        response = await unauthenticated_client.patch(
            f"/api/v1/coffee-dates/{uuid4()}/respond",
            json={"status": "accepted"}
        )
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_respond_nonexistent(self, authenticated_client: AsyncClient):
        """Test responding to non-existent coffee date fails."""
        response = await authenticated_client.patch(
            f"/api/v1/coffee-dates/{uuid4()}/respond",
            json={"status": "accepted"}
        )
        assert response.status_code == 404


class TestCoffeeDatesCompleteEndpoint:
    """Tests for PATCH /coffee-dates/{id}/complete endpoint."""
    
    @pytest.mark.asyncio
    async def test_complete_unauthenticated(self, unauthenticated_client: AsyncClient):
        """Test that unauthenticated requests are rejected."""
        response = await unauthenticated_client.patch(
            f"/api/v1/coffee-dates/{uuid4()}/complete"
        )
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_complete_nonexistent(self, authenticated_client: AsyncClient):
        """Test completing non-existent coffee date fails."""
        response = await authenticated_client.patch(
            f"/api/v1/coffee-dates/{uuid4()}/complete"
        )
        assert response.status_code == 404


class TestCoffeeDateFullWorkflow:
    """Integration tests for full coffee date workflow."""
    
    @pytest.mark.asyncio
    async def test_full_workflow_summary(self, authenticated_client: AsyncClient):
        """Summary test for the coffee date workflow.
        
        This tests that the endpoints exist and return expected status codes.
        Full workflow testing requires more complex fixture setup.
        """
        # 1. Get suggestions (should work, even if empty)
        response = await authenticated_client.get("/api/v1/coffee-dates/suggestions")
        assert response.status_code == 200
        
        # 2. List coffee dates (should work, even if empty)
        response = await authenticated_client.get("/api/v1/coffee-dates/")
        assert response.status_code == 200
        
        # 3. Try to create request to invalid user (should fail gracefully)
        response = await authenticated_client.post(
            "/api/v1/coffee-dates/request",
            json={"recipient_id": str(uuid4())}
        )
        assert response.status_code == 404  # Not found is expected
