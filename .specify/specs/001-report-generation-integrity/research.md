# Phase 0 — Research

**Feature**: Report Generation Integrity Completion | **Date**: 2026-08-06

All findings were established by reading the repository at HEAD `c5669ad`. Nothing here was
observed at runtime; the capability has no automated coverage today.

---

## R1 — Where does orchestration ownership live?

**Decision**: `frontend/src/app/api/reports/generate/route.ts` remains the sole orchestrator. The
backend endpoint stays a pure renderer that returns PDF bytes and writes nothing.

**Rationale**: This split already exists and is clean. The route owns Clerk identity, the
`generated_reports` lifecycle, storage upload, and signed URLs; the backend owns narrative and
rendering. The backend writing nothing is what makes it safely callable from a test harness. Adding
a second writer would create exactly the competing pipeline the brief forbids.

**Alternatives considered**: Moving persistence into the backend (rejected — the backend has no
Clerk identity and would need its own ownership model, duplicating FR-001..004). Reviving the edge
function (rejected — orphaned, and explicitly out of scope).

---

## R2 — Is there existing code that already solves a planned requirement?

**Decision**: Yes, in one place. `reports.py` defines `_build_report_context()` and
`_load_heatmap_data_uri()`, both correct and both **never called**. Wire them into the live endpoint
rather than writing equivalent logic.

**Rationale**: `_build_report_context(request, supabase, scope_user=True)` supplies the missing
ownership filter (FR-005) and `_load_heatmap_data_uri` inlines the overlay as a data URI before
render — removing an untimeoutable HTTPS round trip from inside `write_pdf()`, which the helper's
own docstring says was the point. The live endpoint still duplicates both with a signed-URL variant
at `reports.py:177-214`. Substituting the call deletes more lines than it adds.

**Alternatives considered**: Leaving the helpers dead and patching the inline block (rejected —
keeps two code paths and leaves the network call inside the renderer). Deleting the helpers
(rejected — they are the better implementation).

**Caveat worth noting**: the `_build_report_context` docstring says the non-scoped variant exists
because the edge function derives its caller from a Supabase auth JWT. That caller is orphaned and
out of scope, so `scope_user=True` is unconditionally correct for the live path.

---

## R3 — What does the analysis pipeline actually measure?

**Decision**: Exactly four quantities, from `backend/app/api/image_analysis.py:95-103` —
`confidence`, `top2_gap`, `entropy`, and `class_probabilities`. These are the only values a report
may present as per-analysis measures.

**Rationale**: The clinician template historically rendered eight further measures (precision,
recall, F1, AUC-ROC, specificity, sensitivity, PPV, NPV) from `classification_metrics`. Those keys
have never been written by any producer. They are not "missing data" — they were never computed.

**Alternatives considered**: Computing them at report time (rejected — impossible from a single
inference; they are dataset-level quantities requiring labelled ground truth).

---

## R4 — Does a dataset-level metrics source exist, and may it be used?

**Decision**: A source exists and **must not** be rendered in any report.

**Rationale**: `backend/models/midas_v1_final_best.metrics.json` is tracked and records validation
accuracy 0.796, balanced accuracy 0.792, AUROC 0.962. It declares two `critical` caveats about
itself: the figures were measured with the real patient-metadata vector present while production
inference supplies `torch.zeros(1, 16)`, so they "do not describe the deployed system, whose accuracy
is unknown and expected to be lower"; and the validation split was also the model-selection split,
making the figures optimistically biased. It further lists per-class precision/recall/F1 under
`notMeasured`, and lists notebook figures under `excludedSources` with an explicit instruction not
to cite them for this model.

Printing a 96% AUROC beside a person's own result invites reading it as that result's reliability,
which the card itself says would be wrong. Resolved as clarification Q2: omit entirely.

**Alternatives considered**: Clinician-only with caveats (rejected by the decision-maker). All types
with caveats (rejected — highest misreading risk). A separate model-information page (rejected —
out of the scoped surface, though it remains a defensible future feature).

---

## R5 — What is the real status vocabulary, and who disagrees about it?

**Decision**: Five values — `pending`, `generating`, `completed`, `degraded`, `failed` — enforced by
a storage-layer `CHECK`.

**Rationale**: Evidence of drift: the column defaults to `pending`; `generate/route.ts:99` writes
`generating`; `:189` writes `completed`; `:30` and `:173` write `failed`; and
`services/dashboard.server.ts:14` counts in-flight work as `["pending", "processing"]`. Nothing has
ever written `processing`, and nothing counts `generating`, so in-flight reports are invisible on
the overview. No `CHECK` constraint exists, which is why the drift went unnoticed.

**Alternatives considered**: Renaming the writer to `processing` so the consumer becomes correct
(rejected — requires rewriting historical rows, which Assumption 2 forbids). Dropping `pending`
(rejected — it is the column default and a future non-immediate writer would be mislabelled).

---

## R6 — How should an unparseable narrative be handled?

**Decision**: Produce a `degraded` report carrying the usable prose plus provenance naming the
absent sections; disclose in both the document and the interface.

**Rationale**: `report_generator.py:265-274` already tolerates fenced and embedded JSON before
falling back to `{"summary": raw}` with a `logger.warning`. The parsing tolerance is good and stays.
What is missing is the signal: the row is still stored `completed`, so a report with one of four
sections is indistinguishable from a complete one. Adding provenance is a smaller change than
either discarding real model output or failing the request.

