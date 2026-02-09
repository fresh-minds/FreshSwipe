"""Tests for User model and API."""
import pytest
from uuid import uuid4
from httpx import AsyncClient

from app.models.user import User, UnitType


class TestUserModel:
    """Tests for User model."""
    
    def test_create_user_minimal(self):
        """Test creating a user with minimal fields."""
        user = User(
            entra_oid="test-oid-123",
            name="Test User",
            email="test@freshminds.nl",
        )
        
        assert user.name == "Test User"
        assert user.email == "test@freshminds.nl"
        assert user.name == "Test User"
        assert user.email == "test@freshminds.nl"
        assert user.entra_oid == "test-oid-123"
        # Default value applies at DB level, so it might be None here
        assert user.is_searchable is None or user.is_searchable == True
        assert user.show_email is None or user.show_email == True
    
    def test_create_user_full(self):
        """Test creating a user with all fields."""
        user = User(
            entra_oid="test-oid-456",
            name="Sarah van der Berg",
            email="sarah@freshminds.nl",
            unit=UnitType.DATA,
            seniority="Senior",
            availability="1h/week",
            looking_for=["mentorship", "collaboration"],
            offering=["ML expertise", "career advice"],
            is_searchable=True,
            show_email=False,
        )
        
        assert user.unit == UnitType.DATA
        assert user.seniority == "Senior"
        assert user.availability == "1h/week"
        assert user.looking_for == ["mentorship", "collaboration"]
        assert user.offering == ["ML expertise", "career advice"]
        assert user.show_email == False
    
    def test_unit_types_exist(self):
        """Test all unit types are defined."""
        assert UnitType.DATA is not None
        assert UnitType.SOFTWARE is not None
        assert UnitType.CLOUD is not None
        assert UnitType.SECURITY is not None
        assert UnitType.STAFF is not None


class TestUserAPI:
    """Tests for User API endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_user_by_id(self, authenticated_client: AsyncClient, test_user: User):
        """Test getting a user by ID."""
        response = await authenticated_client.get(f"/api/v1/users/{test_user.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == test_user.name
        assert data["email"] == test_user.email
    
    @pytest.mark.asyncio
    async def test_get_user_not_found(self, authenticated_client: AsyncClient):
        """Test getting a non-existent user."""
        response = await authenticated_client.get(f"/api/v1/users/{uuid4()}")
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_get_current_user(self, authenticated_client: AsyncClient, test_user: User):
        """Test getting current authenticated user."""
        response = await authenticated_client.get("/api/v1/users/me")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_user.id)
        assert data["seniority"] == test_user.seniority
        assert data["availability"] == test_user.availability
