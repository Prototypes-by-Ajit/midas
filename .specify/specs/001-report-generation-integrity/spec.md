# Feature Specification: Report Generation Integrity Completion

**Feature Branch**: `001-report-generation-integrity`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "Specify completion of the existing MIDAS report-generation feature. Treat this as a brownfield reliability and integrity repair, not a rewrite."

## Overview

A person who has had a skin lesion analysed can ask MIDAS for a medical report about it. That
report is a document they may show a clinician, keep as a record, or act on. The capability already
exists and works on its happy path.

This specification defines what remains before the capability can be trusted: that a report is only
ever produced for its owner, that a failure is visible as a failure, that every number printed on
the page is one the system actually measured, that a generated report is still reachable tomorrow,
and that a new environment can be provisioned from version control rather than from memory.

Roughly half of the known integrity defects have already been repaired in the current codebase.
Those repairs are treated here as satisfied requirements to protect, not as work to redo. Each is
marked **[already satisfied — protect]** so that regression coverage is written for it rather than
a replacement implementation.

## Clarifications

### Session 2026-08-06

- Q: When the narrative generator returns prose that cannot be parsed into the expected section structure, what is the contract? → A: Degrade and disclose — persist a distinct `degraded` outcome with provenance (which sections were produced, which generator ran); the document and the interface both name the missing sections; the partial narrative is still delivered because it came from the real generator on this analysis.
- Q: May dataset-level model performance figures (accuracy, balanced accuracy, AUROC) appear in a report, given the model card's own critical caveats? → A: No — omit entirely from every report type. Reports carry only per-analysis measures. The card states its figures do not describe the deployed system, so printing them beside a personal result would invite reading them as that result's reliability.
- Q: What is the canonical report status set and its allowed transitions? → A: Five values — `pending`, `generating`, `completed`, `degraded`, `failed` — enforced by a storage-layer constraint. `pending → generating → {completed | degraded | failed}`, with `pending → failed` permitted; the three outcome states are terminal. `processing` is removed everywhere as a never-written synonym, and in-flight counts use `pending` plus `generating`.
- Q: What is the duplicate-generation contract? → A: A new immutable report every time. Each request produces its own record, report number, and stored document; earlier reports remain retrievable and unchanged permanently. No idempotent reuse and no supersession, so a report already shared with a clinician never changes underneath them.
- Q: Which report types are intentionally exposed at each entry point? → A: All four at both. One shared type picker serves the reports page and the history page, so the exposed set equals the supported set and a person's options no longer depend on which page they started from. This replaces the current split where the reports page omits `patient_report` and the history page forces it.

### Resolved from repository evidence (not asked)

- **Missing image highlight overlay is not fatal.** The loader already returns nothing and logs a warning when the object is absent from either storage location, and generation continues. Ratified as the contract, with the addition that the document must disclose the omission (FR-040a).
- **The supported report-type set is closed at four values** — `diagnostic_summary`, `detailed_analysis`, `patient_report`, `clinician_report` — established by the type-normalisation function and the storage-layer type constraint.
- **Per-analysis measures are exactly** confidence, top-2 gap, entropy, and the class-probability distribution, established by what the analysis pipeline writes. Everything else named in the clinician template was never computed.
- **The provisioning definitions requiring version control** are those creating the analysis structure, its nullable result columns, the report record structure, the report-type constraint, and the report-number format constraint — five definitions currently excluded by a repository ignore rule.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner generates a report from their own analysis (Priority: P1)

A signed-in person selects one of their completed lesion analyses, chooses a report type, and
requests a report. The system produces a document containing the analysis findings and returns it
to them, ready to view.

**Why this priority**: This is the capability itself. Without it there is nothing to make reliable.
It is also the path every other story builds on.

**Independent Test**: Sign in as a user with at least one stored analysis, request each supported
report type, and confirm a viewable document is returned that contains that analysis's findings.
Delivers the core value on its own.

**Acceptance Scenarios**:

1. **Given** a signed-in person who owns a completed analysis, **When** they request a report of a
   supported type, **Then** a document is produced, stored, and made available to them, and the
   stored record for it is marked completed.
2. **Given** a report has just been produced, **When** the person opens it, **Then** it displays the
   diagnosis, the confidence, and the recommendations belonging to that specific analysis.
