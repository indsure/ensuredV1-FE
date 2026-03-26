# structure.md — IndSure Folder Structure & Code Conventions

> Written for AI coding assistants. Follow these patterns strictly when adding code.

---

## Top-Level Monorepo Structure

```
ensuredV1-FE - Copy/
├── backend/                  # Express API server (Node.js + TypeScript)
├── frontend/                 # Vite + React main app (D2C + Agent Portal)
├── dashboard/                # Next.js 15 agent dashboard (legacy — being replaced)
├── next-dashboard/           # Experimental Next.js dashboard (unused)
├── next-api/                 # Next.js API routes (legacy)
├── admin-app/                # Next.js admin panel (separate app)
├── shared/                   # Shared schema; only schema.ts (Drizzle model stubs)
├── attached_assets/          # Static asset files (images, PDFs referenced in code)
├── policyfiles/              # Sample policy PDFs for testing
├── test_policies/            # Test policy files
├── uploads/                  # Transient upload directory (auto-cleaned after 24h)
├── downloads/                # Transient download directory
├── .env.local                # Root environment variables (loaded by backend)
├── vite.config.ts            # Vite config (root = frontend/client)
├── drizzle.config.ts         # Drizzle ORM config (schema = shared/schema.ts)
├── package.json              # Root package with all deps + dev scripts
├── tsconfig.json             # Root TypeScript config
└── components.json           # shadcn/ui config
```

> **Root-level .mjs / .py / .js scripts** (`check_db.mjs`, `apply_rls.mjs`, etc.) are one-off admin/debugging scripts. They are NOT part of the application. Do not import from them.

---

## Backend: `backend/server/`

```
backend/server/
├── index.ts                  # Express entry point — server setup, CORS, DPDP cleanup,
│                             #  Sach AI endpoint, launches registerRoutes()
├── routes.ts                 # ALL API route handlers (1387 lines) — do not split
├── loadEnv.ts                # Loads .env.local via dotenv
├── static.ts                 # Serves compiled frontend static files in production
├── vite.ts                   # (Legacy) Vite dev middleware stub
│
├── services/
│   ├── aiService.ts          # Thin wrapper around Gemini SDK: AIService.generateContent()
│   └── analysisPipeline.ts   # 7-step analysis orchestrator: extract→fetch→merge→prompt→AI→parse→validate
│
├── utils/
│   └── policyWordingsFetcher.ts  # PolicyWordingsFetcher class: KB lookup, insurer normalization,
│                                 #  plan alias resolution, checksum, fallback generation
│
├── data/
│   ├── insurer_normalization.json  # Maps raw insurer names → canonical names
│   ├── plan_aliases.json           # Maps plan name aliases → canonical plan names
│   └── insurance_networks/         # Hospital network filtering data + engine
│
├── knowledge_base/           # Internal policy wordings text files
│                             # Filename convention: {Insurer}_{Plan}_{Year}.txt
│
├── config/                   # (Mostly empty) Config stubs
├── schemas/                  # (Mostly empty) Schema stubs
├── types/                    # TypeScript type declarations
├── tests/                    # Engine health check tests
├── prompts/                  # Prompt file stubs
│
├── promptTemplate.ts         # MASTER_AUDIT_PROMPT (health insurance) + PROMPT_VERSION
├── lifeInsurancePrompt.ts    # LIFE_INSURANCE_PROMPT
├── vehicleInsurancePrompt.ts # VEHICLE_INSURANCE_PROMPT
├── policyExtractionPrompt.ts # POLICY_EXTRACTION_PROMPT (metadata extraction)
├── sachAI.prompt.ts          # SACH_AI_SYSTEM_PROMPT (for the chat widget)
└── [various .mjs admin scripts — ignore]
```

### Where API Routes Live

All routes are registered in `backend/server/routes.ts` via `registerRoutes(httpServer, app)` called from `index.ts`.

Route groupings (in order):
1. **Public — Policy Analysis**: `POST /api/analyze`, `GET /api/analyze/status/:jobId`
2. **Public — Policy Extraction** (archived): `POST /api/extract-policy`
3. **Public — Hospital Network**: `GET /api/hospitals/filter`
4. **Public — Shared Reports**: `GET /api/public-report/:uuid`
5. **Public — PDF Generation**: `POST /api/generate-pdf`
6. **Calculator**: `POST /api/calculator/save-report`, `GET /api/calculator/report/:uuid`
7. **DPDP Grievance**: `POST /api/grievance`
8. **Agent CRUD**: `/api/agent/*` (create-profile, me, clients, policies, uploads, notifications, reports, etc.)
9. **Admin** (protected by `isAdmin` middleware): `/api/admin/*`
10. **Sach AI chat**: `POST /api/sach-ai` (defined directly in `index.ts`, NOT in `routes.ts`)

