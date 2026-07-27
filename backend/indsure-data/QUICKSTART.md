# IndSure Data Layer - Quick Start

## Installation

```bash
cd backend/indsure-data
npm install
```

## Generate Prisma Client

```bash
npm run prisma:generate
```

## Seed Database

```bash
npm run seed
```

Expected output:
```
🌱 IndSure Data Layer - Seeding Database
═══════════════════════════════════════════════════════════
📖 Loading insurers.json...
✅ Validated insurers.json
🏥 Seeding insurers...
✅ Seeded 27 insurers
...
✅ Database seeded successfully!

📊 Summary:
   • 27 insurers
   • 60+ insurer metrics
   • 8 sector benchmarks
   • 13 metric thresholds
   • 4 scoring profiles
   • 10 scoring dimensions
   • 25+ glossary terms
   • 22+ educational facts
```

## Validate Data

```bash
npm run validate
```

Expected output:
```
🔍 IndSure Data Layer - Validation
═══════════════════════════════════════════════════════════
✅ Scoring profile weights sum to 100
✅ All insurer metrics have source citations
✅ All metric names have corresponding thresholds
...
✅ All validation checks passed!
```

## Inspect Database

```bash
npm run prisma:studio
```

Opens http://localhost:5555 with a GUI to browse all tables.

## Test Insurer Name Resolver

```bash
npm test
```

## Next Steps

The data layer is now ready for Prompt 2:
- Scoring engine implementation
- Verdict logic
- Comparison API endpoints
- PDF parsing integration

## Troubleshooting

### "Cannot find module '@prisma/client'"
Run: `npm run prisma:generate`

### "SQLITE_ERROR: no such table"
Run: `npm run seed`

### Validation failures
Check the error details and fix the corresponding seed JSON file, then re-run `npm run seed`

## File Locations

- **Database**: `prisma/indsure.db` (SQLite file)
- **Seed data**: `src/data/seed/*.json`
- **Schema**: `prisma/schema.prisma`
- **Scripts**: `src/scripts/`
