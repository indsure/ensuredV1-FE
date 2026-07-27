# Insurer Performance Data Bank for Indian Health Insurance (FY 2022-23 to FY 2024-25 Snapshot)
**Research date:** 27 April 2026  
**Primary focus FYs:** 2022-23, 2023-24, early signals for 2024-25 where available

***
## 1. Scope, Caveats and Data Gaps
### 1.1 Objective
This document outlines a practical, auditable blueprint for an **Insurer Performance Data Bank** to support an AI‑assisted Indian health insurance comparison tool, with:

- A working list of insurers and categories (SAHI, general, PSU).[^1][^2]
- Pinned, regulator‑sourced aggregate metrics (ICR, solvency, grievance data) at sector and segment level.[^3][^4]
- Select insurer‑level examples from reputable aggregators clearly marked as **journalistic** rather than official.[^5][^6][^7]
- A framework for metrics, interpretation, scoring, data refresh, and regulatory guardrails.
### 1.2 Critical caveats
1. **IRDAI data lag and granularity**  
   - IRDAI Annual Reports and Handbooks are typically released **6–9 months after FY end**; the FY 2023‑24 Annual Report is already being cited by media in December 2024, i.e., roughly 8–9 months after March 2024.[^8][^4]
   - Public PDFs provide **segment‑wise and sometimes insurer‑wise tables**, but not always split cleanly by _health‑only_ vs other non‑life lines; in several places, only aggregate non‑life numbers are available.[^3][^4]

2. **Insurer‑level vs product‑level limitation**  
   - IRDAI discloses **insurer‑level** incurred claims ratios, solvency, and segment splits (health, motor, fire, etc.) but **does not publish product‑level claim statistics**.[^4][^3]
   - Comparison portals and broker blogs occasionally report **plan‑wise anecdotes or internal claim stats**, but these are **not official** and must be explicitly labelled journalistic.[^6][^9]

3. **Complaint data visibility**  
   - The **Bima Bharosa/IGMS portal** is designed for registration and tracking of individual grievances and as a central repository for IRDAI supervision, but it does **not expose a public, downloadable insurer‑wise statistical API**; aggregate complaint statistics appear in IRDAI Annual Reports and CIO (Ombudsman) Annual Reports.[^10][^11][^12]

4. **This document is a blueprint plus partial population**  
   - Some metrics (e.g., ICR by sector, overall complaint volumes, Ombudsman award counts) are populated for **industry and segment level** using IRDAI‑based media summaries and CIO’s annual report.[^11][^3][^4]
   - Full **company‑wise tables for every metric** would require systematic parsing of multiple IRDAI PDFs (Annual Report, Handbook, insurer disclosures). That step is better implemented as a data‑engineering pipeline than a one‑off manual exercise.

Where data is missing, the tables below explicitly mark **“Not publicly available in aggregated form”** or **“Not extracted – requires PDF table ingestion pipeline”** rather than interpolating or guessing.

***
## 2. Insurer List and Categorisation (FY 2024‑25)
### 2.1 Standalone health insurers (SAHI)
IRDAI and multiple industry summaries confirm that India has a dedicated category of **standalone health insurers** focused only on health, accident and travel; they are distinct from life and general insurers.[^1][^9]

Reputable sources and IRDAI‑aligned lists indicate the following SAHIs as of FY 2024‑25 (including recent entrants):[^13][^6][^9][^1]

| Category | Insurer (registered name) | Common brand/marketing name | Notes on history / rebranding |
|---------|---------------------------|------------------------------|-------------------------------|
| SAHI | Star Health and Allied Insurance Co. Ltd. | Star Health | Long‑standing SAHI, listed company, one of the largest retail health players.[^6] |
| SAHI | Niva Bupa Health Insurance Company Ltd. | Niva Bupa (formerly Max Bupa) | Rebranded from Max Bupa after change in shareholding; continues as SAHI.[^13][^6] |
| SAHI | Care Health Insurance Ltd. | Care Health (earlier Religare Health) | Previously known as Religare Health Insurance; rebranded as Care Health.[^5] |
| SAHI | Aditya Birla Health Insurance Co. Ltd. | Aditya Birla Health | Joint venture in Aditya Birla group; health‑only insurer.[^5] |
| SAHI | ManipalCigna Health Insurance Company Ltd. | ManipalCigna | JV between Manipal group and Cigna; health‑only.[^5] |
| SAHI | Narayana Health Insurance (exact legal name under registration) | Narayana Health Insurance | New SAHI authorised in FY 2023‑24 as per IRDAI Annual Report summary.[^8] |
| SAHI | Galaxy Health and Allied Insurance Company Ltd. | Galaxy Health | Newer SAHI mentioned in comparison portals drawing from IRDAI data; early‑stage operations.[^6] |

**Data gaps:**  
- Official IRDAI “List of Insurers” pages are dynamically generated; direct PDF export for 2024‑25 was not retrievable in this research run. The above list is cross‑checked against multiple secondary sources that reference IRDAI.[^6][^13][^1]
### 2.2 General insurers with retail health portfolios
Multiple sources list IRDAI‑registered general insurers offering health along with motor, fire, etc.[^13][^1][^14]

**Major private general insurers with significant health portfolios:**

| Insurer (registered name) | Common brand | Notes (health portfolio) |
|---------------------------|-------------|--------------------------|
| ICICI Lombard General Insurance Co. Ltd. | ICICI Lombard | Large private general insurer with wide health product suite.[^13] |
| HDFC ERGO General Insurance Co. Ltd. | HDFC ERGO | Absorbed erstwhile Apollo Munich Health Insurance (HDFC ERGO Health) via merger; offers wide health range.[^13][^1] |
| Bajaj Allianz General Insurance Co. Ltd. | Bajaj Allianz General | Significant share in retail and corporate health.[^13] |
| Tata AIG General Insurance Co. Ltd. | Tata AIG | Active in retail and SME health.[^13] |
| SBI General Insurance Co. Ltd. | SBI General | Large bancassurance‑driven health book.[^13] |
| Reliance General Insurance Co. Ltd. | Reliance General | Retail health and group health portfolio.[^13] |
| Future Generali India Insurance Co. Ltd. | Future Generali | Retail health presence.[^13] |
| Kotak Mahindra General Insurance Co. Ltd. | Kotak General | Retail and group health.[^13] |
| Acko General Insurance Ltd. | ACKO | Digital‑first general insurer disproportionately focused on motor and health.[^13] |
| Navi General Insurance Ltd. | Navi General | Digital general insurer with individual health offerings.[^13] |
| Zuno General Insurance Ltd. | Zuno (formerly Edelweiss General) | Rebranded from Edelweiss General; sells health among other lines.[^13] |
| Magma HDI General Insurance Co. Ltd. | Magma HDI | General insurer with health portfolio.[^13] |
| Liberty General Insurance Ltd. | Liberty General | General insurer with health products.[^13] |
| Raheja QBE General Insurance Co. Ltd. | Raheja QBE | Niche player, includes health.[^13] |
| Universal Sompo General Insurance Co. Ltd. | Universal Sompo | Multi‑line general insurer with health.[^7] |
### 2.3 Public sector general insurers (PSU non‑life)
Public sector non‑life insurers are explicitly recognised by IRDAI and widely referenced in official and journalistic summaries.[^15][^4]

