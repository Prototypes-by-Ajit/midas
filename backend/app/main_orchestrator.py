"""Main Orchestrator - Routes queries to specialized agents (with HARD domain guardrail)."""
import logging
from typing import Dict, Any, Optional

from app.agents.router_agent import router_agent, AgentType
from app.agents.rag_agent import rag_agent
from app.agents.react_cot_agent import react_cot_agent
from app.agents.web_scraping_agent import web_scraping_agent
from app.services.chat_persistence import chat_persistence
from app.agents.follow_up_resolver import follow_up_resolver

# ✅ HARD DOMAIN GUARDRAIL (runs BEFORE router)
from app.agents.dynamic_guardrails_classifier import dynamic_classifier

logger = logging.getLogger(__name__)


class MainOrchestrator:
    """
    Main orchestrator using router-based architecture.

    Architecture:
    - HARD Domain Guardrail (DynamicGuardrailsClassifier): blocks OUT_OF_SCOPE before routing
    - Router Agent: Routes in-scope queries to appropriate agent
    - ReAct + CoT Agent: Medical Q&A with confidence guarantee
    - RAG Agent: Fallback medical Q&A with vector store
    - Web Scraping Agent: URL extraction via Tavily MCP only
    """

    def __init__(self):
        self.router = router_agent
        self.rag_agent = rag_agent
        self.react_cot_agent = react_cot_agent
        self.web_agent = web_scraping_agent

    async def process_query(
        self,
        query: str,
        session_id: str,
        user_id: Optional[str] = None,
        lesion_class: Optional[str] = None,
        subject_role: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process query through router-based architecture with conversation memory.
        Enforces dermatology-only scope via a hard guardrail before routing.
        """
        # ===== STEP 0: RETRIEVE CONVERSATION HISTORY =====
        conversation_history = await chat_persistence.get_session_messages(
            session_id=session_id,
            limit=5
        )
        logger.info(f"📜 Retrieved {len(conversation_history)} messages from history")

        # ===== STEP 1: FOLLOW-UP RESOLUTION (conversation aware) =====
        resolver = follow_up_resolver.resolve(query, conversation_history)
        resolved_query = resolver.get("rewritten_query", query)
        is_referential = resolver.get("followup_type") == "REFERENTIAL"

        # Build GCM passages from recent assistant turns (for ReAct agent)
        gcm_passages = []
        if is_referential and conversation_history:
            for msg in reversed(conversation_history):
                if msg.get("role") != "assistant":
                    continue
                meta = msg.get("metadata") or {}
                citations = meta.get("citations", []) if isinstance(meta, dict) else []
                gcm_passages.append({
                    "content": (msg.get("content") or "")[:800],
                    "citations": citations or []
                })
                if len(gcm_passages) >= 3:
                    break

        # ===== STEP 1.5: HARD DOMAIN GUARDRAIL (BEFORE ROUTING) =====
        # IMPORTANT: classify the ORIGINAL user query to avoid resolver pollution.
        domain_decision = await dynamic_classifier.classify_domain(
            query=query,
            conversation_history=conversation_history
        )

        domain = domain_decision.get("domain")
        if domain not in ("IN_SCOPE_MEDICAL_DERM", "FOLLOWUP_REFERENTIAL"):
            logger.info(f"🚫 DOMAIN BLOCKED: {domain_decision}")
            await self._record_policy_block(subject_role, domain_decision.get("classification"))
            return {
                "answer": dynamic_classifier.get_out_of_scope_message(),
                "citations": [],
                "confidence": 0.0,
                "route": "refuse",
                "routing": {
                    "agent_used": "domain_guardrail",
                    "routing_reason": domain_decision.get("reasoning", "out_of_scope")
                }
            }

        # ===== STEP 2: ROUTE QUERY WITH CONTEXT =====
        routing_decision = self.router.route(resolved_query, conversation_history=conversation_history)
        agent_type = routing_decision["agent"]
        logger.info(f"🔀 {self.router.get_routing_summary(routing_decision)}")

        # ===== STEP 3: EXECUTE VIA APPROPRIATE AGENT =====
        if agent_type == AgentType.OUT_OF_SCOPE:
            # Secondary guardrail from router (kept for defense-in-depth)
            logger.info("🚫 ROUTER OUT_OF_SCOPE: Returning strict refusal")
            response = {
                "answer": routing_decision.get(
                    "out_of_scope_response",
                    dynamic_classifier.get_out_of_scope_message()
                ),
                "citations": [],
                "confidence": 0.0,
                "route": "refuse"
            }

        elif agent_type == AgentType.WEB_SCRAPING_AGENT:
            response = await self.web_agent.process(
                query=routing_decision["query"],
                urls=routing_decision["urls"],
                session_id=session_id,
                search_mode=routing_decision.get("search_mode", False),
                conversation_history=conversation_history
            )

        elif agent_type == AgentType.REACT_COT_AGENT:
            response = await self.react_cot_agent.process_with_confidence_guarantee(
                query=routing_decision["query"],
                lesion_class=lesion_class,
                conversation_history=conversation_history,
                gcm_passages=gcm_passages,
                followup_meta=resolver
            )

        else:
            response = await self.rag_agent.process(
                query=routing_decision["query"],
                session_id=session_id,
                user_id=user_id,
                lesion_class=lesion_class,
                conversation_history=conversation_history
            )

        # Add routing metadata (consistent response shape)
        response["routing"] = {
            "agent_used": agent_type.value,
            "routing_reason": routing_decision.get("reason", "")
        }

        return response

    async def _record_policy_block(
        self, subject_role: Optional[str], classification: Optional[str]
    ) -> None:
        """FR-AUD-4 (T019): one row per blocked query, carrying only its
        classification and subject_role -- no query text, no free-text
        reasoning, no identity beyond the end user's session role
        (policy_block_events, migration 016).

        Fire-and-forget: a failure here must never break the guardrail
        response the user already sees returned above. `subject_role` is
        Optional on QueryRequest for backward compatibility (T016) -- an old
        caller that hasn't been updated to send it (or a non-web caller)
        skips the write rather than violating the column's NOT NULL
        constraint or crashing the request.
        """
        if subject_role not in ("patient", "clinician"):
            logger.warning(
                f"policy_block_events insert skipped: subject_role={subject_role!r} "
                "is not 'patient' or 'clinician' (NOT NULL, CHECK-constrained) -- "
                "caller has not been updated to populate it yet (T018)"
            )
            return

        # Reuses chat_persistence's own lazily-initialized Supabase client
        # (already live by this point in process_query -- STEP 0 calls
        # get_session_messages() first) rather than standing up a second one.
        if not chat_persistence.client:
            chat_persistence._initialize()
        if not chat_persistence.client:
            logger.error("policy_block_events insert skipped: Supabase client unavailable")
            return

        try:
            chat_persistence.client.table("policy_block_events").insert({
                "subject_role": subject_role,
                "classification": classification,
                "escalated_to_review": True,
            }).execute()
            # T065 -- PRD §17 analytics event, same file/task boundary as the
            # write itself. No analytics sink exists in this app (same
            # undeployed-infra class as OQ7) -- a structured log line, same
            # pattern this feature uses everywhere else it "emits" an event.
            logger.info(
                f"policy_block_recorded: classification={classification} escalated_to_review=True"
            )
        except Exception as e:
            logger.error(f"Failed to record policy_block_events row: {e}")


# Global orchestrator instance
main_orchestrator = MainOrchestrator()
