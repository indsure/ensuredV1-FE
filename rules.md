# rules.md — IndSure AI Coding Rules & Constraints

> This is the most important file for an AI assistant. Read this before writing any code.

---

## ALWAYS Do These Things

- **Always use `wouter`** for routing in the Vite frontend (`frontend/client/src/`). Import `Switch`, `Route`, `Redirect`, `useLocation`, `useParams` from `wouter`. Never use `react-router-dom` in the frontend.
- **Always use `import`/`export`** (ESM). The root package is `"type": "module"`. Never use `require()` or `module.exports` in backend files.
- **Always use the `@/` path alias** for importing within `frontend/client/src/`. Use `@shared/` for shared schemas. Never use relative paths like `../../`.
- **Always use raw `pg.Pool` SQL** in `backend/server/routes.ts`. Do not introduce Drizzle query chains in route handlers — they are not used and the pool is already established.
- **Always add the `Authorization: Bearer <token>` header** for any new frontend API calls to `/api/agent/*` or `/api/admin/*` endpoints. Get the token via `supabase.auth.getSession()`.
- **Always return `{ error: string }` JSON** from backend routes on failure with the appropriate HTTP status code (`400`, `401`, `403`, `404`, `500`).
- **Always scope agent DB queries to `agent_id`**. Any query touching `clients`, `policies`, or `public_reports` must include a `WHERE agent_id = $N` clause using the verified JWT user ID.
- **Always clean up uploaded files** after processing with `fs.unlinkSync(file.path)`. Multer stores temp files in `backend/uploads/`; they must be deleted after use.
- **Always validate the AI response** before returning it. The `validateParsedReport()` function in `analysisPipeline.ts` must be called on any AI JSON output before the result is stored or returned.
- **Always use Tailwind CSS classes** for styling. Never write inline `style={{}}` for layout/spacing — only use inline styles for dynamic CSS-variable values.
- **Always lazy-load pages** in `App.tsx` using `const Page = lazy(() => import('@/pages/...'))` and wrap routes in `<Suspense fallback={<PageLoader />}>`.
- **Always wrap agent portal routes** with `<AgentProtectedRoute>` in `App.tsx`.

---

## NEVER Do These Things

- **Never use `react-router-dom`** in `frontend/client/src/`. It is installed (as a dep) but must not be used. Only `wouter` is used for the Vite frontend.
- **Never expose `SUPABASE_SERVICE_ROLE_KEY`** to the frontend. It is server-side only. The frontend uses the public `NEXT_PUBLIC_SUPABASE_URL` / anon key pattern via `@/lib/supabase`.
- **Never call `supabaseAdmin.auth.getUser()` from the frontend**. The admin client is a backend-only construct.
- **Never use `require()` or CommonJS** in files inside `backend/server/`. Doing so will break ESM module resolution.
- **Never modify `promptTemplate.ts` (MASTER_AUDIT_PROMPT) or `analysisPipeline.ts`** without being explicitly instructed. These are the core forensic audit engine. Accidental changes will break analysis quality for all users. The `PROMPT_VERSION` constant in `promptTemplate.ts` must be incremented whenever the prompt is changed.
- **Never bypass `verifyJwt()`** for protected routes. Do not add auth bypasses (e.g., checking a hardcoded token) to any agent or admin route.
- **Never split `routes.ts`** into multiple files — it is intentionally a single large file to keep route registration and DB queries collocated and easy to audit. Do not refactor without explicit instruction.
- **Never add rate limiting middleware** — it was explicitly disabled by the user. `express-rate-limit` is installed but must not be added to routes.
- **Never add `console.log()` debug statements** to production code. API request logging is handled by the existing logger middleware in `index.ts`. Backend errors may use `console.error()`. Frontend errors may use `console.warn()` sparingly.
- **Never use the Drizzle ORM query builder** (`.select()`, `.insert()`, etc.) in `routes.ts`. Use `pool.query()` with parameterized SQL only.
- **Never modify old/legacy agent pages** (`Login.tsx`, `Settings.tsx`, `Clients.tsx`, `AgentProfile.tsx` — the ones WITHOUT `New` suffix) unless explicitly asked. These are being phased out but kept for reference.
- **Never store personal policy data in localStorage or sessionStorage** — privacy concern and DPDP compliance risk.
- **Never hardcode the `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`** in source code. Always read from `process.env`.

---

## Known Fragile Areas — Do Not Touch Without Explicit Instruction

