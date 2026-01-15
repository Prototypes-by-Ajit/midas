"""LLM service for Ollama integration."""
import httpx
from typing import Optional, Dict, Any
from app.config import settings
import json


class LLMService:
    """Service for interacting with Ollama LLM."""
    
    def __init__(self):
        """Initialize the LLM service."""
        self.base_url = getattr(settings, 'ollama_base_url', 'http://localhost:11434')
        self.model = getattr(settings, 'ollama_model', 'llama3')
        self.temperature = getattr(settings, 'ollama_temperature', 0.2)
        self.max_tokens = getattr(settings, 'ollama_max_tokens', 500)
        
    async def generate(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        system: Optional[str] = None
    ) -> str:
        """
        Generate text using Ollama.
        
        Args:
            prompt: The input prompt
            temperature: Sampling temperature (overrides default)
            max_tokens: Maximum tokens to generate (overrides default)
            system: System message for the model
            
        Returns:
            Generated text
        """
        url = f"{self.base_url}/api/generate"
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature or self.temperature,
                "num_predict": max_tokens or self.max_tokens,
            }
        }
        
        if system:
            payload["system"] = system
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                result = response.json()
                return result.get("response", "").strip()
        except Exception as e:
            print(f"Error calling Ollama: {e}")
            raise
    
    async def generate_json(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        system: Optional[str] = None
    ) -> Dict[Any, Any]:
        """
        Generate JSON output using Ollama.
        
        Args:
            prompt: The input prompt
            temperature: Sampling temperature
            system: System message for the model
            
        Returns:
            Parsed JSON response
        """
        response = await self.generate(
            prompt=prompt,
            temperature=temperature or 0.1,  # Lower temperature for JSON
            system=system
        )
        
        # Extract JSON from response (handle markdown code blocks)
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        elif response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        response = response.strip()
        
        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {response}")
            print(f"Error: {e}")
            # Return default structure on parse error
            return {
                "error": "Failed to parse JSON response",
                "raw_response": response
            }
    
    async def health_check(self) -> bool:
        """
        Check if Ollama is running and model is available.
        
        Returns:
            True if healthy, False otherwise
        """
        try:
            url = f"{self.base_url}/api/tags"
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                models = [m["name"] for m in data.get("models", [])]
                return self.model in models or any(self.model in m for m in models)
        except Exception as e:
            print(f"Ollama health check failed: {e}")
            return False


# Global LLM service instance
llm_service = LLMService()
