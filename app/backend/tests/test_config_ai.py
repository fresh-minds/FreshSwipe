import os
from unittest.mock import patch
from app.config import get_settings, Settings
from app.services.ai_service import AIAgentService

def test_azure_openai_settings_loaded():
    """Test that Azure OpenAI settings are loaded from environment variables."""
    test_key = "test-azure-key-12345"
    test_endpoint = "https://my-azure-endpoint.openai.azure.com"
    with patch.dict(os.environ, {
        "AZURE_OPENAI_API_KEY": test_key,
        "AZURE_OPENAI_ENDPOINT": test_endpoint
    }):
        settings = Settings()
        assert settings.azure_openai_api_key == test_key
        assert settings.azure_openai_endpoint == test_endpoint

def test_ai_service_initializes_with_azure_settings():
    """Test that AIAgentService initializes Azure OpenAI client with the correct settings."""
    test_key = "test-azure-key-67890"
    test_endpoint = "https://my-azure-endpoint.openai.azure.com"
    
    mock_settings = Settings(azure_openai_api_key=test_key, azure_openai_endpoint=test_endpoint)
    
    with patch("app.services.ai_service.settings", mock_settings):
        service = AIAgentService()
        assert service.client is not None
