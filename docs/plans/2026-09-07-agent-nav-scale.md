# Plan: Agent portal navigation, rebuilt for a 1,000+ policy book

**Tier: T2.** New surfaces (Insights, search), a migration (saved views, plan type), and
every screen lists personal data. Full loop per `WORKFLOW.md`.
**Branch:** `pr-6`. The working tree carries unrelated WIP, so commit selectively, never `git add -A`.
**Status:** Stage 1 (Plan) complete. **Stage 2 (Critique) not yet run.** No code written.

Companion mockup: `2026-09-07-agent-nav-mockup.html` in this directory. Open it in a browser.

---

## 1. Goal

An agent with 1,200 policies can find any record in one keystroke, see how the book is
moving without exporting anything, and work a list without the page loading every row.

Today the portal shows 15 flat nav destinations and the Policies screen fetches the entire
book, analysis blobs included, on every visit.

---

## 2. Verification pass: what was read, not assumed

Every claim below was checked against source before it entered this plan.

| # | Finding | Evidence | Verdict |
|---|---|---|---|
| 1 | The Policies list fetches every row with no paging, including `report_data` | `PoliciesNew.tsx:180-185`, `.from("clients").select(...report_data...)` `.order("created_at")`, **no `.range()`, no `.limit()`** | **Confirmed.** Worst scaling bug in the portal |
| 2 | Almost nothing paginates server-side | One `offset`/`limit` pair in 6,177 lines: `routes.ts:3207-3225`, the admin usage page | **Confirmed** |
| 3 | ~~There is no `term` in the data model~~ | `insuranceTypes.ts:30` `DATA_ENTRY_TYPES` includes `"term"`, and `TYPE_META.term` has a label and emoji | **WRONG, corrected 2026-09-07.** Term exists and is a first-class `insurance_type`. The original finding read the narrower `leadPolicies.ts:15` list (which covers lead policies only) plus the `InsuranceType` alias, and concluded the value did not exist. It does. A Term nav child is populated from real data |
| 4 | No index on `clients` in the migration series | `grep "CREATE INDEX" migrations/*.sql` returns none for `clients`. Table predates migration 001 | **Unresolved.** Indexes may exist outside the series. **Verify against the live DB before adding any** |
| 5 | Claims is already indexed for a queue | `015_claims.sql:193` `claims_agent_status_idx`, `:196` `claims_agent_created_idx` | **Confirmed.** Claims needs no new indexes |
| 6 | The command palette is already installed and unused | `cmdk@1.1.1` in `frontend/package.json`; `components/ui/command.tsx` exists, imported only by `combobox.tsx` | **Confirmed** |
| 7 | Charts are already installed | `recharts@3.7.0` | **Confirmed** |
| 8 | No data table component exists | No `components/ui/table.tsx`, no `@tanstack/react-table` | **Confirmed.** Must be built or added |
| 9 | The nav is already data-driven | `AgentLayout.tsx:35-80` builds `navSections` from an array | **Confirmed.** The restructure is an array edit plus open/close state |
| 10 | Two line-of-business colour tokens are not colourblind-safe | `index.css` LoB block. `--lob-health #0D9488` vs `--lob-life #0E7490` = ΔE 10.4 normal vision (floor is 15). `--lob-life` vs `--lob-business #6D28D9` = ΔE 0.3 deutan | **Confirmed** by `dataviz/scripts/validate_palette.js` |

### The mockup's numbers are fictional and must not be copied

`2026-09-07-agent-nav-mockup.html` shows 1,240 policies, ₹4.82 Cr under management, a 3.3%
lapse rate and 91% settlement. **Every one of those is invented** to show the layout at target
density. They are illustration, not data. Nothing in that file is a source of truth, and no
figure from it may reach a real screen. Real values come from the Claims Ledger below.

---

## 3. Claims Ledger

Every user-visible assertion this change introduces.

