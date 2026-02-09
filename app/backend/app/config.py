"""Application configuration settings."""
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    database_url: str = "postgresql+asyncpg://freshswipe:freshswipe@freshswipe-db:5432/freshswipe"
    
    # API
    api_prefix: str = "/api/v1"
    debug: bool = False
    
    # CORS
    cors_origins: list[str] = ["http://localhost:8081", "http://localhost:3000"]
    
    # Entra ID
    AZURE_ENTRA_AD_CLIENT_ID: str = Field(
        "",
        validation_alias=AliasChoices("AZURE_ENTRA_AD_CLIENT_ID", "AZURE_ENTRA_AD_CLIENT_ID"),
    )
    AZURE_ENTRA_TENANT_ID: str = Field(
        "common",
        validation_alias=AliasChoices("AZURE_ENTRA_TENANT_ID", "AZURE_AD_TENANT_ID"),
    )
    entra_authority: str = "https://login.microsoftonline.com"
    
    # Admin
    admin_entra_ids: list[str] = []
    admin_emails: list[str] = []
    admin_email: str = ""
    first_superuser_password: str = "FreshMinds2026!"
    
    # AI Configuration (Azure OpenAI)
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = "gpt-4.1-mini"
    azure_openai_api_version: str = "2024-02-15-preview"
    ai_max_tokens: int = 500

    model_config = SettingsConfigDict(
        env_file = ".env",
        case_sensitive = False,
        extra = "ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