3. **Given** an anonymous visitor, **When** they request report generation, **Then** the request is
   refused as unauthenticated and no record and no document are created.
4. **Given** an analysis whose stored image highlight overlay is present, **When** a report is
   produced with images enabled, **Then** the overlay appears in the document.

---

### User Story 2 - A failure is never presented as a finished report (Priority: P1)

When any step of production genuinely fails — the report service is unreachable, the narrative
cannot be generated, the document cannot be rendered, or the document cannot be stored — the person
is told the report failed. They never receive a document that looks complete but is hollow.

**Why this priority**: Equal to P1 with Story 1 and arguably more important. A silently empty
medical report is worse than no report, because the person cannot tell the difference and may act
on it. This is the integrity core of the whole repair.

**Independent Test**: Force each failure mode in turn (service down, narrative credential absent,
renderer error, storage rejection) and confirm every one yields an explicit failure or an explicitly
labelled degraded result — never a record marked completed with placeholder content.

**Acceptance Scenarios**:

1. **Given** the report service cannot be reached, **When** a person requests a report, **Then**
   they receive an explicit service-unavailable message, the stored record is marked failed with the
   reason recorded, and no document is stored. **[already satisfied — protect]**
2. **Given** the report service returns an error, **When** a person requests a report, **Then** they
   receive an explicit failure message, and the stored record is marked failed with the reason
   recorded. **[already satisfied — protect]**
3. **Given** the credential required to generate the narrative is absent, **When** a person requests
   a report, **Then** generation fails explicitly rather than producing a document containing
   generic boilerplate. **[already satisfied — protect]**
4. **Given** the narrative generator returns content that cannot be interpreted in the expected
   structure but does contain usable prose, **When** the report is produced, **Then** the record is
   marked `degraded`, the prose is still delivered, the stored provenance names which of the four
   sections were produced and which generator produced them, and both the document and the interface
   name the unavailable sections before the person opens it.
5. **Given** the narrative generator returns nothing usable, **When** the report is requested,
   **Then** the result is `failed`, not `degraded`.
6. **Given** document storage rejects the upload, **When** a person requests a report, **Then** the
   record is marked failed and the person is told storage failed. **[already satisfied — protect]**
7. **Given** any failed or degraded outcome, **When** the person views their report history,
   **Then** that outcome is visible there with its reason, not hidden.

---

### User Story 3 - Invalid, foreign, and unsupported requests are refused explicitly (Priority: P2)

Requests that name an analysis that does not exist, an analysis belonging to someone else, a report
that belongs to someone else, or a report type the system does not support are each refused with a
distinct, accurate reason. Nothing is silently substituted.

**Why this priority**: Ownership enforcement is a safety requirement, since a leak here exposes
another person's medical data. Silent substitution of an unsupported type is an honesty defect: the
person believes they asked for one document and received another.

**Independent Test**: Issue each malformed or unauthorised request in turn and confirm the refusal
reason is correct and distinct, and that no record, document, or partial state is left behind.

**Acceptance Scenarios**:

1. **Given** a signed-in person, **When** they request a report for an analysis identifier that does
   not exist, **Then** the request is refused as not-found. **[already satisfied — protect]**
2. **Given** a signed-in person, **When** they request a report for an analysis owned by someone
   else, **Then** the request is refused as forbidden and no detail about that analysis is
   disclosed. **[already satisfied — protect]**
3. **Given** a signed-in person, **When** they request an unsupported report type, **Then** the
   request is refused as an invalid type and names the supported types — it is **not** silently
   converted to a default type.
4. **Given** a signed-in person, **When** they request preview or download of a report owned by
   someone else, **Then** the request is refused as forbidden and no document bytes are returned.
   **[already satisfied — protect]**
5. **Given** a request refused for any of the above reasons, **When** the refusal occurs, **Then**
   no report record is left in a non-terminal state.
6. **Given** a caller presenting no credential or an incorrect credential to the report service
   directly, **When** they request generation, **Then** the request is refused, and the service
   additionally confirms the named analysis belongs to the named person before producing anything.

---

### User Story 4 - Report history survives a refresh and stays actionable (Priority: P2)

