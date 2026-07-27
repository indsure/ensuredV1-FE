# Gemini API Call Sites — complete inventory

Every place the app spends Gemini tokens. Re-verified 2026-07-07 (line numbers current as of
that sweep). Keep this current when adding any AI call, and thread `usageMeta` through so it
lands in `gemini_usage_log` (see `server/services/geminiUsage.ts`); view spend in
Admin → **Gemini Usage** (`/usage`) or `GET /api/admin/gemini-usage`.

All calls default to model `GEMINI_MODEL` env or `gemini-3.5-flash`
(`backend/server/config/ai_config.ts:4`). Sach AI and image OCR hardcode `gemini-3.5-flash`.

## The three raw SDK entry points

| Entry point | Location | Notes |
|---|---|---|
| `AIService.generateContent` | `server/services/aiService.ts:106` (SDK call `:192`) | Central wrapper backing most features. Retries up to **3×** on any error (`:32`, pending tightening to 429/503-only); logs tokens on success + every failed attempt. |
| `extractTextFromImage` (OCR) | `server/routes.ts:264` (SDK call `:276`) | Runs whenever an uploaded policy file is an image (PDF/txt skip it) — so an **image upload = 2 Gemini calls** (OCR + audit/extraction). Called via `extractPolicyText` (`routes.ts:312`). |
| Sach AI chat | `server/index.ts:416` (stream `:417`, non-stream `:458`) | One call per chat message. **Auth-gated since 2026-07-02**: requires a valid Supabase bearer (agent-portal-only). Caps: 20 messages/session, 500 chars/input. |

## Services built on AIService (1 call each)

| Service | Location | Ledger `feature` | Notes |
|---|---|---|---|
| `runAnalysisPipeline` — full health audit | `services/analysisPipeline.ts:189` | `policy_audit` | The big one — input includes full policy + up to ~30k tokens of matched wordings. |
| `extractStructuredData` — OCR-lane fields (motor/life/travel/property) | `services/dataExtraction.ts:54` | `data_entry` | Cheap single field-extraction call. |
| `extractWordingProfile` — wording profile for compare | `services/wordingCompare.ts:62` | `wording_extract` | Memoised by text hash — repeat compares of the same PDF cost nothing. |

## Endpoint → Gemini calls per request

| Endpoint | Auth | Credits | Calls per request |
|---|---|---|---|
| `POST /api/analyze` (public analyzer) | **None** (rate-limited) | none | 1–2: OCR if image + 1× `policy_audit` (`routes.ts:503`) |
| `POST /api/agent/analyze` | JWT | **health lane: checked & decremented** (`routes.ts:2243`, `:2434`); OCR lane free (`:2369`) | 1–2: OCR if image + audit **or** `data_entry` branch (`:2420` / `:2371`) |
| `POST /api/agent/trigger-batch-process` | JWT | **NOT checked — bypass hole** | 1× `policy_audit` per atomically-claimed client (`routes.ts:1305`; double-processing fixed 2026-07-02) |
| `POST /api/agent/clients/:id/rerun` | JWT | checked & decremented (`routes.ts:2724`, `:2827`) | 1–2: OCR if image (`:2773`) + audit/extraction branch (`:2818` / `:2781`) |
| `POST /api/agent/leads/:leadId/policy` | JWT | free (OCR-optional lane) | 1–2: OCR if image (`:1529`) + `data_entry` (`:1534`) |
| `POST /api/agent/compare` (PDF upload) | JWT | **not charged** (pricing page says 1 credit — gap) | 2× `wording_extract`, parallel (`routes.ts:2066-2067`); hash-memoised |
| `POST /api/compare/from-catalog` | JWT | none | **0** — pre-extracted catalog profiles, no Gemini |
| `POST /api/agent/switch-recommendation` | JWT | none | 1× `switch_reco` (`routes.ts:1438`) |
| `GET /api/agent/summary/:agentId` | JWT (self only) | none | 0–1× `portfolio_insights` (`routes.ts:1739`) — cached 30 days in `agent_summaries` |
| `POST /api/sach-ai` | Bearer required | none | 1× `sach_ai` per message (`index.ts:452`) |

Ledger feature tags: `policy_audit` · `data_entry` · `wording_extract` · `image_ocr` · `sach_ai` · `switch_reco` · `portfolio_insights` (+ `ai_generate` default from manual test runs).

## NOT Gemini calls (so nobody re-adds logging by mistake)
- `extractPolicyMetadata()` (`utils/policyWordingsFetcher.ts`) — pure **regex**, no AI.
- `SachAIChat.sendMessage()` (frontend) — calls our `/api/sach-ai`, not Gemini directly.
- `analysisPipeline.ts:2` — `GoogleGenerativeAI` import is **unused/dead** (pipeline uses AIService). Safe to delete.
- `server/lib/analyze-core.ts` — wraps the pipeline but is not imported by any route (Phase-2 refactor placeholder).
- `server/tests/engineHealthCheck.ts:82` spends real tokens **only when run manually**.

## Cost multipliers to remember
- **Image upload = 2 calls** (OCR then audit).
- **Retries**: AIService retries 3× on *any* error — deterministic failures bill up to 3×. Known follow-up: restrict to 429/503.
- **Unauthenticated surface**: `POST /api/analyze` has no auth — only rate limiting. Standing cost risk; watch "top callers" (hashed IPs) on the usage page. Must be gated before paid credits launch.
- **Batch bypasses credits** (see table) — an agent can batch-process unlimited policies without consuming credits.
