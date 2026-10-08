# WhatsApp assistant for advisors: phase 0/1 beta plan

Tier: **T2** (new surface, new tables on the shared prod Supabase, auth, personal data).
Source brief: "IndSure on WhatsApp: beta build brief" (pasted by Deep, 2026-09-25).
Founder answers so far: dedicated SIM + spare number exist; build phase 1 as the brief says
(including the language model for intent fallback and phrasing); first advisor account is
`Deepshah399@gmail.com`.

## 1. Goal

A linked advisor sends a health policy PDF to the IndSure WhatsApp number and gets back the
same report link the portal would give, plus: questions answered from that stored report,
a SHARE draft with a tap-to-open wa.me link, and RENEWALS, without opening the portal.

## 2. Architecture (grounded in the current code)

```
advisor WhatsApp ──> [whatsapp-bot process, EC2, pm2]            [backend, EC2, pm2]
                      wa-transport (Baileys)                      routes.ts
                      bot-core (dedupe, link, state, intents)     POST /api/agent/analyze   (unchanged lane)
                      engine-client ── HTTP localhost ──────────> GET  /api/agent/analyze/status/:jobId
                      queue (per-advisor, in-process, DB-backed)  POST /api/agent/clients/:id/share/toggle
                                                                  NEW /api/internal/wa/*    (link, report, renewals, customers)
```

- **Separate package** `whatsapp-bot/` with its own `package.json` (Baileys is not a backend
  dependency). Separate pm2 process so a WhatsApp crash never takes the portal backend down.
- **Same code path for checks.** The bot does not re-implement analysis. It POSTs the PDF to
  the existing `POST /api/agent/analyze` (`backend/server/routes.ts:3702`) and polls
  `/api/agent/analyze/status/:jobId` (`routes.ts:4195`). That gives identical scores, the same
  credit metering (checked up front, decremented only on success, `routes.ts:3779`), the same
  Needs Attention behaviour and the same `clients` row the portal shows.
- **How the bot authenticates as an advisor.** The agent routes use `verifyJwt`
  (`routes.ts:781`), which needs the advisor's Supabase token; the bot has none. Proposal: a
  narrow service path. `verifyJwt` accepts `x-wa-bot-key` + `x-wa-agent-id` **only** when
  (a) the key matches env `WA_BOT_KEY` (constant-time compare), (b) the request comes from
  loopback, (c) the route is on a hard-coded allowlist (analyze, analyze status, share toggle),
  and (d) that agent has an active row in `whatsapp_link`. Everything else still requires a real
  JWT. This is the riskiest change in the plan and is called out for the critic.
- **New internal routes** `/api/internal/wa/*` (same key + loopback guard): verify link code,
  fetch report summary for a `clients` row, list renewals, search customers, record metrics.
  The bot never holds DB credentials of its own.
- **Deploy.** Bot lives on the same EC2 box. Backend changes go in as spliced hunks per the
  deploy rule (never scp a whole `routes.ts`).

## 3. Data (migration `024_whatsapp.sql`, additive only)

Beta and prod share one Supabase, so this migration **lands on prod** the moment it runs.
Additive tables only; no change to existing columns. RLS enabled with no policies (service
role only), so the browser clients can never read them.

- `whatsapp_link` (agent_id, wa_number E.164, status active/revoked, link_code_hash,
  code_expires_at, pending_number, linked_at, revoked_at). One active link per agent and per
  number (partial unique indexes).
- `wa_conversation` (agent_id PK, state, current_client_id, pending_context jsonb, updated_at).
- `wa_message` (id, wa_message_id UNIQUE, agent_id null for unknown senders, direction, type,
  body_redacted, media_sha256, intent, created_at). The unique key is the dedupe.
- `wa_job` (id, agent_id, wa_message_id, client_id, analysis_job_id, file_sha256, status,
  failure_reason, queued_at, started_at, finished_at).
- `wa_allowlist` (agent_id PK, added_at, note). Beta gate by **account**, not phone number,
  so the number comes from linking. First row: the agent id for `Deepshah399@gmail.com`
  (look up and confirm it is an `agents` row before inserting).

Existing tables reused, never forked: `clients` (policies), `customers`, `agent_credits`,
`lead_policies` + `agent_leads` (lead renewals), `analysis_jobs`, `report_views`.

## 4. Intents (phase 1)

