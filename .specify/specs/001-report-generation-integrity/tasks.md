# Tasks: Report Generation Integrity Completion

**Input**: Design documents from `.specify/specs/001-report-generation-integrity/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/report-contract.md`,
`quickstart.md`, `test-plan.md`

**Tests**: Explicitly requested. FR-058 – FR-062 make regression coverage a functional requirement, and
Constitution VI makes a deterministic regression check mandatory for every reproduced defect regardless.
Phase 2 is therefore **blocking**, not optional.

**Organization**: Phases 1–3 are story-spanning prerequisites. Phases 4–9 are one phase per user story in
spec priority order. Within every story phase, tasks are grouped by layer — *backend generation*, *PDF
rendering*, *frontend orchestration*, *durable UI state* — so a failure localises to one layer.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel-safe — different file, and no dependency on a contract decision another open task owns
- **[Story]**: US1–US6 from `spec.md`
- Every task that changes behaviour carries a `verify:` line. A task is not done until its verify line passes.

## Path conventions

Web application. `backend/` (FastAPI, Python 3.11) + `frontend/` (Next.js 15 App Router, TypeScript 5) +
`supabase/migrations/`. Backend commands run from `backend/` with `source venv/bin/activate`; frontend
commands run from `frontend/`.

---

## Scope guard — read before the first edit

**Preserve the dirty worktree.** At generation time `git status --porcelain` carries 20 modified/untracked
paths, **none in any report path**: `.claude/skills/midas-deploy/*`, `CLAUDE.md`, `backend/.dockerignore`,
`backend/app/agents/react_cot_agent.py`, `backend/app/main_agent.py`, `backend/railway.toml`,
`backend/requirements.prod.txt`, `frontend/railway.toml`, `frontend/src/app/dashboard/security/page.tsx`,
`frontend/src/app/login/page.tsx`, `frontend/src/components/effects/login-background.tsx`, `k8s/base/*`,
`render.yaml`, `frontend/.gitignore`, `frontend/src/comps/dashboard/security/`, and `.claude-flow/` agent
state. These belong to concurrent work. Do not revert, restage, reformat, or "clean up" any of them.
`CLAUDE.md` is the single exception — T030 makes one targeted line change to it.

**No unrelated cleanup.** Every changed line must trace to a task below. Pre-existing dead code, duplicate
`<name> 2.tsx` shadow files, and unrelated lint findings are out of scope — mention, never delete.

**Files that MUST NOT be touched** (`plan.md` — verified unreachable from `app.main_agent:app` or any App
Router route): `supabase/functions/generate-report/index.ts`, `backend/app/api/routes.py`,
`backend/app/main.py`, `backend/app/main_simple.py`, `backend/app/utils/supabase_storage.py`,
`backend/app/services/nvidia_client.py`, `supabase/migrations/002_storage_policies_for_images.sql`,
`backend/requirements 2.txt`.

**One unresolved conflict between reviews, resolved here and flagged.** The CEO amendment deferred D7
("exposing types 3 and 4 is a product decision"), while the later design amendment D16, FR-011a, and
`test-plan.md` all require all four types in the picker. Later review wins and FR-011a is a requirement,
so **T063 exposes all four**. If the product owner disagrees, cut T063 and record FR-011a as not accepted —
do not silently ship three.

---

## Phase 1: Setup (test harness only — no production edit)

**Purpose**: make a failing test runnable. Nothing here changes runtime behaviour.

- [X] T001 Create `backend/pytest.ini` with `[pytest]`, `testpaths = tests`, `addopts = -q`, and nothing else
  - verify: `cd backend && source venv/bin/activate && python -m pytest --collect-only -q` exits 0
  - done: file created with exactly those three lines. Config proven active —
    `python -m pytest --collect-only --override-ini="addopts="` reports `configfile: pytest.ini`,
    `testpaths: tests`, `rootdir: .../backend`. **The stated exit code is wrong**: pytest returns **5**
    ("no tests collected"), not 0, and must, because this phase's own checkpoint requires zero tests.
    Exit 5 is the healthy result here; 2/3/4 would be the failure. Same result under both interpreters.
- [X] T002 Create `backend/tests/conftest.py` holding static `medical_analyses`-shaped fixtures — `analysis_complete`, `analysis_no_distribution`, `analysis_no_overlay`, `analysis_legacy_percent_confidence`, `analysis_foreign_owner` — plus narrative fixtures `narrative_structured`, `narrative_prose_only`, `narrative_empty`. No network, no Supabase client, no model call
  - verify: `python -m pytest --fixtures -q | grep -c analysis_` returns 5
  - done: returns exactly **5** — `analysis_complete`, `analysis_no_distribution`, `analysis_no_overlay`,
    `analysis_legacy_percent_confidence`, `analysis_foreign_owner`, plus `narrative_structured`,
    `narrative_prose_only`, `narrative_empty`. Rows shaped from migrations `003`/`004`; no import of
    Supabase, no socket, no model call. Narrative fixtures are **raw model response strings** (what
    `parse_llm_json` consumes), not pre-parsed dicts — the parsed form is derivable, the malformedness is not.
- [X] T003 [P] Add a Vitest runner for pure functions only: `vitest` devDependency, `"test": "vitest run"` in `frontend/package.json`, and `frontend/vitest.config.ts` with `environment: 'node'` and `include: ['src/**/*.test.ts']`
  - verify: `cd frontend && npm run test` exits 0
  - note: overrides research R10. The CEO amendment to Phase F requires it — five fail-closed safety branches now live in frontend TypeScript and `tsc` cannot check any of them
  - done: `vitest@^4.1.10` devDependency, `"test": "vitest run"`, `frontend/vitest.config.ts`.
    `npm run test` exits **0**. Two deviations from the literal spec, both forced by its own verify line:
    (1) `exclude` adds `src/features/auth/auth.test.ts` — a pre-existing standalone `node:assert` script
    that matches the `include` glob but contains no vitest suite, which vitest fails on; excluded rather
    than rewritten because the scope guard says preserve unrelated work. (2) `passWithNoTests: true` —
    without it an empty run exits 1, and this phase's checkpoint requires zero tests. `npx tsc --noEmit`
    exits 0 after the change.
- [X] T004 [P] Record the worktree baseline: `git status --porcelain > /tmp/midas-worktree-baseline.txt`
  - verify: file exists and lists the 20 pre-existing paths named in the scope guard
  - done: file written **before** T001–T003 so the new harness files are not baked into the baseline
    ([P] permits the reorder; recording it afterwards would defeat its purpose). **The verify line cannot
    pass as written**: it lists **5** paths, all `.claude-flow/` state. The 20 paths in the scope guard
    were committed in `c2c0aca` ("Rework", 2026-08-06 18:14) — 27 minutes *before* `tasks.md` was written
    at 18:41 — so the guard describes a pre-commit worktree that no longer exists. All 12 sampled guard
    paths return empty `git status --porcelain`. The guard's preservation intent is unaffected; only its
    count and path list are stale.
- [X] T005 [P] Confirm the reports router is still mounted before any Phase C work: `grep -n "reports_router" backend/app/main_agent.py`
  - verify: `include_router(reports_router, prefix="/api/v1")` present at `backend/app/main_agent.py:235`. **`plan.md` recorded `:227`** — a concurrent session edited this file. No edit here, confirmation only
  - done: confirmed at **`:235`** — `app.include_router(reports_router, prefix="/api/v1", tags=["reports"])`,
    imported at `:20`. `tasks.md` is correct; `plan.md:227` is the stale anchor. No edit made.

**Checkpoint**: both runners execute and collect zero tests. No production file has changed.

---

## Phase 2: Characterization tests (BLOCKING — every test MUST fail first)

**Purpose**: turn each defect into an executable claim before any fix exists. A test that passes on first
run has not reproduced its defect — fix the test, not the code.

**⚠️ No production edit lands until this phase is written and demonstrably red.** The exception is T028
(the unscoped browser query), which is a security deletion sequenced ahead of everything else in Phase 3.

The six reproductions requested, mapped to tasks: false success → T006, T013, T015 · incorrect
confidence/report number → T009, T010, T016 · invalid type coercion → T007 · metric mismatch → T009, T010,
T012 · refresh loss → T015 · cross-user access → T008 (backend) and the release gate (route-level, see the
honesty note below).

**Shared verification for T006–T016**: a task is done when the named test **executes and fails on the stated
assertion** — not when it errors on a missing import, and not when it passes. The "fails today because" line
on each task *is* that assertion. T017 records the aggregate red baseline.

- [X] T006 [P] [US2] Narrative degradation in `backend/tests/test_report_degradation.py` — stub `generate_llm_content` (`backend/app/services/report_generator.py:315`) and assert: structured response → 4/4 sections true and `completed`; prose-only response → `degraded` with provenance naming the three absent sections and a non-null `degraded_reason`; empty or refusal response → **raises**, never returns renderable content
  - fails today because `report_generator.py` falls back to `{"summary": raw}` with only a `logger.warning`, and an empty response renders as clinical narrative (FR-016, FR-016a, FR-018; spec edge cases 3 and 4)
  - done (RED): **5 failed, 2 passed**. Structured/prose/empty/refusal cases all fail on the absent
    `provenance` key; empty and refusal return a renderable dict instead of raising. The 2 passes are
    protections (prose survives; recommendations stay a list). **Contract assumed** — `generate_llm_content`
    returns `provenance = {sections_generated{4 bools}, generator, degraded_reason}`, with
    `degraded_reason is None` meaning `completed`. Stub applied at `create_chat_completion`, not at the
    function under test.
- [X] T007 [P] [US3] Report-type coercion in `backend/tests/test_report_type_validation.py` — assert `normalize_report_type("bogus")` (`backend/app/api/reports.py:21`) rejects and names the four supported types, and that each of the four valid values passes through unchanged
  - fails today because it silently returns `diagnostic_summary` (FR-010, FR-011)
  - done (RED): **8 failed, 4 passed**. All six bogus inputs coerce to `diagnostic_summary` instead of
    raising 422; the refusal-names-four-types assertion fails because no refusal exists. The 4 passes are
    the four valid types passing through unchanged. Resolves `validate_report_type` first and falls back to
    `normalize_report_type`, so the test survives T047's rename rather than needing to be edited by it.
- [X] T008 [P] [US3] Ownership and credential in `backend/tests/test_report_ownership.py` — assert `_build_report_context` (`backend/app/api/reports.py:115`) yields not-found for an analysis owned by another Clerk id **before any render**; assert `verify_api_key` (`:59`) refuses when `BACKEND_API_KEY` is unset and refuses a wrong key
  - fails today because the live endpoint fetches the analysis inline with no ownership filter, and `verify_api_key` falls back to the literal `"test-key"` (FR-005, FR-007)
  - done (RED): **6 failed, 4 passed**. `_build_report_context` returns another owner's row instead of 404
    (`scope_user=False` default), sends no `user_id` predicate, and the `"test-key"` literal is still in the
    module source; with `BACKEND_API_KEY` unset every token is accepted. The 4 passes are protections
    (wrong key → 401, correct key accepted, missing header → 401, owned row still builds). Supabase is a
    recording stub (`tests/helpers.py::FakeSupabase`) — no network, no credentials.
- [X] T009 [P] [US5] Confidence units in `backend/tests/test_confidence_units.py` — assert `to_percent(0.9) == to_percent(90.0) == 90.0`; assert the header confidence and `metric_display.confidence` are the same number for a raw-probability row **and** for a legacy percentage row
  - `to_percent` (`report_generator.py:49`) already passes and is protected, not rewritten. The header/metric-box comparison fails today: `pdf_generator.py:643` builds `metric_display` from the jsonb while the header reads the column, rendered at `:461` and `:494` (FR-026 – FR-028, A6b/A6c)
  - done (RED): **2 failed, 9 passed** — exactly the intended split. The legacy-percentage row renders
    `header says 87.3, document also prints [8730.0]`, the literal defect. The 9 passes are `to_percent`
    protections. **Anchor correction**: `metric_display` is built at `pdf_generator.py:644`, header
    confidence at `:617`; `to_percent` is `report_generator.py:49` as stated.
