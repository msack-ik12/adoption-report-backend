# test-generate.ps1 — End-to-end test for POST /generate
$ErrorActionPreference = "Stop"

# ── Config ──────────────────────────────────────────────────────────
$BaseUrl     = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:8787" }
$Token       = if ($env:INTERNAL_API_TOKEN) { $env:INTERNAL_API_TOKEN } else { "dev-local-token" }
$District    = "Muskegon ISD"
$ReportTypes = "internal,spotlight,story"
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$TestData    = Join-Path $ScriptDir "..\testdata\muskegon"
$OutDir      = Join-Path $ScriptDir "..\test-output"

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$OutFile = Join-Path $OutDir "generate.json"

Write-Host "=== Adoption Report - test-generate ===" -ForegroundColor Cyan
Write-Host "URL:      $BaseUrl/generate"
Write-Host "District: $District"
Write-Host "Types:    $ReportTypes"
Write-Host "Token:    $($Token.Substring(0, [Math]::Min(8, $Token.Length)))..."
Write-Host ""

# ── Build multipart form ────────────────────────────────────────────
$sigma1    = Join-Path $TestData "sigma_1.csv"
$sigma2    = Join-Path $TestData "sigma_2.csv"
$gongFile  = Join-Path $TestData "gong.txt"
$checklist = Join-Path $TestData "checklist.csv"
$fastFacts = Get-Content (Join-Path $TestData "fastFacts.json") -Raw

$gongText  = Get-Content $gongFile -Raw

# Use curl.exe (not PowerShell alias) for multipart
$curlArgs = @(
    "-s", "-o", $OutFile, "-w", "%{http_code}",
    "-X", "POST", "$BaseUrl/generate",
    "-H", "X-Internal-Token: $Token",
    "-F", "districtName=$District",
    "-F", "reportTypes=$ReportTypes",
    "-F", "sigmaFiles=@$sigma1",
    "-F", "sigmaFiles=@$sigma2",
    "-F", "gongText=$gongText",
    "-F", "fastFacts=$fastFacts",
    "-F", "checklistFile=@$checklist"
)

$httpCode = & curl.exe @curlArgs

Write-Host "HTTP status: $httpCode"

if ($httpCode -ne "200") {
    Write-Host "FAIL - non-200 response" -ForegroundColor Red
    Get-Content $OutFile
    exit 1
}

Write-Host "Output saved to: $OutFile"
Write-Host ""

# ── Summary via Node ────────────────────────────────────────────────
$nodeScript = @"
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$($OutFile -replace '\\','/')', 'utf8'));

console.log('=== Response Summary ===');
console.log('ok:          ', data.ok);
console.log('provider:    ', data.diagnostics?.provider ?? 'unknown');
console.log('usedMock:    ', data.diagnostics?.usedMock ?? 'unknown');
console.log('requestId:   ', data.diagnostics?.requestId ?? 'none');
console.log('timings:     ', JSON.stringify(data.diagnostics?.timingsMs ?? {}));
console.log('');

const slides = data.report?.internalDeck?.slides ?? [];
console.log('slides:      ', slides.length);

const hasSpotlight = data.report?.spotlight?.onePage != null;
console.log('spotlight:   ', hasSpotlight ? 'present' : 'null');

const frames = data.recap?.frames ?? [];
console.log('recap frames:', frames.length);

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
"@

node -e $nodeScript

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
