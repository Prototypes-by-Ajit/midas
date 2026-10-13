"""
Integration test script for Backend API + Supabase.

Tests the full flow:
1. Create session
2. Send messages
3. Retrieve messages
4. Get cache
5. Delete session
"""
import asyncio
import httpx
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"
TEST_USER_ID = f"test_user_{datetime.utcnow().timestamp()}"


async def test_full_integration():
    """Test complete session lifecycle."""
    
    async with httpx.AsyncClient() as client:
        print("🧪 Starting Integration Tests\n")
        
        # ============================================
        # 1. Create Session
        # ============================================
        print("1️⃣  Creating new session...")
        response = await client.post(
            f"{BASE_URL}/sessions",
            json={
                "user_id": TEST_USER_ID,
                "title": "Integration Test Chat",
                "context": {"test": True}
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        session_data = response.json()
        session_id = session_data["id"]
        print(f"   ✅ Session created: {session_id}\n")
        
        # ============================================
        # 2. List Sessions
        # ============================================
        print("2️⃣  Listing user sessions...")
        response = await client.get(
            f"{BASE_URL}/sessions",
            params={"user_id": TEST_USER_ID}
        )
        assert response.status_code == 200
        sessions = response.json()
        print(f"   ✅ Found {sessions['total']} session(s)\n")
        
        # ============================================
        # 3. Send User Message
        # ============================================
        print("3️⃣  Sending user message...")
        response = await client.post(
            f"{BASE_URL}/sessions/{session_id}/messages",
            params={
                "role": "user",
                "content": "Hello, this is a test message!",
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 200
        user_msg = response.json()
        print(f"   ✅ User message sent: {user_msg['id']}\n")
        
        # ============================================
        # 4. Send Assistant Message
        # ============================================
        print("4️⃣  Sending assistant message...")
        response = await client.post(
            f"{BASE_URL}/sessions/{session_id}/messages",
            params={
                "role": "assistant",
                "content": "Hello! I received your test message.",
                "user_id": TEST_USER_ID
            },
            json={
                "confidence": 0.95,
                "route": "answer"
            }
        )
        assert response.status_code == 200
        assistant_msg = response.json()
        print(f"   ✅ Assistant message sent: {assistant_msg['id']}\n")
        
        # ============================================
        # 5. Retrieve Messages
        # ============================================
        print("5️⃣  Retrieving messages...")
        response = await client.get(
            f"{BASE_URL}/sessions/{session_id}/messages"
        )
        assert response.status_code == 200
        messages = response.json()
        print(f"   ✅ Retrieved {messages['total']} message(s)")
        for msg in messages['messages']:
            print(f"      - {msg['role']}: {msg['content'][:50]}...")
        print()
        
        # ============================================
        # 6. Get Session Details
        # ============================================
        print("6️⃣  Getting session details...")
        response = await client.get(f"{BASE_URL}/sessions/{session_id}")
        assert response.status_code == 200
        session = response.json()
        print(f"   ✅ Session: {session['title']}")
        print(f"      Messages: {session['message_count']}")
        print(f"      Last activity: {session.get('last_message_at', 'N/A')}\n")
        
        # ============================================
        # 7. Get Cache (if edge function available)
        # ============================================
        print("7️⃣  Getting session cache...")
        try:
            response = await client.get(
                f"{BASE_URL}/sessions/{session_id}/cache",
                params={"limit": 5, "include_summary": False}
            )
            if response.status_code == 200:
                cache = response.json()
                if "error" not in cache:
                    print(f"   ✅ Cache retrieved")
                    print(f"      Cached: {cache.get('cached', False)}")
                    print(f"      Messages: {len(cache.get('recent_messages', []))}")
                else:
                    print(f"   ⚠️  Cache error: {cache['error']}")
            else:
                print(f"   ⚠️  Cache unavailable (status {response.status_code})")
        except Exception as e:
            print(f"   ⚠️  Cache not available: {e}")
        print()
        
        # ============================================
        # 8. Update Session
        # ============================================
        print("8️⃣  Updating session title...")
        response = await client.patch(
            f"{BASE_URL}/sessions/{session_id}",
            params={"title": "Updated Test Chat"}
        )
        assert response.status_code == 200
        updated = response.json()
        print(f"   ✅ Title updated: {updated['title']}\n")
        
        # ============================================
        # 9. Delete Session
        # ============================================
        print("9️⃣  Deleting session...")
        response = await client.delete(f"{BASE_URL}/sessions/{session_id}")
        assert response.status_code == 200
        print(f"   ✅ Session deleted\n")
        
        # ============================================
        # 10. Verify Deletion
        # ============================================
        print("🔟 Verifying deletion...")
        response = await client.get(f"{BASE_URL}/sessions/{session_id}")
        assert response.status_code == 404, "Session should be deleted"
        print(f"   ✅ Session confirmed deleted\n")
        
        print("=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)


async def test_error_cases():
    """Test error handling."""
    print("\n🧪 Testing Error Cases\n")
    
    async with httpx.AsyncClient() as client:
        # Non-existent session
        print("1️⃣  Testing non-existent session...")
        response = await client.get(f"{BASE_URL}/sessions/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404
        print("   ✅ 404 returned for non-existent session\n")
        
        # Invalid message role
        print("2️⃣  Testing invalid message role...")
        session_resp = await client.post(
            f"{BASE_URL}/sessions",
            json={"user_id": TEST_USER_ID, "title": "Error Test"}
        )
        session_id = session_resp.json()["id"]
        
        response = await client.post(
            f"{BASE_URL}/sessions/{session_id}/messages",
            params={
                "role": "invalid_role",
                "content": "Test",
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 400
        print("   ✅ 400 returned for invalid role\n")
        
        # Cleanup
        await client.delete(f"{BASE_URL}/sessions/{session_id}")
        
        print("✅ Error handling tests passed!\n")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("BACKEND API + SUPABASE INTEGRATION TESTS")
    print("=" * 60 + "\n")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_USER_ID}\n")
    
    try:
        # Run integration tests
        asyncio.run(test_full_integration())
        
        # Run error case tests
        asyncio.run(test_error_cases())
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nMake sure:")
        print("  1. Backend is running: uvicorn app.main_agent:app --reload")
        print("  2. Supabase is configured in .env")
        print("  3. Migrations are applied")
        exit(1)
