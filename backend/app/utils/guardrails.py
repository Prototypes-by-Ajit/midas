"""Guardrails for input and output validation."""
import re
from app.config import settings


class Guardrails:
    """Input and output validation for medical safety."""
    
    @staticmethod
    def validate_input(query: str) -> tuple[bool, str]:
        """
        Validate user input query.
        
        Args:
            query: User's question
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check length
        if len(query) > settings.max_query_length:
            return False, f"Query too long (max {settings.max_query_length} characters)"
        
        if len(query.strip()) == 0:
            return False, "Query cannot be empty"
        
        # Check for suspicious patterns (SQL injection, etc.)
        suspicious_patterns = [
            r"<script",
            r"javascript:",
            r"SELECT\s+.*\s+FROM",
            r"DROP\s+TABLE",
            r"INSERT\s+INTO",
        ]
        
        query_lower = query.lower()
        for pattern in suspicious_patterns:
            if re.search(pattern, query_lower, re.IGNORECASE):
                return False, "Invalid query pattern detected"
        
        return True, ""
    
    @staticmethod
    def validate_output(answer: str) -> tuple[bool, str]:
        """
        Validate generated output for safety.
        
        Args:
            answer: Generated answer
            
        Returns:
            Tuple of (is_valid, warning_message)
        """
        warnings = []
        
        # Check for diagnostic language
        diagnostic_phrases = [
            "you have",
            "you definitely have",
            "this is cancer",
            "you are diagnosed with",
            "your diagnosis is",
            "you should take",
            "prescription:",
        ]
        
        answer_lower = answer.lower()
        for phrase in diagnostic_phrases:
            if phrase in answer_lower:
                warnings.append(f"Contains diagnostic language: '{phrase}'")
        
        # Check for medical disclaimer
        if "educational" not in answer_lower and "consult" not in answer_lower:
            warnings.append("Missing medical disclaimer")
        
        if warnings:
            return False, "; ".join(warnings)
        
        return True, ""
    
    @staticmethod
    def sanitize_query(query: str) -> str:
        """
        Sanitize user query.
        
        Args:
            query: Raw user query
            
        Returns:
            Sanitized query
        """
        # Remove extra whitespace
        query = " ".join(query.split())
        
        # Remove HTML tags
        query = re.sub(r'<[^>]+>', '', query)
        
        # Truncate to max length
        if len(query) > settings.max_query_length:
            query = query[:settings.max_query_length]
        
        return query.strip()


# Global guardrails instance
guardrails = Guardrails()
