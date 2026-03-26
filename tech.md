# tech.md — IndSure Technology Stack

> Written for AI coding assistants. Be specific; never assume defaults.

---

## Frontend Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | React 19 | `react@^19.2.3` — uses new concurrent features |
| Language | TypeScript 5.9 | Strict mode not enforced; loose config |
| Bundler | Vite 7 | Config at root `vite.config.ts`; root is `frontend/client` |
| Routing | **wouter 3.9** | **NOT react-router.** Use `Switch`, `Route`, `Redirect` from `wouter` |
| State / Data | TanStack React Query 5 | `queryClient` from `@/lib/queryClient` |
| UI components | Radix UI primitives | shadcn-style; all components in `frontend/client/src/components/ui/` |
| Styling | Tailwind CSS 4 | Via `@tailwindcss/vite` Vite plugin (not PostCSS plugin) |
| Animations | Framer Motion 10 | Used in page transitions and landing hero animations |
| Forms | React Hook Form 7 + Zod 4 | `react-hook-form` + `zod` for validation |
| Charts | Recharts 3 | Used in calculator and dashboard pages |
| PDF generation (client) | `@react-pdf/renderer` 4 + `html2pdf.js` | Two separate PDF paths; `@react-pdf/renderer` for structured docs, `html2pdf.js` for page-capture |
| Toast / notifications | Sonner 2 | Used alongside shadcn `Toaster` |
| Date utilities | date-fns 3 | No moment.js anywhere |

### Path Aliases (vite.config.ts)
```
@        →  frontend/client/src
@shared  →  shared/
@assets  →  attached_assets/
```

### Dev Port
- Vite frontend: `http://127.0.0.1:5412`
- All `/api/*` requests are proxied to `http://127.0.0.1:5000`

---

## Backend Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js (ESM) | `"type": "module"` in root `package.json`; use `import`, not `require` |
| Framework | Express 5 | With `cors`, `multer`, `express-rate-limit` (rate limiting currently disabled) |
| Language | TypeScript 5.9 | Transpiled with `tsx` in dev; `tsc` for production build |
| AI | Google Gemini API | `@google/generative-ai`; model: `gemini-3.1-pro-preview` |
| File Uploads | Multer 2 | Max file size 25 MB; temp files stored in `backend/uploads/` |
| PDF Parsing | pdfjs-dist 5 (primary) + pdf-parse 2 (fallback) | Two-stage extraction with automatic fallback |
| PDF Generation | Playwright (Chromium headless) | Used server-side via `/api/generate-pdf` |
| Email | Nodemailer | Used for DPDP grievance acknowledgements; optional SMTP env vars |
| Dev runner | `tsx` | `tsx backend/server/index.ts` |

### API Server
- Port: `5000` (configurable via `PORT` env var)
- Entry point: `backend/server/index.ts`
- All routes registered in: `backend/server/routes.ts`
- CORS: allowed origins from `CORS_ORIGIN` env var (comma-separated); defaults to allow all origins in dev

---

## Database

| Layer | Technology | Notes |
|---|---|---|
| Database | PostgreSQL (Supabase-hosted) | AWS ap-south-1 region |
| ORM / Query | **Raw `pg` Pool** (primary) + Drizzle ORM (secondary) | Most routes use `pg.Pool` directly with raw SQL. Drizzle is configured but lightly used |
| Supabase Admin | `@supabase/supabase-js` (service role) | Used for auth verification and Supabase RLS |
| Schema | `shared/schema.ts` | Drizzle schema; only has a stub `users` table. **Real schema lives in Supabase/Postgres** |
| Migration tool | drizzle-kit | `npm run db:push` to push schema changes |

### Key Tables (in Supabase, raw SQL schema)
- `agents` — insurance agent profiles; `id` matches Supabase Auth `user.id`
- `clients` — policyholder records scoped per agent
- `analysis_jobs` — async policy audit job tracking (DB-backed + in-memory cache)
- `calculator_reports` — saved insurance calculator results with UUID
- `public_reports` — shareable audit report links with `is_active` flag
- `grievance_requests` — DPDP data requests/grievances
- `notifications` — agent notifications table

---

## Auth Mechanism

- **Provider**: Supabase Auth (email/password)
- **Frontend**: Supabase JS client (`@/lib/supabase`); auth state via `AgentContext` (`frontend/client/src/context/AgentContext.tsx`)
- **Backend verification**: All protected routes call `verifyJwt(req, res)` — extracts Bearer token from `Authorization` header and calls `supabaseAdmin.auth.getUser(token)` to validate
- **Admin check**: `isAdmin` middleware reads `agents.is_admin` column after JWT verification
- **Public user auth**: Stub pages exist (`/login`, `/signup`) but **real consumer auth is NOT implemented**. Only agent auth is functional.

