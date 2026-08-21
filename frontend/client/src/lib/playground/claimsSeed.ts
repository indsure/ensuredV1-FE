/**
 * Demo claims for the agent playground.
 *
 * Claims are the one part of the agent portal that does NOT go through
 * supabase-js — every read and write is an authenticated call to the backend
 * (see lib/claims.ts and the note at the top of it). So mockClient's query
 * builder never sees them, and without this file the Claims tab in playground
 * mode would fire real /api/agent/claims requests, get 401 back and show an
 * error. This module is the claims half of the mock: an in-memory store plus
 * the handful of operations the two claim pages perform.
 *
 * Every date is computed from `now`, exactly like ./seed — nothing here is a
 * literal, so the demo never needs re-dating. The purge warning is always
 * genuinely 4 days out, the settled claim always closed a fortnight ago.
 *
 * The six claims are chosen to cover every state the UI can render:
 *   1. under process, no query        — the ordinary middle of a claim
 *   2. one open query                 — the insurer is waiting on the advisor
 *   3. three query rounds, one open   — the messy claim, and why rounds are a list
 *   4. purge warning, extendable      — the retention clock about to fire
 *   5. settled + consent + purged     — files gone, letter and record kept
 *   6. rejected + purged              — the other ending
 */

import type { Claim, ClaimDetail, ClaimDocument, ClaimEvent, ClaimQuery } from "@/lib/claims";

const now = new Date();
const day = 24 * 60 * 60 * 1000;
const ago = (d: number) => new Date(now.getTime() - d * day).toISOString();
const dateAgo = (d: number) => new Date(now.getTime() - d * day).toISOString().slice(0, 10);

let seq = 0;
const uid = (p: string) => `${p}-${++seq}`;

function doc(
  claimId: string,
  category: ClaimDocument["category"],
  docType: string,
  filename: string,
  kb: number,
  daysAgo: number,
  queryId: string | null = null
): ClaimDocument {
  return {
    id: uid("cdoc"),
    claim_id: claimId,
    query_id: queryId,
    category,
    doc_type: docType,
    filename,
    file_size: kb * 1024,
    mime_type: filename.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
    uploaded_at: ago(daysAgo),
  };
}

function ev(claimId: string, status: string, note: string | null, daysAgo: number): ClaimEvent {
  return { id: uid("cev"), claim_id: claimId, status, note, occurred_at: ago(daysAgo) };
}

type Seeded = ClaimDetail;

