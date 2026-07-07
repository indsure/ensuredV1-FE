# Agent Workflow Architecture

A full breakdown of every page, component, and API interaction in the Agent portal.

---

## Route Map

```
/agent/login                → AgentLogin
/agent/signup               → AgentSignupStep1
/agent/signup/empanelment   → AgentSignupStep2
/agent/dashboard            → AgentDashboard
/agent/clients              → AgentClients [stub]
/agent/client/:id           → AgentClientDetail [stub]
/report/:uuid               → PublicReport (shared, no auth)
```

All agent routes (except `/report/:uuid`) are wrapped in `ProtectedRoute`, which validates the Supabase session and redirects to `/agent/login` if unauthenticated.

---

## Page: `/agent/login`

**File:** `pages/agent/Login.tsx`

**Purpose:** Authenticate an existing agent.

### State
| State | Type | Description |
|---|---|---|
| `email`, `password` | `string` | Login credentials |
| `loading` | `boolean` | Disables submit during API call |
| `error` | `string` | Inline error message |

### Flow
1. Agent enters email + password.
2. Calls `supabase.auth.signInWithPassword()`.
3. On success → `navigate('/agent/dashboard')`.
4. On error → shows "Invalid email or password" message.

**No backend API calls.** Auth is handled via Supabase directly.

---

## Page: `/agent/signup` (Step 1)

**File:** `pages/agent/SignupStep1.tsx`

**Purpose:** Collect agent details and validate an invite code.

### State
| Field | Description |
|---|---|
| `inviteCode` | Validated against `invite_codes` Supabase table |
| `fullName`, `email`, `phone`, `city` | Profile info |
| `experienceYears` | Integer, optional |
| `password` | Min 8 characters |

### Flow
1. Validates invite code via `supabase.from('invite_codes').select(...)`.
2. Creates auth user via `supabase.auth.signUp()`.
3. Creates profile row via `POST /api/agent/create-profile` (bypasses RLS).
4. Marks invite code as used via Supabase direct update.
5. Navigates to Step 2 → `/agent/signup/empanelment`.

### API Calls
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/agent/create-profile` | Inserts row into `agents` table, bypasses RLS |

---

## Page: `/agent/signup/empanelment` (Step 2)

**File:** `pages/agent/SignupStep2.tsx`

**Purpose:** Let the agent select which insurers they are empanelled with.

### State
| State | Description |
|---|---|
| `search` | Filters from `POPULAR_INSURERS` list |
| `selected` | Array of selected insurer names |

### Flow
1. Agent searches/selects insurers from a pre-defined list (14 popular insurers).
2. Custom insurers can be typed in and added (free text).
3. On "Finish" → inserts rows into `empanelments` table via `supabase.from('empanelments').insert(rows)`.
4. Navigates to `/agent/dashboard`.

**This step is skippable.** Empanelments can be updated later.

---

## Page: `/agent/dashboard`

**File:** `pages/agent/Dashboard.tsx`

**Purpose:** The main workspace for an agent. Shows portfolio stats, client table, and allows bulk policy uploads.

### Layout
```
┌─────────────────────────────────────────────────────┐
│  [Sidebar: IndSure logo | Nav Links | Agent Avatar] │
├──────────┬──────────────────────────────────────────┤
│ Topbar   │  "Analyze Policies" btn | Bell | Avatar  │
├──────────┴──────────────────────────────────────────┤
│  [4 Stat Cards: Avg Score | Clients | Expiring | Flaws] │
│                                                     │
│  [Client Table: Name | Insurer | Sum Insured | Expiry | Score | Flaws | Switch | Report] │
│                                                     │
│  [Performance History placeholder] | [AgentSummaryCard] │
└─────────────────────────────────────────────────────┘
```

### State
| State | Description |
|---|---|
| `clients` | Array of client records fetched from Supabase |
| `stats` | Computed: `avgScore`, `totalClients`, `expiringSoon`, `totalFlaws` |
| `notifications` | Real-time notification list |
| `unreadCount` | Badge count on bell icon |
| `editingCell` | Inline edit target for name/expiry fields |
| `isUploadModalOpen` | Controls `UploadModal` visibility |
| `isSwitchModalOpen` | Controls `SwitchModal` visibility |

### Data Fetching
| Source | Method | Description |
|---|---|---|
| Supabase `clients` | `select('*').eq('agent_id', userId)` | Loads all clients |
| Supabase `notifications` | `select('*').eq('agent_id', userId)` | Loads last 20 |
| `/api/agent/me` | `GET` with `x-user-id` header | Fetches agent name (bypasses RLS) |

### Real-time Subscriptions (Supabase Channels)
| Channel | Event | Trigger |
|---|---|---|
| `dashboard_changes` | `postgres_changes` on `clients` | Refetches all client data |
| `notification_changes` | `INSERT` on `notifications` | Appends new notification + shows toast |
| `notification_changes` | `UPDATE` on `notifications` | Refetches notification list |

### Client Table: Row Actions
| Action | Trigger | Description |
|---|---|---|
| **Inline Edit** | Click pencil icon | Edits `policyholder_name` or `expiry_date` in-place |
| **Retry** | Click retry icon on `error` status | `PATCH /api/agent/trigger-batch-process` |
| **Switch** | "Switch Available" badge | Opens `SwitchModal` for AI recommendation |
| **View Report** | "View" link | Navigates to `/report/:clientId` |

### Switch Opportunity Logic
A "Switch Available" badge appears when:
- `client.status === 'done'`
- `client.score < 75`
- Flaws contain keywords: `room rent capping`, `co-payment`, or `restoration`

---

## Component: `UploadModal`

**File:** `components/agent/UploadModal.tsx`

**Triggered by:** "Analyze Policies" button on the Dashboard topbar.

### Upload Pipeline (Sequential Steps)
```
1. Agent selects up to 10 PDF files via drag & drop or file picker.

