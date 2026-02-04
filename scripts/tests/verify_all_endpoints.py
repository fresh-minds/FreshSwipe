#!/usr/bin/env python3
"""
Verify ALL Endpoints Script
Iterates through all critical API endpoints to check for 500 errors.
"""
import requests
import sys
import os

BASE_URL = "http://localhost:8081"
ADMIN_EMAIL = "admin@freshminds.nl"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

session = requests.Session()
auth_header = {}

def login():
    print(f"🔑 Logging in as {ADMIN_EMAIL}...")
    if not ADMIN_PASSWORD:
        print("❌ ADMIN_PASSWORD is not set.")
        sys.exit(1)
    try:
        # Fetch CSRF
        resp = session.get(f"{BASE_URL}/api/auth/csrf")
        csrf = resp.json().get("csrfToken")
        
        # Login
        resp = session.post(
            f"{BASE_URL}/api/auth/callback/credentials",
            data={
                "redirect": "false",
                "csrfToken": csrf,
                "callbackUrl": f"{BASE_URL}/",
                "json": "true",
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        if resp.status_code not in [200, 302]:
            print(f"❌ Login Failed: {resp.status_code}")
            sys.exit(1)
        print("✅ Login Successful")

        # Use NextAuth session token as bearer token for backend API
        cookies = session.cookies.get_dict()
        token = cookies.get("next-auth.session-token") or cookies.get("__Secure-next-auth.session-token")
        if token:
            global auth_header
            auth_header = {"Authorization": f"Bearer {token}"}
    except Exception as e:
        print(f"❌ Login Exception: {e}")
        sys.exit(1)

def check_endpoint(method, url, payload=None):
    full_url = f"{BASE_URL}{url}"
    try:
        if method == "GET":
            resp = session.get(full_url, headers=auth_header)
        else:
            resp = session.post(full_url, json=payload, headers=auth_header)
        
        if resp.status_code >= 500:
            print(f"❌ {method} {url} -> {resp.status_code} (Internal Server Error)")
            return False
        elif resp.status_code >= 400:
             # 400s might be expected for some bad requests, but let's log them to be safe
             # For this test, we care most about crashing (500s)
            print(f"⚠️  {method} {url} -> {resp.status_code}")
            return True
        else:
            print(f"✅ {method} {url} -> {resp.status_code}")
            return True
            
    except Exception as e:
        print(f"❌ {method} {url} -> Exception: {e}")
        return False

def main():
    login()
    
    # We need a valid User ID for some tests. Admin usually has 'oid-admin' or UUID
    # We'll fetch the profile to get the ID
    profile_resp = session.get(f"{BASE_URL}/api/v1/users/me", headers=auth_header)
    if profile_resp.status_code == 200:
        my_id = profile_resp.json().get("id")
        print(f"ℹ️  My User ID: {my_id}")
    else:
        print("❌ Could not fetch profile")
        my_id = "oid-admin" # Fallback

    # Endpoints to test
    endpoints = [
        ("GET", "/api/v1/users/me"),
        ("GET", "/api/v1/users/candidates"),
        # Matches
        ("GET", "/api/v1/matches/"),
        ("GET", f"/api/v1/matches/user/{my_id}"),
        ("GET", "/api/v1/matches/stats"), 
        # Swipes
        ("GET", f"/api/v1/swipes/user/{my_id}"),
        ("GET", f"/api/v1/swipes/user/{my_id}/interests"),
        # Coffee Dates
        ("GET", f"/api/v1/coffee-dates/user/{my_id}"),
        # Skills (Public mostly, but check anyway)
        ("GET", "/api/v1/skills/"),
        ("GET", "/api/v1/skills/categories"),
        # Analytics (Admin only usually)
        ("GET", "/api/v1/analytics/dashboard"),
    ]
    
    failures = 0
    for method, url in endpoints:
        if not check_endpoint(method, url):
            failures += 1
            
    # Specific check for Soft Skills
    print("\n----------------------------------------------------------------")
    print("Verifying 'Soft Skills' Category...")
    try:
        resp = session.get(f"{BASE_URL}/api/v1/skills/categories", headers=auth_header)
        if resp.status_code == 200:
            cats = resp.json()
            if "Soft Skills" in cats:
                print("✅ 'Soft Skills' category successfully added!")
            else:
                print(f"❌ 'Soft Skills' category MISSING. Found: {cats}")
                failures += 1
        else:
            print(f"❌ Failed to fetch categories: {resp.status_code}")
            failures += 1
    except Exception as e:
        print(f"❌ Exception checking skills: {e}")
        failures += 1

    if failures > 0:
        print(f"\n❌ FOUND {failures} BROKEN ENDPOINTS (500 ERRORS)")
        sys.exit(1)
    else:
        print("\n✅ ALL CHECKED ENDPOINTS OPERATIONAL")

if __name__ == "__main__":
    main()
