#!/usr/bin/env python3
"""
Comprehensive API Endpoint Test Script for FreshSwipe
Tests all frontend and backend endpoints with admin authentication.
"""
import os
import sys
import json
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import pytest

# ==============================================================================
# Configuration
# ==============================================================================
# Default to local Docker environment
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8081")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8081")

# Admin/Debug user from .env
DEBUG_USER_ID = os.getenv("DEBUG_USER_ID", "66978413-2646-4654-be8c-d6788a78f661")

# Test timeout
TIMEOUT = 10

RUN_ENDPOINT_TESTS = os.getenv("RUN_ENDPOINT_TESTS", "").lower() in {"1", "true", "yes"}
pytestmark = pytest.mark.skipif(
    not RUN_ENDPOINT_TESTS,
    reason="Endpoint tests are opt-in. Set RUN_ENDPOINT_TESTS=1 to enable."
)

# ==============================================================================
# Color Output
# ==============================================================================
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    MAGENTA = '\033[0;35m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'  # No Color

def print_header(title: str):
    print(f"\n{Colors.BLUE}{'═' * 70}")
    print(f" {title}")
    print(f"{'═' * 70}{Colors.NC}")

def print_subheader(title: str):
    print(f"\n{Colors.CYAN}{'─' * 70}")
    print(f" {title}")
    print(f"{'─' * 70}{Colors.NC}")

def pass_test(message: str, details: str = ""):
    print(f"{Colors.GREEN}✅ PASS:{Colors.NC} {message}")
    if details:
        print(f"   {Colors.CYAN}└─{Colors.NC} {details}")

def fail_test(message: str, details: str = ""):
    print(f"{Colors.RED}❌ FAIL:{Colors.NC} {message}")
    if details:
        print(f"   {Colors.RED}└─{Colors.NC} {details}")

def warn_test(message: str, details: str = ""):
    print(f"{Colors.YELLOW}⚠️  WARN:{Colors.NC} {message}")
    if details:
        print(f"   {Colors.YELLOW}└─{Colors.NC} {details}")

def info(message: str):
    print(f"{Colors.MAGENTA}ℹ️  INFO:{Colors.NC} {message}")

# ==============================================================================
# Test Result Tracking
# ==============================================================================
@dataclass
class TestResult:
    name: str
    passed: bool
    status_code: Optional[int] = None
    response_time: Optional[float] = None
    error: Optional[str] = None
    details: Optional[str] = None

class TestSuite:
    def __init__(self):
        self.results: list[TestResult] = []
        self.test_data: Dict[str, Any] = {}
        self.session = requests.Session()
    
    def add_result(self, result: TestResult):
        self.results.append(result)
    
    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.passed)
    
    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if not r.passed)
    
    @property
    def total(self) -> int:
        return len(self.results)

# ==============================================================================
# Pytest Fixtures
# ==============================================================================
@pytest.fixture(scope="session")
def suite() -> "TestSuite":
    return TestSuite()

# ==============================================================================
# Auth Helpers
# ==============================================================================
def login_admin(suite: TestSuite):
    """Attempt to log in as admin to get session cookie."""
    print_subheader("Authentication")
    
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    
    if not admin_email or not admin_password:
        warn_test("Skipping Login", "ADMIN_EMAIL and ADMIN_PASSWORD not set")
        return

    # 1. Get CSRF Token
    try:
        resp = suite.session.get(f"{FRONTEND_URL}/api/auth/csrf", timeout=TIMEOUT)
        if resp.status_code == 200:
            csrf_token = resp.json().get("csrfToken")
            pass_test("Fetch CSRF Token")
        else:
            fail_test("Fetch CSRF Token", f"Status {resp.status_code}")
            return
    except Exception as e:
        fail_test("Fetch CSRF Token", str(e))
        return

    # 2. Login
    login_data = {
        "redirect": "false",
        "csrfToken": csrf_token,
        "callbackUrl": f"{FRONTEND_URL}/",
        "json": "true",
        "email": admin_email,
        "password": admin_password
    }
    
    try:
        resp = suite.session.post(
            f"{FRONTEND_URL}/api/auth/callback/credentials",
            data=login_data,
            timeout=TIMEOUT
        )
        if resp.status_code in [200, 302]:
             # Check for auth cookie
            cookies = suite.session.cookies.get_dict()
            if any('next-auth.session-token' in k for k in cookies.keys()) or \
               any('__Secure-next-auth.session-token' in k for k in cookies.keys()):
                pass_test(f"Admin Login ({admin_email})", "Session established")
            else:
                fail_test(f"Admin Login ({admin_email})", "No session cookie found")
                info(f"Response: {resp.text[:200]}")
        else:
            fail_test(f"Admin Login ({admin_email})", f"Status {resp.status_code}")
    except Exception as e:
        fail_test("Admin Login", str(e))


