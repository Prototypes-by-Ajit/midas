"""
Medical Report Generation API Endpoint
Handles PDF generation for patient and clinician reports
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from fastapi.routing import APIRoute
from pydantic import BaseModel, Field
from typing import Any, Callable, Coroutine, Dict, Optional
from fastapi.responses import JSONResponse, Response
import asyncio
import base64
import logging
import os
import secrets

from app.contracts.report_contract import NARRATIVE_SECTIONS, REPORT_TYPES, error_body

logger = logging.getLogger(__name__)


# Status -> machine code. The caller branches on `code`, never on the prose.
_ERROR_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "ANALYSIS_NOT_FOUND",
    422: "INVALID_REPORT_TYPE",
    500: "INTERNAL",
    503: "SERVICE_UNAVAILABLE",
}


class _EnvelopeRoute(APIRoute):
    """Every error this router emits uses the contract §6 envelope.

    FastAPI's default handler returns `{"detail": …}`, which is not the shape the
    orchestrator parses, and a `raise HTTPException` inside a dependency never
    reaches the endpoint's own `except` block. An app-level exception handler
    would fix the shape but would not travel with the router -- it would have to
    be re-registered by every app that mounts it, and silently degrade to
    `{"detail": …}` wherever someone forgot. Converting on the route class means
    the envelope is a property of these endpoints rather than of their host.
    """

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        original_handler = super().get_route_handler()

        async def envelope_handler(request: Request) -> Response:
            try:
                return await original_handler(request)
            except HTTPException as exc:
                code = _ERROR_CODES.get(exc.status_code, "INTERNAL")
                return JSONResponse(
                    status_code=exc.status_code,
                    content=error_body(code, str(exc.detail)),
                    headers=exc.headers,
                )

        return envelope_handler


router = APIRouter(prefix="/reports", tags=["reports"], route_class=_EnvelopeRoute)


def validate_report_type(report_type: str) -> str:
    """Return the report type, or refuse it.

    This used to coerce anything unrecognised to `diagnostic_summary` and return
    it silently. Asking for a clinician report and receiving a patient summary,
    labelled as what you asked for, is worse than being refused: the substitution
    is invisible in the document, and a clinician reading it has no way to know
    they are looking at prose written for a patient (FR-010, FR-011).

    The refusal names all four supported types, because a caller that guessed
    wrong needs to know what to guess instead.
    """
    if report_type in REPORT_TYPES:
        return report_type

    raise HTTPException(
        status_code=422,
        detail=(
            "Unsupported report type. Supported types are: "
            f"{', '.join(REPORT_TYPES)}."
        ),
    )


# Pydantic models
class ReportConfig(BaseModel):
    """Configuration for report generation"""
    includeImages: bool = True
    includeDetailedFeatures: bool = True
    includeRecommendations: bool = True
    includeDisclaimer: bool = True


class GenerateReportRequest(BaseModel):
    """Request model for report generation"""
    report_id: str = Field(..., description="UUID of the report record")
    analysis_id: str = Field(..., description="UUID of the analysis")
    report_type: str = Field(..., description="Type: diagnostic_summary, detailed_analysis, patient_report, or clinician_report")
    user_id: str = Field(..., description="Clerk user ID")
    report_number: Optional[str] = Field(None, description="Report number from the generated_reports row")
    config: ReportConfig = Field(default_factory=ReportConfig)


class GenerateReportResponse(BaseModel):
    """Response model for report generation"""
    success: bool
    report_id: str
    message: str


# Dependency: Verify API key
async def verify_api_key(authorization: Optional[str] = Header(None)):
    """Verify the shared secret the orchestrator authenticates with.

    There is no default and no fallback. The previous code substituted a
    hardcoded placeholder key whenever `BACKEND_API_KEY` was unset and logged a
    warning nobody reads — so a credential published in this repository
    authorised report generation on any deployment that forgot to set the
    variable, which is exactly the deployment most likely to forget (FR-007).

    An unconfigured service refuses with **503**, not 401: the caller's
    credential was never the problem, and telling them it was sends whoever is
    debugging to the wrong side of the connection.

    No local-test bypass mode ships, deliberately. A second authentication path
    is one environment-variable mistake away from production, and this repo sets
    no `ENV` variable that such a flag could be gated against.
    """
    expected_key = os.getenv("BACKEND_API_KEY")
    if not expected_key:
        logger.error(
            "BACKEND_API_KEY is not configured; refusing every report request. "
            "Set it in .env / .env.backend."
        )
        raise HTTPException(
            status_code=503,
            detail="The report service is not configured to accept requests.",
        )

    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    # Extract Bearer token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization[7:]  # Remove "Bearer " prefix

    # Constant-time: a plain `!=` returns as soon as two bytes differ, and the
    # timing difference is measurable across enough requests.
    if not secrets.compare_digest(token, expected_key):
        raise HTTPException(status_code=401, detail="Invalid API key")

    return True


# Dependency: Get Supabase client
def get_supabase():
    """Create Supabase client with service role"""
    from supabase import create_client

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase credentials not configured")

    return create_client(supabase_url, supabase_key)


def _load_heatmap_data_uri(supabase, heatmap_path: str) -> Optional[str]:
    """Download the Grad-CAM PNG and inline it as a data URI.

    This used to hand WeasyPrint a signed URL, which meant `write_pdf()` made an
    un-timeoutable HTTPS round trip in the middle of rendering and the PDF failed
    -- silently, as a broken-image gap -- whenever storage was slow. Downloading
    up front keeps the network out of the render entirely.
    """
    for bucket in ("report_storage", "AI_image_storage"):
        try:
            raw = supabase.storage.from_(bucket).download(heatmap_path)
        except Exception:
            continue
        if raw:
            return "data:image/png;base64," + base64.b64encode(raw).decode("ascii")

    logger.warning("Heatmap not found in either bucket: %s", heatmap_path)
    return None


def _build_report_context(
    request: "GenerateReportRequest",
    supabase,
) -> Dict[str, Any]:
    """Fetch the owner's analysis and inline heatmap, then assemble the render payload.

    Synchronous, because supabase-py is: callers must run this via
    `asyncio.to_thread` so two network calls don't sit on the event loop.

    The owner filter is unconditional. It used to be opt-in and default off, on
    the reasoning that the `generate-report` edge function derives its caller
    from a Supabase auth JWT while `medical_analyses.user_id` holds Clerk ids, so
    the filter could never match for that caller. That edge function is not on
    the live path — the orchestrator route calls this service directly — and the
    cost of the exemption was that any caller holding the shared secret could
    render any person's analysis. This service confirms ownership itself rather
    than trusting its caller to have done so (FR-005, FR-006): `request.user_id`
    is the ownership filter, never proof of identity.

    An analysis owned by anyone else is not found. The refusal happens here,
    before the overlay is downloaded and before anything is rendered.
    """
    rows = (
        supabase.table("medical_analyses")
        .select("*")
        .eq("id", request.analysis_id)
        .eq("user_id", request.user_id)
        .limit(1)
        .execute()
        .data
    ) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Analysis not found")
    analysis = rows[0]

    heatmap_url = None
    if analysis.get("heatmap_path"):
        heatmap_url = _load_heatmap_data_uri(supabase, analysis["heatmap_path"])

    return {
        "report_id": request.report_id,
        "report_type": validate_report_type(request.report_type),
        "analysis": analysis,
        "heatmap_url": heatmap_url,
        "config": request.config.dict(),
        "user_id": request.user_id,
        "report_number": request.report_number,
    }


def _provenance_headers(provenance: Dict[str, Any]) -> Dict[str, str]:
    """Serialise provenance into the contract §3 response headers."""
    sections = provenance["sections_generated"]
    headers = {
        "X-Report-Sections": ",".join(
            section for section in NARRATIVE_SECTIONS if sections.get(section)
        ),
        "X-Report-Generator": provenance["generator"] or "",
    }
    if provenance["degraded_reason"]:
        headers["X-Report-Degraded"] = provenance["degraded_reason"]
    return headers


@router.post("/generate", response_model=GenerateReportResponse)
async def generate_report(
    request: GenerateReportRequest,
    authorized: bool = Depends(verify_api_key),
    supabase = Depends(get_supabase)
) -> Response:
    """
    Generate medical report PDF

    This endpoint:
    1. Fetches analysis data from Supabase
    2. Calls Groq LLM for report content generation
    3. Generates HTML from template
    4. Converts HTML to PDF using WeasyPrint
    5. Returns PDF as bytes

    Called by: Supabase Edge Function (generate-report)
    """
    try:
        # Refused before anything is fetched, rendered, or written.
        normalized_report_type = validate_report_type(request.report_type)

        # 1. Fetch the owner's analysis, inline the overlay, assemble the payload.
        #
        # This is `_build_report_context`, written for exactly this and never
        # called. The duplicated block it replaces fetched the row with no owner
        # predicate at all, and handed WeasyPrint a signed URL — so `write_pdf()`
        # made an un-timeoutable HTTPS round trip in the middle of rendering, and
        # a slow storage response surfaced as a broken-image gap in a finished
        # medical document. The helper downloads the overlay up front instead.
        # Off the event loop: two blocking supabase-py calls, one of which
        # downloads an image.
        report_data = await asyncio.to_thread(_build_report_context, request, supabase)
        analysis = report_data["analysis"]

        # 2. Generate LLM content. A failure here propagates to the 500 handler
        # below on purpose: a report without its AI narrative is not a report.
        from app.services.report_generator import generate_llm_content
        llm_content = await generate_llm_content(analysis, normalized_report_type)
        report_data["llm_summary"] = llm_content["summary"]
        report_data["llm_observations"] = llm_content.get("observations", "")
        report_data["llm_recommendations"] = llm_content.get("recommendations", [])
        report_data["llm_limitations"] = llm_content.get("limitations", "")

        provenance = llm_content["provenance"]
        report_data["provenance"] = provenance

        # 3. Generate PDF. WeasyPrint is synchronous and CPU-bound; rendering it
        # inline froze the event loop that also serves chat for the whole render.
        from app.services.pdf_generator import generate_pdf
        pdf_bytes = await asyncio.to_thread(generate_pdf, report_data, normalized_report_type)

        # 4. Return the document, with what produced it in the headers.
        #
        # The body is PDF bytes, so the orchestrator would otherwise have to parse
        # the document to learn whether the narrative was complete -- which it
        # cannot do, and which is why a degraded report used to be persisted as
        # `completed`. `X-Report-Degraded` is *omitted* when complete rather than
        # sent empty: an empty header reads as a reason nobody wrote.
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=report_{request.report_id}.pdf",
                **_provenance_headers(provenance),
            }
        )

    except HTTPException:
        raise
    except Exception:
        # Server-side only, with the traceback. The exception text routinely
        # carries the thing that must not travel: an upstream 401 quotes the
        # NVIDIA key, a storage error quotes a path belonging to whoever owns the
        # bucket object. `str(e)` used to go straight into the browser response
        # *and* into `error_message`, where it was rendered back to the user.
        logger.exception(
            "Report generation failed (report_id=%s, type=%s)",
            request.report_id,
            request.report_type,
        )
        raise HTTPException(
            status_code=500,
            detail="The report could not be generated.",
        )


@router.get("/health")
async def health_check():
    """Report the dependencies the report path actually uses.

    Each field mirrors the *same resolution mechanism* as the code it reports on,
    because the two differ and a check that picks the wrong one lies in both
    directions:

    - the narrative generator reads ``settings.nvidia_api_key``
      (pydantic-settings, which loads .env/.env.backend), so ``os.getenv`` here
      would report "not configured" for a generator that works fine;
    - ``get_supabase()`` reads ``os.getenv`` and accepts two spellings for the
      URL and two for the key, so checking only ``SUPABASE_URL`` /
      ``SUPABASE_SERVICE_KEY`` reported a broken service whenever the
      ``NEXT_PUBLIC_`` / ``SERVICE_ROLE`` spellings were the ones in use.

    ``groq_configured`` is gone: GROQ_API_KEY is a legacy alias that no report
    code path reads.
    """
    from app.config import settings

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    nvidia_configured = bool(settings.nvidia_api_key)
    supabase_configured = bool(supabase_url and supabase_key)

    missing = [
        name for name, ok in (
            ("NVIDIA_API_KEY", nvidia_configured),
            ("supabase_credentials", supabase_configured),
        ) if not ok
    ]

    return {
        # Reports cannot be produced without both, so the status must say so.
        # Reporting "healthy" with no narrative credential is the defect this
        # endpoint had (C4, FR-046, FR-047).
        "status": "healthy" if not missing else "unhealthy",
        "missing": missing,
        "service": "report-generation",
        "nvidia_configured": nvidia_configured,
        # D-5: the generator identity the narrative would actually resolve to.
        # Reported unconditionally -- an identifier is configuration, not a secret.
        "generator": settings.nvidia_model,
        "supabase_configured": supabase_configured,
        # Which spelling resolved -- the whole point of the four-way check.
        "supabase_url_source": (
            "SUPABASE_URL" if os.getenv("SUPABASE_URL")
            else "NEXT_PUBLIC_SUPABASE_URL" if os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            else None
        ),
        "supabase_key_source": (
            "SUPABASE_SERVICE_KEY" if os.getenv("SUPABASE_SERVICE_KEY")
            else "SUPABASE_SERVICE_ROLE_KEY" if os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            else None
        ),
    }
