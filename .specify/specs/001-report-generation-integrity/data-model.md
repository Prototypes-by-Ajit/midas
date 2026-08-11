# Phase 1 — Data Model

**Feature**: Report Generation Integrity Completion | **Date**: 2026-08-06

Schema ground truth is `supabase/migrations/`. This document records the existing shape, the
minimal additions this feature makes, and the rules that must hold.

---

## Entity: `generated_reports`

Existing columns, verbatim from `supabase/migrations/005_generated_reports.sql`:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()`. The report identifier used in storage paths and URLs. |
| `user_id` | `text not null` | Clerk id (`user_2abc…`). **Every query MUST filter on this.** |
| `clinician_id` | `text` | Nullable. Grants read access to the download path. |
| `analysis_id` | `uuid not null` | FK → `medical_analyses(id) on delete cascade`. |
| `report_type` | `text not null` | Constrained to four values by `006`. |
| `report_number` | `text not null` | Format constrained by `007`. |
| `generation_status` | `text not null` | `default 'pending'`. **No CHECK exists today.** |
| `report_config` | `jsonb not null` | `default '{}'::jsonb`. The content options chosen. |
| `storage_path` | `text` | Null until upload succeeds. |
| `error_message` | `text` | Populated on failure. |
| `generated_at` | `timestamptz` | Set when the terminal state is reached. |
| `created_at` | `timestamptz not null` | `default now()`. |

### Added by `014_generated_reports_status_provenance.sql`

| Column | Type | Rule |
|---|---|---|
| `sections_generated` | `jsonb` **nullable** | Which of the four narrative sections were produced. `NULL` means unknown — a historical row — and MUST render as "provenance unavailable", never as complete. |
| `generator` | `text` **nullable** | The narrative generator identity actually used. `NULL` on historical rows. |

Plus a `CHECK` constraint on `generation_status`, added `NOT VALID` and validated only after D-4
reports how many historical rows fall outside the vocabulary.

**Both columns are nullable by design.** A `NOT NULL` column with a default would silently assert
that historical reports were complete, which Assumption 2 forbids.

---

## Enum: Report Type

Closed set of exactly four. Already enforced by the `006` CHECK constraint; the application must now
agree with it instead of coercing.

```text
diagnostic_summary
detailed_analysis
patient_report
clinician_report
```

Rules:

- A value outside the set is **rejected**, never substituted (FR-010).
- All four are offered at every generation entry point (FR-011a).
- Only `clinician_report` selects the clinical template; the other three render the patient template
  with a different title. This is existing behaviour and is unchanged.

---

## Enum: Report Status

Closed set of exactly five.

```text
pending      row exists, work not started (column default)
generating   work in flight
completed    document rendered and stored, all four sections present
degraded     document rendered and stored, at least one section absent
failed       no usable document; error_message populated
```

### State transitions

```text
pending ──────► generating ──────► completed   (terminal)
   │                   │
   │                   ├─────────► degraded    (terminal)
   │                   │
   └───────────────────┴─────────► failed      (terminal)
