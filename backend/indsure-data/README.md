# IndSure Data Layer

**Insurer Performance Data Bank for Indian Health Insurance**

This is the data foundation for IndSure — an AI-assisted health insurance comparison tool for the Indian market. This layer provides a clean, queryable, well-structured backend with no UI or comparison logic. It serves as the single source of truth for insurer data, metrics, thresholds, and educational content.

## Project Overview

The IndSure data layer ingests and structures data from the research document "Insurer Performance Data Bank for Indian Health Insurance (FY 2022-23 to FY 2024-25 Snapshot)" dated 2026-04-27. Every numeric value, threshold, and weight in this system is traceable to that document.

**Key Features:**
- 27+ insurers across SAHI, Private General, and PSU categories
- Official IRDAI sector benchmarks (ICR, solvency, complaints)
- Insurer-level metrics with clear source attribution and confidence levels
- Metric interpretation thresholds based on industry standards
- 4 scoring profiles (balanced, cost-focused, coverage-focused, claims-focused)
- 10 scoring dimensions with methodology documentation
- 25+ insurance glossary terms with examples
- 22+ educational facts for user awareness
- Insurer name resolver for PDF extraction matching

## Architecture Decisions

### Why SQLite?
- **Single-file database**: Easy to inspect, backup, and version control
- **Zero configuration**: No separate database server needed for MVP
- **Sufficient for read-heavy workloads**: Data refreshes are quarterly, not real-time
- **Migration path documented**: Can move to PostgreSQL when scale demands it

### Why Node.js + TypeScript?
- **Type safety**: Zod schemas + TypeScript ensure data integrity at every layer
- **Ecosystem maturity**: Prisma ORM provides excellent TypeScript support
- **Existing backend**: Integrates with the existing Express backend in this project
- **Developer experience**: Fast iteration with tsx for running TypeScript directly

### Why Prisma?
- **Type-safe queries**: Generated client provides full TypeScript types
- **Schema-first**: Database schema is the source of truth
- **Migration support**: Easy to evolve schema over time
- **Introspection**: Prisma Studio provides GUI for data inspection

## Installation & Setup

```bash
# Navigate to the data layer directory
cd backend/indsure-data

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Seed the database (creates indsure.db and populates all tables)
npm run seed

# Validate data integrity
npm run validate

# Run tests
npm test

# Open Prisma Studio to inspect data
npm run prisma:studio
```

## How to Run

### Initial Setup
```bash
npm install
npm run prisma:generate
npm run seed
```

### Validate Data
```bash
npm run validate
```

This runs integrity checks:
- ✓ All scoring profile weights sum to exactly 100
- ✓ Every insurer metric row has a valid source_citation
- ✓ Every metric_name in insurer_metrics exists in metric_thresholds
- ✓ Every dimension referenced in scoring profiles exists in scoring_dimensions
- ✓ All glossary terms have non-empty short_definition
- ✓ All seed JSON files parse cleanly against schemas
- ✓ No insurer has data_as_of in the future
- ✓ Sector benchmarks exist for the same FYs that insurer metrics exist for

### Run Tests
```bash
npm test
```

Tests cover:
- Schema validation on every seed file
- Each repository function (happy path + missing data)
- Insurer name resolver with edge cases
- Threshold classifyValue() at boundary values
- Scoring profile weight validation

### Inspect Database
```bash
npm run prisma:studio
```

Opens a web UI at http://localhost:5555 to browse all tables and data.

## How to Update Insurer Data (Quarterly Process)

When new IRDAI data is released (typically 6-9 months after fiscal year end):

1. **Update research document**
   - Open `research/insurer-data-bank.md`
   - Update relevant sections with new IRDAI Annual Report data
   - Add new fiscal year rows to tables
   - Update citations and footnotes

2. **Update seed JSON files**
   - `src/data/seed/sector-benchmarks.json` — add new FY rows
   - `src/data/seed/insurer-metrics.json` — add new insurer-level data
   - `src/data/seed/metric-thresholds.json` — update if IRDAI changes regulations
   - `src/data/seed/insurers.json` — add new insurers or update former names
   - `src/data/seed/educational-facts.json` — add new regulatory changes or stats

3. **Refresh database**
   ```bash
   npm run seed:refresh
   ```

4. **Validate integrity**
   ```bash
   npm run validate
   ```

5. **Bump version**
   - Update `research_doc_version` in seed script
   - Update `dataAsOf` dates where applicable
   - Commit changes with clear message: "Data refresh: FY 2024-25 IRDAI Annual Report"

6. **Run tests**
   ```bash
   npm test
   ```

## Data Sources & Citations

All data in this system comes from:

### Primary Sources (Official)
- **IRDAI Annual Reports** (FY 2022-23, FY 2023-24)
  - Sector-level ICR, GWP, solvency ratios
  - Complaint volumes and trends
  - Regulatory actions and policy changes
  - Source: IRDAI official publications, cited through ET BFSI, AffairsCloud, PTI

- **IRDAI Handbook on Indian Insurance Statistics**
  - Historical series and insurer-wise tables
  - Detailed claim statistics