After producing a report, a person can close the page, return later, and still see that report in
their history — with working preview and download actions scoped to them.

**Why this priority**: Today a produced report becomes unreachable the moment the page reloads,
even though the record and the document both exist. The person's only recourse is to generate it
again. The artefact exists but the user cannot get to it, which makes the whole capability feel
unreliable.

**Independent Test**: Produce a report, fully reload the application, and confirm the report is
listed with its identifier and status, and that preview and download both work without regenerating.

**Acceptance Scenarios**:

1. **Given** a person produced a report earlier, **When** they load their report history, **Then**
   that report is listed with its report number, type, status, and creation time, read from stored
   records rather than from in-page memory.
2. **Given** a listed completed report, **When** the person chooses preview, **Then** the document
   is displayed without producing a new report.
3. **Given** a listed completed report, **When** the person chooses download, **Then** the document
   downloads under a filename derived from that report's own report number.
4. **Given** a listed report that failed, **When** the person views it, **Then** its failed status
   and reason are shown, and preview and download are not offered for it.
5. **Given** a person with no reports, **When** they load their report history, **Then** they see an
   explicit empty state, not an error.
6. **Given** a person's history list, **When** it is loaded, **Then** it contains only reports they
   own.
7. **Given** the history cannot be loaded, **When** the person views the page, **Then** they are told
   loading failed rather than being shown an empty list that implies they have no reports.

---

### User Story 5 - Every figure in the report is one the system measured (Priority: P3)

The document a person reads contains only findings the pipeline actually produced. Confidence is
presented consistently. Measures that were never computed are absent or plainly labelled as
general-purpose reference figures — never printed as zero or as a blank measurement.

**Why this priority**: These defects do not stop the feature working, so they rank below the
integrity and access stories. But they are the ones most likely to mislead a reader who trusts the
page, which is why they are in scope rather than deferred.

**Independent Test**: Produce reports from analyses with complete, partial, and legacy stored
findings, and confirm every displayed figure traces to stored data, with unavailable measures
omitted or labelled rather than fabricated.

**Acceptance Scenarios**:

1. **Given** an analysis with a stored confidence, **When** the report is produced, **Then**
   confidence is shown as a percentage everywhere it appears — document, listing, and narrative —
   and those presentations agree with each other. **[already satisfied — protect]**
2. **Given** a report is produced, **When** the stored record and interface contracts are inspected,
   **Then** confidence is still held as the raw model probability and is converted only for display.
   **[already satisfied — protect]**
3. **Given** an analysis of any kind, **When** a report of any type is produced, **Then** it contains
   no dataset-level model performance figure and no never-computed clinical measure — no accuracy,
   no area under the ROC curve, no precision, recall, F1, specificity, sensitivity, or predictive
   value — in any form, labelled or otherwise. **[partially satisfied — protect and complete]**
4. **Given** an analysis with no stored class-probability distribution, **When** the report is
   produced, **Then** the document states that a full differential is unavailable instead of
   presenting one. **[already satisfied — protect]**
5. **Given** any analysis, **When** the report narrative is produced, **Then** it contains no
   description of lesion size, shape, border, colour, or texture, because no such measurement is
   recorded. **[already satisfied — protect]**
6. **Given** an analysis whose stored feature list holds pipeline-generated placeholders rather than
   measurements, **When** the report is produced, **Then** those placeholders do not appear in the
   clinical narrative. **[already satisfied — protect]**
7. **Given** a report is produced, **When** the stored record, the document body, the preview, and
   the download are compared, **Then** all four carry the same report identifier, the same report
   number in a single documented format, and the same report type.
   **[partially satisfied — protect and complete]**

---

### User Story 6 - A new environment can be provisioned from version control (Priority: P3)

Someone setting up MIDAS from a fresh copy of the repository can create the report schema and
storage location by applying version-controlled definitions, without needing undocumented manual
steps or a copy of somebody's local machine.

**Why this priority**: This does not affect a person using the product today, so it ranks last. It
is nonetheless in scope because the report schema currently exists only on one machine, which makes
every other requirement here unverifiable in a new environment.

**Independent Test**: From a clean checkout and an empty database, apply the version-controlled
definitions and confirm reports can be produced end to end with no manual console steps.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** the version-controlled schema definitions are applied to an
   empty database, **Then** the report record structure, its identifier generator, and the analysis
   structure it depends on all exist.