| Claim shown to user | Source of truth | Verified |
|---|---|---|
| Nav child counts, e.g. "Health 486" | `SELECT count(*) FROM clients WHERE agent_id = $1 AND insurance_type = 'health'` | TODO(claim), endpoint not built |
| "Showing 1 to 50 of N" | `count: 'exact'` on the same paged query that returned the rows | TODO(claim). Must come from the same query, never a separate estimate |
| Insights "Policies in the book" | `SELECT count(*) FROM clients WHERE agent_id = $1` | TODO(claim) |
| Insights "Premium under management" | Sum of a premium column on `clients`. **Column not confirmed to exist or to be populated** | TODO(claim), see §6.3 |
| Insights "Renewals due, next six months" | `expiry_date` buckets on `clients`. Rows with a null or unparsed `expiry_date` must be shown as an explicit "unknown expiry" count, never silently dropped | TODO(claim) |
| Insights "Lapse rate" | Requires a definition of lapsed. Not currently a stored state | TODO(claim), see §6.4 |
| Insights "Claims settled, 12 months" | `SELECT count(*) FROM claims WHERE agent_id = $1 AND status = 'settled' AND ...` | TODO(claim). `claims.status` values exist, ratio definition does not |
| Claim "Age" column, e.g. "41 days" | `now() - claims.created_at`, per `015_claims.sql` | Available today |
| Agent-wise table in Insights | `agents.team_id` join per `017_agency_teams.sql` | Available today |

**A claim with no source does not ship.** Where a number is not yet computable, the slot
renders empty with a visible "not available yet", never a plausible placeholder. That single
rule is what the 2026-08-23 audit exists because of.

---

## 4. Blast Radius: what this makes false or stale

| Thing | Effect |
|---|---|
| `hi.json` | Every nav label changes. New strings: Insights, Services, Overview, Search, saved-view labels, paging text. Per the Language invariant these ship in the same commit or the surface is marked English-only |
| Deep links and bookmarks | `/agent/uploads`, `/agent/my-queue`, `/agent/values`, `/agent/my-page` all move in the IA. Routes must keep working, or redirect. Agents have these in WhatsApp threads |
| `AgentLayout.tsx` mobile layer | The adaptive bottom-tab work assumes the current group structure. Six parents changes it |
| Playground demo | Memory records that it rots silently after any nav or endpoint change. It must be re-walked after this |
| Onboarding copy and screenshots | Anything naming "Analyze" or "My Book" becomes wrong |
| `exportPolicies.ts` | Already carries `typeFilter: "all" \| InsuranceType`. A Term filter would have no matching value |
| Public pages | No public page describes the agent nav. Searched, nothing found. **No public claim drift** |

---

## 5. Unhappy paths this must survive

Named before building, exercised at the Unhappy Path Gate.

1. **Empty book.** A brand-new agent has 0 policies. Every child reads 0, every chart is
   empty, Insights has nothing to plot. This must look deliberate, not broken. It is the
   state most agents are in today.
2. **Refresh mid-list.** Page 4 of Policies, sorted by expiry, filtered to Health. Refresh
   must land back there, so paging and sort state live in the URL, not in component state.
3. **Browser Back** out of a policy detail returns to the same page and scroll position.
4. **Failed request** on a paged list shows a real error and a retry, not an empty table that
   looks like an empty book. The two must never be confusable.
5. **Slow 3G.** The list shows a skeleton, and a slow page does not blank the previous one.
6. **375px.** The rail cannot expand on a phone. Parents become bottom tabs, children become
   a chip row. Chips must wrap, not scroll off screen unreachably.
7. **Search with no results**, and search while offline.
8. **A collapsed rail.** Children must reach via flyout, since the collapse toggle already exists.
9. **Rapid tab switching** must not leave a stale list under a new heading. React Query keys
   include every filter.

---

## 6. Founder decisions: escalate, do not guess

**6.1 Claims placement.** The instruction was Claims inside Services. This plan puts it
top-level, because at agency scale it is a queue with ageing rather than a tool. **This is the
one place the plan does not follow the instruction, and it is flagged rather than silent.**
One line in the nav array either way. **Founder decides.**

