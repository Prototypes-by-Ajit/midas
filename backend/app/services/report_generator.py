"""
Report Content Generation Service using the NVIDIA-hosted LLM.

Generates role-specific, per-analysis content for medical reports. The narrative
is driven by the CNN's full class-probability distribution (not just the top
label), so two analyses with the same diagnosis but different certainty produce
materially different reports.
"""
import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from openai import OpenAI

from app.config import settings
from app.contracts.report_contract import NARRATIVE_SECTIONS
from app.models.cnn_architecture import CLASS_DESCRIPTIONS
from app.services.nvidia_client import create_chat_completion

logger = logging.getLogger(__name__)


class NarrativeUnavailable(RuntimeError):
    """Nothing usable came back from the model.

    Raised rather than returned. A response with no narrative in it is a failure,
    and the one thing that must never happen is for it to become a document: a
    report whose sections are all empty renders as a clinical narrative with
    nothing in it, which is indistinguishable at a glance from a real one
    (FR-016a, spec edge case 4).
    """


# A model that declined is not a degraded report, it is no report. Openers only:
# matching mid-text would reject a genuine narrative that happens to discuss what
# the system cannot do -- which every "limitations" section does.
#
# Heuristic with a known ceiling: a refusal phrased unlike any of these reads as
# prose and classifies as degraded. That fails safe -- degraded is labelled,
# surfaced before the document opens, and names its absent sections -- so the
# worst case is an honest report with an odd summary, never a silent one.
REFUSAL_OPENER = re.compile(
    r"^\s*(i'?m sorry|i am sorry|i cannot|i can'?t|i'?m unable|i am unable|"
    r"unfortunately,?\s+i|as an ai|sorry,)",
    re.IGNORECASE,
)

# Below this, a lone summary is a fragment rather than a narrative. The shortest
# real prose response in the fixtures is ~250 characters.
MIN_USABLE_SUMMARY_CHARS = 40

# A full report is ~1500 tokens from a 70B model and measured at ~2 minutes;
# the nvidia_client helper's 60s default times out well before completion.
REPORT_LLM_TIMEOUT_SECONDS = 180

# Sampling parameters, shared by the blocking and streaming generators. Kept in
# one place so the two paths cannot drift into producing different narratives
# for the same analysis.
REPORT_TEMPERATURE = 0.3
REPORT_MAX_TOKENS = 1500
REPORT_TOP_P = 0.9


def get_nvidia_client() -> OpenAI:
    """Build the NVIDIA NIM client from application settings.

    Must read from `settings` (pydantic-settings loads .env/.env.backend) rather
    than os.getenv, which only sees vars the shell exported.
    """
    if not settings.nvidia_api_key:
        raise ValueError("NVIDIA_API_KEY is not configured (checked .env / .env.backend)")
    return OpenAI(
        base_url=settings.nvidia_base_url,
        api_key=settings.nvidia_api_key,
    )


def to_percent(value: Any) -> float:
    """Normalize a confidence to a 0-100 percentage.

    The CNN emits a 0-1 softmax score and `medical_analyses.confidence` stores it
    that way, but templates and prompts render it as a percentage. Tolerate both
    so legacy rows and any future 0-100 rows both render correctly.
    """
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return number * 100.0 if number <= 1.0 else number


def _coerce_metrics(analysis: Dict[str, Any]) -> Dict[str, Any]:
    """classification_metrics is jsonb; supabase-py may hand it back as a str."""
    metrics = analysis.get("classification_metrics") or {}
    if isinstance(metrics, str):
        try:
            metrics = json.loads(metrics)
        except (ValueError, TypeError):
            return {}
    return metrics if isinstance(metrics, dict) else {}


