"""Tests for Matches model and API."""
import pytest
from uuid import uuid4
from httpx import AsyncClient

from app.models.match import Match


class TestMatchModel:
    """Tests for Match model."""
    
    def test_create_match(self):
        """Test creating a match."""
        user_a_id = uuid4()
        user_b_id = uuid4()
        
        match = Match(
            user_a_id=user_a_id,
            user_b_id=user_b_id,
            score=15.5,
            reasons=["Shared interest in ML", "Both in Data unit"],
            match_type="peer",
        )
        
        assert match.user_a_id == user_a_id
        assert match.user_b_id == user_b_id
        assert match.score == 15.5
        assert len(match.reasons) == 2
        assert match.match_type == "peer"
    
    def test_match_tablename(self):
        """Test the table name is correct."""
        assert Match.__tablename__ == "matches"


class TestMatchesAPI:
    """Tests for Matches API endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_matches_unauthenticated(self, unauthenticated_client: AsyncClient):
        """Test matches endpoint rejects unauthenticated requests."""
        response = await unauthenticated_client.get("/api/v1/matches/")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_matches_authenticated(self, authenticated_client: AsyncClient):
        """Test getting matches when authenticated."""
        response = await authenticated_client.get("/api/v1/matches/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.asyncio
    async def test_get_matches_stats(self, authenticated_client: AsyncClient):
        """Test getting match statistics."""
        response = await authenticated_client.get("/api/v1/matches/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_matches_generated" in data
        assert "top_skills" in data
        assert "total_active_users" in data