**6.2 Life versus Term.** Downgraded after §2.3 was corrected. `term` and `life` are separate
`insurance_type` values, so a policy carries one or the other and the counts do **not**
double-count. What remains is a data-entry question, not a counting bug: a term plan is a kind
of life insurance, so whoever enters a policy has to know which bucket to use. Worth a line of
guidance at the point of entry. **Shipped as Overview, Health, Life, Term, Motor, Others.**

**6.3 Premium under management.** Needs a premium column that is reliably populated. If it is
sparse, the figure is misleading and should not be shown at all rather than shown partial.
**Founder decides whether it ships in v1.**

**6.4 Definition of "lapsed".** Not a stored state today. Expiry date in the past is not the
same as lapsed, since a renewal may have been written elsewhere. A lapse rate published to an
agency owner is a number they will quote. **Founder defines it, or it does not ship.**

**6.5 Saved views retention.** A new table holding agent-authored filters. Retention and
deletion behaviour must match the existing DPDP posture. **Founder confirms.**

---

## 7. Reversibility

| Change | Destroys | Undo |
|---|---|---|
| Nav restructure | Nothing. No data write | Revert the array |
| Dropping `report_data` from the list query | Nothing. The blob is still read on the detail screen | Revert the select |
| Paging | Nothing | Revert |
| Saved views | An agent's own saved filter, if deleted | Real confirmation plus undo, per the Reversibility invariant. Never a bare `.delete()` whose result goes unchecked, which is finding #2 of the 2026-08-23 audit |
| Migration (plan type, saved views) | Nothing existing. Additive columns and a new table only | Down migration ships with it |

**No step in this plan deletes user data.** Any bulk action added to a list is explicitly
out of scope for v1 for that reason. Bulk send and bulk export are fine. Bulk delete is not,
and is not in this plan.

---

## 8. Sequence

Ordered by value per unit of risk. Steps 1 and 2 are worth doing whether or not the rest ships.

| # | Step | Depends on | Rough size |
|---|---|---|---|
| 1 | **Fix the unpaginated list fetch.** Drop `report_data` from `PoliciesNew.tsx:181`, add `.range()` and `count: 'exact'`, read the blob on the detail screen only | Nothing | 0.5 day |
| 2 | **Verify `clients` indexes against the live DB**, add what is missing on `(agent_id, created_at)`, `(agent_id, insurance_type)`, `(agent_id, expiry_date)` | Nothing | 0.5 day |
| 3 | **Nav restructure.** Six parents, expanding children, one open at a time, state in the URL. Includes `hi.json` | 6.1, 6.2 | 2 days |
| 4 | **Data table component.** Sortable, sticky header, selection, paging. Built once, used by Policies, People, Claims | 1 | 2 to 3 days |
| 5 | **Ctrl K search.** Endpoint plus trigram index; UI is `cmdk`, already installed | 2 | 2 days |
| 6 | **Saved views.** Migration plus CRUD plus chip row | 6.5 | 2 days |
| 7 | **Insights.** Aggregate endpoints, scheduled rollups rather than live counts, `recharts` screens | 6.3, 6.4 | 3 to 4 days |

Total roughly three to four weeks. Steps 1 and 2 land on day one.

**Charts use a single hue with direct labels.** Colour is reserved for status, because two LoB
tokens fail colourblind separation (§2.10). A four-hue set that passes in light mode is
`#0D9488`, `#1D4ED8`, `#B45309`, `#9D174D`; dark mode needs its own steps, not a flip. Fixing
the LoB tokens is a separate change and is not in this plan.

---

## 9. Scope lock

In scope: the seven steps in §8.

Out of scope, and a new plan if wanted: bulk delete; merging `agent_leads` into `customers`;
fixing the LoB colour tokens; any change to the public site; the mobile bottom-tab rework
beyond making the existing one survive six parents.

---

## 10. Next stage

**Stage 2, Critique, has not been run.** Per `WORKFLOW.md` a T2 change gets an independent
critic that has seen only this plan's output, not its rationale, and states findings as
failures with `file:line` evidence against the Seven Sins. That pass happens before any code.

Nothing in §8 has been built. No files outside `docs/plans/` have been touched.
