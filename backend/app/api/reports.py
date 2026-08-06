"""
Medical Report Generation API Endpoint
Handles PDF generation for patient and clinician reports
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Any, AsyncIterator, Dict, Optional
from fastapi.responses import Response, StreamingResponse
import asyncio
import base64
import json
import logging
import os
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


def normalize_report_type(report_type: str) -> str:
    """Normalize incoming report type to supported backend values."""
    allowed_types = {
        "diagnostic_summary",
        "detailed_analysis",
        "patient_report",
        "clinician_report"
    }
    return report_type if report_type in allowed_types else "diagnostic_summary"


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
    """Verify the backend API key from Edge Function"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    # Extract Bearer token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization[7:]  # Remove "Bearer " prefix

    expected_key = os.getenv("BACKEND_API_KEY")
    if not expected_key:
        expected_key = "test-key"
        print("⚠️  BACKEND_API_KEY not configured, falling back to test-key")

    if token != expected_key:
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
    scope_user: bool = False,
) -> Dict[str, Any]:
    """Fetch the analysis row and inline heatmap, then assemble the render payload.

    Synchronous, because supabase-py is: callers must run this via
    `asyncio.to_thread` so two network calls don't sit on the event loop.

    `scope_user` additionally filters on the Clerk user id. The streaming route
    sets it as defence in depth; the original route deliberately does not,
    because the `generate-report` edge function derives its caller from a
    Supabase auth JWT while `medical_analyses.user_id` holds Clerk ids, so the
    filter would never match for that caller.
    """
    query = supabase.table("medical_analyses").select("*").eq("id", request.analysis_id)
    if scope_user:
        query = query.eq("user_id", request.user_id)

    rows = query.limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Analysis not found")
    analysis = rows[0]

    heatmap_url = None
    if analysis.get("heatmap_path"):
        heatmap_url = _load_heatmap_data_uri(supabase, analysis["heatmap_path"])

    return {
        "report_id": request.report_id,
        "report_type": normalize_report_type(request.report_type),
        "analysis": analysis,
        "heatmap_url": heatmap_url,
        "config": request.config.dict(),
        "user_id": request.user_id,
        "report_number": request.report_number,
    }


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
        normalized_report_type = normalize_report_type(request.report_type)

        # 1. Fetch analysis data
        analysis_response = supabase.table("medical_analyses").select("*").eq("id", request.analysis_id).single().execute()

        if not analysis_response.data:
            raise HTTPException(status_code=404, detail="Analysis not found")

        analysis = analysis_response.data

        # 2. Fetch heatmap if exists
        heatmap_url = None
        if analysis.get("heatmap_path"):
            try:
                # Generate signed URL for heatmap (1 hour)
                heatmap_signed = supabase.storage.from_("report_storage").create_signed_url(
                    analysis["heatmap_path"], 3600
                )
                if heatmap_signed:
                    heatmap_url = heatmap_signed.get("signedUrl")
            except Exception:
                # Fallback to AI_image_storage if report_storage doesn't have it
                try:
                    heatmap_signed = supabase.storage.from_("AI_image_storage").create_signed_url(
                        analysis["heatmap_path"], 3600
                    )
                    if heatmap_signed:
                        heatmap_url = heatmap_signed.get("signedUrl")
                except Exception as fallback_error:
                    print(f"Heatmap signed URL failed: {fallback_error}")

        # 3. Prepare data for report generation
        report_data = {
            "report_id": request.report_id,
            "report_type": normalized_report_type,
            "analysis": analysis,
            "heatmap_url": heatmap_url,
            "config": request.config.dict(),
            "user_id": request.user_id,
            "report_number": request.report_number
        }

        # 4. Generate LLM content. A failure here propagates to the 500 handler
        # below on purpose: a report without its AI narrative is not a report.
        from app.services.report_generator import generate_llm_content
        llm_content = await generate_llm_content(analysis, normalized_report_type)
        report_data["llm_summary"] = llm_content["summary"]
        report_data["llm_observations"] = llm_content.get("observations", "")
        report_data["llm_recommendations"] = llm_content.get("recommendations", [])
        report_data["llm_limitations"] = llm_content.get("limitations", "")

        # 5. Generate PDF
        from app.services.pdf_generator import generate_pdf
        pdf_bytes = generate_pdf(report_data, normalized_report_type)

        # 6. Return PDF as response
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=report_{request.report_id}.pdf"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint for report generation service"""
    return {
        "status": "healthy",
        "service": "report-generation",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "supabase_configured": bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY"))
    }
