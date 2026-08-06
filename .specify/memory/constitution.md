<!--
SYNC IMPACT REPORT
Version change: (unfilled template) → 1.0.0
Bump rationale: MAJOR — first ratified constitution; establishes six binding principles where
none previously existed.

Principles added (none removed, none renamed — the prior file was an unfilled template):
  I.   Live-Path Evidence
  II.  Medical Honesty (NON-NEGOTIABLE)
  III. Authorization at Service-Role Boundaries (NON-NEGOTIABLE)
  IV.  Contract Consistency
  V.   Surgical Brownfield Change
  VI.  Verification Before Completion

Sections added: Security & Data Handling; Development Workflow & Quality Gates; Governance.

Templates:
  ✅ .specify/templates/plan-template.md   — Constitution Check gate populated
  ✅ .specify/templates/tasks-template.md  — "tests OPTIONAL" qualified by Principle VI
  ✅ .specify/templates/spec-template.md   — reviewed, no change required
  ✅ .specify/templates/checklist-template.md — reviewed, no change required

Deferred TODOs: none. No placeholder tokens remain.
-->

# MIDAS Constitution

MIDAS is a dermoscopy analysis platform: a multi-agent RAG assistant and a CNN image-analysis
pipeline that produce screening output about a user's own skin. Two facts shape every rule below.
Output reaches a person making a health decision, and the codebase is a brownfield in which a
large share of modules are unreachable from the running entry points.

This constitution is technology-aware and feature-independent. It governs all work in this
repository.

## Core Principles

### I. Live-Path Evidence

Reachability MUST be proven before a module is edited, not assumed from its name or location.

- Every changed backend module MUST be shown reachable by import trace from `app.main_agent:app`,
  the entry point `start-services.sh` and the Docker images actually launch. Roughly half of
  `backend/app/` is a dead alternative pipeline that nothing starts.
- Every changed frontend module MUST be shown reachable from a route under `frontend/src/app/`.
  Where a canonical file and a shadow copy both exist (`<name> 2.tsx`, `page-new.tsx`,
  `page_old.tsx`, `route-edge-function.ts`, `components/hooks/` vs `hooks/`), the canonical
  unsuffixed file is the only valid target.
- When sources disagree, precedence is: **running code > `supabase/migrations/` > `CLAUDE.md` >
  every other document**. The ~65 markdown files under `docs/` are untracked historical working
  notes and MUST NOT be cited as specification.
- Editing an unreachable module and reporting it as a fix is a violation, even when the edit is
  correct in isolation. `app/api/sessions.py` is the canonical trap: it looks like the chat API
  and changes nothing at runtime.

**Rationale:** in a repository this size, a plausible-looking edit to dead code produces a
confident report of a fix that was never deployed.

### II. Medical Honesty (NON-NEGOTIABLE)

No clinical claim may exceed what the pipeline actually measured.

- Clinical evidence, per-analysis metrics, lesion morphology, and certainty levels MUST NOT be
  invented, interpolated, or restated more confidently than the underlying value supports. Report
  prompts MUST derive strictly from data supplied for that analysis.
- Fields holding pipeline-generated placeholders rather than measurements MUST NOT be read into
  clinical narrative. `report_generator.py` deliberately excludes `detected_features` for exactly
  this reason; that exclusion MUST NOT be reversed without evidence the column holds real
  measurements.
- Missing data MUST be stated as missing. When the class-probability distribution is absent, the
  report says the differential is unavailable rather than producing one.
- Degraded and fallback paths MUST be labelled in the payload, never presented as a live result.
  The `mode: "demo_fallback"` marker returned when the Python backend is unreachable is required
  behavior, not a defect.
- Every user-facing analysis MUST retain its screening-tool framing and its instruction to consult
  a clinician. Removing that framing is a violation regardless of model confidence.
- Successful execution MUST NOT be claimed for work that was not run. A command not executed is
  reported as not executed.

**Rationale:** a fabricated measurement or an unmarked fallback is indistinguishable from a real
finding to the person reading it, and that person may act on it.

### III. Authorization at Service-Role Boundaries (NON-NEGOTIABLE)

Every query against user-owned data MUST be scoped by the authenticated Clerk identity.

