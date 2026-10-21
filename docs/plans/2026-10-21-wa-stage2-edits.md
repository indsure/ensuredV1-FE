# WhatsApp stage 2: edits from the chat

Tier **T2** (writes to the shared prod/beta database, personal data, money fields). Written
2026-10-21, revised the same day after the independent critique (decision log in 11). Builds on
stage 1 (read-only views, live on EC2 at 3dc5177).

## 1. Goal

An advisor can make the everyday changes from WhatsApp that today need the portal: fix a
lead's or customer's details, turn a lead into a customer, file a policy under a customer,
correct a saved policy's details, stop sharing a report, record life-policy payments, loans
and insurer quotes, and run a claim's paperwork (open it, move its stage, log insurer queries).
Every change is shown first and saved only after a one-tap YES, and can be undone for 15 minutes
where undo is honest (5).

## Founder decisions (taken 2026-10-21)

- **WhatsApp never deletes.** The "can't delete from WhatsApp" reply stays.
- **WhatsApp may edit**, with YES and undo.
- **Claim documents over WhatsApp: approved** (they are stage 3: files).
- **Undo of the bot's own fresh creation** (delegated, "think as a dumb client"): see 8.

## 2. How each write is done: server-enforced, WhatsApp-only routes

**Rule: every limit that protects data is enforced by the server, not by the bot.** The critique
showed that opening the portal's own routes to the bot (`BOT_ROUTES`) would let anyone holding
the bot key close claims (which deletes documents), re-run and overwrite good reports, or blank
a health policy's details, whatever the bot meant to do. So `BOT_ROUTES` is NOT widened. Every
stage 2 change gets its own `/api/internal/wa/*` route that:

- is scoped to the linked advisor (`scopedAgent`), like every other bot route;
- accepts only the fields named for it and updates only the fields present in the request
  (never a whole-row write that would blank untouched fields);
- re-checks, inside the same SQL statement, the state it was confirmed against (the before
  values the advisor saw, or the record revision), and refuses with `CHANGED` if anything moved;
- writes an `access_audit_log` row with `user_agent = 'whatsapp-bot'` and the route, so a
  WhatsApp change is always distinguishable from a portal one;
- returns the before and after values, which the bot keeps for undo.

Where the portal's logic lives in an importable helper it is reused, not copied:
`services/policyValueStore.ts saveExtractedData` (data-entry fields, life evidence) with
`deriveSharedColumns` and `scoreFromExtractedData`. Where it lives inline in `routes.ts` (claims),
the stage 2 route copies the minimum, names the portal lines it mirrors, and a unit test pins the
behaviour (claim event row written, status rules).

| Route (all under `/api/internal/wa`) | Server-side limits | Mirrors |
|---|---|---|
| `leads/:id/update` (EXISTS; extended) name, phone, email, city, source, interests, expected premium, status, follow-up, note | only named fields; compare-before on every field it changes, the existing undo `restore` gets the same compare | `lib/leads.ts updateLead` value rules |
| `leads/:id/convert` | lead must have no customer yet; creates the customer from the lead, links, status won, one transaction | `convertLeadToCustomer` |
| `customers` (create) / `customers/:id/update` | only named fields; compare-before | `lib/customers.ts` |
| `clients/:id/customer` (EXISTS) / `clients/:id/uncustomer` | file / unfile; compare current customer_id | `tagPolicyToCustomer` |
| `clients/:id/client-details` name, identifier, email, phone | only named fields; compare-before | `PolicyDetail.tsx saveClientDetails` |
| `clients/:id/unshare` | `share_enabled = false` only; turning on stays the existing `clients/:id/share` | `share/toggle` (without its `last_shared_at` bump on "off") |
| `clients/:id/fields` data-entry fields; life evidence | **refuses unless the policy is a data-entry type** (never health), **requires `expected_rev`**, then calls `saveExtractedData` | `PATCH clients/:id/extracted-data` |
| `claims` (open) | **requires an existing `customer_id`** (a new customer is created first through `customers`, so it is visible and undoable) | `POST /api/agent/claims` + its claim event |
| `claims/:id/update` hospital, ailment, insurer, tpa, policy number, claimed amount, admitted/discharged dates | **never `settled_amount`**; claim must not be closed; compare-before | `PATCH /api/agent/claims/:id` |
| `claims/:id/stage` | **target must be opened, docs_received, submitted or under_process, and the claim's CURRENT status must not be settled or rejected** (so no closing, no reopening, from WhatsApp) | `POST claims/:id/status` non-terminal branch |
| `claims/:id/queries` (log) / `claims/:id/queries/:seq/answered` | claim not closed; answering mirrors the portal's side effect (last open query answered -> under_process) and returns it for undo | portal query routes |
| `claims/:id/extend` | only when the portal's `can_extend` rule holds (same SQL as stage 1) | `POST claims/:id/extend` |
| `undo` | see 5 and 8 | |

