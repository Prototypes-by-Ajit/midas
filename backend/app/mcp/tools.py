"""MCP tools registry."""
from typing import Dict, Any, List, Callable, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class ToolCategory(str, Enum):
    """Tool categories."""
    RETRIEVAL = "retrieval"
    VERIFICATION = "verification"
    GENERATION = "generation"
    MEMORY = "memory"
    AUDIT = "audit"
    WEB = "web"


class Tool:
    """MCP tool definition."""
    
    def __init__(
        self,
        name: str,
        description: str,
        category: ToolCategory,
        handler: Optional[Callable] = None,
        parameters: Optional[Dict[str, Any]] = None,
        required_permissions: Optional[List[str]] = None
    ):
        """
        Initialize tool.
        
        Args:
            name: Tool name
            description: Tool description
            category: Tool category
            handler: Function to execute tool
            parameters: Parameter schema
            required_permissions: Required permissions
        """
        self.name = name
        self.description = description
        self.category = category
        self.handler = handler
        self.parameters = parameters or {}
        self.required_permissions = required_permissions or []
    
    def execute(self, **kwargs) -> Any:
        """Execute the tool."""
        if self.handler is None:
            raise NotImplementedError(f"Tool {self.name} has no handler")
        
        logger.info(f"Executing tool: {self.name}")
        return self.handler(**kwargs)


class ToolRegistry:
    """Central registry for MCP tools."""
    
    def __init__(self):
        """Initialize tool registry."""
        self._tools: Dict[str, Tool] = {}
        self._register_default_tools()
    
    def _register_default_tools(self):
        """Register default MCP tools."""
        
        # Retrieval tools
        self.register(Tool(
            name="retrieve_guidelines",
            description="Retrieve clinical guidelines for skin cancer lesions",
            category=ToolCategory.RETRIEVAL,
            parameters={
                "query": {"type": "string", "required": True},
                "lesion_class": {"type": "string", "required": False},
                "top_k": {"type": "integer", "default": 5}
            }
        ))
        
        self.register(Tool(
            name="retrieve_research_chunks",
            description="Retrieve research paper chunks",
            category=ToolCategory.RETRIEVAL,
            parameters={
                "query": {"type": "string", "required": True},
                "top_k": {"type": "integer", "default": 5}
            }
        ))
        
        # Verification tools
        self.register(Tool(
            name="verify_grounding",
            description="Verify if response is grounded in evidence",
            category=ToolCategory.VERIFICATION,
            parameters={
                "response": {"type": "string", "required": True},
                "evidence": {"type": "array", "required": True},
                "min_score": {"type": "float", "default": 0.7}
            }
        ))
        
        # Generation tools
        self.register(Tool(
            name="compose_medical_response",
            description="Compose medical response with citations and disclaimer",
            category=ToolCategory.GENERATION,
            parameters={
                "query": {"type": "string", "required": True},
                "evidence": {"type": "array", "required": True},
                "mode": {"type": "string", "default": "patient"}
            },
            required_permissions=["write_analysis"]
        ))
        
        # Memory tools
        self.register(Tool(
            name="retrieve_user_memory",
            description="Retrieve user's long-term memory (domain-safe)",
            category=ToolCategory.MEMORY,
            parameters={
                "user_id": {"type": "string", "required": True},
                "memory_type": {"type": "string", "required": False}
            },
            required_permissions=["read_own_data"]
        ))
        
        self.register(Tool(
            name="write_user_memory",
            description="Write to user's long-term memory (domain-safe)",
            category=ToolCategory.MEMORY,
            parameters={
                "user_id": {"type": "string", "required": True},
                "memory_type": {"type": "string", "required": True},
                "key": {"type": "string", "required": True},
                "value": {"type": "object", "required": True}
            },
            required_permissions=["read_own_data"]
        ))
        
        # Audit tools
        self.register(Tool(
            name="log_audit_trace",
            description="Log complete RAG audit trace",
            category=ToolCategory.AUDIT,
            parameters={
                "message_id": {"type": "string", "required": True},
                "trace_data": {"type": "object", "required": True}
            }
        ))
        
        # Web scraping tools
        self.register(Tool(
            name="scrape_medical_website",
            description="Scrape and extract content from trusted medical websites",
            category=ToolCategory.WEB,
            parameters={
                "url": {"type": "string", "required": True},
                "extract_type": {"type": "string", "default": "text"},
                "max_length": {"type": "integer", "default": 5000}
            },
            required_permissions=["web_access"]
        ))
        
        # Tavily AI search tools
        self.register(Tool(
            name="tavily_web_search",
            description="AI-powered web search using Tavily for medical information",
            category=ToolCategory.WEB,
            parameters={
                "query": {"type": "string", "required": True},
                "max_results": {"type": "integer", "default": 5},
                "search_depth": {"type": "string", "default": "advanced"}
            },
            required_permissions=["web_access"]
        ))
        
        self.register(Tool(
            name="tavily_medical_search",
            description="Search medical/skin cancer information using Tavily with domain filtering",
            category=ToolCategory.WEB,
            parameters={
                "query": {"type": "string", "required": True},
                "max_results": {"type": "integer", "default": 5}
            },
            required_permissions=["web_access"]
        ))
        
        self.register(Tool(
            name="tavily_extract_urls",
            description="Extract content from specific URLs using Tavily",
            category=ToolCategory.WEB,
            parameters={
                "urls": {"type": "array", "required": True},
                "query": {"type": "string", "required": True}
            },
            required_permissions=["web_access"]
        ))
        
        logger.info(f"Registered {len(self._tools)} default tools")
    
    def register(self, tool: Tool):
        """
        Register a tool.
        
        Args:
            tool: Tool to register
        """
        if tool.name in self._tools:
            logger.warning(f"Tool {tool.name} already registered, overwriting")
        
        self._tools[tool.name] = tool
        logger.debug(f"Registered tool: {tool.name} ({tool.category.value})")
    
    def get_tool(self, name: str) -> Optional[Tool]:
        """
        Get a tool by name.
        
        Args:
            name: Tool name
            
        Returns:
            Tool or None if not found
        """
        return self._tools.get(name)
    
    def list_tools(self, category: Optional[ToolCategory] = None) -> List[Tool]:
        """
        List all tools, optionally filtered by category.
        
        Args:
            category: Optional category filter
            
        Returns:
            List of tools
        """
        if category:
            return [t for t in self._tools.values() if t.category == category]
        return list(self._tools.values())
    
    def get_tool_names(self, category: Optional[ToolCategory] = None) -> List[str]:
        """
        Get tool names.
        
        Args:
            category: Optional category filter
            
        Returns:
            List of tool names
        """
        tools = self.list_tools(category)
        return [t.name for t in tools]
    
    def execute_tool(self, name: str, **kwargs) -> Any:
        """
        Execute a tool by name.
        
        Args:
            name: Tool name
            **kwargs: Tool parameters
            
        Returns:
            Tool execution result
        """
        tool = self.get_tool(name)
        if not tool:
            raise ValueError(f"Tool not found: {name}")
        
        return tool.execute(**kwargs)


# Global tool registry
tool_registry = ToolRegistry()
