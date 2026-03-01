# Policy Wordings Repository

This directory stores official policy wordings PDFs fetched from insurers or manually added.

## Directory Structure

```
server/data/policy-wordings/
├── {Insurer Name}/
│   ├── {Product Name}/
│   │   ├── {Year}/
│   │   │   ├── {Plan}.pdf
│   │   │   └── wordings.pdf (fallback)
│   │   └── wordings.pdf (fallback)
│   └── {Product Name}.pdf (fallback)
```

## Examples

```
server/data/policy-wordings/
├── HDFC ERGO/
│   ├── Health Companion/
│   │   ├── 2024/
│   │   │   ├── Platinum.pdf
│   │   │   ├── Gold.pdf
│   │   │   └── wordings.pdf
│   │   └── wordings.pdf
│   └── Optima Restore/
│       └── wordings.pdf
├── ICICI Lombard/
│   └── Complete Health Insurance/
│       └── wordings.pdf
└── Star Health/
    └── Comprehensive/
        └── wordings.pdf
```

## How It Works

1. When a policy is uploaded, the system extracts:
   - Insurer name (e.g., "HDFC ERGO")
   - Product name (e.g., "Health Companion")
   - Plan/variant (e.g., "Platinum")
   - Policy year (e.g., 2024)

2. The system searches for wordings in this order:
   - `{insurer}/{product}/{year}/{plan}.pdf` (most specific)
   - `{insurer}/{product}/{year}/wordings.pdf`
   - `{insurer}/{product}/wordings.pdf` (fallback)
   - `{insurer}/{product}.pdf` (fallback)

3. If found locally, it uses the local file.
4. If not found locally, it attempts to fetch from the insurer's website.
5. If wordings are found, they are merged with the uploaded policy schedule before analysis.

## Adding Policy Wordings

### Option 1: Manual Addition
1. Download the official policy wordings PDF from the insurer's website.
2. Place it in the appropriate directory structure.
3. Name it according to the plan (e.g., `Platinum.pdf`) or use `wordings.pdf` as fallback.

### Option 2: Automatic Fetching
The system will attempt to fetch wordings from insurer websites if:
- Insurer URL patterns are configured in `server/utils/policyWordingsFetcher.ts`
- The insurer provides publicly accessible policy wordings PDFs

## Notes

- File names are case-insensitive (converted to lowercase for matching).
- If wordings are not found, analysis proceeds with the uploaded document only.
- Wordings are merged with the schedule to provide complete coverage information.
- This eliminates false ❌ coverage flags caused by missing policy wordings.