2. **Given** a clean checkout, **When** provisioning is run, **Then** the report storage location is
   created with its access rules from version-controlled configuration, not by hand.
3. **Given** the provisioning definitions, **When** they are inspected, **Then** any access rule that
   cannot function — because it tests an identity of a kind this system never issues — is either
   corrected or removed with its replacement enforcement stated.
4. **Given** provisioning has been applied twice, **When** the second application runs, **Then** it
   succeeds without error and without duplicating or destroying existing records.
5. **Given** the report record structure, **When** it is created, **Then** the five permitted status
   values of FR-041 are enforced by the structure itself, and a write outside that set is rejected.
6. **Given** the live environment, **When** provisioning is accepted as met, **Then** each unresolved
   deployment fact D-1 through D-5 has been closed by its named validation step, or the
   corresponding requirement is explicitly recorded as not yet accepted.

---

### Edge Cases

Each is an independently testable condition. All must resolve to a truthful outcome.

| # | Condition | Required outcome |
|---|---|---|
| 1 | Report service unreachable | Explicit unavailable response; record marked failed with reason; no document stored |
| 2 | Narrative credential absent | Explicit failure; no boilerplate document produced or stored |
| 3 | Narrative returned in an uninterpretable structure, usable prose present | `degraded`; prose still delivered; provenance records the produced sections and the generator; missing sections named in document and interface |
| 4 | Narrative returned with nothing usable | `failed`, not `degraded` |
| 5 | Document renderer fails | Explicit failure; record marked `failed` with reason |
| 6 | Analysis has no image highlight overlay | Report produced without the overlay and discloses its absence; no broken-image gap and no claim that an overlay was reviewed |
| 7 | Overlay recorded but the stored object is missing | Same as row 6 — produced, disclosed, not fatal |
| 8 | Document access link has expired | Person is offered a freshly issued link rather than an error; the document is not regenerated |
| 9 | Same analysis and type requested twice | Second request produces its own record, report number, and stored document; the first remains retrievable and byte-identical |
| 10 | Unsupported report type requested | Refused as invalid, naming the four supported types; never silently substituted. Unreachable from the interface, since every entry point offers exactly the supported set |
| 11 | Analysis or report identifier belonging to another person | Refused as forbidden; no data disclosed; refusal reveals nothing the not-found case would not |
| 12 | Records created before this repair | Listed and openable using their stored values; never retroactively rewritten, and any field absent from them is shown as unavailable rather than inferred |

## Requirements *(mandatory)*

### Functional Requirements

**Ownership and access**

- **FR-001**: The system MUST establish the requesting person's identity from their authenticated
  session for every report operation, and MUST reject any operation where that identity cannot be
  established.
- **FR-002**: The system MUST confirm the requesting person owns the named analysis before creating
  any report record.
- **FR-003**: The system MUST confirm the requesting person owns the named report before returning
  any preview, download, status, or error detail for it.
- **FR-004**: The system MUST scope every report listing to the requesting person's own records.
- **FR-005**: The report production service MUST independently confirm that the named analysis
  belongs to the named person before producing anything, rather than trusting its caller.
- **FR-006**: The system MUST NOT accept a person identifier supplied in a request payload as proof
  of identity.
- **FR-007**: The credential protecting the report production service MUST have no default value; if
  it is not configured the service MUST refuse to start or MUST refuse all requests, and MUST NOT
  fall back to a value published in the source.

**Input validation**

- **FR-008**: The system MUST refuse a request naming an analysis that does not exist, with a
  not-found outcome. **[already satisfied — protect]**
- **FR-009**: The system MUST refuse a request naming an analysis owned by another person, with a
  forbidden outcome that discloses nothing about that analysis. **[already satisfied — protect]**
- **FR-010**: The supported report types MUST be exactly `diagnostic_summary`, `detailed_analysis`,
  `patient_report`, and `clinician_report`. The system MUST refuse any other value with an explicit
  invalid-type outcome that names the supported types, and MUST NOT substitute a default type.
- **FR-011**: The system MUST apply the same report-type validation at every entry point, so that no
  caller can introduce a type another caller would reject.
