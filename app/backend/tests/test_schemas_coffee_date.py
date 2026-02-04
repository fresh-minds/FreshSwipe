"""Tests for Coffee Date schemas."""
import pytest
from uuid import uuid4
from datetime import datetime, timezone
from pydantic import ValidationError

from app.schemas.coffee_date import (
    CoffeeDateSuggestion,
    CoffeeDateRequest,
    CoffeeDateResponse,
    CoffeeDateOut,
)
from app.models.coffee_date import CoffeeDateStatus


class TestCoffeeDateSuggestionSchema:
    """Tests for CoffeeDateSuggestion schema."""
    
    def test_create_valid_suggestion(self):
        """Test creating a valid suggestion."""
        suggestion = CoffeeDateSuggestion(
            user_id=uuid4(),
            user_name="Sarah van der Berg",
            user_email="sarah@freshminds.nl",
            user_unit="Data",
            user_seniority="Senior",
            user_availability="1h/week",
            score=15.0,
            reasons=["Both interested in ML", "Can mentor in Python"],
            match_type="mentor",
        )
        
        assert suggestion.user_name == "Sarah van der Berg"
        assert suggestion.score == 15.0
        assert len(suggestion.reasons) == 2
        assert suggestion.match_type == "mentor"
    
    def test_suggestion_optional_fields(self):
        """Test suggestion with optional fields None."""
        suggestion = CoffeeDateSuggestion(
            user_id=uuid4(),
            user_name="Test User",
            user_email="test@freshminds.nl",
            user_unit="Software",
            user_seniority=None,
            user_availability=None,
            score=5.0,
            reasons=[],
            match_type="peer",
        )
        
        assert suggestion.user_seniority is None
        assert suggestion.user_availability is None
    
    def test_suggestion_requires_user_id(self):
        """Test that user_id is required."""
        with pytest.raises(ValidationError):
            CoffeeDateSuggestion(
                user_name="Test",
                user_email="test@freshminds.nl",
                user_unit="Data",
                score=5.0,
                reasons=[],
                match_type="peer",
            )


class TestCoffeeDateRequestSchema:
    """Tests for CoffeeDateRequest schema."""
    
    def test_create_minimal_request(self):
        """Test creating a request with minimal fields."""
        request = CoffeeDateRequest(
            recipient_id=uuid4(),
        )
        
        assert request.recipient_id is not None
        assert request.proposed_time is None
        assert request.location is None
        assert request.message is None
    
    def test_create_full_request(self):
        """Test creating a request with all fields."""
        proposed_time = datetime.now(timezone.utc)
        
        request = CoffeeDateRequest(
            recipient_id=uuid4(),
            proposed_time=proposed_time,
            location="Teams call",
            message="Let's grab a virtual coffee!",
        )
        
        assert request.proposed_time == proposed_time
        assert request.location == "Teams call"
        assert request.message == "Let's grab a virtual coffee!"


class TestCoffeeDateResponseSchema:
    """Tests for CoffeeDateResponse schema."""
    
    def test_accept_response(self):
        """Test creating an accept response."""
        response = CoffeeDateResponse(status=CoffeeDateStatus.ACCEPTED)
        assert response.status == CoffeeDateStatus.ACCEPTED
    
    def test_decline_response(self):
        """Test creating a decline response."""
        response = CoffeeDateResponse(status=CoffeeDateStatus.DECLINED)
        assert response.status == CoffeeDateStatus.DECLINED


class TestCoffeeDateOutSchema:
    """Tests for CoffeeDateOut schema."""
    
    def test_create_coffee_date_out(self):
        """Test creating a complete CoffeeDateOut."""
        now = datetime.now(timezone.utc)
        
        out = CoffeeDateOut(
            id=uuid4(),
            requester_id=uuid4(),
            requester_name="Alice",
            requester_email="alice@freshminds.nl",
            recipient_id=uuid4(),
            recipient_name="Bob",
            recipient_email="bob@freshminds.nl",
            status=CoffeeDateStatus.REQUESTED,
            proposed_time=now,
            location="Cafe",
            message="Hi!",
            match_score=10.0,
            match_reasons=["Shared interest"],
            created_at=now,
            updated_at=now,
        )
        
        assert out.requester_name == "Alice"
        assert out.recipient_name == "Bob"
        assert out.status == CoffeeDateStatus.REQUESTED
        assert out.match_score == 10.0
    
    def test_coffee_date_out_optional_fields(self):
        """Test CoffeeDateOut with optional fields None."""
        now = datetime.now(timezone.utc)
        
        out = CoffeeDateOut(
            id=uuid4(),
            requester_id=uuid4(),
            requester_name="Alice",
            requester_email="alice@freshminds.nl",
            recipient_id=uuid4(),
            recipient_name="Bob",
            recipient_email="",
            status=CoffeeDateStatus.SUGGESTED,
            proposed_time=None,
            location=None,
            message=None,
            match_score=0.0,
            match_reasons=[],
            created_at=now,
            updated_at=now,
        )
        
        assert out.proposed_time is None
        assert out.location is None
        assert out.message is None
