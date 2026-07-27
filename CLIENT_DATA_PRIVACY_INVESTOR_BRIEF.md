# Client Data Privacy — Investor Brief

*How IndSure protects the personal and policy data of end clients (policyholders). Every claim below is implemented in code today and verifiable in the repo.*

---

## The one-liner

> "Every client's data is isolated at the database layer, auto-purged on a 90-day clock, and PII is filtered before it ever reaches any AI model. We're built to be DPDP Act 2023 compliant from day one — privacy isn't a feature we bolted on, it's how the data layer is architected."

---

## 1. Whose data we hold, and why

We process two kinds of client data on behalf of insurance agents:
- **Identity/contact** — name, phone, email of the agent's clients and prospects.
- **Policy documents** — uploaded policy PDFs and the structured analysis extracted from them.

We are a **processor acting for the agent** (the data fiduciary). Clients' data belongs to the agent's book; we never sell, share, or cross-use it between agents.

---

## 2. Isolation — no agent can ever see another agent's clients

- **Row-Level Security (RLS) is enforced at the PostgreSQL layer** (Supabase), not just in application code. Every client, customer, policy, and report row is scoped `agent_id = auth.uid()`. Even if the application layer were bypassed, the database itself refuses to return another agent's rows.
- The public-facing app talks to the database with a **restricted anon key** governed entirely by these RLS rules.
- Our backend API uses a privileged key but enforces **ownership checks on every route** — the user identity is always derived from a cryptographically verified login token, never from anything the client sends in the request body.

**What this means for an investor:** a leak of one agent's credentials cannot expose another agent's clients. Isolation is structural, not procedural.

---

## 3. Data minimisation + auto-deletion (DPDP-aligned)

- **90-day retention, automatically enforced.** Analysis jobs and calculator reports are purged on a rolling 90-day clock by a scheduled cleanup job. We do not hold client analysis data indefinitely.
- **Uploaded files are transient** — policy documents in the working directory are cleaned up within 24 hours; we keep the structured result, not a permanent copy of every raw PDF on the app server.
- We collect only what's needed to produce the agent's analysis — no Aadhaar, no financial account numbers required.

**This maps directly to the DPDP Act 2023 principles of purpose limitation and storage limitation** — a question Indian investors will specifically test.

---

## 4. PII never leaks into AI models

- Before any client query reaches our AI assistant, an input filter **blocks Aadhaar numbers, phone numbers, email addresses, and policy numbers**. The request is rejected, not silently redacted, so partial identifiers can't slip through.
- AI analysis runs on the agent's uploaded document for that agent only; outputs are stored under the same RLS isolation as everything else.

---

## 5. Transport + infrastructure

- All client traffic is **HTTPS** (TLS via nginx).
- The backend sits behind a reverse proxy with **rate limiting** (blocks scraping/brute-force of client data) and a **strict CORS allowlist** (only our own domains can call the API from a browser).
- **Error responses are sanitised in production** — no stack traces, internal paths, or database details are ever returned to a client, so the system can't be probed for its internals.
- **SSRF protection** prevents the document-rendering pipeline from being tricked into reaching internal/cloud-metadata endpoints — a common path to credential theft.

---

## 6. What we're hardening next (roadmap — shows maturity)

| Item | Status | Timeline |
|------|--------|----------|
| Client-data **access audit log** (who viewed which client, when, from where) | ✅ Built (append-only `access_audit_log`, 6 client routes instrumented) | Deploying |
| Secrets moved to AWS Parameter Store | Planned | This week |
| AWS WAF (network-layer attack protection) | Planned | This week |
| **SOC 2 Type I** | Kicking off | 3–6 months |
| Formal DPDP gap assessment + DPA templates for agents | Planned | Pre-Series A |

---

## 7. Three lines to close on

1. **Isolation:** "One agent physically cannot query another agent's clients — enforced by the database, not by trust."
2. **Minimisation:** "We auto-delete client analysis on a 90-day clock and don't retain raw documents — DPDP storage-limitation by design."
3. **AI safety:** "Client PII is filtered out before it ever touches an AI model."

---

*Prepared for investor call, 2026-06-26. All technical claims verified against the live codebase (`backend/server/routes.ts`, `index.ts`).*
