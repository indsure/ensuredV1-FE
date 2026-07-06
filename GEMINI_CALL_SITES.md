# Gemini API Call Sites — complete inventory

Every place the app spends Gemini tokens. Verified 2026-07-02 by sweeping the
codebase for `generateContent` / `sendMessage(Stream)` / `getGenerativeModel` /
`GoogleGenerativeAI`. Keep this current when adding any AI call.

All calls default to model `GEMINI_MODEL` env or `gemini-3.5-flash`.
Every call is now recorded in the `gemini_usage_log` ledger (see
`server/services/geminiUsage.ts`); view spend in Admin → **Gemini Usage** (`/usage`)
or `GET /api/admin/gemini-usage`.

## The one real SDK chokepoint
`AIService.generateContent()` — `server/services/aiService.ts:65` — is the single
`model.generateContent()` call that backs most features. It retries up to **3×** on
error (each retry is a separate attempt row) and logs tokens on success + every
failed attempt. Everything in the "via AIService" table below funnels through here.

## Call sites

| # | Feature label | Where | Endpoint / trigger | Auth | Logged | Notes |
|---|---|---|---|---|---|---|
| 1 | `policy_audit` | `services/analysisPipeline.ts:189` (via AIService) | `POST /api/analyze` (public), `POST /api/agent/analyze`, `POST /api/agent/trigger-batch-process`, `POST /api/agent/clients/:id/rerun` | analyze=**none**; agent routes=JWT+credits | ✅ | The big one — input includes full policy + up to ~30k tokens of matched wordings. |
| 2 | `wording_extract` | `services/wordingCompare.ts:62` (via AIService) | `POST /api/agent/compare` | JWT | ✅ | 1 call per wording (2 per compare). Memoised by text hash — repeat compares of same PDF cost nothing. Catalog compares (`/api/compare/from-catalog`) use pre-extracted profiles = **no** Gemini call. |
| 3 | `data_entry` | `services/dataExtraction.ts:54` (via AIService) | `POST /api/agent/analyze` (motor/life/travel/property), `POST /api/agent/data-entry`, rerun | JWT+credits | ✅ | Cheap single field-extraction call. |
| 4 | `switch_reco` | `routes.ts:1363` (via AIService) | switch-recommendation route | JWT | ✅ | Small input. |
| 5 | `portfolio_insights` | `routes.ts:1664` (via AIService) | portfolio-insights route | JWT | ✅ | Small input. |
| 6 | `image_ocr` | `routes.ts:239` (direct SDK, `extractTextFromImage`) | any image upload feeding `/api/analyze`, agent analyze, data-entry, rerun | inherits route | ✅ | Runs **before** the audit when the upload is an image (PDF/txt skip it). So an **image upload = 2 Gemini calls** (OCR + audit). |
| 7 | `sach_ai` | `index.ts:450` (`sendMessage`), `:462` (`sendMessageStream`), `:483` (fallback) | `POST /api/sach-ai` (public) | **none** | ✅ | Chat. Stream path logs from the aggregated final response. |
| 8 | `ai_generate` (default) | `tests/engineHealthCheck.ts:82` (via AIService) | manual test run only | n/a | ✅ if run live | Not a production path; only spends when the test is run against live AI. |

## NOT Gemini calls (so nobody re-adds logging by mistake)
- `extractPolicyMetadata()` (`utils/policyWordingsFetcher.ts`) — pure **regex**, no AI.
- `SachAIChat.sendMessage()` (frontend) — just calls our `/api/sach-ai`; not a direct Gemini call.
- `analysisPipeline.ts:2` — `GoogleGenerativeAI` import is **unused/dead** (pipeline uses AIService). Safe to delete.

## Cost multipliers to remember
- **Image upload = 2 calls** (OCR then audit).
- **Retries**: AIService retries 3× on error — a Gemini 429/503 burst triples attempt count (failed attempts usually aren't billed, but show in the ledger).
- **Unauthenticated surface**: `POST /api/analyze` and `POST /api/sach-ai` have **no auth** — only the global 300 req/15min/IP limiter. Standing abuse/cost risk; watch "top callers" (anonymous = hashed IP) on the usage page.
