# Insurer metrics: sources, coverage, cross-check (WS-C, 2026-10-15)

Output: `shared/data/insurerMetrics.json` (dataset_version 2026-10-15, FY 2024-25, 31 insurers).
Every non-null value was extracted by one reader and then re-read from the cited cell by an
independent second reader that saw only the JSON and the source files. **All 73 non-null values
agreed** (31 ICR, 7 CSR, 29 raw grievance counts, 6 per-10k). No value had to be nulled for
disagreement. `verified_by_second_reader` is `true` for all 31 insurers.

## Sources (IRDAI primary only)

| Doc | Where | Used for |
|---|---|---|
| IRDAI Handbook on Indian Insurance Statistics 2024-25 (zip of XLSX, released Feb 2026) | https://irdai.gov.in/handbook-of-indian-insurance (direct link is `source_url` in the JSON) | Table 62 (health ICR), Table 53 (claims status), Table 56 (grievances), Table 58 (health policies) |
| IRDAI Annual Report 2024-25 (PDF) | https://irdai.gov.in/annual-reports | Context only: Table I.29 (market CSR formula), Statement 10 (ICR incl. PA, not used), Annexure insurer names |
| IRDAI Annual Report 2023-24 (PDF) | same page | Checked: it has no insurer-wise claim or grievance tables either |

