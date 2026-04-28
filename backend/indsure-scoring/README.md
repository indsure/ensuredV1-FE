# IndSure Scoring Engine

PDF extraction, policy scoring, and verdict generation for Indian health insurance comparison.

## Architecture

```
indsure-scoring/
├── src/
│   ├── extraction/          # PDF → ExtractedPolicy pipeline
│   │   ├── pdf-loader.ts           # Text/OCR extraction
│   │   ├── llm-extractor.ts        # Claude structured output
│   │   ├── insurer-resolver-bridge.ts  # Name → ID resolution
│   │   └── extraction-orchestrator.ts  # Main entry point
│   ├── scoring/             # Scoring engine
│   │   ├── dimensions/             # 10 dimension scorers
│   │   ├── insurer-data-repository.ts  # Fetch metrics from data layer
│   │   └── scoring-engine.ts       # Orchestrator + ranking
│   ├── verdict/             # Verdict generator
│   │   └── verdict-generator.ts    # Human-readable insights
│   ├── api/                 # HTTP API
│   │   ├── routes.ts               # Express routes
│   │   ├── server.ts               # Server setup
│   │   └── session-store.ts        # In-memory session storage
│   └── types/               # TypeScript types
│       ├── policy.ts               # ExtractedPolicy schema
│       ├── scoring.ts              # Scoring types
│       └── verdict.ts              # Verdict types
└── tests/                   # Vitest tests
```

## Setup

### Prerequisites

- Node.js 20+
- IndSure data layer (../indsure-data) seeded
- Anthropic API key for Claude

### Installation

```bash
cd backend/indsure-scoring
npm install
```

### Environment Variables

Create `.env`:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=file:../indsure-data/prisma/indsure.db

# Optional
EXTRACTION_OCR_PROVIDER=tesseract  # or google-vision, aws-textract
INDSURE_PORT=5001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

### Run

```bash
# Development
npm run dev

# Build
npm run build

# Tests
npm test
```

## API Endpoints

### POST /api/upload

Upload 1-4 PDFs for extraction.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `files` (array of PDFs)

**Response:**
```json
{
  "session_id": "uuid",
  "extracted_policies": [ExtractedPolicy]
}
```

### POST /api/compare

Score and compare policies.

**Request:**
```json
{
  "session_id": "uuid",
  "user_profile": {
    "age_band": "31-45",
    "coverage_need": "FAMILY_KIDS",
    "city_tier": "METRO",
    "pre_existing": ["DIABETES"],
    "scoring_profile_id": "balanced"
  }
}
```

**Response:**
```json
{
  "scored_policies": [ScoredPolicy],
  "verdict": Verdict
}
```

### POST /api/rescore

Rescore with custom weights.

**Request:**
```json
{
  "session_id": "uuid",
  "user_profile": {...},
  "custom_weights": {
    "coverage_adequacy": 30,
    "cost": 20,
    ...
  }
}
```

### DELETE /api/session/:id

Delete session immediately (DPDP compliance).

### GET /api/insurer/:id

Get insurer details for SEO pages.

### GET /api/glossary

Get all glossary terms.

### GET /api/facts

Get random educational facts.

### GET /api/data-freshness

Get data freshness metadata.

## Data Flow

1. **Upload**: PDF → pdf-loader → llm-extractor → insurer-resolver → ExtractedPolicy
2. **Score**: ExtractedPolicy + UserProfile → scoring-engine → ScoredPolicy[]
3. **Verdict**: ScoredPolicy[] → verdict-generator → Verdict

## Privacy & DPDP Compliance

- PDFs processed in memory only (never persisted to disk)
- Sessions auto-delete after 24 hours
- Manual deletion via DELETE /api/session/:id
- No PII in logs
- Audit trail for deletions (timestamp + session ID only)

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm test -- --coverage
```

## Integration with Data Layer

The scoring engine depends on the IndSure data layer (`../indsure-data`):

- Insurer resolution uses `insurers` table
- Metric classification uses `metric_thresholds` table
- Scoring weights from `scoring_profiles` table
- Insurer performance from `insurer_metrics` table

Ensure the data layer is seeded before running the scoring engine.

## LLM Usage

- **Model**: Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)
- **Temperature**: 0 (deterministic)
- **Max tokens**: 4096
- **Cost**: ~$0.10-0.30 per policy extraction (varies by PDF length)

Token usage is logged for cost monitoring.

## Dimension Scorers

1. **coverage_adequacy**: Sum insured, restoration benefit
2. **cost**: Premium per ₹1L, co-pay, room rent limits
3. **waiting_periods**: PED, specific illness, maternity
4. **exclusions_sublimits**: Sub-limits, permanent exclusions
5. **maternity_family_fit**: Maternity coverage, newborn
6. **insurer_claim_performance**: CSR, ICR
7. **insurer_complaint_rate**: Complaints per 10k policies
8. **insurer_financial_health**: Solvency ratio
9. **network_strength**: Network hospital count
10. **renewal_terms**: Lifetime renewability, portability

## Scoring Profiles

- **balanced**: Default, equal weight on coverage, cost, insurer
- **cost_focused**: Prioritizes affordability
- **coverage_focused**: Maximizes coverage breadth
- **claims_focused**: Emphasizes insurer track record

## Error Handling

- PDF load errors → 400 with helpful message
- LLM extraction errors → 500 with details
- Session not found → 404
- Invalid weights → 400 with validation error

## Performance

- PDF extraction: 10-30s per policy (depends on LLM API)
- Scoring: <1s for 4 policies
- Verdict generation: <1s

## Future Enhancements

- Google Vision / AWS Textract OCR
- Batch processing for multiple sessions
- Caching for insurer data
- WebSocket for real-time extraction progress
- Multi-language support (Hindi)
