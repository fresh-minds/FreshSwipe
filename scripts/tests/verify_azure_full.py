#!/usr/bin/env python3
"""
Comprehensive Azure Verification Script for FreshSwipe
Performs end-to-end testing including Authentication, API Proxying, and Database Integrity.
"""
import sys
import os
import requests
import json
from dataclasses import dataclass

# Configuration
BASE_URL = os.getenv("APP_URL", "https://app-freshswipe-uni2.azurewebsites.net")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

if not ADMIN_EMAIL or not ADMIN_PASSWORD:
    print("Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set.")
    sys.exit(1)

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
    print_header(f"Verifying Deployment at {BASE_URL}")
    session = requests.Session()

    # 1. Public Health Check
    try:
        # Check standard Nginx health route
        resp = session.get(f"{BASE_URL}/health", timeout=10)
        if resp.status_code == 200 and resp.json().get("status") == "healthy":
            log_pass("Public Health Check (/health)")
        else:
            log_fail("Public Health Check", f"Status {resp.status_code}")
    except Exception as e:
        log_fail("Public Health Check", str(e))
        print("Cannot proceed if site is down.")
        sys.exit(1)

    # 2. CSRF Token Fetch
    csrf_token = None
    try:
        resp = session.get(f"{BASE_URL}/api/auth/csrf")
        if resp.status_code == 200:
            csrf_token = resp.json().get("csrfToken")
            log_pass(f"Fetch CSRF Token (Token found)")
        else:
            log_fail("Fetch CSRF Token", f"Status {resp.status_code}")
    except Exception as e:
        log_fail("Fetch CSRF Token", str(e))

    if not csrf_token:
        print("Skipping Login tests due to missing CSRF token.")
    else:
        # 3. Admin Login (Credentials)
        log_info(f"Attempting Login as {ADMIN_EMAIL}...")
        login_data = {
            "redirect": "false",
            "csrfToken": csrf_token,
            "callbackUrl": f"{BASE_URL}/",
            "json": "true",
            "email": ADMIN_EMAIL,  # NextAuth 'credentials' provider expects these fields
            "password": ADMIN_PASSWORD
        }
        
        try:
            # We must use x-www-form-urlencoded for NextAuth signin
            resp = session.post(
                f"{BASE_URL}/api/auth/callback/credentials",
                data=login_data,
                timeout=15
            )
            
            # NextAuth returns 200 JSON on success (if redirect=false) or 302
            # But here we might get a redirect.
            if resp.status_code == 200 or resp.status_code == 302:
                # Check cookies
                cookies = session.cookies.get_dict()
                has_token = any('next-auth.session-token' in k for k in cookies.keys()) or \
                           any('__Secure-next-auth.session-token' in k for k in cookies.keys())
                
                if has_token:
                    log_pass("Admin Login (Session Cookie established)")
                else:
                    log_fail("Admin Login", "No session cookie found after login")
                    print("Response body:", resp.text[:200])
            else:
                log_fail("Admin Login", f"Status {resp.status_code}")
        except Exception as e:
            log_fail("Admin Login", str(e))

    # 4. Protected Frontend Check
    try:
        # Check /admin page (Protected)
        resp = session.get(f"{BASE_URL}/admin")
        if resp.status_code == 200:
            log_pass("Protected Page (/admin) - Access Granted")
        elif resp.status_code in [307, 308]:
             # If redirected, it means auth failed
             log_fail("Protected Page (/admin)", f"Redirected to {resp.headers.get('Location')}")
        elif resp.status_code == 404:
             # NextJS sometimes returns 404 for non-existent routes, assume /admin exists
             log_fail("Protected Page (/admin)", "404 Not Found")
        else:
             log_fail("Protected Page (/admin)", f"Status {resp.status_code}")

        # Check Session API to see user details
        resp = session.get(f"{BASE_URL}/api/auth/session")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("user"):
                log_pass(f"Session API - Logged in as {data['user'].get('email')}")
            else:
                log_fail("Session API", "No user in session")
        else:
            log_fail("Session API", f"Status {resp.status_code}")

    except Exception as e:
        log_fail("Protected Access check", str(e))

    # 5. Data Seeding Check (Skills List)
    try:
        # Assuming we can list skills publically OR we are logged in
        resp = session.get(f"{BASE_URL}/api/v1/skills/")
        if resp.status_code == 200:
            skills = resp.json()
            if len(skills) > 5:
                log_pass(f"Data Seeding Check (Found {len(skills)} skills)")
            else:
                log_fail("Data Seeding Check", f"Only {len(skills)} skills found (Expected > 5)")
        else:
             # If skills require auth and we failed login, this fails too.
             log_info(f"Skills list returned {resp.status_code}")
    except Exception as e:
        log_fail("Skills List check", str(e))
        
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