function buildClaims(): Seeded[] {
  const A = "demo-agent-0000-0000-000000000001";

  const base = (over: Partial<ClaimDetail>): ClaimDetail => ({
    id: uid("claim"),
    agent_id: A,
    customer_id: uid("cust"),
    customer_name: "—",
    customer_phone: null,
    claim_type: "reimbursement",
    status: "under_process",
    insurer: null,
    tpa: null,
    policy_number: null,
    hospital: null,
    ailment: null,
    claimed_amount: null,
    settled_amount: null,
    admitted_on: null,
    discharged_on: null,
    retention_started_at: null,
    purge_at: null,
    extension_used: false,
    documents_purged_at: null,
    proof_consent_at: null,
    closed_at: null,
    created_at: ago(1),
    documents: [],
    queries: [],
    events: [],
    ...over,
  });

  /* 1 ── ordinary claim, under process, nothing wrong ─────────────────────── */
  const c1 = base({
    customer_name: "Deep Shah",
    customer_phone: "+91 99000 12121",
    claim_type: "cashless",
    status: "under_process",
    insurer: "Niva Bupa",
    tpa: "Medi Assist",
    policy_number: "NB/2024/8891234",
    hospital: "Lilavati Hospital, Mumbai",
    ailment: "Fracture, left radius",
    claimed_amount: 185000,
    admitted_on: dateAgo(17),
    discharged_on: dateAgo(15),
    retention_started_at: ago(13),
    purge_at: ago(-17),
    created_at: ago(16),
  });
  c1.documents = [
    doc(c1.id, "personal", "Aadhaar — patient", "aadhaar-deep.pdf", 420, 13),
    doc(c1.id, "personal", "PAN card", "pan-deep.jpg", 180, 13),
    doc(c1.id, "personal", "Policy copy or e-card", "nivabupa-ecard.pdf", 96, 13),
    doc(c1.id, "case", "Pre-authorisation form", "preauth-signed.pdf", 1240, 13),
    doc(c1.id, "case", "TPA or insurer health card", "tpa-card.jpg", 240, 13),
    doc(c1.id, "case", "Doctor's advice for admission", "advice-note.pdf", 310, 12),
    doc(c1.id, "case", "X-ray report", "xray-left-radius.pdf", 2400, 12),
  ];
  c1.events = [
    ev(c1.id, "opened", "Claim opened", 16),
    ev(c1.id, "docs_received", "Collected X-ray and advice note from Deep", 13),
    ev(c1.id, "submitted", "Submitted on the Medi Assist portal", 12),
  ];

  /* 2 ── one open query ───────────────────────────────────────────────────── */
  const c2 = base({
    customer_name: "Ramesh Iyer",
    customer_phone: "+91 99000 34343",
    claim_type: "reimbursement",
    status: "query_raised",
    insurer: "Care Health",
    tpa: "Vidal Health",
    policy_number: "CH/2023/5567120",
    hospital: "Fortis, Bengaluru",
    ailment: "Dengue with thrombocytopenia",
    claimed_amount: 62000,
    admitted_on: dateAgo(26),
    discharged_on: dateAgo(21),
    retention_started_at: ago(19),
    purge_at: ago(-11),
    created_at: ago(27),
  });
  const q2 = {
    id: uid("cq"), claim_id: c2.id, seq: 1,
    question: "Platelet count reports for the full admission, and the treating doctor's signature on page 2 of the claim form.",
    raised_on: dateAgo(6), raised_by: "Vidal Health", resolved_on: null, resolution_note: null,
    created_at: ago(6),
  } as ClaimQuery;
  c2.queries = [q2];
  c2.documents = [
    doc(c2.id, "personal", "Aadhaar — patient", "aadhaar-ramesh.pdf", 388, 19),
    doc(c2.id, "personal", "Cancelled cheque", "cheque-hdfc.jpg", 210, 19),
    doc(c2.id, "case", "Discharge summary", "discharge-fortis.pdf", 640, 19),
    doc(c2.id, "case", "Itemised final bill", "final-bill.pdf", 880, 19),
    doc(c2.id, "case", "Platelet trend report", "platelet-chart.pdf", 300, 3, q2.id),
  ];
  c2.events = [
    ev(c2.id, "opened", "Claim opened", 27),
    ev(c2.id, "docs_received", null, 20),
    ev(c2.id, "submitted", "Uploaded to the Vidal portal", 19),
    ev(c2.id, "query_raised", "Round 1: platelet reports and a signature", 6),
  ];

  /* 3 ── three rounds, one still open — the messy claim ───────────────────── */
  const c3 = base({
    customer_name: "Meena Patel",
    customer_phone: "+91 99000 56565",
    claim_type: "cashless",
    status: "query_raised",
    insurer: "HDFC Ergo",
    tpa: "Medi Assist",
    policy_number: "HE/2022/3312890",
    hospital: "Sterling Hospital, Ahmedabad",
    ailment: "Angioplasty, single stent",
    claimed_amount: 340000,
    admitted_on: dateAgo(40),
    discharged_on: dateAgo(36),
    retention_started_at: ago(34),
    purge_at: ago(-26),
    extension_used: true,
    created_at: ago(41),
  });
  const q3a = {
    id: uid("cq"), claim_id: c3.id, seq: 1,
    question: "Name on the policy does not match the hospital record — send an ID proof reconciling both.",
    raised_on: dateAgo(30), raised_by: "Medi Assist", resolved_on: dateAgo(29),
    resolution_note: "Sent Aadhaar and the marriage certificate.", created_at: ago(30),
  } as ClaimQuery;
  const q3b = {
    id: uid("cq"), claim_id: c3.id, seq: 2,
    question: "Discharge summary is unsigned. Need the treating cardiologist's signature and stamp.",
    raised_on: dateAgo(22), raised_by: "Medi Assist", resolved_on: dateAgo(19),
    resolution_note: "Hospital re-issued it signed.", created_at: ago(22),
  } as ClaimQuery;
  const q3c = {
    id: uid("cq"), claim_id: c3.id, seq: 3,
    question: "Stent invoice with the batch number, and Part B of the claim form stamped by the hospital.",
    raised_on: dateAgo(4), raised_by: "HDFC Ergo", resolved_on: null, resolution_note: null,
    created_at: ago(4),
  } as ClaimQuery;
  c3.queries = [q3a, q3b, q3c];
  c3.documents = [
    doc(c3.id, "personal", "Aadhaar — patient", "aadhaar-meena.pdf", 402, 34),
    doc(c3.id, "personal", "PAN card", "pan-meena.jpg", 165, 34),
    doc(c3.id, "personal", "Policy copy or e-card", "hdfc-ergo-ecard.pdf", 120, 34),
    doc(c3.id, "case", "Pre-authorisation form", "preauth-sterling.pdf", 980, 34),
    doc(c3.id, "case", "Final bill", "final-bill-sterling.pdf", 1120, 33),
    doc(c3.id, "case", "Discharge summary", "discharge-signed.pdf", 720, 19, q3b.id),
    doc(c3.id, "case", "Stent invoice", "stent-invoice-batch.pdf", 640, 2, q3c.id),
  ];
  c3.events = [
    ev(c3.id, "opened", "Claim opened", 41),
    ev(c3.id, "docs_received", null, 35),
    ev(c3.id, "submitted", null, 34),
    ev(c3.id, "query_raised", "Round 1: name mismatch on the policy", 30),
    ev(c3.id, "query_resolved", "Round 1 resolved", 29),
    ev(c3.id, "query_raised", "Round 2: discharge summary unsigned", 22),
    ev(c3.id, "query_resolved", "Round 2 resolved", 19),
    ev(c3.id, "retention_extended", "Kept 30 more days", 8),
    ev(c3.id, "query_raised", "Round 3: stent invoice and Part B", 4),
  ];

  /* 4 ── the retention clock about to fire ────────────────────────────────── */
  const c4 = base({
    customer_name: "Imran Qureshi",
    customer_phone: "+91 99000 78787",
    claim_type: "reimbursement",
    status: "submitted",
    insurer: "Star Health",
    tpa: null,
    policy_number: "SH/2024/1129045",
    hospital: "Apollo, Chennai",
    ailment: "Appendectomy",
    claimed_amount: 120000,
    admitted_on: dateAgo(33),
    discharged_on: dateAgo(31),
    retention_started_at: ago(26),
    purge_at: ago(-4), // always 4 days out, so the warning is always live
    created_at: ago(34),
  });
  c4.documents = [
    doc(c4.id, "personal", "Aadhaar — patient", "aadhaar-imran.pdf", 396, 26),
    doc(c4.id, "personal", "NEFT mandate", "neft-form.pdf", 140, 26),
    doc(c4.id, "case", "Claim form Part A", "part-a.pdf", 420, 26),
    doc(c4.id, "case", "Discharge summary", "discharge-apollo.pdf", 610, 26),
    doc(c4.id, "case", "Payment receipts", "receipts.pdf", 350, 25),
  ];
  c4.events = [
    ev(c4.id, "opened", "Claim opened", 34),
    ev(c4.id, "docs_received", null, 27),
    ev(c4.id, "submitted", "Couriered to Star Health, Chennai branch", 26),
  ];

  /* 5 ── settled, consented, files gone ───────────────────────────────────── */
  const c5 = base({
    customer_name: "Sunita Rao",
    customer_phone: "+91 99000 90909",
    claim_type: "reimbursement",
    status: "settled",
    insurer: "Bajaj Allianz",
    tpa: null,
    policy_number: "BA/2021/7781002",
    hospital: "Sankara Eye Hospital, Pune",
    ailment: "Cataract, both eyes",
    claimed_amount: 95000,
    settled_amount: 88500,
    admitted_on: dateAgo(72),
    discharged_on: dateAgo(71),
    retention_started_at: ago(68),
    purge_at: ago(-38),
    documents_purged_at: ago(14),
    proof_consent_at: ago(14),
    closed_at: ago(14),
    created_at: ago(73),
  });
  const q5 = {
    id: uid("cq"), claim_id: c5.id, seq: 1,
    question: "Invoice for the intraocular lens used in the second eye.",
    raised_on: dateAgo(60), raised_by: "Bajaj Allianz", resolved_on: dateAgo(58),
    resolution_note: "Hospital emailed the IOL invoice.", created_at: ago(60),
  } as ClaimQuery;
  c5.queries = [q5];
  c5.documents = [doc(c5.id, "outcome", "Settlement letter", "bajaj-settlement.pdf", 310, 14)];
  c5.events = [
    ev(c5.id, "opened", "Claim opened", 73),
    ev(c5.id, "docs_received", null, 69),
    ev(c5.id, "submitted", null, 68),
    ev(c5.id, "query_raised", "Round 1: IOL invoice for the second eye", 60),
    ev(c5.id, "query_resolved", "Round 1 resolved", 58),
    ev(c5.id, "settled", "Credited to Sunita's HDFC account", 14),
    ev(c5.id, "documents_purged", "11 document(s) deleted on closing. The insurer's letter is kept.", 14),
  ];

  /* 6 ── rejected, files gone ─────────────────────────────────────────────── */
  const c6 = base({
    customer_name: "Aniket Bang",
    customer_phone: "+91 99000 23232",
    claim_type: "cashless",
    status: "rejected",
    insurer: "Tata AIG",
    tpa: "Paramount",
    policy_number: "TA/2024/4420117",
    hospital: "Sahyadri, Nashik",
    ailment: "Hernia repair",
    claimed_amount: 145000,
    admitted_on: dateAgo(95),
    discharged_on: dateAgo(93),
    retention_started_at: ago(90),
    purge_at: ago(-60),
    documents_purged_at: ago(30),
    closed_at: ago(30),
    created_at: ago(96),
  });
  c6.documents = [doc(c6.id, "outcome", "Rejection letter", "tata-repudiation.pdf", 288, 30)];
  c6.events = [
    ev(c6.id, "opened", "Claim opened", 96),
    ev(c6.id, "docs_received", null, 91),
    ev(c6.id, "submitted", null, 90),
    ev(c6.id, "rejected", "Repudiated — treated as a pre-existing condition inside the waiting period. Grievance filed.", 30),
    ev(c6.id, "documents_purged", "9 document(s) deleted on closing. The insurer's letter is kept.", 30),
  ];

  return [c1, c2, c3, c4, c5, c6];
}

