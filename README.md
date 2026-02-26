# Adoption Report Backend

Local-only Node.js backend that powers the internal **Adoption Report Generator** app. Accepts uploaded Sigma CSV exports, Gong AI summaries, and optional prerequisite checklists — normalizes inputs, calls Claude (Anthropic), and returns structured JSON for the Lovable frontend.

## Quick Start

### 1. Install dependencies

```bash
cd adoption-report-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `8787`) |
| `FRONTEND_ORIGIN` | No | CORS origin (default: `http://localhost:5173`) |
| `INTERNAL_API_TOKEN` | **Yes** | Shared secret for auth header |
| `ANTHROPIC_API_KEY` | No* | Anthropic API key. If unset, runs in **mock mode** |
| `ANTHROPIC_MODEL` | No | Model ID (default: `claude-sonnet-4-20250514`) |
| `MAX_UPLOAD_MB` | No | Max upload size in MB (default: `25`) |

> *Mock mode returns a canned JSON response so you can develop the frontend without a real API key.

### 3. Run dev server

```bash
npm run dev
```

Server starts at `http://localhost:8787`.

### 4. Build for production

```bash
npm run build
npm start
```

## API Endpoints

### `GET /health`

```bash
curl http://localhost:8787/health
```

Response:
```json
{ "ok": true, "version": "1.0.0", "time": "2024-01-15T12:00:00.000Z" }
```

### `POST /generate`

Generate adoption report(s). Requires `X-Internal-Token` header.

```bash
curl -X POST http://localhost:8787/generate \
  -H "X-Internal-Token: your-token-here" \
  -F "districtName=Springfield USD" \
  -F "reportTypes=internal,spotlight" \
  -F "sigmaFiles=@path/to/users.csv" \
  -F "sigmaFiles=@path/to/sites.csv" \
  -F "gongText=Customer mentioned they love the forms workflow..." \
  -F 'fastFacts={"students":12000,"sites":15,"nps":72}'
```

Response:
```json
{
  "ok": true,
  "generatedReport": {
    "internal": { "reportType": "internal", "slides": [...] },
    "spotlight": { "reportType": "spotlight", "onePage": {...} },
    "diagnostics": { "confidenceByClaim": [...], "dataGaps": [...], "sourceMap": [...] }
  },
  "diagnostics": { "usedMock": false, "requestedTypes": ["internal", "spotlight"], ... }
}
```

### `POST /parse-only`

Debug endpoint — same inputs as `/generate`, returns the normalized payload without calling Claude.

```bash
curl -X POST http://localhost:8787/parse-only \
  -H "X-Internal-Token: your-token-here" \
  -F "districtName=Springfield USD" \
  -F "sigmaFiles=@path/to/users.csv"
```

## Report Types

| Type | Description |
|---|---|
| `internal` | Slide-by-slide internal adoption report |
| `spotlight` | One-page external customer spotlight |
| `story` | Spotify-wrapped style story frames |

Pass as comma-separated in `reportTypes` field. Default: `internal`.

## Adoption Definition

Adoption is **met** if either:
- **70%+** of account holders are weekly active users, OR
- **100%** of school sites have weekly active "site office managers" (excluding principals and teachers)

The backend computes these deterministically from parsed CSV data and includes them as `derived.adoptionMetrics` in the Claude payload.

## Testing

```bash
npm test
```

## Troubleshooting

| Issue | Fix |
|---|---|
| CORS errors | Ensure `FRONTEND_ORIGIN` in `.env` matches your frontend URL |
| 401 Unauthorized | Check `X-Internal-Token` header matches `INTERNAL_API_TOKEN` in `.env` |
| File too large | Increase `MAX_UPLOAD_MB` in `.env` |
| Mock responses | Set a valid `ANTHROPIC_API_KEY` to get real Claude responses |
| CSV not detected | Check CSV headers match expected patterns (see `parseCsv.ts` heuristics) |

## File Structure

```
src/
  index.ts              # Express app entry point
  config.ts             # Environment config
  routes/
    health.ts           # GET /health
    generate.ts         # POST /generate, POST /parse-only
  services/
    claude.ts           # Claude API integration + mock mode
    parseCsv.ts         # CSV parsing + table type detection
    parseGong.ts        # Gong text/file parsing
    normalizeInputs.ts  # Input normalization + adoption evaluator
    schema.ts           # Zod schemas for report validation
  utils/
    cors.ts             # CORS middleware
    logger.ts           # JSON structured logger
    validate.ts         # Auth + input validation middleware
  __tests__/
    adoption-evaluator.test.ts
    parseCsv.test.ts
    schema.test.ts
```
