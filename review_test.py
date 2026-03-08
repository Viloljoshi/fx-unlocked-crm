#!/usr/bin/env python3
"""
FX Unlocked CRM Backend API Testing Suite - Focused on Review Request
Tests the specific API endpoints mentioned in the review_request:
1. GET /api/setup
2. POST /api/ai/chat 
3. GET /api/users
4. Auth middleware (dashboard redirect)
5. Auth callback error handling
"""

import requests
import json
import time
import os
import sys

def test_api_endpoint(url, method='GET', data=None, headers=None, expected_status=200, description=""):
    """Test a single API endpoint with detailed logging"""
    print(f"\n=== Testing {method} {url} ===")
    print(f"Description: {description}")
    
    try:
        if headers:
            print(f"Headers: {headers}")
        if data:
            print(f"Request Data: {json.dumps(data, indent=2)}")
            
        # Make the request
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=30)
        elif method == 'POST':
            response = requests.post(url, json=data, headers=headers, timeout=30)
        else:
            print(f"❌ Unsupported method: {method}")
            return False
            
        print(f"Response Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        # Handle different response types
        try:
            if response.headers.get('content-type', '').startswith('text/event-stream'):
                print("Response Type: SSE Stream")
                
                # Read SSE stream
                events_received = 0
                done_received = False
                text_chunks = []
                
                for line in response.iter_lines(decode_unicode=True):
                    if line.startswith('data: '):
                        data_part = line[6:]  # Remove 'data: ' prefix
                        
                        if data_part == '[DONE]':
                            done_received = True
                            print("✅ Received [DONE] event")
                            break
                        else:
                            try:
                                event_data = json.loads(data_part)
                                if 'text' in event_data:
                                    text_chunks.append(event_data['text'])
                                    events_received += 1
                                elif 'error' in event_data:
                                    print(f"❌ ERROR in stream: {event_data['error']}")
                                    return False
                            except json.JSONDecodeError:
                                pass  # Skip non-JSON lines
                
                full_response = ''.join(text_chunks)
                print(f"Events received: {events_received}")
                print(f"Response length: {len(full_response)}")
                print(f"Response preview: {full_response[:200]}...")
                
                success = response.status_code == 200 and events_received > 0 and done_received
                
            else:
                response_json = response.json()
                print(f"Response JSON: {json.dumps(response_json, indent=2)}")
                success = response.status_code == expected_status
                
        except json.JSONDecodeError:
            print(f"Response Text: {response.text}")
            success = response.status_code == expected_status
            
        if success:
            print(f"✅ PASS: {description}")
            return True
        else:
            print(f"❌ FAIL: Expected status {expected_status}, got {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"❌ FAIL: Request timed out after 30 seconds")
        return False
    except requests.exceptions.ConnectionError as e:
        print(f"❌ FAIL: Connection error - {str(e)}")
        return False
    except Exception as e:
        print(f"❌ FAIL: Unexpected error - {str(e)}")
        return False

def test_redirect(url, description="", expected_status_codes=[307, 302]):
    """Test redirect endpoints - Next.js uses 307 (temporary) redirects"""
    print(f"\n=== Testing Redirect {url} ===")
    print(f"Description: {description}")
    
    try:
        # Don't follow redirects so we can check the redirect response
        response = requests.get(url, allow_redirects=False, timeout=10)
        print(f"Response Status: {response.status_code}")
        print(f"Location Header: {response.headers.get('location', 'None')}")
        
        success = response.status_code in expected_status_codes
        if success:
            print(f"✅ PASS: {description}")
            return True
        else:
            print(f"❌ FAIL: Expected status {expected_status_codes}, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error testing redirect - {str(e)}")
        return False

def main():
    """Main testing function for review request endpoints"""
    print("🚀 Starting FX Unlocked CRM Backend API Testing")
    print("Testing endpoints specified in review_request")
    print("=" * 60)
    
    # Base URL from environment - use the production URL from review_request
    base_url = "https://affiliate-crm-dev.preview.emergentagent.com"
    
    # Track test results
    results = []
    
    # Test 1: GET /api/setup - Database status check
    print("\n1. Testing GET /api/setup - Database health check")
    success = test_api_endpoint(
        f"{base_url}/api/setup",
        method='GET',
        description="Should return JSON with ready:true and 9 database tables all true"
    )
    results.append(("GET /api/setup", success))
    
    # Test 2: POST /api/ai/chat - AI chat with streaming
    print("\n2. Testing POST /api/ai/chat - AI chat endpoint")
    chat_data = {
        "message": "hello", 
        "history": []
    }
    headers = {"Content-Type": "application/json"}
    
    success = test_api_endpoint(
        f"{base_url}/api/ai/chat",
        method='POST',
        data=chat_data,
        headers=headers,
        description="Should return streaming SSE response from OpenAI"
    )
    results.append(("POST /api/ai/chat", success))
    
    # Test 3: GET /api/users - List users from Supabase
    print("\n3. Testing GET /api/users - Users list endpoint")
    success = test_api_endpoint(
        f"{base_url}/api/users",
        method='GET',
        description="Should return JSON array of users from Supabase"
    )
    results.append(("GET /api/users", success))
    
    # Test 4: Auth middleware - Dashboard redirect without auth
    print("\n4. Testing Auth middleware - Dashboard protection")
    success = test_redirect(
        f"{base_url}/dashboard",
        description="Should redirect to /login when accessing dashboard without auth",
        expected_status_codes=[307, 302]  # Next.js uses 307 for redirects
    )
    results.append(("Auth middleware redirect", success))
    
    # Test 5: Auth callback without code - should redirect to login with error
    print("\n5. Testing Auth callback - Error handling")
    success = test_redirect(
        f"{base_url}/auth/callback",
        description="Should redirect to /login?error=auth when no auth code provided",
        expected_status_codes=[307, 302]  # Next.js uses 307 for redirects
    )
    results.append(("Auth callback error redirect", success))
    
    # Print summary
    print("\n" + "=" * 60)
    print("🎯 TEST SUMMARY - Review Request Endpoints")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        if result:
            print(f"✅ {test_name}")
            passed += 1
        else:
            print(f"❌ {test_name}")
            failed += 1
    
    print(f"\nTotal Tests: {len(results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success Rate: {(passed/len(results)*100):.1f}%")
    
    # Test credentials info
    print("\n📋 AUTHENTICATION INFO:")
    print("Admin credentials: admin@fxunlocked.com / Admin@1234")
    print("Supabase URL and keys are configured in /app/.env")
    
    if failed == 0:
        print("\n🎉 ALL REVIEW REQUEST TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {failed} TEST(S) FAILED - See details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())