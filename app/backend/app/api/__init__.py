"""API routes package."""
from app.api.users import router as users_router
from app.api.skills import router as skills_router
from app.api.swipes import router as swipes_router
from app.api.analytics import router as analytics_router
from app.api.matches import router as matches_router
from app.api.coffee_dates import router as coffee_dates_router
from app.api.feedback import router as feedback_router

__all__ = [
    "users_router", 
    "skills_router", 
    "swipes_router", 
    "analytics_router", 
    "matches_router",
    "coffee_dates_router",
    "feedback_router",
]