def ranked_probabilities(analysis: Dict[str, Any]) -> List[Tuple[str, float]]:
    """Return [(readable class name, percentage)] sorted high to low.

    Empty for analyses recorded before class_probabilities was persisted.
    """
    probabilities = _coerce_metrics(analysis).get("class_probabilities") or {}
    if not isinstance(probabilities, dict):
        return []

    ranked: List[Tuple[str, float]] = []
    for code, value in probabilities.items():
        try:
            percentage = float(value) * 100.0
        except (TypeError, ValueError):
            continue
        label = CLASS_DESCRIPTIONS.get(code, code)
        ranked.append((f"{label} ({code})", percentage))

    ranked.sort(key=lambda item: item[1], reverse=True)
    return ranked


def build_evidence_block(analysis: Dict[str, Any]) -> str:
    """Render the per-case model evidence that makes each report unique."""
    diagnosis = analysis.get("diagnosis", "Unknown")
    confidence = to_percent(analysis.get("confidence", 0))
    risk_level = str(analysis.get("risk_level") or "unknown").upper()
    metrics = _coerce_metrics(analysis)
    ranked = ranked_probabilities(analysis)

    lines = [
        f"Primary classification: {diagnosis} — {confidence:.1f}%",
        f"Risk tier: {risk_level}",
    ]

    if len(ranked) > 1:
        differential = " · ".join(f"{name} {pct:.1f}%" for name, pct in ranked[1:4])
        lines.append(f"Differential (next most probable): {differential}")

    top2_gap = metrics.get("top2_gap")
    if isinstance(top2_gap, (int, float)):
        lines.append(
            f"Margin over second-ranked class: {float(top2_gap) * 100:.1f} percentage points"
        )

    entropy = metrics.get("entropy")
    if isinstance(entropy, (int, float)):
        lines.append(
            f"Distribution entropy: {float(entropy):.3f} "
            "(0 = fully certain, ~1.95 = uniform across the 7 classes)"
        )

    if not ranked:
        lines.append(
            "Note: the full class-probability distribution was not recorded for this "
            "analysis. Base the certainty discussion on the confidence value alone and "
            "state that a full differential is unavailable."
        )

    return "\n".join(lines)


CERTAINTY_GUIDANCE = """
Interpreting the numbers (this is what must make each report specific):
- A large margin over the second class (>50 points) with low entropy means the model
  is decisive; say so plainly.
- A narrow margin (<15 points) or high entropy means the model is genuinely torn
  between the listed classes. Name the competing classes explicitly and let that
  uncertainty shape the urgency of your advice.
- Never describe a low-confidence result as though it were confident, or vice versa.
""".strip()

JSON_CONTRACT = """
Respond with a single JSON object and nothing else. No markdown fences, no prose
outside the object. Use plain text inside every string — no markdown syntax
(no **bold**, no ##, no bullet characters), because these strings are inserted
directly into an HTML document.

{
  "summary": "the main narrative, plain prose, paragraphs separated by \\n\\n",
  "observations": "a short paragraph on what in the probability distribution drove this classification",
  "recommendations": ["actionable step", "actionable step"],
  "limitations": "a short paragraph on uncertainty and what this analysis cannot establish"
}
""".strip()

PATIENT_REPORT_SYSTEM_PROMPT = f"""You are a compassionate medical AI assistant helping to explain dermatology analysis results to patients.

Your role:
- Explain medical findings in simple, non-technical language
- Provide reassurance while being honest about findings
- Emphasize the importance of consulting a dermatologist
- Avoid medical jargon; if you must use it, explain it clearly
- Focus on what the patient should do next

Important guidelines:
- This is NOT a medical diagnosis - it's an AI screening tool
- Always recommend consulting a healthcare professional
- Be clear about confidence levels and uncertainty
- Use encouraging language that reduces anxiety

{CERTAINTY_GUIDANCE}

{JSON_CONTRACT}"""

CLINICIAN_REPORT_SYSTEM_PROMPT = f"""You are a specialized dermatology AI assistant generating clinical reports for healthcare professionals.

Your role:
- Provide detailed, evidence-based clinical analysis
- Use appropriate medical terminology
- Include differential diagnoses grounded in the probability distribution provided
- Present statistical confidence with appropriate context
- Highlight areas requiring clinical correlation

Important guidelines:
- This is an AI-assisted screening tool, not a definitive diagnosis
- Clinical judgment and physical examination are essential
- Note the limitations of image-based analysis
- Reason only from the data supplied; never invent metrics that were not given

{CERTAINTY_GUIDANCE}

{JSON_CONTRACT}"""


