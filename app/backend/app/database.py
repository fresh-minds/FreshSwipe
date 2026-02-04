"""Database connection and session management."""
import asyncio
import os
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import DBAPIError, OperationalError

from app.config import get_settings

settings = get_settings()


def _detect_db_engine(database_url: str) -> str:
    env_engine = os.getenv("DB_ENGINE", "").strip().lower()
    if env_engine:
        return env_engine
    try:
        url = make_url(database_url)
        return url.drivername.split("+")[0].lower()
    except Exception:
        return ""


# Create async engine with optional SSL / driver-specific args
connect_args: dict = {}
db_engine = _detect_db_engine(settings.database_url)
ssl_mode = os.getenv("DB_SSL", "").strip().lower()

if db_engine in {"postgres", "postgresql"}:
    if ssl_mode in {"1", "true", "require", "required"}:
        connect_args["ssl"] = ssl.create_default_context()
elif db_engine in {"mssql", "sqlserver", "azure-sql"}:
    odbc_timeout = os.getenv("DB_ODBC_TIMEOUT", "").strip()
    if odbc_timeout:
        try:
            connect_args["timeout"] = int(odbc_timeout)
        except ValueError:
            pass

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args=connect_args,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database tables."""
    last_exc: Exception | None = None
    # Azure SQL can take time to wake from auto-pause; retry startup DB init.
    for attempt in range(1, 9):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            return
        except (OperationalError, DBAPIError) as exc:
            last_exc = exc
            if attempt == 8:
                break
            await asyncio.sleep(min(2 ** attempt, 30))

    if last_exc:
        raise last_exc