| Insurer (registered name) | Common brand | Role in health |
|---------------------------|-------------|----------------|
| The New India Assurance Co. Ltd. | New India Assurance | Large PSU non‑life with substantial retail and group health book.[^15] |
| United India Insurance Co. Ltd. | United India | PSU non‑life with group and retail health.[^4] |
| The Oriental Insurance Co. Ltd. | Oriental Insurance | PSU non‑life with health portfolio.[^4] |
| National Insurance Co. Ltd. | National Insurance | PSU non‑life with health portfolio.[^4] |
### 2.4 Selected founding years and brand notes (illustrative)
Secondary compilations (insurer lists and company profiles) give founding years and headquarters; these are **not IRDAI primary data** but useful context.[^13][^14]

| Insurer | Type | Founding / incorporation year in India | Notes |
|--------|------|------------------------------------------|-------|
| Star Health & Allied Insurance Co. Ltd. | SAHI | 2006 | First major private SAHI, later listed.[^6] |
| Niva Bupa Health Insurance Co. Ltd. | SAHI | 2008 | Entered as Max Bupa; rebranded after change in shareholding.[^13] |
| Care Health Insurance Ltd. | SAHI | 2012 (as Religare) | Rebranded to Care Health.[^5] |
| Aditya Birla Health Insurance Co. Ltd. | SAHI | 2015 | Joint venture; health‑only.[^5] |
| ManipalCigna Health Insurance Co. Ltd. | SAHI | 2014 | JV; health‑only.[^5] |
| ICICI Lombard General Insurance Co. Ltd. | General | 2001 | Multi‑line non‑life including health.[^13] |
| HDFC ERGO General Insurance Co. Ltd. | General | 2002 | Merged with Apollo Munich Health (rebranded HDFC ERGO Health). This is a rebrand/absorption, not a fresh licence.[^13][^1] |
| The New India Assurance Co. Ltd. | PSU | 1919 | Oldest PSU non‑life; large group and retail health presence.[^13] |

A fully populated founding‑year table for all insurers would require cross‑checking MCA/insurer annual reports; this is out of scope for the current pass but can be added as a separate enrichment step.

***
## 3. Core Claim and ICR Metrics (Framework + Available Aggregates)
### 3.1 Official IRDAI incurred claim ratio (ICR) aggregates
IRDAI Annual Report 2023‑24, as reported by multiple business publications, provides **net incurred claims to net earned premium (ICR)** for the overall non‑life sector and major subsectors.[^3][^4][^16]

| Segment (non‑life) | ICR FY 2022‑23 | ICR FY 2023‑24 | Notes / implications |
|--------------------|----------------|----------------|----------------------|
| Overall non‑life (including health, motor, etc.) | 82.95% | 82.52% | Slight improvement; sector returned to profit in FY24 after loss in FY23.[^3][^4] |
| Public sector general insurers (aggregate) | 99.02% | 97.23% | Very high ICR indicates underwriting strain; still close to or above 100%.[^3][^4] |
| Private sector general insurers (aggregate) | 75.13% | 76.49% | Healthy range; slightly higher than previous year.[^3][^4] |
| Standalone health insurers (aggregate) | 61.44% | 63.63% | Health‑only portfolios; lower ICR leaves more margin but can raise questions on pricing/denials if too low.[^4][^17] |
| Specialised insurers (ECGC, etc.) | 73.71% | 66.58% | Niche; not directly relevant to retail health.[^4] |

**Nature of data:** Official IRDAI data, cited through secondary summaries (ET BFSI, AffairsCloud, PTI syndication), which quote directly from the Annual Report 2023‑24.[^4][^16][^3]

**Data gaps:** Company‑wise ICR specifically for **health business only** (not overall non‑life) is published in IRDAI’s detailed tables but requires PDF table extraction; not reproduced here.
### 3.2 Standalone health insurers – incurred claim ratios (journalistic extracts)
Several comparison portals present insurer‑wise ICR for SAHIs, explicitly citing IRDAI as the underlying source but repackaged for consumers.[^5][^6]

**Example: SAHIs – ICR FY 2022‑23 / 2023‑24 (illustrative)**

| Insurer | ICR FY 2022‑23 | ICR FY 2023‑24 | Source type |
|--------|-----------------|----------------|-------------|
| Aditya Birla Health Insurance | ~64–65% (varies slightly across portals) | 68.31% (Policybazaar Data Lab / PolicyX referencing IRDAI) | Journalistic / aggregator based on IRDAI.[^6][^5][^7] |
| Care Health Insurance | 53.82% (FY 2022‑23) | 57.69% (FY 2023‑24) | Journalistic; ICR table compiled from IRDAI.[^6][^5] |
| Niva Bupa Health Insurance | ~59% in FY 2023‑24 | Earlier years around mid‑50s | Journalistic aggregation.[^6][^5] |
| Star Health & Allied Insurance | ~65–66% | ~66.47% FY 2023‑24 | Journalistic aggregation using IRDAI.[^6] |
| ManipalCigna Health Insurance | ~64–65% | ~63–65% | Journalistic; small variations across portals.[^6][^5] |

These values should be **treated as “derived from IRDAI, via portal”** and used only for relative context, not for regulatory filings.
### 3.3 Claim settlement ratios (CSR) – count‑based (journalistic)
IRDAI does not typically spotlight **health‑only CSR by count** in public consumer‑facing tables; portals therefore build their own rankings using IRDAI claim statistics.[^18][^7]

**Example ranking – top health insurers by CSR (FY 2022‑23 to 2024‑25)**

