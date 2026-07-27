# product.md — IndSure Product Overview

> Written for AI coding assistants to understand the product before making any changes.

---

## What This Product Does

IndSure is an AI-powered insurance transparency platform for the Indian market. It allows users to upload their existing insurance policy PDFs and receive an objective, AI-generated audit report that scores the policy, identifies coverage gaps, highlights claim-rejection risks, and recommends whether the user should switch. The platform also has an **Agent Portal** where licensed insurance agents can upload their clients' policies in bulk, track analysis results, and share personalised audit reports with their clients via unique public links.

---

## Who the End User Is

There are two distinct user types:
1. **D2C Consumer** (anonymous): An individual Indian policyholder who visits the public site, uploads their health/life/vehicle insurance PDF, and receives a free audit report. No account required for basic analysis.
2. **Insurance Agent** (authenticated): A licensed insurance agent who logs in with a Supabase account, manages multiple client policies, views a dashboard with portfolio analytics, and sends shareable reports to clients.

---

## Main Features and Pages That Exist Today

### D2C / Public Features
| Feature | Route | Status |
|---|---|---|
| Landing / Home | `/` | ✅ Live |
| Policy Checker landing | `/policychecker` | ✅ Live |
| PDF Upload + AI Analysis | `/processing` (after upload) | ✅ Live |
| Audit Report view | `/report` | ✅ Live |
| Public shared report | `/report/:token` | ✅ Live |
| Compare policies | `/compare` (multi-step flow) | ✅ Live |
| Life insurance info + comparer | `/life` | ✅ Live |
| Term insurance info | `/term` | ✅ Live |
| Vehicle insurance info + comparer | `/vehicle` | ✅ Live |
| Insurance calculator (life) | `/calculator` | ✅ Live |
| Calculator report | `/calculator/report/:uuid` | ✅ Live |
| Hospital/network finder | `/hospitals`, `/find-provider` | ✅ Live |
| Blog | `/blog`, `/blog/:id` | ✅ Live |
| Mission, Vision, Team, Why IndSure | `/mission`, `/vision`, etc. | ✅ Live |
| Legal pages (Privacy, Terms, Cookie, Grievance) | `/privacy-policy`, etc. | ✅ Live |
| Sach AI chat widget | Global (floating) | ✅ Live — AI insurance Q&A chatbot |

### Agent Portal (Authenticated)
| Feature | Route | Status |
|---|---|---|
| Agent login | `/agent/login` | ✅ Live |
| Agent signup (2-step) | `/agent/signup` | ✅ Live |
| Agent dashboard | `/agent/dashboard` | ✅ Live |
| Demo dashboard | `/agent/demo` | ✅ Live — sample data for demos |
| Policy uploads | `/agent/uploads` | ✅ Live |
| Policies list | `/agent/policies` | ✅ Live |
| Policy detail + audit report | `/agent/policies/:id` | ✅ Live |
| Action queue (My Queue) | `/agent/my-queue` | ✅ Live |
| Reports list | `/agent/reports` | ✅ Live |
| Agent settings | `/agent/settings` | ✅ Live |

### Admin
| Feature | Route | Status |
|---|---|---|
| Admin panel | `/admin` | ⚠️ Basic only |

---

## Main User Flows

### D2C: Upload and Audit
1. User visits `/` or `/policychecker`
2. Uploads PDF → POST to `/api/analyze`
3. Redirected to `/processing` where frontend polls `GET /api/analyze/status/:jobId`
4. On completion, navigates to `/report` to view `PolicyAuditReport` component
5. Optionally clicks "Generate PDF" (uses `/api/generate-pdf` server-side Playwright)

### D2C: Compare Policies
1. User visits `/compare`
2. Upload step → uploads two PDFs
3. Profile step → enters age, geography, medical history
4. Results step → side-by-side comparison of two policies

### Agent: Manage Client Portfolio
1. Agent logs in at `/agent/login` (Supabase auth)
2. Lands on `/agent/dashboard` → sees portfolio score distribution, expiry alerts, client count
3. Uploads client PDFs at `/agent/uploads` → batch analysis triggered
4. Views policies at `/agent/policies` → table of all clients with score, insurer, expiry
5. Clicks a policy → `/agent/policies/:id` → full audit report for that client
6. Shares report → creates a public link (`/report/:token`) to send to client
7. Tracks action items at `/agent/my-queue`

### Sach AI Chat Flow
1. User clicks floating chat widget (rendered globally in `App.tsx`)
2. Types question (max 500 chars); personal data (Aadhaar, email, phone) is rejected
3. Message sent to `POST /api/sach-ai` → streamed Gemini response rendered in real time
4. Session-level rate limit: 20 messages per hour

---

## What Is NOT Built Yet or Clearly Incomplete

- **Consumer auth**: `/login` and `/signup` are stubs — no real public user account system exists
- **Payment/subscriptions**: No billing, plan tiers, or payment gateway
- **Real insurer-site or IRDAI wording scraping**: `policyWordingsFetcher.ts` has comments indicating insurer website and IRDAI API calls are planned but currently commented out; only internal knowledge base + fallback works
- **Admin panel**: `/admin` (`AdminPanel.tsx`) exists but is basic — no deep data management
- **Agent client management pages**: `Clients.tsx` and `ClientDetail.tsx` exist but are not routed in `App.tsx`
- **IRDAI-compliant motor policy analysis**: `vehicleInsurancePrompt.ts` exists but the vehicle analysis flow is less tested than health
- **Notification delivery**: `notifications` table and basic API exists; no real push or email notification system
- **Invite code validation**: `invite_code` field in agents table; invite flow partially started but not enforced

---

## Domain-Specific Terminology

| Term | Meaning |
|---|---|
| **Audit Report** | The AI-generated JSON analysis of a policy PDF |
| **Audit Score** | Overall numeric score (0–100) for a policy; higher = better |
| **Breakdown** | The four score penalty components: `net_cover_penalty`, `claim_rejection_risk`, `oop_exposure`, `coverage_quality_gap` |
| **Final Verdict** | Top-level recommendation: e.g., "Switch", "Keep", "Review" |
| **Flaws** | Specific identified weaknesses in the policy (array in analysis result) |
| **Policy Wordings** | Official insurer-published language for a specific plan (sourced from internal KB) |
| **WORDING_MATCHED** | Boolean injected into prompt — whether official wordings were found for this policy |
| **Analysis Job** | Async job record for a policy analysis (stored in `analysis_jobs` table) |
| **Public Report** | A shareable link version of an audit report stored in `public_reports` table |
| **Agent** | A licensed insurance agent with a platform account |
| **Client** | An agent's customer/policyholder (row in `clients` table) |
| **Sach AI** | The floating chat widget; "Sach" = truth in Hindi; factual insurance Q&A bot |
| **D2C** | Direct-to-Consumer — the public-facing part of the product |
| **Knowledge Base (KB)** | `backend/server/knowledge_base/` — directory of `.txt` wording files |
| **Provenance** | Metadata about where policy wording was sourced from (source, checksum, confidence, retrieved_at) |
| **DPDP** | Digital Personal Data Protection — Indian data privacy law; governs the 90-day data retention and grievance flows |
| **OOP Exposure** | Out-of-pocket exposure — one of the four audit score penalty categories |
| **Should Switch** | Binary flag in agent dashboard indicating if client should switch insurance |
| **Painpoints** | Array of specific coverage gaps shown per policy in agent views |
| **IRDAI** | Insurance Regulatory and Development Authority of India |
| **CIS** | Customer Information Sheet — a standardized insurance document |
| **UIN** | Unique Identification Number for an insurance product (IRDAI-issued) |
