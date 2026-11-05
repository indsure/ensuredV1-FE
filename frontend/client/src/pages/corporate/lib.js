// Pure helpers: formatting, the four separate state axes, FX lookup, report building, CSV.
import { TODAY, FIELDS, FIELD } from "./data.js";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (iso) => {
  if (!iso) return "--";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
};
export const fmtStamp = (iso) => (iso ? `${fmtDate(iso)}, ${String(iso).slice(11, 16)}` : "--");
export const fmtMonth = (ym) => { if (!ym) return "--"; const [y, m] = ym.split("-"); return `${MON[+m - 1]} ${y}`; };
export const isNum = (x) => x !== "" && x != null && !Number.isNaN(Number(x));
export const fmtNum = (n, cur = "INR") => {
  if (!isNum(n)) return "--";
  const x = Math.round(Number(n) * 100) / 100;
  return x.toLocaleString(cur === "INR" ? "en-IN" : "en-US", { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(x) ? 0 : 2 });
};
export const fmtMoney = (n, cur = "INR") => (isNum(n) ? `${cur === "INR" ? "₹" : cur + " "}${fmtNum(n, cur)}` : "--");
export const r2 = (x) => Math.round(Number(x) * 100) / 100;
export const nowIso = () => { const d = new Date(); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

export const fmtValue = (key, v, cur) => {
  const f = FIELD[key];
  if (v === "" || v == null) return "--";
  if (!f) return String(v);
  if (f.type === "date") return fmtDate(v);
  if (f.type === "money") return fmtMoney(v, cur);
  if (f.type === "pct") return `${fmtNum(v)}%`;
  return String(v);
};

// ---- financial years
export const fyRange = (fy) => { const y = +fy.slice(0, 4); return [`${y}-04-01`, `${y + 1}-03-31`]; };
export const fyLabel = (fy) => { const [a, b] = fyRange(fy); return `${fmtDate(a)} to ${fmtDate(b)}`; };
export const FY_OPTIONS = ["2025-26", "2026-27"];

// ---- the four state axes, each derived separately
export function missingFields(term) {
  const v = term.values || {};
  const miss = FIELDS.filter((f) => f.req && (v[f.key] === "" || v[f.key] == null)).map((f) => f.label);
  if (!term.brokerageConfirmed) miss.push("Brokerage confirmation");
  return miss;
}
export function completeness(term) {
  if (term.status === "draft") return { label: "Draft", tone: "warn" };
  return { label: "Complete", tone: "good" };
}
export function coverage(term) {
  if (term.status === "draft") return { label: "Not confirmed", tone: "muted", why: "Coverage is shown once the record is confirmed" };
  if (term.cancelled) return { label: "Cancelled", tone: "bad" };
  const { riskStart: s, riskEnd: e } = term.values;
  if (!s || !e) return { label: "Dates missing", tone: "warn" };
  if (TODAY < s) return { label: "Scheduled", tone: "info", why: `Cover starts ${fmtDate(s)}` };
  if (TODAY > e) return { label: "Expired", tone: "muted", why: `Ended ${fmtDate(e)}` };
  return { label: "Active", tone: "good", why: `Until ${fmtDate(e)}` };
}
export const instTotal = (i) => r2((+i.amount || 0) * (1 + (+i.taxPct || 0) / 100));
export function paymentSummary(term) {
  const due = term.instalments.length ? r2(term.instalments.reduce((a, i) => a + instTotal(i), 0)) : +term.values.netPremium || 0;
  const received = r2(term.receipts.reduce((a, r) => a + (+r.amount || 0), 0));
  const outstanding = r2(due - received);
  let label = "Unpaid", tone = "bad";
  if (received > 0 && outstanding > 0) { label = "Part paid"; tone = "warn"; }
  if (due > 0 && outstanding <= 0) { label = "Paid"; tone = "good"; }
  if (!due) { label = "No amount"; tone = "muted"; }
  return { due, received, outstanding, label, tone };
}
export function instalmentRows(term) {
  return term.instalments.map((i) => {
    const recs = term.receipts.filter((r) => r.instNo === i.no);
    const total = instTotal(i);
    const got = r2(recs.reduce((a, r) => a + (+r.amount || 0), 0));
    const out = r2(total - got);
    const lastDate = recs.map((r) => r.date).sort().pop() || "";
    let status = "Upcoming", tone = "muted";
    if (out <= 0) { status = lastDate > i.due ? `Paid late (${daysBetween(i.due, lastDate)} days)` : "Paid on time"; tone = lastDate > i.due ? "warn" : "good"; }
    else if (got > 0) { status = i.due < TODAY ? "Part paid, overdue" : "Part paid"; tone = "warn"; }
    else if (i.due < TODAY) { status = `Overdue (${daysBetween(i.due, TODAY)} days)`; tone = "bad"; }
    return { ...i, total, tax: r2(total - (+i.amount || 0)), got, out, recs, lastDate, status, tone };
  });
}

// ---- FX: latest version for a month, demo rates only
export function fxRate(db, month, cur) {
  if (cur === "INR") return { rate: 1, version: 0, month, note: "INR" };
  const row = db.fx.find((x) => x.month === month && x.cur === cur);
  if (!row || !row.versions.length) return null;
  const v = row.versions[row.versions.length - 1];
  return { rate: v.rate, version: row.versions.length, month, note: v.note };
}

// ---- brokerage presets
export function activePreset(db, insurerId, policyType) {
  const p = db.presets.find((x) => x.insurerId === insurerId && x.policyType === policyType);
  if (!p) return null;
  const confirmed = p.versions.filter((v) => v.status === "confirmed");
  if (!confirmed.length) return null;
  const v = confirmed[confirmed.length - 1];
  return { presetId: p.id, version: v.v, pct: v.pct };
}

// ---- lookups
export const insurerOf = (db, id) => db.insurers.find((i) => i.id === id);
export const branchOf = (db, insId, brId) => insurerOf(db, insId)?.branches.find((b) => b.id === brId);
export const teamName = (db, code) => { const t = db.team.find((x) => x.code === code); return t ? `${t.name} (${t.code})` : code ? `${code} (not in team list)` : "--"; };
export const latestTerm = (db, p) => db.terms.find((t) => t.id === p.termIds[p.termIds.length - 1]);

// ---- reports
export const DATE_BASES = [
  { key: "bookDate", label: "Business booked date" },
  { key: "riskStart", label: "Risk start date" },
  { key: "issueDate", label: "Policy issue date" },
];
export const GROUPINGS = [
  { key: "none", label: "No grouping" },
  { key: "date", label: "Date Wise" }, { key: "insurer", label: "Insurer Wise" }, { key: "rm", label: "RM Wise" },
  { key: "cse", label: "CSC Wise" }, { key: "policy", label: "Policy Wise (policy type)" }, { key: "branch", label: "Branch Wise (insurer branch)" },
  { key: "month", label: "Month Wise" }, { key: "ref", label: "Ref Wise (source / referral)" }, { key: "client", label: "Client Wise" }, { key: "location", label: "Location Wise (customer city)" },
];

export function businessRows(db, f) {
  const [from, to] = f.useRange && f.from && f.to ? [f.from, f.to] : fyRange(f.fy);
  const rows = [];
  let drafts = 0;
  const passes = (p, c, v) => (f.vertical === "ALL" || c.vertical === f.vertical) && (!f.insurer || p.insurerId === f.insurer) && (!f.dept || p.dept === f.dept) && (!f.cse || c.cse === f.cse) && (!f.rm || c.rm === f.rm) && (!f.currency || v.currency === f.currency);
  // One report row for a term. Fleet rows start from this and replace the money.
  const rowOf = (t) => {
    const p = db.policies.find((x) => x.id === t.policyId);
    const c = db.customers.find((x) => x.id === p.customerId);
    const v = t.values;
    if (!passes(p, c, v) || (f.nr && f.nr !== "Fleet change")) return null;
    const basisDate = v[f.basis] || "";
    const ins = insurerOf(db, p.insurerId), br = branchOf(db, p.insurerId, p.branchId);
    const month = basisDate.slice(0, 7);
    const fx = month ? fxRate(db, month, v.currency) : null;
    const brokerage = brokerageOf(v);
    const toInr = (x) => (fx && isNum(x) ? r2(+x * fx.rate) : null);
    return {
      termId: t.id, policyId: p.id, controlNo: p.controlNo, policyNo: v.policyNo, custCode: c.code, customer: c.name, vertical: c.vertical,
      dept: p.dept, type: p.type, insurer: ins?.name || "--", branch: br ? `${br.name}, ${br.city}` : "--", cse: teamName(db, c.cse), rm: c.rm ? teamName(db, c.rm) : "Not assigned",
      nr: t.nr, basisDate, month, proposalDate: v.proposalDate, issueDate: v.issueDate, riskStart: v.riskStart, riskEnd: v.riskEnd, bookDate: v.bookDate,
      currency: v.currency, sumInsured: +v.sumInsured || 0, grossPremium: +v.grossPremium || 0, gst: +v.gst || 0, stampDuty: +v.stampDuty || 0, netPremium: +v.netPremium || 0,
      brokeragePct: +v.brokeragePct || 0, brokerage, presetNote: t.brokerageSnap ? `Preset v${t.brokerageSnap.version}` : "Entered manually",
      fxMonth: month, fxRate: fx ? fx.rate : null, fxVersion: fx ? fx.version : null,
      grossInr: toInr(v.grossPremium), gstInr: toInr(v.gst), netInr: toInr(v.netPremium), brokerageInr: toInr(brokerage), siInr: toInr(v.sumInsured),
      ref: c.source === "Referral" ? c.referral || "Referral" : "Direct business", location: c.city,
    };
  };
  for (const t of db.terms) {
    const p = db.policies.find((x) => x.id === t.policyId);
    const c = db.customers.find((x) => x.id === p.customerId);
    const v = t.values;
    const basisDate = v[f.basis];
    if (t.status === "draft") { if (basisDate && basisDate >= from && basisDate <= to) drafts++; else if (!basisDate) drafts++; continue; }
    if (!basisDate || basisDate < from || basisDate > to) continue;
    if (f.vertical !== "ALL" && c.vertical !== f.vertical) continue;
    if (f.insurer && p.insurerId !== f.insurer) continue;
    if (f.dept && p.dept !== f.dept) continue;
    if (f.cse && c.cse !== f.cse) continue;
    if (f.rm && c.rm !== f.rm) continue;
    if (f.nr && t.nr !== f.nr) continue;
    if (f.currency && v.currency !== f.currency) continue;
    const ins = insurerOf(db, p.insurerId), br = branchOf(db, p.insurerId, p.branchId);
    const month = basisDate.slice(0, 7);
    const fx = fxRate(db, month, v.currency);
    const brokerage = brokerageOf(v);
    const toInr = (x) => (fx && isNum(x) ? r2(+x * fx.rate) : null);
    rows.push({
      termId: t.id, policyId: p.id, controlNo: p.controlNo, policyNo: v.policyNo, custCode: c.code, customer: c.name, vertical: c.vertical,
      dept: p.dept, type: p.type, insurer: ins?.name || "--", branch: br ? `${br.name}, ${br.city}` : "--", cse: teamName(db, c.cse), rm: c.rm ? teamName(db, c.rm) : "Not assigned",
      nr: t.nr, basisDate, month, proposalDate: v.proposalDate, issueDate: v.issueDate, riskStart: v.riskStart, riskEnd: v.riskEnd, bookDate: v.bookDate,
      currency: v.currency, sumInsured: +v.sumInsured || 0, grossPremium: +v.grossPremium || 0, gst: +v.gst || 0, stampDuty: +v.stampDuty || 0, netPremium: +v.netPremium || 0,
      brokeragePct: +v.brokeragePct || 0, brokerage, presetNote: t.brokerageSnap ? `Preset v${t.brokerageSnap.version}` : "Entered manually",
      fxMonth: month, fxRate: fx ? fx.rate : null, fxVersion: fx ? fx.version : null,
      grossInr: toInr(v.grossPremium), gstInr: toInr(v.gst), netInr: toInr(v.netPremium), brokerageInr: toInr(brokerage), siInr: toInr(v.sumInsured),
      ref: c.source === "Referral" ? c.referral || "Referral" : "Direct business", location: c.city,
    });
  }
  // Fleet changes count in the month they take effect, whatever date the report is based on.
  for (const t of db.terms) {
    if (t.status === "draft" || t.cancelled) continue;
    const base = rowOf(t);
    if (!base) continue;
    for (const s of t.vesselSchedules || []) {
      const ch = s.change;
      if (!ch || !ch.effDate || ch.effDate < from || ch.effDate > to || (!+ch.premiumAdj && !+ch.brokerageAdj)) continue;
      const fx = fxRate(db, ch.effDate.slice(0, 7), t.values.currency);
      const inr = (x) => (fx ? r2(+x * fx.rate) : null);
      rows.push({ ...base, rowKey: `${t.id}:${s.version}`, nr: "Fleet change", basisDate: ch.effDate, month: ch.effDate.slice(0, 7), fxMonth: ch.effDate.slice(0, 7), fxRate: fx ? fx.rate : null, fxVersion: fx ? fx.version : null,
        sumInsured: 0, grossPremium: +ch.premiumAdj || 0, gst: 0, stampDuty: 0, netPremium: +ch.premiumAdj || 0, brokerage: +ch.brokerageAdj || 0, presetNote: "Insurer's figure",
        grossInr: inr(ch.premiumAdj || 0), gstInr: 0, netInr: inr(ch.premiumAdj || 0), brokerageInr: inr(ch.brokerageAdj || 0), siInr: 0 });
    }
  }
  rows.sort((a, b) => a.basisDate.localeCompare(b.basisDate) || a.controlNo.localeCompare(b.controlNo));
  return { rows, drafts, from, to };
}
export const groupKey = (g, r) => ({ none: "All records", date: fmtDate(r.basisDate), insurer: r.insurer, rm: r.rm, cse: r.cse, policy: r.type, branch: r.branch, month: fmtMonth(r.month), ref: r.ref, client: `${r.customer} (${r.custCode})`, location: r.location }[g]);
export function totals(rows) {
  const t = { count: rows.length, grossInr: 0, gstInr: 0, netInr: 0, brokerageInr: 0, siInr: 0, noRate: 0, native: {} };
  for (const r of rows) {
    const n = (t.native[r.currency] ||= { count: 0, gross: 0, gst: 0, net: 0, brokerage: 0, si: 0 });
    n.count++; n.gross += r.grossPremium; n.gst += r.gst; n.net += r.netPremium; n.brokerage += r.brokerage; n.si += r.sumInsured;
    if (r.fxRate == null) { t.noRate++; continue; }
    t.grossInr += r.grossInr; t.gstInr += r.gstInr; t.netInr += r.netInr; t.brokerageInr += r.brokerageInr; t.siInr += r.siInr;
  }
  ["grossInr", "gstInr", "netInr", "brokerageInr", "siInr"].forEach((k) => (t[k] = r2(t[k])));
  Object.values(t.native).forEach((n) => ["gross", "gst", "net", "brokerage", "si"].forEach((k) => (n[k] = r2(n[k]))));
  return t;
}
export function groupRows(rows, g) {
  const m = new Map();
  rows.forEach((r) => { const k = groupKey(g, r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return [...m.entries()].map(([key, rs]) => ({ key, rows: rs, totals: totals(rs) }));
}

export function renewalRows(db, f) {
  const [from, to] = f.useRange && f.from && f.to ? [f.from, f.to] : fyRange(f.fy);
  const out = [];
  for (const t of db.terms) {
    if (t.status === "draft") continue;
    const v = t.values;
    if (!v.riskEnd || v.riskEnd < from || v.riskEnd > to) continue;
    const p = db.policies.find((x) => x.id === t.policyId), c = db.customers.find((x) => x.id === p.customerId);
    if (f.vertical !== "ALL" && c.vertical !== f.vertical) continue;
    if (f.insurer && p.insurerId !== f.insurer) continue;
    if (f.outcome && t.outcome !== f.outcome) continue;
    const next = t.nextTermId ? db.terms.find((x) => x.id === t.nextTermId) : null;
    const draftNext = db.terms.find((x) => x.prevTermId === t.id && x.status === "draft");
    out.push({
      termId: t.id, policyId: p.id, controlNo: p.controlNo, policyNo: v.policyNo, riskStart: v.riskStart, riskEnd: v.riskEnd, type: p.type, dept: p.dept,
      group: c.vertical, customer: c.name, custCode: c.code, insurer: insurerOf(db, p.insurerId)?.name, rm: c.rm ? teamName(db, c.rm) : "Not assigned", cse: teamName(db, c.cse),
      currency: v.currency, sumInsured: +v.sumInsured || 0, netPremium: +v.netPremium || 0, brokerage: brokerageOf(v),
      renewable: v.renewable || "Not entered", outcome: t.outcome, lossDetail: t.lossDetail, nextPolicyNo: next?.values.policyNo || "", draftInProgress: !!draftNext, location: c.city,
    });
  }
  out.sort((a, b) => a.riskEnd.localeCompare(b.riskEnd));
  return out;
}

// ---- CSV
const esc = (x) => { const s = x == null ? "" : String(x); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
// Brokerage is on gross premium unless the policy is ticked "Brokerage on net premium".
export const brokerageBase = (v) => (v.brokerageOnNet ? +v.netPremium || 0 : +v.grossPremium || 0);
export const brokerageOf = (v) => r2(brokerageBase(v) * (+v.brokeragePct || 0) / 100);

// Books saved when "net" meant before GST are converted once: gross + GST = net from then on.
export function upgradeBook(d) {
  if (!d || d.premiumModel === 2) return d;
  const swap = { '"netPremium"': '"grossPremium"', '"grossPremium"': '"netPremium"', '"netInr"': '"grossInr"', '"grossInr"': '"netInr"', '"net":': '"gross":', '"gross":': '"net":' };
  const out = JSON.parse(JSON.stringify(d).replace(/"netPremium"|"grossPremium"|"netInr"|"grossInr"|"net":|"gross":/g, (m) => swap[m]));
  out.premiumModel = 2;
  out.audit = [...(out.audit || []), { id: `A${(out.audit || []).length + 1}`, at: nowIso(), who: "System", action: "Premium terms changed", detail: "Gross premium is now the amount before GST and net premium the final amount paid. Saved figures were moved across; no amount changed." }];
  return out;
}

const showDate = (x) => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? fmtDate(x) : x);
export function toCsv(labelRows, header, rows) {
  rows = rows.map((r) => r.map(showDate));
  return [...labelRows.map((r) => r.map(esc).join(",")), "", header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
}
