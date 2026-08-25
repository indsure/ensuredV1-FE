# Plan — Agency teams: Team Owner tab + advisor invites

**Tier: T2** — new surface, new tables, auth, personal data, and it makes a *published price*
real. Full loop per `WORKFLOW.md`.
**Branch:** `pr-6` (working tree already carries the 2026-08-23 data-loss fixes, uncommitted —
commit selectively, never `git add -A`).
**Design:** desktop + phone mockups, 8 artboards — `design/team-owner/`.

## 1. Goal

An agency owner can put their advisors on IndSure themselves: invite them by email, see what
each one is using, move policy checks to whoever ran out, and read their team's book — without
being able to change or destroy any of it.

## 2. What already exists (verified against source and the live DB, 2026-08-25)

Not assumed. Read before planning.

| Fact | Where | Consequence |
|---|---|---|
| `agents.plan` is already `'free' \| 'agent' \| 'agency'`, with `billing_cycle` | `004_agent_ocr_allowance.sql:21` | No plan column to invent |
| The refill job already says *"agency → treated like agent / annual, per seat"* | `backend/server/index.ts:222` | Per-seat allowance is the model already in code |
| `invite_codes` exists (`max_uses`, `current_uses`, `used_by`) and agent signup **requires** one | `SignupStep1.tsx:129` | Team invites ride the signup path that exists |
| Every frontend agent query filters `.eq('agent_id', user.id)` — 42 sites, 17 files | `lib/*.ts`, `pages/agent/*` | **Widening RLS changes no existing screen.** The owner view must ask for a member's id explicitly |
| Every agent table's policy is `FOR ALL USING (auth.uid() = agent_id)` | live `pg_policies` | Additive `FOR SELECT` policies OR in cleanly; nothing existing is modified |
| `get_my_role()` is `SELECT role FROM agents WHERE id = auth.uid()`, and `agents_read_policy` grants read to `'manager'`/`'admin'` | live `pg_proc` | **Do not overload `agents.role` with `'owner'`.** Ownership lives on `teams.owner_id` |
| Claim files are purged at `claims.purge_at`, survive only with `proof_consent_at`, and are reached by audited 10-minute signed URLs | `015_claims.sql:164` | Owner read stops before `claim_documents` |
| `claims` deliberately holds **no copy** of the claimant's name, so deleting a customer erases them from the claims desk | `015_claims.sql:37` | The tight retention design is intentional; do not widen it |
| No `citext`; `pgcrypto` is installed | live `pg_extension` | Email matching uses `lower(email)`; tokens hashed in Node |
| 12 agents, 48 policies, 6 customers, 3 claims. **No agency-plan account exists yet** | live counts | Nothing to migrate; the first team is provisioned by hand |

## 3. Founder decisions — taken 2026-08-25, not guessed

| # | Decision | Consequence for the build |
|---|---|---|
| 1 | Owner gets **full read** of the team's book | Additive `FOR SELECT` RLS across 7 tables + a `SECURITY DEFINER` helper |
| 2 | Checks stay **per-seat (10)**, owner can reallocate | Credit choke points stay per-agent; **pricing copy must change** — see §5 |
| 3 | Teams are **admin-provisioned** (team + owner + seat count) | No self-serve team creation; seat count cannot be raised from the portal |
| 4 | Invites are **email-bound, single-use, 7-day expiry** | New `team_invites` table; no shareable link |
| 5 | Claims: **full record, no documents** | `claims`/`claim_queries`/`claim_events` widened; `claim_documents` **not** |
| 6 | Leads: **included** | `agent_leads` + `lead_policies` widened |
| 7 | Raw policy PDFs: **not** readable by the owner | Widen the `clients` row, never mint a signed URL for a member's file |
| 8 | Owner reads are **logged and shown to the advisor** | New `team_access_log` + an advisor-facing view |

## 4. Claims Ledger

Every user-visible assertion this change introduces, with its source of truth.

| Claim shown to user | Source of truth | Verified |
|---|---|---|
| "4 of 6 seats in use" | `count(agents WHERE team_id = t.id)` vs `teams.seats` | 2026-08-25 |
| "1 invite pending · 1 seat free" | `count(team_invites WHERE status='pending')`, seats − members − pending | 2026-08-25 |
| "18 of 40 checks left" | `sum(agent_credits.balance)` over members vs `10 × members` | 2026-08-25 |
| "10 policy checks, 50 data-entry policies a month" (join screen) | `OCR_MONTHLY_ALLOWANCE.agency = 50` (`routes.ts:268`); checks per seat = 10 per the Agency tier | 2026-08-25 |
| "Expires in 5 days" | `team_invites.expires_at − now()` | 2026-08-25 |
| "The link works only for this address, once" | Invite lookup matches `lower(email)` **and** single-use `status` transition | 2026-08-25 |
| "On 1 September every advisor goes back to 10 checks" | `refillOcrAllowance()` period reset, `index.ts:222` | 2026-08-25 |
| "Priya sees each time you open it" | `team_access_log` row written per owner read, surfaced in her portal | **Ships in this change — decision 8** |
| "You can read her book, not change it" | Additive policies are `FOR SELECT` only; no widened `WITH CHECK` anywhere | 2026-08-25 |
| "Her customers and policies stay hers" | Removal clears `agents.team_id` only; no row is deleted | 2026-08-25 |