Rules first, model second, and the model may only return one of:
`analyze | ask | share | renewals | help | unknown`.

| Intent | Rule trigger | Data source |
|---|---|---|
| analyze | document message | `/api/agent/analyze` |
| ask | text with a current report, or "<name>'s policy" | `clients.report_data`, `score`, stored fields only |
| share | share, send to customer, bhej do | share toggle route + `buildMessage()` template |
| renewals | renewals, due, expiring | `lead_policies` (due_date) + `clients.expiry_date` within 30 days, own agent only |
| help | hi, hello, help, menu | T13 |

**Type detection** (step 9 of the brief). There is no engine classifier today; the portal
makes the advisor pick. New deterministic module `policyTypeGuess.ts`: extract text with the
same `pdf-parse` the backend uses, score keyword families (health: sum insured,
hospitalisation, room rent, pre-existing; motor: IDV, registration no, own damage, chassis;
life/term: sum assured, maturity, death benefit; travel, property similar). Clear winner goes;
anything else goes to AWAITING_TYPE with a numbered pick. No model involved. Devanagari share
above a threshold means "Hindi policy, not supported yet" before any check is spent.

**Language model use** (as the brief says, and nothing more): intent fallback classifier and
phrasing an answer from given report fields. Input is structured report fields, never the PDF.
Output guard: every number in the reply must appear in the source fields, else fall back to
the plain template. Every call goes through the existing usage ledger with its own feature tag
(`wa_intent`, `wa_phrase`) so the admin usage page shows the cost. **No live model call during
the build**: tests use a mocked client (standing rule after the ~$20 test-run spend).

**Draft messages** reuse `frontend/client/src/lib/draftMessage.ts` (`buildMessage`, EN,
Hinglish, Hindi, "Renewal reminder"). It is a pure module; the bot imports it rather than
copying templates, so the portal and the bot can never drift.

## 5. Portal change

Agent Settings gets "Connect WhatsApp": enter number, get a 6-digit code (10 min), send
`LINK 123456` from that number. Shows linked number + "Disconnect". Strings go into `en.json`
and `hi.json` in the same commit (the agent portal is translated). Gated to allow-listed
accounts so non-beta advisors never see it.

## 6. Claims Ledger

| Claim shown to the advisor | Source of truth | Verified |
|---|---|---|
| Score, label, verdict, "Where it may cost you" ₹ amounts | `clients.score`, `clients.report_data` for that row | at build, per field |
| "usually about a minute" | measured p50 from `analysis_jobs` timings | TODO(claim): measure before T2 ships |
| "It uses 1 policy check" / failed read uses none | `agent_credits`, decrement-on-success at `routes.ts:3779` | read in code 2026-09-25; exercise in Phase 0 |
| "over 25MB is too big" | multer limit in `routes.ts` | TODO(claim): confirm the constant |
| "You'll see in the portal when they open it" | `clients.views` increment at `routes.ts:6037` | read in code 2026-09-25 |
| Renewal dates, days left, premium | `lead_policies.due_date`, `clients.expiry_date` | at build |
| "Hindi policies aren't supported yet" | FAQ statement on /docs/faq | matches docs |

Copy rules: no em dashes, no "AI", no "credits" (the engine says credits internally; the bot
says "policy check").

## 7. Blast radius

- `/docs` and `/advisors/*` do not mention WhatsApp intake; nothing becomes false. A docs page
  is out of scope for the beta (beta is invite-only).
- `verifyJwt` change touches every agent route's auth path. Mitigated by the allowlist of
  routes and a unit test that every non-allowlisted route rejects bot headers.
- Credit counts: WhatsApp checks draw from the same balance. Portal counters stay correct
  because it is the same row.

## 8. Unhappy paths (must be exercised in Phase 0)

Duplicate delivery of one message id; same PDF twice; 3 PDFs in one burst; non-PDF; photo;
over 25MB; password-protected; scanned/blurry; motor PDF; Hindi PDF; unknown type; out of
checks mid-queue; bot restart mid-check (job resumes from `wa_job`, result still pushed);
backend restart mid-check; WhatsApp session drop and reconnect with missed messages; unknown
number (one reply, then silence); link code expired or sent from a different number; UNLINK;
"cancel" from every AWAITING state; 15-minute timeouts; a question with no current report.

## 9. Reversibility

