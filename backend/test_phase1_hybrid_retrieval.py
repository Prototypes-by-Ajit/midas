"""
Test script for Phase 1: Hybrid Retrieval + Reranking

This script tests the hybrid retrieval implementation with flags ON/OFF.

Usage:
    python test_phase1_hybrid_retrieval.py
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.config import settings
from app.clara.orchestrator import CLARAOrchestrator


async def test_retrieval(query: str, enable_hybrid: bool):
    """Test retrieval with hybrid flag ON or OFF."""

    print(f"\n{'='*80}")
    print(f"Testing with enable_hybrid_retrieval = {enable_hybrid}")
    print(f"{'='*80}\n")

    # Temporarily set flag
    original_value = settings.enable_hybrid_retrieval
    settings.enable_hybrid_retrieval = enable_hybrid

    try:
        # Initialize orchestrator
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
        print(f"Answer: {response.answer[:200]}...")
        print(f"\nCitations ({len(response.citations)}):")

        for i, citation in enumerate(response.citations[:3], 1):
            print(f"  {i}. Source: {citation.source}")
            print(f"     Confidence: {citation.confidence:.3f}")
            if hasattr(citation, 'retrieval_method'):
                print(f"     Method: {citation.retrieval_method}")

        print(f"\nMetadata:")
        print(f"  Processing time: {response.processing_time_ms}ms")
        if hasattr(response, 'cache_hits'):
            print(f"  Cache hits: {response.cache_hits}")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Restore original value
        settings.enable_hybrid_retrieval = original_value


async def main():
    """Run tests."""

    # Test queries
    test_queries = [
        "What are the symptoms of melanoma?",
        "How is basal cell carcinoma treated?",
        "What are the risk factors for skin cancer?"
    ]

    print("\n" + "="*80)
    print("PHASE 1: HYBRID RETRIEVAL TEST")
    print("="*80)

    # Pick first query for testing
    query = test_queries[0]

    # Test 1: With hybrid retrieval OFF (existing behavior)
    print("\n\n🔵 TEST 1: Hybrid Retrieval DISABLED (Baseline)")
    await test_retrieval(query, enable_hybrid=False)

    # Test 2: With hybrid retrieval ON (new behavior)
    print("\n\n🟢 TEST 2: Hybrid Retrieval ENABLED (Phase 1)")
    await test_retrieval(query, enable_hybrid=True)

    print("\n\n" + "="*80)
    print("TESTS COMPLETE")
    print("="*80)
    print("\nNext steps:")
    print("1. Compare retrieval quality between Test 1 and Test 2")
    print("2. Check if citations are more relevant in Test 2")
    print("3. If quality improves, set enable_hybrid_retrieval=True in config.py")
    print("4. Monitor production performance with gradual rollout")


if __name__ == "__main__":
    asyncio.run(main())