No new statistic, count or capability claim is introduced that is not computed from the above.

## 5. Blast Radius — what this makes false or stale elsewhere

- **`advisors-pricing.tsx:95` says policy checks are "10 / seat / month, shared", and `:77`
  says "Policy checks shared across the team (10 per seat)".** Decision 2 makes both false.
  Copy changes in the same commit — this is exactly the claim drift that produced the audit.
- **`agents.role`** — untouched, deliberately (§2). Anything reading `get_my_role()` is unaffected.
- **`agent_credits` / `agent_ocr_credits`** — reallocation moves `balance` between rows. The
  refill job overwrites `balance` by period, so a moved balance does not survive the month, and
  the UI says so.
- **Storage** — no storage policy changes. A member's PDFs stay unreachable to the owner.
- **`claim_documents`** — deliberately excluded from every widened policy. If a later change
  adds a "team" policy there, it breaks the purge/consent model in `015_claims.sql`.
- **Admin app** — gains team provisioning; no existing admin screen changes meaning.
- **Public pages** — nothing else describes team behaviour, so no other marketing page goes stale.

## 6. Unhappy paths to exercise

Invite to an email that already has an IndSure account · invite to an email already on another
team · redeem an expired link · redeem a revoked link · redeem someone else's link while logged
in as a different user · redeem twice · owner removes an advisor mid-session · seats exhausted ·
move more checks than the source holds · refresh mid-invite · browser Back out of the join flow ·
email-confirmation round trip in a new tab · 375px · failed request on every write.

## 7. Reversibility

- **Invite**: revocable until redeemed; expires by itself.
- **Removing an advisor**: clears `team_id`. No row deleted, no data destroyed, and the copy
  says exactly that. Re-invite restores the seat.
- **Moving checks**: reversible by moving them back, and reset by the next refill regardless.
- **Migration**: purely additive — new tables, one nullable column, new policies. Rollback is
  `DROP POLICY` + `DROP TABLE`; nothing existing is altered.

## 8. Scope

| # | Fix | Where |
|---|---|---|
| A | `teams`, `team_invites`, `team_access_log`, `agents.team_id`; `is_team_owner_of()` helper; additive `FOR SELECT` policies on `clients`, `customers`, `agent_leads`, `lead_policies`, `calculator_reports`, `claims`, `claim_queries`, `claim_events` | `migrations/017_agency_teams.sql` |
| B | Team read API: team, members, usage, pending invites | `backend/server/routes.ts` |
| C | Invite lifecycle: create + send, resend, revoke, preview, redeem | `backend/server/routes.ts`, `lib/mailer.ts` |
| D | Move checks between members; remove a member | `backend/server/routes.ts` |
| E | Access log write on owner read + advisor-facing read | `backend/server/routes.ts` |
| F | Team tab (list, seats, usage, invites) | `pages/agent/Team.tsx` |
| G | Member detail + their book, read-only, with the standing banner | `pages/agent/TeamMember.tsx` |
| H | Join-from-email screen | `pages/agent/JoinTeam.tsx` |
| I | Agency nav section, owner-only | `components/agent/AgentLayout.tsx` |
| J | Pricing copy corrected to per-seat | `pages/advisors-pricing.tsx` |
| K | Hindi strings for every new surface | `frontend/client/src/locales/hi.json` |
| L | Admin: provision a team, set seats, name the owner | admin surface |

## 9. Guard

`npm run guard` must pass. It is red on arrival (`sub-14px-type` 990 > budget 988, from the
money-back chart commits) — that pre-existing regression is fixed alongside, since the gate
blocks either way. No WARN budget may rise; no new `unchecked-delete`, `console-log`,
`pii-in-storage` or `blank-without-rel`.

---

# Execution record — 2026-08-25

## The plan was wrong about the biggest decision, and it was caught while wiring the API

§8-A called for additive `FOR SELECT` policies on nine tables behind an
`is_team_owner_of()` helper. That was written, validated against the live schema
(9 policies, all SELECT-only, no `WITH CHECK`) — **and then deleted before it shipped.**

The backend's `pool` is a service-role connection, so RLS does not apply to it.
Every owner read therefore goes through an endpoint anyway, which makes the widened
policies not merely redundant but harmful:

1. **They would have made the audit log a fiction.** We promise the advisor, on the
   join screen and in their portal, that they see every owner read. A widened policy
   is exercised by the *browser's* key — an owner could read every row of a member's
   book through supabase-js and write nothing to `team_access_log`.
