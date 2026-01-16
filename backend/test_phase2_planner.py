"""
Test script for Phase 2: Planner Agent (ReAct Pattern)

This script tests the planner agent integration with flags ON/OFF.

Usage:
    python test_phase2_planner.py
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.config import settings
from app.clara.orchestrator import CLARAOrchestrator


async def test_planner(query: str, enable_planner: bool, enable_hybrid: bool = False):
    """Test planner with flag ON or OFF."""

    print(f"\n{'='*80}")
    print(f"Testing with enable_planner = {enable_planner}")
    print(f"            enable_hybrid_retrieval = {enable_hybrid}")
    print(f"{'='*80}\n")

    # Temporarily set flags
    original_planner = settings.enable_planner
    original_hybrid = settings.enable_hybrid_retrieval
    settings.enable_planner = enable_planner
    settings.enable_hybrid_retrieval = enable_hybrid

    try:
        # Initialize orchestrator (will load planner based on flag)
        orchestrator = CLARAOrchestrator()

        # Process query
        print(f"Query: {query}\n")

        response = await orchestrator.process_query(
            query=query,
            user_id="test_user",
            session_id="test_session"
        )

        # Print results
        print(f"Route: {response.route}")
        print(f"Confidence: {response.confidence:.3f}")
        print(f"\nAnswer:\n{response.answer[:300]}...\n")

        print(f"Citations ({len(response.citations)}):")
        for i, citation in enumerate(response.citations[:3], 1):
            print(f"  {i}. Source: {citation.source}")
            print(f"     Relevance: {citation.relevance_score:.3f}")
            print(f"     Content: {citation.content[:100]}...")

        # Print metadata if available
        if response.metadata:
            print(f"\nMetadata:")
            for key, value in response.metadata.items():
                print(f"  {key}: {value}")

        print(f"\nProcessing completed successfully")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Restore original values
        settings.enable_planner = original_planner
        settings.enable_hybrid_retrieval = original_hybrid


async def main():
    """Run tests."""

    print("\n" + "="*80)
    print("PHASE 2: PLANNER AGENT TEST")
    print("="*80)

    # Test queries - mix of simple and complex
    test_queries = [
        # Simple query (should use direct answering even with planner)
        "What is melanoma?",

        # Complex query (should trigger multi-step planning)
        "What are the symptoms of melanoma and how is it different from benign nevus?",

        # Complex multi-part query
        "Compare basal cell carcinoma and actinic keratosis in terms of symptoms, risk factors, and treatment options"
    ]

    # Test 1: Simple query with planner OFF (baseline)
    print("\n\n🔵 TEST 1: Simple Query - Planner DISABLED (Baseline)")
    await test_planner(test_queries[0], enable_planner=False)

    # Test 2: Simple query with planner ON (should fall back to direct)
    print("\n\n🟢 TEST 2: Simple Query - Planner ENABLED")
    await test_planner(test_queries[0], enable_planner=True)

    # Test 3: Complex query with planner OFF (baseline)
    print("\n\n🔵 TEST 3: Complex Query - Planner DISABLED (Baseline)")
    await test_planner(test_queries[1], enable_planner=False)

    # Test 4: Complex query with planner ON (should trigger planning)
    print("\n\n🟢 TEST 4: Complex Query - Planner ENABLED (Multi-step)")
    await test_planner(test_queries[1], enable_planner=True)

    # Test 5: Complex query with BOTH planner AND hybrid retrieval
    print("\n\n🟢 TEST 5: Complex Query - BOTH Layers ENABLED (Planner + Hybrid)")
    await test_planner(test_queries[2], enable_planner=True, enable_hybrid=True)

    print("\n\n" + "="*80)
    print("TESTS COMPLETE")
    print("="*80)
    print("\nComparison points:")
    print("1. Test 1 vs Test 2: Simple query should behave similarly")
    print("2. Test 3 vs Test 4: Complex query should show better reasoning with planner")
    print("3. Test 5: Combined layers should show best quality")
    print("\nNext steps:")
    print("1. Verify planner creates multi-step plans for complex queries")
    print("2. Check if answer quality improves with planning")
    print("3. Ensure simple queries don't unnecessarily use planning")
    print("4. If quality improves, set enable_planner=True in config.py")
    print("5. Monitor production performance with gradual rollout")


if __name__ == "__main__":
    asyncio.run(main())