| Insurer | Average CSR (FY 2022‑25) | CSR FY 2024‑25 (health/non‑life) | CSR FY 2023‑24 | CSR FY 2022‑23 | Source type |
|--------|--------------------------|-----------------------------------|----------------|----------------|-------------|
| New India Assurance (PSU) | 98.91% | 98.38% | 98.44% | 99.90% | Journalistic ranking derived from IRDAI data.[^18] |
| Digit (Go Digit General/Health) | 98.66% | 98.98% | 98.83% | 98.18% | Journalistic.[^18] |
| Bajaj Allianz General Insurance | 96.78% | 97.32% | 96.16% | 96.85% | Journalistic.[^18] |
| HDFC ERGO | 96.71% | 97.45% | 97.19% | 95.49% | Journalistic.[^18] |
| ACKO General / Health | 96.50% | 95.75% | 96.31% | 97.45% | Journalistic.[^18] |
| SBI General Insurance | 96.14% | 96.13% | 98.08% | 94.20% | Journalistic.[^18] |
| Aditya Birla Health Insurance | 95.81% | 95.88% | 95.61% | 95.95% | Journalistic.[^18] |
| National Insurance (PSU) | 94.61% | 93.56% | 94.68% | 95.60% | Journalistic.[^18] |
| Universal Sompo | 94.20% | 89.21% | 93.39% | 100% | Journalistic.[^18] |
| United India Insurance (PSU) | 93.79% | 95.92% | 92.72% | 92.72% | Journalistic.[^18] |

These numbers are useful for **relative ranking** in a consumer tool but should be labelled as **“CSR (portal computed from IRDAI data)”**, not as directly scraped IRDAI output.
### 3.4 Claim rejection/repudiation and CSR by value
- IRDAI’s 2023‑24 Annual Report, as summarised in business media, notes that health insurers **disallowed claims worth about ₹15,100 crore in FY24**, highlighting the aggregate value of rejections but not an insurer‑wise breakdown.[^19][^20][^21]
- These reports state that the **claims ratio declined slightly** while total non‑life premium and incurred claims grew, indicating a rising volume of claims but relatively controlled payouts.[^3][^4]

Publicly available sources do **not yet provide a standardised, company‑wise “CSR by value” table** for health insurers. This metric will likely need to be approximated from IRDAI’s detailed claim tables (paid vs claimed amounts) in a dedicated data‑engineering step.
### 3.5 Average claim processing time & cashless ratios
- IRDAI regulations generally require **claim decisions within 30 days** of receipt of all documents, with penal interest if delayed.[^22]
- Many leading health insurers state on their own websites or in FAQs that **cashless authorisation decisions are typically targeted within 2–4 hours**, but there is **no central IRDAI table** of average processing times per insurer.[^22]
- Similarly, **cashless approval ratios** (% of pre‑auth requests approved) are seldom disclosed on a per‑insurer public basis; comparison portals and hospital networks may occasionally quote network‑level approvals but this is not standard, auditable data.

**Conclusion for Section 3:**  
- The **most robust, officially disclosed metric** at insurer/segment level is **ICR** (claims paid vs premium), with sector and category splits available.[^3][^4]
- CSR by count and any “CSR by value” are largely **portal‑constructed**; use these with clear labelling as journalistic/derived.

***
## 4. Complaint and Grievance Data
### 4.1 Bima Bharosa / IGMS – system description
IRDAI’s **Bima Bharosa portal** (Integrated Grievance Management System, IGMS) is a centralised online system to register policyholder complaints, route them to insurers, and monitor resolution.[^10][^12][^23]

Key points:

- It captures complaints received through **online portal, email, IRDAI call centre and physical submissions**, and mirrors status between insurer systems and IRDAI’s repository.[^12][^10]
- It covers **life, general and standalone health insurers**, with IRDAI using the data to monitor adherence to grievance redress timelines and policyholder protection regulations.[^10][^12]
- Public descriptions emphasise transparency and standardisation but **do not expose raw, insurer‑wise complaint rates** for bulk download.[^12][^10]
### 4.2 Aggregate complaint trends
Recent commentary based on IRDAI data and CIO reports notes a **sharp rise in health‑related grievances**, especially around claim repudiation and delays.[^24][^25][^26]

Examples:

- A LinkedIn summary of IRDAI’s 2024‑25 grievance data (ET BFSI) mentions health insurance complaints rising by roughly **14–15% year‑on‑year**, with claim‑related issues dominating.[^25][^26]
- Ditto Insurance’s explainer on Bima Bharosa states that in **FY 2024‑25, about 69% of insurance sector grievances were claim‑related**, underscoring that claim service is the main pain point.[^24]

These are **journalistic interpretations of IRDAI data** and should be tagged accordingly.
### 4.3 Ombudsman complaint and award statistics (all insurers)
The **Council for Insurance Ombudsmen (CIO)** Annual Report 2023‑24 provides sector‑wide statistics across life, general and health complaints.[^11]

**Aggregate Ombudsman statistics FY 2023‑24:**

| Metric | Value | Notes |
|--------|-------|-------|
| Total complaints received (all lines) | 52,575 | Across 17 Ombudsman centres in FY 2023‑24.[^11] |
| Total complaints disposed | 49,705 | Of which 12,855 were non‑entertainable.[^11] |
| Entertainable complaints disposed | 36,850 | Complaints that met jurisdiction criteria.[^11] |
| Complaints resolved by Recommendation (mediation) | 15,528 | About 42% of entertainable complaints.[^11] |
| Complaints resolved by Award (formal decision) | 7,202 | Across life, general and health combined (derived from tables summarised in the report). |
| Complaints disposed within 90 days | ~87% | Reflects strong emphasis on timeliness.[^11] |

**Breakdown by insurance type (illustrative figures from report summary):**[^11]

| Line of business | Complaints received | Complaints disposed | Entertainable disposed |
|------------------|---------------------|---------------------|------------------------|
| Life insurance | 16,252 | 15,564 | 12,249 |
| General insurance | 4,833 | 4,735 | 2,760 |
| Health insurance | 31,490 | 29,406 | 24,663 |

> Note: The exact insurer‑wise counts (e.g., Star Health vs Niva Bupa complaints) appear in detailed tables (L/G/H series) in the Ombudsman report but were not fully extractable in this research run; those tables would need to be parsed via a PDF‑to‑table pipeline.
### 4.4 What is missing for per‑insurer complaint metrics
For the **data bank** you envisage (complaints per 10,000 policies, per ₹1 crore premium):

