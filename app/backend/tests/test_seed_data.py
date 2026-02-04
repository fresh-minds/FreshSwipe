"""Tests for seed data and FreshMinds colleagues."""
import pytest
import sys
import os

# Add backend to path for import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from seed_data import FRESHMINDS_COLLEAGUES, SKILLS_DATA as SKILLS


class TestFreshMindsColleagues:
    """Tests for the mock FreshMinds colleagues data."""
    
    def test_has_enough_colleagues(self):
        """Test that we have at least 8 mock colleagues."""
        assert len(FRESHMINDS_COLLEAGUES) >= 8
    
    def test_all_colleagues_have_required_fields(self):
        """Test all colleagues have the required fields."""
        required_fields = [
            'name', 'email', 'unit', 'seniority', 
            'availability', 'entra_oid', 'current_skills', 'growth_skills'
        ]
        
        for colleague in FRESHMINDS_COLLEAGUES:
            for field in required_fields:
                assert field in colleague, f"Missing field '{field}' for {colleague.get('name', 'unknown')}"
    
    def test_all_colleagues_have_unique_emails(self):
        """Test all colleagues have unique email addresses."""
        emails = [c['email'] for c in FRESHMINDS_COLLEAGUES]
        assert len(emails) == len(set(emails)), "Duplicate emails found"
    
    def test_all_colleagues_have_unique_entra_oids(self):
        """Test all colleagues have unique Entra OIDs."""
        oids = [c['entra_oid'] for c in FRESHMINDS_COLLEAGUES]
        assert len(oids) == len(set(oids)), "Duplicate OIDs found"
    
    def test_all_colleagues_use_freshminds_email(self):
        """Test all colleagues use @freshminds.nl email domain."""
        for colleague in FRESHMINDS_COLLEAGUES:
            assert colleague['email'].endswith('@freshminds.nl'), \
                f"{colleague['name']} doesn't have freshminds.nl email"
    
    def test_all_colleagues_have_current_skills(self):
        """Test all colleagues have at least one current skill."""
        for colleague in FRESHMINDS_COLLEAGUES:
            assert len(colleague['current_skills']) >= 1, \
                f"{colleague['name']} has no current skills"
    
    def test_all_colleagues_have_growth_skills(self):
        """Test all colleagues have at least one growth skill."""
        for colleague in FRESHMINDS_COLLEAGUES:
            assert len(colleague['growth_skills']) >= 1, \
                f"{colleague['name']} has no growth skills"
    
    def test_colleague_skills_exist_in_skills_list(self):
        """Test that all colleague skills reference existing skills."""
        skill_names = {s['name'] for s in SKILLS}
        
        for colleague in FRESHMINDS_COLLEAGUES:
            for skill_name in colleague['current_skills']:
                assert skill_name in skill_names, \
                    f"Skill '{skill_name}' for {colleague['name']} not in skills list"
            for skill_name in colleague['growth_skills']:
                assert skill_name in skill_names, \
                    f"Skill '{skill_name}' for {colleague['name']} not in skills list"
    
    def test_no_overlap_between_current_and_growth_skills(self):
        """Test that a colleague doesn't have the same skill as both current and growth."""
        for colleague in FRESHMINDS_COLLEAGUES:
            current = set(colleague['current_skills'])
            growth = set(colleague['growth_skills'])
            overlap = current & growth
            assert len(overlap) == 0, \
                f"{colleague['name']} has overlapping skills: {overlap}"
    
    def test_variety_of_units(self):
        """Test that colleagues come from different units."""
        units = {str(c['unit']) for c in FRESHMINDS_COLLEAGUES}
        assert len(units) >= 3, "Should have colleagues from at least 3 different units"
    
    def test_variety_of_seniorities(self):
        """Test that colleagues have different seniority levels."""
        seniorities = {c['seniority'] for c in FRESHMINDS_COLLEAGUES}
        assert len(seniorities) >= 3, "Should have at least 3 different seniority levels"


class TestSkillsData:
    """Tests for the skills seed data."""
    
    def test_has_enough_skills(self):
        """Test that we have enough skills defined."""
        assert len(SKILLS) >= 10

    
    def test_skills_have_required_fields(self):
        """Test all skills have required fields."""
        required_fields = ['name', 'category', 'icon']
        
        for skill in SKILLS:
            for field in required_fields:
                assert field in skill, f"Missing field '{field}' for skill"
    
    def test_skills_have_unique_names(self):
        """Test all skills have unique names."""
        names = [s['name'] for s in SKILLS]
        assert len(names) == len(set(names)), "Duplicate skill names found"
    
    def test_skills_have_categories(self):
        """Test skills are grouped into categories."""
        categories = {s['category'] for s in SKILLS}
        assert len(categories) >= 3, "Should have at least 3 skill categories"
    
    def test_skills_have_icons(self):
        """Test all skills have icons."""
        for skill in SKILLS:
            assert skill['icon'], f"Skill '{skill['name']}' has no icon"


class TestMatchingPotential:
    """Tests to verify the colleagues are set up for meaningful matches."""
    
    def test_some_colleagues_can_mentor_others(self):
        """Test that at least some colleagues can mentor others based on skills."""
        all_current = set()
        all_growth = set()
        
        for colleague in FRESHMINDS_COLLEAGUES:
            all_current.update(colleague['current_skills'])
            all_growth.update(colleague['growth_skills'])
        
        # There should be overlap: skills that someone has and someone wants
        overlap = all_current & all_growth
        assert len(overlap) >= 3, \
            "Should have at least 3 skills where mentorship is possible"
    
    def test_mentorship_relationships_exist(self):
        """Test that specific mentor-mentee relationships are possible."""
        mentorship_found = False
        
        for mentor in FRESHMINDS_COLLEAGUES:
            for mentee in FRESHMINDS_COLLEAGUES:
                if mentor['email'] == mentee['email']:
                    continue
                    
                # Check if mentor has any skill that mentee wants
                mentor_skills = set(mentor['current_skills'])
                mentee_wants = set(mentee['growth_skills'])
                
                if mentor_skills & mentee_wants:
                    mentorship_found = True
                    break
            if mentorship_found:
                break
        
        assert mentorship_found, "No mentorship relationships possible with current data"
