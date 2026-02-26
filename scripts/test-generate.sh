#!/usr/bin/env bash
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
BASE_URL="${BASE_URL:-http://localhost:8787}"
TOKEN="${INTERNAL_API_TOKEN:-dev-local-token}"
DISTRICT="Muskegon ISD"
REPORT_TYPES="internal,spotlight,story"
TESTDATA="$(cd "$(dirname "$0")/../testdata/muskegon" && pwd)"
OUTDIR="$(cd "$(dirname "$0")/.." && pwd)/test-output"

mkdir -p "$OUTDIR"

echo "=== Adoption Report — test-generate ==="
echo "URL:      $BASE_URL/generate"
echo "District: $DISTRICT"
echo "Types:    $REPORT_TYPES"
echo "Token:    ${TOKEN:0:8}..."
echo ""

# ── Call /generate ──────────────────────────────────────────────────
HTTP_CODE=$(curl -s -o "$OUTDIR/generate.json" -w "%{http_code}" \
  -X POST "$BASE_URL/generate" \
  -H "X-Internal-Token: $TOKEN" \
  -F "districtName=$DISTRICT" \
  -F "reportTypes=$REPORT_TYPES" \
  -F "sigmaFiles=@$TESTDATA/sigma_1.csv" \
  -F "sigmaFiles=@$TESTDATA/sigma_2.csv" \
  -F "gongText=<$TESTDATA/gong.txt" \
  -F "fastFacts=$(cat "$TESTDATA/fastFacts.json")" \
  -F "checklistFile=@$TESTDATA/checklist.csv" \
)

echo "HTTP status: $HTTP_CODE"

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL — non-200 response"
  cat "$OUTDIR/generate.json"
  exit 1
fi

echo "Output saved to: $OUTDIR/generate.json"
echo ""

# ── Summary ─────────────────────────────────────────────────────────
# Use node to parse and summarize (avoids jq dependency)
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$OUTDIR/generate.json', 'utf8'));

console.log('=== Response Summary ===');
console.log('ok:          ', data.ok);
console.log('provider:    ', data.diagnostics?.provider ?? 'unknown');
console.log('usedMock:    ', data.diagnostics?.usedMock ?? 'unknown');
console.log('requestId:   ', data.diagnostics?.requestId ?? 'none');
console.log('timings:     ', JSON.stringify(data.diagnostics?.timingsMs ?? {}));
console.log('');

// Report sections
const slides = data.report?.internalDeck?.slides ?? [];
console.log('slides:      ', slides.length);

const hasSpotlight = data.report?.spotlight?.onePage != null;
console.log('spotlight:   ', hasSpotlight ? 'present' : 'null');

const frames = data.recap?.frames ?? [];
console.log('recap frames:', frames.length);

// Diagnostics
const gaps = data.report?.diagnostics?.dataGaps ?? [];
if (gaps.length > 0) {
  console.log('');
  console.log('Data gaps:');
  gaps.forEach(g => console.log('  -', g));
}

const err = data.diagnostics?.error;
if (err) {
  console.log('');
  console.log('LLM error:  ', err);
}

// Basic schema check
const issues = [];
if (typeof data.ok !== 'boolean') issues.push('missing ok');
if (!data.report) issues.push('missing report');
if (!data.recap) issues.push('missing recap');
if (!data.diagnostics) issues.push('missing diagnostics');
if (!data.diagnostics?.requestId) issues.push('missing requestId');
if (!data.diagnostics?.timingsMs) issues.push('missing timingsMs');

if (issues.length > 0) {
  console.log('');
  console.log('Schema issues:', issues.join(', '));
  process.exit(1);
} else {
  console.log('');
  console.log('Schema:       OK');
}
"

echo ""
echo "=== Done ==="
