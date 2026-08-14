# AGENTS.md

Guidance for AI coding agents working in this repository.

## Analytics — Mixpanel

**Mixpanel is the only analytics tool for this project.** It covers product
analytics, Session Replay and heatmaps. Microsoft Clarity was removed on
2026-08-05 once Mixpanel replaced it — do not reintroduce it or any second
session-recording tool. Two recorders means two copies of masked customer
screens leaving our infrastructure, and doubled DPDP exposure for no gain.

### Where it lives

| File | Role |
|---|---|
| `frontend/client/src/lib/mixpanel.ts` | All config, privacy rules, event names, helpers. **Single source of truth.** |
| `frontend/client/src/components/Mixpanel.tsx` | Init, page views, Supabase identify/reset. Mounted once in `App.tsx`. |
| `frontend/client/.env.example` | Documents every `VITE_MIXPANEL_*` variable. |

Platform: **web only** — React 19 SPA, Vite, `wouter` routing, Supabase auth.
SDK: `mixpanel-browser`. No CDP (no Segment/Rudderstack/mParticle) — do not add
one without routing the whole implementation through it.

Mixpanel project: **"Indsure", id 4039086, US data residency**
(`https://api.mixpanel.com`), Simplified ID Merge, created 2026-06-30. The token
is baked into `mixpanel.ts` with a `VITE_MIXPANEL_TOKEN` override; it is not a
secret (it ships in the client bundle and only permits writing events).

**Do not switch `api_host` to `api-in.mixpanel.com` because the company is
Indian.** The project is US-residency. Pointing at the wrong region fails
*silently*: that edge returns HTTP 200 `{"error":null,"status":1}` while the
events land in a cluster where this project does not exist. **A 200 does not
prove delivery** — only rows appearing in the Events view do. This cost a full
debugging cycle; do not repeat it.

### Adding a new event

1. Add the name to the `MpEvent` map in `lib/mixpanel.ts`. **Never** call
   `mixpanel.track()` directly from a component — always go through `track()`.
2. Naming is `object_verb` in `snake_case`: `policy_upload_started`,
   `cover_calculator_completed`. Property names are `snake_case` too, and
   property values are lowercase strings. Mixpanel is case-sensitive.
3. Renaming an event after data has been sent splits its history. Get the name
   right the first time.
4. Send numbers unquoted — a quoted `"29.99"` becomes a String in Mixpanel and
   cannot be aggregated.

### PII rules — this is an insurance product

This codebase handles policy documents, customer names, phone numbers, sums
insured and health declarations, under India's DPDP Act. Treat analytics as a
system that exports data outside our infrastructure.

**Never put in an event property:** names, phone numbers, email addresses,
policy numbers, exact ages, exact cities, sums insured tied to a person, or
anything read out of a policy PDF.

**Safe to send:** line of business, page tags, age *bands*, city *tiers*,
family structure, counts, durations, size buckets, public IRDAI plan UINs,
booleans and enums.

Session Replay runs with the strictest masking: `record_mask_all_text` and
`record_mask_all_inputs` are both `true`, and `record_block_selector` is
extended beyond Mixpanel's default to cover `canvas, iframe, embed, object` —
these are how pdf.js and the report viewers paint policy documents.

**If you add a component that renders raw customer data, put `data-mp-block` on
it.** That is the supported escape hatch. Do not loosen the global masking flags.

Network recording is on but captures timing and status codes only — the
`recordHeaders` and `recordBodyUrls` allowlists are deliberately empty so API
payloads and bearer tokens are never recorded. Do not populate them.

### Identity

**This implementation assumes Simplified ID Merge** — Mixpanel's default for
organisations created from April 2024. Under Simplified, `identify()` is the
only identity call ever needed: the SDK holds a `$device_id` for the anonymous
visitor and `identify()` sets `$user_id`, merging the two with no cap on how
many devices fold into one user. **Never add `alias()` or `create_alias()`
under Simplified** — it is an Original-API call and will corrupt the cluster.

A project's merge mode is locked as soon as it holds any data, so it cannot be
changed now. If this project is ever found to be on *Original* ID Merge, the one
change needed is that account creation in `pages/signup.tsx` should call
`alias()` rather than `identify()`. Verify at Project Settings → Identity
Management before touching identity code.

`identify()` on sign-in, `reset()` on sign-out, both handled by the auth
listener in `components/Mixpanel.tsx`. `reset()` matters on shared devices —
it issues a fresh `$device_id` so the next person is not merged into the
previous user's cluster. Agents and consumers share one Supabase auth pool, so
`user_type` is resolved by looking up the `agents` table.

When tracking an event that immediately follows account creation, call
`identifyUser()` **before** `track()` so the event lands on the real user
profile rather than the anonymous device id (see `pages/signup.tsx`).

Only the user id and coarse role go to Mixpanel — never email, phone or name.

### Gotchas

- **Env files live in `frontend/client/`, not `frontend/`.** `vite.config.ts`
  sets `root: client/` and Vite's `envDir` follows `root`. A `.env` next to
  `package.json` is silently ignored. (Vercel is unaffected — dashboard vars
  arrive via `process.env`.)
- `VITE_*` variables are **compile-time**. Changing one in Vercel does nothing
  until you redeploy.
- Analytics only initialise in production builds. Set `VITE_MIXPANEL_DEBUG=true`
  to exercise them from `npm run dev` — point it at a sandbox project, never
  production. Debug mode also exposes `window.mixpanel`.
- `record_heatmap_data: true` makes the SDK log `[autocapture] Initializing…`
  even though `autocapture: false`. That is the heatmap subsystem, not billable
  autocapture. Expected — do not "fix" it.
- Replay sampling is `record_sessions_percent: 100`. Free plans include 10k
  replays/month and they do not roll over.