- Nothing the bot does deletes data. UNLINK sets `status = revoked` (kept for audit).
- The bot never messages a customer. Share = draft + wa.me link to the advisor only.
- Migration is additive; rollback is dropping the five new tables.
- Kill switch: env `WA_BOT_ENABLED=false` stops replies; the backend service path is off when
  `WA_BOT_KEY` is unset.

## 10. Security and data

- Baileys session files: outside the repo, encrypted at rest on EC2, `.gitignore`d, backed up
  alongside the nightly R2 job. The repo is public, so a guard check fails the build if any
  `auth_info*`/session path appears in git.
- Logs redact phone numbers and policy numbers via the existing `lib/pii.ts`.
- PDFs are not kept on the bot server: downloaded to a temp file, posted, deleted.
- Ban mitigation as the brief: reply only to linked + allow-listed, never send first,
  1-3s random delay, typing indicator, no bursts.

## 11. Founder decisions (escalated, not guessed)

1. **Which model** for the fallback + phrasing: the existing Gemini key (with its ledger), or
   Claude on Bedrock against the AWS credits. Default in code: provider interface, Gemini
   adapter, mocked in tests.
2. **The bot's phone number** (the new SIM) is needed only at Phase 0 pairing (QR scan by you).
3. **The migration runs on prod Supabase.** Needs your explicit yes when we get there.
4. **EC2 deploy** of the bot process and the backend hunks. Needs your explicit yes.

## 12. Build order

1. Migration file + backend service path + internal routes + unit tests (no deploy).
2. `whatsapp-bot/` package: transport interface + Baileys adapter, bot-core, state machine,
   intents, templates, type guess, queue. Unit tests with a fake transport and fake engine.
3. Portal "Connect WhatsApp".
4. `npm run guard` + typecheck + tests.
5. Stop for founder yes on items 11.1, 11.3, 11.4; then Phase 0 pairing and 30-policy parity run.

## 13. Critique findings and decision log (Stage 2 + 3, 2026-09-25)

Critique run inline against the code (no separate agent, per Deep).

| # | Finding (evidence) | Severity | Resolution |
|---|---|---|---|
| C1 | "Loopback only" is worthless as a guard: `index.ts:274` sets `trust proxy 1`, and if nginx on the same box proxies to the backend, every public request arrives on a loopback socket. | Blocker | **Fixed.** The shared key is the guard (32+ random bytes, env only, constant-time compare). Bot path additionally rejects any request carrying `X-Forwarded-For` / `X-Real-IP` (nginx always adds them), checks `req.socket.remoteAddress`, never `req.ip`. Deploy step: nginx denies `/api/internal/`. |
| C2 | Credit race: `/api/agent/analyze` checks the balance up front (`routes.ts:3785`) and decrements only on success (`routes.ts:4082`, `GREATEST(balance-1,0)`). Three PDFs in a burst with 1 check left would all pass and all run. | Major | **Fixed** for the bot: per-advisor queue runs ONE check at a time, so the next file's up-front check sees the decremented balance. The same race in the portal is pre-existing; **accepted**, out of scope, noted. |
| C3 | Share URL is built from the request host (`routes.ts:5584`), so a localhost call returns `http://localhost:.../shared/report/...`. | Major | **Fixed.** The bot never uses `shareUrl`; it builds the link from the returned `shareToken` and env `WA_PUBLIC_ORIGIN` (`https://indsure.in`). |
| C4 | `analysisJobs` is an in-memory Map (`routes.ts:442`); the background work is an un-awaited async in the request. A backend restart mid-check leaves the job "processing" forever. Status is persisted, so polling survives, but the work does not. | Major | **Accepted** (pre-existing portal behaviour). Bot stops polling at 15 min, marks `wa_job` failed, tells the advisor to check the portal. No retry that could double-charge. |
| C5 | Brief T10 promises "item, ₹X". The report's `benefit_evaluation.where_policy_fails[]` carries `real_world_claim_impact` as prose (`promptTemplate.ts` schema), not a guaranteed rupee number. | Major (honesty) | **Fixed.** Report card quotes the engine's impact text verbatim; no ₹ figure is ever extracted, parsed or computed by the bot. |
| C6 | `/api/agent/analyze` takes no `customer_id`; portal links a customer separately. | Minor | **Fixed.** Internal route `POST /api/internal/wa/clients/:id/customer` sets `clients.customer_id` after an ownership check on both rows. |
| C7 | 25MB limit confirmed (`routes.ts:79`); decrement-on-success confirmed (`routes.ts:4079`). Team seats credit `agent_credits` per advisor (`teamRoutes.ts:174`), so the bot needs no seat logic. | n/a | Claims ledger rows verified. |
| C8 | `draftMessage.ts` imports only `date-fns`: importable from Node via a relative path with tsx. | n/a | Plan stands. |
| C9 | Score label strings live inline in JSX (`PolicyPDFDocument.tsx:615`). | Minor | **Accepted:** bot shows the number and the engine's own `final_verdict` text; no second label mapping that could drift. |
| C10 | Next free migration number is 024 (pr-6 and main both end at 023). | n/a | 024 stands. |

