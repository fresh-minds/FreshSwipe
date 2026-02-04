"""Tests for MatchingService."""
import pytest
from uuid import uuid4
from unittest.mock import MagicMock

from app.models.user import User, UnitType, UserSkill, SkillType
from app.models.skill import Skill
from app.models.swipe import Swipe, SwipeDirection
from app.services.matching import MatchingService


class TestMatchingServiceCalculateScore:
    """Tests for MatchingService.calculate_score static method."""
    
    def test_calculate_score_no_overlap(self):
        """Test score is 0 when users have no overlap."""
        user_a = MagicMock(spec=User)
        user_a.swipes = []
        user_a.skills = []
        user_a.unit = UnitType.DATA
        user_a.name = "User A"
        
        user_b = MagicMock(spec=User)
        user_b.swipes = []
        user_b.skills = []
        user_b.unit = UnitType.SOFTWARE
        user_b.name = "User B"
        
        score, reasons, match_type = MatchingService.calculate_score(user_a, user_b)
        
        assert score == 0.0
        assert reasons == []
        assert match_type == "peer"
    
    def test_calculate_score_same_unit_bonus(self):
        """Test that same unit adds a bonus point."""
        user_a = MagicMock(spec=User)
        user_a.swipes = []
        user_a.skills = []
        user_a.unit = UnitType.DATA
        user_a.name = "User A"
        
        user_b = MagicMock(spec=User)
        user_b.swipes = []
        user_b.skills = []
        user_b.unit = UnitType.DATA
        user_b.name = "User B"
        
        score, reasons, match_type = MatchingService.calculate_score(user_a, user_b)
        
        assert score == 1.0
        # Check against actual string representation
        assert str(UnitType.DATA) in reasons[0] or "Data" in reasons[0]
    
    def test_calculate_score_shared_super_like(self):
        """Test super-liked skill match gives high score."""
        skill_id = uuid4()
        skill = MagicMock(spec=Skill)
        skill.name = "Machine Learning"
        
        swipe_a = MagicMock()
        swipe_a.skill_id = skill_id
        swipe_a.direction = SwipeDirection.SUPER
        swipe_a.skill = skill
        
        swipe_b = MagicMock()
        swipe_b.skill_id = skill_id
        swipe_b.direction = SwipeDirection.SUPER
        swipe_b.skill = skill
        
        user_a = MagicMock(spec=User)
        user_a.swipes = [swipe_a]
        user_a.skills = []
        user_a.unit = UnitType.DATA
        user_a.name = "User A"
        
        user_b = MagicMock(spec=User)
        user_b.swipes = [swipe_b]
        user_b.skills = []
        user_b.unit = UnitType.SOFTWARE
        user_b.name = "User B"
        
        score, reasons, match_type = MatchingService.calculate_score(user_a, user_b)
        
        assert score == 5.0  # Super-like match = 5 points
        assert "Both super-liked Machine Learning" in reasons
    
    def test_calculate_score_shared_interest(self):
        """Test shared interest (right swipe) match."""
        skill_id = uuid4()
        skill = MagicMock(spec=Skill)
        skill.name = "Python"
        
        swipe_a = MagicMock()
        swipe_a.skill_id = skill_id
        swipe_a.direction = SwipeDirection.RIGHT
        swipe_a.skill = skill
        
        swipe_b = MagicMock()
        swipe_b.skill_id = skill_id
        swipe_b.direction = SwipeDirection.RIGHT
        swipe_b.skill = skill
        
        user_a = MagicMock(spec=User)
        user_a.swipes = [swipe_a]
        user_a.skills = []
        user_a.unit = UnitType.DATA
        user_a.name = "User A"
        
        user_b = MagicMock(spec=User)
        user_b.swipes = [swipe_b]
        user_b.skills = []
        user_b.unit = UnitType.SOFTWARE
        user_b.name = "User B"
        
        score, reasons, match_type = MatchingService.calculate_score(user_a, user_b)
        
        assert score == 2.0  # Shared interest = 2 points
        assert "Shared interest in Python" in reasons
    
    def test_calculate_score_mentor_match(self):
        """Test mentor-mentee relationship is detected."""
        skill_id = uuid4()
        skill = MagicMock(spec=Skill)
        skill.name = "Azure"
        
        # User A has Azure as current skill
        user_skill_a = MagicMock()
        user_skill_a.skill_id = skill_id
        user_skill_a.skill_type = SkillType.CURRENT
        user_skill_a.skill = skill
        
        # User B wants to learn Azure (growth skill)
        user_skill_b = MagicMock()
        user_skill_b.skill_id = skill_id
        user_skill_b.skill_type = SkillType.GROWTH
        user_skill_b.skill = skill
        
        user_a = MagicMock(spec=User)
        user_a.swipes = []
        user_a.skills = [user_skill_a]
        user_a.unit = UnitType.CLOUD
        user_a.name = "Elena"
        
        user_b = MagicMock(spec=User)
        user_b.swipes = []
        user_b.skills = [user_skill_b]
        user_b.unit = UnitType.DATA
        user_b.name = "Anna"
        
        score, reasons, match_type = MatchingService.calculate_score(user_a, user_b)
        
        assert score == 6.0  # Mentor match = 6 points
        assert "Elena can mentor Anna in Azure" in reasons
        assert match_type == "mentor"
    
    def test_calculate_score_bidirectional_mentoring(self):
        """Test when both users can mentor each other."""
        skill_1_id = uuid4()
        skill_1 = MagicMock(spec=Skill)
        skill_1.name = "Python"
        
        skill_2_id = uuid4()
        skill_2 = MagicMock(spec=Skill)
        skill_2.name = "React"
        
        # User A: has Python, wants React
        user_skill_a_current = MagicMock()
        user_skill_a_current.skill_id = skill_1_id
        user_skill_a_current.skill_type = SkillType.CURRENT
        user_skill_a_current.skill = skill_1
        
        user_skill_a_growth = MagicMock()
        user_skill_a_growth.skill_id = skill_2_id
        user_skill_a_growth.skill_type = SkillType.GROWTH
        user_skill_a_growth.skill = skill_2
        
        # User B: has React, wants Python
        user_skill_b_current = MagicMock()
        user_skill_b_current.skill_id = skill_2_id
        user_skill_b_current.skill_type = SkillType.CURRENT
        user_skill_b_current.skill = skill_2
        
        user_skill_b_growth = MagicMock()
        user_skill_b_growth.skill_id = skill_1_id
        user_skill_b_growth.skill_type = SkillType.GROWTH
        user_skill_b_growth.skill = skill_1
        
        user_a = MagicMock(spec=User)
        user_a.swipes = []
        user_a.skills = [user_skill_a_current, user_skill_a_growth]
        user_a.unit = UnitType.DATA
        user_a.name = "Sarah"
        
        user_b = MagicMock(spec=User)
        user_b.swipes = []
        user_b.skills = [user_skill_b_current, user_skill_b_growth]
        user_b.unit = UnitType.SOFTWARE
        user_b.name = "Tom"
        
        score, reasons, match_type = MatchingService.calculate_score(user_a, user_b)
        
        assert score == 12.0  # Both can mentor = 6 + 6 points
        assert match_type == "mentor"
        assert len(reasons) == 2


class TestMatchingServiceIntegration:
    """Integration tests for full matching flow."""
    
    def test_matching_service_has_required_methods(self):
        """Verify MatchingService has the expected interface."""
        assert hasattr(MatchingService, 'calculate_score')
        assert hasattr(MatchingService, 'get_matches')
