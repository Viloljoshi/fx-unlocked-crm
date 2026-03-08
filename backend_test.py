#!/usr/bin/env python3
"""
Backend API Testing Script for FX Unlocked CRM
Tests Supabase-based Next.js API routes
"""

import requests
import json
import time
import os
from uuid import uuid4

# Get base URL from environment
BASE_URL = "https://affiliate-crm-dev.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def test_get_setup():
    """Test GET /api/setup - Database status check"""
    print("Testing GET /api/setup...")
    try:
        response = requests.get(f"{API_BASE}/setup", timeout=30)
        print(f"Setup Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Setup Response: {json.dumps(data, indent=2)}")
            
            # Check if response has expected structure
            if 'ready' in data and 'tables' in data:
                ready = data['ready']
                tables = data['tables']
                
                print(f"Database Ready: {ready}")
                print("Table Status:")
                for table, status in tables.items():
                    print(f"  {table}: {status}")
                
                # Expected 9 tables
                expected_tables = [
                    'profiles', 'brokers', 'affiliates', 'commissions', 
                    'affiliate_notes', 'appointments', 'staff_kpis', 
                    'company_kpis', 'audit_logs'
                ]
                
                all_tables_exist = all(table in tables for table in expected_tables)
                all_tables_ready = all(tables.get(table, False) for table in expected_tables)
                
                print(f"All Expected Tables Exist: {all_tables_exist}")
                print(f"All Tables Ready: {all_tables_ready}")
                
                if ready and all_tables_ready:
                    print("✅ GET /api/setup - SUCCESS: Database fully ready")
                    return True
                else:
                    print("❌ GET /api/setup - FAILED: Database not fully ready")
                    if 'migrationSQL' in data:
                        print("Migration SQL provided - tables need to be created")
                    return False
            else:
                print("❌ GET /api/setup - FAILED: Invalid response structure")
                return False
        else:
            print(f"❌ GET /api/setup - FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ GET /api/setup - ERROR: {e}")
        return False
    except Exception as e:
        print(f"❌ GET /api/setup - UNEXPECTED ERROR: {e}")
        return False

def test_post_ai_chat():
    """Test POST /api/ai/chat - AI chat with OpenAI streaming"""
    print("\nTesting POST /api/ai/chat...")
    try:
        payload = {
            "message": "How many affiliates do we have?",
            "history": []
        }
        
        response = requests.post(
            f"{API_BASE}/ai/chat", 
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=60,
            stream=True
        )
        
        print(f"AI Chat Status Code: {response.status_code}")
        
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            print(f"Content-Type: {content_type}")
            
            if 'text/event-stream' in content_type:
                print("✅ Received SSE stream")
                
                # Read and parse SSE events
                events_received = 0
                text_chunks = []
                done_received = False
                
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
                                    print(f"❌ AI Chat - ERROR in stream: {event_data['error']}")
                                    return False
                            except json.JSONDecodeError:
                                print(f"Warning: Could not parse SSE data: {data_part}")
                
                full_response = ''.join(text_chunks)
                print(f"Events received: {events_received}")
                print(f"Full response length: {len(full_response)}")
                print(f"Response preview: {full_response[:200]}...")
                
                if events_received > 0 and done_received and len(full_response) > 0:
                    print("✅ POST /api/ai/chat - SUCCESS: Valid streaming response")
                    return True
                else:
                    print("❌ POST /api/ai/chat - FAILED: Invalid or empty streaming response")
                    return False
            else:
                print(f"❌ POST /api/ai/chat - FAILED: Wrong content type, expected text/event-stream")
                return False
        else:
            print(f"❌ POST /api/ai/chat - FAILED: HTTP {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error response: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Raw response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ POST /api/ai/chat - ERROR: {e}")
        return False
    except Exception as e:
        print(f"❌ POST /api/ai/chat - UNEXPECTED ERROR: {e}")
        return False