- [X] T010 [P] [US5] Rendered-document content in `backend/tests/test_pdf_content.py` — render all four report types from fixtures, extract text, and assert: (a) no prohibited term appears in any type — `accuracy|balanced accuracy|auroc|auc|precision|recall|f1|specificity|sensitivity|ppv|npv`; (b) the document's report number is byte-identical to the supplied one and never matches `MIDAS-REP-\d{10}$`; (c) the no-distribution fixture states the differential is unavailable; (d) the no-overlay fixture discloses the overlay was unavailable; (e) a degraded fixture names every absent section
  - (b) fails today via the divergent `"MIDAS-REP-" + strftime("%y%m%d%H%M")` fallback at `pdf_generator.py:677`; (d) fails because absence is silent (FR-022, FR-029 – FR-031, FR-040a, FR-017)
  - done (RED): **19 failed, 13 passed**. (a) passes for all four types, with and without a poisoned row —
    protection, the templates are already clean. (b) fails: `MIDAS-REP-2608092130`. (c) fails: the
    differential section vanishes with no statement. (d) fails for all four: the words overlay/heatmap
    never appear at all. (e) fails for all four: no absent section is named and no document says
    "Incomplete". **Test-fragility correction**: the first cut of (b) split on whitespace and the clinician
    template extracts as `MIDAS-REP-2608092131Report`, so that type falsely passed; now scanned by regex
    (`helpers.report_numbers`). Text via `PyPDF2`; WeasyPrint renders locally, no network.
- [X] T011 [P] [US1] Golden path in `backend/tests/test_report_golden_path.py` — parametrized over all four types: a well-formed narrative yields `completed`, 4/4 sections, the report number verbatim, and exactly one confidence value in the document
  - Phase A of `plan.md` contained no happy-path test at all; this pins the behaviour every other task must not break
  - done (RED): **8 failed, 12 passed** of 20 (4 types × 5 assertions). Both provenance claims fail
    on the absent `provenance` key. The report number, the single confidence value, and all four
    sections reaching the rendered document already hold and are protected. Same assumed contract as
    T006 and the same stub point (`create_chat_completion`, not the function under test). The
    "every section reaches the document" test is an addition to the four stated claims: T038 and
    T041 both rewrite this path and either could keep the 4/4 claim while dropping the content.
- [X] T012 [P] [US5] Prompt provenance in `backend/tests/test_prompt_provenance.py` — for all four types assert no content from `detected_features`, free-text notes, or `image_name` reaches the prompt string
  - enforces Constitution II's named non-negotiable, which exists today only as the comment at `report_generator.py:201-204` (FR-033)
  - done: **0 failed, 16 passed** — a pure protection suite, and that is the honest outcome: the
    guard exists today only as a comment, and the comment is currently being obeyed. It reproduces
    nothing and is not counted toward the red baseline. Asserted on the messages **actually handed to
    the model** (captured at `create_chat_completion`), not only on `build_user_prompt` — the system
    prompt is half the prompt, and an edit that interpolated the row into it would otherwise pass.
    Sentinels in `detected_features`, `recommendations`, `error_message`, `image_name`; a fifth
    assertion keeps the permitted evidence (diagnosis, confidence, differential) present so the
    suite cannot pass on an empty prompt. **Column correction**: `medical_analyses` has no `notes`
    column, so "free-text notes" is read as `recommendations` + `error_message`.
- [X] T013 [P] [US2] Response envelope and provenance headers in `backend/tests/test_report_headers.py` — using `fastapi.testclient` with a monkeypatched Supabase client, assert every JSON error matches `{error, code, details?}` and contains no `str(e)`, stack frame, or credential; assert `X-Report-Sections`, `X-Report-Generator` are emitted, and `X-Report-Degraded` is present when degraded and **omitted** when complete
  - fails today: `backend/app/api/reports.py:240` puts `str(e)` in the browser response and in `error_message`; no `X-Report-*` header exists (contract §3, §6; A11/A12)
  - done (RED): **9 failed, 2 passed** of 11. Every error returns FastAPI's `{"detail": …}` rather
    than the §6 envelope, and the 500 body carries `nvapi-SECRET-TOKEN-abc123` **and** another
    owner's storage path verbatim. All three `X-Report-*` headers are absent. The 2 passes are
    protections — the credential is never echoed, and `X-Report-Degraded` is absent on a complete
    report (true today only because no header exists at all, so it guards T039 rather than
    reproducing anything; marked `[protect]` in the file). The app is assembled in-test from
    `reports.router` alone instead of importing `main_agent`, which would drag in the chat pipeline.
    Supabase is `helpers.FakeSupabase`, which gains `.single()` for the pre-T033 call shape at
    `reports.py:177`. The no-overlay fixtures are used deliberately: an overlay would put a signed
    URL in front of WeasyPrint, and this task is about headers, not storage.
- [X] T014 [P] Cross-language contract parity in `backend/tests/test_report_contract.py` — read `frontend/src/lib/reports/contract.ts` as text, extract the literal members of `REPORT_TYPES`, `REPORT_STATUSES`, `NARRATIVE_SECTIONS`, `REPORT_NUMBER_PATTERN`, and assert equality with `backend/app/contracts/report_contract.py`; additionally assert the string `"processing"` appears in no report producer or consumer — `frontend/src/services/dashboard.server.ts`, `frontend/src/app/api/reports/**`
  - fails today on two counts: neither contract module exists, and `dashboard.server.ts:14` counts in-flight reports as `["pending", "processing"]`, a value nothing has ever written (FR-041, FR-043; contract §7)
  - done (RED): **10 failed, 1 passed** of 11. Both contract modules are absent, each reported as a
    named `pytest.fail` naming the task that creates it rather than as an import error.
    `PENDING_REPORT = ['pending', 'processing']` fails as specified. The 1 pass is a protection: no
    file under `frontend/src/app/api/reports/**` uses the word. **Scope correction** — a blanket
    "`processing` appears nowhere in `dashboard.server.ts`" would demand the edit T029 explicitly
    forbids, because `PENDING_ANALYSIS` one line above is a *different* vocabulary
    (`medical_analyses.status`, where `processing` is real). The test therefore extracts the
    `PENDING_REPORT` array literal specifically. A third assertion checks every `PENDING_REPORT`
    member against `REPORT_STATUSES`, so the fix cannot swap one unwritten value for another.
- [X] T015 [P] [US2] Orchestration purity in `frontend/src/lib/reports/orchestration.test.ts` — assert `classifyBackendResult()`: all four sections → `completed`; missing provenance header → `degraded` with reason `"provenance unavailable"`, never `completed`; any section false → `degraded`; non-2xx → `failed`. Assert `finalizePatch()` never emits `generation_status: 'completed'` without a storage path. Assert `hydrateReports(serverRows, inFlight)` returns every server row when the in-flight map is empty (**the refresh-loss reproduction**) and that an in-flight entry never shadows a terminal server row. Assert `isStale()` at the `REPORT_STALE_MS` boundary
  - fails today because the module does not exist and the 11 branches in `generate/route.ts` are unreachable by any runner (D12, D9, FR-035)
  - done (RED): **27 failed, 0 passed**. Each test loads the module through a dynamic `import()`, so
    the absent module surfaces as 27 individually named failures rather than one collection error —
    the runner executes, which is what T017 needs. **Contract assumed** (T019 + T020):
    `classifyBackendResult({status, headers: Headers})` → `{generation_status, provenance, error?}`;
    `finalizePatch(classification, storagePath: string | null)` → the row patch;
    `hydrateReports(serverRows, inFlight: Map<id, row>)` → rows; `isStale(row, now: number)` with
    the boundary **inclusive** (`now - created_at >= REPORT_STALE_MS`). Terminal is
    `completed | degraded | failed`. Also asserts the plan.md invariant
    180 000 < `REPORT_ABORT_MS` < `REPORT_STALE_MS`, which no other task checks.
- [X] T016 [P] [US5] Report-number generation in `frontend/src/lib/reports/contract.test.ts` — 10 000 iterations of `makeReportNumber()` must all match `REPORT_NUMBER_PATTERN`
  - fails today because `generate/route.ts:87` uses `Math.random().toString(36).slice(2, 8)`, which yields fewer than 6 characters whenever the float's base-36 expansion is short — violating the `007` CHECK constraint at insert time (D11, V6)
  - done (RED): **5 failed, 0 passed**, same dynamic-import loading as T015. The 10 000-iteration
    pattern check plus token length, `[A-Z0-9]` alphabet, and non-constancy (a generator returning
    one value would satisfy the first three and collide on the second insert). The last test pins
    the defect **deterministically** rather than waiting for a rare float: `(0.5).toString(36)` is
    `"0.i"`, so `slice(2, 8)` is a single character and `MIDAS-REP-20260714-I` is rejected by 007's
    CHECK.
- [X] T017 **Checkpoint** — record the red baseline
  - verify: `cd backend && source venv/bin/activate && python -m pytest -q` reports failures for T006–T014 and **zero errors of any other kind**; `cd frontend && npm run test` reports failures for T015–T016. Save the output to `/tmp/midas-red-baseline.txt`. A test that passes here has not reproduced its defect
  - done: **backend 67 failed, 63 passed, 0 errors**; **frontend 32 failed** (2 suites). Saved to
    `/tmp/midas-red-baseline.txt` with the recording timestamp and `be51b7a` as the HEAD it describes.
    Zero errors is the signal that matters — every failure reached its assertion rather than dying on
    an import. The 63 backend passes are the `[protect]` tests plus all of T012.
  - **venv repair, prerequisite to this checkpoint.** `backend/venv` was built at
    `~/Desktop/MIDAS_final_work` and the repo now lives at `~/dev/`; 36 `venv/bin` shebangs and all
    four `activate*` scripts still carried the old absolute path. `VIRTUAL_ENV` pointed at a
    directory that does not exist, so `source venv/bin/activate` prepended a dead path and `python`
    silently resolved to Homebrew 3.12 while `pytest` resolved to the global one — this task's own
    verify command could not run. Repaired by rewriting the path in place (no rebuild: torch and
    WeasyPrint are already installed and correct).

**Honesty note carried from `test-plan.md`.** Route-level cross-user refusal (the six thin guards in
`generate/route.ts`) and genuine-renderer verification are **not** automatable in this phase — they need a
live environment. They are covered by T089 and T093 in the release gate, and are reported as manual, never
as automated coverage.

---

## Phase 3: Foundational — contract, schema, and closing the unscoped read path

**Purpose**: one agreed vocabulary and one reproducible schema, plus the security deletion the plan
sequences ahead of all other production edits.

**⚠️ BLOCKS Phases 4–9.** Every story phase consumes the contract modules or the `014` columns.

### Contract modules

- [X] T018 Create `backend/app/contracts/__init__.py` and `backend/app/contracts/report_contract.py` — `REPORT_TYPES` (4), `REPORT_STATUSES` (5), `NARRATIVE_SECTIONS` (4), `ALLOWED_TRANSITIONS` (the five edges in `data-model.md`), `REPORT_NUMBER_PATTERN = r"^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$"`, a `ReportProvenance` TypedDict (`sections_generated`, `generator`, `degraded_reason`), and `error_body(code, message, details=None)` returning the contract §6 envelope
  - verify: `python -m pytest backend/tests/test_report_contract.py -q` now fails only on the missing TypeScript file, not on the Python import
  - done: sets written as tuples so the parity test's ordered comparison is meaningful.
    `ALLOWED_TRANSITIONS` is a `frozenset` of the five edges; `TERMINAL_STATUSES` is derived beside it
    because both orchestration and presentation need it. `error_body()` **omits** `details` when
    absent rather than emitting `null`, so a consumer can test presence.