- **IRDAI Annual Report** and related handbooks do publish **industry‑wide complaint counts** and sometimes insurer‑wise data, but not always normalised by policies or premium in consumer‑friendly form.[^3][^4]
- **Ombudsman reports** focus on complaints that have already passed through insurers and IGMS; they are not a complete view of all grievances but a **dispute‑escalation subset**.[^11]

A production‑grade implementation should therefore:

1. **Ingest IRDAI Annual Report and Handbook PDFs** yearly.  
2. Extract insurer‑wise complaint counts and premium/policy counts where available.  
3. Compute **complaints per 10,000 policies** and **complaints per ₹1 crore premium** internally.  
4. Expose these as **derived metrics tagged as “computed from IRDAI tables”**.

***
## 5. Financial Health and Solvency (Framework)
### 5.1 Solvency ratio – regulatory minimum and sector aggregates
- IRDAI prescribes a **minimum solvency ratio of 1.50** (Available Solvency Margin / Required Solvency Margin) for all insurers.[^27]
- Legal and regulatory analyses referencing IRDAI’s **Handbook on Indian Insurance Statistics 2023‑24** confirm that non‑life and health insurers generally maintain solvency above this floor, with occasional stress at some PSUs.[^27]

However, **company‑wise solvency ratios** are typically disclosed in insurers’ own annual reports and IRDAI filings rather than a single consolidated table. The data bank should therefore:

- Pull solvency ratios from **insurer annual reports and/or IRDAI’s insurer‑wise solvency tables**.  
- Tag them as **official IRDAI/supervisory filings** rather than journalistic.
### 5.2 Gross written premium (GWP) and growth
IRDAI’s FY 2023‑24 Annual Report shows:[^3][^15][^4]

| Metric | FY 2022‑23 | FY 2023‑24 | Notes |
|--------|-----------|-----------|-------|
| Total non‑life GWP | ~₹2.57 lakh crore | ₹2.90 lakh crore | 12.76% growth year‑on‑year, driven primarily by health and motor.[^3][^4] |
| Public sector general insurers GWP | ₹82,891 crore | ₹90,252 crore | 8.88% growth.[^4] |
| Private sector + SAHIs GWP | ₹1.58 lakh crore | ₹1.88 lakh crore | Stronger growth than PSUs.[^4] |

Company‑wise GWP (health segment) is available in IRDAI tables but not reproduced here; again, this is an ingestion problem, not a theoretical one.
### 5.3 Underwriting profit / loss and sector profitability
The same IRDAI report (via AffairsCloud and ET BFSI summaries) highlights:[^4][^16]

- The combined non‑life sector moved from **net loss of about ₹2,566 crore in FY 2022‑23** to **net profit of about ₹10,119 crore in FY 2023‑24**, reflecting improved underwriting and investment performance.[^4]
- Public sector insurers still show relatively high ICRs near 100%, while private and SAHI segments are more profitable.[^3][^4]

For your data bank, underwriting profit/loss should ideally be captured **per insurer** from IRDAI and company reports and then expressed as:

- Underwriting result (₹ crore).  
- Underwriting margin (underwriting profit / net premium earned).  
- 3‑year trend (improving / deteriorating).
### 5.4 Regulatory actions
IRDAI periodically publishes **orders, fines and directions** on its website. Example categories include:[^1]

- Penalties for **policyholder protection violations**, mis‑selling, non‑compliance with product filing norms.  
- Directions regarding **solvency support, business restrictions or corrective action plans**.

A robust data bank should maintain a **“regulatory actions” log** with:

- Date of order, IRDAI order reference number and URL.  
- Nature of action (fine, warning, suspension of product sales, etc.).  
- A short, neutral summary.

This log was not fully populated here because it requires targeted crawling of IRDAI’s orders/press release repository.

***
## 6. Network and Operational Data (What Is Publicly Visible)
### 6.1 Network hospital counts
Comparison portals and insurer sites routinely advertise **network hospital counts**; for example:[^5][^6]

| Insurer | Approx. network hospitals (as advertised) | Source type |
|--------|-------------------------------------------|------------|
| Star Health | 14,000+ | Insurer/portal marketing, not IRDAI.[^5][^6] |
| Aditya Birla Health | 11,000+ | Portal citing insurer.[^5] |
| Niva Bupa | 10,000+ | Portal citing insurer.[^5] |
| Care Health | 9,700+ | Portal citing insurer.[^5] |
| ManipalCigna | 8,700+ | Portal citing insurer.[^5] |

These numbers are **not audited by IRDAI** and change frequently as hospitals join/exit networks; they should be stored with:

- The **as‑of date** (e.g., portal page update date).  
- A tag **“insurer self‑reported / portal‑reproduced figure”**.
### 6.2 Geographic coverage and operational UX
There is no single, authoritative IRDAI metric for “pan‑India coverage quality”. You will likely rely on:

- **Hospital network distribution** by city tier, if insurers disclose it (usually not in structured form).  
- **App store ratings** for insurer apps; these can be scraped from Play Store and App Store and updated periodically.  
- **Review aggregators and social media sentiment** (e.g., Google Play reviews complaining about cashless approvals, documentation hassles). These are **subjective** and must be kept clearly separate from official statistics.

***
## 7. Product‑Level Data (Top Plans)
Industry round‑ups for “top health insurance plans” are inherently **editorial**. For example, 2025–26 lists of top 10 plans reference products like Star Health Family Health Optima, HDFC ERGO Optima Restore, Niva Bupa ReAssure, Care Advantage, etc., based on coverage features, pricing and brand perception.[^28]

Key points for the data bank:

- Product‑level information such as **sum insured bands, premium illustrations, waiting periods, sub‑limits, restoration and no‑claim bonus** is available in:  
  - IRDAI‑filed prospectuses and customer information sheets (CIS).  
  - Insurer websites and product brochures (marketing plus regulatory).  
- **Product‑wise claim experience** is almost never disclosed; only insurer‑level aggregates exist.[^3][^4]

Therefore the product‑level layer in your tool should focus on:

- Structured extraction from **policy wordings and CIS**.  
- **Not** attempting any pseudo “plan‑wise claim ratio”.

