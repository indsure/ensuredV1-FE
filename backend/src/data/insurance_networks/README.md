# Hospital Network PDF Pipeline - Quick Start

## Adding a New Insurance Network PDF

### 1. Add PDF
```powershell
# Create insurer folder (lowercase, underscores)
mkdir backend/data/insurance_networks/raw_pdfs/new_insurer

# Copy PDF (same name as folder)
cp path/to/network.pdf backend/data/insurance_networks/raw_pdfs/new_insurer/new_insurer.pdf
```

### 2. Run Pipeline
```powershell
cd E:\v2final

# Extract → Segment → Parse → Normalize → Dedupe → Index
npx tsx backend/data/insurance_networks/raw_text_extractor.ts
npx tsx backend/data/insurance_networks/hospital_segmenter.ts
npx tsx backend/data/insurance_networks/field_extractor.ts
npx tsx backend/data/insurance_networks/normalizer.ts
npx tsx backend/data/insurance_networks/deduplicator.ts
npx tsx backend/data/insurance_networks/indexer.ts
```

### 3. Done
- Data automatically available in UI at `/hospitals`
- No code changes required
- API serves new insurer data immediately

## Pipeline Scripts

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `raw_text_extractor.ts` | Extract text from PDFs | `raw_pdfs/*/` | `raw_text/*.txt` |
| `hospital_segmenter.ts` | Split into hospital records | `raw_text/*.txt` | `insurance_hospital_raw_records.json` |
| `field_extractor.ts` | Parse fields (name, city, etc) | `insurance_hospital_raw_records.json` | `insurance_hospitals_extracted.json` |
| `normalizer.ts` | Clean & validate data | `insurance_hospitals_extracted.json` | `insurance_hospital_networks.json` |
| `deduplicator.ts` | Remove duplicates | `insurance_hospital_networks.json` | `insurance_hospital_networks.json` (updated) |
| `indexer.ts` | Build indexes & aggregates | `insurance_hospital_networks.json` | `indexes.json`, `aggregates.json` |

## Requirements

- PDF must be text-based (not scanned image)
- Hospital records should follow pattern: `Hospital Name - City`
- Folder name = PDF name = insurer slug (lowercase, underscores)

## Verification

```powershell
# Check final dataset
cat backend/data/insurance_networks/insurance_hospital_networks.json | Select-String "new_insurer" | Measure-Object

# Test API
curl "http://localhost:5173/api/hospitals/filter?state=Maharashtra"
```

## Architecture

```
PDF → Extract → Segment → Parse → Normalize → Dedupe → Index → API → UI
       ↓        ↓         ↓       ↓           ↓        ↓      ↓     ↓
     .txt    records   fields  cleaned    unique   cached  JSON  React
```

**Zero UI Changes**: All logic in backend scripts. Frontend consumes generic API.
