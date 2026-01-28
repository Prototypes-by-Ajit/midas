#!/usr/bin/env python3
"""
Test conversation-aware follow-up resolution.

Simulates a two-turn conversation:
1. Ask about melanoma
2. Follow up with "Tell me more about above" (ambiguous referential)

Expects:
- Turn 1: Normal answer with citations
- Turn 2: Either clarification request OR expanded answer with GCM grounding
"""
import asyncio
import httpx
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

async def test_conversation_followup():
    session_id = f"test_session_{datetime.now().timestamp()}"
    
    print("=" * 80)
    print("TEST: Conversation-Aware Follow-Up Resolution")
    print("=" * 80)
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        # === TURN 1: Ask about melanoma ===
        print("\n🔵 TURN 1: Initial query about melanoma")
        turn1_query = "What is melanoma?"
        
        response1 = await client.post(
            f"{BASE_URL}/api/v1/sessions/{session_id}/messages",
            json={
                "query": turn1_query,
                "user_id": "test_user"
            }
        )
        
        if response1.status_code != 200:
            print(f"❌ Turn 1 failed: {response1.status_code} - {response1.text}")
            return
        
        result1 = response1.json()
        print(f"✅ Turn 1 successful")
        print(f"   Confidence: {result1.get('confidence', 0):.2%}")
        print(f"   Answer length: {len(result1.get('answer', ''))} chars")
        print(f"   Citations: {len(result1.get('citations', []))} sources")
        print(f"   Route: {result1.get('route', 'unknown')}")
        
        # Show snippet of answer
        answer_snippet = result1.get('answer', '')[:200].replace('\n', ' ')
        print(f"   Answer preview: {answer_snippet}...")
        
        # === TURN 2: Ambiguous referential follow-up ===
        print("\n🔵 TURN 2: Referential follow-up (ambiguous)")
        turn2_query = "Tell me more about above"
        
        response2 = await client.post(
            f"{BASE_URL}/api/v1/sessions/{session_id}/messages",
            json={
                "query": turn2_query,
                "user_id": "test_user"
            }
        )
        
        if response2.status_code != 200:
            print(f"❌ Turn 2 failed: {response2.status_code} - {response2.text}")
            return
        
        result2 = response2.json()
        print(f"✅ Turn 2 successful")
        print(f"   Confidence: {result2.get('confidence', 0):.2%}")
        print(f"   Answer length: {len(result2.get('answer', ''))} chars")
        print(f"   Citations: {len(result2.get('citations', []))} sources")
        print(f"   Route: {result2.get('route', 'unknown')}")
        
        # Check if clarification was requested
        answer2 = result2.get('answer', '')
        is_clarification = 'clarify' in result2.get('route', '') or 'do you mean' in answer2.lower() or 'pick one' in answer2.lower()
        
        if is_clarification:
            print(f"   ✅ CLARIFICATION REQUESTED (as expected for ambiguous follow-up)")
            print(f"   Question: {answer2[:300]}")
        else:
            print(f"   ℹ️  Direct answer provided (may include GCM grounding)")
            answer_snippet = answer2[:300].replace('\n', ' ')
            print(f"   Answer preview: {answer_snippet}...")
        
        # === SUMMARY ===
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Turn 1 confidence: {result1.get('confidence', 0):.2%}")
        print(f"Turn 2 confidence: {result2.get('confidence', 0):.2%}")
        print(f"Turn 2 behavior: {'CLARIFICATION' if is_clarification else 'DIRECT_ANSWER'}")
        
        # Check conversation history retrieval
        if result2.get('confidence', 0) > result1.get('confidence', 0):
            print("✅ Confidence improved in Turn 2 (likely using GCM)")
        
        print("\n✅ Test completed successfully!")

if __name__ == "__main__":
    asyncio.run(test_conversation_followup())
