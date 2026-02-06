
import asyncio
import os
import sys
import logging
from sqlalchemy import select, and_, or_, delete
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../app/backend'))

from app.models.swipe import Swipe, SwipeDirection
from app.models.match import Match
from app.models.user import User

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def backfill_mutual_matches():
    # Get DB URL
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL not set")
        return

    # Handle Azure SQL / async driver adjustments
    if "dbsql" in database_url or "database.windows.net" in database_url:
        # Ensure driver is aioodbc or similar if needed, but usually we use the standard env var
        # If the env var is 'driver={ODBC Driver 18...}', we might need checking.
        pass
    
    # Fix for sqlalchemy async if needed (e.g. postgresql:// -> postgresql+asyncpg://)
    # But assuming the app setup uses correct drivers.
    
    logger.info(f"Connecting to DB...")
    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as db:
        logger.info("Finding mutual swipes...")

        # Find pairs of users who both swiped right/super on each other
        # We search for Swipe A->B where there exists Swipe B->A
        
        # Get all positive swipes
        stmt = select(Swipe).where(
            Swipe.direction.in_([SwipeDirection.RIGHT, SwipeDirection.SUPER])
        )
        result = await db.execute(stmt)
        swipes = result.scalars().all()
        
        # In-memory matching for simplicity (or we can do a self-join query)
        # Map: (user_id, target_id) -> Swipe
        swipe_map = {}
        for s in swipes:
            swipe_map[(s.user_id, s.target_user_id)] = s
            
        matches_found = 0
        matches_created = 0
        
        processed_pairs = set()

        for (u_id, t_id), swipe_a in swipe_map.items():
            # Check for reciprocal
            if (t_id, u_id) in swipe_map:
                pair_key = tuple(sorted((str(u_id), str(t_id))))
                if pair_key in processed_pairs:
                    continue
                processed_pairs.add(pair_key)
                
                logger.info(f"Found mutual swipe: {u_id} <-> {t_id}")
                matches_found += 1
                
                # Check if Match exists for A->B
                existing_ab = await db.execute(
                    select(Match).where(
                        Match.user_a_id == u_id,
                        Match.user_b_id == t_id,
                        Match.match_type == 'mutual'
                    )
                )
                if not existing_ab.scalar_one_or_none():
                    # Create A->B
                    match_ab = Match(
                        user_a_id=u_id,
                        user_b_id=t_id,
                        score=100.0,
                        reasons=["Mutual Swipe (Backfilled)"],
                        match_type="mutual"
                    )
                    db.add(match_ab)
                    matches_created += 1
                
                # Check if Match exists for B->A
                existing_ba = await db.execute(
                    select(Match).where(
                        Match.user_a_id == t_id,
                        Match.user_b_id == u_id,
                        Match.match_type == 'mutual'
                    )
                )
                if not existing_ba.scalar_one_or_none():
                    # Create B->A
                    match_ba = Match(
                        user_a_id=t_id,
                        user_b_id=u_id,
                        score=100.0,
                        reasons=["Mutual Swipe (Backfilled)"],
                        match_type="mutual"
                    )
                    db.add(match_ba)
                    matches_created += 1

        await db.commit()
        logger.info(f"Backfill complete. Found {matches_found} pairs. Created {matches_created} new match records.")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(backfill_mutual_matches())
