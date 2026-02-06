"""Seed data for the FreshSwipe application."""
import asyncio
import os
import ssl
import uuid
from datetime import datetime, timedelta
import random

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from app.config import get_settings
from app.database import Base
from app.models.user import User, UserSkill, UnitType, SkillType
from app.models.skill import Skill
from app.models.swipe import Swipe, SwipeDirection

settings = get_settings()

# Skills data
SKILLS_DATA = [
    # Cloud
    {"name": "AWS", "category": "Cloud", "description": "Amazon Web Services - cloud computing platform", "icon": "☁️", "display_order": 1},
    {"name": "Azure", "category": "Cloud", "description": "Microsoft Azure cloud platform", "icon": "☁️", "display_order": 2},
    {"name": "GCP", "category": "Cloud", "description": "Google Cloud Platform", "icon": "☁️", "display_order": 3},
    {"name": "Kubernetes", "category": "Cloud", "description": "Container orchestration platform", "icon": "🚀", "display_order": 4},
    
    # Data
    {"name": "Data Engineering", "category": "Data", "description": "Building and maintaining data pipelines", "icon": "🔧", "display_order": 5},
    {"name": "Machine Learning", "category": "Data", "description": "Developing ML models and systems", "icon": "🤖", "display_order": 6},
    {"name": "Analytics", "category": "Data", "description": "Data analysis and insights", "icon": "📊", "display_order": 7},
    {"name": "Business Intelligence", "category": "Data", "description": "BI tools and reporting", "icon": "📈", "display_order": 8},
    
    # Security
    {"name": "Cybersecurity", "category": "Security", "description": "Security architecture and defense", "icon": "🔒", "display_order": 9},
    {"name": "IAM", "category": "Security", "description": "Identity and Access Management", "icon": "🔑", "display_order": 10},
    {"name": "Compliance", "category": "Security", "description": "Security compliance and governance", "icon": "📋", "display_order": 11},
    {"name": "DevSecOps", "category": "Security", "description": "Security in DevOps practices", "icon": "🛡️", "display_order": 12},
    
    # Software
    {"name": "Frontend Development", "category": "Software", "description": "Web and UI development", "icon": "🎨", "display_order": 13},
    {"name": "Backend Development", "category": "Software", "description": "Server-side development", "icon": "⚙️", "display_order": 14},
    {"name": "Mobile Development", "category": "Software", "description": "iOS and Android development", "icon": "📱", "display_order": 15},
    {"name": "DevOps", "category": "Software", "description": "CI/CD and infrastructure automation", "icon": "🔄", "display_order": 16},
    
    # AI
    {"name": "Generative AI", "category": "AI", "description": "LLMs and generative models", "icon": "✨", "display_order": 17},
    {"name": "MLOps", "category": "AI", "description": "ML operations and deployment", "icon": "🔬", "display_order": 18},
    
    # Soft Skills
    {"name": "Communication", "category": "Soft Skills", "description": "Effective verbal and written communication", "icon": "🗣️", "display_order": 19},
    {"name": "Leadership", "category": "Soft Skills", "description": "Leading teams and projects", "icon": "👑", "display_order": 20},
    {"name": "Problem Solving", "category": "Soft Skills", "description": "Analytical thinking and resolution", "icon": "🧩", "display_order": 21},
    {"name": "Adaptability", "category": "Soft Skills", "description": "Flexibility in fast-paced environments", "icon": "🦎", "display_order": 22},
    {"name": "Teamwork", "category": "Soft Skills", "description": "Collaboration and cooperation", "icon": "🤝", "display_order": 23},
    {"name": "Client Management", "category": "Soft Skills", "description": "Managing stakeholder expectations", "icon": "👔", "display_order": 24},

    # Business / Staff
    {"name": "Project Management", "category": "Business", "description": "Planning and executing projects", "icon": "📅", "display_order": 25},
    {"name": "Agile / Scrum", "category": "Business", "description": "Agile methodologies", "icon": "🔄", "display_order": 26},
    {"name": "Sales", "category": "Business", "description": "Business development and sales", "icon": "💼", "display_order": 27},
    {"name": "Recruitment", "category": "Business", "description": "Talent acquisition", "icon": "🔍", "display_order": 28},
    {"name": "Marketing", "category": "Business", "description": "Market strategy and promotion", "icon": "📢", "display_order": 29},
    {"name": "Finance", "category": "Business", "description": "Financial planning and analysis", "icon": "💰", "display_order": 30},
]