- **FR-011a**: All four supported types MUST be offered at every entry point from which a report can
  be generated, through one shared type picker. No entry point may hide a supported type, and no
  entry point may force a type without offering a choice. The exposed set MUST equal the supported
  set.
- **FR-012**: The system MUST leave no report record in a non-terminal state after a rejected
  request.

**Failure integrity**

- **FR-013**: The system MUST NOT produce, store, or return a substitute document when production
  fails. **[already satisfied — protect]**
- **FR-014**: The system MUST mark a report record failed, with a human-readable reason, whenever
  any production step fails. **[already satisfied — protect]**
- **FR-015**: The system MUST report a production failure to the requesting person as a failure,
  distinguishing a temporary service problem from a permanent rejection.
  **[already satisfied — protect]**
- **FR-016**: The system MUST classify an outcome as `degraded`, not `completed`, when a document was
  rendered and stored but any of the four expected narrative sections — summary, observations,
  recommendations, limitations — could not be generated.
- **FR-016a**: A narrative response that cannot be parsed into the expected section structure but
  contains usable prose MUST produce a `degraded` report that still delivers that prose. It MUST NOT
  be stored as `completed`, and the prose MUST NOT be silently discarded.
- **FR-017**: A degraded report MUST name, in the document itself and in the interface, which
  sections are unavailable, and MUST do so before the person opens the document.
- **FR-018**: The system MUST persist provenance for every report: which of the four narrative
  sections were produced, and which narrative generator produced them. This record MUST make a
  degraded result distinguishable from a complete one after the fact, without re-reading the
  document.
- **FR-019**: The system MUST NOT mark a record completed unless a document was rendered and stored
  successfully.
- **FR-020**: The system MUST surface failed and degraded outcomes in the person's report history
  alongside completed ones.

**Artifact identity consistency**

- **FR-021**: A report's identifier, report number, and report type MUST be identical across the
  stored record, the document body, the preview, and the download.
- **FR-022**: The system MUST use exactly one documented report-number format everywhere a report
  number is produced or displayed, including any fallback path.
- **FR-023**: The system MUST NOT generate a second report number inside the document renderer when
  the record already carries one. **[already satisfied — protect]**
- **FR-024**: The download filename MUST be derived from the report's own report number, and MUST
  agree between what the interface requests and what the system serves.
- **FR-025**: Every generation request MUST produce a new report record with its own identifier,
  its own report number, and its own stored document. A completed or degraded report MUST be
  immutable: it MUST NOT be overwritten, replaced, superseded, or marked obsolete by any later
  request. The system MUST NOT reuse an existing report in response to a repeat request.

**Measurement honesty**

- **FR-026**: Confidence MUST be persisted and exchanged as the raw model probability, and converted
  to a percentage only for display. **[already satisfied — protect]**
- **FR-027**: Confidence MUST be displayed as a percentage consistently in the document, the report
  listing, and the narrative, and those presentations MUST agree.
  **[already satisfied — protect]**
- **FR-028**: Any presentation banding of confidence — such as high, medium, or low — MUST be
  computed from the same normalised value that is displayed. **[already satisfied — protect]**
- **FR-029**: The system MUST render only measures actually recorded for that analysis. The
  per-analysis measures are exactly: confidence, margin over the second-ranked class, distribution
  entropy, and the class-probability distribution.
- **FR-030**: Dataset-level model performance figures — including accuracy, balanced accuracy, and
  area under the ROC curve — MUST NOT appear in any report of any type. The model card that records
  them declares that they were measured under conditions differing from production and therefore do
  not describe the deployed system, so presenting them beside a person's own result would invite
  reading them as that result's reliability. **[partially satisfied — protect and complete]**
- **FR-030a**: Clinical performance measures that were never computed — including precision, recall,
  F1, specificity, sensitivity, positive predictive value, and negative predictive value — MUST NOT
  appear in any report, in any form. They MUST NOT be rendered as zero, as an empty measurement, or
  under a heading that implies they were measured. Omission is the only permitted treatment.
- **FR-031**: When the class-probability distribution is absent, the report MUST state that a full
  differential is unavailable rather than presenting one. **[already satisfied — protect]**
