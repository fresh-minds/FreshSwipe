import requests
import os
import json

# Configuration
API_URL = "http://localhost:8081/api/v1"
# Using a known user email from seed data or created previously
EMAIL = "karel.goense@freshminds.nl" 
PASSWORD = "admin" # Assuming default or known password

def test_auto_match():
    """Call auto-match endpoint without token (relying on DEBUG_USER_ID)."""
    print("\nCalling /coffee-dates/auto-match...")
    try:
        response = requests.post(f"{API_URL}/coffee-dates/auto-match")
        print(f"Status Code: {response.status_code}")
        try:
            print("Response Response:")
            print(json.dumps(response.json(), indent=2))
        except:
            print("Raw Response:", response.text)
    except Exception as e:
        print(f"Request error: {e}")

if __name__ == "__main__":
    test_auto_match()
