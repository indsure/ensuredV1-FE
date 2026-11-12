// Tidying the insurer list: spotting duplicates, merging one insurer or branch into another, and deleting
// one nothing uses. Policies, brokerage rates and brokerage receipts point to insurers by id, so a merge
// moves every one of them across before the duplicate is removed. Drafts are matched afresh each time.
import { plural } from "./lib.js";

const NOISE = /\b(the|general|insurance|assurance|insurer|company|co|corporation|corp|limited|ltd|pvt|private|india|indian|of|and)\b/g;
/** "TATA AIG General Insurance Company Ltd." and "Tata Aig" both become "tataaig". */
export const insurerKey = (name) => String(name || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(NOISE, " ").replace(/\s+/g, "");
const branchKey = (b) => `${String(b.name || "").toLowerCase().replace(/[^a-z0-9]/g, "")}|${String(b.city || "").toLowerCase().trim()}`;

/** The listed insurer with the same name once "Ltd", "Insurance Company" and the like are ignored. */
export const sameInsurer = (insurers, name) => { const k = insurerKey(name); return k ? insurers.find((i) => insurerKey(i.name) === k) : undefined; };

/** Groups of insurers that look like the same company. */
export function duplicateInsurers(db) {
  const by = {};
  for (const i of db.insurers) { const k = insurerKey(i.name); if (k) (by[k] ||= []).push(i); }
  return Object.values(by).filter((g) => g.length > 1);
}

/** What uses an insurer (or one branch of it). */
export function insurerUse(db, insId, brId) {
  if (brId) return { policies: db.policies.filter((p) => p.insurerId === insId && p.branchId === brId).length, presets: 0, receipts: 0 };
  return {
    policies: db.policies.filter((p) => p.insurerId === insId).length,
    presets: (db.presets || []).filter((p) => p.insurerId === insId).length,
    receipts: (db.remittances || []).filter((r) => r.insurerId === insId).length,
  };
}
export const isUnused = (u) => !u.policies && !u.presets && !u.receipts;

/** Moves everything from one insurer to another, then removes the first. Returns a line for the audit log. */
export function mergeInsurer(d, fromId, toId) {
  const from = d.insurers.find((i) => i.id === fromId), to = d.insurers.find((i) => i.id === toId);
  const brMap = {};
  let movedBr = 0;
  for (const b of from.branches) {
    const same = to.branches.find((x) => branchKey(x) === branchKey(b));
    if (same) brMap[b.id] = same.id; else { to.branches.push(b); brMap[b.id] = b.id; movedBr++; }
  }
  let pols = 0, rates = 0, dropped = 0, recs = 0;
  for (const p of d.policies) if (p.insurerId === fromId) { p.insurerId = toId; if (p.branchId) p.branchId = brMap[p.branchId] || p.branchId; pols++; }
  d.presets = (d.presets || []).filter((p) => {
    if (p.insurerId !== fromId) return true;
    if (d.presets.some((q) => q.insurerId === toId && q.policyType === p.policyType)) { dropped++; return false; }
    p.insurerId = toId; rates++; return true;
  });
  for (const r of d.remittances || []) if (r.insurerId === fromId) { r.insurerId = toId; recs++; }
  d.insurers = d.insurers.filter((i) => i.id !== fromId);
  return `${from.name} merged into ${to.name}: ${plural(pols, "policy", "policies")}, ${plural(movedBr, "branch", "branches")}, ${plural(rates, "brokerage rate")} and ${plural(recs, "receipt")} moved${dropped ? `, ${plural(dropped, "duplicate brokerage rate")} removed (kept the ones on ${to.name})` : ""}.`;
}

/** Moves policies from one branch to another branch of the same insurer, then removes the first. */
export function mergeBranch(d, insId, fromBr, toBr) {
  const ins = d.insurers.find((i) => i.id === insId);
  const a = ins.branches.find((b) => b.id === fromBr), b = ins.branches.find((x) => x.id === toBr);
  let pols = 0;
  for (const p of d.policies) if (p.insurerId === insId && p.branchId === fromBr) { p.branchId = toBr; pols++; }
  ins.branches = ins.branches.filter((x) => x.id !== fromBr);
  return `${ins.name}: branch ${a.name} (${a.city}) merged into ${b.name} (${b.city}), ${plural(pols, "policy", "policies")} moved.`;
}