# ==============================================================================
# HTTP Request Wrapper
# ==============================================================================
def make_request(
    method: str,
    endpoint: str,
    base_url: str = None,
    json_data: dict = None,
    params: dict = None,
    expected_status: int = 200,
    description: str = "",
    suite: TestSuite = None
) -> Tuple[bool, Optional[Dict], TestResult]:
    """
    Make an HTTP request and return (success, response_data, test_result).
    """
    url = f"{base_url or BASE_URL}{endpoint}"
    start_time = datetime.now()
    
    # Use suite session if available, else new request
    requester = suite.session if suite else requests
    
    try:
        response = requester.request(
            method=method,
            url=url,
            json=json_data,
            params=params,
            timeout=TIMEOUT,
            headers={"Content-Type": "application/json"}
        )
        elapsed = (datetime.now() - start_time).total_seconds() * 1000  # ms
        
        # Try to parse JSON response
        try:
            data = response.json()
        except:
            data = {"raw": response.text[:500]}
        
        passed = response.status_code == expected_status
        
        result = TestResult(
            name=description or f"{method} {endpoint}",
            passed=passed,
            status_code=response.status_code,
            response_time=elapsed,
            error=None if passed else f"Expected {expected_status}, got {response.status_code}",
            details=json.dumps(data)[:200] if not passed else None
        )
        
        if passed:
            pass_test(f"{method} {endpoint}", f"{response.status_code} in {elapsed:.0f}ms")
        else:
            fail_test(
                f"{method} {endpoint}",
                f"Expected {expected_status}, got {response.status_code}"
            )
            if isinstance(data, dict) and "detail" in data:
                print(f"      {Colors.RED}Detail: {data['detail']}{Colors.NC}")
        
        if suite:
            suite.add_result(result)
        
        return passed, data, result
        
    except requests.exceptions.ConnectionError:
        result = TestResult(
            name=description or f"{method} {endpoint}",
            passed=False,
            error="Connection refused"
        )
        fail_test(f"{method} {endpoint}", "Connection refused - is the server running?")
        if suite:
            suite.add_result(result)
        return False, None, result
        
    except requests.exceptions.Timeout:
        result = TestResult(
            name=description or f"{method} {endpoint}",
            passed=False,
            error="Request timeout"
        )
        fail_test(f"{method} {endpoint}", f"Timeout after {TIMEOUT}s")
        if suite:
            suite.add_result(result)
        return False, None, result
        
    except Exception as e:
        result = TestResult(
            name=description or f"{method} {endpoint}",
            passed=False,
            error=str(e)
        )
        fail_test(f"{method} {endpoint}", str(e))
        if suite:
            suite.add_result(result)
        return False, None, result

# ==============================================================================
# Backend Tests
# ==============================================================================
def test_backend_health(suite: TestSuite):
    """Test basic health and root endpoints."""
    print_subheader("Health & Root Endpoints")
    
    # Root endpoint
    make_request("GET", "/", description="Root endpoint", suite=suite)
    
    # Health check
    make_request("GET", "/health", description="Health check", suite=suite)
    
    # OpenAPI docs
    make_request("GET", "/docs", description="API Documentation (HTML)", suite=suite)
    make_request("GET", "/openapi.json", description="OpenAPI JSON spec", suite=suite)

