# Report Contract

**Feature**: Report Generation Integrity Completion | **Date**: 2026-08-06

The single agreed contract across browser, orchestrator route, report service, renderer, database,
and storage. Two source modules hold these values — `backend/app/contracts/report_contract.py` and
`frontend/src/lib/reports/contract.ts` — and one test asserts they agree.

---

## 1. Closed sets

```text
REPORT_TYPES    = diagnostic_summary | detailed_analysis | patient_report | clinician_report
REPORT_STATUSES = pending | generating | completed | degraded | failed
NARRATIVE_SECTIONS = summary | observations | recommendations | limitations
REPORT_NUMBER_PATTERN = ^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$
```

Membership is closed. A value outside a set is an error, never a substitution.

---

## 2. Orchestrator interface

### `POST /api/reports/generate`

Caller: browser, authenticated session required.

**Request**

```json
{
  "analysis_id": "uuid",
  "config": {
    "reportType": "clinician_report",
    "includeImages": true,
    "includeDetailedFeatures": true,
    "includeRecommendations": true,
    "includeDisclaimer": true
  }
}
```

`config.reportType` is **required** and MUST be a member of `REPORT_TYPES`. It is no longer
defaulted (today: `config?.reportType || 'diagnostic_summary'`).

**Response — 200, complete**

```json
{
  "success": true,
  "report_id": "uuid",
  "report_number": "MIDAS-REP-20260806-A1B2C3",
  "report_type": "clinician_report",
  "generation_status": "completed",
  "preview_url": "https://…",
  "generated_at": "2026-08-06T…Z",
  "provenance": {
    "sections_generated": {
      "summary": true, "observations": true,
      "recommendations": true, "limitations": true
    },
    "generator": "<model identity actually used>",
    "degraded_reason": null
  }
}
```

**Response — 200, degraded**

Same shape, with `generation_status: "degraded"`, at least one section `false`, and a non-null
`degraded_reason`. The interface MUST surface this before the person opens the document (FR-017).

**Response — errors**

| Status | Condition | `code` |
|---|---|---|
| 401 | No authenticated session | `UNAUTHENTICATED` |
| 400 | `analysis_id` absent | `MISSING_ANALYSIS_ID` |
| 422 | `reportType` outside `REPORT_TYPES` | `INVALID_REPORT_TYPE` |
| 404 | Analysis does not exist | `ANALYSIS_NOT_FOUND` |
| 403 | Analysis owned by another person | `FORBIDDEN` |
| 502 | Report service returned an error | `GENERATION_FAILED` |
| 503 | Report service unreachable | `SERVICE_UNAVAILABLE` |
| 500 | Configuration or storage failure | `INTERNAL` |

`403` and `404` MUST disclose nothing about the target beyond the code (FR-009).

### `GET /api/reports`

Owner-scoped list. New.

```json
{ "reports": [ { "id": "uuid", "report_number": "…", "report_type": "…",
                 "generation_status": "…", "created_at": "…", "generated_at": "…",
                 "error_message": null, "provenance": { … } | null } ] }
```

`provenance: null` means a historical row with no recorded provenance — render as unavailable, never
as complete (Assumption 2).

### `GET /api/reports/[id]/preview`

Owner-scoped. New. Issues a **fresh** signed URL on every call, so link expiry never strands a stored
report (FR-037). Accepts `completed` and `degraded`. Never regenerates.

### `GET /api/reports/[id]/download`

Owner-or-clinician scoped. Exists. Two changes: accept `degraded` alongside `completed`, and accept
the same Supabase environment variable spellings the orchestrator accepts (FR-044).

Filename is `{report_number}.pdf`, and the browser MUST use the same (FR-024) — today the client
sets `MIDAS-Report-{shortId}.pdf`.

---

## 3. Report service interface

### `POST /api/v1/reports/generate`

Caller: the orchestrator only. Shared-secret authenticated. Returns **PDF bytes**, not JSON.
**Writes nothing** — no storage upload, no database write. That stays true.

**Request**

```json
{
  "report_id": "uuid",
  "analysis_id": "uuid",
  "report_type": "clinician_report",
  "user_id": "user_2abc…",
  "report_number": "MIDAS-REP-20260806-A1B2C3",
  "config": { "includeImages": true, "…": true }
}
```

`user_id` is **not** proof of identity (FR-006). It is the ownership filter the service applies to
its own analysis lookup (FR-005) — an analysis not owned by that id is not found.

**Response — 200**: `application/pdf` bytes, with provenance in response headers so the orchestrator
can classify the outcome without parsing the document:

```text
X-Report-Sections:  summary,observations,recommendations,limitations
X-Report-Generator: <model identity actually used>
X-Report-Degraded:  <reason>            omitted when all four sections present
```

**Response — errors**

| Status | Condition |
|---|---|
| 401 | Missing, malformed, or incorrect credential — **and when the credential is unconfigured** (FR-007) |
| 404 | Analysis not found *or* not owned by `user_id` |
| 422 | `report_type` outside `REPORT_TYPES` |
| 500 | Narrative unavailable, or rendering failed |

The credential MUST have no default. Today both sides fall back to the literal `"test-key"`.

---

## 4. Confidence unit

| Boundary | Representation |
|---|---|
| `medical_analyses.confidence` | raw probability `[0,1]` |
| Orchestrator ↔ report service | raw probability |
| `GET /api/reports` payload | raw probability |
| Document, listing, narrative prompt | percentage `0-100`, one decimal |

One conversion point, `to_percent()`. Presentation banding derives from the converted value. This
already holds and is protected by a test rather than reimplemented.

---

## 5. Renderable measures

**Permitted** — per-analysis, from `classification_metrics`:

```text
confidence            → percentage
top2_gap              → percentage points
entropy               → 3 decimals
class_probabilities   → ranked differential, top 4
```

**Prohibited in every report of every type, in any form, labelled or not:**

```text
accuracy · balanced accuracy · AUROC          (model card; describes a non-production configuration)
precision · recall · F1                        (never computed)
specificity · sensitivity · PPV · NPV          (never computed)
```

When the distribution is absent, the document states the differential is unavailable rather than
presenting one. When the overlay is absent, the document says so and generation continues.

---

## 6. Error envelope

Every JSON error from either side:

```json
{ "error": "human-readable message", "code": "MACHINE_CODE", "details": "optional, truncated" }
```

`details` MUST NOT contain credentials, storage paths belonging to other people, or raw upstream
payloads beyond a truncated excerpt.

---

## 7. Contract parity test

`backend/tests/test_report_contract.py` reads `frontend/src/lib/reports/contract.ts` as text,
extracts the literal members of each set, and asserts equality with the Python module. It is offline
and requires no build step. It exists because nothing else in the toolchain can detect drift across
the language boundary.