- **FR-032**: The narrative MUST NOT describe lesion morphology, since no morphological measurement
  is recorded. **[already satisfied — protect]**
- **FR-033**: Stored fields holding pipeline-generated placeholders rather than measurements MUST
  NOT be used as clinical narrative input. **[already satisfied — protect]**
- **FR-034**: The recorded indication of which narrative generator produced the content MUST reflect
  the generator actually used.

**History, preview, and delivery**

- **FR-035**: Report history MUST be derived from stored report records, so that it survives a page
  reload and any loss of in-page state.
- **FR-036**: The system MUST offer preview and download for a completed report without requiring
  it to be produced again.
- **FR-037**: The system MUST issue document access links on demand at view time, so that a link's
  expiry never makes a stored report unreachable.
- **FR-038**: The system MUST distinguish, for the person, a report that is still in production from
  one that has completed, failed, or degraded.
- **FR-039**: When report history cannot be loaded, the system MUST tell the person loading failed
  rather than presenting an empty list.
- **FR-040**: When a report's stored document is missing, the system MUST report it as unavailable
  rather than returning an empty or corrupt file.
- **FR-040a**: A missing image highlight overlay MUST NOT fail generation. The report MUST be
  produced without it and MUST disclose that the overlay was unavailable, rather than omitting it
  silently or leaving a broken placeholder. This applies both when no overlay was ever recorded and
  when one was recorded but its stored object cannot be retrieved.

**Status and configuration contracts**

- **FR-041**: The report status vocabulary MUST be exactly these five values, and every producer and
  every consumer MUST use them: `pending`, `generating`, `completed`, `degraded`, `failed`. The
  value `processing` MUST be removed everywhere it appears, as nothing writes it.
- **FR-041a**: The permitted transitions MUST be exactly: `pending → generating`, `pending → failed`,
  `generating → completed`, `generating → degraded`, `generating → failed`. The states `completed`,
  `degraded`, and `failed` are terminal, and no transition out of them is permitted.
- **FR-042**: The permitted status values MUST be enforced at the storage layer, so a value outside
  the vocabulary cannot be written by any path.
- **FR-043**: Counts and summaries of in-progress reports MUST count `pending` and `generating`, and
  MUST NOT reference any value outside the vocabulary in FR-041.
- **FR-044**: Every component MUST accept the same configuration variable names for the same
  purpose, so that one valid configuration works for all report operations.
- **FR-045**: The system MUST fail clearly at startup, or on first use, when a required configuration
  value is absent, rather than failing later in a way that looks like a content problem.
- **FR-046**: A report-capability health signal MUST report on the dependencies the capability
  actually uses, and MUST NOT report healthy when a dependency required to produce a report is
  absent or misconfigured.
- **FR-047**: The health signal MUST NOT report on dependencies the capability does not use.

**Provisioning reproducibility**

- **FR-048**: The report record structure, its identifier generator, and the analysis structure it
  depends on MUST be creatable from version-controlled definitions.
- **FR-049**: The report storage location and its access rules MUST be creatable from
  version-controlled configuration.
- **FR-050**: Provisioning definitions MUST be committed to the repository even where repository
  ignore rules would otherwise exclude them, and their inclusion MUST be verified.
- **FR-051**: Provisioning MUST be repeatable: applying it to an already-provisioned environment
  MUST succeed without duplicating or destroying data.
- **FR-052**: Any access rule that cannot ever match, because it tests a kind of identity this system
  does not issue, MUST be corrected or removed, and the enforcement that actually protects the data
  MUST be stated alongside it.

**Patient-safe communication**

- **FR-053**: Every report MUST identify itself as AI-assisted screening output and MUST direct the
  reader to a qualified clinician. **[already satisfied — protect]**
- **FR-054**: Every report MUST state what image-based analysis cannot establish.
  **[already satisfied — protect]**
- **FR-055**: A report MUST NOT present a low-certainty result in confident language, or a
  high-certainty result as though uncertain. **[already satisfied — protect]**
- **FR-056**: Patient-facing reports MUST avoid unexplained clinical jargon.
  **[already satisfied — protect]**
- **FR-057**: A degraded report MUST NOT imply that its missing sections were considered and found
  unremarkable.

**Verification coverage**

