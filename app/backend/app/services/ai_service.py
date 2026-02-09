from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from openai import AsyncAzureOpenAI
import json
import logging

from app.config import get_settings
from app.models.user import User, UserSkill, UnitType, SkillType
from app.models.skill import Skill

logger = logging.getLogger(__name__)

settings = get_settings()

class AIAgentService:
    """AI-powered chat agent for FreshMinds colleague queries."""
    
    SYSTEM_PROMPT = """You are FreshBot, a friendly AI assistant for FreshMinds.
    You help employees discover their colleagues' skills, interests, and availability.
    
    You have access to a list of colleagues with their details.
    When answering:
    1. Be helpful, concise, and professional.
    2. detailed info is provided in JSON format, parse it to answer the user request.
    3. If listing people, mention their unit and seniority if relevant.
    4. If you don't find anyone matching the specific criteria, suggest looking for related skills.
    5. Always maintain a positive and encouraging tone.
    6. If the user asks about something unrelated to FreshMinds colleagues/skills, politely steer them back to the topic.
    """
    
    def __init__(self):
        self.client = None
        if settings.azure_openai_api_key and settings.azure_openai_endpoint:
            self.client = AsyncAzureOpenAI(
                api_key=settings.azure_openai_api_key,
                azure_endpoint=settings.azure_openai_endpoint,
                api_version=settings.azure_openai_api_version,
            )
        else:
            logger.warning("Azure OpenAI API key or endpoint not set. AI features will be disabled.")

    async def _get_all_colleagues_context(self, db: AsyncSession) -> str:
        """Retrieve all colleagues and format as context for the LLM."""
        # For MVP, we'll fetch all users (assuming < 100 active users for now)
        # In a larger system, we'd use vector search (RAG) here.
        
        result = await db.execute(
            select(User)
            .options(selectinload(User.skills).selectinload(UserSkill.skill))
            .where(User.is_searchable == True)
        )
        users = result.scalars().all()
        
        colleagues_data = []
        for user in users:
            current_skills = [us.skill.name for us in user.skills if us.skill and us.skill_type == SkillType.CURRENT]
            growth_skills = [us.skill.name for us in user.skills if us.skill and us.skill_type == SkillType.GROWTH]
            
            colleagues_data.append({
                "name": user.name,
                "unit": user.unit.value if hasattr(user.unit, 'value') else str(user.unit),
                "seniority": user.seniority,
                "availability": user.availability,
                "email": user.email if user.show_email else "Hidden",
                "current_skills": current_skills,
                "growth_skills": growth_skills
            })
            
        return json.dumps(colleagues_data, indent=2)

    async def generate_response(self, db: AsyncSession, user_message: str) -> str:
        """Generate AI response using LLM."""
        if not self.client:
            return "I'm sorry, my AI brain isn't connected right now (Azure OpenAI not configured). Please contact the administrator."

        try:
            # 1. Retrieve Context
            context_data = await self._get_all_colleagues_context(db)
            
            # 2. Call LLM
            response = await self.client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "system", "content": f"Here is the data about FreshMinds colleagues:\n{context_data}"},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=settings.ai_max_tokens,
                temperature=0.7,
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"Error generating AI response: {e}")
            return "I'm having a little trouble thinking right now. Please try again later."
