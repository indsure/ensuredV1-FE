# IndSure Scoring Engine - Quick Start Guide

## Prerequisites

1. **Node.js 20+** installed
2. **IndSure Data Layer** seeded (from Prompt 1)
3. **Anthropic API Key** for Claude

## Installation

```bash
cd backend/indsure-scoring
npm install
```

## Configuration

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
DATABASE_URL=file:../indsure-data/prisma/indsure.db
```

## Verify Setup

### 1. Type Check

```bash
npm run lint
```

Should complete with no errors.

### 2. Run Tests

```bash
npm test
```

Should show 9 tests passing.

### 3. Start Server

```bash
npm run dev
```

Server should start on http://localhost:5001

## Test the API

### 1. Health Check

```bash
curl http://localhost:5001/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "indsure-scoring-engine",
  "timestamp": "2026-04-27T..."
}
```

### 2. Get Glossary

```bash
curl http://localhost:5001/api/glossary
```

Should return 25 insurance terms.

### 3. Get Educational Facts

```bash
curl http://localhost:5001/api/facts
```

Should return 5 random facts.

### 4. Get Data Freshness

```bash
curl http://localhost:5001/api/data-freshness
```

Should return metadata about data freshness.

## Test with Sample PDFs

### 1. Upload PDFs

```bash
curl -X POST http://localhost:5001/api/upload \
  -F "files=@/path/to/policy1.pdf" \
  -F "files=@/path/to/policy2.pdf"
```

**Note**: You'll need actual PDF files for this to work. The response will include:
- `session_id`: UUID for the session
- `extracted_policies`: Array of ExtractedPolicy objects

### 2. Compare Policies

```bash
curl -X POST http://localhost:5001/api/compare \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "YOUR_SESSION_ID_FROM_UPLOAD",
    "user_profile": {
      "age_band": "31-45",
      "coverage_need": "FAMILY_KIDS",
      "city_tier": "METRO",
      "pre_existing": [],
      "scoring_profile_id": "balanced"
    }
  }'
```

Response includes:
- `scored_policies`: Array with scores and rankings
- `verdict`: Human-readable comparison with winner

### 3. Rescore with Custom Weights

```bash
curl -X POST http://localhost:5001/api/rescore \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "YOUR_SESSION_ID",
    "user_profile": {
      "age_band": "31-45",
      "coverage_need": "FAMILY_KIDS",
      "city_tier": "METRO",
      "pre_existing": ["DIABETES"],
      "scoring_profile_id": "balanced"
    },
    "custom_weights": {
      "coverage_adequacy": 30,
      "cost": 20,
      "waiting_periods": 15,
      "exclusions_sublimits": 10,
      "maternity_family_fit": 5,
      "insurer_claim_performance": 10,
      "insurer_complaint_rate": 5,
      "insurer_financial_health": 2,
      "network_strength": 2,
      "renewal_terms": 1
    }
  }'
```

### 4. Delete Session

```bash
curl -X DELETE http://localhost:5001/api/session/YOUR_SESSION_ID
```

## Troubleshooting

### "ANTHROPIC_API_KEY not configured"

Make sure you've created `.env` and added your API key.

### "Insurer not found"

The data layer needs to be seeded first:

```bash
cd ../indsure-data
npm run seed
```

### "Failed to extract text from PDF"

- Check that the PDF is valid
- For scanned PDFs, OCR may take 30-60 seconds
- Check server logs for detailed error messages

### Port 5001 already in use

Change the port in `.env`:

```env
INDSURE_PORT=5002
```

## Development

### Watch Mode

```bash
npm run dev
```

Server auto-restarts on file changes.

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Build for Production

```bash
npm run build
```

Compiled files go to `dist/`.

## Next Steps

1. **Test with real PDFs**: Upload actual policy documents
2. **Explore scoring profiles**: Try "cost_focused", "coverage_focused", "claims_focused"
3. **Adjust weights**: Use the rescore endpoint to see how rankings change
4. **Check insurer data**: Use GET /api/insurer/:id to see available metrics

## API Documentation

See [README.md](./README.md) for complete API documentation.

## Support

- Check logs in the terminal where the server is running
- Review [PROMPT2_COMPLETION.md](./PROMPT2_COMPLETION.md) for architecture details
- Ensure data layer is properly seeded
