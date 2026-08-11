# Implementation Plan: Report Generation Integrity Completion

**Branch**: `001-report-generation-integrity` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-report-generation-integrity/spec.md`

## Summary

Close the gap between the clarified report contract and what the live path actually does. The
capability works on its happy path; this plan repairs six classes of defect — silent narrative
degradation, silent report-type substitution, an unscoped browser query against other people's
report rows, status vocabulary drift, refresh-lost report state, and unreproducible provisioning.

Approach: characterization tests first, then one canonical contract module per side, then the
smallest edit at each hop of the existing pipeline. No new pipeline, no queue, no abstraction layer.
Two of the three largest fixes are **wire-ups of code that already exists but is never called**.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5 / Next.js 15 App Router (frontend)

**Primary Dependencies**: FastAPI, WeasyPrint 60+, Jinja2, `openai` client against NVIDIA NIM,
supabase-py; Clerk, `@supabase/supabase-js`, React Query

**Storage**: Supabase Postgres (`medical_analyses`, `generated_reports`), Supabase Storage buckets
`report_storage` and `AI_image_storage`

**Testing**: No pytest suite is configured — no `pytest.ini`, `pyproject.toml`, or `setup.cfg` in
`backend/`, though `pytest>=7.4.0` is in `requirements.txt:42`. Tests today are standalone scripts.
This plan adds `backend/tests/` with a minimal `pytest.ini`, runnable offline. Frontend has no test
runner and this plan does not add one; frontend verification is `npx tsc --noEmit`, `npm run lint`,
`npm run build`.

**Target Platform**: Linux containers (docker-compose / Railway); local macOS development

**Project Type**: Web application — `backend/` (FastAPI) + `frontend/` (Next.js), Supabase as the
managed data plane

**Performance Goals**: None specified, and none invented. The one latency-relevant change
(inlining the heatmap before render rather than fetching inside `write_pdf()`) is a correctness fix
for an untimeoutable network call, not a performance target.

**Constraints**: Brownfield. Roughly half of `backend/app/` is unreachable from the live entry
point. Every edit must be traced from `app.main_agent:app` or a `frontend/src/app/` route. Five
provisioning definitions are excluded by a bare `supabase/` ignore rule and need `git add -f`.

**Scale/Scope**: Single-tenant-per-user medical records. Volume of existing report rows is unknown
(spec D-4). ~12 live files change; 5 migrations become tracked; 1 new migration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

*Evaluated against `.specify/memory/constitution.md` v1.0.0.*

- [x] **I. Live-Path Evidence** — every file in "Files that change" was traced this session from
      `start-services.sh:130` → `app.main_agent:app` (routers at `main_agent.py:225-227`) or from a
      route under `frontend/src/app/`. Dead and orphaned files are enumerated below and excluded.
- [x] **II. Medical Honesty** — the plan's core deliverable. Degradation becomes explicit
      (FR-016a), dataset-level figures are excluded from all report types (FR-030/030a), and the
      already-correct anti-fabrication behaviour in `report_generator.py` is protected by
      characterization tests rather than rewritten.
- [x] **III. Service-Role Authorization** — Phase D1 removes an **unscoped browser query against
      `generated_reports`** and Phase C1 adds the missing ownership check on the backend endpoint.
      Both increase enforcement; neither weakens it.
- [x] **IV. Contract Consistency** — Phase B defines one contract for type, identifier, number,
      status, provenance, confidence unit, available measures, and error shape, consumed by both
      sides. The five untracked migrations are force-added so the schema contract is reproducible.
- [x] **V. Surgical Brownfield Change** — no new pipeline; `_build_report_context()` and
      `_load_heatmap_data_uri()` are **wired up rather than reimplemented**; the net change to
      `reports.py` deletes more lines than it adds. Historical rows are never rewritten.
- [x] **VI. Verification Before Completion** — Phase A writes characterization tests *before* any
      production edit, so every defect has a check that fails first. Gates are the repository's real
      ones; CI is not cited as evidence.

**Violations requiring justification**: none. Complexity Tracking is empty.

## Live request path (traced 2026-08-06, HEAD `c5669ad`)

```text
BROWSER
├─ comps/dashboard/reports/reports-console.tsx      "use client"
│    POST /api/reports/generate  {analysis_id, config{reportType,...}}
│    state: reportStatuses = useState({})            ← DEFECT: lost on refresh
└─ comps/dashboard/history/history-console.tsx      "use client"
     POST /api/reports/generate  reportType hard-coded 'patient_report'
     ALSO: anon-key SELECT generated_reports .eq(analysis_id).eq(report_type)
                                                     ← DEFECT: no user scoping
     ALSO: anon-key storage.createSignedUrl('report_storage', …) from the browser
        ↓
