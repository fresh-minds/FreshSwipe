#!/usr/bin/env python3
"""
Manage mock/demo users in the FreshSwipe database.

This script provides options to:
- Add all demo users (seed data)
- Remove all demo users
- List current demo users
"""
import sys
import argparse
import requests
import os
from typing import Optional

# Configuration
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8081/api/v1")
DB_API_BASE = os.getenv("DB_API_BASE_URL", "http://localhost:8081")
UNIFIED_CONTAINER_NAME = os.getenv("UNIFIED_CONTAINER_NAME", "local-unified-test")
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Demo users matching seed_data.py
DEMO_USERS = [
    {"name": "Sarah van der Berg", "email": "sarah.vanderberg@freshminds.nl", "entra_oid": "oid-sarah-vdb"},
    {"name": "Tom Bakker", "email": "tom.bakker@freshminds.nl", "entra_oid": "oid-tom-b"},
    {"name": "Elena Visser", "email": "elena.visser@freshminds.nl", "entra_oid": "oid-elena-v"},
    {"name": "Marcus de Groot", "email": "marcus.degroot@freshminds.nl", "entra_oid": "oid-marcus-dg"},
    {"name": "Lisa Jansen", "email": "lisa.jansen@freshminds.nl", "entra_oid": "oid-lisa-j"},
    {"name": "Niels Hofman", "email": "niels.hofman@freshminds.nl", "entra_oid": "oid-niels-h"},
    {"name": "Anna Mulder", "email": "anna.mulder@freshminds.nl", "entra_oid": "oid-anna-m"},
    {"name": "Bram de Vries", "email": "bram.devries@freshminds.nl", "entra_oid": "oid-bram-dv"},
    {"name": "Admin User", "email": "admin@freshminds.nl", "entra_oid": "oid-admin"},
    {"name": "FreshMinds Community", "email": "community@freshminds.nl", "entra_oid": "oid-community"},
]


def print_header(title: str) -> None:
    """Print a formatted header."""
    print("\n" + "=" * 60)
    print(f" {title}")
    print("=" * 60)


def check_backend() -> bool:
    """Check if the backend is running."""
    try:
        response = requests.get(f"{DB_API_BASE}/health", timeout=5)
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        return False


