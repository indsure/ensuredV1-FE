# Plan - Account export and account deletion

**Tier: T2.** Irreversible destruction of personal data, across 24 tables, object storage and
the auth provider. Full loop.
**Branch:** `pr-6`. The working tree carries unrelated WIP in `routes.ts` and the policy-value
files. Commit selectively. Never `git add -A`.

## 1. Why

The privacy policy promises account deletion. The product has no control that performs it, and
no export at all. Found by the CRO on line 4.5 of the test drive: *"Need to add delete account/
Export account button"*. Under the DPDP Act both are obligations, not features, and the worst of
the three possible states is the one we are in: promising in writing a thing the user cannot do.

## 2. Findings that set the scope

Established by inspection on 2026-09-11, not assumed:

| Finding | Evidence |
|---|---|
| **24 tables hold user data.** 22 keyed on `agent_id`, 2 on `user_id`, plus `agents`, `individual_profiles`, `teams`, `team_invites`, `team_access_log` keyed differently. | `information_schema.columns` probe |
| **Per-policy deletion already exists**, for consumers (`8ba1c20`) and for agents (`DELETE /api/agent/delete-client/:id`). Account deletion does not. | `grep` of route table |
| **No payment integration exists.** No Razorpay, Stripe or checkout anywhere. Nothing to cancel on deletion. | `grep` across `backend/server` and `frontend/client/src` |
| **Documents live in Supabase Storage**, addressed by paths built from `agentId` and `claimId`. Rows hold the path; the bytes do not go when the row does. | `storagePath` construction in the upload routes |
| **`public_reports` and `share_token` rows outlive their policy unless cascaded.** A share link that survives a deleted account is the worst single outcome here. | `public_reports.client_id ... ON DELETE CASCADE` exists for policies; account-level has no equivalent |

## 3. Claims Ledger

Every user-visible assertion this change introduces.

| Claim shown to user | Source of truth | Verified |
|---|---|---|
| "Download everything we hold about you" | The export bundle is built from the same tables the deletion walks. One list, used twice. | pending |
| "This permanently deletes your account and cannot be undone" | A real hard delete across the table list, plus storage objects, plus the auth user | pending |
| "Any link you shared will stop working" | Share tokens and `public_reports` rows are in the deletion set | pending |
| "Your team members keep their own customers and policies" | Member rows are keyed on their own `agent_id`, not the owner's | pending |

## 4. Blast Radius

- **The same EC2 backend serves beta AND prod.** A deletion endpoint is live for both the moment
  it deploys. It must be unreachable without an explicit, authenticated, confirmed request.
- **Deleting the auth user is not reversible and not ours to undo.** Supabase admin delete is final.
- **A team owner deleting their account would strand members.** Refused, not silently handled:
  the owner must remove members or transfer the team first. Guessing what should happen to other
  people's data is not a decision code should make.
- **Export is read-only** and carries no blast radius beyond disclosure, which is why it ships first.
- **An export bundle is itself personal data.** It must be generated on demand, served once over an
  authenticated request, and never written to a public bucket.

## 5. Unhappy paths to exercise

Storage delete fails halfway (rows gone, files orphaned) - auth delete fails after rows are gone
(user logs in to an empty account) - deletion requested twice concurrently - a team owner with
members - a team member (seat must free) - an account with zero data - an account mid-analysis
with a running job - export of an account with 500 policies (size and timeout) - export requested
by an agent for another agent's id.

## 6. Order of operations, and why

Deletion runs in an order chosen so that a failure at any step leaves a state a retry can finish,
never a state the user cannot escape:

1. **Check preconditions.** Team owner with members: refuse with a message naming what to do.
2. **Collect storage paths** while the rows still exist. Losing the rows first orphans the bytes
   permanently, because the paths are only recorded in the rows.
3. **Delete database rows** in foreign-key-safe order, in one transaction. All or nothing.
4. **Delete storage objects**, best-effort, logging every failure with its path. A file left behind
   is recoverable by a later sweep; a row left behind is a live account.
5. **Delete the auth user last.** If this fails, the person can still sign in and retry the whole
   thing. Deleting it first would lock them out of a half-deleted account with no way back in.

Export runs the same table list in reverse: one list, so a table added to one is added to both.

## 7. Scope

| # | Item | Where |
|---|---|---|
| A | The shared table list, one module, used by export and delete | `shared/` or `backend/server/services/` |
| B | `GET /api/me/export` and `GET /api/agent/export` | `routes.ts` |
| C | Export download control on the consumer and agent settings screens | frontend |
| D | `DELETE /api/me/account` and `DELETE /api/agent/account`, with confirmation | `routes.ts` |
| E | Delete control, with a typed confirmation and an honest description | frontend |
| F | Tests: the table list, the precondition refusals, the ordering | `backend/server/tests/` |

## 8. Sequencing

Export first, and deliberately. It is read-only, it is the half a person wants *before* deleting,
and shipping it alone improves the position under the rules without any risk of destroying data.
Deletion follows as its own change, with its own review, because it is the one piece of code in
this product where a bug is unrecoverable for the customer.

## 9. Exit criteria

Both `tsc --noEmit` clean - `npm run guard` passing with no budget raised - tests green including
the new ones - export verified against a real account and its contents checked by hand - deletion
verified on a throwaway account, with the storage bucket and the auth user confirmed empty
afterwards - an honest report of anything not verified.
