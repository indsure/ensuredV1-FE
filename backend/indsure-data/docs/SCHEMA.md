# IndSure Database Schema Documentation

**For Non-Engineers: Understanding the Data Structure**

This document explains every table and field in the IndSure database in plain English. If you're responsible for quarterly data updates, this is your guide.

---

## Table of Contents

1. [Insurers](#insurers) - The companies
2. [Insurer Metrics](#insurer-metrics) - Performance data over time
3. [Sector Benchmarks](#sector-benchmarks) - Industry averages
4. [Metric Thresholds](#metric-thresholds) - How to interpret numbers
5. [Scoring Profiles](#scoring-profiles) - Different ways to evaluate policies
6. [Scoring Dimensions](#scoring-dimensions) - What we measure
7. [Glossary Terms](#glossary-terms) - Insurance vocabulary
8. [Educational Facts](#educational-facts) - User education content
9. [Unresolved Insurers](#unresolved-insurers) - PDF matching failures
10. [Data Freshness](#data-freshness) - When data was last updated

---

## Insurers

**What it stores:** The list of all health insurance companies we track.

### Fields

| Field | What it means | Example |
|-------|---------------|---------|
| **id** | A short, URL-friendly identifier | `"niva-bupa"`, `"star-health"` |
| **registeredName** | Official company name registered with IRDAI | `"Niva Bupa Health Insurance Company Ltd."` |
| **brandName** | The name customers know | `"Niva Bupa"` |
| **formerNames** | Previous names (for matching old documents) | `["Max Bupa"]` for Niva Bupa |
| **category** | Type of insurer | `"SAHI"` (standalone health), `"PRIVATE_GENERAL"`, or `"PSU_GENERAL"` |
| **foundedYear** | Year the company started in India | `2008` |
| **notes** | History, mergers, rebrands | `"Rebranded from Max Bupa after change in shareholding"` |
| **sourceCitation** | Where this info came from | `"Research §2.1"` |
| **dataAsOf** | When we last verified this | `"2026-04-27"` |

### Why it matters
When a user uploads a policy PDF, we need to match the insurer name (which might be written differently) to our database. Former names help us match "Max Bupa" to "Niva Bupa".

---

## Insurer Metrics

**What it stores:** Performance numbers for each insurer over time (like claim settlement rates, complaint counts).

### Fields

| Field | What it means | Example |
|-------|---------------|---------|
| **id** | Auto-generated unique number | `1`, `2`, `3`... |
| **insurerId** | Which insurer this is about | `"star-health"` |
| **fiscalYear** | Which year | `"FY 2023-24"` |
| **metricName** | What we're measuring | `"CSR_BY_COUNT"`, `"ICR"`, `"NETWORK_HOSPITAL_COUNT"` |
| **value** | The number (if numeric) | `98.44` (for 98.44% CSR) |
| **valueText** | The value (if text) | `"Excellent"` |
| **dataSourceType** | Where the data came from | `"OFFICIAL_IRDAI"`, `"JOURNALISTIC_DERIVED"`, `"INSURER_SELF_REPORTED"` |
| **sourceCitation** | Specific source | `"Research §3.3 - Journalistic ranking derived from IRDAI data"` |
| **confidence** | How reliable is this | `"HIGH"`, `"MEDIUM"`, `"LOW"` |
| **notes** | Extra context | `"Varies slightly across portals (64-65%)"` |

### Metric Names (What We Track)

- **CSR_BY_COUNT**: Claim Settlement Ratio by count (% of claims settled)
- **CSR_BY_VALUE**: Claim Settlement Ratio by value (% of claim amount paid)
- **ICR**: Incurred Claim Ratio (claims paid / premium earned)
- **CLAIM_REJECTION_RATE**: % of claims rejected
- **AVG_CLAIM_PROCESSING_DAYS**: Average days to settle a claim
- **CASHLESS_APPROVAL_RATIO**: % of cashless requests approved
- **SOLVENCY_RATIO**: Financial health indicator (capital / required capital)
- **COMPLAINTS_PER_10K_POLICIES**: Complaints per 10,000 policies
- **COMPLAINTS_PER_CRORE_PREMIUM**: Complaints per ₹1 crore premium
- **OMBUDSMAN_AWARDS_AGAINST**: Times Ombudsman ruled against insurer
- **COMPLAINT_RESOLUTION_RATE**: % of complaints resolved
- **GWP_HEALTH**: Gross Written Premium for health business
- **NETWORK_HOSPITAL_COUNT**: Number of network hospitals
- **REGULATORY_ACTIONS_COUNT_5Y**: Regulatory penalties in last 5 years

### Why it matters
This is the core performance data. When comparing insurers, we look at their CSR, ICR, complaints, etc. The `dataSourceType` and `confidence` tell us how much to trust each number.

### Important Rule
**If data is missing for an insurer, we don't add a row.** Missing data = no row. The frontend will show "Data not available" instead of making up numbers.

---

## Sector Benchmarks

**What it stores:** Industry-wide averages for comparison (like "all standalone health insurers had 63.63% ICR in FY 2023-24").

### Fields

| Field | What it means | Example |
|-------|---------------|---------|
| **id** | Auto-generated unique number | `1`, `2`, `3`... |
| **fiscalYear** | Which year | `"FY 2023-24"` |
| **segment** | Which group of insurers | `"SAHI"`, `"PSU"`, `"PRIVATE_GENERAL"`, `"OVERALL_NON_LIFE"` |
| **metricName** | What we're measuring | `"ICR"` |
| **value** | The benchmark number | `63.63` (for 63.63% ICR) |
| **sourceCitation** | Where it came from | `"Research §3.1 - IRDAI Annual Report 2023-24"` |

### Why it matters
When we say "Star Health's ICR is 66.47%", we can compare it to the SAHI segment average of 63.63% to see if they're above or below average.

---

## Metric Thresholds

**What it stores:** How to interpret metric values (like "CSR above 97% is excellent, 92-97% is good").

### Fields

| Field | What it means | Example |
|-------|---------------|---------|
| **metricName** | Which metric | `"CSR_BY_COUNT"` |
| **excellentMin** | Minimum value for "excellent" | `97.0` (97% or higher) |
| **goodMin** | Minimum value for "good" | `92.0` |
| **concerningMin** | Minimum value for "concerning" | `85.0` |
| **redFlagMax** | Maximum value for "red flag" | `85.0` (below 85% is bad) |
| **direction** | Is higher better or lower better? | `"HIGHER_IS_BETTER"`, `"LOWER_IS_BETTER"`, `"BAND"` |
| **interpretationText** | Plain English explanation | `"Share of claims by number that the insurer settles..."` |
| **misinterpretationWarning** | Common mistakes | `"High CSR may hide low ticket, easy claims being paid..."` |
| **sourceCitation** | Where these thresholds came from | `"Research §8.1"` |

### Why it matters
This is how we turn raw numbers into user-friendly labels. When we see CSR of 96.5%, we check this table and say "Good" (because it's between 92% and 97%).

---

## Scoring Profiles

**What it stores:** Different ways to evaluate policies based on what matters most to the user.

### Fields

| Field | What it means | Example |
|-------|---------------|---------|
| **id** | Profile identifier | `"balanced"`, `"cost_focused"`, `"coverage_focused"`, `"claims_focused"` |
| **displayName** | User-friendly name | `"Balanced Profile"` |
| **description** | What this profile does | `"Default balanced approach weighing coverage, cost, and insurer performance equally"` |
| **weights** | How much each dimension matters (JSON) | `{"coverage_adequacy": 20, "cost": 15, ...}` |
| **recommendedFor** | When to use this | `"Most users seeking a comprehensive evaluation..."` |

### The Four Profiles

1. **Balanced** (default): Equal weight to coverage, cost, and insurer performance
2. **Cost-Focused**: Prioritizes affordability (30% weight on cost)
3. **Coverage-Focused**: Maximizes protection (30% weight on coverage adequacy)
4. **Claims-Focused**: Emphasizes insurer's claim track record (25% weight on claim performance)

### Why it matters
Different users care about different things. A young healthy person might use "cost_focused", while someone with pre-existing diseases might use "claims_focused".

### Critical Rule
**All weights must sum to exactly 100.** The validation script checks this.

---

## Scoring Dimensions

**What it stores:** The individual components we score (like "coverage adequacy", "cost efficiency").

### Fields

| Field | What it means | Example |
|-------|---------------|---------|
| **id** | Dimension identifier | `"coverage_adequacy"`, `"cost"`, `"insurer_claim_performance"` |
| **displayName** | User-friendly name | `"Coverage Adequacy"` |
| **description** | What this measures | `"Evaluates if the sum insured is sufficient for typical Indian hospital costs..."` |
| **scoringCurve** | How to convert values to scores (JSON) | `{"bands": [{"max": 300000, "score": 15, ...}]}` |
| **sourceCitation** | Where the methodology came from | `"Research §9.2.1"` |

### The 10 Dimensions

1. **coverage_adequacy**: Is the sum insured enough?
2. **cost**: Premium per lakh of cover, co-pays, deductibles
3. **waiting_periods**: PED, initial, disease-specific waits
4. **exclusions_sublimits**: Room rent caps, sub-limits
5. **maternity_family_fit**: Maternity coverage, family benefits
6. **insurer_claim_performance**: CSR + ICR + processing times
7. **insurer_complaint_rate**: Normalized complaints and Ombudsman awards
8. **insurer_financial_health**: Solvency ratio, profitability trend
9. **network_strength**: Hospital count, geographic distribution, app ratings
10. **renewal_terms**: Lifetime renewability, portability, repricing behavior

### Why it matters
Each dimension gets a score from 0-100. We multiply by the weight from the scoring profile to get the final policy score.

---

## Glossary Terms

**What it stores:** Insurance vocabulary with definitions and examples for users.

### Fields

| Field | What it means | Example |
|-------|---------------|---------|
| **term** | The term identifier | `"co_pay"`, `"icr"`, `"ped"` |
| **language** | Language code | `"EN"` (English), `"HI"` (Hindi - placeholder for future) |
| **displayName** | How to show it | `"Co-payment (Co-pay)"` |
| **shortDefinition** | Tooltip text (1 sentence) | `"A percentage of the claim amount that you must pay..."` |
| **longDefinition** | Full explanation (paragraph) | `"Co-payment (or co-pay) is a cost-sharing mechanism where you pay a fixed percentage..."` |
| **example** | Real-world example | `"With a 20% co-pay clause, if your hospital bill is ₹2 lakh, you pay ₹40,000..."` |
| **relatedTerms** | Links to other terms (JSON array) | `["deductible", "sum_insured", "sub_limit"]` |

### Why it matters
When users see terms like "ICR" or "PED" in the comparison, they can click for a tooltip (short definition) or open a glossary panel (long definition with example).

---

## Educational Facts

**What it stores:** Interesting facts and tips to educate users (shown on loading screens, tooltips).

### Fields

| Field | What it means | Example |
|-------|---------------|---------|
| **id** | Auto-generated unique number | `1`, `2`, `3`... |
| **factText** | The fact | `"IRDAI capped pre-existing disease waiting periods at 36 months as of 2024."` |
| **category** | Type of fact | `"regulatory"`, `"consumer_traps"`, `"industry_stats"`, `"tip"` |
| **sourceCitation** | Where it came from | `"Research §10.5"` |
| **language** | Language code | `"EN"` |

### Categories

- **regulatory**: IRDAI rules and regulations
- **consumer_traps**: Common mistakes or hidden issues
- **industry_stats**: Interesting numbers about the industry
- **tip**: Practical advice for users

### Why it matters
These facts make the tool educational, not just transactional. Users learn about insurance while comparing policies.

---

## Unresolved Insurers

**What it stores:** Insurer names from PDFs that we couldn't match to our database (for manual review).

### Fields

| Field | What it means | Example |
|-------|---------------|---------|
| **id** | Auto-generated unique number | `1`, `2`, `3`... |
| **extractedText** | What we found in the PDF | `"SBI Life Insurance"` |
| **attemptedAt** | When we tried to match it | `"2026-04-27T10:30:00Z"` |
| **resolvedInsurerId** | If we later matched it | `"sbi-general"` (or null if still unresolved) |

### Why it matters
When PDF extraction finds "SBI Life", our resolver returns null (because it's a life insurer, not health). We log it here so someone can review and decide if we need to add it or if it's correctly rejected.

---

## Data Freshness

**What it stores:** Metadata about when the data was last updated.

### Fields

| Field | What it means | Example |
|-------|---------------|---------|
| **id** | Always 1 (single row) | `1` |
| **dataLastRefreshed** | When we last updated | `"2026-04-27"` |
| **irdaiAnnualReportYear** | Latest IRDAI report we used | `"FY 2023-24"` |
| **researchDocVersion** | Research document date | `"2026-04-27"` |
| **nextScheduledRefresh** | When to update next | `"2026-10-01"` |

### Why it matters
The frontend shows "Data current as of [date]" to users. This table provides that date. It also helps us track when we're overdue for a refresh.

---

## Data Update Workflow (For Quarterly Refreshes)

When new IRDAI data is released:

1. **Update research document** (`research/insurer-data-bank.md`)
   - Add new fiscal year sections
   - Update metric values
   - Add new insurers if any

2. **Update seed JSON files** (`src/data/seed/*.json`)
   - `sector-benchmarks.json`: Add new FY rows
   - `insurer-metrics.json`: Add new insurer data
   - `insurers.json`: Add new insurers or update former names
   - `educational-facts.json`: Add new regulatory changes

3. **Run refresh**
   ```bash
   npm run seed:refresh
   ```

4. **Validate**
   ```bash
   npm run validate
   ```
   - Check that all weights sum to 100
   - Check that all citations are present
   - Check that no future dates exist

5. **Test**
   ```bash
   npm test
   ```

6. **Update Data Freshness**
   - Update `dataLastRefreshed` to today
   - Update `irdaiAnnualReportYear` to new FY
   - Update `nextScheduledRefresh` to next quarter

7. **Commit**
   ```bash
   git add .
   git commit -m "Data refresh: FY 2024-25 IRDAI Annual Report"
   git push
   ```

---

## Common Questions

### Q: Why are some metrics missing for certain insurers?
**A:** If IRDAI or reliable sources don't publish that data, we don't add a row. Missing data is better than made-up data. The frontend will show "Data not available".

### Q: Why do some metrics have LOW confidence?
**A:** Network hospital counts, for example, are self-reported by insurers and not audited by IRDAI. We include them because users want to know, but we mark them as LOW confidence.

### Q: What's the difference between OFFICIAL_IRDAI and JOURNALISTIC_DERIVED?
**A:** 
- **OFFICIAL_IRDAI**: Direct from IRDAI Annual Reports or Handbooks (HIGH confidence)
- **JOURNALISTIC_DERIVED**: Comparison portals (Policybazaar, PolicyX) computed from IRDAI data (MEDIUM confidence)
- **INSURER_SELF_REPORTED**: Insurer marketing claims (LOW confidence)

### Q: Why do we track former names?
**A:** When a user uploads a policy PDF from 2020 that says "Max Bupa", we need to match it to "Niva Bupa" (the current name). Former names make this possible.

### Q: What if I find an error in the data?
**A:** 
1. Check the `sourceCitation` field to see where it came from
2. Verify against the original source (IRDAI report, research document)
3. If it's wrong, update the seed JSON file
4. Run `npm run seed:refresh` and `npm run validate`
5. Commit the fix with a clear message

---

## Need Help?

- **For data questions**: Check the research document in `research/insurer-data-bank.md`
- **For technical questions**: See `README.md`
- **For validation errors**: Run `npm run validate` to see what's wrong

---

**Last updated:** 2026-04-27  
**Data version:** FY 2023-24 IRDAI Annual Report