- Next.js route handlers use a service-role Supabase client, which **bypasses row-level security**.
  RLS is therefore not a backstop on these paths; the query filter is the only control.
- Every read, update, and delete of `conversations`, `conversation_messages`, `documents`,
  `medical_analyses`, `generated_reports`, and any future user-owned table MUST derive its
  identity from `auth()` server-side and constrain the query with that identity — typically
  `.eq("user_id", userId)`. A client-supplied identifier MUST NOT be trusted as the scope.
- A handler that cannot resolve an authenticated identity MUST reject the request. It MUST NOT
  fall through to an unscoped query.
- Role checks rendered in the UI are display gating only. Every role-restricted route MUST
  re-verify server-side with `auth()` and `clerkClient`. Role resolution flows from
  `app/dashboard/layout.tsx` through `contexts/role-context.tsx`; a client-side role fetch MUST NOT
  be reintroduced.
- Storage objects and Supabase edge functions handling user data are bound by the same rule.

**Rationale:** one unscoped service-role query exposes every user's medical images and reports at
once. There is no second layer to catch it.

### IV. Contract Consistency

Shared meaning MUST agree across every layer that carries it.

- Identifiers, enum values, units, status strings, and error semantics MUST be identical across
  the frontend, the FastAPI backend, the Postgres schema, Storage, edge functions, and generated
  PDFs and reports.
- `supabase/migrations/` is the schema ground truth. Code MUST conform to migrations; where they
  conflict, the migration wins and the code is the defect.
- Confidence and probability values MUST carry one consistent unit across the boundary they cross.
  A fraction MUST NOT be rendered where a percentage is expected, or the reverse.
- Changing a shared contract MUST update every consumer in the same change. A backend field
  rename with no corresponding frontend update is incomplete work, not a follow-up.
- Because `.gitignore` contains a bare `supabase/` rule, new migrations and most edge-function
  code are silently untracked. Any change to a shared contract that touches `supabase/` MUST be
  committed with `git add -f` and its tracked state confirmed, or the contract change ships
  half-applied.

**Rationale:** contract drift in this stack surfaces as a plausible wrong number in a medical
report, not as a crash.

### V. Surgical Brownfield Change

The smallest change that fully addresses the accepted requirement is the correct change.

- Every changed line MUST map to an accepted requirement. Unrelated refactors, reformatting,
  renames, and drive-by "improvements" MUST be excluded from the change.
- User-owned work MUST be preserved. Files MUST NOT be deleted, reverted, or overwritten because
  they appear redundant, stale, or duplicated. Removal of existing content requires an explicit
  request.
- Fixes MUST address root cause. When several callers route through one function, the guard
  belongs in the shared function rather than in the one call site a report happens to name.
- New abstractions MUST NOT be introduced where an existing helper, pattern, or standard-library
  facility already covers the need.
- Committed junk (`backend/venv/`, `backend/midas/`, `Midas_enmv/`, root `node_modules/`, `*.log`)
  MUST be left alone unless its removal is the requested task.

**Rationale:** in a repository carrying duplicate shadow files and a large dead subtree, a broad
diff makes it impossible to tell which line caused a regression.

### VI. Verification Before Completion

Completion is claimed only from commands that actually ran and actually passed.

- Every reproduced defect MUST gain the smallest deterministic regression test that fails before
  the fix and passes after it. "Smallest" means one assertion-level check, not a new framework or
  fixture layer.
- The repository's real local gates MUST be run for the layers touched:
  - Frontend: `cd frontend && npx tsc --noEmit`, `npm run lint`, `npm run build`. There is no
    `typecheck` script; `npm run build` does not run ESLint, because `next.config.ts` sets
    `eslint.ignoreDuringBuilds: true`. Type checking and linting are therefore separate commands
    and both are required.
  - Backend: no pytest suite is configured. Tests are standalone scripts, nearly all requiring a
    running backend on `localhost:8000` and live Supabase credentials. The only fully offline test
    runs as `PYTHONPATH=backend python tests/test_bplus_indexing.py` from the repository root.
  - Service health: `./verify-services.sh`.
- Gate results MUST be reported with three states distinguished: failures newly caused by the
  change, pre-existing failures, and gates skipped with the exact reason.