- [X] T019 Create `frontend/src/lib/reports/contract.ts` mirroring T018 — the same four sets as `as const` arrays with unions inferred from them, `REPORT_NUMBER_PATTERN`, `makeReportNumber()` (date + 6 chars drawn from `[A-Z0-9]`, always length 6), `ReportContractError`, and the constants `REPORT_ABORT_MS = 240_000` and `REPORT_STALE_MS = 300_000` (invariant: backend LLM ceiling 180 s < abort < stale)
  - **not [P] with T018** — same contract decision; the values must be copied from T018, not re-derived
  - verify: `python -m pytest backend/tests/test_report_contract.py -q` passes; `cd frontend && npm run test -- contract` passes T016
  - done: **9 of 11 contract tests pass**; the 2 that remain are the `PENDING_REPORT` pair, which is
    T029's edit, not this one. T016 fully green. `REPORT_NUMBER_PATTERN` is a **string**, not a regex
    literal, so the two modules hold byte-identical values and the parity test compares them
    directly. `makeReportNumber()` draws a fixed 6 characters from an explicit `[A-Z0-9]` alphabet —
    the defect was the variable length of `slice(2, 8)`, not the entropy source — and takes an
    injectable `now` so the date half is testable without touching the clock.
- [X] T020 Create `frontend/src/lib/reports/orchestration.ts` exporting the four pure functions `classifyBackendResult`, `finalizePatch`, `hydrateReports`, `isStale`. No I/O, no React, no Supabase client
  - verify: `cd frontend && npm run test -- orchestration` passes T015
  - done: **32 of 32 frontend tests pass** (T015 + T016 together). Two decisions the tests pinned but
    did not fully specify, resolved here: a 200 with no `X-Report-Sections` yields `degraded` with
    every section `false` (silence is not evidence of four sections), and `finalizePatch` with a null
    storage path returns **`failed`**, not `degraded` — with nothing stored there is nothing to
    preview, so neither non-failed status would be truthful. Purity is kept by making the clock a
    parameter: `finalizePatch(classification, storagePath, generatedAt = new Date().toISOString())`.
    `ReportRow.generation_status` is typed `string`, not `ReportStatus`, because a historical row may
    carry a value outside the closed set and is displayed verbatim (Assumption 2).
- [X] T021 [P] Create `frontend/src/data/reports/status-presentation.ts` — map each of the five statuses plus the stale-`generating` case to `{label, chipClass, icon, description}` per the D17 table (Ready/Incomplete/Generating…/Didn't finish/Couldn't be generated), and export `missingSections(sectionsGenerated)` returning a human-readable list. Data and pure functions only, no JSX
  - verify: `npx tsc --noEmit` clean; every label in the file appears in the D17 table in `plan.md`
  - done: `npx tsc --noEmit` clean; all five labels are D17's, no sixth invented.
    **Gap in D17, resolved and flagged**: the table gives 4 stored statuses + stale = 5 rows, but
    `REPORT_STATUSES` has 5 members, so `pending` has no row. Nothing writes `pending` today (the
    orchestrator inserts `generating` directly), and there is nothing truthful to say about it that
    differs from `generating`, so it borrows that presentation rather than gaining a label outside
    D17. `missingSections()` is tri-state on purpose — `null` provenance returns "which sections were
    generated was not recorded", complete returns `""`, otherwise the phrase — because unknown must
    never render as complete (Assumption 2).
  - ⚠️ **`bg-destructive-subtle` does not exist.** D17 specifies it for `failed`, but `globals.css`
    defines `--success-subtle` and `--warning-subtle` and no destructive counterpart, so the class
    emits no rule and the failed chip renders with no background. The file follows D17 verbatim
    because the plan is normative; the token must be added before **T060** renders these chips, as
    three lines matching the existing pattern: `--color-destructive-subtle: var(--destructive-subtle);`
    in the `@theme` block, plus a `color-mix` definition in each of the light and dark blocks.
    Not fixed here — `globals.css` belongs to no task in this feature and the scope guard forbids
    unrelated edits.

### Schema and provisioning

- [X] T022 Create `supabase/migrations/014_generated_reports_status_provenance.sql` — add `sections_generated jsonb`, `generator text`, `degraded_reason text`, **all nullable** (a NOT NULL default would silently assert historical reports were complete, which Assumption 2 forbids); add the five-value `CHECK` on `generation_status` **`NOT VALID`**; re-assert `generate_report_number()` with the canonical `upper(...)` body from `007`. Guard every statement with `if not exists` / `drop constraint if exists` for FR-051
  - E6 rationale: `005:24-32` defines the function lowercase and `007` redefines it uppercase with a CHECK requiring `[A-Z0-9]`. Re-applying `005` after `007` breaks every insert — `014` must end with the uppercase body
  - verify: `grep -c "not null" supabase/migrations/014_generated_reports_status_provenance.sql` returns 0 for the three new columns; `grep -c "NOT VALID" …` returns 1; applied in T025
  - done: `grep -c "not null"` → **0**, `grep -c "NOT VALID"` → **1** (the statement; the prose above
    it says "not-valid constraint" so the grep stays a single-hit check). Ten guarded statements, so
    a second apply changes nothing. Each of the three columns carries a `comment on column`
    recording that NULL means unknown, not complete. The function is re-asserted with 007's
    `upper(...)` body per E6. **Not executed** — T025 applies it, and the Docker daemon is down, so
    the SQL is unverified against a live server.
- [X] T023 In the same file `supabase/migrations/014_generated_reports_status_provenance.sql`, replace the four RLS policies from `005:37-56` — they compare `auth.uid()::text` (a Supabase-Auth UUID) to `user_id` (a Clerk id) and can never match. Drop them and add explicit deny-anon policies, with a SQL comment recording that authorization is enforced in application code by the owner filter
  - **not [P]** — same file as T022
  - this **tightens**: service-role paths bypass RLS and are unaffected, and after T028 no browser client reads this table at all (FR-052)
  - verify: after T025, `select policyname, roles, qual from pg_policies where tablename = 'generated_reports';` shows no policy referencing `auth.uid()`, and an anon-key `select` against the table returns zero rows
  - done: all four `005` policies dropped by name (guarded), replaced with two `as restrictive`
    deny-all policies scoped `to anon` and `to authenticated`. Restrictive is the correct kind here:
    it ANDs with any future permissive policy, so a later migration cannot accidentally re-open the
    table by adding one. **No behaviour change today** — with no session, `auth.uid()` is NULL and
    `NULL = user_id` is NULL, so those policies already returned zero rows; this converts accidental
    safety into stated policy. A block comment in the file records, in capitals, that authorization
    is enforced in application code by the `.eq("user_id", userId)` owner filter on the service-role
    client, which bypasses RLS entirely, and that RLS must not be mistaken for the control.
    `auth.uid()` survives in that comment only, never in a policy. **Verification deferred to T025**
    (Docker down).
- [X] T024 Add a rollback header comment to `supabase/migrations/014_generated_reports_status_provenance.sql` documenting the down-path: drop the CHECK constraint, **keep the three columns**. Dropping them would destroy provenance for every post-migration row, which is data loss, not a rollback
  - verify: the header names the exact `alter table … drop constraint if exists` statement and states explicitly that the three columns are retained
  - done: header carries the exact statement, plus the `drop column` form **commented out and
    labelled WRONG** so a future reader reaching for the obvious inverse meets the reason first.
    The rationale is recorded concretely rather than as policy: the model response is not retained
    and the rendered PDF does not carry provenance in machine-readable form, so dropping the columns
    loses the only evidence separating a complete report from a partly-failed one, permanently. The
    header also states the RLS change is not rolled back — restoring the four `005` policies would
    restore the appearance of enforcement and none of the substance. T022's two greps still pass.
- [ ] T025 Apply `supabase/migrations/014_generated_reports_status_provenance.sql` to the local database
  - verify: `select generate_report_number() ~ '^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$';` returns `true`; applying a second time succeeds and changes no row (FR-051)
  - 🚫 **BLOCKED — not done.** The Docker daemon is not running
    (`Cannot connect to the Docker daemon at unix:///Users/ajit/.docker/run/docker.sock`), so the
    local Supabase stack is down and `014` has never been executed. The SQL is unverified against a
    live server: syntax, the `NOT VALID` constraint, the `create or replace function`, and both
    restrictive policies are all unexercised. **Consequences while this stays blocked**: the three
    provenance columns do not exist, so T043's persistence and anything reading provenance will fail
    against this database. `reports.server.ts` selects `*` specifically so it keeps working either
    side of this migration — that is the only reason Phase 3's read path is safe today.

### Close the unscoped read path (security — first production edit)

- [X] T026 Create `frontend/src/services/reports.server.ts` — owner-scoped durable read using `getSupabaseAdmin()` from `frontend/src/lib/supabase/admin.ts` with `.eq("user_id", userId)`, returning the `{data, error}` result-object shape already used by `frontend/src/services/dashboard.server.ts`. Also export `assertReportOwner(reportId, userId)` for reuse by the preview and download routes
  - verify: `npx tsc --noEmit` clean; `grep -c 'eq("user_id"' frontend/src/services/reports.server.ts` ≥ 2
  - done: `tsc` clean, `grep -c 'eq("user_id"'` → **4**. Three exports: `getReportsForUser` (T053/T054),
    `getLatestReportsByAnalysis` (needed **now** by T028 — see below), and `assertReportOwner`.
    **Shape correction**: the task says "the `{data, error}` result-object shape already used by
    `dashboard.server.ts`", but that file and `analysis.server.ts` both return
    `{ok: true, data} | {ok: false}`. Code wins; this matches the real convention.
    **`select("*")`, deliberately.** Naming `sections_generated`/`generator`/`degraded_reason`
    explicitly would break every query here against a database that has not run `014` — which,
    with T025 blocked, is the local database right now. A star select works either side of the
    migration and the three fields are optional on `GeneratedReportRow`.
    **`assertReportOwner` returns a three-way result**, not a boolean: the owner-scoped query is the
    only one that returns row data, and a miss escalates to an existence probe selecting the id
    alone. That is what lets the routes answer 403 versus 404 (T027's verify requires 403 for a
    foreign id) without any row content crossing the boundary.
- [X] T027 Create `frontend/src/app/api/reports/[id]/preview/route.ts` — owner-scoped via `assertReportOwner`; accepts `completed` **and** `degraded`; issues a **fresh** signed URL on every call so expiry never strands a stored report (FR-037); returns the contract §6 envelope with `code: "NOT_FOUND"` when the storage object is gone rather than an empty file (FR-040); never regenerates
  - verify: `npx tsc --noEmit` clean; route returns 403 for a foreign report id in the T089 two-account check
  - done: `tsc` clean. 401 `UNAUTHENTICATED` · 403 `FORBIDDEN` · 404 `NOT_FOUND` · 409 `NOT_READY`
    · 500 `INTERNAL`, every body built by `errorBody()`. Signs on **every** call at a 600s TTL and
    sends `Cache-Control: no-store`, so a link cannot be cached past its own expiry. A row claiming
    a `storage_path` that storage cannot sign returns 404 with the reason logged server-side, never
    a link that resolves to an empty file (FR-040). Accepts `degraded` beside `completed`.
    **409, not 400, for a still-generating report**: the request is well-formed and the resource
    will exist shortly — 400 would blame the caller for the server's timing.
    **`errorBody()` added to `lib/reports/contract.ts`** as a T019 addendum. T018 has `error_body`
    and the TypeScript half lacked it, which would have meant every route re-implementing §6 — the
    exact drift the contract pair exists to prevent. T042/T049/T050 reuse it.
  - ⚠️ **403-vs-404 discloses existence by status code.** That is the contract's own table (§2 lists
    both), and neither body says anything beyond the code, but it is a deliberate disclosure and not
    an accident. Collapsing both to 404 would fail this task's stated verify.