**Alternatives considered**: Fail outright (rejected — discards a genuine narrative). Retry with a
stricter prompt (rejected — adds a second billed call and latency on every malformed response, and
the decision-maker chose degrade).

---

## R7 — Why is the browser querying `generated_reports` directly?

**Decision**: Remove it. Replace with owner-scoped server routes.

**Rationale**: `comps/dashboard/history/history-console.tsx:119-125` and `:182-188` run
`supabase.from('generated_reports').select(...).eq('analysis_id', …).eq('report_type', …)` through
the **anon-key browser client** with **no user filter at all**, then call
`storage.from('report_storage').createSignedUrl(...)` client-side. The file contains no reference to
`user_id`, `userId`, or `auth()`.

This fails closed today only by accident: the RLS policies in `005_generated_reports.sql:37-56`
compare `auth.uid()::text` against `user_id`, and `auth.uid()` is a Supabase-Auth UUID while
`user_id` holds a Clerk id such as `user_2abc…`. They can never be equal, so the browser query
returns nothing — which is also why the "reuse an existing report" branch never fires and history
regenerates every time.

The danger is that the policies look broken to anyone inspecting them. Disabling RLS or relaxing it
to `true` — a plausible "fix" — would immediately expose every user's report rows and let any signed-in
person mint a signed URL for another person's PDF. The safe repair is to remove the client query
first, then correct the policies to deny anon access outright.

**Alternatives considered**: Correcting RLS to match Clerk ids (rejected — Postgres has no access to
the Clerk identity without a custom JWT template, expanding scope well past this feature). Keeping
the browser query and adding `.eq('user_id', …)` from the client (rejected — a client-supplied
identifier is not proof of identity, FR-006).

---

## R8 — Which provisioning definitions need version control?

**Decision**: Five, force-added: `003_medical_analyses_cnn_fields`,
`004_medical_analyses_nullable_results`, `005_generated_reports`,
`006_generated_reports_report_type_check`, `007_generated_reports_report_number_format`.

**Rationale**: `git ls-files supabase/migrations/` returns 001, 002_add_missing_columns, 009–013 and
the B+ tree definition — and nothing else. `git check-ignore` confirms the bare `supabase/` rule at
`.gitignore` swallows the rest, so a fresh clone has no `medical_analyses` table, no
`generated_reports` table, and no `generate_report_number()` function, with nothing in git to
recreate them. `002_storage_policies_for_images` is also untracked but is excluded here: its policies
target the `analysis_images` bucket, which no code references.

**Alternatives considered**: Un-ignoring `supabase/` wholesale (rejected — sweeps in edge-function
code and local config beyond this feature's scope). Reconstructing the schema from code (rejected —
the definitions already exist on disk and are the ground truth).

---

## R9 — How can a test tell genuine renderer output from a substitute?

**Decision**: Assert on PDF producer metadata plus report-number presence.

**Rationale**: WeasyPrint writes a `/Producer` string into the document catalog and emits a
structured object tree. A hand-assembled fallback — the historical `createDemoPdfBuffer()` was
eleven lines of raw `BT`/`Tj`/`ET` operators — carries neither. Checking producer metadata alone
proves the renderer ran; also checking that the extracted text contains the report's own report
number proves the correct data reached it. Both are needed: a real render of the wrong analysis
would pass the first check alone.

**Alternatives considered**: Byte-size heuristics (rejected — brittle). Checking for absence of a
known fallback string (rejected — tests for the absence of code that has already been deleted, so it
would pass vacuously if a *different* fallback were later introduced).

---

## R10 — What test infrastructure exists to build on?

**Decision**: Add `backend/pytest.ini` and `backend/tests/`. Add no frontend test runner.

**Rationale**: `pytest>=7.4.0` is already in `requirements.txt:42`, but no `pytest.ini`,
`pyproject.toml`, or `setup.cfg` exists in `backend/`, so there is no suite to extend — the
dependency is present and unused. Existing tests are standalone scripts requiring a live backend and
live Supabase credentials, which cannot satisfy FR-060's offline requirement. On the frontend, the
`__tests__` files under `frontend/src` have no runner installed and are excluded from `tsconfig`;
introducing one is a larger change than this feature justifies, so frontend verification stays
`npx tsc --noEmit`, `npm run lint`, and `npm run build`.

**Alternatives considered**: Extending the standalone scripts (rejected — they need network and
credentials). Adding Vitest or Jest (rejected — new toolchain, out of scope; the type checker and
build already catch the contract errors this feature can introduce).

---

## Unresolved — external to the repository

These cannot be settled by reading code. Carried from spec items D-1 … D-5 with owners and
validation steps. **Only D-1 blocks a planned phase (E4).**

| ID | Question | Blocks |
|---|---|---|
| D-1 | Does `report_storage` exist live, and what policy does it carry? | Phase E4 |
| D-2 | Were the five untracked definitions ever applied live? | Phase E1 acceptance |
| D-3 | Do deployed access rules match the definitions on disk? | Phase E3 acceptance |
| D-4 | How many historical rows fall outside the status vocabulary or lack provenance? | `CHECK` validation in E2 |
| D-5 | Is the narrative credential configured live, and to which model? | FR-034, FR-046 acceptance |
