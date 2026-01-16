"""
Planner Agent using ReAct (Reasoning + Acting) pattern for multi-step reasoning.

Implements a simple planner that can:
1. Break down complex queries into steps
2. Decide when to retrieve vs. use tools vs. generate
3. Fall back to direct answering for simple queries
"""

import logging
from typing import Dict, List, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class ActionType(Enum):
    """Types of actions the planner can take."""
    RETRIEVE = "retrieve"      # Search knowledge base
    TOOL = "tool"              # Use external tool
    GENERATE = "generate"      # Generate final answer
    CLARIFY = "clarify"        # Ask for clarification


class PlanStep:
    """Represents a single step in the plan."""

    def __init__(self, step_num: int, description: str, action: ActionType):
        self.step_num = step_num
        self.description = description
        self.action = action
        self.observation = None
        self.completed = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_num": self.step_num,
            "description": self.description,
            "action": self.action.value,
            "observation": self.observation,
            "completed": self.completed
        }


class PlannerAgent:
    """
    Planner agent using ReAct pattern.

    For complex queries:
    - Creates a multi-step plan
    - Executes each step (retrieve/tool/generate)
    - Synthesizes observations into final answer

    For simple queries:
    - Falls back to direct retrieval + generation
    """

    def __init__(self, llm_service, max_steps: int = 5):
        """
        Initialize planner agent.

        Args:
            llm_service: LLM service for reasoning
            max_steps: Maximum planning steps
        """
        self.llm = llm_service
        self.max_steps = max_steps

    async def run(
        self,
        query: str,
        context: Optional[str] = None,
        retrieval_fn: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Run the planner on a query.

        Args:
            query: User query
            context: Optional conversation context
            retrieval_fn: Function to call for retrieval (async)

        Returns:
            Dict with final_answer, plan, and observations
        """
        logger.info(f"Planner: Analyzing query: '{query[:100]}...'")

        # Step 1: Determine if query needs planning
        needs_planning = await self._assess_complexity(query)

        if not needs_planning:
            logger.info("Planner: Simple query, using direct answering")
            return await self._direct_answer(query, retrieval_fn)

        # Step 2: Create plan
        logger.info("Planner: Complex query, creating plan...")
        plan = await self._create_plan(query, context)

        # Step 3: Execute plan steps
        observations = []
        for step in plan:
            logger.info(f"Planner: Executing step {step.step_num}: {step.description}")

            if step.action == ActionType.RETRIEVE:
                observation = await self._execute_retrieval(query, retrieval_fn)
            elif step.action == ActionType.TOOL:
                observation = await self._execute_tool(query, step.description)
            elif step.action == ActionType.GENERATE:
                observation = await self._execute_generation(query, observations)
            else:
                observation = "Action not implemented"

            step.observation = observation
            step.completed = True
            observations.append(observation)

        # Step 4: Synthesize final answer
        final_answer = await self._synthesize_answer(query, plan, observations)

        return {
            "final_answer": final_answer,
            "plan": [step.to_dict() for step in plan],
            "observations": observations,
            "planning_used": True
        }

    async def _assess_complexity(self, query: str) -> bool:
        """
        Determine if query needs multi-step planning.

        Heuristics:
        - Contains multiple questions?
        - Requires comparison/reasoning?
        - Needs multiple information sources?

        Args:
            query: User query

        Returns:
            True if complex (needs planning), False if simple
        """
        # Simple heuristics (can be enhanced with LLM)
        complexity_indicators = [
            " and " in query.lower(),
            " or " in query.lower(),
            "?" in query and query.count("?") > 1,  # Multiple questions
            "compare" in query.lower(),
            "difference" in query.lower(),
            "vs" in query.lower() or "versus" in query.lower(),
            len(query.split()) > 15,  # Long query
        ]

        is_complex = sum(complexity_indicators) >= 2

        logger.debug(f"Complexity assessment: {is_complex} (indicators: {sum(complexity_indicators)})")
        return is_complex

    async def _create_plan(self, query: str, context: Optional[str] = None) -> List[PlanStep]:
        """
        Create a multi-step plan for answering the query.

        Args:
            query: User query
            context: Optional conversation context

        Returns:
            List of PlanStep objects
        """
        # Build planning prompt
        prompt = f"""
You are a medical AI planning assistant. Break down this query into 2-3 simple steps.

Query: {query}

For each step, specify:
1. What information to retrieve
2. What to analyze
3. How to combine information

Format as numbered list. Be concise.
"""

        if context:
            prompt += f"\n\nConversation context:\n{context[:200]}\n"

        try:
            # Generate plan using LLM
            response = await self.llm.ainvoke(prompt)
            plan_text = response if isinstance(response, str) else response.get("content", "")

            # Parse plan into steps
            steps = []
            lines = [line.strip() for line in plan_text.split('\n') if line.strip()]

            for i, line in enumerate(lines[:self.max_steps], 1):
                # Simple parsing: if line starts with number, it's a step
                if line and (line[0].isdigit() or line.startswith("-")):
                    description = line.lstrip("0123456789.-) ")

                    # Determine action type from keywords
                    if any(word in description.lower() for word in ["search", "find", "retrieve", "look up"]):
                        action = ActionType.RETRIEVE
                    elif any(word in description.lower() for word in ["analyze", "compare", "combine"]):
                        action = ActionType.GENERATE
                    else:
                        action = ActionType.RETRIEVE  # Default

                    steps.append(PlanStep(i, description, action))

            # Ensure we have at least one step
            if not steps:
                steps = [
                    PlanStep(1, "Retrieve relevant medical information", ActionType.RETRIEVE),
                    PlanStep(2, "Analyze and synthesize answer", ActionType.GENERATE)
                ]

            logger.info(f"Plan created with {len(steps)} steps")
            return steps

        except Exception as e:
            logger.error(f"Plan creation error: {e}, using default plan")
            return [
                PlanStep(1, "Retrieve relevant information", ActionType.RETRIEVE),
                PlanStep(2, "Generate answer", ActionType.GENERATE)
            ]

    async def _direct_answer(
        self,
        query: str,
        retrieval_fn: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Direct answer for simple queries (no planning).

        Args:
            query: User query
            retrieval_fn: Retrieval function

        Returns:
            Dict with final_answer and metadata
        """
        # Just retrieve and generate (existing CLARA behavior)
        if retrieval_fn:
            documents = await retrieval_fn(query, {})
            context = "\n\n".join([doc.get("content", "") for doc in documents[:3]])
        else:
            context = ""

        # Generate answer
        prompt = f"""
Based on the following medical information, answer the question concisely.

Question: {query}

Context:
{context[:1000] if context else 'No context available'}

Answer:
"""

        response = await self.llm.ainvoke(prompt)
        answer = response if isinstance(response, str) else response.get("content", "")

        return {
            "final_answer": answer,
            "plan": [],
            "observations": [],
            "planning_used": False
        }

    async def _execute_retrieval(
        self,
        query: str,
        retrieval_fn: Optional[callable] = None
    ) -> str:
        """
        Execute retrieval action.

        Args:
            query: Search query
            retrieval_fn: Retrieval function (provided by orchestrator)

        Returns:
            Observation string
        """
        if not retrieval_fn:
            return "Retrieval function not available"

        try:
            documents = await retrieval_fn(query, {})

            if not documents:
                return "No relevant documents found"

            # Summarize retrieved content
            content_snippets = [
                doc.get("content", "")[:200]
                for doc in documents[:3]
            ]

            observation = f"Retrieved {len(documents)} documents. Key information: "
            observation += "; ".join(content_snippets)

            return observation

        except Exception as e:
            logger.error(f"Retrieval execution error: {e}")
            return f"Retrieval error: {str(e)}"

    async def _execute_tool(self, query: str, tool_description: str) -> str:
        """
        Execute tool action (placeholder for future tools).

        Args:
            query: User query
            tool_description: Description of what tool to use

        Returns:
            Observation string
        """
        # Placeholder: In future, this would call actual tools
        return f"Tool execution (placeholder): {tool_description}"

    async def _execute_generation(self, query: str, observations: List[str]) -> str:
        """
        Execute generation action (synthesize observations).

        Args:
            query: User query
            observations: Previous observations

        Returns:
            Generated observation
        """
        combined_observations = "\n".join([
            f"- {obs[:200]}"
            for obs in observations
        ])

        prompt = f"""
Based on the following observations, provide a brief summary relevant to this question:

Question: {query}

Observations:
{combined_observations}

Summary:
"""

        response = await self.llm.ainvoke(prompt)
        return response if isinstance(response, str) else response.get("content", "")

    async def _synthesize_answer(
        self,
        query: str,
        plan: List[PlanStep],
        observations: List[str]
    ) -> str:
        """
        Synthesize final answer from plan and observations.

        Args:
            query: User query
            plan: Executed plan steps
            observations: Observations from each step

        Returns:
            Final answer string
        """
        # Build comprehensive context from observations
        context = "\n\n".join([
            f"Step {i+1} ({plan[i].description}):\n{obs}"
            for i, obs in enumerate(observations)
            if i < len(plan)
        ])

        prompt = f"""
You are a medical AI assistant. Synthesize a comprehensive answer from the following information.

Question: {query}

Information gathered:
{context[:1500]}

Provide a clear, concise answer that directly addresses the question.

Answer:
"""

        response = await self.llm.ainvoke(prompt)
        final_answer = response if isinstance(response, str) else response.get("content", "")

        return final_answer

    def get_stats(self) -> Dict[str, Any]:
        """Get planner statistics."""
        return {
            "max_steps": self.max_steps,
            "planner_enabled": True
        }