***
## 8. Interpretation Framework for Key Metrics
The table below gives practical interpretation for consumers and advisors, along with suggested threshold bands. These thresholds are based on a mix of industry commentary and actuarial common sense, not on a specific IRDAI prescription.[^9][^29]
### 8.1 Claim settlement ratio by count (CSR – journalistic)
| Aspect | Guidance |
|--------|----------|
| What it means | Share of claims **by number** that the insurer settles (fully or partially) versus total claims received in a period. High CSR suggests most claims eventually get paid. |
| Why it matters | Proxy for ease of getting a claim accepted; extremes need careful reading with complaint data and ICR. |
| Excellent | >97% (especially over a multi‑year average). |
| Good | 92–97%. |
| Concerning | 85–92%. |
| Red flag | <85%. |
| Misinterpretations | High CSR may hide **low ticket, easy claims** being paid, while **high‑value** claims face friction; must be cross‑checked against ICR, complaint rates and Ombudsman awards. |
### 8.2 Incurred claim ratio (ICR)
| Aspect | Guidance |
|--------|----------|
| What it means | Ratio of claims paid (including outstanding) to premium earned. Represents how much of premium flows back as claims. |
| Why it matters | Indicates balance between **pricing adequacy** and **willingness to pay**. Extremely low ICR may indicate aggressive pricing or denials; extremely high ICR suggests financial strain. |
| Healthy range (retail health) | Roughly 70–100% is considered a reasonable band; SAHIs aggregate around low‑60s while PSUs often run close to or above 90–100% on overall non‑life business.[^3][^4][^17] |
| Excellent (for consumers) | 80–95% with stable solvency and no major complaints – suggests the insurer pays a large share of premium as claims while remaining financially sound. |
| Concerning (too low) | <60% for multiple years in a relatively homogeneous retail book. Could suggest tight underwriting or high repudiation. |
| Concerning (too high) | >105% for multiple years without capital infusion; could lead to repricing or service issues. |
| Misinterpretations | ICR is **portfolio‑level**; a high ICR may be driven by a couple of corporate/group contracts rather than retail health. It does not directly tell an individual what will happen to their own claim. |
### 8.3 Complaint rates and Ombudsman awards
| Aspect | Guidance |
|--------|----------|
| Complaints per 10,000 policies | Normalises complaint volume; high value suggests frequent friction even if CSR is good. |
| Complaints per ₹1 crore premium | Alternative normalisation; highlights friction relative to business size. |
| Ombudsman awards in favour of policyholders | Shows how often insurer positions are overturned at final escalation; a persistent pattern is a red flag about fairness. |
| Excellent | Low normalised complaint rate, low share of awards against insurer, few repeated issues. |
| Concerning | High complaint rate, high proportion of claim‑related issues, and above‑average Ombudsman awards against the insurer. |
| Misinterpretations | Ombudsman data is a **tip of the iceberg** – only a fraction of unhappy customers escalate; low Ombudsman cases may reflect lack of awareness as much as good service. |
### 8.4 Solvency ratio
| Aspect | Guidance |
|--------|----------|
| What it means | Ratio of available capital to required capital for current underwritten risks; IRDAI minimum is 1.50.[^27] |
| Why it matters | Ensures insurer can withstand adverse claim experience and continue honouring future claims. |
| Excellent | >2.0 with stable or improving trend. |
| Adequate | 1.5–2.0. |
| Concerning | Consistently close to 1.5 or declining trend. |
| Red flag | Below 1.5 – typically triggers supervisory intervention. |
### 8.5 Network and digital UX
| Metric | Guidance |
|--------|----------|
| Network hospital count | More is better only if **distributed geographically**; a big number concentrated in metros may not help a tier‑3 customer. |
| App rating & reviews | Persistent complaints about claim submission, approvals or cashless denials are qualitative red flags. |

***
## 9. Scoring Methodology Blueprint
This section focuses on **design**, not specific numeric fill‑in, so that your data bank can support a transparent 0–100 score per policy.
### 9.1 Dimension weights (profiles)
The exact weights are a product decision, but the following ranges are grounded in common financial‑planning practice and consumer‑education content.[^9][^29]

#### 9.1.1 Default balanced profile (0–100 overall)

Suggested weights:

- Coverage adequacy (sum insured vs need): **20%**.  
- Cost (premium + co‑pay/deductible structure): **15%**.  
- Waiting periods (PED, maternity, specific diseases): **10%**.  
- Exclusions and sub‑limits: **10%**.  
- Maternity/family fit (if relevant to case): **5%**.  
- Insurer claim performance (CSR by count + ICR): **15%**.  
- Insurer complaint rate (normalised): **10%**.  
- Insurer financial health (solvency + underwriting stability): **5%**.  
- Network strength and digital UX: **5%**.  
- Renewal terms (lifetime renewability, portability friendliness, repricing behaviour): **5%**.

#### 9.1.2 Cost‑prioritised profile

- Coverage adequacy: 15%.  
- Cost: **30%**.  
- Waiting periods: 10%.  
- Exclusions/sub‑limits: 10%.  
- Maternity/family fit: 5%.  
- Claim performance: 10%.  
- Complaint rate: 5%.  
- Financial health: 5%.  
- Network strength & UX: 5%.  
- Renewal terms: 5%.

#### 9.1.3 Coverage‑prioritised profile

- Coverage adequacy: **30%**.  
- Cost: 10%.  
- Waiting periods: 15%.  
- Exclusions/sub‑limits: 15%.  
- Maternity/family fit: 10%.  
- Claim performance: 10%.  
- Complaint rate: 5%.  
- Financial health: 3%.  
- Network strength & UX: 2%.  
- Renewal terms: 0–5% (depending on UX weight).

#### 9.1.4 Claims‑experience‑prioritised profile

For users with significant PEDs, older ages or imminent surgery needs:

- Coverage adequacy: 20%.  
- Cost: 10%.  
- Waiting periods: 15%.  
- Exclusions/sub‑limits: 10%.  
- Maternity/family fit: 0–5% (lower weight).  
- **Insurer claim performance (CSR + ICR)**: **20–25%**.  
- **Insurer complaint rate**: **10–15%**.  
- Insurer financial health: 5–10%.  
- Network strength & UX: 5–10%.  
- Renewal terms: 5%.
### 9.2 Scoring within dimensions – illustrative curves
#### 9.2.1 Coverage adequacy vs typical Indian hospital costs

Recent articles on health‑care inflation indicate that hospitalisation costs for a **single serious episode in a metro private hospital** can easily exceed ₹3–5 lakh, with more complex surgeries going into ₹10 lakh+.[^28]