# FreshMinds colleagues with realistic profiles for coffee date matching
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
    # Staff / Business Users
    {
        "name": "Julia de Jong",
        "email": "julia.dejong@freshminds.nl",
        "unit": UnitType.STAFF,
        "seniority": "Senior",
        "availability": "Weekly",
        "entra_oid": "oid-julia-dj",
        "current_skills": ["Recruitment", "Communication", "Management"],
        "growth_skills": ["Agile / Scrum", "Marketing"],
    },
    {
        "name": "Mark Rutte",
        "email": "mark.rutte@freshminds.nl",
        "unit": UnitType.STAFF,
        "seniority": "Principal",
        "availability": "Ad-hoc",
        "entra_oid": "oid-mark-r",
        "current_skills": ["Project Management", "Leadership", "Client Management"],
        "growth_skills": ["Generative AI", "Data Engineering"],
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

# Community user that matches with everyone
COMMUNITY_USER = {
    "name": "FreshMinds Community",
    "email": "community@freshminds.nl",
    "unit": UnitType.STAFF,
    "seniority": "Guide",
    "availability": "Always",
    "entra_oid": "oid-community",
    "description": "I am here to connect with everyone!"
}

# Legacy demo users for backwards compatibility
DEMO_USERS = [
    {"name": user["name"], "email": user["email"], "unit": user["unit"],
     "seniority": user["seniority"], "availability": user["availability"],
     "entra_oid": user["entra_oid"]}
    for user in FRESHMINDS_COLLEAGUES
]


async def seed_database():
    """Seed the database with initial data."""
    connect_args = {}
    ssl_mode = os.getenv("DB_SSL", "").strip().lower()
    if ssl_mode in {"1", "true", "require", "required"}:
        connect_args["ssl"] = ssl.create_default_context()

    engine = create_async_engine(settings.database_url, echo=True, connect_args=connect_args)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with session_maker() as session:
        print("Seeding skills (incremental update)...")
        skills = []
        
        # Fetch existing skills to avoid duplicates
        existing_skills_result = await session.execute(select(Skill))
        existing_skills = {s.name: s for s in existing_skills_result.scalars().all()}
        
        for skill_data in SKILLS_DATA:
            if skill_data["name"] in existing_skills:
                # Update existing skill if needed, or just track it
                skill = existing_skills[skill_data["name"]]
                # Optional: Update fields if changed
                # skill.category = skill_data["category"]
                # skill.icon = skill_data["icon"]
                skills.append(skill)
            else:
                # Add new skill
                print(f"Adding new skill: {skill_data['name']}")
                skill = Skill(**skill_data)
                session.add(skill)
                skills.append(skill)
        
        await session.flush()
        
         # Check if users exist to determine if we need to seed users
        result = await session.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            print("Users already seeded, skipping user creation...")
            await session.commit()
            return

        print("Seeding users with FreshMinds colleagues...")
        # Create a skill name to skill object mapping
        skill_map = {skill.name: skill for skill in skills}
        
        users = []
        for i, colleague_data in enumerate(FRESHMINDS_COLLEAGUES):
            # Extract basic user fields
            user = User(
                name=colleague_data["name"],
                email=colleague_data["email"],
                unit=colleague_data["unit"],
                seniority=colleague_data["seniority"],
                availability=colleague_data["availability"],
                entra_oid=colleague_data["entra_oid"],
            )
            session.add(user)
            users.append((user, colleague_data))
        
        # Add Community User
        community_user = User(
            name=COMMUNITY_USER["name"],
            email=COMMUNITY_USER["email"],
            unit=COMMUNITY_USER["unit"],
            seniority=COMMUNITY_USER["seniority"],
            availability=COMMUNITY_USER["availability"],
            entra_oid=COMMUNITY_USER["entra_oid"],
        )
        session.add(community_user)
        users.append((community_user, float("inf"))) # Mark as community user
        
        await session.flush()
        
        print("Seeding user skills and swipes...")
        for user, colleague_data in users:
            if colleague_data == float("inf"):
                 # ONE MATCH TO RULE THEM ALL: Community User gets ALL skills
                 for skill in skills:
                    # Add as current skill
                    user_skill = UserSkill(
                        user_id=user.id,
                        skill_id=skill.id,
                        skill_type=SkillType.CURRENT,
                    )
                    session.add(user_skill)
                 
                 # Community User swipes RIGHT on all other users
                 potential_matches = [u for u, d in users if u.id != user.id]
                 for target_user in potential_matches:
                    swipe = Swipe(
                        user_id=user.id,
                        target_user_id=target_user.id,
                        direction=SwipeDirection.RIGHT,
                        created_at=datetime.utcnow() - timedelta(days=1),
                    )
                    session.add(swipe)
                 continue

            assigned_current_skills = []
            assigned_growth_skills = []
            
            # Assign predefined current skills
            for skill_name in colleague_data.get("current_skills", []):
                if skill_name in skill_map:
                    skill = skill_map[skill_name]
                    user_skill = UserSkill(
                        user_id=user.id,
                        skill_id=skill.id,
                        skill_type=SkillType.CURRENT,
                    )
                    session.add(user_skill)
            
            # Assign predefined growth skills
            for skill_name in colleague_data.get("growth_skills", []):
                if skill_name in skill_map:
                    skill = skill_map[skill_name]
                    user_skill = UserSkill(
                        user_id=user.id,
                        skill_id=skill.id,
                        skill_type=SkillType.GROWTH,
                    )
                    session.add(user_skill)

            # Generate random swipes on other USERS (candidates)
            # Find other users (excluding self and community)
            potential_matches = [u for u, d in users if u.id != user.id and d != float("inf")]
            
            # Swipe on a few random colleagues
            if potential_matches:
                swiped_colleagues = random.sample(potential_matches, min(3, len(potential_matches)))
                for target_user in swiped_colleagues:
                    rand = random.random()
                    direction = SwipeDirection.RIGHT if rand < 0.6 else SwipeDirection.LEFT
                    
                    swipe = Swipe(
                        user_id=user.id,
                        target_user_id=target_user.id,
                        direction=direction,
                        created_at=datetime.utcnow() - timedelta(days=random.randint(0, 30)),
                    )
                    session.add(swipe)
        
        await session.commit()
        print("Seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed_database())