**Leaked-key worst case, stated:** today a leaked bot key (it never leaves the server; loopback
+ no proxy headers are also required) reads allow-listed advisors' books. After stage 2 it can
also edit their leads, customers, claims (open stages only), data-entry policy fields and share
flags, within the limits above. It still cannot delete anything, close or reopen a claim, touch
a health report, or spend a policy check.

## 3. Phases (each built, tested, critiqued and deployable on its own)

- **2a Leads and customers**: full lead add (city, source, expected premium, several interests,
  follow-up), edit a lead's details, convert to customer, add/edit customer, file a policy under a
  customer (by name or "this is Sunita's"), new customer from the policyholder, unfile.
- **2b Policies**: edit client details on a policy, stop sharing, fix a data-entry field
  ("premium is 14,500 not 15,400"; motor, life, term, travel, property only).
- **2c Claims**: open (existing customer), edit, move stage (open stages only), log query, mark
  answered, extend once.
- **2d Life records**: premium paid, paid up to, loan / no loan, insurer quote (surrender value,
  loan available, policy status), via the portal's own `policyEvidence.ts` (already synced).

How it talks (rules, model off; the model keeps working for paid plans as today):
- One-shot: "change Amit's phone to 98123 45678", "Amit ka city Pune kar do", "make Amit a
  customer", "Sunita's claim submitted", "insurer wants discharge summary for Sunita's claim",
  "Gupta paid 25,000 on 10 Oct".
- Guided, for uncles who don't know the words: "edit Amit" -> "What should I change? 1) Phone
  2) City 3) ..." -> value -> the usual confirm.
- A name matching several things -> "Which one? 1) Ramesh Kumar, lead  2) Ramesh Kumar, customer
  3) Ramesh's Care Supreme policy".
- Every confirm states exactly what changes, old -> new ("Phone: 98123 45678 -> 98765 43210"),
  and, when something extra happens, says it ("This also creates a customer called Amit Shah").

## 4. Claims Ledger (what the advisor is told, and where it comes from)

| Shown | Source of truth |
|---|---|
| "Phone: old -> new" in a confirm | the row read just before; the new value as the route will store it (same clean rules) |
| "Saved" | the route's 2xx reply, never assumed |
| "Nothing changed, it was edited in the portal meanwhile" | the route's `CHANGED` refusal |
| Claim stage names | `lib/claims.ts` CLAIM_SPINE labels |
| "Undo for 15 minutes" | the bot's UNDO_WINDOW_MS (exists), and only for changes listed in 5 |

No new claim on a public page. `/docs/whatsapp-assistant` "What you can type" is incomplete, not
false; updating it is a separate frontend item.

## 5. Reversibility (every write the plan makes)