Escalated (unchanged): model provider (11.1), running 024 on prod (11.3), EC2 deploy (11.4).
Scope locked.

## 14. Build status (Stage 4, 2026-09-25)

Built, not deployed. Nothing has touched prod: the migration has not run, no EC2 change, no
model call made.

| Piece | Where | Verified |
|---|---|---|
| Migration (5 tables, RLS on, Deep on allow-list) | `migrations/024_whatsapp_bot.sql` | written, NOT run |
| Bot auth hook, portal link routes, internal routes, model routes (off) | `backend/server/whatsapp/` (plug-in folder), marked lines in `routes.ts`, `index.ts` | typecheck; 9 tests incl. real HTTP and plug-in off |
| Number guard + intent clamp | `backend/server/whatsapp/answerGuard.ts` | tests |
| Bot: transport, engine client, state machine, queue, intents, answers, templates, PDF inspect | `whatsapp-bot/` | typecheck; 33 tests |
| Portal card | `frontend/client/src/features/whatsapp/` (card + own EN/HI strings), marked lines in `SettingsNew.tsx` | typecheck; guard PASS |
| Runbook, pm2 config, metrics SQL | `whatsapp-bot/README.md`, `ecosystem.config.cjs`, `metrics.sql` | n/a |

Full backend suite 483/483. `npm run guard` PASS (one sub-14px regression from copying the
Settings card title pattern was caught and fixed, Sin 7).

New finding during build:

| # | Finding | Resolution |
|---|---|---|
| C11 | Global limiter (`index.ts`, 300 req / 15 min per IP) would throttle the bot within minutes: all bot traffic is one loopback IP and status polling alone is 12 req/min per check. | **Fixed.** Requests passing the bot key guard are skipped by the limiter. |
| C12 | The brief's 15-minute timeout "defaults" (e.g. English) are applied lazily on the next message, not by a timer, so nothing is ever sent unprompted. | **Accepted**: sending a share draft nobody asked for would break "never go silent / never surprise". |
| C13 | Baileys session files are protected by folder permissions (0700), a repo-path refusal and .gitignore, not by encryption inside the app. | **Accepted for beta**, backed up through the existing encrypted R2 job. Revisit at Phase 3 (Cloud API has no session files). |
| C14 | Baileys 7 can deliver a sender as an opaque LID with no phone number. The adapter reads the alternate phone JID; if WhatsApp gives neither, the sender is treated as unknown. | **Accepted**, watch in Phase 0. |

Claims ledger updates: 25MB confirmed (`routes.ts:79`). "usually about a minute" still
TODO(claim): measure p50 in Phase 0 with `metrics.sql` query 2 before advisors see it.

Pending founder items: run 024 on prod; EC2 env + deploy + nginx rule; pair the SIM;
`WA_LLM_ENABLED` (model spend); push the portal card to beta.

## 15. Built as a removable plug-in (Deep, 2026-09-25)

Deep asked that the whole channel can be unplugged. Everything lives in `whatsapp-bot/`,
`backend/server/whatsapp/`, `frontend/client/src/features/whatsapp/` and the migration pair
`024_whatsapp_bot.sql` / `024_whatsapp_bot_down.sql`. It touches shared code at seven spots
in three files, each tagged `WHATSAPP-PLUGIN`. Shared locale files, `package.json` and other
migrations are not touched (the card carries its own EN/HI strings). Unsetting `WA_BOT_KEY`
makes the backend behave as if the plug-in were absent (tested). Steps:
`whatsapp-bot/UNPLUG.md`.