- **FR-058**: Each reproduced defect corrected under this specification MUST gain a deterministic,
  offline regression check that fails against the defective behaviour and passes against the
  corrected behaviour.
- **FR-059**: Regression checks MUST cover, at minimum: report-type rejection, ownership rejection,
  each failure path resolving to failed or degraded, report-number and type consistency across
  record and document, confidence normalisation from both raw-probability and percentage inputs,
  omission of uncomputed clinical measures, and status vocabulary agreement.
- **FR-060**: Regression checks MUST run without network access, live credentials, or a running
  service.
- **FR-061**: Exactly one end-to-end smoke test MUST exercise the real path from an authenticated
  request through to a retrievable document, and MUST assert the document is genuinely produced
  rather than substituted.
- **FR-062**: The smoke test MUST be documented with its prerequisites and MUST state explicitly
  that it requires a live environment.

### Key Entities

- **Analysis**: A completed examination of one lesion image belonging to one person. Holds the
  diagnosis, the confidence as a raw probability, the risk level, recommendations, any recorded
  measures, and a reference to an image highlight overlay. Reports are always about exactly one
  analysis.
- **Report Record**: The durable record of one report production attempt. Holds its own identifier,
  its report number, the owning person, the analysis it describes, the report type, the chosen
  content options, the current status, the location of the stored document, and, where applicable,
  a failure reason and a record of which content sections were generated.
- **Report Document**: The rendered artefact a person reads and downloads. Must be attributable to
  exactly one Report Record and carry that record's identity.
- **Report Type**: A closed set of exactly four values — `diagnostic_summary`, `detailed_analysis`,
  `patient_report`, `clinician_report`. A value outside the set is invalid rather than
  substitutable, and all four are offered at every generation entry point.
- **Report Status**: A closed set of exactly five values — `pending`, `generating`, `completed`,
  `degraded`, `failed` — with the transitions defined in FR-041a. `completed`, `degraded`, and
  `failed` are terminal.
- **Narrative Content**: The generated prose sections of a report — summary, observations,
  recommendations, and limitations — together with provenance recording which of them were produced
  and which generator produced them.
- **Per-Analysis Measures**: The measures the analysis pipeline computes and stores for one
  analysis: confidence, margin over the second-ranked class, distribution entropy, and the
  class-probability distribution. These are the only measures a report may present.
- **Model Card**: The version-controlled record of the model's dataset-level evaluation, its
  caveats, and its explicitly not-measured quantities. It is referenced by this specification to
  establish what must **not** appear in a report; no report renders any figure from it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of report production attempts end in a state the person can correctly
  interpret — complete, degraded with named gaps, or failed with a reason. No attempt ends marked
  complete without a genuinely produced document.
- **SC-002**: Under each of the twelve edge conditions listed above, the observed outcome matches
  the required outcome — 12 of 12.
- **SC-003**: 100% of reports produced remain retrievable, previewable, and downloadable after a
  full application reload, with no regeneration required.
- **SC-004**: For any produced report, the report identifier, report number, and report type match
  across the stored record, the document body, the preview, and the download — 4 of 4 agreeing, in
  100% of sampled reports.
- **SC-005**: Confidence values presented to a person agree across the document, the listing, and
  the narrative in 100% of sampled reports, and no report displays a confidence differing from the
  stored probability by anything other than the documented percentage conversion.
- **SC-006**: Zero reports display any dataset-level model performance figure or any never-computed
  clinical measure, in any form. Verified by scanning rendered documents of all four types for the
  prohibited terms and finding none.
- **SC-006a**: 100% of reports whose narrative was incomplete are stored as `degraded` and name every
  missing section in both the document and the interface. Zero are stored as `completed`.
- **SC-006b**: Generating the same analysis and type N times yields N retrievable reports with N
  distinct report numbers, and the first report's stored document is byte-identical before and
  after.
- **SC-007**: A person attempting to reach another person's analysis or report succeeds in 0 out of
  all attempted cases, across every report operation.
- **SC-008**: A new environment can be provisioned to the point of producing a report end to end
  using only version-controlled definitions and documented configuration, with zero manual console
  steps.
- **SC-009**: Applying provisioning to an already-provisioned environment succeeds and changes no
  existing record.