An approximate scoring grid for **base sum insured for an urban family of four**:

| Sum insured band | Coverage score (0–100) | Rationale |
|------------------|------------------------|-----------|
| <₹3 lakh | 10–20 | Barely adequate even for minor procedures in metros. |
| ₹3–5 lakh | 30–40 | May cover moderate hospitalisation; high risk of exhaustion in major events. |
| ₹5–10 lakh | 55–70 | Reasonable baseline for many middle‑class families. |
| ₹10–25 lakh | 80–90 | Good protection even for major surgeries in metros. |
| >₹25 lakh (including restoration/super‑top‑up) | 95–100 | Very strong risk cover for most scenarios. |

You can adjust for **city tier** (e.g., slightly lower thresholds for tier‑2/3) and **household income**.

#### 9.2.2 Cost dimension

Score based on **premium / sum insured ratio** and **cost‑sharing**:

- Compute annual premium per ₹1 lakh of cover at the user’s age and city.  
- Benchmark against the median for similar products (age, city, features).  
- Penalise for **high co‑pays** or **room‑rent caps** that shift effective cost back to the user.

#### 9.2.3 Claim performance dimension

Use a blended score from:

- Normalised multi‑year CSR by count (journalistic but relative).  
- Multi‑year ICR relative to peer segment (SAHI vs PSU vs private general).  
- Normalised complaint rate and Ombudsman award rate.

Example mapping:

| Combined signal (qualitative) | Score band |
|------------------------------|-----------|
| High CSR, healthy ICR (70–95%), low complaints, low Ombudsman awards | 85–100 |
| Good CSR, normal ICR, average complaints | 65–85 |
| OK CSR, low ICR (<60%) or high ICR (>105%), elevated complaints | 40–65 |
| Poor CSR, extreme ICR and high complaints/awards | 0–40 |
### 9.3 Handling missing data
Design principles:

1. **Never silently assume** – any imputed metric must be clearly labelled as “estimated” with confidence flags.  
2. **Minimum viable data for a policy verdict:**  
   - Sum insured and premium (per adult/child).  
   - Co‑pay/deductible and room‑rent caps.  
   - Waiting periods for PED and key diseases.  
   - Insurer identity (to attach insurer‑level performance data).  
3. If **critical policy‑level fields are missing** (e.g., exclusions, restoration rules), show **“insufficient data – needs full policy document”** rather than over‑confident scoring.
### 9.4 Handling trade‑offs and confidence
- When two policies score within **3–5 points**, present them as **“statistically similar – choose based on soft preferences (network, brand, features)”** rather than claiming one is definitively better.  
- Display a **confidence meter** driven by data completeness and recency:  
  - High: all key policy fields + recent insurer metrics (≤2 years old).  
  - Medium: quote‑level data only plus insurer metrics (no full wording parsed).  
  - Low: partial quote, some missing insurer metrics or stale data (>3 years old).

***
## 10. Regulatory Guardrails and DPDP
### 10.1 IRDAI advertising and comparison norms
IRDAI’s advertising regulations and policyholder protection norms, as summarised by industry legal analyses, emphasise:[^1][^27]

- Advertisements must be **fair, clear and not misleading**, with risks clearly disclosed.  
- Comparisons should be **accurate, factual and capable of substantiation**, and should not unfairly denigrate competitors.  
- Use of IRDAI logo or implying IRDAI “approval” of a product is prohibited.

For your tool, this implies:

- Focus on **data‑driven comparisons** (“insurer A’s ICR is X% vs segment average Y% in FY 2023‑24, per IRDAI Annual Report”) rather than qualitative labels like “worst insurer”.  
- Use neutral language: “lower than industry average”, “higher complaint rate than peers”, etc., with citations.
### 10.2 Advice vs analysis
The Indian regulatory environment distinguishes between:[^1]

- **Analysis/comparison**: Presenting data, rankings and scenario projections without prescribing a single action.  
- **Advice**: Recommending specific products as suitable for an individual’s circumstances, which may attract regulations around insurance distribution and investment advice.

Existing comparison platforms generally:[^1]

- Provide **quotes, feature comparisons and star ratings**.  
- Use disclaimers noting that they are **not providing personalised financial advice** and that users should consult advisors.  
- When they seem to “recommend”, it is usually within a **distribution framework** (they are licensed intermediaries themselves).

Your tool should:

- Frame outputs as **“analysis and decision support”**, not prescriptive recommendations, unless the entity operating it is appropriately licensed.  
- Include clear disclaimers on the difference between **algorithmic scores** and professional advice.
### 10.3 DPDP Act 2023 implications for document uploads
The **Digital Personal Data Protection Act 2023** classifies health and financial data in uploaded quotes/policies as **personal data (often sensitive)**, requiring:[^27]

- **Valid consent** specifying purpose (e.g., “to analyse and compare health insurance policies”).  
- Data minimisation and storage limitation – retain PII only as long as necessary for the stated purpose.  
- **User rights** to access, correction and deletion.  
- Secure processing and breach notification obligations.

Practically, the tool should:

- Implement **explicit consent flows** at upload (with clear wording).  
- Offer **one‑click deletion** of uploaded documents and extracted data.  
- Log processing activities and restrict internal access.  
- Anonymise or pseudonymise where possible when data is used for aggregate analytics.
### 10.4 Insurer pushback and defamation risk
If your rankings consistently place some insurers at the bottom, there is potential for **reputational disputes**. Other platforms mitigate this by:[^1][^9]

- Focusing on **positive lists** (“top 10 by CSR”, “plans with lowest waiting period”) rather than “worst insurers”.  
- Using language like “higher than average complaints” rather than “bad”.  
- Maintaining **transparent methodology** and data citations, so any insurer challenge can be answered with “this is your own IRDAI‑filed data”.  
- Including disclaimers that scores are **algorithmic and opinionated** and users must apply their own judgment.
### 10.5 Recent regulatory changes (2019–2025) relevant to comparison
Industry commentary on IRDAI reforms notes:[^1][^27]

- **Reduced maximum PED waiting periods**: IRDAI has moved to cap pre‑existing disease waiting periods (e.g., at 36 months) to make products more consumer‑friendly.  
- Introduction of **standard health products** like Arogya Sanjeevani and Saral Suraksha, with prescribed minimum features, making cross‑insurer comparison simpler.  
- Upcoming **Bima Sugam** platform intended as a unified marketplace and service platform for insurance policies; comparison tools will need to integrate or at least align with its data standards.  

