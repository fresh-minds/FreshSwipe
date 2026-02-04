"""Test configuration and fixtures."""
import asyncio
from typing import AsyncGenerator, Generator
from uuid import uuid4
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient, ASGITransport

from app.database import Base, get_db
from app.main import app
from app.models.user import User, UnitType
from app.models.skill import Skill
from app.models.swipe import Swipe, SwipeDirection
from app.models.coffee_date import CoffeeDate, CoffeeDateStatus
from app.models.match import Match
from app.api.deps import get_current_user


# Test database URL - uses SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def engine():
    """Create a test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session


@pytest.fixture
def test_user() -> User:
    """Create a test user object."""
    return User(
        id=uuid4(),
        entra_oid="test-oid-123",
        name="Test User",
        email="test@freshminds.nl",
        unit=UnitType.DATA,
        seniority="Senior",
        availability="1h/week",
        is_searchable=True,
        show_email=True,
    )


@pytest.fixture
def test_user_2() -> User:
    """Create a second test user object."""
    return User(
        id=uuid4(),
        entra_oid="test-oid-456",
        name="Another User",
        email="another@freshminds.nl",
        unit=UnitType.SOFTWARE,
        seniority="Medior",
        availability="2h/week",
        is_searchable=True,
        show_email=True,
    )


@pytest.fixture
def test_skill() -> Skill:
    """Create a test skill object."""
    return Skill(
        id=uuid4(),
        name="Machine Learning",
        category="Data & AI",
        description="ML techniques and applications",
        icon="🤖",
        display_order=1,
        is_active=True,
    )


@pytest_asyncio.fixture
async def authenticated_client(db_session, test_user) -> AsyncGenerator[AsyncClient, None]:
    """Create an authenticated test client."""
    # Add test user to database
    db_session.add(test_user)
    await db_session.commit()
    
    # Override dependencies
    async def override_get_db():
        yield db_session
    
    async def override_get_current_user():
        return test_user
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def unauthenticated_client(db_session) -> AsyncGenerator[AsyncClient, None]:
    """Create an unauthenticated test client."""
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    
    app.dependency_overrides.clear()