```

Permitted edges, exhaustively: `pending→generating`, `pending→failed`, `generating→completed`,
`generating→degraded`, `generating→failed`. No edge leaves a terminal state (FR-041a).

`processing` is **not** a member. Nothing has ever written it; it exists only in the consumer at
`services/dashboard.server.ts:14` and is removed there (FR-041, FR-043).

**Historical rows**: a row whose stored status falls outside this set is displayed verbatim and
treated as terminal. It is never rewritten (Assumption 2).

---

## Value object: Report Number

Canonical format, from `007_generated_reports_report_number_format.sql`:

```text
MIDAS-REP-YYYYMMDD-XXXXXX      X ∈ [A-Z0-9]
regex: ^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$
```

Three producers must agree on it:

| Producer | Today | After |
|---|---|---|
| `generate_report_number()` RPC | canonical | unchanged |
| `generate/route.ts:88` JS fallback | canonical | unchanged |
| `pdf_generator.py:677` fallback | `MIDAS-REP-%y%m%d%H%M` — **divergent** | canonical, or absent |

The renderer's fallback fires only when `report_number` is missing from its input. Since the
orchestrator now always supplies it, the correct repair is to make the fallback canonical and treat
its use as a defect signal rather than a normal path (FR-022, FR-023).

---

## Value object: Confidence

| Location | Representation |
|---|---|
| `medical_analyses.confidence` | raw softmax probability in `[0,1]` |
| Backend↔frontend payloads | raw probability, unchanged |
| Document, listing, narrative | percentage, `0-100`, one decimal |

Single conversion point: `to_percent()` in `report_generator.py:49`, which tolerates both a raw
probability and an already-scaled percentage so legacy rows render correctly. Presentation banding
(`high` / `medium` / `low`) is computed from the **converted** value, not the raw one — this is the
existing fix that A6 protects (FR-026 … FR-028).

---

## Value object: Per-Analysis Measures

The only measures a report may present. Written by `backend/app/api/image_analysis.py:95-103` into
`medical_analyses.classification_metrics` (jsonb).

| Key | Meaning | Rendered as |
|---|---|---|
| `confidence` | top-1 softmax probability | percentage |
| `top2_gap` | margin over the second-ranked class | percentage points |
| `entropy` | distribution entropy over 7 classes | 3 decimals, `0` = certain, `~1.95` = uniform |
| `class_probabilities` | full distribution | ranked differential, top 4 |

**Explicitly excluded from every report, in any form** (FR-030, FR-030a): accuracy, balanced
accuracy, AUROC, precision, recall, F1, specificity, sensitivity, PPV, NPV. The first three exist in
the model card but describe a configuration that differs from production; the rest were never
computed. See research.md R3 and R4.

`classification_metrics` may arrive as a JSON string from the client library; `_coerce_metrics()` in
`report_generator.py:63` already handles that and stays.

---

## Value object: Report Provenance

New. Persisted to `sections_generated` and `generator`; also carried in the backend response so the
orchestrator can choose between `completed` and `degraded`.

```text
sections_generated: {
  summary:         bool
  observations:    bool
  recommendations: bool
  limitations:     bool
}
generator:       text   identity of the narrative generator actually used
degraded_reason: text   why sections are absent; null when all four present
```

Rules:

- All four `true` → `completed`. Any `false` → `degraded` (FR-016).
- `generator` records the generator actually invoked, never a hardcoded label (FR-034).
- `NULL` on a historical row means unknown, and renders as "provenance unavailable".

---

## Upstream entity: `medical_analyses` (read-only here)

This feature reads it and never writes it. Fields consumed by the report path:

`id`, `user_id`, `diagnosis`, `confidence`, `risk_level`, `recommendations`,
`classification_metrics`, `heatmap_path`, `created_at`.

**`detected_features` is deliberately not read.** It holds pipeline-generated placeholders rather
than measurements, and historical rows still contain them — reading it would launder a fabrication
into fresh clinical narrative. This exclusion already exists at `report_generator.py:201-204` and is
protected, not revisited (FR-033).

---

## Storage layout

| Artifact | Path | Written by |
|---|---|---|
| Report PDF | `{userId}/reports/{report_id}_{report_type}.pdf` | `generate/route.ts:160` |
| Grad-CAM overlay | `{userId}/heatmaps/{analysisId}_gradcam.png` | analysis path; falls back to `AI_image_storage` |

Because `report_id` is unique per row, two generations for the same analysis and type write to
**different paths** — so `upsert: true` never overwrites a prior report. This is what makes FR-025
immutability hold, and it holds today by construction rather than by intent. A regression test pins
it (SC-006b).

Signed-URL lifetimes: 3600 s on generate, 300 s on download with a `{download: "<report_number>.pdf"}`
option. Preview re-signs on demand rather than storing a URL, so expiry never strands a report
(FR-037).

---

## Access control

`generated_reports` RLS policies compare `auth.uid()::text` to `user_id`. `auth.uid()` yields a
Supabase-Auth UUID; `user_id` holds a Clerk id. **They can never be equal**, so the table is closed
to any anon-key client and every working path succeeds only by using the service-role key, which
bypasses RLS entirely.

Consequence for this feature: **authorization is enforced in application code, not in Postgres.**
Every service-role query MUST carry `.eq("user_id", userId)` derived from Clerk `auth()`. The
policies are corrected in E3 to deny anon access outright, which tightens the current state and
removes the trap of a future "fix" that relaxes them to `true`.
