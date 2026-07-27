# How IndSure Protects Advisor & Client Data

*Definitive data-protection overview. Every "in place today" claim below is implemented in the live codebase and verified — not aspirational. Roadmap items are labelled as such. Last updated 2026-06-26.*

---

## Who we hold data for, and our duty to them

IndSure serves **insurance advisors** as our direct customers. Each advisor brings their **book of clients** (policyholders). So we hold two layers of sensitive data, and we are the **processor** for both:

1. **Advisor account data** — the advisor's identity, login, and their private book of business.
2. **End-client data** — the advisor's clients' names, contact details, and uploaded policy documents plus the analysis derived from them.

**Core principle:** an advisor's book is *theirs*. It is isolated from every other advisor at the database layer, never sold, never shared, never cross-used. We earn the advisor's trust by making that isolation structural — enforced by the system, not by policy.

---

## The trust model in one line

> **One advisor physically cannot access another advisor's clients — even if the application layer were bypassed — because isolation is enforced inside the database itself. Every access path (records, AI, documents) is gated by verified ownership, and every access is logged.**

---

## 1. Isolation — enforced at the database, not just the app

- **Row-Level Security (RLS) is enabled on every table** in our PostgreSQL/Supabase database. Each row of client, customer, policy, report, and calculation data is scoped to its owning advisor (`agent_id = authenticated user`). The database itself refuses to return another advisor's rows, regardless of what the application asks for.
- The browser app talks to the database through a **restricted key governed entirely by those RLS rules** — it is incapable of reading across advisors.
- Our backend API enforces an **ownership check on every sensitive route**: the advisor's identity is always derived from a **cryptographically verified login token**, never from anything the client sends in the request body. The pattern `WHERE id = $1 AND agent_id = $2` is applied consistently across every client read, update, delete, share, download, and report route.
- **Administrative access** is gated by a separate middleware that re-derives admin status from the database on every request — admin rights cannot be forged from a token.

**What this means for an advisor:** a compromise of one advisor's credentials cannot expose any other advisor's book.

---

## 2. Every access path is ownership-gated — including AI and documents

A policy analysis contains a client's personal and policy information. We close every route that touches it:

- **Record access** — all client CRUD is ownership-scoped (above).
- **Analysis status & results** — analysis jobs are stamped with their owning advisor; the status endpoint returns a result only to that advisor. The public (anonymous) analyzer can never reach an advisor-owned job.
- **AI assistant (Sach AI)** — the assistant grounds its answers on a client's policy **only after verifying the requester owns that policy**. Without verified ownership, it answers generically and never exposes policy details.
- **Document download** — original policy PDFs are served only to the owning advisor, against the same ownership check.

*(These three analysis/AI/document paths were independently security-reviewed and hardened on 2026-06-26; the fixes are live and verified in production.)*

---

## 3. Access audit log — full accountability

- Every view or modification of a client record is written to an **append-only audit log**: which advisor, which client, what action, from which IP and device, and when.
- This lets us answer, definitively, **"who accessed this client's data, and when?"** — the question that matters most for trust and for regulatory due diligence.
- The log is fire-and-forget and never blocks or slows a request.

---

## 4. Data minimisation & retention — DPDP-aligned by design

- **We keep data only while the purpose exists.** Data tied to an **active client is never auto-deleted** — the advisor keeps their working history for as long as that client is theirs.
- **Orphaned and untethered data is purged automatically** once a client/customer is removed and a grace window passes (configurable; 90 days by default). This is lifecycle-based retention, mapping directly to the **DPDP Act 2023** principles of purpose limitation and storage limitation.
- **Uploaded documents are transient** — raw policy files are cleaned from the working directory within 24 hours; we retain the structured result under the same isolation, not a permanent pile of raw PDFs.
- We collect only what's needed to produce the analysis — **no Aadhaar, no financial account numbers required.**

---

## 5. AI safety — PII never leaks into a model

- Before any query reaches our AI assistant, an input filter **blocks Aadhaar numbers, phone numbers, email addresses, and policy numbers**. The request is rejected outright (not silently redacted), so partial identifiers cannot slip through.
- AI grounding is ownership-verified (Section 2). AI outputs are stored under the same RLS isolation as all other data.

---

## 6. Transport & infrastructure security

- **All traffic is encrypted in transit (HTTPS/TLS)** via an nginx reverse proxy.
- **Rate limiting** on all API routes blocks scraping and brute-force attempts against client data, with an additional per-session limit on the AI assistant.
- **Strict CORS allowlist** — only our own domains can call the API from a browser.
- **Production error responses are sanitised** — stack traces, internal paths, and database details are never returned to a client, so the system cannot be probed for its internals.
- **SSRF protection** prevents the document-rendering pipeline from being tricked into reaching internal or cloud-metadata endpoints — a common route to credential theft.
- **Shared/public report links** are gated by unguessable tokens (UUIDv4), respect an active/revoked flag, and expose only a public-safe subset of fields — never the full record.

---

## 7. What we are hardening next (roadmap — shows maturity)

| Item | Status |
|------|--------|
| Client-data **access audit log** | ✅ **Live** |
| **Analysis/AI ownership hardening** (IDOR closure) | ✅ **Live** |
| **Lifecycle-aware DPDP retention** | ✅ **Live** |
| Secrets moved to a managed secrets store (AWS Parameter Store) | In progress |
| **Web Application Firewall (AWS WAF)** in front of the API | Planned |
| Dedicated staging database (separate from production) | Planned |
| **SOC 2 Type I** | Kicking off — 3–6 month process |
| Formal DPDP gap assessment + advisor Data Processing Agreements | Pre–Series A |

---

## 8. Three lines to stand behind

1. **Isolation:** "One advisor cannot query another advisor's clients — enforced by the database, not by trust."
2. **Accountability:** "Every access to a client's data is logged — we can show exactly who looked at what, and when."
3. **Minimisation:** "We never auto-delete an advisor's active client data, and we purge what's no longer needed — DPDP storage-limitation by design."

---

*All technical claims verified against the live codebase (`backend/server/routes.ts`, `backend/server/index.ts`) and confirmed in production on 2026-06-26.*
