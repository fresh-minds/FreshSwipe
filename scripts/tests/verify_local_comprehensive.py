#!/usr/bin/env python3
"""
Comprehensive Local Verification Script for FreshSwipe
Performs end-to-end testing of Health, Auth, and swiping on Colleagues.
"""
import sys
import os
import requests
import json
import time
from dataclasses import dataclass

# Configuration
BASE_URL = "http://localhost:8081"
ADMIN_EMAIL = "admin@freshminds.nl"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'

@dataclass
class TestResult:
    name: str
    passed: bool
    details: str = ""

results = []

def print_header(text):
    print(f"\n{Colors.BLUE}{'='*60}\n {text}\n{'='*60}{Colors.NC}")

def log_pass(text):
    print(f"{Colors.GREEN}✅ PASS:{Colors.NC} {text}")
    results.append(TestResult(text, True))

def log_fail(text, error=""):
    print(f"{Colors.RED}❌ FAIL:{Colors.NC} {text} - {error}")
    results.append(TestResult(text, False, error))

def log_info(text):
    print(f"{Colors.YELLOW}ℹ️  INFO:{Colors.NC} {text}")

def main():
    print_header(f"Verifying Local Deployment at {BASE_URL}")
    session = requests.Session()
    auth_header = {}

    # 1. Public Health Check
    try:
        resp = session.get(f"{BASE_URL}/health", timeout=10)
        if resp.status_code == 200:
            log_pass("Public Health Check (/health)")
        else:
            log_fail("Public Health Check", f"Status {resp.status_code}")
    except Exception as e:
        log_fail("Public Health Check", str(e))
        print("Cannot proceed if site is down.")
        sys.exit(1)

    # 2. CSRF & Login
    csrf_token = None
    try:
        resp = session.get(f"{BASE_URL}/api/auth/csrf")
        if resp.status_code == 200:
            csrf_token = resp.json().get("csrfToken")
            log_pass(f"Fetch CSRF Token")
        else:
            log_fail("Fetch CSRF Token", f"Status {resp.status_code}")
    except Exception as e:
        log_fail("Fetch CSRF Token", str(e))

    if csrf_token:
        if not ADMIN_PASSWORD:
            log_fail("Admin Login", "ADMIN_PASSWORD is not set")
            sys.exit(1)
        log_info(f"Attempting Login as {ADMIN_EMAIL}...")
        login_data = {
            "redirect": "false",
            "csrfToken": csrf_token,
            "callbackUrl": f"{BASE_URL}/",
            "json": "true",
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        try:
            resp = session.post(
                f"{BASE_URL}/api/auth/callback/credentials",
                data=login_data,
                timeout=15
            )
            if resp.status_code == 200 or resp.status_code == 302:
                cookies = session.cookies.get_dict()
                has_token = any('next-auth.session-token' in k for k in cookies.keys()) or \
                           any('__Secure-next-auth.session-token' in k for k in cookies.keys())
                
                if has_token:
                    log_pass("Admin Login (Session Established)")
                    token = cookies.get("next-auth.session-token") or cookies.get("__Secure-next-auth.session-token")
                    if token:
                        auth_header = {"Authorization": f"Bearer {token}"}
                else:
                    log_fail("Admin Login", "No session cookie found")
            else:
                log_fail("Admin Login", f"Status {resp.status_code}")
        except Exception as e:
            log_fail("Admin Login", str(e))

    # 3. Fetch Candidates (Swiping Feature)
    candidates = []
    try:
        # Backend API direct access (proxied via Nginx)
        resp = session.get(f"{BASE_URL}/api/v1/users/candidates", headers=auth_header)
        if resp.status_code == 200:
            candidates = resp.json()
            if len(candidates) > 0:
                log_pass(f"Fetch Candidates (Found {len(candidates)} colleagues)")
                log_info(f"First candidate: {candidates[0]['name']}")
            else:
                log_fail("Fetch Candidates", "No candidates returned")
        else:
            log_fail("Fetch Candidates", f"Status {resp.status_code}")
    except Exception as e:
        log_fail("Fetch Candidates", str(e))

    # 4. Perform Swipe
    if candidates:
        target_user = candidates[0]
        log_info(f"Swiping RIGHT on {target_user['name']}...")
        
        # We need to manually construct the User ID because we are using endpoints.
        # In a real app the session handles this, but here we'll use the API directly or mimic the session ID.
        # Ideally, we should use the session user's ID. 
        # But we logged in as Admin, so let's try to just use the API with explicit IDs like the frontend does.
        # Wait, the backend endpoint expects specific User IDs in the body if we use the POST /swipes/ endpoint.
        # The Admin user ID is 'd66c62ab-c940-40d0-ab54-e2cf77930de0' (from seed_data) OR 'oid-admin'.
        
        swipe_payload = {
            "user_id": "oid-admin", # Using string ID as we just enabled support for it
            "target_user_id": target_user['id'],
            "direction": "right"
        }
        
        try:
            resp = session.post(f"{BASE_URL}/api/v1/swipes/", json=swipe_payload, headers=auth_header)
            if resp.status_code == 201:
                log_pass("Create Swipe (Action Successful)")
                swipe_data = resp.json()
                log_info(f"Swipe ID: {swipe_data['id']}")
            else:
                log_fail("Create Swipe", f"Status {resp.status_code} - {resp.text}")
        except Exception as e:
            log_fail("Create Swipe", str(e))

    # Summary
    print_header("Test Summary")
    passed_count = sum(1 for r in results if r.passed)
    total_count = len(results)
    
    if total_count == passed_count and total_count > 0:
        print(f"{Colors.GREEN}ALL TESTS PASSED ({passed_count}/{total_count}){Colors.NC}")
        sys.exit(0)
    else:
        print(f"{Colors.RED}SOME TESTS FAILED ({total_count - passed_count}/{total_count}){Colors.NC}")
        sys.exit(1)

if __name__ == "__main__":
    main()
