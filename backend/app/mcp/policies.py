"""MCP domain policies and safety constraints."""
from typing import List, Dict, Any
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class LesionClass(str, Enum):
    """7 approved lesion classes."""
    MEL = "MEL"      # Melanoma
    NV = "NV"        # Melanocytic Nevus
    BCC = "BCC"      # Basal Cell Carcinoma
    AKIEC = "AKIEC"  # Actinic Keratosis
    BKL = "BKL"      # Benign Keratosis
    DF = "DF"        # Dermatofibroma
    VASC = "VASC"    # Vascular Lesions


class PolicyEnforcement(str, Enum):
    """Policy enforcement levels."""
    STRICT = "strict"
    MODERATE = "moderate"
    PERMISSIVE = "permissive"


class DomainPolicy:
    """Domain scoping and enforcement policies."""
    
    # 7 lesion classes (STRICT enforcement)
    LESION_CLASSES = [
        LesionClass.MEL,
        LesionClass.NV,
        LesionClass.BCC,
        LesionClass.AKIEC,
        LesionClass.BKL,
        LesionClass.DF,
        LesionClass.VASC,
    ]
    
    # Full names for display
    LESION_NAMES = {
        LesionClass.MEL: "Melanoma",
        LesionClass.NV: "Melanocytic Nevus",
        LesionClass.BCC: "Basal Cell Carcinoma",
        LesionClass.AKIEC: "Actinic Keratosis / Bowen's Disease",
        LesionClass.BKL: "Benign Keratosis",
        LesionClass.DF: "Dermatofibroma",
        LesionClass.VASC: "Vascular Lesions",
    }
    
    # In-scope keywords
    IN_SCOPE_KEYWORDS = [
        "melanoma", "mole", "skin cancer", "lesion", "nevus", "basal cell",
        "squamous cell", "carcinoma", "keratosis", "dermatofibroma", "vascular",
        "dermoscopy", "biopsy", "abcde rule", "skin examination", "skin check",
        "pigmented", "asymmetry", "border", "color", "diameter", "evolution",
        "sun exposure", "uv", "radiation", "prevention", "screening",
        "dermatologist", "dermatology", "treatment", "risk factors"
    ]
    
    # Out-of-scope topics (hard refusal)
    OUT_OF_SCOPE_TOPICS = [
        # Other medical domains
        "heart", "cardiac", "diabetes", "blood pressure", "cholesterol",
        "covid", "flu", "pneumonia", "asthma", "allergy",
        "mental health", "depression", "anxiety", "psychiatry",
        # Diagnosis/Treatment
        "diagnosis", "diagnose me", "do i have", "treatment plan",
        "prescription", "medication", "drug", "surgery recommendation",
        "prognosis", "survival rate", "life expectancy",
        # Legal/Financial
        "lawsuit", "insurance", "billing", "legal", "malpractice",
    ]
    
    @classmethod
    def is_in_scope(cls, query: str) -> bool:
        """
        Check if query is within 7-lesion domain scope.
        
        Args:
            query: User query
            
        Returns:
            True if in scope, False otherwise
        """
        query_lower = query.lower()
        
        # Check for out-of-scope topics
        for topic in cls.OUT_OF_SCOPE_TOPICS:
            if topic in query_lower:
                logger.info(f"Query out of scope: detected '{topic}'")
                return False
        
        # Check for in-scope keywords
        has_scope_keyword = any(keyword in query_lower for keyword in cls.IN_SCOPE_KEYWORDS)
        
        return has_scope_keyword
    
    @classmethod
    def get_refusal_reason(cls, query: str) -> str:
        """
        Get reason for refusal if query is out of scope.
        
        Args:
            query: User query
            
        Returns:
            Refusal reason
        """
        query_lower = query.lower()
        
        # Detect specific out-of-scope topics
        for topic in cls.OUT_OF_SCOPE_TOPICS:
            if topic in query_lower:
                return f"detected_topic: {topic}"
        
        return "no_skin_cancer_keywords"