def test_post_users_invite():
    """Test POST /api/users/invite - Invite user via Supabase admin"""
    print("\nTesting POST /api/users/invite...")
    try:
        # Generate a unique test email
        test_email = f"test-{uuid4().hex[:8]}@fxunlocked.com"
        
        payload = {
            "email": test_email,
            "role": "STAFF"
        }
        
        response = requests.post(
            f"{API_BASE}/users/invite",
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        print(f"User Invite Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Invite Response: {json.dumps(data, indent=2)}")
            
            if 'success' in data and data['success']:
                print(f"✅ POST /api/users/invite - SUCCESS: User invited ({test_email})")
                return True
            else:
                print("❌ POST /api/users/invite - FAILED: Success not confirmed")
                return False
        else:
            print(f"❌ POST /api/users/invite - FAILED: HTTP {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error response: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Raw response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ POST /api/users/invite - ERROR: {e}")
        return False
    except Exception as e:
        print(f"❌ POST /api/users/invite - UNEXPECTED ERROR: {e}")
        return False

def test_auth_callback():
    """Test GET /api/auth/callback - Auth callback route"""
    print("\nTesting GET /auth/callback...")
    try:
        # Test without code (should redirect to login with error)
        response = requests.get(
            f"{BASE_URL}/auth/callback",
            allow_redirects=False,
            timeout=30
        )
        
        print(f"Auth Callback Status Code: {response.status_code}")
        
        if response.status_code == 302:  # Redirect
            location = response.headers.get('location', '')
            print(f"Redirect location: {location}")
            
            if '/login?error=auth' in location:
                print("✅ GET /auth/callback - SUCCESS: Correctly redirects to login with error")
                return True
            else:
                print("❌ GET /auth/callback - FAILED: Unexpected redirect location")
                return False
        else:
            print(f"❌ GET /auth/callback - FAILED: Expected redirect (302), got {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ GET /auth/callback - ERROR: {e}")
        return False
    except Exception as e:
        print(f"❌ GET /auth/callback - UNEXPECTED ERROR: {e}")
        return False

def test_middleware_protection():
    """Test middleware protection for dashboard routes"""
    print("\nTesting middleware protection...")
    try:
        # Test accessing dashboard without auth (should redirect to login)
        response = requests.get(
            f"{BASE_URL}/dashboard",
            allow_redirects=False,
            timeout=30
        )
        
        print(f"Dashboard Access Status Code: {response.status_code}")
        
        if response.status_code == 302:  # Redirect
            location = response.headers.get('location', '')
            print(f"Redirect location: {location}")
            
            if '/login' in location:
                print("✅ Middleware Protection - SUCCESS: Correctly redirects to login")
                return True
            else:
                print("❌ Middleware Protection - FAILED: Unexpected redirect location")
                return False
        elif response.status_code == 200:
            print("❌ Middleware Protection - FAILED: Dashboard accessible without auth")
            return False
        else:
            print(f"❌ Middleware Protection - FAILED: Unexpected status {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Middleware Protection - ERROR: {e}")
        return False
    except Exception as e:
        print(f"❌ Middleware Protection - UNEXPECTED ERROR: {e}")
        return False

def test_invalid_routes():
    """Test invalid API routes return appropriate errors"""
    print("\nTesting invalid routes...")
    try:
        # Test non-existent API route
        response = requests.get(f"{API_BASE}/nonexistent", timeout=30)
        print(f"Invalid Route Status Code: {response.status_code}")
        
        if response.status_code == 404:
            print("✅ Invalid Routes - SUCCESS: 404 for non-existent routes")
            return True
        else:
            print(f"❌ Invalid Routes - FAILED: Expected 404, got {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Invalid Routes - ERROR: {e}")
        return False
    except Exception as e:
        print(f"❌ Invalid Routes - UNEXPECTED ERROR: {e}")
        return False

def main():
    """Run all backend API tests"""
    print("🚀 Starting FX Unlocked CRM Backend API Tests")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print("=" * 60)
    
    test_results = {}
    
    # Run all tests
    test_results['setup'] = test_get_setup()
    test_results['ai_chat'] = test_post_ai_chat()
    test_results['user_invite'] = test_post_users_invite()
    test_results['auth_callback'] = test_auth_callback()
    test_results['middleware'] = test_middleware_protection()
    test_results['invalid_routes'] = test_invalid_routes()
    
    print("\n" + "=" * 60)
    print("📊 BACKEND API TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:<20} {status}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL BACKEND API TESTS PASSED!")
        return True
    else:
        print(f"⚠️  {total - passed} tests failed")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)