def build_user_prompt(analysis: Dict[str, Any], report_type: str) -> str:
    """Assemble the per-analysis prompt. Deterministic and network-free."""
    # Deliberately does not read `detected_features`. That column holds
    # pipeline-generated placeholders, not measurements, and historical rows
    # still contain them -- reading it here would launder a fabrication into
    # fresh clinical narrative every time an old analysis is re-reported.
    evidence = build_evidence_block(analysis)

    if report_type == "clinician_report":
        return f"""Generate a clinical report for the following skin lesion analysis.

**Model evidence:**
{evidence}

Write for a clinician. In "summary", give a clinical interpretation of these
findings and work through the differential implied by the probability
distribution above. In "observations", explain what in the
probability distribution and certainty metrics drove this classification, and
name the competing classes. Do not describe lesion morphology: no morphological
measurement was supplied to you. In "recommendations", give specific follow-up and
management steps proportionate to the risk tier and the model's certainty. In
"limitations", state what image-based analysis cannot establish here."""

    if report_type == "detailed_analysis":
        return f"""Generate a detailed but patient-friendly report for the following skin lesion analysis.

**Model evidence:**
{evidence}

Write for a patient who wants depth. In "summary", explain in 2-3 paragraphs
what the AI found, how sure it is, and what the alternatives it considered mean.
In "observations", explain which classes the model weighed against each other
and how close the call was. Do not describe features of the lesion itself --
you have been given the model's output, not a morphological assessment. In "recommendations", give concrete next steps including what changes to
watch for. In "limitations", explain plainly what this screening cannot tell them."""

    return f"""Generate a patient-friendly report summary for the following skin lesion analysis.

**Model evidence:**
{evidence}

Write for a patient. In "summary", give 1-2 short paragraphs in everyday
language explaining what this result means and how confident the system is. In
"observations", say in one or two sentences which other conditions the system
considered and how clear-cut the result was. In "recommendations", give
clear next steps. In "limitations", explain in one short paragraph why this is
not a diagnosis."""


def parse_llm_json(raw: str) -> Dict[str, Any]:
    """Parse the model's JSON response, tolerating fences and stray prose.

    Falls back to treating the whole response as the summary rather than raising:
    a well-formed narrative in the wrong shape is still worth showing.
    """
    text = (raw or "").strip()

    fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()

    candidates = [text]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start:end + 1])

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except (ValueError, TypeError):
            continue
        if isinstance(parsed, dict):
            return parsed

    logger.warning("LLM report response was not valid JSON; using raw text as summary")
    return {"summary": raw}


def _as_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        # Model occasionally returns a newline- or bullet-delimited string.
        items = [re.sub(r"^[\-\*•\d\.\)\s]+", "", line).strip()
                 for line in value.splitlines()]
        return [item for item in items if item]
    return []


def normalize_llm_content(parsed: Dict[str, Any], model_used: str) -> Dict[str, Any]:
    """Coerce a parsed LLM response into the shape the PDF renderer expects.

    Shared by the blocking and streaming generators so both emit identical keys.
    Missing keys become empty rather than absent: the templates gate each section
    on truthiness, so an omitted field drops its section instead of rendering
    "None".
    """
    return {
        "summary": str(parsed.get("summary") or "").strip(),
        "observations": str(parsed.get("observations") or "").strip(),
        "recommendations": _as_list(parsed.get("recommendations")),
        "limitations": str(parsed.get("limitations") or "").strip(),
        "model_used": model_used,
        "temperature": REPORT_TEMPERATURE,
    }


def _name_sections(sections: List[str]) -> str:
    """"a and b" / "a, b and c" -- the reason a person reads, not a key list."""
    if len(sections) == 1:
        return sections[0]
    return f"{', '.join(sections[:-1])} and {sections[-1]}"