- [X] T028 **[SECURITY — first edit to an existing production file]** In `frontend/src/comps/dashboard/history/history-console.tsx`, delete both browser `supabase.from('generated_reports')` queries (`:120-123`, `:183-186`) and both browser `storage.createSignedUrl('report_storage', …)` calls (`:142`, `:204`). Route preview and download through the server routes instead
  - these carry **no user scoping at all** — only `analysis_id` and `report_type` — and mint signed URLs on `report_storage` from an anon-key client. They fail closed today only because the RLS comparison can never match; that is accidental safety, not enforcement (Constitution III, FR-004, FR-006; research R7)
  - verify: `grep -c "generated_reports\|createSignedUrl" frontend/src/comps/dashboard/history/history-console.tsx` returns 0; `npx tsc --noEmit` clean
  - done: grep → **0**, `tsc` clean, no new lint findings. Both queries and both signing calls
    deleted, along with the orphans they left: the `createClient` import and the `const supabase`
    it fed. The two near-identical 60-line handlers collapse into `resolveReport()` +
    `fetchPreviewUrl()`; View Details and Export now differ only in what they do with the result.
  - **A second file had to change: `app/dashboard/history/page.tsx`.** The deleted queries were keyed
    by `analysis_id`, but the server routes are keyed by **report id**, and no `GET /api/reports`
    exists (contract §2 calls it new; no task creates it). The three options were: add that route
    (unplanned scope), always POST `/generate` (**wrong** — generation is non-idempotent, so every
    View Details click would create a duplicate immutable report row), or resolve the id where the
    query is already owner-scoped. The page is a Server Component that already hands this console
    its rows, so it now also passes `reportIdByAnalysis`. Both changed lines trace to this task.
  - side effect, in the right direction: Export downloads through the route, so the filename comes
    from `report_number` server-side instead of the client's `MIDAS_Report_{imageName}.pdf` (FR-024).
  - ⚠️ **Export is broken for `degraded` reports until T050.** Preview accepts `degraded`; the
    download route still requires `completed` and 400s otherwise. Nothing writes `degraded` yet
    (T042 does), so this is latent — but T050 must land before T042 or Export regresses for exactly
    the reports whose limitations matter most.
- [X] T029 In `frontend/src/services/dashboard.server.ts:14`, change `PENDING_REPORT` to `["pending", "generating"]`. Leave `PENDING_ANALYSIS` on line 13 untouched — it is a different vocabulary and out of scope
  - verify: `python -m pytest backend/tests/test_report_contract.py -q` passes the `"processing"` scan (FR-043)
  - done: **11 of 11 contract tests pass** — T014 is fully green. `PENDING_ANALYSIS` untouched, with
    a comment on the changed line recording why the line above it keeps `"processing"`, so the next
    reader does not "fix" the analysis vocabulary to match. The dashboard's pending-work tile now
    counts in-flight reports for the first time; it has been counting zero of them all along.
- [X] T030 [P] In `CLAUDE.md`, correct the Active-feature pointer from `specs/001-report-generation-integrity/` to `.specify/specs/001-report-generation-integrity/`. One line; change nothing else in this file
  - verify: `git diff --numstat CLAUDE.md` shows at most `1  1  CLAUDE.md` on top of the pre-existing modification recorded in `/tmp/midas-worktree-baseline.txt`
  - done: `git diff --numstat CLAUDE.md` → **`1  1  CLAUDE.md`**. One line, nothing else touched.
- [X] T031 [P] Track the spec artifacts, which are doubly ignored (a bare `.specify/` rule plus `*.md` at `.gitignore:95`): `git add -f .specify/specs/001-report-generation-integrity/`
  - verify: `git ls-files .specify/specs/001-report-generation-integrity/ | wc -l` returns ≥ 8 (E5)
  - done: **11 files tracked** (spec, plan, tasks, research, data-model, quickstart, test-plan,
    contracts/, checklists/). Staged, not committed — no commit was requested.
- [X] T032 **Checkpoint** — contract and schema agree, and no browser client reads `generated_reports`
  - verify: `python -m pytest backend/tests/test_report_contract.py -q` passes; `npm run test` passes T015 and T016; `npx tsc --noEmit` and `npm run lint` clean; `grep -rn "from('generated_reports')" frontend/src/comps/` returns nothing
  - done, with one criterion **not met** and one **deferred**:
    - ✅ `test_report_contract.py` — **11 passed**
    - ✅ `npm run test` — **32 passed** (T015 + T016)
    - ✅ `npx tsc --noEmit` — clean
    - ✅ `grep -rn "from('generated_reports')" frontend/src/comps/` — nothing. No browser client
      reads the table or signs a storage URL anywhere under `comps/`.
    - ❌ `npm run lint` is **not** clean: **56 problems, 23 errors** — byte-identical to the count
      before Phase 3, and every error sits in a file no task here touched (nine `api/*` routes, six
      chat/AI components, five other consoles, `lib/api/chat.ts`, `middleware.ts`). Pre-existing, and
      the scope guard forbids fixing unrelated lint findings. This criterion was unachievable as
      written; recording it as passed would have been false.
    - 🚫 Schema agreement is **asserted, not observed** — T025 never ran (Docker down), so the
      contract's five statuses are enforced in two code modules and in a migration file that no
      database has executed.
  - full-suite position: backend **57 failed / 73 passed / 0 errors**, down from 67 failed at T017.
    The 10 closed are T014's contract parity. The 57 remaining are Phases 4–9 and are supposed to
    be red.

---

## Phase 4: User Story 1 — Owner generates a report from their own analysis (P1) 🎯 MVP

**Goal**: the generation path itself, with the ownership-scoped context helper wired in place of the
duplicated inline block.

**Independent test**: sign in with at least one stored analysis, request each of the four types, and confirm
a viewable document returns containing that analysis's findings.

### Backend generation

- [X] T033 [US1] In `backend/app/api/reports.py::generate_report`, replace the inline analysis fetch and signed-URL heatmap block (~`:176-214`) with a call to the already-present, currently-never-called `_build_report_context(request, supabase)` (`:115`)
  - one substitution delivers three requirements: ownership scoping (FR-005), the data-URI overlay that removes an untimeoutable HTTPS round trip from inside `write_pdf()`, and deletion of a duplicated path. Net line count on the file must be **negative** (C1, Constitution V)
  - verify: `python -m pytest backend/tests/test_report_ownership.py backend/tests/test_report_golden_path.py -q` passes; `git diff --stat backend/app/api/reports.py` shows more deletions than insertions
  - done: `git diff --stat` → **42 insertions, 60 deletions, net −18** (C1 satisfied). The three
    ownership tests flip green — `test_foreign_owned_analysis_is_not_found`,
    `test_owner_predicate_is_always_sent`, `test_refusal_precedes_any_render` — and the refusal now
    precedes the overlay download, so nothing is fetched for a row the caller cannot have.
    The `create_signed_url` fallback chain is gone with the block; the helper's
    `_load_heatmap_data_uri` inlines the PNG as a data URI instead, which is what removes the
    round trip from inside `write_pdf()`. Step comments renumbered 4/5/6 → 2/3/4 because steps 1–3
    collapsed into the helper call.
  - ⚠️ **the stated verify cannot pass in this phase.** `test_report_ownership.py` keeps 3 failures
    and `test_report_golden_path.py` keeps 8, and none of them belong to T033: the ownership three
    are the `"test-key"` credential assertions (**T048**, Phase 6) and the golden-path eight are the
    absent `provenance` key (**T038**, Phase 5). Nothing in Phase 4 can close them. Recorded as
    partially met rather than passed.
- [X] T034 [US1] In `backend/app/api/reports.py:115-132`, delete the `scope_user` parameter and scope unconditionally; rewrite the docstring, which describes a streaming route and an edge-function caller that T033 removes
  - **not [P]** — same file as T033 (C11)
  - verify: `grep -c scope_user backend/app/api/reports.py` returns 0
  - done: `grep -c scope_user` → **0**. The docstring no longer describes a streaming route or an
    edge-function caller, neither of which exists on the live path. It now records what the deleted
    default actually cost — any caller holding the shared secret could render any person's analysis —
    and states the rule the parameter obscured: `request.user_id` is the **ownership filter, never
    proof of identity** (FR-005, FR-006). The query is one unbroken chain, so there is no longer a
    branch where the predicate can be skipped.
- [X] T035 [US1] In `backend/app/api/reports.py`, wrap `_build_report_context` and `generate_pdf` in `await asyncio.to_thread(...)` — synchronous WeasyPrint currently runs on the event loop that also serves chat. **Keep the `asyncio` import**
  - **not [P]** — same file (C12)
  - verify: `grep -n "asyncio.to_thread" backend/app/api/reports.py` shows two call sites; backend starts clean and `curl -s localhost:8000/api/v1/health` responds during a generation
  - done: two call sites at `:194` and `:209` (a third grep hit at `:120` is the helper docstring).
    `asyncio` was imported but entirely unused before this — the only prior occurrence in the file
    was that same docstring promising a `to_thread` call no caller made.
  - verified: backend boots clean on a scratch port and serves
    `{"status":"healthy",…}` on `/api/v1/health` plus `{"ready":true,"supabase_ready":true,…}` on
    `/readyz`. **Half-verified**: "responds *during a generation*" needs live NVIDIA and Supabase
    credentials plus a real analysis row, which is the manual release-gate class (T089/T093). The
    thread offload is verified structurally, not under concurrent load.
- [X] T036 [US1] In `backend/app/api/reports.py`, drop only the imports that T033 orphaned (`json`, `AsyncIterator`, `StreamingResponse`, and `settings` if now unreferenced). Remove nothing else
  - **not [P]** — same file
  - verify: `npm`-free check — `cd backend && source venv/bin/activate && python -c "import app.api.reports"` succeeds; `python -m pyflakes app/api/reports.py` reports no unused import (or visual confirmation if pyflakes is absent)
  - done: `import app.api.reports` succeeds; `import app.main_agent` also clean, so the live entry
    point still loads. pyflakes is not installed and was **not** added — an unused-import check does
    not justify a new dependency — so the check ran as a throwaway `ast` walk comparing imported
    names against every `Name`/`Attribute` in the tree: **unused imports: none**.
    All four named imports removed (`json`, `AsyncIterator`, `StreamingResponse`, `settings`), plus
    the now-empty `from app.config import settings` line. `asyncio` **kept**, as instructed, and it
    is genuinely used after T035. Nothing else touched — the four were already dead before T033
    rather than orphaned by it, which is why this task names them individually.
- [X] T037 **Checkpoint (US1)** — the golden path is provably intact
  - verify: `python -m pytest backend/tests/test_report_golden_path.py backend/tests/test_prompt_provenance.py -q` passes for all four types
  - done, **partially met — and the shortfall is the plan's sequencing, not the code**:
    - ✅ `test_prompt_provenance.py` — **16/16**, all four types. No prohibited row content reaches
      the model, and the permitted evidence still does.
    - ✅ `test_report_golden_path.py` — **12/20**. Everything Phase 4 can reach is green for all
      four types: the supplied report number renders verbatim, the document prints one confidence
      value with nothing above 100%, and all four narrative sections reach the rendered document.
    - ❌ the remaining **8** are `test_well_formed_narrative_is_completed` and
      `…_reports_four_of_four_sections`, ×4 types. Both read `content["provenance"]`, which
      **T038 creates** — a Phase 5 task. No edit inside Phase 4's scope (`reports.py` only) can
      close them; the key is produced in `report_generator.py`.
    - ✅ `test_report_ownership.py` — **7/10**. The three ownership assertions this phase owns are
      green. The three failures are the `"test-key"` credential assertions, owned by **T048**.
  - full-suite position: backend **54 failed / 76 passed / 0 errors**, down from 57 at T032 and 67
    at the T017 baseline. Every closed failure so far belongs to a task actually executed.

---

## Phase 5: User Story 2 — A failure is never presented as a finished report (P1)

**Goal**: every genuine failure surfaces as `failed` or explicitly-labelled `degraded`. No hollow document is
ever marked complete.