def test_users_api(suite: TestSuite):
    """Test all user-related endpoints."""
    print_subheader("Users API (/api/v1/users)")
    
    # List users
    success, data, _ = make_request(
        "GET", "/api/v1/users/",
        params={"skip": 0, "limit": 10},
        description="List users (paginated)",
        suite=suite
    )
    
    if success and data:
        info(f"Found {len(data)} users")
        if len(data) > 0:
            # Store first user ID for later tests
            suite.test_data["test_user_id"] = data[0].get("id")
            suite.test_data["test_user_email"] = data[0].get("email")
    
    # Get current user (me) - requires DEBUG_USER_ID
    make_request(
        "GET", "/api/v1/users/me",
        description="Get current user (/me)",
        suite=suite
    )
    
    # Get user by ID
    if suite.test_data.get("test_user_id"):
        user_id = suite.test_data["test_user_id"]
        make_request(
            "GET", f"/api/v1/users/{user_id}",
            description=f"Get user by ID",
            suite=suite
        )
    
    # Get user by email
    if suite.test_data.get("test_user_email"):
        email = suite.test_data["test_user_email"]
        make_request(
            "GET", f"/api/v1/users/by-email/{email}",
            description="Get user by email",
            suite=suite
        )
    
    # Test non-existent user
    make_request(
        "GET", "/api/v1/users/00000000-0000-0000-0000-000000000000",
        expected_status=404,
        description="Get non-existent user (404 expected)",
        suite=suite
    )

def test_skills_api(suite: TestSuite):
    """Test all skill-related endpoints."""
    print_subheader("Skills API (/api/v1/skills)")
    
    # List all skills
    success, data, _ = make_request(
        "GET", "/api/v1/skills/",
        params={"active_only": True, "skip": 0, "limit": 20},
        description="List skills (active, paginated)",
        suite=suite
    )
    
    if success and data:
        info(f"Found {len(data)} skills")
        if len(data) > 0:
            suite.test_data["test_skill_id"] = data[0].get("id")
    
    # List skill categories
    make_request(
        "GET", "/api/v1/skills/categories",
        description="List skill categories",
        suite=suite
    )
    
    # Get skill by ID
    if suite.test_data.get("test_skill_id"):
        skill_id = suite.test_data["test_skill_id"]
        make_request(
            "GET", f"/api/v1/skills/{skill_id}",
            description="Get skill by ID",
            suite=suite
        )
    
    # Get skills for user (unswiped skills)
    if suite.test_data.get("test_user_id"):
        user_id = suite.test_data["test_user_id"]
        make_request(
            "GET", f"/api/v1/skills/for-user/{user_id}",
            description="Get unswiped skills for user",
            suite=suite
        )

def test_swipes_api(suite: TestSuite):
    """Test all swipe-related endpoints."""
    print_subheader("Swipes API (/api/v1/swipes)")
    
    # Get user swipes
    if suite.test_data.get("test_user_id"):
        user_id = suite.test_data["test_user_id"]
        
        success, data, _ = make_request(
            "GET", f"/api/v1/swipes/user/{user_id}",
            description="Get user swipes",
            suite=suite
        )
        
        if success:
            info(f"User has {len(data)} swipes")
        
        # Get user interests (right + super swipes)
        make_request(
            "GET", f"/api/v1/swipes/user/{user_id}/interests",
            description="Get user interests",
            suite=suite
        )
    
    # Test creating a swipe (if we have skill_id)
    if suite.test_data.get("test_user_id") and suite.test_data.get("test_skill_id"):
        # Note: This will update existing swipe if exists, or create new
        make_request(
            "POST", "/api/v1/swipes/",
            json_data={
                "user_id": suite.test_data["test_user_id"],
                "skill_id": suite.test_data["test_skill_id"],
                "direction": "right"
            },
            expected_status=201,
            description="Create/update swipe",
            suite=suite
        )

def test_matches_api(suite: TestSuite):
    """Test all match-related endpoints."""
    print_subheader("Matches API (/api/v1/matches)")
    
    # List matches for current user
    success, data, _ = make_request(
        "GET", "/api/v1/matches/",
        params={"limit": 10},
        description="List matches for current user",
        suite=suite
    )
    
    if success:
        info(f"Found {len(data)} matches")
    
    # Get match stats
    make_request(
        "GET", "/api/v1/matches/stats",
        description="Get match statistics",
        suite=suite
    )