- **SC-010**: Every defect corrected under this specification has at least one regression check that
  demonstrably fails before the correction and passes after it.
- **SC-011**: The full regression set completes offline, with no network access and no live
  credentials.
- **SC-012**: A person receiving a degraded report can identify which sections are missing without
  consulting anyone — verified by the document naming every omitted section.

## Assumptions

Reasonable defaults adopted where the brief did not specify. Each is a decision that can be
overridden without restructuring the specification.

Items 1, 2, and 4 were resolved by the clarification session above and are retained here only as
rationale. The remainder are defaults that can be overridden without restructuring the
specification.

1. **Degraded is reserved for a produced document.** *(Confirmed — clarification Q1.)* A report
   becomes `degraded` only when a document was rendered and stored but some narrative section is
   missing. If no usable narrative exists, the outcome is `failed`. This keeps `degraded` from
   becoming a synonym for broken.
2. **Pre-existing records are never rewritten.** Reports created before this repair keep their
   stored values and their stored documents. Fields the older records do not carry — provenance
   above all — are displayed as unavailable rather than inferred, defaulted, or backfilled. No
   migration regenerates a historical document, and no historical status value is rewritten to fit
   the vocabulary in FR-041. A historical row whose status falls outside that vocabulary is
   displayed verbatim and treated as terminal.
3. **The supported report types are unchanged.** *(Confirmed — clarification Q5.)* The existing four
   forms remain the closed set, now exposed uniformly. No new report form is introduced.
4. **Confidence conversion tolerates both stored conventions.** Normalisation accepts a raw
   probability and an already-scaled percentage, so records written under either convention render
   correctly. This behaviour already exists and is protected rather than replaced.
5. **Authorisation remains enforced in application code.** Because report operations run with
   credentials that bypass database-level access rules, the ownership filter in application code is
   the control being specified. Any database-level rule is defence in depth, not the primary control.

### Unresolved: live-environment facts

These are **deployment facts, not design decisions**. They cannot be settled by reading the
repository and were deliberately not asked as clarification questions. Each remains OPEN with a
named owner and the exact step that closes it. None may be assumed resolved during planning.

| # | Unresolved fact | Owner | Validation step | Blocks |
|---|---|---|---|---|
| D-1 | Whether the report storage location exists in the live project, and what access rules it carries. No version-controlled definition creates or configures it. | Repository owner (only holder of live project credentials) | List storage buckets and their policies in the live project; record the result in this spec, then encode it as version-controlled configuration | FR-049, SC-008 |
| D-2 | Whether the five untracked provisioning definitions were ever applied to the live environment. They exist only on one machine. | Repository owner | Compare the live schema against the five definitions on disk; record any drift before committing them | FR-048, FR-051 |
| D-3 | Whether the deployed row-level access rules match the definitions on disk. | Repository owner | Dump live policies for the report and analysis tables and diff against the tracked definitions | FR-052 |
| D-4 | The count and shape of pre-existing report records, including how many carry a status outside the FR-041 vocabulary or lack provenance. | Repository owner | Query the live report table grouped by status, and count rows with null provenance; the result sizes the Assumption 2 display path | Assumption 2 acceptance |
| D-5 | Whether the live narrative generator credential is configured, and which model identifier it resolves to. | Repository owner | Call the capability health signal once FR-046 is implemented and record the reported generator identity | FR-034, FR-046 |

**No runtime behaviour in this specification has been observed.** Every statement about how the
system behaves today was established by reading code. The capability has zero automated coverage,
so nothing here may be cited as verified until the regression set (FR-058 to FR-060) and the single
smoke test (FR-061) have actually run. A green result from the repository's continuous integration
does not count: it builds images and does not execute any report path.

## Out of Scope

Explicitly excluded. Work matching any of these is a separate feature.

- Replacing, retraining, or re-tuning the analysis model.
- Introducing new clinical labels or diagnostic categories.
- Building a research report form.
- Migrating authentication to a different identity system.
- Reviving the orphaned server-side function that formerly produced reports.
- Redesigning the dashboard or any page beyond what report history, preview, and download require.
- Any infrastructure work not required by a requirement above, including queuing, background
  workers, retry orchestration, and caching layers.
- Backfilling, regenerating, or altering reports created before this repair.