def list_demo_users() -> None:
    """List demo users currently in the database."""
    print_header("Demo Users in Database")
    
    import subprocess
    
    # Query the database directly via Docker
    check_script = '''
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.config import get_settings
from app.models.user import User

DEMO_EMAILS = [
    "sarah.vanderberg@freshminds.nl",
    "tom.bakker@freshminds.nl",
    "elena.visser@freshminds.nl",
    "marcus.degroot@freshminds.nl",
    "lisa.jansen@freshminds.nl",
    "niels.hofman@freshminds.nl",
    "anna.mulder@freshminds.nl",
    "bram.devries@freshminds.nl",
    "admin@freshminds.nl",
    "community@freshminds.nl",
]

async def check_users():
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with session_maker() as session:
        result = await session.execute(select(User).where(User.email.in_(DEMO_EMAILS)))
        users = result.scalars().all()
        
        found_emails = {u.email for u in users}
        
        print(f"FOUND:{len(users)}")
        for user in users:
            print(f"USER:{user.name}|{user.email}")
        
        for email in DEMO_EMAILS:
            if email not in found_emails:
                print(f"MISSING:{email}")

asyncio.run(check_users())
'''
    
    try:
        result = subprocess.run(
            ["docker", "exec", "-i", UNIFIED_CONTAINER_NAME, "python", "-c", check_script],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print("❌ Failed to query database.")
            if result.stderr:
                print(f"   Error: {result.stderr.strip()}")
            return
        
        # Parse output
        found_users = []
        missing_emails = []
        
        for line in result.stdout.strip().split("\n"):
            if line.startswith("USER:"):
                parts = line[5:].split("|")
                found_users.append({"name": parts[0], "email": parts[1]})
            elif line.startswith("MISSING:"):
                email = line[8:]
                name = next((u["name"] for u in DEMO_USERS if u["email"] == email), email)
                missing_emails.append({"name": name, "email": email})
        
        if found_users:
            print(f"\n✅ Found {len(found_users)} demo users:")
            for user in found_users:
                print(f"   • {user['name']} ({user['email']})")
        else:
            print("\n❌ No demo users found in database.")
        
        if missing_emails:
            print(f"\n⚪ {len(missing_emails)} demo users not in database:")
            for user in missing_emails:
                print(f"   • {user['name']} ({user['email']})")
                
    except subprocess.TimeoutExpired:
        print("❌ Timeout while querying database.")
    except FileNotFoundError:
        print("❌ docker command not found. Is Docker installed?")
    except Exception as e:
        print(f"❌ Error: {e}")


def add_demo_users() -> bool:
    """Add demo users by directly inserting them into the database."""
    print_header("Adding Demo Users")
    
    print("Adding demo users to database...\n")
    
    import subprocess
    
    # Python script to add demo users directly
    add_script = '''
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.config import get_settings
from app.models.user import User, UserSkill, UnitType, SkillType
from app.models.skill import Skill
from app.models.swipe import Swipe, SwipeDirection

FRESHMINDS_COLLEAGUES = [
    {
        "name": "Sarah van der Berg",
        "email": "sarah.vanderberg@freshminds.nl",
        "unit": UnitType.DATA,
        "seniority": "Senior",
        "availability": "1h/week",
        "entra_oid": "oid-sarah-vdb",
        "current_skills": ["Machine Learning", "Analytics", "Data Engineering"],
        "growth_skills": ["Generative AI", "MLOps"],
    },
    {
        "name": "Tom Bakker",
        "email": "tom.bakker@freshminds.nl",
        "unit": UnitType.SOFTWARE,
        "seniority": "Medior",
        "availability": "Ad-hoc",
        "entra_oid": "oid-tom-b",
        "current_skills": ["Backend Development", "DevOps", "Kubernetes"],
        "growth_skills": ["Data Engineering", "Machine Learning"],
    },
    {
        "name": "Elena Visser",
        "email": "elena.visser@freshminds.nl",
        "unit": UnitType.CLOUD,
        "seniority": "Principal",
        "availability": "Monthly",
        "entra_oid": "oid-elena-v",
        "current_skills": ["Azure", "AWS", "Kubernetes"],
        "growth_skills": ["Machine Learning", "Cybersecurity"],
    },
    {
        "name": "Marcus de Groot",
        "email": "marcus.degroot@freshminds.nl",
        "unit": UnitType.DATA,
        "seniority": "Senior",
        "availability": "2h/week",
        "entra_oid": "oid-marcus-dg",
        "current_skills": ["Data Engineering", "Analytics", "Business Intelligence"],
        "growth_skills": ["Frontend Development", "Mobile Development"],
    },
    {
        "name": "Lisa Jansen",
        "email": "lisa.jansen@freshminds.nl",
        "unit": UnitType.SECURITY,
        "seniority": "Senior",
        "availability": "1h/week",
        "entra_oid": "oid-lisa-j",
        "current_skills": ["Cybersecurity", "DevSecOps", "IAM"],
        "growth_skills": ["Generative AI", "AWS"],
    },
    {
        "name": "Niels Hofman",
        "email": "niels.hofman@freshminds.nl",
        "unit": UnitType.SOFTWARE,
        "seniority": "Medior",
        "availability": "Weekly",
        "entra_oid": "oid-niels-h",
        "current_skills": ["Frontend Development", "Mobile Development"],
        "growth_skills": ["Backend Development", "DevOps"],
    },
    {
        "name": "Anna Mulder",
        "email": "anna.mulder@freshminds.nl",
        "unit": UnitType.DATA,
        "seniority": "Junior",
        "availability": "2h/week",
        "entra_oid": "oid-anna-m",
        "current_skills": ["Analytics", "Business Intelligence"],
        "growth_skills": ["Machine Learning", "Data Engineering", "Generative AI"],
    },
    {
        "name": "Bram de Vries",
        "email": "bram.devries@freshminds.nl",
        "unit": UnitType.CLOUD,
        "seniority": "Senior",
        "availability": "Ad-hoc",
        "entra_oid": "oid-bram-dv",
        "current_skills": ["GCP", "Kubernetes", "DevOps"],
        "growth_skills": ["MLOps", "Generative AI"],
    },
    {
        "name": "Admin User",
        "email": "admin@freshminds.nl",
        "unit": UnitType.SOFTWARE,
        "seniority": "Principal",
        "availability": "Always",
        "entra_oid": "oid-admin",
        "current_skills": ["Backend Development", "Frontend Development", "DevOps", "Cybersecurity"],
        "growth_skills": ["Generative AI"],
    },
]

COMMUNITY_USER = {
    "name": "FreshMinds Community",
    "email": "community@freshminds.nl",
    "unit": UnitType.OTHER,
    "seniority": "Guide",
    "availability": "Always",
    "entra_oid": "oid-community",
}

async def add_users():
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with session_maker() as session:
        # Get all skills for mapping
        result = await session.execute(select(Skill))
        skills = result.scalars().all()
        skill_map = {skill.name: skill for skill in skills}
        
        if not skills:
            print("ERROR: No skills in database. Run seed_data.py first.")
            return
        
        added_count = 0
        skipped_count = 0
        
        for colleague_data in FRESHMINDS_COLLEAGUES:
            # Check if user already exists
            result = await session.execute(
                select(User).where(User.email == colleague_data["email"])
            )
            if result.scalar_one_or_none():
                skipped_count += 1
                continue
            
            # Create user
            user = User(
                name=colleague_data["name"],
                email=colleague_data["email"],
                unit=colleague_data["unit"],
                seniority=colleague_data["seniority"],
                availability=colleague_data["availability"],
                entra_oid=colleague_data["entra_oid"],
            )
            session.add(user)
            await session.flush()
            
            # Add current skills
            for skill_name in colleague_data.get("current_skills", []):
                if skill_name in skill_map:
                    skill = skill_map[skill_name]
                    user_skill = UserSkill(
                        user_id=user.id,
                        skill_id=skill.id,
                        skill_type=SkillType.CURRENT,
                    )
                    session.add(user_skill)
                    
                    # Super like current skills
                    swipe = Swipe(
                        user_id=user.id,
                        skill_id=skill.id,
                        direction=SwipeDirection.SUPER,
                        created_at=datetime.utcnow() - timedelta(days=random.randint(0, 30)),
                    )
                    session.add(swipe)
            
            # Add growth skills
            for skill_name in colleague_data.get("growth_skills", []):
                if skill_name in skill_map:
                    skill = skill_map[skill_name]
                    user_skill = UserSkill(
                        user_id=user.id,
                        skill_id=skill.id,
                        skill_type=SkillType.GROWTH,
                    )
                    session.add(user_skill)
                    
                    # Right swipe growth skills
                    swipe = Swipe(
                        user_id=user.id,
                        skill_id=skill.id,
                        direction=SwipeDirection.RIGHT,
                        created_at=datetime.utcnow() - timedelta(days=random.randint(0, 30)),
                    )
                    session.add(swipe)
            
            added_count += 1
        
        # Add community user
        result = await session.execute(
            select(User).where(User.email == COMMUNITY_USER["email"])
        )
        if not result.scalar_one_or_none():
            community_user = User(
                name=COMMUNITY_USER["name"],
                email=COMMUNITY_USER["email"],
                unit=COMMUNITY_USER["unit"],
                seniority=COMMUNITY_USER["seniority"],
                availability=COMMUNITY_USER["availability"],
                entra_oid=COMMUNITY_USER["entra_oid"],
            )
            session.add(community_user)
            await session.flush()
            
            # Community user swipes right on everything
            for skill in skills:
                user_skill = UserSkill(
                    user_id=community_user.id,
                    skill_id=skill.id,
                    skill_type=SkillType.CURRENT,
                )
                session.add(user_skill)
                
                swipe = Swipe(
                    user_id=community_user.id,
                    skill_id=skill.id,
                    direction=SwipeDirection.RIGHT,
                    created_at=datetime.utcnow() - timedelta(days=1),
                )
                session.add(swipe)
            
            added_count += 1
        else:
            skipped_count += 1
        
        await session.commit()
        print(f"Added {added_count} demo users. Skipped {skipped_count} (already exist).")

asyncio.run(add_users())
'''
    
    try:
        result = subprocess.run(
            ["docker", "exec", "-i", UNIFIED_CONTAINER_NAME, "python", "-c", add_script],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            print("✅ Demo users added successfully!")
            if result.stdout:
                print(f"   {result.stdout.strip()}")
            return True
        else:
            print(f"❌ Failed to add demo users.")
            if result.stderr:
                print(f"   Error: {result.stderr.strip()}")
            return False
    except subprocess.TimeoutExpired:
        print("❌ Timeout while adding users.")
        return False
    except FileNotFoundError:
        print("❌ docker command not found. Is Docker installed?")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def remove_demo_users() -> bool:
    """Remove demo users from the database."""
    print_header("Removing Demo Users")
    
    print("Removing demo users from database...\n")
    
    import subprocess
    
    # Python script to delete demo users
    delete_script = '''
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, delete
from app.config import get_settings
from app.models.user import User, UserSkill
from app.models.swipe import Swipe
from app.models.coffee_date import CoffeeDate
from app.models.match import Match

DEMO_EMAILS = [
    "sarah.vanderberg@freshminds.nl",
    "tom.bakker@freshminds.nl",
    "elena.visser@freshminds.nl",
    "marcus.degroot@freshminds.nl",
    "lisa.jansen@freshminds.nl",
    "niels.hofman@freshminds.nl",
    "anna.mulder@freshminds.nl",
    "bram.devries@freshminds.nl",
    "admin@freshminds.nl",
    "community@freshminds.nl",
]

async def remove_users():
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with session_maker() as session:
        result = await session.execute(select(User).where(User.email.in_(DEMO_EMAILS)))
        users = result.scalars().all()
        
        if not users:
            print("No demo users found to remove.")
            return
        
        user_ids = [user.id for user in users]
        
        # Delete related data first (foreign key constraints)
        await session.execute(delete(CoffeeDate).where(
            (CoffeeDate.requester_id.in_(user_ids)) | (CoffeeDate.recipient_id.in_(user_ids))
        ))
        await session.execute(delete(Match).where(
            (Match.user_a_id.in_(user_ids)) | (Match.user_b_id.in_(user_ids))
        ))
        await session.execute(delete(Swipe).where(Swipe.user_id.in_(user_ids)))
        await session.execute(delete(UserSkill).where(UserSkill.user_id.in_(user_ids)))
        await session.execute(delete(User).where(User.id.in_(user_ids)))
        
        await session.commit()
        print(f"Removed {len(users)} demo users and their related data.")

asyncio.run(remove_users())
'''
    
    try:
        result = subprocess.run(
            ["docker", "exec", "-i", UNIFIED_CONTAINER_NAME, "python", "-c", delete_script],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("✅ Demo users removed successfully!")
            if result.stdout:
                print(f"   {result.stdout.strip()}")
            return True
        else:
            print(f"❌ Failed to remove demo users.")
            if result.stderr:
                print(f"   Error: {result.stderr.strip()}")
            return False
    except subprocess.TimeoutExpired:
        print("❌ Timeout while removing users.")
        return False
    except FileNotFoundError:
        print("❌ docker command not found. Is Docker installed?")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Manage mock/demo users in FreshSwipe database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/db/manage_users.py list     # List demo users in database
  python scripts/db/manage_users.py add      # Add demo users (seed data)
  python scripts/db/manage_users.py remove   # Remove all demo users
        """
    )
    
    parser.add_argument(
        "action",
        choices=["list", "add", "remove"],
        help="Action to perform"
    )
    
    parser.add_argument(
        "-y", "--yes",
        action="store_true",
        help="Skip confirmation prompts"
    )
    
    args = parser.parse_args()
    
    print_header("FreshSwipe User Management")
    
    # Check if backend is running
    if not check_backend():
        print("❌ Backend is not running.")
        print("   Start it with: ./container/verify_local.sh")
        sys.exit(1)
    
    print("✅ Backend is running.\n")
    
    if args.action == "list":
        list_demo_users()
        
    elif args.action == "add":
        if not args.yes:
            response = input("Add demo users to database? (y/n) [n]: ").strip().lower()
            if response not in ["y", "yes"]:
                print("Cancelled.")
                sys.exit(0)
        success = add_demo_users()
        sys.exit(0 if success else 1)
        
    elif args.action == "remove":
        if not args.yes:
            print("⚠️  WARNING: This will remove all demo users and their swipes/matches!")
            response = input("Are you sure? (y/n) [n]: ").strip().lower()
            if response not in ["y", "yes"]:
                print("Cancelled.")
                sys.exit(0)
        success = remove_demo_users()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