### Agent Auth Flow
1. Agent logs in via Supabase on frontend → receives JWT
2. JWT stored in Supabase session (localStorage via Supabase SDK)
3. Frontend attaches JWT as `Authorization: Bearer <token>` on API requests
4. Backend `verifyJwt` validates token via `supabaseAdmin.auth.getUser()`

---

## Third-Party Services

| Service | Usage | Key |
|---|---|---|
| Google Gemini API | Policy analysis AI, image OCR, Sach AI chat | `GEMINI_API_KEY` |
| Supabase | Auth, hosted PostgreSQL, Storage | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Playwright/Chromium | Server-side PDF generation from URLs | No key needed; installed package |
| Nodemailer | DPDP grievance email acknowledgements | SMTP env vars (optional) |

---

## Environment Variables

All loaded from `.env.local` at root (via `backend/server/loadEnv.ts`).

| Variable | Purpose | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI analysis and Sach AI chat | **Yes** |
| `DATABASE_URL` | PostgreSQL connection string (Supabase pooler) | **Yes** |
| `SUPABASE_URL` | Supabase project URL | **Yes** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | **Yes** |
| `PORT` | Express server port (default: 5000) | No |
| `NODE_ENV` | `development` or `production` | No (defaults to development) |
| `SESSION_SECRET` | Session secret (legacy; sessions not currently in use) | No |
| `CORS_ORIGIN` | Comma-separated list of allowed CORS origins | No (defaults to allow all) |
| `GRIEVANCE_OFFICER_EMAIL` | Email for DPDP grievance notifications | No |
| `GRIEVANCE_SMTP_HOST` | SMTP host for grievance emails | No |
| `GRIEVANCE_SMTP_PORT` | SMTP port | No |
| `GRIEVANCE_SMTP_USER` | SMTP username | No |
| `GRIEVANCE_SMTP_PASS` | SMTP password | No |
| `GRIEVANCE_FROM_EMAIL` | Sender address for grievance emails | No |
| `GRIEVANCE_ACK_SUBJECT` | Subject line for grievance acknowledgement emails | No |

---

## Key Scripts (root package.json)

| Script | Command | What it does |
|---|---|---|
| `dev` | `tsx backend/server/index.ts` | Starts Express API server only (port 5000) |
| `dev:client` | `npm run dev --prefix frontend` | Starts Vite frontend only (port 5412) |
| `dev:all` | `concurrently ...` | Starts Express + legacy backend + Vite frontend + Next.js dashboard (3000) + admin app (3002) + next-api (3001) |
| `build` | frontend build + `tsc` | Production build |
| `start` | `node backend/dist/index.js` | Start compiled production server |
| `check` | `tsc --noEmit` | Type check backend |
| `db:push` | `drizzle-kit push` | Push Drizzle schema to DB |
| `health-check` | `ts-node backend/server/tests/engineHealthCheck.ts` | Run engine health check test |

---

## Multiple App Architecture

This is a **monorepo** with multiple independent applications:

| App | Directory | Port | Tech |
|---|---|---|---|
| Main frontend | `frontend/` | 5412 | Vite + React + wouter |
| Express API | `backend/server/` | 5000 | Express + TypeScript |
| Agent dashboard (legacy) | `dashboard/` | 3000 | Next.js 15 |
| Admin app | `admin-app/` | 3002 | Next.js |
| Next.js API (legacy) | `next-api/` | 3001 | Next.js API routes |

**Primary development is on the Vite frontend + Express backend.** The Next.js apps are legacy/experimental.

---

## Important Constraints

- **Use `wouter`, not `react-router-dom`** for the main Vite frontend. `react-router-dom` is installed (likely as a transitive dep) but is NOT used in `frontend/`.
- **ESM only**: Root package is `"type": "module"`. All backend files must use `import/export`, not `require()`.
- **No `drizzle-orm` in routes**: Most backend DB queries use raw `pg.Pool` SQL, not Drizzle ORM chainable queries.
- **Rate limiting is disabled** on the Express server despite `express-rate-limit` being installed.
- **Supabase service role key**: Used server-side only. Never expose to client.
- **Gemini model**: Always use `gemini-3.1-pro-preview` (hardcoded in analysis pipeline and Sach AI).
