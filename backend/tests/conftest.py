"""Static fixtures for the report-generation regression suite.

Every value here is a literal. Nothing in this file opens a socket, constructs a
Supabase client, or calls a model, so the suite runs offline with no credentials
(FR-060, FR-061, SC-011).

The row fixtures are shaped like a `medical_analyses` row as defined by
`supabase/migrations/003_medical_analyses_cnn_fields.sql`, with the result columns
made nullable by `004_medical_analyses_nullable_results.sql`.

The narrative fixtures are raw model responses -- the string a completion returns,
which is what `report_generator.parse_llm_json` consumes. Raw strings are the
ground truth the parsed form is derived from; a test that wants the parsed shape
can call `normalize_llm_content(parse_llm_json(...), model)`, whereas the reverse
direction loses the malformedness each fixture exists to reproduce.
"""

import json
from typing import Any, Dict

import pytest

# Clerk subject ids. Two distinct owners so ownership refusals have something to
# refuse (FR-002, FR-003, FR-005, FR-009).
OWNER = "user_2abcDEFghiJKLmnoPQRstuVWx"
OTHER_OWNER = "user_2zyxWVUtsrQPOnmlKJIhgFEd"

_ROW_ID = "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"


def _row(**overrides: Any) -> Dict[str, Any]:
    """Build a table-shaped dict, then apply per-fixture overrides."""
    row: Dict[str, Any] = {
        "id": _ROW_ID,
        "user_id": OWNER,
        "image_name": "lesion-left-shoulder.jpg",
        "image_url": None,
        "image_storage_path": f"{OWNER}/uploads/{_ROW_ID}.jpg",
        "image_size": 482113,
        "status": "completed",
        "model_version": "midas_v1_final_best",
        "diagnosis": "Melanoma",
        # 0-1 softmax score, the way the CNN writes it. `to_percent` converts.
        "confidence": 0.873,
        "risk_level": "high",
        # Pipeline placeholders, not measurements. The report path deliberately
        # never reads this column; fixtures carry it so a test can prove that.
        "detected_features": ["asymmetry", "irregular border"],
        "recommendations": ["Consult a dermatologist within two weeks"],
        "classification_metrics": {
            # The CNN writes confidence into the jsonb as well as the column
            # (app/api/image_analysis.py:96), both as 0-1. The renderer reads the
            # column for the header and the jsonb for the metric box, which is
            # what lets the two disagree.
            "confidence": 0.873,
            "class_probabilities": {
                "MEL": 0.873,
                "NV": 0.061,
                "BKL": 0.032,
                "AKIEC": 0.014,
                "BCC": 0.011,
                "DF": 0.006,
                "VASC": 0.003,
            },
            "top2_gap": 0.812,
            "entropy": 0.61,
        },
        "heatmap_path": f"{OWNER}/heatmaps/{_ROW_ID}_gradcam.png",
        "processing_time": 2143,
        "error_message": None,
        "created_at": "2026-07-14T09:22:31.884000+00:00",
        "updated_at": "2026-07-14T09:22:34.101000+00:00",
    }
    row.update(overrides)
    return row


@pytest.fixture
def analysis_complete() -> Dict[str, Any]:
    """Every column populated: full distribution, overlay stored, 0-1 confidence."""
    return _row()


@pytest.fixture
def analysis_no_distribution() -> Dict[str, Any]:
    """Recorded before the probability distribution was persisted."""
    return _row(classification_metrics={})


@pytest.fixture
def analysis_no_overlay() -> Dict[str, Any]:
    """No highlight overlay was stored; its absence must be disclosed, not hidden."""
    return _row(heatmap_path=None)


@pytest.fixture
def analysis_legacy_percent_confidence() -> Dict[str, Any]:
    """Confidence stored as 0-100 instead of 0-1; must render the same number."""
    row = _row(confidence=87.3)
    # A writer that used percentages did so in both places. The column and the
    # jsonb stay internally consistent; only the two readers disagree.
    row["classification_metrics"] = {**row["classification_metrics"], "confidence": 87.3}
    return row


@pytest.fixture
def analysis_foreign_owner() -> Dict[str, Any]:
    """Owned by a different Clerk subject; every report operation must refuse it."""
    return _row(
        user_id=OTHER_OWNER,
        id="9a8b7c6d-5e4f-4321-9876-0a1b2c3d4e5f",
        image_storage_path=f"{OTHER_OWNER}/uploads/9a8b7c6d.jpg",
        heatmap_path=f"{OTHER_OWNER}/heatmaps/9a8b7c6d_gradcam.png",
    )


@pytest.fixture
def narrative_structured() -> str:
    """Model response honouring the JSON contract: all four sections present."""
    return json.dumps(
        {
            "summary": (
                "The model's leading classification for this lesion is melanoma, "
                "at 87.3 percent.\n\nThis is a screening aid, not a diagnosis. "
                "A dermatologist must examine the lesion directly before any "
                "clinical decision is made."
            ),
            "observations": (
                "The distribution is sharply peaked: the leading class sits 81.2 "
                "percentage points above the second-ranked class, and the "
                "remaining classes each hold under seven percent."
            ),
            "recommendations": [
                "Book a dermatology appointment within two weeks.",
                "Photograph the lesion monthly against a fixed reference.",
            ],
            "limitations": (
                "This analysis rests on a single image. It cannot establish "
                "depth, margin, or history, and it does not replace biopsy."
            ),
        }
    )


@pytest.fixture
def narrative_prose_only() -> str:
    """Usable prose in the wrong shape: the summary survives, three sections absent."""
    return (
        "The leading classification for this lesion is melanoma at roughly 87 "
        "percent confidence, with the next most probable class far behind.\n\n"
        "This output is a screening aid. A dermatologist should examine the "
        "lesion directly before any clinical decision is made."
    )


@pytest.fixture
def narrative_empty() -> str:
    """Nothing usable came back. Must raise, never render."""
    return ""