app/api/reports/generate/route.ts                   CANONICAL ORCHESTRATOR
     auth() → userId                                 401 if absent          ✓
     SELECT medical_analyses .eq(id).single()        404 if absent          ✓
     analysis.user_id !== userId                     403                    ✓
     rpc generate_report_number() ‖ JS fallback                             ✓
     INSERT generated_reports  status='generating'   ← status vocab drift
     reportType = config?.reportType || 'diagnostic_summary'  ← no validation
        ↓ POST ${BACKEND_URL}/api/v1/reports/generate  Bearer BACKEND_API_KEY
backend/app/api/reports.py::generate_report          mounted main_agent.py:227
     verify_api_key()                                ← falls back to "test-key"
     get_supabase()  service-role
     SELECT medical_analyses .eq(id).single()        ← NO ownership check
     heatmap → create_signed_url(…, 3600)            ← network inside render
     normalize_report_type()                         ← silently coerces
        ↓
backend/app/services/report_generator.py
     to_percent · ranked_probabilities · build_evidence_block               ✓
     missing NVIDIA_API_KEY → ValueError, propagates                        ✓
     unparseable response → {"summary": raw} + log.warning  ← silent degrade
        ↓
backend/app/services/pdf_generator.py::generate_pdf
     to_percent(confidence) → percentage                                    ✓
     metric_display = {confidence, top2_gap, entropy}                       ✓
     report_number = data.report_number OR "MIDAS-REP-%y%m%d%H%M" ← divergent
     WeasyPrint → bytes
        ↓ raw PDF bytes (not JSON) back to route.ts
     upload report_storage {userId}/reports/{report_id}_{type}.pdf upsert:true
     createSignedUrl(3600) ; UPDATE status='completed'                      ✓
        ↓
app/api/reports/[id]/download/route.ts
     auth() → userId ; SELECT generated_reports .eq(id)
     owner || clinician check                                               ✓
     status must be 'completed'                      ← blocks 'degraded'
     createSignedUrl(300, {download:`${report_number}.pdf`}) → stream       ✓
```

Legend: ✓ already correct, protect with a test. Everything else is a planned edit.

## Project Structure

### Documentation (this feature)

```text
specs/001-report-generation-integrity/
├── plan.md              # This file
├── spec.md              # Clarified specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── report-contract.md
└── checklists/
    └── requirements.md
```

### Source code (files that change)

```text
backend/
├── app/
│   ├── api/reports.py                    # type validation, ownership scoping,
│   │                                     #   wire _build_report_context, health signal
│   ├── services/report_generator.py      # degradation provenance on unparseable response
│   ├── services/pdf_generator.py         # report-number fallback, degradation banner,
│   │                                     #   overlay-absent disclosure
│   └── contracts/report_contract.py      # NEW — canonical enums + shapes
├── tests/                                # NEW — offline pytest package
│   ├── conftest.py
│   ├── test_report_contract.py
│   ├── test_report_type_validation.py
│   ├── test_report_degradation.py
│   ├── test_report_ownership.py
│   └── test_pdf_content.py
└── pytest.ini                            # NEW — minimal, offline-only

frontend/src/
├── app/api/reports/
│   ├── generate/route.ts                 # type validation, status vocab, degraded outcome
│   ├── [id]/download/route.ts            # env-var names, allow degraded
│   ├── [id]/preview/route.ts             # NEW — owner-scoped, re-signs on demand
│   └── route.ts                          # NEW — owner-scoped report list
├── lib/reports/contract.ts               # NEW — mirrors backend contract
├── services/reports.server.ts            # NEW — durable owner-scoped report reads
├── services/dashboard.server.ts          # PENDING_REPORT vocabulary
├── comps/dashboard/reports/reports-console.tsx   # hydrate from server, drop useState source
├── comps/dashboard/history/history-console.tsx   # remove unscoped browser query
├── components/generate-report-dialog.tsx # expose all four types
└── app/dashboard/reports/page.tsx        # pass durable reports into the console

