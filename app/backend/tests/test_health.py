"""Health and root endpoint tests."""
import pytest


@pytest.mark.asyncio
async def test_health_endpoint(unauthenticated_client):
    response = await unauthenticated_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


@pytest.mark.asyncio
async def test_root_endpoint(unauthenticated_client):
    response = await unauthenticated_client.get("/")
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("name") == "FreshSwipe API"
    assert payload.get("version") == "1.0.0"
