# Business page (playground only, beta) - 2026-10-16

Tier: T2 (new surface, money figures). Ships to beta, visible ONLY in playground mode.
Founder reviews it there; ungating for real agents is a later, separate change.

## 1. Goal
An advisor can see their book in rupees: yearly premium and cover by type of insurance,
renewal premium per month for 12 months, premium by insurer, top families by premium.

## 2. Claims ledger
| Claim on screen | Source of truth |
|---|---|
| Yearly premium on book | `clients` status=done, agent_id. Non-health: `extracted_data.annualised_premium` if present, else `extracted_data.premium` x frequency factor (`premium_frequency`: monthly 12, quarterly 4, half-yearly 2, annual/absent 1). Health: `report_data.premium.amount` x factor of `report_data.premium.frequency`. `single` frequency is EXCLUDED from the yearly figure and counted in the note. |
| Policies / premium known for X of Y | count of rows / rows with a usable premium |
| Families | distinct non-null `customer_id`, names from `customers` |
| Total cover | sum of `clients.sum_insured` (motor IDV via existing shared mapping) |
| Renewal premium by month | yearly premium bucketed by `getNextPremiumDate(expiry_date, extracted_data)` (same helper Customers uses), next 12 calendar months, past dates excluded |
| Premium by insurer | `clients.insurer` |
| Average premium per policy by type | yearly premium / policies of that type with a premium |
| Data note | "premium printed on the policy, not money received, no commission" (true: we store neither receipts nor commission) |

Query is narrow: JSON path selects (`report_data->premium`, `extracted_data->premium`, etc.), never whole `report_data`.

## 3. Blast radius
- `insights.note_not_shown` says "we do not store a premium on a checked policy". Stale since audit 1.6.0 stores `premium`. Not changed now (Business is hidden for real agents); MUST be rewritten when Business is ungated.
- Playground mock `select` returns whole rows; it must learn `alias:col->key` projection or the page reads nothing in playground.
- Health playground seeds mostly had no premium. Already fixed on pr-6 by 54698c2 (every demo health report carries one), so no seed change here.

## Critique applied (independent critic, 2026-10-16)
Life/term never bucket on expiry (it is maturity / cover end): dues roll forward from next_premium_date or start_date and stop at the paying term. Instalments spread per month. Expired rows excluded (renewal double count). Travel / marine / CAR are one-time, outside yearly and renewals. Life with unreadable frequency excluded, health with none counted as yearly and said so. Frequency via policyValue.readFrequency. Cover tile labelled base cover (super top-ups not added). GST caveat in the note. Paged fetch past the 1000-row cap; server-side sums noted as an ungating item.

## 4. Unhappy paths
Empty book, all premiums missing (tiles show "-" plus note, never Rs 0), failed query (InlineErrorState + retry), 375px (bars stack, chart scrolls in its own box), Hindi locale, refresh, real agent hitting /agent/business directly (redirect to /agent/insights).

## 5. Reversibility
Read only. No writes, no deletes. Gate is one `isPlaygroundMode()` check in nav + route.

## 6. Founder decisions (escalate, not guessed)
- Name "Business" (founder chose). Placement: own tab after Insights (founder chose A).
- Single-premium policies excluded from the yearly total (proposed; founder can overrule in review).
- When ungating: Insights note rewrite, and whether free plans see it.