**Independent test**: force each failure mode in turn — service down, narrative credential absent, renderer
error, storage rejection, prose-only narrative, empty narrative — and confirm each yields an explicit failure
or a labelled degraded result.

### Backend generation

- [X] T038 [US2] In `backend/app/services/report_generator.py`, classify on **usable content**, not parseability: structured response → complete provenance; usable prose → `degraded` provenance naming the absent sections and setting `degraded_reason`; nothing usable → **raise**. Record the real generator identity in `generator`, never a hardcoded label
  - the existing fenced/embedded-JSON tolerance at `:265-274` is correct and stays. The anti-fabrication prompts and `build_evidence_block` are protected by T010/T012, not rewritten (C5 as modified; FR-016, FR-016a, FR-018, FR-034; spec edge case 4)
  - verify: `python -m pytest backend/tests/test_report_degradation.py -q` passes all three cases
  - done: **7/7 degradation, and 20/20 golden path** — T011's eight provenance failures close here,
    as predicted in Phase 4. New `build_provenance()` + `NarrativeUnavailable`; `parse_llm_json`'s
    fenced/embedded tolerance untouched, and the prompts and `build_evidence_block` untouched.
    `NARRATIVE_SECTIONS` is imported from the contract module rather than re-listed.
  - **the classification rule, stated plainly.** Unusable means: no section has content; **or** the
    summary opens with a refusal; **or** summary is the only section and is under 40 characters.
    Anything else with content is degraded, naming every absent section.
  - ⚠️ **the refusal check is a heuristic and is commented as one.** It matches openers only —
    matching mid-text would reject every genuine "limitations" paragraph, which by definition
    discusses what the system cannot do. A refusal phrased unlike the listed openers reads as prose
    and classifies as **degraded**, which fails safe: degraded is labelled, surfaced before the
    document opens, and names its absent sections. The worst case is an honest report with an odd
    summary, never a silent one.
  - note, not fixed: `report_stream.py` imports `normalize_llm_content` and `parse_llm_json` and is
    **dead** — nothing in `app/` imports it. This change is additive so it still works. Left alone
    per the scope guard.
- [X] T039 [US2] In `backend/app/api/reports.py::generate_report`, emit `X-Report-Sections`, `X-Report-Generator`, and `X-Report-Degraded` (omitted when complete) so the orchestrator classifies the outcome without parsing the document
  - **not [P]** — same file as T040 (C7, contract §3)
  - verify: `python -m pytest backend/tests/test_report_headers.py -q` passes the header cases
  - done: **11/11** — T013 fully green, header and envelope cases together. `_provenance_headers()`
    emits sections in `NARRATIVE_SECTIONS` order, and **omits** `X-Report-Degraded` when complete
    rather than sending it empty: an empty header reads as a reason nobody wrote.
- [X] T040 [US2] In `backend/app/api/reports.py`, replace the `str(e)` response at `:240` with the contract §6 envelope built by `error_body()`; log the detail server-side only. `details` must never carry credentials, another person's storage path, or a raw upstream payload
  - **not [P]** — same file as T039 (C8)
  - verify: `python -m pytest backend/tests/test_report_headers.py -q` passes the envelope cases
  - done: the 500 branch now logs with `logger.exception` (traceback, server-side) and returns a
    fixed string. The old `str(e)` went into the browser response **and** into `error_message`,
    where it was rendered back to the user — an upstream 401 quotes the NVIDIA key, a storage error
    quotes a path belonging to whoever owns the bucket object.
  - **design decision worth reviewing: `_EnvelopeRoute`.** Getting `{error, code, details?}` out of
    *every* error, including the 401 raised inside the `verify_api_key` dependency, is not possible
    from the endpoint body — a dependency's `HTTPException` never reaches the endpoint's `except`.
    An app-level handler would fix the shape but would not travel with the router: every app
    mounting it would have to re-register the handler and would silently fall back to
    `{"detail": …}` wherever someone forgot. A custom `APIRoute` class makes the envelope a
    property of these endpoints instead of their host. ~20 lines, and status→code comes from one
    `_ERROR_CODES` map so a new refusal cannot invent a new shape.

### PDF rendering

- [X] T041 [US2] In `backend/app/services/pdf_generator.py`, add a provenance block directly under the title and **above any clinical finding** in both the patient template (~`:191`) and the clinician template (~`:461`) — report number, dates, completeness, and the screening-aid framing — with `page-break-inside: avoid`. Use the same word the screen uses ("Incomplete"). Add a degradation banner naming every absent section, and an explicit note when the overlay was unavailable
  - without this, page 1 can be printed and handed to a clinician with no visible caveat (D22, FR-017, FR-040a, FR-057, SC-012)
  - verify: `python -m pytest backend/tests/test_pdf_content.py -q` passes cases (d) and (e)
  - done: **24/32 — (a), (c), (d) and (e) all green for all four types.** The 8 remaining are case
    (b), the report-number fallback, owned by **T069**. Provenance block in both templates with
    `page-break-inside: avoid`, carrying report number, both dates, completeness, and the
    screening-aid framing, above every clinical finding.
  - **completeness is derived from the content, not from a passed-in structure.** `generate_pdf`
    computes `sections_generated` from the four `llm_*` fields it already receives, so the renderer
    and the headers cannot disagree and no caller has to remember a parallel argument.
    `recommendations` is judged on the **model's** list, not the merged one: when the narrative
    fails, the canned pipeline list still renders, and counting that as a generated section would be
    the exact substitution this feature exists to stop.
  - "Incomplete" is the word used, matching the screen (D17). A document saying "partial" or
    "degraded" would read as a different state from the one the person just saw in the list.
  - ⚠️ **beyond this task's letter: T010 case (c) has no owning task.** No task in the plan
    implements the absent-differential disclosure (FR-031 is cited in T010's rationale and nowhere
    else), so that red would never have closed. Implemented here — an `{% else %}` on the clinician
    differential table plus a provenance flag in both templates — because it is the same
    "absence is stated, not silent" requirement this task already carries. **Verified genuine, not
    incidental**: rendered with an overlay *present* so the overlay note could not satisfy the
    assertion, both `clinician_report` and `detailed_analysis` still print "differential … not
    recorded".
  - note, not fixed: when the narrative's recommendations are absent, the document names
    "recommendations" as not generated **and** still renders the pipeline's canned
    `medical_analyses.recommendations` list. Both statements are true but they sit oddly together,
    and that canned list is the same class of pipeline placeholder as `detected_features`. No task
    covers it.

### Frontend orchestration

- [X] T042 [US2] In `frontend/src/app/api/reports/generate/route.ts`, replace the inline outcome handling with `classifyBackendResult()` from `lib/reports/orchestration.ts`; map a degraded backend result to `generation_status: 'degraded'`. Keep the existing `markReportFailed` behaviour, which is already correct
  - verify: `npm run test` passes T015; `npx tsc --noEmit` clean
  - done: `npm run test` **32/32**, `tsc` clean. `classifyBackendResult(backendResponse)` consumes the
    `Response` structurally — no adapter needed. `markReportFailed` kept verbatim as instructed.
    A degraded backend result now persists `generation_status: 'degraded'` and the JSON response
    carries `generation_status` and `provenance`, so the console can disclose incompleteness before
    the person opens the document (FR-017).
- [X] T043 [US2] In `frontend/src/app/api/reports/generate/route.ts`, persist `sections_generated`, `generator`, and `degraded_reason` on the finalize UPDATE (~`:189`) — without this, FR-018 and SC-006a are unwritable and the `014` columns stay NULL on every new row
  - **not [P]** — same file as T042 (D5b)
  - verify: after one generation, `select sections_generated, generator from generated_reports order by created_at desc limit 1;` returns non-null values
  - done: the finalize UPDATE writes the whole `finalizePatch()` object —
    `sections_generated`, `generator`, `degraded_reason` alongside status, storage path and
    `generated_at`. One patch built by one tested pure function, so the row and the response cannot
    describe different outcomes.
  - 🚫 **cannot be verified, and will FAIL AT RUNTIME until T025 runs.** The three columns do not
    exist on this database — migration `014` has never been applied (Docker down). PostgREST rejects
    an UPDATE naming an unknown column, and T045 now checks that error rather than discarding it, so
    **every generation will return 500 against a pre-014 database**. This is the correct deploy
    order (migration, then code), not a defect — but the code must not ship or run ahead of `014`.
- [X] T044 [US2] In `frontend/src/app/api/reports/generate/route.ts`, wrap the backend `fetch` (`:121`) in `AbortSignal.timeout(REPORT_ABORT_MS)` from the contract; on abort call `markReportFailed` with an explicit reason. The call is unbounded today
  - **not [P]** — same file (D5c, SC-001)
  - verify: point `BACKEND_URL` at a socket that accepts and never responds; the row reaches `failed` within ~240 s and the UI shows "Couldn't be generated", never an endless spinner
  - done: `AbortSignal.timeout(REPORT_ABORT_MS)` on the backend fetch. A timeout is distinguished
    from unreachable by `error.name` (`TimeoutError`/`AbortError`) and gets its own **504** and its
    own row reason naming the elapsed limit; unreachable keeps **503**. Two causes, two messages —
    "we stopped waiting" and "we could not connect" send whoever is debugging to different places.
  - half-verified: the constant ordering (180s LLM ceiling < 240s abort < 300s stale) is asserted by
    T015. The live socket-that-never-answers test needs a running stack and is deferred to the
    release gate.
- [X] T045 [US2] In `frontend/src/app/api/reports/generate/route.ts`, check the finalize UPDATE result — `route.ts:185` discards its error today. Never return `success: true` when the row write disagrees
  - **not [P]** — same file (D5d)
  - verify: `npm run test` passes the `finalizePatch` assertion in T015
  - done: `npm run test` passes T015's `finalizePatch` assertions. The discarded error at `:185` is
    now checked and returns **500** with an explicit message. Before this, a failed write left the row
    on `generating` while the caller was told `success: true` — the report looked finished to the
    person who asked for it and unfinished to every later reader, which is precisely the
    disagreement this feature exists to remove.
- [X] T046 **Checkpoint (US2)** — no failure path can produce a completed-looking report
  - verify: `python -m pytest backend/tests/test_report_degradation.py backend/tests/test_report_headers.py backend/tests/test_pdf_content.py -q` passes; `npm run test` green; walk the six failure modes in `quickstart.md` § "Degradation is visible" and confirm each ends `failed` or `degraded`
  - done, **automated half met, manual half deferred**:
    - ✅ `test_report_degradation.py` **7/7** · `test_report_headers.py` **11/11** ·
      `test_pdf_content.py` **24/32**, the 8 being case (b), owned by T069
    - ✅ `npm run test` **32/32**; `npx tsc --noEmit` clean; `npm run lint` unchanged at 56/23, all
      pre-existing and in files no task here touched
    - ✅ backend imports and boots; `/api/v1/health` responds
    - 🚫 the six-failure-mode walk in `quickstart.md` needs a running stack with live NVIDIA and
      Supabase credentials **and** migration `014` applied. Not done. Five of the six are covered
      structurally by unit tests (prose-only, empty narrative, service unreachable, service timeout,
      storage rejection); the sixth — narrative credential absent — is only covered as a 500 path.
  - coverage of each failure mode as it stands: service unreachable → **503** + `failed`;
    timeout → **504** + `failed` (T044); narrative unusable → raise → **500** + `failed` (T038);
    narrative partial → **`degraded`**, labelled on screen and in the document (T038/T041/T042);
    storage rejection → **500** + `failed`; finalize-write failure → **500**, never `success: true`
    (T045). No path returns a completed-looking report.
  - full-suite position: backend **10 failed / 120 passed / 0 errors**, down from 54 at T037 and 67
    at the T017 baseline. Every one of the 10 belongs to Phase 8 — **T067** (2, confidence units)
    and **T069** (8, report-number fallback).