| Change | Undo |
|---|---|
| Lead, customer, client-details, data-entry field, claim field edit | put the before values back, through the same route with compare-before (refused if anyone changed them since) |
| Share off | share on again (existing route, same token) |
| Policy filed / unfiled | the reverse, compare-before |
| Lead -> customer | unlink, status back, and remove the customer it created if nothing was filed under it (8) |
| Customer / claim created by this chat | removed, within 15 minutes and only if nothing was added to it (8) |
| Claim stage move | back to the stage it was at, only if the claim is still at the stage we set (compare-before; never into or out of a closed state) |
| Query answered | query reopened AND, if answering moved the claim to under_process, the claim put back to query_raised, both only if unchanged since |
| Query logged | no undo; the confirm says "Remove it in the portal if needed" |
| Life record added | void that record (portal's voidRecord: kept in history as removed) with `expected_rev` |
| Extension | no undo (one-time by rule); the confirm says so |

## 6. Unhappy paths to survive

Two leads with the same name; a value that fails validation (bad amount, bad date, claimed
amount below a settled one); the row changed in the portal between confirm and YES (`CHANGED`:
say so, change nothing); a double "YES YES" (the second finds nothing pending); YES after 15
minutes (lapsed, nothing saved); undo after a portal edit (refused, say why); backend down
mid-save (say it failed, never "saved"); Hindi/Hinglish wording of every step; free and paid
advisors; a number reply while a menu or another question is open.

## 7. Out of scope, on purpose

- **Closing (settled / rejected) and reopening a claim**: closing deletes the claim's working
  documents and needs the insurer's letter; reopening wipes the settled amount. Server-refused.
  Reply: "Close it in the portal, where you attach the insurer's letter."
- **Retrying or re-checking a policy**: the portal's re-run overwrites a good report, charges a
  check, and has no in-flight guard. Advisors resend the PDF instead (works today).
- Editing health policy details (the stored audit owns them).
- Any delete beyond 8. My Page, profile and team edits (stage 4). Files (stage 3).

## 8. Decided: undo of the bot's own fresh creation

Founder delegated ("think as a dumb client"): an advisor who types "undo" right after a mistaken
add expects it gone. So UNDO may remove a lead, customer or claim that **this chat created**,
within the 15-minute window, **only if nothing was added to it since** (no policy or claim under
the customer, no query, document, event beyond "opened" or field change on the claim, no change
to the lead). The route re-checks that inside the same statement. This is the only removal
WhatsApp can do.

## 9. Deploy

Same pattern as stage 1: `deploy-stage2.sh` splices a marked stage 2 block (and any small helper)
into the live `whatsapp/routes.ts`, checks on the server before the one restart (unit tests +
import of the spliced file), then smoke-tests WITHOUT writing anything: each new write route,
called with the key but no advisor, must answer 403 (proves it is registered and scoped);
read-only routes are exercised as a linked advisor as in stage 1. Restores on any failure, then
ships the bot. No database migration.

## 10. Tests

Bot: every phrasing in EN/Hinglish/Hindi, confirm text, YES/NO, lapse, double YES, undo and its
refusal, pick lists, no write without YES (fake engine counts writes). Backend (unit, no DB):
each route's field whitelist and value rules, compare-before refusal, the claim stage guard
(terminal target AND terminal current both refused), data-entry-only + `expected_rev` required,
undo-of-create preconditions, audit marker. And that `BOT_ROUTES` is unchanged.

## 11. Decision log (critique, 2026-10-21)

| # | Finding | Decision |
|---|---|---|
| 1 | Claim status route closes/reopens from the bot key; bot-only refusal | **Fixed**: dedicated `claims/:id/stage`, terminal target and terminal current refused server-side |
| 2 | Re-run has no status guard, overwrites reports, charges a check, no in-flight guard | **Fixed by removal**: no retry/re-run in stage 2 |
| 3 | extracted-data PATCH blanks a health policy's columns; `expected_rev` optional | **Fixed**: `clients/:id/fields` refuses non data-entry types, requires `expected_rev` |
| 4 | "400 on empty body" smoke test would write | **Fixed**: smoke test uses no-advisor 403s only |
| 5 | "Same audit log / revision checks" false | **Fixed**: own audit rows marked whatsapp-bot; compare-before on every write |
| 6 | Undo missing for claim fields, query answered, data-entry fields; query_raised unreachable | **Fixed**: table 5 covers every write; own routes can restore query_raised with compare-before |
| 7 | share/toggle bumps last_shared_at, enabled unvalidated | **Fixed**: own `unshare` route |
| 8 | cleanDraft whole-row writes; duplicate lead route; restore without compare | **Fixed**: named-field updates; extend the existing lead route; compare in restore |
| 9 | Convert duplicates customers; claim create makes customers silently | **Fixed**: convert requires no customer yet; claim needs an existing customer_id |
| 10 | Leaked-key blast radius unstated | **Fixed**: stated in 2 |
| 11 | Data-entry save reverts a client-details name edit (portal behaviour) | **Accepted**: same as the portal; out of scope to change |
| 12 | Claim PATCH accepts settled_amount | **Fixed**: not in the whitelist |
| 13 | Bad-UUID errors differ | **Fixed**: every route answers a plain message the bot maps |
