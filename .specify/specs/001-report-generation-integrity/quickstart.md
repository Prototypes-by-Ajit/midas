# Quickstart — Report Generation Integrity

**Feature**: `001-report-generation-integrity` | **Date**: 2026-08-06

How to run, verify, and manually exercise this feature. Prerequisites and the trap list are in
[plan.md](./plan.md); the contract is in [contracts/report-contract.md](./contracts/report-contract.md).

---

## Offline gates — no credentials, no network

These are the gates that must pass before any change is called done. All are runnable on a laptop
with no live environment.

```bash
# Backend unit + contract tests (added by this feature)
cd backend && source venv/bin/activate
python -m pytest -q

# Frontend — three separate gates, all required
cd frontend
npx tsc --noEmit        # no `typecheck` script exists
npm run lint            # `npm run build` does NOT run eslint (ignoreDuringBuilds: true)
npm run build
```

> A green continuous-integration check is **not** evidence. `.github/workflows/ci.yml` builds Docker
> images and Trivy-scans the backend; the Trivy job is report-only and skipped on pull requests. No
> workflow executes any report test. Verification is local.

If the backend dies at import with a `cairo` / `pango` / `gobject` error, the renderer's system
libraries are missing:

```bash
brew install pango gdk-pixbuf libffi cairo
```

---

## Running the stack

```bash
./start-services.sh          # backend :8000, frontend :3000
./verify-services.sh
```

Or the backend alone — **must** run from `backend/`, since config loads `.env` files relative to the
working directory:

```bash
cd backend && source venv/bin/activate
python -m uvicorn app.main_agent:app --host 0.0.0.0 --port 8000 --reload
```

Backend log: `tail -f backend/backend_agent.log`

---

## Capability health

```bash
curl -s localhost:8000/api/v1/reports/health | jq
```

After Phase C4 this reports on the dependencies reports actually use. Before it, treat the response
as meaningless: it reports `groq_configured` from a variable the narrative generator never reads,
does not check `NVIDIA_API_KEY` at all, and checks only the bare Supabase variable spellings while
the client accepts four — so it can report `healthy` with no narrative credential configured, and
`supabase_configured: false` on a working setup.

---

## Manual verification

### Authorization — two accounts, the check that matters most

1. Sign in as user A, run an analysis at `/dashboard/analysis`, note the analysis id.
2. Sign in as user B. From the browser console on `/dashboard/reports`:

```js
await fetch('/api/reports/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ analysis_id: '<A_ANALYSIS_ID>', config: { reportType: 'clinician_report' } })
}).then(r => [r.status, r.json()])
```

Expect **403**, no report row created, and nothing disclosed about A's analysis.

3. Repeat for `GET /api/reports/<A_REPORT_ID>/download` and `.../preview` — both **403**.
4. `GET /api/reports` as B — A's reports absent.

### Report type rejection

```js
await fetch('/api/reports/generate', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ analysis_id: '<OWN_ID>', config: { reportType: 'research_report' } })
}).then(r => [r.status, r.json()])
```

Expect **422** with `code: "INVALID_REPORT_TYPE"` naming the four valid types. Before Phase C2 this
returns 200 and quietly produces a `diagnostic_summary` instead.

### Refresh survival

1. Generate a report at `/dashboard/reports`.
2. Hard-reload the page.
3. The report is still listed with its number and status; **Preview** and **Download** work without
   regenerating. Before Phase D4 the card resets to *Generate Report* and both actions are
   unreachable even though the row and the PDF exist.

### Degradation is visible

Force an unparseable narrative (stub the generator to return prose rather than structured output).
Expect: status `degraded`, the interface saying so before opening, and the document naming the absent
sections. Never `completed`.

### Missing overlay is not fatal

Use an analysis whose `heatmap_path` is null, then one whose path points at a deleted object. Both
must produce a report that **discloses the overlay was unavailable**. Neither may fail, and neither
may leave a broken-image gap.

---

## Backend-only render — skips identity, storage, and the database

The fastest way to find out whether the renderer and the narrative generator work.

```bash
curl -X POST localhost:8000/api/v1/reports/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BACKEND_API_KEY:?set this — the test-key fallback is removed}" \
  -d '{
    "report_id": "00000000-0000-0000-0000-000000000001",
    "analysis_id": "<REAL-medical_analyses-UUID>",
    "report_type": "clinician_report",
    "user_id": "<CLERK-ID-THAT-OWNS-THAT-ANALYSIS>",
    "report_number": "MIDAS-REP-20260806-A1B2C3",
    "config": {"includeImages": true, "includeDetailedFeatures": true,
               "includeRecommendations": true, "includeDisclaimer": true}
  }' \
  -D /tmp/headers.txt --output /tmp/report.pdf

grep -i '^x-report-' /tmp/headers.txt     # provenance
open /tmp/report.pdf
```

After Phase C1, `user_id` must own `analysis_id` or the response is 404 — the service applies its own
ownership filter rather than trusting its caller.

---

## End-to-end smoke test (FR-061)

**The only test here that is not offline.** Requires live Supabase credentials, `NVIDIA_API_KEY`, and
a real `medical_analyses` row. Documented as such per FR-062.

Its job is to prove the document was **genuinely rendered**, not substituted:

```bash
# 1. genuine renderer — WeasyPrint writes producer metadata; a hand-assembled
#    PDF does not
pdfinfo /tmp/report.pdf | grep -qi weasyprint \
  || { echo "FAIL: not renderer output"; exit 1; }

# 2. correct identity — a real render of the wrong analysis would pass step 1
pdftotext /tmp/report.pdf - | grep -q "$REPORT_NUMBER" \
  || { echo "FAIL: report number missing from document"; exit 1; }

# 3. nothing fabricated — none of the prohibited measures may appear
pdftotext /tmp/report.pdf - \
  | grep -Eiq 'auc|auroc|precision|recall|f1|specificity|sensitivity|\bPPV\b|\bNPV\b' \
  && { echo "FAIL: prohibited measure rendered"; exit 1; }

echo "PASS"
```

Both of the first two checks are needed. Producer metadata alone proves only that the renderer ran,
not that the right data reached it.

---

## Confirming what was written

```sql
select id, report_number, report_type, generation_status,
       storage_path, generator, sections_generated, generated_at
from generated_reports
where user_id = '<CLERK_ID>'
order by created_at desc
limit 5;
```

Then confirm the object exists in `report_storage` at
`{userId}/reports/{report_id}_{report_type}.pdf`.

Generating twice for the same analysis and type must yield **two rows, two report numbers, two
distinct storage paths** — and the first document unchanged (FR-025, SC-006b).

---

## Provisioning from a clean checkout

```bash
# Apply in order. 003–007 are force-added by this feature; before that a fresh
# clone has no medical_analyses table and no generated_reports table.
supabase db push

# Confirm they are actually tracked — the bare `supabase/` ignore rule means
# plain `git add` silently does nothing
git ls-files supabase/migrations/ | grep -E '00[34567]_'
```

Applying twice must succeed and change no existing row (FR-051).

**`report_storage` cannot be provisioned from version control yet.** Spec item **D-1** is open: the
live bucket's policy is unknown and must be read before it is encoded. Do not guess it — creating the
bucket with an invented policy would either weaken access or break the live path.
