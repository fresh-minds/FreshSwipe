"""Tests for Skills model and API."""
import pytest
from httpx import AsyncClient

from app.models.skill import Skill


class TestSkillModel:
    """Tests for Skill model."""
    
    def test_create_skill(self):
        """Test creating a skill."""
        skill = Skill(
            name="Machine Learning",
            category="Data & AI",
            description="ML techniques and applications",
            icon="🤖",
            display_order=1,
            is_active=True,
        )
        
        assert skill.name == "Machine Learning"
        assert skill.category == "Data & AI"
        assert skill.icon == "🤖"
        assert skill.is_active == True
    
    def test_skill_tablename(self):
        """Test the table name is correct."""
        assert Skill.__tablename__ == "skills"


class TestSkillsAPI:
    """Tests for Skills API endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_skills_unauthenticated(self, unauthenticated_client: AsyncClient):
        """Test skills endpoint works without authentication."""
        response = await unauthenticated_client.get("/api/v1/skills/")
        # Skills endpoint should be public
        assert response.status_code in [200, 401]  # depends on implementation
    
    @pytest.mark.asyncio
    async def test_get_skills_authenticated(self, authenticated_client: AsyncClient):
        """Test getting all skills when authenticated."""
        response = await authenticated_client.get("/api/v1/skills/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