2. **Two of the four exclusions are column-level, and RLS is row-level.** The owner
   reads a policy's analysis but not `clients.pdf_url`; reads a claim but not its
   documents. A policy that returns the row returns all of it.
3. **Blast radius.** Nine widened tables is nine chances to get a `USING` clause
   wrong on data belonging to people who never consented to a second reader.

Migration 017 now changes **no existing policy, on any table**. Verified: `pg_policies`
shows the nine agent tables carrying exactly their original `auth.uid() = agent_id`
policies and nothing else.

## Shipped

| # | Fix | Where |
|---|---|---|
| A | `teams`, `team_invites`, `team_access_log`, `agents.team_id`. No existing policy touched | `migrations/017_agency_teams.sql` |
| B–E | Team read, member detail, the four book surfaces, invite lifecycle, check moves, member removal, the advisor's audit read — every member-data route writes `team_access_log` as it serves | `backend/server/teamRoutes.ts` |
| F | Team tab: seats, per-advisor usage, invite + move-checks dialogs, honest removal copy | `pages/agent/Team.tsx` |
| G | Member detail + book, read-only, standing banner, per-tab honest footnotes | `pages/agent/TeamMember.tsx` |
| H | Join-from-email, with the consent block before the account exists | `pages/agent/JoinTeam.tsx` |
| I | Agency nav section, owner-only, gated on `teams.owner_id` via the API | `AgentLayout.tsx`, `AgentContext.tsx` |
| J | Pricing copy corrected from "shared across the team" to per-seat + movable | `advisors-pricing.tsx` |
| K | `layout.agency` / `layout.team` in **both** `en.json` and `hi.json` | `i18n/locales/` |
| L | Advisor-facing "Who opened your book" | `components/agent/TeamAccessLog.tsx` → Settings |
| M | **Not in the plan:** the signup blocker, below | `teamRoutes.ts`, `SignupStep1.tsx` |

## The blocker the plan missed

Agent signup **requires** a row in `invite_codes` (`SignupStep1.tsx`). A team invitee
has a team invite, not an admin code — so as planned, **no new advisor could have
completed onboarding at all.** The invite now mints its own single-use `invite_codes`
row (`max_uses = 1`, expiring with the invite), carries it in the email, and the join
screen deep-links to signup with the email and code prefilled. One signup path, still
gated; no second, less-guarded door into agent account creation.

## Two hazards found and avoided

- **`agents.role` is a privilege column.** `get_my_role()` feeds `agents_read_policy`,
  which already grants elevated read to `'manager'`/`'admin'`. Ownership lives in
  `teams.owner_id`; `role` is untouched.
- **Double `client.release()`** on the auth-failure paths of `/checks/move` and
  `/invite/:token/accept` — an explicit release inside `try` plus the one in `finally`.
  pg throws on the second. Found on review, fixed before any run.

## Verification

- `npx tsc --noEmit` — **clean**, backend and frontend.
- `npm run check:teams` — **18/18 pass.** New: applies 017 to the real database inside a
  transaction, builds a throwaway team from two real agents, exercises every statement the
  routes issue, and always rolls back. It asserts the things that would be invisible in a
  typecheck: no `pdf_url` in the policies result, no document columns in the claims result,
  the partial unique index rejecting a second live invite, revoke freeing the address again,
  a moved balance landing correctly, `balance >= 0` holding, the advisor seeing the audit row,
  removal destroying nothing, and `ON DELETE RESTRICT` refusing to orphan a team.
- `npm run guard` — **the debt-growth blocker is cleared.** `sub-14px-type` 990 → **980**
  (budget was already breached on arrival by the money-back chart commits); `low-contrast-token`
  396. Both budgets **ratcheted down** to the new numbers. Zero guard findings in any new file.
- **Not browser-verified.** No agency-plan account exists yet (12 agents, all `free`/`agent`),
  so there is no team to log into. Correctness rests on the typecheck, the SQL smoke test
  against the real schema, and code review.

## Not done — still open

- **Migration 017 is NOT applied to production.** It has only ever run inside rolled-back
  transactions. Applying it is a founder call; it is additive and idempotent.
- **No admin provisioning UI** (scope item L). The first team has to be created with SQL:
  `INSERT INTO teams (name, owner_id, seats) VALUES (…);` then `UPDATE agents SET team_id = …`.
- **`sendMail` is a no-op unless SMTP is configured.** The invite row is created regardless and
  the UI says plainly when the email did not go out, with Resend available — but until
  `MAIL_SMTP_*` is set, no invite actually reaches anyone.
- **The join round trip has a seam.** Signup ends in an email confirmation, so a brand-new
  advisor must reopen the invite link afterwards to finish joining. The screen says so rather
  than pretending otherwise. This is audit finding #6 from 2026-08-23, still unfixed.
- The four founder decisions in the 2026-08-23 plan's §6 remain open and untouched.
