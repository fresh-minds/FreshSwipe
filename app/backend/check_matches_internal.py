
import asyncio
import sys
import os

# Inside container, we are at /app. 'app' is a module here.
from app.database import Base
from app.models.user import User
from app.services.matching import MatchingService
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.config import get_settings

async def check_matches():
    settings = get_settings()
    # settings.database_url uses 'db' host which is correct inside container
    print(f"Connecting to {settings.database_url}")
    try:
        engine = create_async_engine(settings.database_url)
        session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with session_maker() as session:
            result = await session.execute(select(User))
            users = result.scalars().all()
            print(f"Found {len(users)} users.")
            
            users_with_zero_matches = []
            
            for user in users:
                matches = await MatchingService.get_matches(session, user.id)
                count = len(matches) if matches else 0
                print(f"User {user.name}: {count} matches")
                if count == 0:
                    users_with_zero_matches.append(user.name)
            
            if users_with_zero_matches:
                print(f"\nFAIL: The following users have 0 matches: {', '.join(users_with_zero_matches)}")
                sys.exit(1)
            else:
                print("\nSUCCESS: All users have at least one match.")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(check_matches())