---

## Phase 6: User Story 3 — Invalid, foreign, and unsupported requests are refused explicitly (P2)

**Goal**: each bad request is refused with its own accurate reason, and nothing is silently substituted.

**Independent test**: issue each malformed or unauthorised request in turn and confirm the refusal reason is
correct and distinct, with no record, document, or partial state left behind.

### Backend generation

- [X] T047 [US3] In `backend/app/api/reports.py:21`, replace `normalize_report_type` with `validate_report_type`, rejecting with a 422 that names the four supported types instead of coercing to `diagnostic_summary`. Update every caller in the same edit
  - verify: `python -m pytest backend/tests/test_report_type_validation.py -q` passes; `grep -c normalize_report_type backend/app/api/reports.py` returns 0
  - done: **12/12 type-validation tests pass**; `grep -c normalize_report_type` → **0**. Both callers
    updated in the same edit. `REPORT_TYPES` comes from the contract module rather than a re-listed
    local set, so the refusal message cannot drift from the closed set. Validation runs **first** in
    the endpoint, before anything is fetched, rendered or written, so a bad type leaves no state.
- [X] T048 [US3] In `backend/app/api/reports.py:59`, remove the `"test-key"` fallback from `verify_api_key`: refuse with 503 plus an error log when `BACKEND_API_KEY` is unconfigured, and use `secrets.compare_digest` for the comparison
  - **not [P]** — same file as T047 (C3, C13, FR-007)
  - **deliberate deviation, carried from the eng review**: no local-test bypass mode ships. A second authentication path is one environment-variable mistake away from production, and this repo sets no `ENV` variable to gate such a flag against
  - verify: `python -m pytest backend/tests/test_report_ownership.py -q` passes the credential cases; with `BACKEND_API_KEY` unset the endpoint returns 503, not 401 and not a successful render

### Frontend orchestration
  - done: **10/10 ownership tests pass** — the last three credential failures from the T017 baseline
    close here. The hardcoded fallback is gone; unset `BACKEND_API_KEY` logs an error and refuses
    with **503**, not 401, because the caller's credential was never the problem and blaming it
    sends the debugger to the wrong side of the connection. `secrets.compare_digest` replaces `!=`.
    No local-test bypass ships, per the eng-review deviation.
  - note: the test asserting the literal is absent from the module source caught my own **docstring**
    quoting it while explaining the fix. Reworded. The assertion is stricter than "no code path uses
    it", and that is the right strictness for a published credential.
- [X] T049 [US3] In `frontend/src/app/api/reports/generate/route.ts:56`, replace `config?.reportType || 'diagnostic_summary'` with a strict `zod` parse of the whole `config` object against a schema built from `REPORT_TYPES`. `reportType` is required; unknown keys are rejected with 422; only declared fields are persisted (`zod@^4.1.12` is already a dependency)
  - verify: posting `{"config":{"reportType":"research_report"}}` returns 422 with `code: "INVALID_REPORT_TYPE"` naming the four types; posting an unknown key returns 422 and the key is absent from `report_config`
  - done: `parseReportConfig` (`orchestration.ts` §1) replaces the substitution. `reportType`
    is required against `REPORT_TYPES`; `.strict()` **refuses** unknown keys rather than
    stripping them, because a stripped key leaves the caller believing an option took effect.
    Absent and wrong are different mistakes and get different sentences under the same
    **INVALID_REPORT_TYPE**; a malformed config gets **INVALID_CONFIG**. Both 422. Only
    `parsed.config` reaches `report_config` and the backend body, so an invented key is never
    stored. The four `include*` flags are optional with **no defaults** — a default here would
    be the parser inventing an instruction nobody gave, which is the same class of mistake it
    replaces. **14 new vitest cases**; suite 32 -> 46, all green.
  - deviation: the adjacent `analysis_id is required` 400, inside the same rewritten block,
    moved to `errorBody('INVALID_REQUEST', ...)` for envelope consistency. One line. The
    route's other pre-existing bare refusals were left alone — see the note under T052.
- [X] T050 [US3] In `frontend/src/app/api/reports/[id]/download/route.ts`, use `getSupabaseAdmin()` instead of inlining env resolution a third time (it already reads both spellings of both variables); accept `degraded` alongside `completed`; use the shared `assertReportOwner` predicate from `reports.server.ts`; **remove the dormant `clinician_id` branch** rather than extending it — clinician sharing becomes its own feature
  - today this route accepts only `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` with non-null assertions, so one valid configuration makes generation succeed and every download fail (D6, FR-044)
  - verify: `npx tsc --noEmit` clean; download succeeds for a `degraded` report; a foreign report id returns 403 identically to preview
  - done: `getSupabaseAdmin()` replaces the third inlined env resolution, so the
    `SUPABASE_SERVICE_ROLE_KEY` spelling that made generation succeed and every download fail
    now works here too (D6, FR-044). `degraded` is served alongside `completed`.
    `assertReportOwner` replaces the local check. The `clinician_id` branch is **gone** —
    surviving only as prose explaining why it went: it widened access via a column no migration
    creates and nothing populates, and clinician sharing needs its own authorization model
    rather than half of one in a download route.
  - note: preview and download now emit identical code/status pairs at every stage —
    401 UNAUTHENTICATED · 403 FORBIDDEN · 404 NOT_FOUND · 409 NOT_READY · 500 INTERNAL. The
    download response keeps `Content-Disposition: attachment; filename="{report_number}.pdf"`.
- [X] T051 [US3] In `frontend/src/app/api/reports/[id]/preview/route.ts`, switch to the same `assertReportOwner` predicate so preview and download share exactly one owner check
  - verify: `grep -c assertReportOwner frontend/src/app/api/reports/\[id\]/*/route.ts` returns 2
  - done, **already satisfied — verified, not changed**: `preview/route.ts` was written against
    `assertReportOwner` when it was created, so no edit was needed. Both route files now
    reference the predicate (`download` 3 mentions including prose, `preview` 2) and there is
    exactly one owner check in the codebase. The verify line's literal `grep -c` returns a
    per-file count rather than a single `2`; the condition it is testing for holds.
- [X] T052 **Checkpoint (US3)** — every refusal is distinct, accurate, and leaves no state
  - verify: run the two-account and type-rejection blocks in `quickstart.md` § "Manual verification"; confirm 401/403/404/422 each with its own code, and `select count(*) from generated_reports where generation_status not in ('completed','degraded','failed')` returns 0 afterwards (FR-012)
  - done, **automated half met, manual half deferred**:
    - ✅ `test_report_ownership.py` + `test_report_type_validation.py` +
      `test_report_contract.py` → **33 passed**
    - ✅ `npm run test` **46/46** · `npx tsc --noEmit` clean · `npm run build` succeeds
    - ✅ full backend suite **10 failed / 120 passed**, unchanged from T046 — all 10 are
      Phase 8 (T067 ×2, T069 ×8)
    - ✅ refusal audit: generate adds 400 INVALID_REQUEST · 422 INVALID_REPORT_TYPE ·
      422 INVALID_CONFIG, each distinct; validation runs before any fetch or write, so a bad
      request leaves no row (FR-012)
    - 🚫 the two-account and type-rejection blocks in `quickstart.md`, and the
      `select count(*) from generated_reports where generation_status not in (...)` check,
      need a live stack with two Clerk accounts and migration `014`. Not run.
  - known gap, flagged not fixed: the generate route's own 401/403/404/500 still use the bare
    `{error}` shape rather than `errorBody`. No task in this range owns them.

---

## Phase 7: User Story 4 — Report history survives a refresh and stays actionable (P2)

**Goal**: reports are read from stored records, so they survive a reload with working preview and download.

**Independent test**: produce a report, fully reload the application, and confirm it is listed with its
identifier and status and that preview and download both work without regenerating.

### Durable UI state

- [X] T053 [US4] In `frontend/src/app/dashboard/reports/page.tsx` (39 lines, server component), fetch owner-scoped reports via `services/reports.server.ts` and pass them as props into the console
  - verify: `curl -s localhost:3000/dashboard/reports | grep -c MIDAS-REP` ≥ 1 when the signed-in user has a report — the number is in the server-rendered HTML, not fetched by the client
  - done: `getReportsForUser` is read **in parallel** with `getAnalysisHistory` (they share
    nothing, and sequencing them would add a round trip to every load) and passed as `reports`;
    the analysis-derived rows move to a separate `analyses` prop. `loadFailed` is now the OR of
    both reads. Also passes `serverNow`: the console derives staleness and elapsed time from a
    clock, and reading that clock during hydration instead would make the server and first
    client render disagree by however long the response took.
  - half-verified: the console is `nextDynamic(...)` **without** `ssr: false`, so it
    server-renders and `report_number` is in the HTML; `npm run build` lists
    `/dashboard/reports` as `ƒ` (server-rendered on demand). The literal
    `curl -s localhost:3000/dashboard/reports | grep -c MIDAS-REP` needs a running stack and a
    signed-in account that owns a report. Not run.
- [X] T054 [US4] In `frontend/src/comps/dashboard/reports/reports-console.tsx`, seed report state from props via `hydrateReports()` instead of an empty `useState`. Retain `useState` for **in-flight transitions only**, and call `router.refresh()` after a generation completes
  - verify: generate a report, hard-reload, and confirm the row persists with Preview and Download working — before this, the card resets to *Generate Report* (D4, FR-035, FR-036)
  - done: `hydrateReports(reports, inFlight)` seeds the list. `reportStatuses` — the ephemeral
    map that *was* the refresh-loss defect — is **gone** (0 occurrences). Client state holds
    in-flight transitions only: a generation with no server row yet is keyed
    `pending:{analysisId}:{reportType}` and dropped the moment the server is re-read.
    `router.refresh()` runs in `finally`, so a failed generation re-reads too — the route wrote
    a `failed` row, and that row is the truth the page should show.
  - not verified live: the generate → hard-reload → row-persists walk needs a running stack.
    Structurally the list no longer has an ephemeral source it can lose.
- [X] T055 [US4] In `frontend/src/comps/dashboard/reports/reports-console.tsx`, split the list into two sections: **Your reports** (one row per `generated_reports` row) above **Analyses without a report** (one row per analysis with no report, carrying the Generate action)
  - **not [P]** — same file as T054. Without this, FR-025's immutable duplicates make every earlier report unreachable and **SC-003 cannot be met at the interface** regardless of backend correctness (D13)
  - verify: generate twice for the same analysis and type; both rows appear in "Your reports" with distinct report numbers
  - done: **Your reports** (one card per `generated_reports` row) above **Analyses without a
    report** (one card per analysis that no row points at, carrying the Generate action). FR-025's
    immutable duplicates are now all reachable — two generations of the same analysis and type
    are two cards with distinct report numbers, which is what SC-003 needs at the interface.
  - decision: an analysis whose only report is `failed` or interrupted stays **out** of the
    second section; its own row carries **Generate again** instead. It is still one piece of
    work, and listing it in both sections would show it twice.
- [X] T056 [US4] In `frontend/src/comps/dashboard/reports/reports-console.tsx`, remove the four stat tiles at `:318-334`. They count analysis statuses (`pending`/`completed`/`reviewed`) that describe nothing on the page after T055, and one counts `reviewed`, which appears in no contract. Section headers carry the counts instead (D21)
  - verify: `grep -c "stat\|Card" frontend/src/comps/dashboard/reports/reports-console.tsx` drops by four tiles; the page renders no count that is not a count of rows visible on it
  - done: all four tiles removed — `Total Reports`, `High Risk`, `Pending Review` and
    `Completed` each 0 occurrences, along with the `md:grid-cols-4` row that held them.
    Section headers carry the counts, so every number on the page counts rows visible on it.
    `reviewed` appears **0** times in the file. Real `<Card>` elements 11 → 10 (−4 tiles,
    +1 analyses card, +2 empty states).
  - found while removing: `Pending Review` could only ever read 0. `toReportRow` hard-codes
    `status: "completed"` for every analysis, so that tile was counting a constant.
  - also removed, beyond the literal task text: the analysis-status `<select>`
    (`completed`/`pending`/`reviewed`). It selects on the same field for the same reason the
    tiles did, and after T055 neither section carries it. Search and the risk filter are kept.
