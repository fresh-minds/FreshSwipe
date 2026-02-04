#!/usr/bin/env python3
import sys
import os
import time
import subprocess
import argparse
import requests
from requests.exceptions import ConnectionError

# Configuration
BACKEND_URL = "http://localhost:8081"  # Unified container default
BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "app", "backend")

def print_header(title):
    print("\n" + "=" * 60)
    print(f" {title}")
    print("=" * 60)

def check_backend_health():
    print_header("checking Backend Health")
    health_url = f"{BACKEND_URL}/health"
    print(f"Testing connectivity to: {health_url}")
    
    try:
        response = requests.get(health_url, timeout=5)
        if response.status_code == 200:
            print("✅ Backend is UP and running!")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Backend returned status code: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except ConnectionError:
        print("❌ Could not connect to the backend.")
        print("   Is the unified container running? (Try: ./container/verify_local.sh)")
        return False
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
        return False

def run_backend_tests():
    print_header("Running Backend Tests")
    print(f"Test directory: {BACKEND_DIR}")
    
    if not os.path.exists(BACKEND_DIR):
        print(f"❌ Backend directory not found at: {BACKEND_DIR}")
        return False

    # Check for pytest
    try:
        subprocess.run(["pytest", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("❌ 'pytest' is not installed or not in PATH.")
        print("   Please install requirements: pip install -r app/backend/requirements.txt")
        return False

    print("Running pytest... (this may take a moment)\n")
    
    # Run pytest in the backend directory
    # We rely on the 'pytest' command being in the PATH (verified above)
    cmd = ["pytest", "tests"]
    
    try:
        result = subprocess.run(cmd, cwd=BACKEND_DIR, text=True)
        
        if result.returncode == 0:
            print("\n✅ All tests PASSED!")
            return True
        else:
            print("\n❌ Some tests FAILED.")
            print("\n💡 Tip: If you see 'ModuleNotFoundError', try installing dependencies:")
            print(f"      pip install -r {os.path.join('app', 'backend', 'requirements.txt')}")
            return False
    except Exception as e:
        print(f"\n❌ Failed to run tests: {e}")
        return False

def main():
    print_header("System Verification Script")
    
    # 1. Check if Server is running
    server_running = check_backend_health()
    
    print("\n" + "-" * 60)
    
    # 2. Ask to run tests
    if server_running:
        print("Since the server is running, you might also want to run the full test suite.")
    else:
        print("The server appears to be DOWN.")
        print("You can still run the internal unit/integration tests.")

    parser = argparse.ArgumentParser(description="Verify backend health and optionally run tests.")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Run the full backend test suite without prompting.",
    )
    args = parser.parse_args()

    auto_yes = args.yes or os.getenv("VERIFY_SYSTEM_YES", "").lower() in {"1", "true", "yes", "y"}

    if auto_yes:
        response = "y"
        print("\nDo you want to run the full backend test suite? (y/n) [y]: y")
    else:
        response = input("\nDo you want to run the full backend test suite? (y/n) [y]: ").strip().lower()
    
    if response == "" or response == "y" or response == "yes":
        run_tests = run_backend_tests()
        
        print_header("Summary")
        print(f"Server Status: {'✅ UP' if server_running else '❌ DOWN'}")
        print(f"Test Results:  {'✅ PASSED' if run_tests else '❌ FAILED'}")
        
        if not server_running:
             print("\nNote: Unit tests can pass even if the server is not running.")
             
        if server_running and run_tests:
            print("\n🎉 Everything seems to be working perfectly!")
        
        sys.exit(0 if (server_running or run_tests) else 1)
    else:
        print("\nSkipping tests.")
        print_header("Summary")
        print(f"Server Status: {'✅ UP' if server_running else '❌ DOWN'}")
        sys.exit(0 if server_running else 1)

if __name__ == "__main__":
    main()