2. POST /api/agent/create-batch
   → Creates a batch record in the DB.
   → Returns { id: batchId }

3. For EACH file (in parallel via Promise.all):
   a. Upload PDF to Supabase Storage → bucket: 'policy-pdfs', path: '{agentId}/{fileId}.pdf'
   b. Generate 24-hour signed URL via Supabase Storage
   c. POST /api/agent/add-client → Creates a client row (status: 'pending')

4. POST /api/agent/trigger-batch-process (fire-and-forget)
   → Backend starts processing each PDF one by one with Gemini AI.

5. Dashboard auto-updates via Supabase Realtime as client statuses change
   (pending → processing → done / error).
```

---

## Component: `SwitchModal`

**File:** `components/agent/SwitchModal.tsx`

**Triggered by:** "Switch Available" badge click in the client table.

### Flow
1. Opens with current client's `insurer`, `score`, and `flaws` displayed.
2. Immediately calls `POST /api/agent/switch-recommendation` → AI generates a `SwitchRecommendation` with: `recommended_insurer`, `recommended_plan`, `improvements`, `premium_delta`.
3. Side-by-side UI: **Current Policy** (with flaws) vs. **Recommended Switch** (with improvements).
4. "Share with Client" button → `POST /api/agent/public-report` → returns a `uuid` → copies `/report/{uuid}` to clipboard.

---

## Component: `NotificationDropdown`

**File:** `components/agent/NotificationDropdown.tsx`

Displays the real-time notification bell. Notifications are created on the backend when an AI analysis completes. Supports "Mark as read" and "Mark all as read" actions.

---

## Component: `AgentSummaryCard`

**File:** `components/agent/AgentSummaryCard.tsx`

Shown at the bottom-right of the Dashboard. Fetches and displays a summary of the agent's profile, empanelments, and a performance badge.

---

## Component: `ProtectedRoute`

**File:** `components/agent/ProtectedRoute.tsx`

A wrapper component that checks `supabase.auth.getUser()` on mount. If no active session is found, redirects to `/agent/login`.

---

## Backend API Reference (Agent Routes)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/agent/create-profile` | Inserts agent record into `agents` table |
| `GET` | `/api/agent/me` | Returns agent profile by `x-user-id` header |
| `POST` | `/api/agent/create-batch` | Creates a `batch_uploads` record |
| `POST` | `/api/agent/add-client` | Creates a `clients` record (status: `pending`) |
| `POST` | `/api/agent/trigger-batch-process` | Starts async PDF analysis via Gemini |
| `POST` | `/api/agent/switch-recommendation` | AI-powered policy switch recommendation |
| `POST` | `/api/agent/public-report` | Generates a shareable public report UUID |

---

## Database Tables (Agent-Related)

| Table | Description |
|---|---|
| `agents` | Agent profiles (id, name, city, experience) |
| `invite_codes` | One-time codes for onboarding |
| `empanelments` | Agent ↔ Insurer mapping |
| `clients` | One row per policy analyzed (status, score, flaws, etc.) |
| `batch_uploads` | Groups multiple policies uploaded at once |
| `notifications` | Per-agent real-time notifications |

---

## End-to-End Agent Flow (Summary)

```
Login / Signup
     ↓
Dashboard (view portfolio stats + client table)
     ↓
[Upload Policies] → UploadModal
     ↓
Supabase Storage upload + backend creates `clients` rows (status: pending)
     ↓
Gemini AI processes each PDF asynchronously
     ↓
`clients` table updates (status → done / error)
     ↓
Dashboard auto-refreshes via Supabase Realtime
     ↓
Agent reviews score, flaws, expiry date
     ↓
[Switch Available?] → SwitchModal → AI Recommendation → Share report link
     ↓
Public report accessible at /report/:uuid (no auth required)
```
