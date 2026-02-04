"""FastAPI main application entry point."""
from contextlib import asynccontextmanager
import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, OperationalError

from app.config import get_settings
from app.database import init_db
from app.api import users_router, skills_router, swipes_router, analytics_router, matches_router, coffee_dates_router, feedback_router
from app.utils.db_errors import is_transient_db_error
from seed_data import seed_database

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup: Initialize database
    await init_db()
    if os.getenv("SEED_ON_STARTUP", "false").strip().lower() in {"1", "true", "yes", "y"}:
        try:
            await seed_database()
        except Exception as exc:
            print(f"Seed data failed: {exc}")
    yield
    # Shutdown: Clean up resources if needed


app = FastAPI(
    title="FreshSwipe API",
    description="API for the FreshSwipe professional skills matching application",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users_router, prefix=settings.api_prefix)
app.include_router(skills_router, prefix=settings.api_prefix)
app.include_router(swipes_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(matches_router, prefix=settings.api_prefix)
app.include_router(coffee_dates_router, prefix=settings.api_prefix)
app.include_router(feedback_router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "FreshSwipe API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.exception_handler(DBAPIError)
@app.exception_handler(OperationalError)
async def handle_db_errors(request: Request, exc: Exception):
    """Return a temporary-unavailable response for transient DB wake-up failures."""
    if is_transient_db_error(exc):
        logger.warning("Transient DB error on %s: %s", request.url.path, exc)
        return JSONResponse(
            status_code=503,
            content={"detail": "Database is temporarily unavailable and waking up. Please retry in 30-60 seconds."},
        )
    logger.exception("Unhandled DB error on %s", request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Database request failed"})
