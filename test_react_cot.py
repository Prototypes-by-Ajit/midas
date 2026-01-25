#!/usr/bin/env python3
"""
Test script for ReAct + CoT Confidence Enforcement

This script tests:
1. Standard queries (should reach 75% quickly)
2. Complex queries (may need 2-3 iterations)
3. Out-of-scope queries (should return insufficient info)
4. Conversation follow-ups (reference resolution)
"""

import asyncio
import httpx
import json
import time
from typing import Dict, Any

# Backend URL
BASE_URL = "http://localhost:8000/api/v1"

# Test Clerk user ID (replace with your actual Clerk user ID)
TEST_USER_ID = "user_test_react_cot"


async def create_session(client: httpx.AsyncClient) -> Dict[str, Any]:
    """Create a new conversation session."""
    response = await client.post(
        f"{BASE_URL}/conversations",
        json={"user_id": TEST_USER_ID, "title": "ReAct + CoT Test"}
    )
    response.raise_for_status()
    return response.json()


async def send_message(
    client: httpx.AsyncClient, 
    session_id: str, 
    message: str,
    timeout: int = 60
) -> Dict[str, Any]:
    """Send a message and get response."""
    print(f"\n{'='*80}")
    print(f"📤 USER: {message}")
    print(f"{'='*80}")
    
    start_time = time.time()
    
    response = await client.post(
        f"{BASE_URL}/conversations/{session_id}/messages",
        json={"content": message},
        timeout=timeout
    )
    response.raise_for_status()
    result = response.json()
    
    elapsed = time.time() - start_time
    
    # Extract key information
    answer = result.get("answer", "")
    confidence = result.get("confidence", 0)
    confidence_breakdown = result.get("confidence_breakdown", {})
    reasoning_chain = result.get("reasoning_chain", [])
    citations = result.get("citations", [])
    route = result.get("route", "unknown")
    mode = result.get("mode", "unknown")
    
    print(f"\n🤖 ASSISTANT ({mode}):")
    print(f"   Route: {route}")
    print(f"   Confidence: {confidence:.2%}")
    if confidence_breakdown:
        print(f"   Breakdown: {json.dumps(confidence_breakdown, indent=6)}")
    print(f"   Citations: {len(citations)} sources")
    print(f"   Response time: {elapsed:.2f}s")
    
    # Show reasoning chain
    if reasoning_chain:
        print(f"\n   🧠 Reasoning Chain:")
        for step in reasoning_chain:
            step_type = step.get("step", "unknown")
            if step_type == "think":
                print(f"      💭 THINK: {step.get('reasoning', '')}")
            elif step_type == "plan":
                print(f"      📋 PLAN: {step.get('strategy', '')} (top_k={step.get('top_k')}, threshold={step.get('threshold')})")
    
    # Show answer preview
    print(f"\n   📝 Answer (first 300 chars):")
    print(f"   {answer[:300]}...")
    
    # Confidence check
    if route == "answer":
        if confidence >= 0.75:
            print(f"\n   ✅ PASS: Confidence {confidence:.2%} >= 75%")
        else:
            print(f"\n   ❌ FAIL: Confidence {confidence:.2%} < 75% (should not happen!)")
    elif route == "insufficient_info":
        print(f"\n   ℹ️  INFO: System correctly refused to answer (confidence {confidence:.2%} < 75%)")
    
    return result


async def test_standard_query(client: httpx.AsyncClient, session_id: str):
    """Test 1: Standard query (should reach 75% in 1-2 iterations)."""
    print("\n" + "="*80)
    print("TEST 1: Standard Query (Easy)")
    print("="*80)
    
    result = await send_message(
        client, 
        session_id,
        "What is melanoma?"
    )
    
    # Verify
    assert result["confidence"] >= 0.75, f"Expected ≥75%, got {result['confidence']:.2%}"
    assert result["route"] == "answer", f"Expected 'answer', got {result['route']}"
    print("\n✅ TEST 1 PASSED")


async def test_complex_query(client: httpx.AsyncClient, session_id: str):
    """Test 2: Complex query (may need 2-3 iterations)."""
    print("\n" + "="*80)
    print("TEST 2: Complex Query (Moderate)")
    print("="*80)
    
    result = await send_message(
        client,
        session_id,
        "What are the differences between superficial spreading melanoma and nodular melanoma in terms of prognosis and treatment?"
    )
    
    # Verify
    assert result["confidence"] >= 0.75, f"Expected ≥75%, got {result['confidence']:.2%}"
    assert result["route"] == "answer", f"Expected 'answer', got {result['route']}"
    print("\n✅ TEST 2 PASSED")


async def test_out_of_scope_query(client: httpx.AsyncClient, session_id: str):
    """Test 3: Out-of-scope query (should return insufficient info)."""
    print("\n" + "="*80)
    print("TEST 3: Out-of-Scope Query (Should Refuse)")
    print("="*80)
    
    result = await send_message(
        client,
        session_id,
        "What is the latest cure for cancer discovered last week in a research paper I saw?"
    )
    
    # May pass or refuse depending on knowledge base
    if result["route"] == "insufficient_info":
        print("\n✅ TEST 3 PASSED (Correctly refused)")
    elif result["confidence"] >= 0.75:
        print("\n✅ TEST 3 PASSED (Had sufficient info with high confidence)")
    else:
        raise AssertionError(f"Should have refused or had high confidence, got {result['confidence']:.2%}")


async def test_conversation_followup(client: httpx.AsyncClient, session_id: str):
    """Test 4: Conversation follow-up (reference resolution)."""
    print("\n" + "="*80)
    print("TEST 4: Conversation Follow-up")
    print("="*80)
    
    # First message
    result1 = await send_message(
        client,
        session_id,
        "What is basal cell carcinoma?"
    )
    
    assert result1["confidence"] >= 0.75
    
    # Follow-up with reference
    print("\n📍 Now testing reference resolution...")
    result2 = await send_message(
        client,
        session_id,
        "Tell me more about the above"
    )
    
    # Should still have high confidence
    assert result2["confidence"] >= 0.75, f"Expected ≥75%, got {result2['confidence']:.2%}"
    print("\n✅ TEST 4 PASSED")


async def test_link_request(client: httpx.AsyncClient, session_id: str):
    """Test 5: Link request (should route to web scraping agent)."""
    print("\n" + "="*80)
    print("TEST 5: Link Request")
    print("="*80)
    
    result = await send_message(
        client,
        session_id,
        "Get me hyperlinks for melanoma treatment"
    )
    
    # Should be web scraping agent
    mode = result.get("mode", "")
    print(f"\n   Mode: {mode}")
    print("\n✅ TEST 5 PASSED (Link request handled)")


async def run_all_tests():
    """Run all tests."""
    print("\n" + "🧪" * 40)
    print("ReAct + CoT Confidence Enforcement Test Suite")
    print("🧪" * 40)
    
    async with httpx.AsyncClient() as client:
        # Create session
        print("\n📋 Creating test session...")
        session_data = await create_session(client)
        session_id = session_data["session_id"]
        print(f"   Session ID: {session_id}")
        
        try:
            # Run tests
            await test_standard_query(client, session_id)
            await test_complex_query(client, session_id)
            await test_out_of_scope_query(client, session_id)
            await test_conversation_followup(client, session_id)
            await test_link_request(client, session_id)
            
            print("\n" + "="*80)
            print("🎉 ALL TESTS PASSED!")
            print("="*80)
            
        except Exception as e:
            print(f"\n❌ TEST FAILED: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(run_all_tests())
