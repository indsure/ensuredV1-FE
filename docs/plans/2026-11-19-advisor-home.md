# Advisor Home: Dashboard + Insights + Business on one page (2026-11-19)

Tier T2 (new surface, money figures shown to real advisors, goes to beta). Founder approved
the mock at `E:\Indsurefi\_mockups\advisor-home-2026-11-19\home.png` and said "go ahead on
beta, make it functional".

## Goal
An advisor opens `/agent/dashboard` and sees, in order: the book in numbers, who renews this
week, who renews this month, who is worth a call, and how the book is made up. Insights and
Business stop being separate screens.

## Sections and their source of truth (Claims Ledger)
| Shown | Source |
|---|---|
| Yearly premium, "from N of M policies" | `lib/business.ts` `toMoney` over in-force `clients` (status done) |
| Policies in force, "+N this week" | count of in-force rows; `created_at` within 7 days |
| Families, "about ₹X a year each" | distinct `customer_id` in force; premium / priced families |
| Due in next 30 days (₹ + count) | the same renewal rows as the two lists below, days 0..30 |
| Base cover placed | sum of `sum_insured` in force |
| Renewals this week | overdue (up to 30 days late) + due in 0..7 days |
| Renewals this month | due in 8..30 days. Rolling, no row in both lists |
| Call / WhatsApp buttons | `customers.phone` via `clients.customer_id`; none = "Add phone" link to the customer or policy |
| Score cell | health = stored `score`; motor = `scoreMotorPolicy(add_on_findings, coverage_type)`; others none |
| Weak health cover | health, in force, score < 70 |
| Health but no term | families with an in-force health policy and no in-force term policy |
| Leads to call today | `agent_leads` open with `next_follow_up` <= today (`isFollowUpDue`), plus `lead_policies` due in 0..7 days and not `spoken_to` |
| Birthdays this week | `customers.dob` month/day in the next 7 days |
| Premium due, 12 months | `renewalBuckets` (calendar months, priced dues only) |
| Book by insurance | premium by type + policy count; life and term apart |
| Biggest families | Business top families, top 5 |
| Recent checks / needs attention | last 5 done rows; count of pending/processing/error = My Queue |

### One due-date rule (new `lib/home.ts`)
- health, motor, property, fire, others: `expiry_date`.
- life, term: `next_premium_date` (else start date) rolled forward by frequency, stopping at the
  paying term. Never `expiry_date` (that is maturity). No frequency: use the printed
  `next_premium_date` once if it is in the window, do not roll it.
- travel, marine, contractor's all risk: one-time, never in renewal lists.
- A row is listed even with no premium on record; it is shown "Premium not read" and not summed.
- Overdue: due date 1..30 days ago. Life/term overdue reads "Premium date passed".
- Renewed-copy guard: an overdue row is dropped when the same family (customer_id, else the
  holder name) holds another policy of the same type whose due date is later. Otherwise every
  renewal uploaded as a new PDF would leave its old copy shouting "3 days late".

## Entitlement (keeps today's rules)
Insights was paid-only (`PaidOnly featureKey=paywall.f_insights`), Business playground-only.
Limited Free advisors keep what Home gave them (stats, renewals, recent checks, opportunities);
the 12-month chart, book by insurance and biggest families show one inline upgrade card.

## Blast radius
- `/agent/insights` and `/agent/business` redirect to `/agent/dashboard` (bookmarks keep working).
- Removed from: AgentLayout nav + PAID_ONLY_HREFS, AgentTabBar (slot becomes Upload),
  lazyRoutes. advisorGuide "insights" guide points to the dashboard and its copy is updated.
- DashboardMobile is replaced by the responsive page (rows become cards under md).
- Playground tour step `dashboard` still lands here; check it after.
- Business ungated for real advisors on beta: this is the founder's go-ahead.
- Deleted: Insights.tsx, Business.tsx, DashboardMobile.tsx (git keeps them).
- Not done here: "Spoken / Renewed / Lost" on own policies (needs a migration, next task),
  commission, server-side sums.

## Unhappy paths
Empty book (first-run card), a failed side query (customers / leads) degrades its block only,
main query fails = InlineErrorState with retry, 375px width, Hindi, 1000+ rows (paged),
a policy with no family, no phone, no premium, no date (counted in the foot note).

## Reversibility
Frontend only, no writes, no migration. Revert the commit.

## Critique outcome (independent critic, 2026-11-19), all fixed
1. Renewed-copy guard was too broad (two cars, base + top-up). Now: same family, type, insurer
   and plan name, with another copy expiring 300 to 430 days later. Applied to upcoming rows too.
2. Free advisors saw rupee totals (Insights/Business were paid). Free now gets count tiles only,
   no premium sums; the chart, book mix and families sit behind one upgrade card.
3. Free advisors lost Retry (My Queue is paid). Failed checks now have Retry on Home.
4. Tile now equals both lists (late + next 30 days, "N already late"). A life premium with no
   frequency is shown but never summed. Chart legend names the calendar month.
5. Per-family average now uses only premium that belongs to a family.
6. Prospect renewals use the same window (30 days late to 7 days ahead).
7. Customers are paged (fetchAllRows).
8. Monthly/quarterly life rolls to the next instalment; only yearly/half-yearly show "check it was paid".
9. Docs (/docs portal tour, /docs/insights rewritten as "Your book on Home"), unused insights/business
   strings and paywall.f_insights removed. Old docs screenshots of Home/Insights dropped: RE-CAPTURE.
10. Filter chips and birthday buttons are 44px.
11. One demo birthday is relative to today.