def test_analytics_api(suite: TestSuite):
    """Test all analytics-related endpoints."""
    print_subheader("Analytics API (/api/v1/analytics)")
    
    # User summary
    if suite.test_data.get("test_user_id"):
        user_id = suite.test_data["test_user_id"]
        make_request(
            "GET", f"/api/v1/analytics/user/{user_id}/summary",
            description="Get user analytics summary",
            suite=suite
        )
    
    # Organization skill stats
    make_request(
        "GET", "/api/v1/analytics/organization/skills",
        description="Organization skill statistics",
        suite=suite
    )
    
    # Unit distribution
    make_request(
        "GET", "/api/v1/analytics/organization/units",
        description="Unit distribution",
        suite=suite
    )
    
    # Trending skills
    make_request(
        "GET", "/api/v1/analytics/organization/trends",
        params={"limit": 5},
        description="Trending skills",
        suite=suite
    )
    
    # Category breakdown
    make_request(
        "GET", "/api/v1/analytics/organization/category-breakdown",
        description="Category breakdown",
        suite=suite
    )

def test_coffee_dates_api(suite: TestSuite):
    """Test all coffee date-related endpoints."""
    print_subheader("Coffee Dates API (/api/v1/coffee-dates)")
    
    # Get suggestions
    make_request(
        "GET", "/api/v1/coffee-dates/suggestions",
        params={"limit": 5},
        description="Get coffee date suggestions",
        suite=suite
    )
    
    # List coffee dates
    success, data, _ = make_request(
        "GET", "/api/v1/coffee-dates/",
        description="List all coffee dates",
        suite=suite
    )
    
    if success:
        info(f"Found {len(data)} coffee dates")
        if len(data) > 0:
            suite.test_data["test_coffee_date_id"] = data[0].get("id")

# ==============================================================================
# Frontend Tests
# ==============================================================================
def test_frontend_pages(suite: TestSuite):
    """Test frontend page accessibility."""
    print_subheader("Frontend Pages")
    
    pages = [
        ("/", "Homepage"),
        ("/swipe", "Swipe page"),
        ("/matches", "Matches page"),
        ("/profile", "Profile page"),
        ("/onboarding", "Onboarding page"),
        ("/admin", "Admin page"),
        ("/coffee-dates", "Coffee dates page"),
    ]
    
    for path, name in pages:
        url = f"{FRONTEND_URL}{path}"
        try:
            response = requests.get(url, timeout=TIMEOUT, allow_redirects=True)
            # NextJS returns 200 for all pages (client-side routing)
            # Or might redirect to login (307/308)
            if response.status_code in [200, 307, 308]:
                pass_test(f"GET {path}", f"{name} - {response.status_code}")
                suite.add_result(TestResult(name=f"Frontend: {name}", passed=True, status_code=response.status_code))
            else:
                fail_test(f"GET {path}", f"{name} - Status {response.status_code}")
                suite.add_result(TestResult(name=f"Frontend: {name}", passed=False, status_code=response.status_code))
        except requests.exceptions.ConnectionError:
            fail_test(f"GET {path}", f"{name} - Connection refused")
            suite.add_result(TestResult(name=f"Frontend: {name}", passed=False, error="Connection refused"))
        except Exception as e:
            fail_test(f"GET {path}", str(e))
            suite.add_result(TestResult(name=f"Frontend: {name}", passed=False, error=str(e)))

def test_frontend_api_proxy(suite: TestSuite):
    """Test that frontend can proxy API requests."""
    print_subheader("Frontend API Proxy")
    
    # Test if the frontend's /api route can reach backend
    # Using /api/v1/skills/ as a simple unauthenticated endpoint
    url = f"{FRONTEND_URL}/api/v1/skills/"
    try:
        response = requests.get(url, timeout=TIMEOUT)
        if response.status_code == 200:
            pass_test("GET /api/v1/skills/ (via frontend)", "Frontend proxy working")
            suite.add_result(TestResult(name="Frontend API Proxy", passed=True, status_code=response.status_code))
        else:
            warn_test("GET /api/v1/skills/ (via frontend)", f"Status {response.status_code}")
            suite.add_result(TestResult(name="Frontend API Proxy", passed=False, status_code=response.status_code))
    except Exception as e:
        warn_test("GET /api/v1/skills/ (via frontend)", str(e))
        suite.add_result(TestResult(name="Frontend API Proxy", passed=False, error=str(e)))