### 1. Analysis Pipeline (`backend/server/services/analysisPipeline.ts`)
- The 7-step pipeline (extract metadata → fetch wordings → merge → select prompt → call AI → parse JSON → validate + arithmetic check) is the product's core engine.
- `performScoreArithmeticCheck()` overwrites the AI score if the arithmetic doesn't match. This is intentional — do not remove.
- The `PROMPT_VERSION` constant in `promptTemplate.ts` is tracked in the DB for regression analysis.

### 2. Supabase RLS Policies
- Row Level Security is enforced in Supabase on `clients`, `agents`, `public_reports`. If you add new tables or modify existing ones, RLS policies must be updated accordingly via SQL (`fix_rls_policies.sql` pattern).
- The `is_admin` column on `agents` drives admin access. Do not change this without reviewing the `isAdmin` middleware.

### 3. Policy Wordings Fetcher (`backend/server/utils/policyWordingsFetcher.ts`)
- The insurer normalization and plan alias lookup is brittle — it depends on `insurer_normalization.json` and `plan_aliases.json`. If you add new insurers or plans, update these JSON files, not the fetcher logic.
- Insurer site scraping and IRDAI API calls are intentionally commented out (mocked). Do not uncomment them.

### 4. Sach AI Chat (`POST /api/sach-ai` in `index.ts`)
- The personal data detection regex (`containsPersonalData()`) blocks Aadhaar, phone, email, and policy number patterns. Do not relax these rules.
- Session-based rate limiting (20 messages/hour) is implemented in-memory via `sachAiRateMap`. It resets per server restart — this is a known limitation.
- The model is hardcoded to `gemini-3.1-pro-preview`. Do not change the model here.

### 5. Google Fonts Consent
- The Google Fonts consent banner in `App.tsx` is GDPR/privacy-aligned. Do not remove it or make fonts load unconditionally.

### 6. DPDP Compliance (Data Retention)
- `cleanupDpdpRetention()` in `index.ts` deletes `analysis_jobs` and `calculator_reports` older than 90 days. This runs every 24h. Do not modify the retention window.
- The `grievance_requests` table and `/api/grievance` endpoint support the Indian DPDP Act's data principal rights. Do not modify the fields or delete the endpoint.

---

## Technical Debt & Known Workarounds

| Issue | Workaround | Notes |
|---|---|---|
| `AuthProvider` in `App.tsx` is a no-op stub | `const AuthProvider = ({ children }) => <>{children}</>` | Public user auth was archived. Do not implement consumer auth without a clear spec. |
| `shared/schema.ts` only has a stub `users` table | Real schema lives in Supabase raw SQL | Drizzle was bootstrapped but never fully adopted. Don't use Drizzle in new routes. |
| `analysisJobs` Map is in-memory | DB-backed via `analysis_jobs` table with `persistJob()` | In-memory is cache only; DB is source of truth. On server restart, in-flight jobs are lost. |
| Two PDF-parsing libraries (pdfjs-dist + pdf-parse) | Primary = pdfjs; pdf-parse = fallback | Some PDFs fail pdfjs; the two-stage fallback is intentional. |
| `react-router-dom` is in package.json | But unused in frontend | It may be a transitive dependency or legacy. Do not use it. |
| Multiple "old" page files without `New` suffix | New pages have `New` appended (DashboardNew, PoliciesNew, etc.) | Old files are kept but not routed. Never route to them. |
| `sach_debug.log` file in root | Used for streaming error debugging | Do not delete it; the server appends to it. |
| No real knowledge base files in `backend/server/knowledge_base/` | `fetchFromInternalKB()` returns null; fallback wording is used | Analysis still works but confidence is lower. The KB directory exists for future use. |
| `nodemailer` SMTP not configured in dev | Grievance endpoint logs a warning and skips email | This is expected in development. |

---

## Code Style Preferences

- **Full files over snippets**: When modifying a file, provide the full updated version of changed functions/sections — not just diffs. Context matters.
- **No inline comments for obvious code**: Only comment non-obvious logic, workarounds, or decisions.
- **TypeScript types**: Always type function parameters and return types in backend files. Frontend can be lighter on types where inference is clear.
- **Component structure**: 1) imports, 2) types/interfaces, 3) component function, 4) sub-components if needed, 5) default export.
- **No `any` unless unavoidable**: Use `any` only when dealing with external library types that don't have proper typings. Add an inline comment explaining why.
- **SQL parameterized queries only**: Never interpolate user input into SQL strings. Always use `$1, $2, ...` placeholders with the values array.
- **Error messages must be user-facing safe**: Backend error messages returned in JSON must not include raw stack traces or DB error details in production. In development, `details` field is acceptable.