/* ── the store ───────────────────────────────────────────────────────────── */

let claims: Seeded[] | null = null;
function all(): Seeded[] {
  if (!claims) claims = buildClaims();
  return claims;
}

const TERMINAL = ["settled", "rejected"];

/** Everything the list view derives per row, computed the way the API does. */
function toListRow(c: Seeded): Claim {
  const openQueries = c.queries.filter((q) => !q.resolved_on).length;
  const daysToPurge = c.purge_at
    ? Math.max(0, Math.floor((new Date(c.purge_at).getTime() - Date.now()) / day))
    : null;
  return {
    ...c,
    open_queries: openQueries,
    total_queries: c.queries.length,
    document_count: c.documents.length,
    days_to_purge: daysToPurge,
  };
}

function withDerived(c: Seeded): ClaimDetail {
  const row = toListRow(c);
  const daysToPurge = row.days_to_purge;
  return {
    ...c,
    ...row,
    can_extend:
      c.purge_at != null &&
      !c.extension_used &&
      c.documents_purged_at == null &&
      !TERMINAL.includes(c.status) &&
      daysToPurge != null &&
      daysToPurge <= 5,
  };
}

function find(id: string): Seeded {
  const c = all().find((x) => x.id === id);
  if (!c) throw new Error("Claim not found");
  return c;
}