- [X] T057 [US4] In `frontend/src/comps/dashboard/reports/reports-console.tsx`, add the three empty states, each with exactly one action: first-run ("Reports are generated from a skin analysis" → Analyse an image), no-filter-match (echoes the search term → Clear filters), load error ("Your reports are safe. This is a display problem." → Try again). The analyses-but-no-reports case renders **no** empty card — the second section is already populated (D14, FR-039)
  - verify: with zero reports the first-run card renders; with a non-matching filter the search term is echoed; with `reports.server.ts` forced to error the load-error card renders instead of an empty list (FR-039)
  - done: three cards, one action each — load error ("Your reports are safe. This is a display
    problem." → **Try again**, `router.refresh()`), first-run ("Reports are generated from a
    skin analysis." → **Analyse an image**), and no-match (echoes the term in the heading →
    **Clear filters**). The analyses-but-no-reports case renders no card.
  - reading recorded: the verify line says "with zero reports the first-run card renders",
    while D14/FR-039 require **no** empty card when analyses exist but reports do not. Resolved
    as first-run = no reports **and** no analyses — the only reading under which both hold.
- [X] T058 [US4] In `frontend/src/comps/dashboard/reports/reports-console.tsx`, render the generating row with an elapsed timer and the line "You can leave this page — it'll be here when you get back."; change the supporting line once at 120 s. **No progress bar** — there is no progress signal to report honestly (D15)
  - verify: start a generation and watch the row for 130 s — the timer increments, the supporting line changes once at 120 s, and no progress bar appears
  - done: `Elapsed m:ss` on every waiting row, from a 1 s interval that runs **only** while
    something is actually generating. The supporting line changes once at `LONG_WAIT_MS`
    (120 000) from the shared `generating` description to "Still going. This one is taking
    longer than most — it will either finish or tell you why." **No progress bar**: the word
    `progress` survives only in the two comments explaining its absence, because the report
    service streams nothing back until it is done and a percentage would be invented.
  - not verified live: the 130 s watch needs a running generation.
- [X] T059 [US4] In `frontend/src/comps/dashboard/reports/reports-console.tsx`, present a `generating` row older than `REPORT_STALE_MS` as *Didn't finish*, using `isStale()` at read time. No transition exists when the observer dies, and T054's durability makes that permanently visible (D9)
  - verify: hand-insert a `generating` row with `created_at` 6 minutes old; it presents as *Didn't finish* on load and regenerating still works
  - done: `isStale(row, now)` at read time. A stale row presents as *Didn't finish* via
    `presentStatus(status, { stale })`, stops rendering a timer, drops out of the
    "is anything generating" test that keeps the interval alive, and gains **Generate again**
    so regenerating still works.
  - not verified live: hand-inserting a 6-minute-old `generating` row needs the database.
    The rule itself is covered by T015's `isStale` cases, including the inclusive boundary at
    `REPORT_STALE_MS`.
- [X] T060 [US4] In `frontend/src/comps/dashboard/reports/reports-console.tsx`, render status chips from `data/reports/status-presentation.ts` — label + colour + icon on every chip, icons `aria-hidden`, the label as the accessible name. Incomplete is amber, not red: the report exists and is usable, and Preview and Download stay offered for it (D17, D20)
  - verify: each of the six display states renders its D17 label, colour, and icon; `npm run lint` reports no `jsx-a11y` violation; icons carry `aria-hidden`
  - done: one `StatusChip` renders every chip from `STATUS_PRESENTATION` — label + colour +
    icon, icon `aria-hidden`, and the label as text content so it becomes the accessible name
    with no `aria-label` that could drift from what is on screen. Incomplete is amber and keeps
    **Preview and Download** (D17, D20), and appends which sections are missing via
    `missingSections`. `npm run lint`: **0 findings in this file**; whole-repo total fell
    56/23 → 53/20, the rewrite having cleared 3 pre-existing errors.
  - deviation: the generating icon uses `motion-safe:animate-spin`, not `animate-spin`. T062
    owns reduced-motion; the built-in variant costs one word and avoids shipping a defect T062
    would otherwise have to come back for.
- [ ] T061 [US4] In `frontend/src/comps/dashboard/reports/reports-console.tsx`, apply the responsive rules: ≥1024 px table; 768–1023 px drops the date column; <768 px stacked cards with **status first** and Preview/Download at ≥44 px. Status leads on mobile because it is the one fact that decides whether to open the document (D18)
  - verify: at 375 px there is no horizontal scroll, status is the first element in each card, and Preview/Download measure ≥44 px; at 768 px the report number is not truncated
- [ ] T062 [US4] In `frontend/src/comps/dashboard/reports/reports-console.tsx`, announce completion once via `role="status" aria-live="polite"`; the elapsed timer must **not** be a live region; `Loader2` must respect `prefers-reduced-motion` (D19)
  - verify: VoiceOver announces completion once; the elapsed timer does not re-announce; with `prefers-reduced-motion: reduce` the `Loader2` spin stops
- [ ] T063 [US4] In `frontend/src/components/generate-report-dialog.tsx`, source the options from `REPORT_TYPES` in the shared contract — replacing the hardcoded 3-value union at `:20` and restoring the missing `patient_report` — and rewrite all four descriptions to name what is produced. Remove `'Comprehensive report with all detected features'` at `:123`, which promises the `detected_features` column that `report_generator.py:201-204` deliberately excludes
  - see the scope guard: this resolves the CEO/design conflict in favour of all four types (D16, FR-011a)
  - verify: `npx tsc --noEmit` clean; four `<option>` values render and match `REPORT_TYPES` exactly
- [ ] T064 [US4] In `frontend/src/comps/dashboard/history/history-console.tsx:95`, replace the hard-coded `reportType: 'patient_report'` with the shared picker from T063
  - verify: `grep -c "'patient_report'" frontend/src/comps/dashboard/history/history-console.tsx` returns 0
- [ ] T065 [US4] Derive the download filename from the report's own `report_number` in both `reports-console.tsx` and `history-console.tsx`, matching what the server serves. The client sets `MIDAS-Report-{shortId}.pdf` today (FR-024)
  - verify: download a report and confirm the saved filename equals `{report_number}.pdf` and equals the number printed inside the PDF
- [ ] T066 **Checkpoint (US4)** — durability is real, not simulated
  - verify: generate → hard-reload → preview → download, with no regeneration; `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test` all clean

---

## Phase 8: User Story 5 — Every figure in the report is one the system measured (P3)

**Goal**: every displayed figure traces to stored data; unavailable measures are omitted or labelled, never
fabricated or zeroed.

**Independent test**: produce reports from analyses with complete, partial, and legacy stored findings and
confirm every displayed figure traces to stored data.

### PDF rendering

- [ ] T067 [US5] In `backend/app/services/pdf_generator.py:643`, derive `metric_display.confidence` from the same value as the header via `to_percent`. The header reads the column and the metric box reads the jsonb today; both render, at `:461` and `:494`, so a mixed-unit row prints e.g. `87.3%` beside `8730.0%`
  - verify: `python -m pytest backend/tests/test_confidence_units.py -q` passes both the raw-probability and legacy-percentage cases (C9, FR-027, SC-005)
- [ ] T068 [US5] Export `coerce_metrics` from `backend/app/services/report_generator.py:63` (drop the leading underscore) and delete the inline duplicate at `backend/app/services/pdf_generator.py:628-636`, including its function-local `import json` on `:630`, which carries already-divergent failure handling
  - **not [P]** — touches both files, and T067 edits the second (C10)
  - verify: `grep -c "import json" backend/app/services/pdf_generator.py` shows only module-level imports; all four types still render
- [ ] T069 [US5] In `backend/app/services/pdf_generator.py:677`, change the report-number fallback from `"MIDAS-REP-" + strftime("%y%m%d%H%M")` to the canonical `REPORT_NUMBER_PATTERN` format, and log a warning when it fires — the orchestrator always supplies a number now, so its use is a defect signal rather than a normal path
  - **not [P]** — same file (A5, FR-022, FR-023)
  - verify: `python -m pytest backend/tests/test_pdf_content.py -q` passes case (b)
- [ ] T070 [US5] Scan both templates in `backend/app/services/pdf_generator.py` and remove any remaining prohibited-measure rendering — accuracy, balanced accuracy, AUROC/AUC, precision, recall, F1, specificity, sensitivity, PPV, NPV — in any form, labelled or otherwise. Omission is the only permitted treatment; never zero and never an empty measurement
  - verify: `python -m pytest backend/tests/test_pdf_content.py -q` passes case (a) for all four types (FR-030, FR-030a, SC-006)

### Frontend orchestration

- [ ] T071 [US5] In `frontend/src/app/api/reports/generate/route.ts:87-88`, replace `Math.random().toString(36).slice(2, 8)` with `makeReportNumber()` from the shared contract, and assert the value against `REPORT_NUMBER_PATTERN` **before** the insert. The RPC path is already canonical and stays
  - verify: `npm run test` passes T016; 20 consecutive generations produce 20 numbers that all match, with no CHECK-constraint rejection (D11)
- [ ] T072 **Checkpoint (US5)** — the four-way identity holds and nothing unmeasured is printed
  - verify: for one report of each type, confirm the report id, report number, and report type agree across the stored row, the document body, the preview response, and the download filename — 4 of 4 (SC-004)

---

## Phase 9: User Story 6 — A new environment can be provisioned from version control (P3)

**Goal**: the report schema and its storage location come from tracked definitions, not from one machine.

**Independent test**: from a clean checkout and an empty database, apply the tracked definitions and confirm
reports can be produced end to end with no manual console steps.

- [ ] T073 [US6] Force-add the five report-relevant definitions swallowed by the bare `supabase/` ignore rule: `git add -f supabase/migrations/003_medical_analyses_cnn_fields.sql supabase/migrations/004_medical_analyses_nullable_results.sql supabase/migrations/005_generated_reports.sql supabase/migrations/006_generated_reports_report_type_check.sql supabase/migrations/007_generated_reports_report_number_format.sql`
  - `002_storage_policies_for_images.sql` is deliberately excluded — its policies target `analysis_images`, a bucket no code references
  - verify: `git ls-files supabase/migrations/ | grep -cE '00[34567]_'` returns 5 (E1, FR-048, FR-050)
- [ ] T074 [US6] Force-add the new migration: `git add -f supabase/migrations/014_generated_reports_status_provenance.sql`
  - verify: `git ls-files supabase/migrations/014_generated_reports_status_provenance.sql` is non-empty
- [ ] T075 [US6] Provisioning rehearsal from a clean clone into an empty database: `supabase db push`, then confirm the report path works end to end with zero manual console steps
  - verify: `select generate_report_number() ~ '^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$';` returns `true` (the fresh-clone gate); `\d generated_reports` shows the three provenance columns and the status CHECK
- [ ] T076 [US6] Idempotency: apply the full migration set a second time against the already-provisioned database
  - verify: exit code 0, no error, and `select count(*) from generated_reports` unchanged before and after (FR-051, SC-009)
- [ ] T077 [US6] Historical-row compatibility: take a report row created before `014` (or insert one with NULL provenance and a status outside the vocabulary) and confirm it lists, opens via preview, and downloads using its stored values — provenance renders as "unavailable", never as complete, and an out-of-vocabulary status displays verbatim and is treated as terminal. Nothing is rewritten, backfilled, or regenerated
  - verify: the row's `sections_generated`, `generator`, `report_number`, and `generation_status` are byte-identical before and after the whole feature (Assumption 2, spec edge case 12)
