
import asyncio
import sys
import os

# Ensure app module is found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from seed_data import seed_database

async def reset_db():
    print("Dropping all tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("Tables dropped.")
    
    print("Creating all tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")

async def main():
    await reset_db()
    await seed_database()
    print("Reset and Seeding Complete.")

if __name__ == "__main__":
    asyncio.run(main())