/* ── operations the two claim pages perform ──────────────────────────────── */

export const playgroundClaims = {
  list(): Claim[] {
    return all()
      .map(toListRow)
      .sort((a, b) => {
        const q = (b.open_queries ?? 0) - (a.open_queries ?? 0);
        if (q !== 0) return q;
        const ap = a.purge_at ? new Date(a.purge_at).getTime() : Infinity;
        const bp = b.purge_at ? new Date(b.purge_at).getTime() : Infinity;
        if (ap !== bp) return ap - bp;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  },

  get(id: string): ClaimDetail {
    return withDerived(find(id));
  },

  create(draft: any): Claim {
    // Built from scratch, never spread off an existing claim — that would hand
    // the new row the same documents/queries ARRAYS by reference, and adding a
    // file to one demo claim would silently add it to another.
    const c = {
      agent_id: "demo-agent-0000-0000-000000000001",
      admitted_on: null,
      discharged_on: null,
      id: uid("claim"),
      customer_id: uid("cust"),
      customer_name: draft.new_customer_name || "New customer",
      customer_phone: draft.new_customer_phone || null,
      claim_type: draft.claim_type || "reimbursement",
      status: "opened" as const,
      insurer: draft.insurer || null,
      tpa: null,
      policy_number: null,
      hospital: draft.hospital || null,
      ailment: draft.ailment || null,
      claimed_amount: draft.claimed_amount ? Number(String(draft.claimed_amount).replace(/[₹,\s]/g, "")) : null,
      settled_amount: null,
      retention_started_at: null,
      purge_at: null,
      extension_used: false,
      documents_purged_at: null,
      proof_consent_at: null,
      closed_at: null,
      created_at: new Date().toISOString(),
      documents: [],
      queries: [],
      events: [ev("", "opened", "Claim opened", 0)],
    } as Seeded;
    c.events[0].claim_id = c.id;
    all().unshift(c);
    return toListRow(c);
  },

  update(id: string, patch: Record<string, any>): Claim {
    const c = find(id);
    const money = (v: any) => (v === "" || v == null ? null : Number(String(v).replace(/[₹,\s]/g, "")));
    const changes: string[] = [];
    for (const [k, v] of Object.entries(patch)) {
      const next = k.endsWith("_amount") ? money(v) : v === "" ? null : v;
      if (String((c as any)[k] ?? "—") !== String(next ?? "—")) {
        changes.push(`${k.replace(/_/g, " ")}: ${(c as any)[k] ?? "—"} → ${next ?? "—"}`);
      }
      (c as any)[k] = next;
    }
    if (changes.length) c.events.push(ev(c.id, "details_edited", changes.join(" · "), 0));
    return toListRow(c);
  },

  setStatus(id: string, status: string, opts: any = {}): Claim {
    const c = find(id);
    const closing = TERMINAL.includes(status);
    const reopening = TERMINAL.includes(c.status) && !closing;

    if (closing) {
      const losing = status === "settled" ? "Rejection letter" : "Settlement letter";
      if (!c.documents.some((d) => d.category === "outcome" && d.doc_type !== losing)) {
        throw new Error("Attach the insurer's letter before closing the claim.");
      }
      c.documents = c.documents.filter((d) => !(d.category === "outcome" && d.doc_type === losing));
    }

    const settled = opts.settled_amount != null && opts.settled_amount !== ""
      ? Number(String(opts.settled_amount).replace(/[₹,\s]/g, ""))
      : null;
    if (settled != null && c.claimed_amount != null && settled > Number(c.claimed_amount)) {
      throw new Error(
        `The settled amount cannot be more than the amount claimed (₹${Number(c.claimed_amount).toLocaleString("en-IN")}).`
      );
    }

    c.status = status as Claim["status"];
    c.settled_amount = reopening ? null : (settled ?? c.settled_amount);
    c.closed_at = closing ? new Date().toISOString() : null;
    if (opts.proof_consent) c.proof_consent_at = c.proof_consent_at ?? new Date().toISOString();

    c.events.push(
      reopening
        ? ev(c.id, "reopened", "Reopened. Working documents were already deleted and cannot be recovered.", 0)
        : ev(c.id, status, opts.note ?? null, 0)
    );

    if (closing) {
      const working = c.documents.filter((d) => d.category !== "outcome");
      if (working.length) {
        c.documents = c.documents.filter((d) => d.category === "outcome");
        c.documents_purged_at = new Date().toISOString();
        c.events.push(ev(c.id, "documents_purged",
          `${working.length} document(s) deleted on closing. The insurer's letter is kept.`, 0));
      }
    }
    return toListRow(c);
  },

  addQuery(id: string, q: { question: string; raised_by?: string }): ClaimQuery {
    const c = find(id);
    const next = Math.max(0, ...c.queries.map((x) => x.seq)) + 1;
    const row: ClaimQuery = {
      id: uid("cq"), claim_id: c.id, seq: next, question: q.question,
      raised_on: dateAgo(0), raised_by: q.raised_by || null,
      resolved_on: null, resolution_note: null, created_at: new Date().toISOString(),
    };
    c.queries.push(row);
    if (!TERMINAL.includes(c.status)) c.status = "query_raised";
    c.events.push(ev(c.id, "query_raised", `Round ${next}: ${q.question}`, 0));
    return row;
  },

  updateQuery(id: string, queryId: string, patch: any): ClaimQuery {
    const c = find(id);
    const q = c.queries.find((x) => x.id === queryId);
    if (!q) throw new Error("Query not found");
    if (patch.resolve === true) q.resolved_on = dateAgo(0);
    if (patch.resolve === false) q.resolved_on = null;
    if (patch.resolved_on !== undefined) q.resolved_on = patch.resolved_on || null;
    if (patch.question !== undefined) q.question = patch.question;
    if (patch.resolution_note !== undefined) q.resolution_note = patch.resolution_note;
    if (q.resolved_on) c.events.push(ev(c.id, "query_resolved", `Round ${q.seq} resolved`, 0));
    if (!c.queries.some((x) => !x.resolved_on) && !TERMINAL.includes(c.status)) {
      c.status = "under_process";
    }
    return q;
  },

  deleteQuery(id: string, queryId: string): void {
    const c = find(id);
    c.queries = c.queries.filter((q) => q.id !== queryId);
    if (!c.queries.some((x) => !x.resolved_on) && !TERMINAL.includes(c.status)) {
      c.status = "under_process";
    }
  },

  upload(id: string, file: File, meta: any): ClaimDocument & { retention?: unknown } {
    const c = find(id);
    const d = doc(c.id, meta.category, meta.doc_type || file.name, file.name,
      Math.max(1, Math.round(file.size / 1024)), 0, meta.query_id ?? null);
    c.documents.push(d);
    let retention: unknown = null;
    if (!c.retention_started_at) {
      c.retention_started_at = new Date().toISOString();
      c.purge_at = new Date(Date.now() + 30 * day).toISOString();
      retention = { retention_started_at: c.retention_started_at, purge_at: c.purge_at };
    }
    return { ...d, retention } as ClaimDocument & { retention?: unknown };
  },

  rename(id: string, docId: string, docType: string): ClaimDocument {
    const c = find(id);
    const d = c.documents.find((x) => x.id === docId);
    if (!d) throw new Error("Document not found");
    d.doc_type = docType;
    return d;
  },

  deleteDocument(id: string, docId: string): void {
    const c = find(id);
    c.documents = c.documents.filter((d) => d.id !== docId);
  },

  extend(id: string): { purge_at: string } {
    const c = find(id);
    if (c.extension_used) throw new Error("This claim has already had its one extension.");
    c.purge_at = new Date(new Date(c.purge_at ?? Date.now()).getTime() + 30 * day).toISOString();
    c.extension_used = true;
    c.events.push(ev(c.id, "retention_extended", "Kept 30 more days", 0));
    return { purge_at: c.purge_at };
  },
};