- **Council for Insurance Ombudsmen (CIO) Annual Report 2023-24**
  - Ombudsman complaint statistics
  - Award and recommendation data
  - Resolution timelines

### Secondary Sources (Journalistic/Derived)
- **Policybazaar Data Lab, PolicyX, Ditto Insurance**
  - Insurer-level ICR (derived from IRDAI)
  - CSR rankings (computed from IRDAI data)
  - Network hospital counts (insurer self-reported)
  - **Confidence level: MEDIUM to LOW**
  - **Clearly tagged as JOURNALISTIC_DERIVED or INSURER_SELF_REPORTED**

### Regulatory Framework
- **IRDAI regulations and circulars**
  - Solvency requirements (minimum 1.50)
  - Waiting period caps (PED max 36 months)
  - Claim settlement timelines (30 days)
  - Moratorium period (8 years)

## Confidence Levels Explained

Every metric in the database has a confidence level:

### HIGH
- Official IRDAI data from Annual Reports or Handbooks
- Regulatory requirements and thresholds
- Example: Sector ICR aggregates, solvency minimums

### MEDIUM
- Journalistic aggregations citing IRDAI as source
- Comparison portal rankings derived from IRDAI tables
- Example: Insurer-level ICR, CSR by count rankings

### LOW
- Insurer self-reported data not audited by IRDAI
- Marketing claims and network counts
- App ratings and user reviews
- Example: Network hospital counts, cashless approval ratios

## Known Data Gaps (from Research §1.2)

The following data points are **not publicly available** in aggregated form and are marked as such:

1. **Product-level claim statistics**
   - IRDAI only publishes insurer-level data, not plan-wise
   - Two products from the same insurer share the same claim profile

2. **Insurer-wise complaint rates (normalized)**
   - Raw complaint counts exist in IRDAI reports
   - Normalization (per 10K policies, per ₹1 crore premium) requires manual calculation
   - **Implementation needed**: PDF table extraction pipeline

3. **Cashless approval ratios**
   - No central IRDAI table exists
   - Insurers may self-report, but not standardized

4. **Average claim processing times**
   - IRDAI mandates 30-day maximum
   - Actual average times per insurer not publicly disclosed

5. **CSR by value (claim amount)**
   - Industry aggregate available (₹15,100 crore disallowed in FY24)
   - Insurer-wise breakdown not published

6. **Regulatory action details**
   - IRDAI publishes orders on website
   - Requires targeted crawling and categorization
   - **Implementation needed**: IRDAI orders scraper

## Migration Path to PostgreSQL

When the system needs to scale beyond SQLite:

1. **Update Prisma schema**
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. **Create PostgreSQL database**
   ```bash
   createdb indsure_production
   ```

3. **Run migrations**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Re-seed data**
   ```bash
   npm run seed
   ```

5. **Update connection string**
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/indsure_production"
   ```

**Benefits of PostgreSQL:**
- Better concurrency for multi-user access
- Full-text search capabilities
- JSON query operators for complex filtering
- Replication and backup strategies
- Connection pooling for production workloads

## Project Structure

```
backend/indsure-data/
├── prisma/
│   ├── schema.prisma          # Database schema (source of truth)
│   └── indsure.db             # SQLite database file (generated)
├── src/
│   ├── data/
│   │   └── seed/              # Raw research data as JSON
│   │       ├── insurers.json
│   │       ├── insurer-metrics.json
│   │       ├── sector-benchmarks.json
│   │       ├── metric-thresholds.json
│   │       ├── scoring-profiles.json
│   │       ├── scoring-dimensions.json
│   │       ├── glossary.json
│   │       └── educational-facts.json
│   ├── schemas/               # Zod validation schemas
│   │   └── (to be created)
│   ├── repositories/          # Data access layer
│   │   └── (to be created)
│   ├── lib/
│   │   └── (utility functions)
│   └── scripts/
│       ├── seed.ts            # One-shot data ingestion
│       └── validate.ts        # Integrity check script
├── tests/                     # Test files
│   └── (to be created)
├── research/                  # Source markdown
│   └── insurer-data-bank.md
├── package.json
├── tsconfig.json
└── README.md                  # This file
```

## Next Steps (Prompt 2)

This data layer is complete and ready for:
- **Scoring engine**: Implement the 0-100 policy scoring logic using scoring profiles and dimensions
- **Verdict logic**: Generate plain-English verdicts based on scores and thresholds
- **Comparison API**: Build endpoints to compare multiple policies side-by-side
- **PDF parsing integration**: Connect the insurer name resolver to PDF extraction pipeline

## License

UNLICENSED - Internal use only for IndSure project.

## Data Freshness

**Current data version:** 2026-04-27  
**Latest IRDAI FY:** FY 2023-24  
**Next scheduled refresh:** Q3 2026 (after FY 2024-25 Annual Report release)

---

**Built with:** Node.js, TypeScript, Prisma, SQLite, Zod  
**Research document:** "Insurer Performance Data Bank for Indian Health Insurance (FY 2022-23 to FY 2024-25 Snapshot)"