Local copies: `E:\Indsurefi\_irdai_sources\2026-10-15-insurer-metrics\` (verifier scripts in `...\2026-10-15-verifier-work\`).

The Handbook is XLSX, so it has no page numbers. **`page` is `null` on every value**; each value
instead carries `table`, `file`, `sheet` and `row` (Excel row), plus the raw `inputs` it was read or
computed from. This adds fields to the contract but renames none.

## What IRDAI does and does not publish per insurer (the main finding)

| Metric | Insurer-wise in IRDAI? | Result in the JSON |
|---|---|---|
| ICR, health excl. PA and travel | Yes, Handbook Table 62 | All 31 insurers |
| CSR, health only, by count | **No.** Table 53 is all lines (motor, fire, crop...). Table 66 (health claims) is market-wide only. The Annual Report has no insurer-wise claims statement (2023-24 or 2024-25). | Only the 7 standalone health insurers, whose Table 53 row is their whole book. **Null for all 24 general insurers, by design.** |
| Grievances, raw count | Yes, Table 56, but all lines, and the FY 2024-25 column "includes opening balance" (IRDAI footnote; the table format changed this year) | 29 of 31 |
| Grievances per 10,000 policies | **No.** IRDAI publishes no insurer-wise all-lines policy count (Statement 43 is sector totals). | Computed only for the 6 standalone health insurers (Table 56 / Table 58 health policies). Null for general insurers, because dividing all-lines grievances by health policies would mix bases. |

Exact formulas and caveats are in `definitions` in the JSON. Per-insurer `null_reason` says why
each null is null.

## Coverage

- **Fully covered (all 4 metrics): 6**: Aditya Birla Health, Care Health, ManipalCigna, Narayana Health, Niva Bupa, Star Health.
- **Partly covered: 25**
  - 23 general insurers: ICR + raw grievances (no CSR, no per-10k).
  - Zurich Kotak: ICR only. Table 56 has two rows for the one company (Kotak Mahindra General 436; Zurich Kotak General 547), so neither is used and they are not summed.
  - Galaxy Health: CSR + ICR only. It has no row in Table 56.
- **Not covered: 0.**

The founder's display choice (CSR + ICR + grievances per 10k) is therefore fully possible only
for standalone health insurers. For general insurers the compare card can show ICR only.

**Small-base caution for the UI:** Galaxy CSR 66.67% rests on 75 claims. Narayana CSR 91.67% rests on 12 claims (and per-10k on 1,628 policies). Shriram ICR 23.76% rests on Rs 72 lakh of earned premium. All three are correct as published but statistically thin. A minimum-volume rule is worth considering in WS-D.

## Cross-check against policycheck.online/insurers

PolicyCheck shows 15 insurers for **FY 2023-24**; we use **FY 2024-25**. So every row differs from
ours by more than 0.5. To tell "different year" from "different or wrong number", I also recomputed
FY 2023-24 from the same IRDAI tables (the 2024-25 Handbook carries the 2023-24 columns).

### ICR: every PolicyCheck figure matches IRDAI Table 62 for FY 2023-24 (within 0.05)

They differ from ours only because of the year.

| Insurer | PolicyCheck 23-24 | IRDAI T62 23-24 | Ours 24-25 |
|---|---|---|---|
| HDFC ERGO | 85.7 | 85.65 | 87.04 |
| Aditya Birla Health | 73.0 | 72.98 | 75.97 |
| Bajaj Allianz | 88.9 | 88.87 | 90.01 |
| Tata AIG | 83.1 | 83.13 | 80.65 |
| ICICI Lombard | 82.6 | 82.57 | 85.53 |
| IFFCO Tokio | 109.0 | 109.04 | 85.31 |
| ManipalCigna | 64.4 | 64.41 | 73.31 |
| SBI General | 98.1 | 98.09 | 94.20 |
| New India | 106.7 | 106.67 | 101.28 |
| Care Health | 59.3 | 59.28 | 65.10 |
| United India | 109.7 | 109.72 | 100.09 |
| Reliance General | 98.4 | 98.41 | 97.10 |
| Oriental | 100.7 | 100.73 | 103.77 |
| Niva Bupa | 59.4 | 59.43 | 61.63 |
| Star Health | 66.8 | 66.81 | 70.53 |

### Grievances: every PolicyCheck figure equals Table 56 FY 2023-24 "Actual Complaints" exactly

The difference is the year, and also the column: FY 2024-25 has no "actual" column, only "reported incl. opening balance".

| Insurer | PolicyCheck 23-24 | Ours 24-25 (raw) |
|---|---|---|
| HDFC ERGO | 6,018 | 7,326 |
| Aditya Birla Health | 3,904 | 5,329 |
| Bajaj Allianz | 2,855 | 3,807 |
| Tata AIG | 3,792 | 3,577 |
| ICICI Lombard | 5,170 | 7,782 |
| IFFCO Tokio | 1,894 | 3,697 |
| ManipalCigna | 1,706 | 2,041 |
| SBI General | 2,286 | 4,503 |
| New India | 6,584 | 7,768 |
| Care Health | 6,492 | 10,281 |
| United India | 7,181 | 10,126 |
| Reliance General | 2,636 | 3,396 |
| Oriental | 3,830 | 6,854 |
| Niva Bupa | 5,155 | 7,970 |
| Star Health | 16,603 | 20,527 |

### CSR: PolicyCheck's figures cannot be reproduced from IRDAI data on any basis

For FY 2023-24 I tried three formulas on Table 53, the only insurer-wise claims table IRDAI has:
- A: paid / (opening + intimated). This is IRDAI's own market basis and the one we use.
- B: paid / (paid + repudiated).
- C: paid / (paid + repudiated + closed).

None of them matches PolicyCheck consistently, and for general insurers Table 53 is not even health-only.

| Insurer | PolicyCheck 23-24 | T53 23-24 A / B / C | Ours 24-25 |
|---|---|---|---|
| HDFC ERGO | 98.6 | 95.30 / 99.16 / 97.94 | null |
| Aditya Birla Health | 98.1 | 94.55 / 95.64 / 95.64 | 94.09 |
| Bajaj Allianz | 98.1 | 92.18 / 98.17 / 95.13 | null |
| Tata AIG | 98.0 | 79.59 / 96.20 / 84.21 | null |
| ICICI Lombard | 97.8 | 80.97 / 91.85 / 86.58 | null |
| IFFCO Tokio | 97.2 | 83.74 / 96.08 / 92.27 | null |
| ManipalCigna | 97.0 | 87.79 / 88.64 / 88.64 | 93.06 |
| SBI General | 96.9 | 85.62 / 98.87 / 90.43 | null |
| New India | 96.8 | 92.07 / 98.53 / 98.53 | null |
| Care Health | 96.3 | 90.92 / 92.81 / 92.81 | 95.19 |
| United India | 96.1 | 78.66 / 91.99 / 91.87 | null |
| Reliance General | 95.8 | 93.14 / 98.81 / 97.51 | null |
| Oriental | 94.6 | 87.47 / 99.91 / 94.13 | null |
| Niva Bupa | 93.0 | 90.05 / 92.02 / 92.02 | 90.64 |
| Star Health | 91.7 | 77.80 / 85.48 / 85.48 | 78.50 |

PolicyCheck says its CSR is from "IRDAI Annual Reports", but neither the 2023-24 nor the 2024-25
Annual Report has an insurer-wise health claims table. The likely source is insurers' own public
disclosures or a secondary website, which is exactly what the founder ruled out. **This is the one
metric where copying their table would have published unverifiable numbers.** Their ICR and
grievance columns are faithful to IRDAI (for 2023-24).

## Proposed fix (not applied): "Claim Settlement Ratio (Simulated)" in the life prompt

`backend/server/lifeInsurancePrompt.ts` is live. `analysisPipeline.ts:786` uses it for every
`insuranceType === "life"` audit.

The schema example hard-codes `"claim_settlement_ratio": 98.5` with `"remarks": "Life Insurance Claim
Settlement Ratio (Simulated)"` (lines 99 to 101). The model copies the example, so life reports carry
an invented CSR. `PolicyAuditReport.tsx:571` reads `network_limitations.remarks`. Today it only uses
it to match insurer names, but any future display would surface the made-up figure.

Smallest honest change (two lines in the example, plus one rule):

```diff
-    "claim_settlement_ratio": 98.5,
+    "claim_settlement_ratio": null,
     "risk_level": "low",
-    "remarks": "Life Insurance Claim Settlement Ratio (Simulated)"
+    "remarks": "N/A"
```

Then add one line to the IMPORTANT HARD RULES block:
`- NEVER output a claim settlement ratio. Always set network_limitations.claim_settlement_ratio to null.`

Notes for whoever applies it:
- `vehicleInsurancePrompt.ts:105` has the same pattern (`"claim_settlement_ratio": 95.0`). It needs the same fix.
- No frontend code reads `claim_settlement_ratio` (grep), so `null` is safe.
- **Bigger issue, flagged not fixed:** the whole life prompt opens with "SYSTEM MODE: MOCK DATA ONLY (NO REAL ANALYSIS)" and tells the model to give "BELIEVABLE but FAKE scores". Every live life audit is therefore simulated. That is a founder-level decision.
- This is a prompt change, so by the standing rule it needs one verifying run before it ships.