supabase/migrations/
├── 003…007_*.sql                         # EXISTING, force-add to version control
└── 014_generated_reports_status_provenance.sql   # NEW — status CHECK, provenance columns
```

**Structure Decision**: The existing `backend/` + `frontend/` split is retained unchanged. The only
structural additions are one contract module per side, one offline test package, and two route
handlers that restore owner-scoped read paths the browser is currently doing for itself.

## Files that MUST NOT be touched

Verified unreachable from `app.main_agent:app` or from any App Router route. Editing them changes
nothing at runtime and violates Principle I.

| Path | Why |
|---|---|
| `supabase/functions/generate-report/index.ts` | Orphaned edge function. Authenticates against Supabase Auth in a Clerk app, calls a URL missing `/v1`, writes a column no migration creates. Its only caller was deleted. |
| `backend/app/api/routes.py` | Also mounts the reports router, but is imported only by `backend/app/main.py`, which nothing starts. |
| `backend/app/main.py`, `backend/app/main_simple.py` | Dead alternative entry points. |
| `backend/app/utils/supabase_storage.py` | Bound to the RAG corpus bucket. No report path touches it. |
| `backend/app/services/nvidia_client.py` | `report_generator.py` builds its own client and ignores this one. Changing it does not affect reports. |
| `supabase/migrations/002_storage_policies_for_images.sql` | Policies target `analysis_images`, a bucket no code references. |
| `backend/requirements 2.txt` | Shadow duplicate. Edit `requirements.txt`. |
| `docs/_archive/REPORT_GENERATION_PLAN.md` | Unbuilt historical proposal. Not a spec. |

## Implementation phases

### Phase A — Characterization tests first (blocking)

No production edit lands before this phase is written and demonstrably failing against current
behaviour. Each test documents a defect as an executable claim.

| ID | Characterizes today | Asserts (post-fix) | FR |
|---|---|---|---|
| A1 | `normalize_report_type("bogus")` returns `diagnostic_summary` | rejects, naming the four valid types | FR-010 |
| A2 | Unparseable narrative yields `{"summary": raw}` with no signal | returns provenance marking 3 of 4 sections absent | FR-016a, FR-018 |
| A3 | `verify_api_key` accepts `"test-key"` when unset | refuses when unconfigured | FR-007 |
| A4 | Backend `/generate` renders for an analysis owned by another user | rejects before any render | FR-005 |
| A5 | `pdf_generator` stamps `MIDAS-REP-%y%m%d%H%M` when number absent | single documented format everywhere | FR-022 |
| A6 | `to_percent(0.9)` and `to_percent(90.0)` | both → 90.0; protects the existing fix | FR-026–028 |
| A7 | Clinician template contains no never-computed measure | absent for all four types | FR-030, FR-030a |
| A8 | Status writers vs the `PENDING_REPORT` consumer | one five-value vocabulary | FR-041, FR-043 |
| A9 | Rendered text for an analysis with no distribution | states the differential is unavailable | FR-031 |
| A10 | Rendered text for an analysis with no overlay | discloses the overlay was unavailable | FR-040a |

Fixtures are static dictionaries shaped like `medical_analyses` rows. No network, no Supabase, no
model call — the LLM boundary is stubbed at `generate_llm_content`. Adds `backend/pytest.ini` with
`testpaths = tests` and nothing else.

### Phase B — One canonical contract

Two small modules holding the same values. No framework, no code generation.

- `backend/app/contracts/report_contract.py` — `REPORT_TYPES` (4), `REPORT_STATUSES` (5),
  `ALLOWED_TRANSITIONS`, `REPORT_NUMBER_PATTERN`, the `ReportProvenance` shape
  (`sections_generated`, `generator`, `degraded_reason`), and the error envelope
  `{error, code, details?}`.
- `frontend/src/lib/reports/contract.ts` — the same four sets as `as const` unions plus a
  `ReportContractError` type. Types are inferred from the const arrays.

One test asserts the two files agree by extracting literals from the TypeScript source and comparing
them. Cheap, and it catches drift the type system cannot see across the language boundary.

**Confidence rule fixed here**: raw probability in storage and over the wire; percentage only at
render. `to_percent()` already implements this and stays the single conversion point.

### Phase C — Backend

- **C1 — `reports.py::generate_report`**: replace the inline analysis fetch and signed-URL heatmap
  block (~lines 176–214) with a call to the **already-present** `_build_report_context(request,
  supabase, scope_user=True)`. This one substitution delivers three requirements at once: ownership
  scoping (FR-005), the data-URI heatmap that removes the untimeoutable network call from inside
  `write_pdf()`, and deletion of a duplicated code path. Net line count on the file is negative.
  Then drop the now-unused imports (`asyncio`, `json`, `AsyncIterator`, `StreamingResponse`,
  `settings`).
- **C2 — `normalize_report_type`** becomes `validate_report_type`, rejecting with the four valid
  names instead of coercing. Callers updated in the same edit.
- **C3 — `verify_api_key`**: remove the `"test-key"` fallback; refuse when unconfigured (FR-007).
- **C4 — `/reports/health`**: report on `NVIDIA_API_KEY` presence and accept all four Supabase
  variable spellings that `get_supabase()` accepts. Drop `groq_configured`, which the generator
  never reads (FR-046, FR-047).
- **C5 — `report_generator.py`**: on an unparseable response, return the raw prose *plus* provenance
  naming which sections are absent, instead of a bare `{"summary": raw}`. `model_used` carries the
  real generator identity (FR-034). No other change — the anti-fabrication prompts and
  `build_evidence_block` are correct and are protected by A7/A9, not rewritten.
- **C6 — `pdf_generator.py`**: report-number fallback uses the canonical format; add a degradation
  banner listing absent sections (FR-017) and an explicit note when the overlay was unavailable
  (FR-040a). The metric block already renders only measured values — protected by A7.

### Phase D — Frontend

- **D1 — `history-console.tsx` (security, do this first)**: delete the two browser
  `generated_reports` queries and the browser `createSignedUrl` calls. They carry **no user
  scoping** — only `analysis_id` and `report_type` — and mint signed URLs on `report_storage` from
  the client. They fail closed today only because the table's RLS compares `auth.uid()` to a Clerk
  id and never matches; that is accidental safety, not enforcement. Replace with the owner-scoped
  server routes from D2.
- **D2 — new read routes**: `GET /api/reports` (owner-scoped list) and
  `GET /api/reports/[id]/preview` (owner-scoped, re-signs on demand, satisfying FR-037 so an expired
  link never strands a stored report). Both use `auth()` + `.eq("user_id", userId)`, matching the
  pattern already in `services/dashboard.server.ts`.
- **D3 — `services/reports.server.ts`**: durable owner-scoped read for the reports page, reusing the
  `getSupabaseAdmin()` + result-object pattern from `dashboard.server.ts` rather than a new client.
- **D4 — `reports-console.tsx`**: seed report state from server props instead of an empty
  `useState`, so preview and download survive a reload (FR-035, FR-036). `useState` is retained for
  in-flight transitions only. Download filename derives from `report_number`, matching the server
  (FR-024).
- **D5 — `generate/route.ts`**: validate `reportType` against the contract instead of defaulting;
  map a backend degraded response to `generation_status: 'degraded'`. The existing `markReportFailed`
  behaviour is already correct and is kept.
- **D6 — `download/route.ts`**: accept the same Supabase variable spellings as `generate/route.ts`
  (FR-044) — today it accepts only `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` with
  non-null assertions, so one valid configuration makes generation succeed and every download fail.
  Allow `degraded` alongside `completed`.
- **D7 — `generate-report-dialog.tsx`**: expose all four types from the shared contract; the history
  console uses the same picker instead of hard-coding `patient_report` (FR-011a).
- **D8 — `dashboard.server.ts`**: `PENDING_REPORT` becomes `["pending", "generating"]` (FR-043).

### Phase E — Provisioning, without weakening security

- **E1**: force-add the five report-relevant definitions excluded by the bare `supabase/` ignore
  rule — `003_medical_analyses_cnn_fields`, `004_medical_analyses_nullable_results`,
  `005_generated_reports`, `006_generated_reports_report_type_check`,
  `007_generated_reports_report_number_format` — and verify with `git ls-files` (FR-048, FR-050).
- **E2**: new `014_generated_reports_status_provenance.sql` — `CHECK` constraint for the five
  statuses, plus nullable `sections_generated jsonb` and `generator text`. Nullable so historical
  rows remain valid unchanged (Assumption 2). Idempotent (`if not exists`, `drop constraint if
  exists`) to satisfy FR-051.
- **E3 — RLS**: the four policies in `005` compare `auth.uid()::text` to a Clerk id and can never
  match. Replace them with a policy set that denies anon access outright, plus a comment recording
  that authorization is enforced in application code by the owner filter. **This tightens, never
  loosens**: service-role paths bypass RLS and are unaffected, and after D1 no browser client reads
  this table at all (FR-052).
- **E4 — `report_storage`**: record the bucket and its policy as version-controlled configuration.
  **Blocked on spec item D-1** — the live bucket's existing policy is unknown and must be read before
  it is encoded. Do not guess it.

### Phase F — Verification

| Gate | Command | Covers |
|---|---|---|
| Backend unit + contract | `cd backend && source venv/bin/activate && python -m pytest -q` | A1–A10, contract parity |
| Frontend types | `cd frontend && npx tsc --noEmit` | contract unions, route signatures |
| Frontend lint | `cd frontend && npm run lint` | — |
| Frontend build | `cd frontend && npm run build` | does **not** run eslint (`ignoreDuringBuilds: true`), so lint is a separate required gate |
| Authorization | pytest A4 plus the two-account check in quickstart.md | FR-001–007 |
| PDF content | pytest A7, A9, A10 assert on extracted text | FR-029–033, FR-040a |
| End-to-end smoke | `tests/smoke_report_e2e.sh` | FR-061 |

**The smoke test must distinguish genuine renderer output from any substitute.** WeasyPrint writes a
`/Producer` metadata string and a structured object tree; a hand-assembled fallback does not. The
check asserts the producer string is present **and** that the document carries its own report
number:

```bash
pdfinfo /tmp/report.pdf | grep -qi weasyprint            # genuine renderer
pdftotext /tmp/report.pdf - | grep -q "$REPORT_NUMBER"   # correct identity
```

Requires a live environment — Supabase credentials, `NVIDIA_API_KEY`, a real `medical_analyses` row.
Documented as such (FR-062). It is the only test in this plan that is not offline.

## Backward compatibility

Historical rows are never rewritten (Assumption 2). Concretely:

- `sections_generated` and `generator` are added **nullable**. A pre-existing row keeps `NULL`, and
  the interface displays provenance as unavailable — never defaulted to "complete".
- The status `CHECK` constraint is added `NOT VALID` first, then validated only after D-4 reports how
  many historical rows fall outside the vocabulary. Any that do are displayed verbatim and treated
  as terminal rather than migrated.
- Report numbers already stored in a divergent format are displayed as stored. Only newly generated
  numbers use the canonical format.
- No historical PDF is regenerated, re-uploaded, or deleted.

## Preserved in-progress work

Checked at plan time: `git status --porcelain` shows **no uncommitted changes in any report path**.
The repairs described in the vault notes as pending were committed at `c5669ad`. Nothing needed
integration rather than implementation, with one exception — `_build_report_context()` and
`_load_heatmap_data_uri()` are committed, correct, and unreferenced, so C1 wires them up instead of
writing equivalent logic. The only dirty files are agent-tool state under `.claude-flow/` and the
untracked `specs/` directory.

## Open items carried from the spec

**D-1 blocks E4.** The live `report_storage` policy must be read before it is encoded as
configuration; guessing it would either weaken access or break the live path. D-2, D-3, D-4, and
D-5 are recorded in the spec with owners and validation steps and do not block Phases A–D.

## Complexity Tracking

No constitutional violations. Table intentionally empty.

## CEO review amendments — 2026-08-06 (HOLD SCOPE)

Accepted during `/plan-ceo-review`. These modify the phases above; where they conflict, these win.

**Added (each required by a success criterion or FR the plan already claims):**

| ID | Phase | Change | Because |
|---|---|---|---|
| C7 | C | Emit `X-Report-Sections`, `X-Report-Generator`, `X-Report-Degraded` from `generate_report` | contract §3 defines them; no phase owned them |
| C8 | C | Implement the contract §6 error envelope; log detail server-side only | `reports.py:240` puts `str(e)` in the browser and in `error_message` |
| D5b | D | Persist `sections_generated`, `generator`, `degraded_reason` on the finalize UPDATE | FR-018 and SC-006a are otherwise unwritable; E2's columns stay NULL |
| D5c | D | `AbortSignal.timeout(REPORT_ABORT_MS)` on the backend fetch; abort → `markReportFailed` | SC-001 — `generate/route.ts:121` is unbounded |
| D5d | D | Check the finalize UPDATE; never return `success: true` when the row disagrees | `route.ts:185` discards its error |
| D9 | D | Read-time staleness: `generating` older than `REPORT_STALE_MS` presents as *interrupted* | no transition exists when the observer dies; D4 makes it permanent |
| D10 | D | Status presentation contract in `data/reports/status-presentation.ts`, naming absent sections | FR-017, SC-012 |
| E5 | E | `git add -f specs/001-report-generation-integrity/` and verify with `git ls-files` | all seven artifacts are ignored by `.gitignore:95` |

**Modified:**

- **C5** — classify on *usable content*, not parseability: structured → `completed`, usable prose →
  `degraded`, nothing usable → **raise** (spec edge case 4, previously unimplemented). Catches empty
  responses and model refusals, which currently render as clinical narrative.
- **D5** — `reportType` validation becomes a strict `zod` parse of the whole `config`; only declared
  fields are persisted. Unknown keys rejected.
- **D6** — use `lib/supabase/admin.ts::getSupabaseAdmin()` instead of inlining env resolution a third
  time. It already reads both spellings of both variables; its docstring says so.
- **D2** — the list route `GET /api/reports` is **cut**. The server page + `router.refresh()` pattern
  already used by the history, documents, and analysis consoles covers it. `GET
  /api/reports/[id]/preview` is retained and is the **only** source of a preview URL — `preview_url`
  is removed from the generate response (contract §2).
- **E2** — add `degraded_reason text` nullable as a third column.
- **Authorization** — `preview` and `download` share one owner-only predicate. The dormant
  `clinician_id` branch is removed rather than extended; clinician sharing becomes its own feature.
- **Phase F** — adds `cd frontend && npm run test` (Vitest, pure functions only). R10's "no frontend
  runner" no longer holds: five fail-closed safety branches now live in the frontend and `tsc` cannot
  check any of them.
- **Sequencing** — D1 (delete the unscoped browser query) becomes the first production edit.

**Deferred:** D7's four-type picker expansion (keep the contract-validated picker and remove history's
hard-coded `patient_report`; exposing types 3 and 4 is a product decision, not an integrity fix).
E4 and SC-008 stay blocked on D-1.

**Constants (invariant: backend ceiling < abort < stale):** LLM 180s · `REPORT_ABORT_MS` 240 000 ·
`REPORT_STALE_MS` 300 000.

**New open item — D-6.** What is `proxy_read_timeout` on the live nginx / Railway edge? If it is
below 180s, long generations are already being truncated and stranded at `generating` today, unseen
because `useState` hid them on refresh. D4 makes that visible on day one. Owner: repository owner.
Blocks acceptance of D5c.

## Engineering review amendments — 2026-08-06

Accepted during `/plan-eng-review`. These modify the phases and the CEO amendments above.

| ID | Phase | Change | Evidence |
|---|---|---|---|
| C9 | C | `metric_display.confidence` derives from the same value as the header, via `to_percent` | `pdf_generator.py:618` (conditional, reads the column) vs `:644` (unconditional, reads jsonb); both render, at `:480` and `:494` |
| C10 | C | Export `coerce_metrics` from `report_generator`; delete the inline duplicate | `report_generator.py:63` vs `pdf_generator.py:628-636`, which carries a function-local `import json` and already-divergent failure handling |
| C11 | C | Delete `scope_user`; scope unconditionally; rewrite the docstring | `reports.py:115-130` — the docstring describes a streaming route and an edge-function caller that C1 removes |
| C12 | C | `await asyncio.to_thread(...)` around `_build_report_context` **and** `generate_pdf` | `reports.py:227` runs sync WeasyPrint on the event loop that also serves chat. **Keeps the `asyncio` import C1 proposed dropping** |
| C13 | C | `verify_api_key`: 503 + error log when unconfigured; `secrets.compare_digest` for the comparison | `reports.py:70-73` |
| D11 | D | `makeReportNumber()` + `REPORT_NUMBER_PATTERN` in the shared contract; assert before insert | `generate/route.ts:87` — `Math.random().toString(36).slice(2,8)` can yield under 6 chars, violating 007's CHECK |
| D12 | D | New `lib/reports/orchestration.ts` — `classifyBackendResult()` and `finalizePatch()` as pure, tested functions | 11 branches in `generate/route.ts` are otherwise unreachable by any runner |
| E6 | E | `014` re-asserts `generate_report_number()` with the canonical `upper(...)` body | `005:24-32` defines it lowercase; `007` redefines it uppercase and adds a CHECK requiring `[A-Z0-9]`. Re-applying 005 after 007 breaks every insert |

**Test additions:**

- `test_report_golden_path.py` — parametrized over all four types. Asserts a well-formed narrative
  yields `completed`, four sections, a verbatim report number, and one confidence value. **Phase A
  contained no happy-path test at all.**
- `test_prompt_provenance.py` — asserts no content from any unmeasured field (`detected_features`,
  notes, `image_name`) reaches the prompt, for all four types. Enforces Constitution II's named
  non-negotiable, which existed only as the comment at `report_generator.py:201-204`.
- `A6b`/`A6c` — header confidence equals metric-box confidence, including for a legacy mixed-unit row.
- `A11`/`A12` — error envelope emits no `str(e)`; `X-Report-*` headers emitted correctly.
- `V6` — 10 000 iterations of `makeReportNumber` all match `REPORT_NUMBER_PATTERN`.
- Vitest extends to `classifyBackendResult` and `finalizePatch`.

**Fresh-clone gate** added to `quickstart.md`:
`select generate_report_number() ~ '^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$';` must return true.

**Path correction (E5).** The spec directory moved to `.specify/specs/` on 2026-08-06. E5 becomes
`git add -f .specify/specs/001-report-generation-integrity/`, verified with `git ls-files
.specify/specs/`. The location is doubly ignored — a bare `.specify/` rule plus `*.md` at
`.gitignore:95` — so `-f` remains mandatory. `CLAUDE.md`'s "Active feature" pointer needs the same
correction.

**Deliberate deviation from the review brief.** The brief asked that the shared secret "fail closed
outside an explicit local-test mode." C13 ships **no local-test mode** — the variable is required
everywhere. Chosen knowingly: a second authentication path is one environment-variable mistake away
from production, and this repo sets no `ENV` variable to gate such a flag against.

**Test plan artifact:** `.specify/specs/001-report-generation-integrity/test-plan.md`.

**Concurrent activity flagged, not touched.** During this review another session modified
`backend/app/main_agent.py`, `backend/railway.toml`, `backend/.dockerignore`,
`backend/requirements.prod.txt`, and `.claude/skills/midas-deploy/scripts/preflight.sh`. None are in
this feature's scope and none were reviewed here. `main_agent.py` mounts the reports router — confirm
it still does before implementing Phase C.

## Design review amendments — 2026-08-06

Accepted during `/plan-design-review`. Scope: the user-facing report workflow only. Every
recommendation uses tokens and primitives that already exist; no new palette, no new type scale.

**D13 — List structure.** Two sections, replacing the single analysis-derived list:
`Your reports` (one row per `generated_reports` row) above `Analyses without a report` (one row per
analysis with no report, carrying the Generate action). Without this, FR-025's immutable duplicates
make every earlier report unreachable and **SC-003 cannot be met at the interface**.

**D14 — Three empty states**, each with one action: first-run ("Reports are generated from a skin
analysis" → Analyse an image), no-filter-match (echoes the search term → Clear filters), load error
("Your reports are safe. This is a display problem." → Try again). The analyses-but-no-reports case
renders *no* empty card — the second section is already populated.

**D15 — Generating state.** Optimistic row with an elapsed timer and, explicitly:
"You can leave this page — it'll be here when you get back." Supporting line changes once at 120s.
No progress bar; there is no progress signal to report honestly. This is the sentence that makes D4's
durability visible.

**D16 — Dialog copy.** All four descriptions rewritten to name what is produced. Removes
`'Comprehensive report with all detected features'` (`generate-report-dialog.tsx:123`), which promised
the `detected_features` column that `report_generator.py:201-204` deliberately excludes. Types come
from `REPORT_TYPES` in the shared contract, which also restores the missing `patient_report`
(`:20` currently hardcodes a 3-value union).

**D17 — Status chip composition.** Label + colour + icon on every chip, using existing tokens:

| Display | Stored | Chip | Icon |
|---|---|---|---|
| Ready | `completed` | `bg-success-subtle text-success` | `CheckCircle2` |
| Incomplete | `degraded` | `bg-warning-subtle text-warning` | `AlertTriangle` |
| Generating… | `generating` | `bg-muted text-muted-foreground` | `Loader2` |
| Didn't finish | `generating` + stale | `bg-muted text-muted-foreground` | `CircleSlash` |
| Couldn't be generated | `failed` | `bg-destructive-subtle text-destructive` | `XCircle` |

Incomplete is amber, not red: the report exists and is usable. Icons are `aria-hidden`; the label is
the accessible name.

**D18 — Responsive.** ≥1024px table; 768–1023px drops the date column; <768px becomes stacked cards
with **status first**, and Preview/Download at ≥44px. Status leads on mobile because it is the one
fact that decides whether to open the document.

**D19 — Accessibility.** Completion announced once via `role="status" aria-live="polite"`; the elapsed
timer must **not** be a live region. `--ring: var(--primary)` already provides a 16.1:1 focus
indicator. `Loader2` respects `prefers-reduced-motion`. Twelve acceptance checks added to
`test-plan.md`.

**D20 — Five failure causes, five treatments.** Service unreachable → "Couldn't be generated";
narrative degraded → "Incomplete" *with Preview and Download still offered*; storage failure →
"Couldn't be saved… Nothing was lost on your end"; overlay missing → no chip change, inline note only
(the report is complete); expired preview link → never surfaced, because the preview route re-signs on
every call. Distinguishing five causes does not mean five alarm states.

**D21 — Remove the four stat tiles** (`reports-console.tsx:318-334`). They count analysis statuses
(`pending`/`completed`/`reviewed`) that describe nothing on the page after D13, and one of them counts
`reviewed`, which appears in no contract. The section headers carry the counts.

**D22 — PDF provenance block.** Report number, dates, completeness, and the screening-aid framing sit
directly under the title, **above any clinical finding**, in both the patient and clinician templates,
with `page-break-inside: avoid`. The document uses the same word as the screen ("Incomplete"). Without
this, page 1 can be printed and handed to a clinician with no visible caveat.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | ISSUES FOUND (resolved) | mode: HOLD_SCOPE, 15 issues, 0 critical gaps |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 11 issues, 0 critical gaps, 29 test gaps mapped |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 5/10 → 9/10, 9 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**OUTSIDE VOICE:** skipped on all three reviews — Codex CLI is not installed, and the subagent
fallback is disabled by user instruction in this session. This plan has no cross-model coverage.

**VERDICT:** CEO + ENG + DESIGN CLEARED — proceed to implementation. 35 issues found across three
reviews and all resolved; 8 CEO amendments, 8 engineering amendments, and 10 design amendments folded
in. Design completeness moved 5/10 → 9/10, with the row-identity decision (D13) closing a gap that
made SC-003 unmeetable at the interface regardless of backend correctness.

Two acceptance items remain blocked on live facts that no amount of code closes — D-1 (storage bucket
policy) and D-6 (proxy read timeout) — and are named rather than assumed. SC-008 is explicitly not
claimed by this release.

NO UNRESOLVED DECISIONS
