"""
Report Content Generation Service using Groq LLM
Generates role-specific content for medical reports
"""
import os
from typing import Dict, Any
from groq import Groq


# Initialize Groq client
def get_groq_client() -> Groq:
    """Get Groq API client"""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable not set")
    return Groq(api_key=api_key)


# System prompts for different report types
PATIENT_REPORT_SYSTEM_PROMPT = """You are a compassionate medical AI assistant helping to explain dermatology analysis results to patients.

Your role:
- Explain medical findings in simple, non-technical language
- Provide reassurance while being honest about findings
- Emphasize the importance of consulting a dermatologist
- Use a warm, supportive tone
- Avoid medical jargon; if you must use it, explain it clearly
- Focus on what the patient should do next

Important guidelines:
- This is NOT a medical diagnosis - it's an AI screening tool
- Always recommend consulting a healthcare professional
- Be clear about confidence levels and uncertainty
- Use encouraging language that reduces anxiety
- Explain what the detected features mean in everyday language"""

CLINICIAN_REPORT_SYSTEM_PROMPT = """You are a specialized dermatology AI assistant generating clinical reports for healthcare professionals.

Your role:
- Provide detailed, evidence-based clinical analysis
- Use appropriate medical terminology
- Include differential diagnoses when relevant
- Reference clinical guidelines and literature when applicable
- Present statistical confidence with appropriate context
- Highlight areas requiring clinical correlation
- Always include a concise "Medical Observations" section describing lesion morphology

Important guidelines:
- This is an AI-assisted screening tool, not a definitive diagnosis
- Clinical judgment and physical examination are essential
- Note limitations of image-based analysis
- Provide actionable clinical recommendations
- Be precise and professional in language"""


async def generate_llm_content(analysis: Dict[str, Any], report_type: str) -> Dict[str, str]:
    """
    Generate LLM content for medical report

    Args:
        analysis: Analysis data from database
        report_type: 'diagnostic_summary', 'detailed_analysis', or 'clinician_report'

    Returns:
        Dict with 'summary' and 'recommendations' keys
    """
    try:
        client = get_groq_client()

        # Select appropriate system prompt
        system_prompt = CLINICIAN_REPORT_SYSTEM_PROMPT if report_type == "clinician_report" else PATIENT_REPORT_SYSTEM_PROMPT

        # Prepare analysis details
        diagnosis = analysis.get("diagnosis", "Unknown")
        confidence = analysis.get("confidence", 0)
        risk_level = analysis.get("risk_level", "unknown")
        detected_features = analysis.get("detected_features", [])
        recommendations = analysis.get("recommendations", [])

        # Get classification metrics for clinician reports
        metrics = analysis.get("classification_metrics", {})

        # Build user prompt based on report type
        if report_type in ["patient_report", "diagnostic_summary"]:
            user_prompt = f"""Generate a patient-friendly medical report summary for the following skin lesion analysis:

**Analysis Result:**
- Diagnosis: {diagnosis}
- Confidence Level: {confidence:.1f}%
- Risk Level: {risk_level.upper()}

**Detected Features:**
{chr(10).join(f"- {feature}" for feature in detected_features) if detected_features else "No specific features noted"}

**AI Recommendations:**
{chr(10).join(f"- {rec}" for rec in recommendations) if recommendations else "Please consult a dermatologist"}

Please provide:
1. A clear, compassionate summary explaining what this means in simple terms (1-2 short paragraphs)
2. Specific next steps the patient should take (bulleted list)

Remember: Be reassuring but honest, avoid medical jargon, and always emphasize consulting a healthcare professional."""

        elif report_type == "detailed_analysis":
            user_prompt = f"""Generate a detailed, patient-friendly analysis report for the following skin lesion analysis:

**Analysis Result:**
- Diagnosis: {diagnosis}
- Confidence Level: {confidence:.1f}%
- Risk Level: {risk_level.upper()}

**Detected Features:**
{chr(10).join(f"- {feature}" for feature in detected_features) if detected_features else "No specific features noted"}

**AI Recommendations:**
{chr(10).join(f"- {rec}" for rec in recommendations) if recommendations else "Please consult a dermatologist"}

Please provide:
1. A detailed summary explaining the lesion appearance and why the AI reached this conclusion (2-3 paragraphs)
2. A short "What to watch for" section (bullet list)
3. Specific next steps the patient should take (bullet list)

Keep language friendly, avoid unnecessary jargon, and emphasize clinical follow-up."""

        else:  # clinician_report
            metrics_str = f"""**Classification Metrics:**
- Precision: {metrics.get('precision', 0):.3f}
- Recall: {metrics.get('recall', 0):.3f}
- F1-Score: {metrics.get('f1_score', 0):.3f}
- AUC-ROC: {metrics.get('auc_roc', 0):.3f}
- Sensitivity: {metrics.get('sensitivity', 0):.3f}
- Specificity: {metrics.get('specificity', 0):.3f}
- PPV: {metrics.get('ppv', 0):.3f}
- NPV: {metrics.get('npv', 0):.3f}"""

            user_prompt = f"""Generate a clinical report summary for the following skin lesion analysis:

**Diagnosis:** {diagnosis}
**Model Confidence:** {confidence:.1f}%
**Risk Stratification:** {risk_level.upper()}

**Morphological Features Detected:**
{chr(10).join(f"- {feature}" for feature in detected_features) if detected_features else "No specific features flagged"}

{metrics_str if metrics else ""}

**AI-Generated Recommendations:**
{chr(10).join(f"- {rec}" for rec in recommendations) if recommendations else "Clinical correlation required"}

Please provide:
1. **Medical Observations:** a concise description of lesion morphology and key visual characteristics (short paragraph)
2. A detailed clinical interpretation of these findings (2-3 paragraphs)
3. Differential diagnosis considerations if applicable
4. Specific clinical recommendations for follow-up and management (bulleted list)
5. Any limitations or areas requiring clinical correlation

Use appropriate medical terminology and reference relevant clinical guidelines where applicable."""

        # Call Groq API
        report_model = os.getenv("GROQ_REPORT_MODEL", "llama-3.1-8b-instant")
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model=report_model,
            temperature=0.3,  # Lower temperature for more focused, factual output
            max_tokens=1500,
            top_p=0.9
        )

        # Extract generated content
        generated_text = chat_completion.choices[0].message.content

        # Split into summary and recommendations
        # Try to identify sections in the response
        if "Next Steps:" in generated_text or "Recommendations:" in generated_text:
            parts = generated_text.split("Next Steps:" if "Next Steps:" in generated_text else "Recommendations:")
            summary = parts[0].strip()
            recommendations_text = parts[1].strip() if len(parts) > 1 else ""
        elif "\n\n" in generated_text:
            # If no clear section markers, use paragraph breaks
            parts = generated_text.split("\n\n", 1)
            summary = parts[0].strip()
            recommendations_text = parts[1].strip() if len(parts) > 1 else ""
        else:
            summary = generated_text
            recommendations_text = ""

        return {
            "summary": summary,
            "recommendations": recommendations_text,
            "model_used": "llama-3.1-70b-versatile",
            "temperature": 0.3
        }

    except Exception as e:
        print(f"Error generating LLM content: {str(e)}")
        # Return fallback content
        return {
            "summary": f"AI Analysis detected: {analysis.get('diagnosis', 'Unknown')} with {analysis.get('confidence', 0):.1f}% confidence. Please consult a healthcare professional for proper evaluation.",
            "recommendations": "Schedule an appointment with a dermatologist for clinical evaluation and definitive diagnosis.",
            "model_used": "fallback",
            "error": str(e)
        }
