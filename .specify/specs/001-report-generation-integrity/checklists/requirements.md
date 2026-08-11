# Specification Quality Checklist: Report Generation Integrity Completion

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Constitution Alignment (v1.0.0)

Not part of the standard template. Added because this repository ratified a constitution whose
principles bear directly on this feature.

- [x] **II. Medical Honesty** — FR-029 to FR-034 and FR-053 to FR-057 forbid fabricated metrics,
      morphology, and certainty; FR-016 to FR-018 require degraded results to be explicit
- [x] **III. Service-Role Authorization** — FR-001 to FR-007 scope every operation by authenticated
      identity; Assumption 7 records why application-code enforcement is the primary control
- [x] **IV. Contract Consistency** — FR-021 to FR-024 (identity), FR-026 to FR-028 (confidence unit),
      FR-041 to FR-047 (status and configuration), FR-050 (tracked provisioning)
- [x] **V. Surgical Brownfield Change** — 24 requirements marked `[already satisfied — protect]`;
      Out of Scope excludes rewrites and unrelated redesign; Assumption 3 preserves historical rows
- [x] **VI. Verification Before Completion** — FR-058 to FR-062 require offline regression coverage
      per corrected defect plus exactly one live smoke test

## Validation Notes

**Iteration 1 findings and resolutions:**

1. *Technology leakage* — first draft named specific services and libraries in several requirements.
   Rewritten in capability language ("report production service", "document storage", "narrative
   generator"). PDF is retained because the brief names it as the user-facing artifact format, not
   as an implementation choice.
2. *Untestable phrasing* — "reports should be reliable" replaced with the per-outcome assertions in
   FR-013 to FR-020.
3. *Success criteria leakage* — an earlier SC referenced response status codes. Replaced with
   user-observable outcomes (SC-001, SC-002).
4. *Ambiguity between failed and degraded* — resolved by Assumption 2 and split across FR-016 and
   edge cases 3 and 4, so each is independently testable.

**Zero [NEEDS CLARIFICATION] markers.** The brief specified scope, non-goals, and edge cases in
enough detail that every open question had a defensible default. All seven defaults are recorded in
Assumptions and can be overridden without restructuring the spec.

**Five live-environment facts are recorded as unverified**, per the brief's instruction. They are
listed under *Live-environment facts requiring validation* with the specific requirements each one
blocks. These are not spec defects — they are honest gaps that require an environment this session
did not have.

## Clarification Session — 2026-08-06

Five questions asked and answered; all integrated into the spec body, not only recorded as bullets.

| # | Decision | Spec impact |
|---|---|---|
| 1 | Unparseable narrative → `degraded` + provenance, disclosed in document and interface | FR-016, FR-016a, FR-017, FR-018; US2 scenarios 4–5; edge cases 3–4 |
| 2 | Dataset-level model figures omitted from every report type | FR-030, FR-030a; US5 scenario 3; SC-006; new Model Card entity |
| 3 | Status set fixed at five values with explicit transitions; `processing` removed | FR-041, FR-041a, FR-042, FR-043; Report Status entity; US6 scenario 5 |
| 4 | Duplicate generation → new immutable report every time | FR-025; edge case 9; SC-006b |
| 5 | All four report types exposed at every entry point via one shared picker | FR-010, FR-011a; edge case 10; Report Type entity |

Four further items were **resolved from repository evidence without asking**, since the code and the
tracked model card answered them: missing-overlay is non-fatal (now also disclosed, FR-040a); the
report-type set is closed at four; per-analysis measures are exactly four quantities; and five
provisioning definitions require version control.

Three superseded statements were **replaced rather than duplicated**: Assumption 4 previously
permitted labelled dataset-level metrics and now forbids them; Assumption 1 became a confirmed
decision; FR-030's "omit or label" alternative was removed.

### Evidence that changed a decision

`backend/models/midas_v1_final_best.metrics.json` is tracked and was not referenced by the vault
docs. It records accuracy 0.796, balanced accuracy 0.792, AUROC 0.962 — and declares two **critical**
caveats: the figures were measured with real patient metadata while production inference supplies a
zero vector, so they "do not describe the deployed system"; and the validation split was also the
model-selection split, making them optimistically biased. It further lists per-class
precision/recall/F1 under `notMeasured`. This evidence drove decision 2 and is why FR-030a permits
omission only, with no labelled alternative.

## Deployment facts left open

Five facts (D-1 … D-5) are recorded in the spec as OPEN with a named owner and a validation step
each. They are deployment state, not design decisions, and were deliberately excluded from the
question quota. Planning must not assume any of them resolved.

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- All checklist items pass as of 2026-08-06, after the clarification session
- Spec now carries 67 functional requirements and 14 success criteria
