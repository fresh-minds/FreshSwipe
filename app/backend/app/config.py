"""Application configuration settings."""
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings
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
    entra_client_id: str = Field(
        "",
        validation_alias=AliasChoices("ENTRA_CLIENT_ID", "AZURE_AD_CLIENT_ID"),
    )
    entra_tenant_id: str = Field(
        "common",
        validation_alias=AliasChoices("ENTRA_TENANT_ID", "AZURE_AD_TENANT_ID"),
    )
    entra_authority: str = "https://login.microsoftonline.com"
    
    # Admin
    admin_entra_ids: list[str] = []
    admin_emails: list[str] = []
    admin_email: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