---

## Frontend: `frontend/client/src/`

```
frontend/client/src/
├── App.tsx                   # Root app: providers + all wouter routes
├── main.tsx                  # ReactDOM.createRoot entry point
├── index.css                 # Global styles + CSS variables (Tailwind v4 theme tokens)
├── vite-env.d.ts             # Vite type shims
│
├── pages/
│   ├── home.tsx              # Landing page (/)
│   ├── report.tsx            # D2C report view (/report)
│   ├── processing.tsx        # PDF upload + job polling page (/processing)
│   ├── policychecker.tsx     # PolicyChecker landing (/policychecker)
│   ├── analyze.tsx           # Analyze page (/analyze)
│   ├── life.tsx              # Life insurance info page (/life)
│   ├── term.tsx              # Term insurance info page (/term)
│   ├── vehicle.tsx           # Vehicle insurance info page (/vehicle)
│   ├── calculator.tsx        # Insurance calculator (/calculator)
│   ├── calculator-report.tsx # Calculator report (/calculator/report/:uuid)
│   ├── compare.tsx           # Compare page (/compare)
│   ├── compare/              # Multi-step compare flow (upload-step, profile-step, results-step)
│   ├── CompareSample.tsx     # Sample compare page
│   ├── blog.tsx + blog/      # Blog listing + individual post (/blog, /blog/:id)
│   ├── hospitals.tsx         # Hospital network finder (/find-provider, /hospitals)
│   ├── help.tsx, account.tsx, mission.tsx, vision.tsx, team.tsx, why-indsure.tsx
│   ├── login.tsx, signup.tsx # Stub public auth pages (non-functional)
│   ├── PrivacyPolicy.tsx, TermsOfService.tsx, CookiePolicy.tsx, GrievanceOfficer.tsx
│   │
│   ├── agent/                # Agent portal pages (all protected by AgentProtectedRoute)
│   │   ├── LoginNew.tsx      # Agent login (/agent/login)
│   │   ├── SignupFlow.tsx    # Signup entry (delegates to SignupStep1/2)
│   │   ├── SignupStep1.tsx + SignupStep2.tsx
│   │   ├── DashboardNew.tsx  # Agent dashboard (/agent/dashboard)
│   │   ├── DemoDashboard.tsx # Demo mode dashboard (/agent/demo)
│   │   ├── Uploads.tsx       # Policy PDF upload (/agent/uploads)
│   │   ├── PoliciesNew.tsx   # Policy list (/agent/policies)
│   │   ├── PolicyDetail.tsx  # Single policy detail (/agent/policies/:id)
│   │   ├── MyQueue.tsx       # Action queue (/agent/my-queue)
│   │   ├── ReportsNew.tsx    # Reports list (/agent/reports)
│   │   ├── SettingsNew.tsx   # Agent settings (/agent/settings)
│   │   ├── Clients.tsx + ClientDetail.tsx  # Client management (legacy; not routed in App.tsx)
│   │   ├── AgentProfile.tsx  # Profile page (legacy)
│   │   ├── SharedReport.tsx  # Shared public report view (legacy)
│   │   └── [Login.tsx, Settings.tsx — old versions; use *New.tsx variants]
│   │
│   ├── admin/
│   │   └── AdminPanel.tsx    # Admin panel (/admin)
│   │
│   └── report/
│       └── PublicReport.tsx  # Public report view (/report/:token)
│
├── components/
│   ├── ui/                   # shadcn/Radix UI primitives (Button, Card, Dialog, Input, etc.)
│   ├── agent/                # Agent-specific components (ProtectedRoute, AgentLayout, AgentNav, etc.)
│   ├── admin/                # Admin components
│   ├── charts/               # Chart components (Recharts wrappers)
│   ├── hospitals/            # Hospital finder components
│   │
│   ├── PolicyAuditReport.tsx # Main audit report renderer (very large: 75KB)
│   ├── SachAIChat.tsx        # Sach AI floating chat widget (global, rendered in App.tsx)
│   ├── Header.tsx + Footer.tsx + MobileNav.tsx
│   ├── LifeInsuranceCalculator.tsx
│   ├── VehicleInsuranceCalculator.tsx + VehicleInsuranceComparer.tsx
│   ├── LifeInsuranceComparer.tsx
│   ├── PDFReport.tsx + PolicyPDFDocument.tsx + PDFPasswordModal.tsx
│   ├── ErrorBoundary.tsx     # Wraps entire app in App.tsx
│   ├── ReportDispatcher.tsx  # Routes to correct report renderer by type
│   └── [various feature components]
│
├── context/
│   └── AgentContext.tsx      # AgentProvider: Supabase auth → agent profile context
│
├── hooks/
│   ├── use-analysis.tsx      # AnalysisProvider: manages policy analysis job state
│   ├── use-comparison.tsx    # ComparisonProvider: policy comparison state
│   ├── use-theme.tsx         # ThemeProvider: dark/light theme toggle
│   ├── use-agent-metrics.ts  # Fetches agent dashboard metrics from API
│   ├── use-notifications.tsx # Agent notification fetching
│   ├── use-page-transition.tsx # Page transition scroll behavior
│   ├── use-toast.ts          # shadcn toast hook
│   ├── usePolicySession.ts   # Policy session persistence (localStorage)
│   ├── use-mobile.tsx        # `useIsMobile()` responsive hook
│   ├── use-seo.tsx           # SEO meta tag management
│   ├── use-form-validation.ts
│   └── use-smart-defaults.ts # Smart form defaults
│
├── lib/
│   ├── queryClient.ts        # TanStack Query client setup
│   ├── supabase.ts           # Supabase JS client (public anon key)
│   └── utils.ts              # `cn()` utility (clsx + tailwind-merge)
│
└── types/                    # TypeScript type declarations
```

