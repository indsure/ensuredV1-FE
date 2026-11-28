// Deleting customers, documents, premium receipts and brokerage payments. Every delete is asked first on
// screen and written to the history; anything removed by mistake comes back from an earlier save.
import { plural, fmtDate, fmtMoney } from "./lib.js";

/** What a customer still has: policies block a delete; documents not on a policy go with it. */
export function customerUse(db, id) {
  return { policies: db.policies.filter((p) => p.customerId === id).length, documents: db.documents.filter((x) => x.customerId === id && !x.policyId).length };
}

/** Removes a customer with no policies, and their documents that are not on any policy. */
export function deleteCustomer(d, id) {
  const c = d.customers.find((x) => x.id === id);
  const docs = d.documents.filter((x) => x.customerId === id && !x.policyId).length;
  d.documents = d.documents.filter((x) => !(x.customerId === id && !x.policyId));
  d.customers = d.customers.filter((x) => x.id !== id);
  return `${c.name} (${c.code}) deleted${docs ? `, with ${plural(docs, "document")} not on a policy` : ""}.`;
}

/** Moves every policy and document of one customer to another, then removes the first. */
export function mergeCustomer(d, fromId, toId) {
  const a = d.customers.find((x) => x.id === fromId), b = d.customers.find((x) => x.id === toId);
  let pols = 0, docs = 0;
  for (const p of d.policies) if (p.customerId === fromId) { p.customerId = toId; pols++; }
  for (const x of d.documents) if (x.customerId === fromId) { x.customerId = toId; docs++; }
  for (const e of d.audit) if (e.customerId === fromId) e.customerId = toId;
  d.customers = d.customers.filter((x) => x.id !== fromId);
  return `${a.name} (${a.code}) merged into ${b.name} (${b.code}): ${plural(pols, "policy", "policies")} and ${plural(docs, "document")} moved.`;
}

// Any key ending in "docId" anywhere inside a policy year points at a document.
const refersTo = (o, id) => {
  if (!o || typeof o !== "object") return false;
  if (Array.isArray(o)) return o.some((x) => refersTo(x, id));
  return Object.entries(o).some(([k, v]) => (/docid$/i.test(k) && v === id) || (typeof v === "object" && refersTo(v, id)));
};

/** Why a document cannot be deleted, in words, or null when it can be. */
export function docInUse(db, id) {
  for (const t of db.terms) {
    if (t.docId === id) return `It is the policy document for year ${t.termNo}. Delete the policy instead, or attach the right document as an endorsement.`;
    if ((t.endorsements || []).some((e) => e.docId === id)) return "It is the document behind an endorsement, so the change it made stays explained.";
    if ((t.receipts || []).some((r) => r.proofDocId === id)) return "It is the proof of a premium receipt. Delete that receipt first.";
    if (refersTo({ ...t, docId: null }, id)) return "A value on the policy was read from it.";
  }
  return null;
}

export function deleteDoc(d, id) {
  const x = d.documents.find((y) => y.id === id);
  d.documents = d.documents.filter((y) => y.id !== id);
  return `${x.kind}: ${x.name}.`;
}

/** Removes one premium receipt from a policy year. */
export function deleteReceipt(d, termId, receiptId) {
  const t = d.terms.find((x) => x.id === termId);
  const r = t.receipts.find((x) => x.id === receiptId);
  t.receipts = t.receipts.filter((x) => x.id !== receiptId);
  return `${fmtMoney(r.amount, t.values.currency)} received on ${fmtDate(r.date)}${r.ref ? `, ${r.ref}` : ""}${r.instNo ? `, instalment ${r.instNo}` : ""}.`;
}

/** Removes an unconfirmed renewal year. The year before is untouched; its documents stay on the policy, unlinked. */
export function discardDraftYear(d, termId) {
  const t = d.terms.find((x) => x.id === termId);
  const prev = d.terms.find((x) => x.id === t.prevTermId);
  d.terms = d.terms.filter((x) => x.id !== termId);
  const pol = d.policies.find((x) => x.id === t.policyId); pol.termIds = pol.termIds.filter((x) => x !== termId);
  d.documents.forEach((x) => { if (x.termId === termId) { x.termId = null; x.note = `Renewal draft discarded ${fmtDate(new Date().toISOString().slice(0, 10))}; document kept`; } });
  const rec = (t.receipts || []).length;
  return { prevId: prev?.id, detail: `Unconfirmed draft year ${t.termNo} removed${rec ? `, with ${plural(rec, "receipt")} recorded on it` : ""}. Year ${prev?.termNo ?? "before"} unchanged. The renewal document stays on the policy.` };
}

/** Removes one brokerage payment from an insurer, with all its lines. */
export function deleteRemittance(d, id) {
  const r = (d.remittances || []).find((x) => x.id === id);
  const ins = d.insurers.find((i) => i.id === r.insurerId);
  d.remittances = d.remittances.filter((x) => x.id !== id);
  const total = r.lines.reduce((a, l) => a + (+l.amount || 0), 0);
  return `${r.ref} from ${ins?.name || "an insurer"}, ${fmtDate(r.date)}, ${fmtMoney(total)} over ${plural(r.lines.length, "policy", "policies")}.`;
}