class SafetyPolicy:
    """Safety constraints for medical AI."""
    
    # Prohibited actions
    PROHIBITED_ACTIONS = [
        "diagnose",
        "confirm_diagnosis",
        "recommend_treatment",
        "prescribe",
        "predict_outcome",
        "predict_survival",
        "provide_prognosis",
        "give_legal_advice",
        "give_insurance_advice",
    ]
    
    # Required disclaimers
    MEDICAL_DISCLAIMER = (
        "\n\n*This is educational information only. "
        "Please consult a qualified dermatologist for proper diagnosis and treatment.*"
    )
    
    # Query length limits
    MAX_QUERY_LENGTH = 500
    MIN_QUERY_LENGTH = 3
    
    # Grounding requirements
    MIN_GROUNDING_SCORE = 0.7
    REQUIRE_CITATIONS = True
    
    @classmethod
    def check_query_safety(cls, query: str) -> Dict[str, Any]:
        """
        Check query for safety violations.
        
        Args:
            query: User query
            
        Returns:
            Dictionary with safety check results
        """
        violations = []
        
        # Check length
        if len(query) > cls.MAX_QUERY_LENGTH:
            violations.append({
                "type": "length_exceeded",
                "max": cls.MAX_QUERY_LENGTH,
                "actual": len(query)
            })
        
        if len(query) < cls.MIN_QUERY_LENGTH:
            violations.append({
                "type": "length_too_short",
                "min": cls.MIN_QUERY_LENGTH,
                "actual": len(query)
            })
        
        # Check for prohibited actions
        query_lower = query.lower()
        for action in cls.PROHIBITED_ACTIONS:
            if action.replace("_", " ") in query_lower:
                violations.append({
                    "type": "prohibited_action",
                    "action": action
                })
        
        return {
            "safe": len(violations) == 0,
            "violations": violations
        }


class MemoryPolicy:
    """Policies for memory storage (session and user memory)."""
    
    # Allowed memory types
    ALLOWED_MEMORY_TYPES = [
        "user_preference",        # e.g., "explain simply", "clinician mode"
        "citation_format",        # Preferred citation style
        "educational_context",    # Recurring educational topics
        "image_reference",        # Previous upload IDs (metadata only)
    ]
    
    # Prohibited memory content
    PROHIBITED_MEMORY_CONTENT = [
        "diagnosis",
        "treatment_plan",
        "prescription",
        "prognosis",
        "medical_history",
        "sensitive_health_data",
        "personal_identifying_info",
    ]
    
    # Memory retention limits
    SESSION_MEMORY_MAX_TURNS = 10
    USER_MEMORY_MAX_ITEMS = 50
    MEMORY_RETENTION_DAYS = 90
    
    @classmethod
    def validate_memory_write(cls, memory_type: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate memory write request.
        
        Args:
            memory_type: Type of memory to write
            content: Memory content
            
        Returns:
            Dictionary with validation results
        """
        errors = []
        
        # Check memory type
        if memory_type not in cls.ALLOWED_MEMORY_TYPES:
            errors.append({
                "type": "invalid_memory_type",
                "memory_type": memory_type,
                "allowed": cls.ALLOWED_MEMORY_TYPES
            })
        
        # Check content for prohibited items
        content_str = str(content).lower()
        for prohibited in cls.PROHIBITED_MEMORY_CONTENT:
            if prohibited.replace("_", " ") in content_str:
                errors.append({
                    "type": "prohibited_content",
                    "detected": prohibited
                })
        
        return {
            "valid": len(errors) == 0,
            "errors": errors
        }


class RolePolicy:
    """Role-based access control policies."""
    
    # User roles
    class Role(str, Enum):
        PATIENT = "patient"
        CLINICIAN = "clinician"
        ADMIN = "admin"
    
    # Role permissions
    ROLE_PERMISSIONS = {
        Role.PATIENT: {
            "read_own_data": True,
            "read_patient_data": False,
            "write_analysis": False,
            "delete_data": False,
            "manage_users": False,
            "view_detailed_metrics": False,
        },
        Role.CLINICIAN: {
            "read_own_data": True,
            "read_patient_data": True,
            "write_analysis": True,
            "delete_data": False,
            "manage_users": False,
            "view_detailed_metrics": True,
        },
        Role.ADMIN: {
            "read_own_data": True,
            "read_patient_data": True,
            "write_analysis": True,
            "delete_data": True,
            "manage_users": True,
            "view_detailed_metrics": True,
        }
    }
    
    @classmethod
    def has_permission(cls, role: str, permission: str) -> bool:
        """
        Check if role has permission.
        
        Args:
            role: User role
            permission: Permission to check
            
        Returns:
            True if role has permission, False otherwise
        """
        try:
            role_enum = cls.Role(role)
            permissions = cls.ROLE_PERMISSIONS.get(role_enum, {})
            return permissions.get(permission, False)
        except ValueError:
            logger.error(f"Invalid role: {role}")
            return False
    
    @classmethod
    def get_role_permissions(cls, role: str) -> Dict[str, bool]:
        """
        Get all permissions for a role.
        
        Args:
            role: User role
            
        Returns:
            Dictionary of permissions
        """
        try:
            role_enum = cls.Role(role)
            return cls.ROLE_PERMISSIONS.get(role_enum, {})
        except ValueError:
            logger.error(f"Invalid role: {role}")
            return {}


# Policy enforcement configuration
POLICY_CONFIG = {
    "enforcement_level": PolicyEnforcement.STRICT,
    "domain_policy": DomainPolicy,
    "safety_policy": SafetyPolicy,
    "memory_policy": MemoryPolicy,
    "role_policy": RolePolicy,
}