These changes support **greater transparency and comparability**, reinforcing the value of a disciplined data bank.

***
## 11. Data Update Strategy
### 11.1 Source update frequencies and lags
| Source | Update frequency | Lag from FY end | Notes |
|--------|------------------|----------------|-------|
| IRDAI Annual Report | Yearly | ~6–9 months | Primary source for sector and insurer statistics (ICR, GWP, solvency, grievances). Summarised by media in Dec following FY end.[^8][^3][^4] |
| IRDAI Handbook on Indian Insurance Statistics | Yearly | Similar lag | More detailed historical series and insurer‑wise tables.[^27] |
| Bima Bharosa (IGMS) | Continuous | Real‑time for cases; aggregated annually in IRDAI reports | No public API; accessible through periodic publications.[^10][^12] |
| CIO (Ombudsman) Annual Report | Yearly | ~3–6 months | Insurer‑agnostic statistics on escalated complaints and awards.[^11] |
| Insurer annual reports & disclosures | Yearly (some quarterly highlights) | 3–6 months | Solvency, product changes, sometimes claim statistics. |
| Reputable financial publications (Mint, ET, Moneycontrol, etc.) | Daily/weekly | Near real‑time | Secondary but useful for **early pointers** to new IRDAI data and trends.[^3][^15] |
### 11.2 Cadence for your data bank
- **Annual deep refresh:** After IRDAI publishes its Annual Report and Handbook for a FY, rebuild all insurer‑level tables (ICR, complaint volumes, GWP, solvency, regulatory actions).  
- **Quarterly light refresh:**  
  - Update insurer **network hospital counts** and app ratings.  
  - Pull any **material regulatory orders**.  
  - Ingest newer product launches/withdrawals.  
- **Rolling refresh for product terms:** As policy wordings or regulatory circulars change (e.g., new PED caps), update parsing logic and flag earlier data as “pre‑change”.
### 11.3 APIs vs scraping
- There is **no widely documented free IRDAI API** for insurer statistics; most data comes in PDF or HTML reports.[^10][^27]
- Some third‑party platforms provide APIs, but these are typically commercial and may not match your data‑quality needs.  
- Expect to implement:  
  - **Scheduled PDF downloads** from IRDAI and CIO websites.  
  - Automated **table extraction** and schema mapping.  
  - Manual QA for outliers and schema changes.

***
## 12. Prioritising Metrics for Consumer Decisions
Given the sheer volume of possible metrics, the data bank should focus on **5–7 that drive most real‑world decisions**, with others as secondary.
### 12.1 High‑impact metrics
1. **Coverage adequacy** – sum insured and key feature limits relative to medical cost benchmarks.  
2. **Out‑of‑pocket exposure** – co‑pays, deductibles, room‑rent caps, sub‑limits.  
3. **Waiting periods and PED handling** – especially for common conditions.  
4. **Insurer claim performance** – multi‑year ICR plus CSR trend with clear source tagging.  
5. **Insurer complaint and escalation profile** – normalised complaint rate and Ombudsman award pattern.  
6. **Solvency and financial stability** – solvency ratio and underwriting consistency.  
7. **Network and service UX** – cashless availability in the user’s cities and digital claim experience.

Other metrics (e.g., agent mix, operating expense ratio) can be kept for advanced views but are less central for retail consumers.

***
## 13. Honest Limitations to Surface in the Tool
The front‑end product should make the following limitations explicit:

- **Data lag:** IRDAI‑based statistics are typically **6–12 months behind** the current date; scores reflect recent history, not today’s exact operations.[^8][^3]
- **Insurer vs product level:** All claim and complaint statistics are **at insurer level**, not per plan; two products from the same insurer will share the same claim/complaint profile in the tool.[^3][^4]
- **Quote vs policy:** When only a quote is uploaded, the tool may **not see full exclusions, wordings or policy conditions**; verdicts will carry **medium or low confidence** tags.  
- **Subjective trade‑offs:** Some choices (e.g., higher sum insured at higher premium vs moderate cover at lower cost) are inherently subjective; the tool’s weighting profiles should be made explicit and adjustable.  
- **Data reliability:** Network hospital counts, app ratings and other operational metrics come from **insurer and platform self‑disclosures**; they are not audited by IRDAI and may fluctuate.  
- **Disputed or contested data:** If an insurer disputes a metric, the tool should be able to trace back to the underlying IRDAI table or clearly label it as third‑party analysis.

With these guardrails, the Insurer Performance Data Bank can function as a credible, transparent backbone for an opinionated AI‑assisted comparison engine.

---

## References

