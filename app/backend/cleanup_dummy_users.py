import asyncio
import os
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import delete, select
from sqlalchemy.engine.url import make_url
from app.config import get_settings
from app.models.user import User
from app.models.user import UserSkill
from app.models.swipe import Swipe
from app.models.match import Match
from app.models.coffee_date import CoffeeDate
from app.models.feedback import Feedback

# Hardcoded list from seed_data.py to avoid import issues and be explicit
EMAILS_TO_DELETE = [
    "sarah.vanderberg@freshminds.nl",
    "tom.bakker@freshminds.nl",
    "elena.visser@freshminds.nl",
    "marcus.degroot@freshminds.nl",
    "lisa.jansen@freshminds.nl",
    "niels.hofman@freshminds.nl",
    "anna.mulder@freshminds.nl",
    "bram.devries@freshminds.nl",
    "admin@freshminds.nl",  # This is the seeded admin, not the user's admin
    "community@freshminds.nl"
]

async def cleanup_dummy_users():
    """Delete dummy users from the database."""
    settings = get_settings()

    connect_args = {}
    db_engine = os.getenv("DB_ENGINE", "").strip().lower()
    if not db_engine:
        try:
            db_engine = make_url(settings.database_url).drivername.split("+")[0].lower()
        except Exception:
            db_engine = ""

    ssl_mode = os.getenv("DB_SSL", "").strip().lower()
    # asyncpg expects ssl in connect args; mssql+aioodbc carries TLS config in URL query.
    if db_engine in {"postgres", "postgresql"} and ssl_mode in {"1", "true", "require", "required"}:
        connect_args["ssl"] = ssl.create_default_context()

    print(f"Connecting to DB at {settings.database_url.split('@')[-1]}...") # Print only host for safety
    
    engine = create_async_engine(settings.database_url, echo=False, connect_args=connect_args)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_maker() as session:
        print(f"Attempting to delete {len(EMAILS_TO_DELETE)} dummy users...")

        # Resolve target user IDs first.
        target_ids = list(
            (
                await session.execute(
                    select(User.id).where(User.email.in_(EMAILS_TO_DELETE))
                )
            )
            .scalars()
            .all()
        )

        if not target_ids:
            print("No dummy users found to delete.")
            await session.close()
            await engine.dispose()
            return

        deleted = {}
        # Delete dependent rows first for SQL Server (NO ACTION FKs).
        deleted["swipes"] = (
            await session.execute(
                delete(Swipe).where(
                    (Swipe.user_id.in_(target_ids)) | (Swipe.target_user_id.in_(target_ids))
                )
            )
        ).rowcount or 0

        deleted["user_skills"] = (
            await session.execute(delete(UserSkill).where(UserSkill.user_id.in_(target_ids)))
        ).rowcount or 0

        deleted["feedback"] = (
            await session.execute(delete(Feedback).where(Feedback.user_id.in_(target_ids)))
        ).rowcount or 0

        deleted["coffee_dates"] = (
            await session.execute(
                delete(CoffeeDate).where(
                    (CoffeeDate.requester_id.in_(target_ids))
                    | (CoffeeDate.recipient_id.in_(target_ids))
                )
            )
        ).rowcount or 0

        deleted["matches"] = (
            await session.execute(
                delete(Match).where(
                    (Match.user_a_id.in_(target_ids)) | (Match.user_b_id.in_(target_ids))
                )
            )
        ).rowcount or 0

        result = await session.execute(delete(User).where(User.id.in_(target_ids)))
        await session.commit()
        print("Success!")
        print(f"Deleted users: {result.rowcount or 0}")
        print(
            "Deleted related rows: "
            + ", ".join(f"{table}={count}" for table, count in deleted.items())
        )

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(cleanup_dummy_users())