def build_provenance(content: Dict[str, Any], model_used: str) -> Dict[str, Any]:
    """Classify what the model actually produced, on usable content.

    The old code classified on *parseability*: valid JSON was a report, anything
    else fell back to `{"summary": raw}` with a `logger.warning` and rendered as
    though nothing had happened. Parseability is not the question. A refusal
    parses fine as prose; an empty response normalizes to four empty strings and
    renders as a clinical narrative with nothing in it.

    Three outcomes, and only three:
      all four sections   -> complete, `degraded_reason is None`
      some usable content -> degraded, naming every absent section
      nothing usable      -> raise (FR-016, FR-016a, FR-018)

    `generator` is the model that actually answered, never a constant: a report
    is only reproducible if the record says what produced it.
    """
    summary = content.get("summary") or ""

    sections_generated = {
        section: bool(content.get(section)) for section in NARRATIVE_SECTIONS
    }
    present = [section for section in NARRATIVE_SECTIONS if sections_generated[section]]

    if not present:
        raise NarrativeUnavailable(
            "The model returned no usable narrative for this report."
        )

    if REFUSAL_OPENER.match(summary):
        raise NarrativeUnavailable("The model declined to produce this narrative.")

    if present == ["summary"] and len(summary.strip()) < MIN_USABLE_SUMMARY_CHARS:
        raise NarrativeUnavailable(
            "The model returned a fragment too short to be a report narrative."
        )

    absent = [section for section in NARRATIVE_SECTIONS if not sections_generated[section]]
    degraded_reason = (
        None
        if not absent
        else f"{_name_sections(absent)} were not generated for this report."
        if len(absent) > 1
        else f"{absent[0]} was not generated for this report."
    )

    if degraded_reason:
        logger.warning(
            "Report narrative degraded (model=%s): %s", model_used, degraded_reason
        )

    return {
        "sections_generated": sections_generated,
        "generator": model_used,
        "degraded_reason": degraded_reason,
    }


def system_prompt_for(report_type: str) -> str:
    """Pick the role prompt. Only clinician_report differs from the patient voice."""
    return (
        CLINICIAN_REPORT_SYSTEM_PROMPT
        if report_type == "clinician_report"
        else PATIENT_REPORT_SYSTEM_PROMPT
    )


async def generate_llm_content(analysis: Dict[str, Any], report_type: str) -> Dict[str, Any]:
    """
    Generate per-analysis LLM content for a medical report.

    Args:
        analysis: the medical_analyses row
        report_type: 'patient_report', 'diagnostic_summary', 'detailed_analysis'
                     or 'clinician_report'

    Returns:
        Dict with 'summary', 'observations', 'recommendations' (list),
        'limitations', 'model_used' and 'provenance' -- the last being what the
        caller serialises into the `X-Report-*` headers and persists into the
        `014` columns.

    Raises:
        NarrativeUnavailable: nothing usable came back.
        Exception: on any LLM failure. Callers must surface both - silently
        substituting boilerplate makes a failed report indistinguishable from a
        real one.
    """
    client = get_nvidia_client()

    # create_chat_completion is synchronous; keep it off the event loop.
    chat_completion, used_model = await asyncio.to_thread(
        create_chat_completion,
        client,
        messages=[
            {"role": "system", "content": system_prompt_for(report_type)},
            {"role": "user", "content": build_user_prompt(analysis, report_type)},
        ],
        model=settings.nvidia_model,
        temperature=REPORT_TEMPERATURE,
        max_tokens=REPORT_MAX_TOKENS,
        top_p=REPORT_TOP_P,
        timeout=REPORT_LLM_TIMEOUT_SECONDS,
    )

    content = normalize_llm_content(
        parse_llm_json(chat_completion.choices[0].message.content),
        used_model,
    )
    # Raises when nothing usable came back, so an empty or refused response can
    # never reach the renderer.
    content["provenance"] = build_provenance(content, used_model)
    return content