1. [What is IRDAI? Full Form, Role & Insurance Company List - Pazcare](https://www.pazcare.com/blog/what-is-irdai-full-form-role-insurance-company-list) - Niva Bupa Health Insurance, Standalone health insurer, Known for a robust cashless network and trans...

2. [Health Insurance Companies in India 2025 – Complete List ...](https://www.fincover.com/insurance/health/health-insurance-companies-in-india/) - Discover all health insurance companies in India for 2025. See a full, detailed list of IRDAI-licens...

3. [Claims ratio of non-life insurers dips to 82.52% in FY24](https://health.economictimes.indiatimes.com/news/insurance/claims-ratio-of-non-life-insurers-dips-to-82-52-in-fy24-irdai-report/116624030) - Claims Ratio Non-life Insurers: According to the Annual Report 2023-24 of the Insurance Regulatory a...

4. [IRDAI Report: Claims Ratio of Non-Life Insurers Declines to 82.5 ...](https://affairscloud.com/irdai-report-claims-ratio-of-non-life-insurers-declines-to-82-5-in-fy24-insurance-penetration-at-3-7/)

5. [List of 5 Standalone Health Insurance Companies in India - PolicyX](https://www.policyx.com/health-insurance/articles/what-is-a-standalone-health-insurance-company/) - IRDAI Approved List of Best Standalone Health Insurance Providers. With several ... Where can I chec...

6. [Standalone Health Insurance Companies in India - Policybazaar.com](https://www.policybazaar.com/health-insurance/articles/standalone-health-insurance-companies/) - Explore top standalone health insurance companies in India. Compare plans focused only on medical in...

7. [Check Claim Settlement Ratio for Insurance Companies in India](https://www.policyx.com/data-lab/claim-settlement-ratio-insurance-companies-India.php) - Check claim settlement ratio of all life and general insurance companies India for year 2022-23 ... ...

8. [IRDAI Annual Report for the F.Y. 2023 24 - LinkedIn](https://www.linkedin.com/pulse/irdai-annual-report-fy-2023-24-suresh-tillokani-elekf) - During 2023-24, the non-life insurance industry underwrote a total direct premium of 2.90 lakh crore...

9. [How to Choose the Right...](https://joinditto.in/articles/health-insurance/standalone-health-insurance-companies/) - Standalone health insurers in India focus only on health, accident, and travel covers. This guide ex...

10. [Integrated Grievance Management System (IGMS)](https://igms.org.in) - Bima Bharosa Portal provides a gateway to register complaints with insurance companies and track the...

11. [[PDF] Annual Report 2023 - 2024 - Insurance Ombudsman](https://cioins.co.in/annualreports/AnnualReport2023-2024.pdf) - Complaints Disposal (Company Wise Health Insurance). H3. 8. Details of Awards & Recommendation in fa...

12. [How to file complaint in Integrated Grievance Management System](https://bimabazaar.com/insurance-news-and-information/consumer-awareness/insurance-grievance/file-complaint-integrated-grievance-management-system) - Bima Bharosa Portal provides a gateway to register complaints with insurance companies and track the...

13. [Health Insurance Companies in India in 2025 Approved by IRDAI](https://www.godigit.com/guides/list-of-health-insurance-companies-in-india) - Health Insurance Companies in India: Find the complete list of health insurance companies in India a...

14. [List of insurance companies in India - Wikipedia](https://en.wikipedia.org/wiki/List_of_insurance_companies_in_India)

15. [Claims ratio of non-life insurers dips to 82.52% in FY24: Irdai report](https://www.business-standard.com/finance/insurance/claims-ratio-of-non-life-insurers-dips-to-82-52-in-fy24-irdai-report-124122300706_1.html) - Net incurred claims to net earned premium (claims ratio) of non-life insurance industry stood at 82....

16. [Claims ratio of non-life insurers dips to 82.52% in FY24: Irdai report - ET BFSI](https://bfsi.economictimes.indiatimes.com/news/insurance/claims-ratio-of-non-life-insurers-dips-to-82-52-in-fy24-irdai-report/116614218) - India's non-life insurance sector saw growth in direct premiums, reaching ₹2.90 lakh crore in 2023-2...

17. [Incurred Claims Ratios of Insurers 2023-24 | PDF - Scribd](https://www.scribd.com/document/866417836/Incurred-Claims-Ratio) - The document presents the incurred claims ratio for various insurance segments across public, privat...

18. [Top 10 Claim Settlement Ratio Health Insurance Companies in India](https://joinditto.in/health-insurance/top-10-claim-settlement-ratio-health-insurance-companies/) - New India Assurance leads the list with a 98.91% CSR, meaning it settled nearly every claim it recei...

19. [Health insurers disallowed claims worth Rs 15,100 cr during FY24: Irdai](https://www.business-standard.com/industry/news/health-insurers-disallowed-claims-worth-rs-15-100-cr-during-fy24-irdai-124123000562_1.html) - Health insurers disallowed claims worth Rs 15,100 crore or 12.9 per cent of the total claims filed d...

20. [Health insurers disallowed claims worth Rs ...](https://health.economictimes.indiatimes.com/news/insurance/health-insurers-disallowed-claims-worth-rs-15100-crore-during-fy24/116802505) - There were about 3.26 crore health insurance claims during 2023-24 with insurers, of which 2.69 cror...

21. [Health insurers reject claims worth Rs 15100 crore in FY24: Irdai](https://www.business-standard.com/finance/personal-finance/health-insurers-reject-claims-worth-rs-15-100-crore-in-fy24-irdai-124123100615_1.html) - Health Insurance Claims Rejection in 2024: In terms of number of claims settled, 72 per cent were se...

22. [Claim Settlement Ratio in Health Insurance Explained | ManipalCigna](https://www.manipalcigna.com/blog/claim-settlement-ratio) - As per recent IRDAI data, Acko General Insurance had one of the highest claim settlement ratios (99....

23. [Claim rejected? Here's how to file a complaint on Irdai's Bima Bharosa](https://www.caalley.com/news-updates/indian-news/claim-rejected-heres-how-to-file-a-complaint-on-irdais-bima-bharosa) - The Bima Bharosa portal (available at bimabharosa.irdai.gov.in) is Irdai's integrated grievance redr...

24. [Bima Bharosa: IRDAI Grievance Portal Explained - Ditto Insurance](https://joinditto.in/articles/general/bima-bharosa/) - Bima Bharosa is IRDAI's online grievance redressal platform designed to help insurance policyholders...

25. [Health Insurance Complaints Rise 14.5% in FY26, Claim Rejections ...](https://www.linkedin.com/posts/etbfsi_health-insurance-complaints-surge-rise-145-activity-7445059580881047553-0cSc) - Health insurance complaints surge rise 14.5% in FY26, claim rejections key reason A total of 73,729 ...

26. [Massive rise in grievances pendency in health and general ...](https://economictimes.com/wealth/insure/massive-rise-in-grievances-pendency-in-health-and-general-insurance-in-fy25-claim-related-issues-account-for-69-mis-selling-haunts-life-insurance/articleshow/126411611.cms) - Data from the Bima Bharosa Portal indicates a significant rise in complaints during FY 2024–25. ... ...

27. [[PDF] Chapter 8: Prudential Insurance Regulation in India - Skadden Arps](https://www.skadden.com/-/media/files/publications/2025/09/chapter-8-prudential-insurance-regulation-in-india/chapter_8_prudential-insurance-regulation-in-india.pdf?rev=25c9fe1e599d49eb8cb1ec3be1644066) - 5 The IRDAI “Handbook on Indian insurance statistics 2023-24,” last updated 17 February 2024. 6 Ibid...

28. [Top 10 Health Insurance Plans In India - 2026 Edition](https://algatesinsurance.in/top-10-health-insurance-plans-in-india-2026-edition/) - Star Health is India's largest standalone health insurer by market share. Super Star represents thei...

29. [Latest Claim Settlement Ratio of Health Insurance Companies India](https://www.policybazaar.com/health-insurance/claim-settlement-ratio/) - Every health insurance company in India has a claim settlement ratio. Usually, a claim settlement ra...