# ==============================================================================
# Main Execution
# ==============================================================================
def print_summary(suite: TestSuite):
    """Print test summary."""
    print_header("Test Summary")
    
    print(f"\n{Colors.GREEN}Passed:{Colors.NC}  {suite.passed}")
    print(f"{Colors.RED}Failed:{Colors.NC}  {suite.failed}")
    print(f"{Colors.BLUE}Total:{Colors.NC}   {suite.total}")
    print()
    
    # Calculate pass rate
    if suite.total > 0:
        rate = (suite.passed / suite.total) * 100
        color = Colors.GREEN if rate >= 90 else (Colors.YELLOW if rate >= 70 else Colors.RED)
        print(f"Pass Rate: {color}{rate:.1f}%{Colors.NC}")
    
    # List failed tests
    failed = [r for r in suite.results if not r.passed]
    if failed:
        print(f"\n{Colors.RED}Failed Tests:{Colors.NC}")
        for r in failed:
            print(f"  • {r.name}: {r.error or 'Unknown error'}")
    
    # Overall status
    if suite.failed == 0:
        print(f"\n{Colors.GREEN}{'═' * 70}")
        print(f" 🎉 All tests passed! Your system is fully functional.")
        print(f"{'═' * 70}{Colors.NC}")
        return 0
    else:
        print(f"\n{Colors.RED}{'═' * 70}")
        print(f" ⛔ {suite.failed} test(s) failed. Please review the issues above.")
        print(f"{'═' * 70}{Colors.NC}")
        return 1

def main():
    print_header("FreshSwipe Comprehensive Endpoint Test Suite")
    
    info(f"Backend URL: {BASE_URL}")
    info(f"Frontend URL: {FRONTEND_URL}")
    info(f"Debug User ID: {DEBUG_USER_ID}")
    print()
    
    suite = TestSuite()
    
    # Attempt login if credentials provided
    login_admin(suite)
    
    # ========================================
    # Backend Tests
    # ========================================
    print_header("Backend API Tests")
    
    # First check if backend is reachable
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            fail_test("Backend health check", f"Status {response.status_code}")
            info("Backend may not be running. Starting tests anyway...")
    except requests.exceptions.ConnectionError:
        fail_test("Backend unreachable", "Is the backend server running?")
        print(f"\n{Colors.YELLOW}Tip: Start the server with:{Colors.NC}")
        print("  ./container/verify_local.sh")
        print(f"  OR")
        print(f"  cd backend && uvicorn app.main:app --reload")
        print()
        response = input("Continue with frontend tests only? (y/n) [n]: ").strip().lower()
        if response != "y":
            sys.exit(1)
    
    test_backend_health(suite)
    test_users_api(suite)
    test_skills_api(suite)
    test_swipes_api(suite)
    test_matches_api(suite)
    test_analytics_api(suite)
    test_coffee_dates_api(suite)
    
    # ========================================
    # Frontend Tests
    # ========================================
    print_header("Frontend Tests")
    
    try:
        requests.get(FRONTEND_URL, timeout=5)
        test_frontend_pages(suite)
        test_frontend_api_proxy(suite)
    except requests.exceptions.ConnectionError:
        warn_test("Frontend unreachable", f"Cannot connect to {FRONTEND_URL}")
        suite.add_result(TestResult(name="Frontend connectivity", passed=False, error="Connection refused"))
    
    # ========================================
    # Summary
    # ========================================
    exit_code = print_summary(suite)
    
    # Print helpful URLs
    print(f"\n{Colors.BLUE}Quick Access URLs:{Colors.NC}")
    print(f"  API Docs:     {BASE_URL}/docs")
    print(f"  Frontend:     {FRONTEND_URL}")
    print(f"  Health Check: {BASE_URL}/health")
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