- [ ] T078 [US6] **Closes D-4.** Query the live table: `select generation_status, count(*) from generated_reports group by 1;` and `select count(*) from generated_reports where sections_generated is null;`. Record both in `spec.md` § "Unresolved". **Only then** run `alter table generated_reports validate constraint <name>;`
  - the CHECK ships `NOT VALID` in T022 precisely because this count is unknown. Validating before counting risks failing against historical rows
  - verify: both counts recorded in `spec.md`; `alter table … validate constraint` returns without error, or the failing rows are listed and left unmigrated
- [ ] T079 [US6] **Closes D-2 and D-3.** Diff the live schema and the deployed row-level policies against the five definitions force-added in T073, and record any drift in `spec.md` before acceptance
  - verify: drift table recorded, or "no drift" stated explicitly with the date
- [ ] T080 [US6] **D-1 — BLOCKED, do not guess.** List the live `report_storage` bucket and its policies, record the result in `spec.md`, then encode it as version-controlled configuration. Creating the bucket with an invented policy would either weaken access or break the live path
  - if unresolved at release: record FR-049 and SC-008 as **not accepted** in the release notes rather than claiming them (E4)
  - verify: the live bucket name and its policy JSON are recorded in `spec.md` § "Unresolved", or FR-049/SC-008 are written into the release notes as not accepted
- [ ] T081 [US6] **D-6 — BLOCKED.** Read `proxy_read_timeout` on the live nginx / Railway edge. If it is below 180 s, long generations are already being truncated and stranded at `generating` today, unseen because `useState` hid them on refresh — T054 makes that visible on day one
  - blocks acceptance of T044; record the value or record the acceptance gap
  - verify: the measured `proxy_read_timeout` value is recorded in `spec.md` § "Unresolved", or T044's acceptance is written into the release notes as not accepted
- [ ] T082 **Checkpoint (US6)** — provisioning is reproducible, or the gap is named
  - verify: T075 and T076 pass; D-1 and D-6 are either closed with recorded values or explicitly listed as unclaimed

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T083 [P] In `backend/app/api/reports.py`, rewrite `/reports/health` to report on the dependencies reports actually use: `NVIDIA_API_KEY` presence, and all four Supabase variable spellings that `get_supabase()` accepts. Drop `groq_configured`, which the narrative generator never reads
  - today it can report `healthy` with no narrative credential configured and `supabase_configured: false` on a working setup (C4, FR-046, FR-047). Also closes **D-5** — the reported generator identity is the answer
  - verify: `curl -s localhost:8000/api/v1/reports/health | jq` reports unhealthy when `NVIDIA_API_KEY` is unset, and healthy on a working setup
- [ ] T084 [P] Create `tests/smoke_report_e2e.sh` implementing the three checks from `quickstart.md` § "End-to-end smoke test" — `pdfinfo | grep -qi weasyprint`, `pdftotext | grep -q "$REPORT_NUMBER"`, and the prohibited-measure scan. Document its prerequisites in a header comment and state explicitly that it requires a live environment (FR-061, FR-062)
  - verify: `bash -n tests/smoke_report_e2e.sh` parses; running it against a live environment prints `PASS`
- [ ] T085 Update `.specify/specs/001-report-generation-integrity/quickstart.md` if any command or expected output changed during implementation. Do not restructure the document
  - verify: every command block in `quickstart.md` runs as written against the implemented system
- [ ] T086 Scope-guard audit: `git status --porcelain` diffed against `/tmp/midas-worktree-baseline.txt`
  - verify: every path in the baseline that this feature does not own is byte-identical to its pre-work state; every newly changed path traces to a task above. No unrelated cleanup shipped

---

## Phase 11: Release gate

**All seven gates must pass. A gate that is skipped is reported as skipped, with the reason — never as
passed.** A green CI check is not evidence: `.github/workflows/ci.yml` executes no report path.

- [ ] T087 **Backend deterministic tests** — `cd backend && source venv/bin/activate && python -m pytest -q`
  - verify: all tests pass, and the run completes with **no network access and no live credentials** (FR-060, SC-011). Re-run with the network disabled to prove it
- [ ] T088 **Frontend typecheck, lint, build, unit** — `cd frontend && npx tsc --noEmit && npm run lint && npm run build && npm run test`
  - all four are required and separate: `npm run build` does **not** run eslint (`ignoreDuringBuilds: true`), and `tsc` cannot reach the fail-closed branches `npm run test` covers
  - verify: all four commands exit 0. Report any that were skipped, with the reason — never as passed
- [ ] T089 **Authorization cases** — run the two-account block in `quickstart.md` § "Manual verification": as user B, POST `/api/reports/generate` with user A's `analysis_id`, and GET both `/api/reports/[id]/preview` and `/api/reports/[id]/download` with user A's report id
  - verify: 403 on all three, identical refusals disclosing nothing, no report row created, and A's reports absent from B's list (FR-001 – FR-007, SC-007)
  - covers the six thin route guards that `test-plan.md` names as not automatable — report them as manually verified
- [ ] T090 **PDF content inspection** — generate one report of each of the four types and run `pdftotext` on each
  - verify: no prohibited term matches `-Eiq 'accuracy|auc|auroc|precision|recall|f1|specificity|sensitivity|\bPPV\b|\bNPV\b'`; the report number appears verbatim; a degraded report names its absent sections; a no-overlay report discloses the omission (SC-006, SC-012)
- [ ] T091 **Database and storage verification** — run the confirmation query in `quickstart.md` § "Confirming what was written", then generate the same analysis and type twice
  - verify: two rows, two distinct report numbers, two distinct storage paths under `{userId}/reports/{report_id}_{report_type}.pdf`, and the first document byte-identical before and after the second generation (FR-025, SC-006b)
- [ ] T092 **One genuine browser flow** — in a real browser: generate → hard refresh → preview → download
  - verify: the report survives the refresh with its number and status; preview opens without regenerating (and still opens on a report generated over an hour ago, proving the re-sign); the downloaded filename is `{report_number}.pdf` and matches the number printed inside the PDF and shown in the list (SC-003, SC-004)
- [ ] T093 **Genuine-renderer smoke** — `bash tests/smoke_report_e2e.sh` against a live environment
  - verify: prints `PASS`. `pdfinfo | grep -qi weasyprint` proves the renderer ran; the report-number check proves the correct data reached it. Both are needed — a real render of the wrong analysis passes the first alone (FR-061, research R9)
- [ ] T094 **Record what is not claimed** — write the unclaimed acceptance items into the release notes: SC-008 (blocked on D-1), T044's acceptance (blocked on D-6), and any of D-2 through D-5 still open
  - the spec is explicit that no runtime behaviour was observed at authoring time. Anything unverified is stated as unverified

  - verify: the release notes name each unclaimed item with its blocking fact and owner
---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)** — no dependencies
- **Phase 2 (Characterization)** — needs Phase 1. **Blocks every production edit except T028**
- **Phase 3 (Foundational)** — needs Phase 2 red baseline. **Blocks Phases 4–9**
- **Phase 4 (US1)** → **Phase 5 (US2)** → **Phase 6 (US3)** → **Phase 7 (US4)** → **Phase 8 (US5)** → **Phase 9 (US6)** — spec priority order
- **Phase 10 (Polish)** — needs the stories being shipped
- **Phase 11 (Release gate)** — needs everything

### Sequencing overrides

- **T028 (delete the unscoped browser query) is the first edit to an existing production file**, ahead of higher-priority stories. It removes an unscoped anon-key read of `generated_reports` and client-minted signed URLs on `report_storage`. It needs T026 and T027 to exist first so the replacement path is available.
- **T022 (`014` provenance columns) precedes T043**, which writes to them.
- **T018 → T019 → T020** is a strict chain: one contract decision, three files.

### Cross-story dependencies

- US2's T043 needs the `014` columns from Phase 3
- US4's T054 needs `hydrateReports` (T020) and `reports.server.ts` (T026)
- US4's T060 needs `status-presentation.ts` (T021)
- US5's T071 needs `makeReportNumber` (T019)
- US1, US3, US5, US6 are otherwise independently testable

### Parallel opportunities

Marked `[P]` only where the task edits a file no other open task edits **and** depends on no contract
decision another open task owns.

- **Phase 1**: T003, T004, T005
- **Phase 2**: T006–T016 — eleven independent test files, the widest parallel window in the plan
- **Phase 3**: T021 with T022–T025; T030 with T031
- **Phase 10**: T083, T084

**Explicitly not parallel**, despite touching different files: T018/T019/T020 (one contract decision);
T067/T068 (T068 edits the file T067 edits). **Explicitly not parallel, same file**: T033–T036 and T039/T040
and T047/T048 (all `backend/app/api/reports.py`); T042–T045 and T049 and T071 (all
`generate/route.ts`); T054–T062 (all `reports-console.tsx`); T022/T023/T024 (all `014`).

---

## Parallel Example: Phase 2

```bash
# Eleven characterization test files, no shared state, all must go red:
Task: "Narrative degradation in backend/tests/test_report_degradation.py"
Task: "Report-type coercion in backend/tests/test_report_type_validation.py"
Task: "Ownership and credential in backend/tests/test_report_ownership.py"
Task: "Confidence units in backend/tests/test_confidence_units.py"
Task: "Rendered-document content in backend/tests/test_pdf_content.py"
Task: "Golden path in backend/tests/test_report_golden_path.py"
Task: "Prompt provenance in backend/tests/test_prompt_provenance.py"
Task: "Response envelope and headers in backend/tests/test_report_headers.py"
Task: "Contract parity in backend/tests/test_report_contract.py"
Task: "Orchestration purity in frontend/src/lib/reports/orchestration.test.ts"
Task: "Report-number generation in frontend/src/lib/reports/contract.test.ts"
```

---

## Implementation Strategy

### MVP scope

Phases 1–5 — Setup, characterization, foundations, US1, US2. That delivers the integrity core: a report is
produced for its owner, and a failure is never presented as a finished report. US2 is where the medical
honesty lives, so the MVP is US1 **plus** US2, not US1 alone.

### Incremental delivery

1. Phases 1–3 → contract, schema, and the unscoped read path closed → **shippable on its own** (T028 is a net security improvement independent of everything after it)
2. + Phase 4 (US1) → golden path pinned
3. + Phase 5 (US2) → **MVP**: no hollow report can be marked complete
4. + Phase 6 (US3) → refusals distinct and accurate
5. + Phase 7 (US4) → durability visible to the person
6. + Phase 8 (US5) → every figure traces to stored data
7. + Phase 9 (US6) → reproducible from version control
8. + Phases 10–11 → polish and the release gate

### Rollback

- **Migration `014`**: drop the CHECK constraint; **keep** the three nullable columns (T024). Dropping them destroys provenance for post-migration rows
- **Force-added migrations (T073, T074)**: `git rm --cached` restores the ignored state without deleting the files on disk
- **T028**: reverting reinstates an unscoped anon-key read. Fix forward instead
- **Historical rows**: nothing in this feature rewrites one, so there is nothing to roll back at the data layer (Assumption 2)

---

## Notes

- Total: **94 tasks**. Per phase: 5 setup (T001–T005), 12 characterization (T006–T017), 15 foundational (T018–T032), 5 US1 (T033–T037), 9 US2 (T038–T046), 6 US3 (T047–T052), 14 US4 (T053–T066), 6 US5 (T067–T072), 10 US6 (T073–T082), 4 polish (T083–T086), 8 release gate (T087–T094)
- By story label, counting the Phase 2 characterization tests that carry one: US1 5 · US2 11 · US3 7 · US4 13 · US5 9 · US6 9. 19 tasks are `[P]`; 8 are checkpoints
- Line numbers were verified against the working tree at generation time. `plan.md` cites `main_agent.py:227` for the router mount; it is now `:235` after a concurrent edit — T005 re-confirms before Phase 4
- Commit after each task or logical group. Stop at any checkpoint to validate a story independently
- Never claim a gate passed without the command output. `.github/workflows/ci.yml` echoes `"CI passed"` and executes nothing
