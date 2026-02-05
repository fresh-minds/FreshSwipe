
import asyncio
import os
import sys
from uuid import UUID

# Add backend path
sys.path.append(os.path.join(os.getcwd(), 'app/backend'))

from app.database import AsyncSessionLocal
from app.services.matching import MatchingService
from app.models.user import User
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        print("Testing MatchingService...")
        # Get a user
        result = await db.execute(select(User))
        user = result.scalars().first()
        if not user:
            print("No users found.")
            return

        print(f"Computing matches for user: {user.id} ({user.name})")
        try:
            matches = await MatchingService.get_matches(db, user.id)
            print(f"Found {len(matches)} matches.")
            for m in matches:
                print(f" - {m.user_b_id}: {m.score} ({m.match_type})")
        except Exception as e:
            print("CRASHED:")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