- **A green CI check is not evidence.** `.github/workflows/ci.yml` builds the backend and frontend
  Docker images and Trivy-scans the backend. Because the frontend Dockerfile runs `npm run build`
  and `next.config.ts` does not set `typescript.ignoreBuildErrors`, a green run proves only that
  TypeScript compiles. It runs no lint, and no workflow executes any test in `tests/` or
  `backend/test_*.py`. The Trivy job is pinned to `exit-code: '0'` (report-only) and is skipped
  entirely on pull requests. CI therefore MUST NOT be cited as verification of any requirement;
  all verification is local.
- Verification MUST NOT be claimed for a command that was not executed.

**Rationale:** unverified completion claims are the failure mode this repository is most exposed
to, because the one remote signal it produces is far weaker than it appears.

## Security & Data Handling

**Secrets.** The root `.env*` files hold live credentials. Their values MUST NEVER be read into
output, echoed to a terminal, written into a log, pasted into a report, or committed. Secrets MUST
NOT appear in source, tests, fixtures, or documentation; they are referenced only by environment
variable name. When a task needs to know whether a variable is set, presence is confirmed without
revealing the value. `.gitignore` covers `.env*`, and that coverage MUST NOT be narrowed.

**Boundaries.** Authentication is Clerk, enforced in `frontend/src/middleware.ts`. Supabase Auth is
not used. `BACKEND_URL` and `SUPABASE_SERVICE_ROLE_KEY` are server-only and MUST NOT reach the
client bundle. The browser MUST reach FastAPI only through the Next.js BFF route handlers.

**Patient data.** Images in the user-upload storage bucket and rows in `medical_analyses` are
user-submitted health data. They MUST NOT be uploaded to third-party services, training pipelines,
or annotation tools. This specifically forbids sending them to Roboflow, whose terms prohibit PHI
without an enterprise BAA; only public research data (HAM10000 / ISIC) is eligible. Patient data
MUST NOT be reproduced in logs, issues, or commit messages.

## Development Workflow & Quality Gates

1. **Trace before editing.** Confirm reachability from the live entry points (Principle I) and
   identify the canonical file among any shadow copies.
2. **Establish a baseline.** Record which gates already fail before the change, so pre-existing
   failures are never reported as new and never attributed to the change.
3. **Change surgically.** Smallest diff that satisfies the requirement (Principle V).
4. **Cover the defect.** Smallest deterministic regression test (Principle VI).
5. **Run the real gates** for the layers touched, and report the three states.
6. **Report.** Every code change is summarized as: root cause, files changed, fix applied,
   verification performed (with the commands run), remaining risks.

Branch and commit discipline: work does not land directly on `main`. Commits and pushes happen only
when requested.

## Governance

This constitution supersedes ad-hoc practice and prior working notes. Where a document under
`docs/` conflicts with it, this constitution governs; where running code or a migration conflicts
with a description here, the code or migration is the fact and this document is amended.

**Amendment process.** An amendment MUST (1) state the principle added, changed, or removed and
the repository evidence motivating it; (2) update this file with a new version and amendment date;
(3) update the Sync Impact Report comment at the top of this file; (4) propagate to
`.specify/templates/plan-template.md`, `.specify/templates/spec-template.md`,
`.specify/templates/tasks-template.md`, and `.specify/templates/checklist-template.md` in the same
change; and (5) be approved by the repository owner. An unpropagated amendment is not in effect.

**Versioning.** Semantic versioning applies to this document.
MAJOR — a principle is removed or redefined in a backward-incompatible way.
MINOR — a principle or section is added, or guidance is materially expanded.
PATCH — clarification or wording with no change in obligation.

**Compliance.** The Constitution Check gate in `plan-template.md` MUST be evaluated before Phase 0
research and re-evaluated after Phase 1 design. A justified violation is recorded in the plan's
Complexity Tracking table with the simpler alternative that was rejected and why. An unjustified
violation blocks the change. Principles II and III are non-negotiable and admit no Complexity
Tracking exception.

**Version**: 1.0.0 | **Ratified**: 2026-08-06 | **Last Amended**: 2026-08-06