---

## Naming Conventions

### Files
- **React pages/components**: PascalCase, `.tsx` extension (e.g., `DashboardNew.tsx`, `PolicyAuditReport.tsx`)
- **Hooks**: kebab-case prefixed with `use-` (e.g., `use-analysis.tsx`, `use-agent-metrics.ts`)
- **Utility/lib files**: camelCase (e.g., `queryClient.ts`, `supabase.ts`)
- **Backend services/utils**: camelCase (e.g., `aiService.ts`, `analysisPipeline.ts`, `policyWordingsFetcher.ts`)
- **New vs old**: Pages being replaced get `New` suffix (e.g., `DashboardNew`, `PoliciesNew`, `LoginNew`). Old files without `New` suffix are legacy — do not modify them.

### Components
- PascalCase matching filename
- Default export always at end of file
- Named exports for types and sub-components

### Variables and Functions
- camelCase for variables, functions, hooks
- PascalCase for React components and TypeScript types/interfaces
- SCREAMING_SNAKE_CASE for exported constants (e.g., `MASTER_AUDIT_PROMPT`, `PROMPT_VERSION`)

### CSS Classes
- Tailwind utility classes only; no custom CSS class names except in `index.css` for global utilities/tokens

---

## Component Organization

Components are **type-based** at the top level, then **feature-based** within subfolders:
- `components/ui/` — generic, reusable primitives (shadcn)
- `components/agent/` — agent-portal-specific components
- `components/admin/` — admin-specific components
- `components/charts/` — chart wrappers
- Root of `components/` — large feature components (PolicyAuditReport, SachAIChat, etc.)

---

## How API Calls Are Made From Frontend

All API calls go through relative URLs (prefixed `/api/`) which Vite proxies to the Express backend at port 5000.

```ts
// Pattern 1: Direct fetch (used in older components)
const res = await fetch('/api/analyze', { method: 'POST', body: formData });
const data = await res.json();

// Pattern 2: TanStack Query (preferred in newer components)
const { data } = useQuery({
  queryKey: ['agent-metrics'],
  queryFn: () => fetch('/api/agent/metrics').then(r => r.json()),
});

// Pattern 3: Authenticated requests (agent portal)
const session = await supabase.auth.getSession();
const token = session.data.session?.access_token;
const res = await fetch('/api/agent/me', {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## How Errors Are Handled

**Backend**: All route errors return `{ error: string, details?: string }` with appropriate HTTP status codes. A global error middleware catches unhandled errors.

**Frontend**: 
- `ErrorBoundary.tsx` wraps the entire app for React render errors
- API errors are surfaced via toast notifications (Sonner / `use-toast`)
- Loading states use Skeleton components from `@/components/ui/skeleton`
- 404 state via `/pages/not-found.tsx`

---

## Where Database Schema and Queries Live

- **Drizzle schema** (stub only): `shared/schema.ts` — only has a `users` table stub
- **Real database schema**: Lives in Supabase. SQL setup scripts are in root-level `.sql` files (`setup_notifications.sql`, `setup_public_reports.sql`, etc.)
- **All queries**: Raw SQL via `pg.Pool` inside `backend/server/routes.ts`. No ORM query builder used in production routes.
