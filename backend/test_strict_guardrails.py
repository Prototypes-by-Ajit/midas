#!/usr/bin/env python3
"""
Test STRICT 3-class guardrails policy.

Enforces:
- IN_SCOPE_MEDICAL_DERM: confidence >= 0.75 required
- OUT_OF_SCOPE: exact template, NO medical language
- FOLLOWUP_REFERENTIAL: resolve then apply policy
"""
import sys
sys.path.insert(0, '/Users/ajit/Desktop/MIDAS_final_work/backend')

from app.agents.query_guardrails_agent import query_guardrails_agent

# MANDATORY OUT_OF_SCOPE template
EXPECTED_OUT_OF_SCOPE = "Out of scope for MIDAS: I only handle dermatology / skin-cancer topics. Ask me about skin lesions, melanoma/ABCDE signs, biopsy, treatment, or prevention."

def test_guardrails():
    print("=" * 80)
    print("STRICT 3-CLASS GUARDRAILS TEST")
    print("=" * 80)
    
    test_cases = [
        {
            "name": "Docker application (OUT_OF_SCOPE)",
            "query": "how can i docker an application",
            "expected_domain": "OUT_OF_SCOPE",
            "expected_action": "STOP",
        },
        {
            "name": "Docker scootpie (OUT_OF_SCOPE)",
            "query": "how to docker scootpie",
            "expected_domain": "OUT_OF_SCOPE",
            "expected_action": "STOP",
        },
        {
            "name": "CtorW file reference (OUT_OF_SCOPE)",
            "query": "explain about the CtorW",
            "expected_domain": "OUT_OF_SCOPE",
            "expected_action": "STOP",
        },
        {
            "name": "ABCDE rule (IN_SCOPE_MEDICAL_DERM)",
            "query": "ABCDE rule for melanoma?",
            "expected_domain": "IN_SCOPE_MEDICAL_DERM",
            "expected_action": "RETRIEVE",
        },
        {
            "name": "What is melanoma (IN_SCOPE_MEDICAL_DERM)",
            "query": "What is melanoma?",
            "expected_domain": "IN_SCOPE_MEDICAL_DERM",
            "expected_action": "RETRIEVE",
        },
        {
            "name": "Basal cell carcinoma (IN_SCOPE_MEDICAL_DERM)",
            "query": "Tell me about basal cell carcinoma symptoms",
            "expected_domain": "IN_SCOPE_MEDICAL_DERM",
            "expected_action": "RETRIEVE",
        },
        {
            "name": "Tell me more about above (FOLLOWUP_REFERENTIAL)",
            "query": "tell me more about above",
            "expected_domain": "FOLLOWUP_REFERENTIAL",
            "expected_action": "RESOLVE_FOLLOWUP",
        },
        {
            "name": "Programming question (OUT_OF_SCOPE)",
            "query": "How do I write a Python function?",
            "expected_domain": "OUT_OF_SCOPE",
            "expected_action": "STOP",
        },
    ]
    
    passed = 0
    failed = 0
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n{'─' * 80}")
        print(f"Test {i}/{len(test_cases)}: {test['name']}")
        print(f"Query: \"{test['query']}\"")
        print(f"{'─' * 80}")
        
        decision = query_guardrails_agent.classify_query(
            query=test["query"],
            conversation_history=[],
            available_docs=[]
        )
        
        domain = decision["domain"]
        action = decision["next_action"]
        
        # Check domain classification
        domain_match = domain == test["expected_domain"]
        action_match = action == test["expected_action"]
        
        # Verify OUT_OF_SCOPE properties
        out_of_scope_valid = True
        if domain == "OUT_OF_SCOPE":
            # Check that OUT_OF_SCOPE template is correct
            out_msg = query_guardrails_agent.get_out_of_scope_message()
            if out_msg != EXPECTED_OUT_OF_SCOPE:
                print(f"   ❌ OUT_OF_SCOPE template mismatch!")
                print(f"      Expected: {EXPECTED_OUT_OF_SCOPE}")
                print(f"      Got: {out_msg}")
                out_of_scope_valid = False
            
            # Check no medical disclaimer
            if decision["apply_medical_disclaimer"]:
                print(f"   ❌ Medical disclaimer should be FALSE for OUT_OF_SCOPE")
                out_of_scope_valid = False
            
            # Check confidence threshold is 0.0
            if decision["confidence_threshold"] != 0.0:
                print(f"   ❌ Confidence threshold should be 0.0 for OUT_OF_SCOPE (got {decision['confidence_threshold']})")
                out_of_scope_valid = False
        
        # Overall result
        test_passed = domain_match and action_match and out_of_scope_valid
        
        if test_passed:
            print(f"   ✅ PASSED")
            passed += 1
        else:
            print(f"   ❌ FAILED")
            failed += 1
        
        print(f"   Domain: {domain} (expected: {test['expected_domain']}) {'✓' if domain_match else '✗'}")
        print(f"   Action: {action} (expected: {test['expected_action']}) {'✓' if action_match else '✗'}")
        print(f"   Confidence threshold: {decision['confidence_threshold']}")
        print(f"   Apply medical disclaimer: {decision['apply_medical_disclaimer']}")
        print(f"   Medical keyword matches: {decision['medical_keyword_matches']}")
    
    print("\n" + "=" * 80)
    print(f"RESULTS: {passed} passed, {failed} failed out of {len(test_cases)} tests")
    print("=" * 80)
    
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    test_guardrails()
