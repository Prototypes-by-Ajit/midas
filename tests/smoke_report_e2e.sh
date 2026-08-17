#!/usr/bin/env bash
#
# smoke_report_e2e.sh -- genuine-renderer smoke test for generated reports.
# Implements the three checks in
# .specify/specs/001-report-generation-integrity/quickstart.md
# section "End-to-end smoke test" (FR-061).
#
# ---------------------------------------------------------------------------
# THIS TEST REQUIRES A LIVE ENVIRONMENT. IT IS NOT OFFLINE. (FR-062)
# ---------------------------------------------------------------------------
# It is the only test in this feature that is not offline, and it is documented
# as such on purpose. It does not generate the report -- it inspects a document
# that a live stack already produced. Producing that document needs:
#
#   * live Supabase credentials (SUPABASE_URL + SUPABASE_SERVICE_KEY, or the
#     NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY spellings)
#   * NVIDIA_API_KEY, for the narrative generator
#   * a real medical_analyses row belonging to the requesting Clerk user
#   * the backend running with WeasyPrint installed
#
# The deterministic offline coverage lives in backend/tests/test_pdf_content.py
# (T010). This script exists for the one thing that suite structurally cannot
# do: prove the bytes came out of the real renderer in a real deployment.
#
# Usage:
#   ./tests/smoke_report_e2e.sh <pdf-path> <expected-report-number>
#   REPORT_PDF=/tmp/report.pdf REPORT_NUMBER=MIDAS-REP-20260811-A1B2C3 \
#     ./tests/smoke_report_e2e.sh
#
# Requires poppler-utils on PATH (`pdfinfo`, `pdftotext`); `brew install poppler`.
# Exits 0 and prints PASS only when all three checks hold.

set -euo pipefail

REPORT_PDF="${1:-${REPORT_PDF:-}}"
REPORT_NUMBER="${2:-${REPORT_NUMBER:-}}"

fail() { echo "FAIL: $*" >&2; exit 1; }

[ -n "$REPORT_PDF" ]    || fail "no PDF given (arg 1 or \$REPORT_PDF)"
[ -n "$REPORT_NUMBER" ] || fail "no report number given (arg 2 or \$REPORT_NUMBER)"
[ -r "$REPORT_PDF" ]    || fail "cannot read $REPORT_PDF"
command -v pdfinfo    >/dev/null || fail "pdfinfo not on PATH (install poppler-utils)"
command -v pdftotext  >/dev/null || fail "pdftotext not on PATH (install poppler-utils)"

# 1. genuine renderer -- WeasyPrint writes producer metadata; a hand-assembled
#    or substituted PDF does not.
pdfinfo "$REPORT_PDF" | grep -qi weasyprint \
  || fail "not renderer output -- no WeasyPrint producer metadata in $REPORT_PDF"

# 2. correct identity -- a real render of the WRONG analysis passes check 1.
#    Both checks are required; neither is sufficient alone.
TEXT="$(pdftotext "$REPORT_PDF" -)"
printf '%s' "$TEXT" | grep -qF "$REPORT_NUMBER" \
  || fail "report number $REPORT_NUMBER missing from document"

# 3. nothing fabricated -- no prohibited performance measure may be rendered.
#    Term list matches backend/tests/test_pdf_content.py (T010), which is a
#    superset of the quickstart snippet: the snippet omits `accuracy`, and a
#    smoke test that is laxer than the unit test would pass documents the
#    offline suite rejects.
PROHIBITED='accuracy|balanced accuracy|auroc|auc|precision|recall|f1|specificity|sensitivity|\bPPV\b|\bNPV\b'
if printf '%s' "$TEXT" | grep -Eiq "$PROHIBITED"; then
  echo "FAIL: prohibited measure rendered in $REPORT_PDF" >&2
  printf '%s' "$TEXT" | grep -Eio "$PROHIBITED" | sort -u | sed 's/^/  found: /' >&2
  exit 1
fi

echo "PASS"
