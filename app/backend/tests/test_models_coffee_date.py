"""Tests for Coffee Date model."""
import pytest
from uuid import uuid4
from datetime import datetime, timezone

from app.models.coffee_date import CoffeeDate, CoffeeDateStatus


class TestCoffeeDateStatus:
    """Tests for CoffeeDateStatus enum."""
    
    def test_status_values_exist(self):
        """Test that all expected status values exist."""
        assert CoffeeDateStatus.SUGGESTED is not None
        assert CoffeeDateStatus.REQUESTED is not None
        assert CoffeeDateStatus.ACCEPTED is not None
        assert CoffeeDateStatus.DECLINED is not None
        assert CoffeeDateStatus.COMPLETED is not None
    
    def test_status_string_values(self):
        """Test status enum string representations."""
        assert CoffeeDateStatus.SUGGESTED.value == "suggested"
        assert CoffeeDateStatus.REQUESTED.value == "requested"
        assert CoffeeDateStatus.ACCEPTED.value == "accepted"
        assert CoffeeDateStatus.DECLINED.value == "declined"
        assert CoffeeDateStatus.COMPLETED.value == "completed"


class TestCoffeeDateModel:
    """Tests for CoffeeDate model."""
    
    def test_create_coffee_date_minimal(self):
        """Test creating a coffee date with minimal fields."""
        requester_id = uuid4()
        recipient_id = uuid4()
        
        coffee_date = CoffeeDate(
            requester_id=requester_id,
            recipient_id=recipient_id,
        )
        
        assert coffee_date.requester_id == requester_id
        assert coffee_date.recipient_id == recipient_id
        # Default value is applied at DB level unless set explicitly
        assert coffee_date.status is None
    
    def test_create_coffee_date_full(self):
        """Test creating a coffee date with all fields."""
        requester_id = uuid4()
        recipient_id = uuid4()
        match_id = uuid4()
        proposed_time = datetime.now(timezone.utc)
        
        coffee_date = CoffeeDate(
            requester_id=requester_id,
            recipient_id=recipient_id,
            match_id=match_id,
            status=CoffeeDateStatus.REQUESTED,
            proposed_time=proposed_time,
            location="Teams call",
            message="Let's chat about ML!",
            match_score=15.5,
            match_reasons=["Both interested in ML", "Can mentor in Python"],
        )
        
        assert coffee_date.requester_id == requester_id
        assert coffee_date.recipient_id == recipient_id
        assert coffee_date.match_id == match_id
        assert coffee_date.status == CoffeeDateStatus.REQUESTED
        assert coffee_date.proposed_time == proposed_time
        assert coffee_date.location == "Teams call"
        assert coffee_date.message == "Let's chat about ML!"
        assert coffee_date.match_score == 15.5
        assert coffee_date.match_reasons == ["Both interested in ML", "Can mentor in Python"]
    
    def test_coffee_date_status_transition(self):
        """Test status transitions are possible."""
        coffee_date = CoffeeDate(
            requester_id=uuid4(),
            recipient_id=uuid4(),
            status=CoffeeDateStatus.SUGGESTED,
        )
        
        # Start suggested
        assert coffee_date.status == CoffeeDateStatus.SUGGESTED

        
        # Move to requested
        coffee_date.status = CoffeeDateStatus.REQUESTED
        assert coffee_date.status == CoffeeDateStatus.REQUESTED
        
        # Move to accepted
        coffee_date.status = CoffeeDateStatus.ACCEPTED
        assert coffee_date.status == CoffeeDateStatus.ACCEPTED
        
        # Move to completed
        coffee_date.status = CoffeeDateStatus.COMPLETED
        assert coffee_date.status == CoffeeDateStatus.COMPLETED
    
    def test_coffee_date_tablename(self):
        """Test the table name is correct."""
        assert CoffeeDate.__tablename__ == "coffee_dates"
