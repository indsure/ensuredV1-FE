// The IRDAI premium register: the 33 columns of the broker's register sheet, in the sheet's order.
// Built from the business report rows, so the same filters and date basis apply. Our internal FX
// and team columns are left out. In IRDAI's terms "Gross Premium" is premium + GST, which the
// portal calls Net premium; stamp duty has no column, so Gross Premium here is always premium + GST.
import { fmtDate as fmt, r2, isNum, coverage } from "./lib.js";
import { isGroupPolicy } from "./members.jsx";

export const IRDAI_HEADERS = [
  "Sl.No.", "Policy No.", "Insurer Name", "Policy Type (Individual/ Group)", "Client ID", "CustName", "Proposal Date", "Client Address",
  "Sum Insured", "Policy Issued on (date)", "Risk Start Date", "Risk End Date", "Insurance Plan Name", "Product UIN Number", "Policy Term",
  "Premium Payment Term", "Instalment Premium (Rs.)", "GST (Rs.)", "Gross Premium (Rs.)", "Premium paid in (Cash/ Cheque/ Electronic Transfer)",
  "Date of payment of premium by client", "Date of remittance of premium with insurer", "Broker's Branch Name",
  "Insurer's branch where the proposal submitted", "Status of policy as on today",
  "Non-Life LO (Fire/Engg /Marine/Aviation /Liability/Health/PA /Miscellaneous /Others)", "Brokerage %",
  "Brokerage Amount(Rs.) (without service tax)", "GST", "Gross Brokerage (Rs.)", "Name of the Broker Qualified Person",
  "Name of the Authorized Verified, if any", "Policy Renewal/New",
];

const fmtDate = (x) => (x ? fmt(x) : "");

export const BROKERAGE_GST_DEFAULT = 18;
/** GST charged on the brokerage, in %. 18% unless the policy says otherwise. */
export const brokerageGstPct = (v) => (isNum(v?.brokerageGstPct) ? +v.brokerageGstPct : BROKERAGE_GST_DEFAULT);

/** Individual or Group as IRDAI asks: what the policy says, else Group for group covers. */
export function coverKind(p, term) {
  if (p.cover === "Individual" || p.cover === "Group") return p.cover;
  return isGroupPolicy(p, term || {}) ? "Group" : "Individual";
}

/** Our department in IRDAI's line-of-business list. */
export function irdaiLob(p) {
  if (/personal accident|\bpa\b/i.test(p.type || "")) return "PA";
  const map = { Fire: "Fire", Engineering: "Engg", Marine: "Marine", Aviation: "Aviation", Liability: "Liability", Health: "Health", Miscellaneous: "Miscellaneous" };
  return map[p.dept] || "Others";
}

/** "1 year", "6 months", "45 days": the risk period in plain words. */
export function policyTerm(start, end) {
  if (!start || !end) return "";
  const a = new Date(start + "T00:00:00Z"), b = new Date(end + "T00:00:00Z");
  const days = Math.round((b - a) / 86400000) + 1;
  if (days <= 0) return "";
  const months = Math.round(days / 30.44);
  if (months >= 12 && months % 12 === 0) return months === 12 ? "1 year" : `${months / 12} years`;
  if (days >= 28) return months === 1 ? "1 month" : `${months} months`;
  return days === 1 ? "1 day" : `${days} days`;
}

const ELECTRONIC = /bank transfer|neft|rtgs|imps|upi|debit card|credit card|swift|online|electronic/i;
export const irdaiMode = (m) => (/cash/i.test(m || "") ? "Cash" : /cheque|demand draft|\bdd\b/i.test(m || "") ? "Cheque" : ELECTRONIC.test(m || "") ? "Electronic Transfer" : m || "");

const uniq = (a) => [...new Set(a.filter(Boolean))];
const dates = (a) => uniq(a).sort().map(fmtDate).join("; ");

/** The broker branch for a customer: its own, else the only branch there is. */
export function brokerBranchOf(db, c) {
  const list = db.brokerBranches || [];
  return list.find((b) => b.id === c?.brokerBranch) || (list.length === 1 ? list[0] : null);
}

/** Who confirmed this year of the policy, from the history. */
export function verifiedBy(db, termId) {
  const hit = [...(db.audit || [])].reverse().find((a) => a.termId === termId && /confirmed/i.test(a.action || ""));
  return hit?.who || "";
}

/** One register row per business report row, in IRDAI_HEADERS order. */
export function irdaiRows(db, rows) {
  return rows.map((r, i) => {
    const t = db.terms.find((x) => x.id === r.termId) || { values: {}, receipts: [], instalments: [] };
    const p = db.policies.find((x) => x.id === r.policyId) || {};
    const c = db.customers.find((x) => x.id === p.customerId) || {};
    const v = t.values || {};
    const recs = t.receipts || [];
    const inst = (t.instalments || []).length;
    const bb = brokerBranchOf(db, c);
    const premium = r.grossPremium, gst = r.gst;
    const bGst = r2((r.brokerage || 0) * brokerageGstPct(v) / 100);
    const address = [c.address, c.city, c.state, c.country].filter(Boolean).join(", ");
    return [
      i + 1, r.policyNo || "", r.insurer === "--" ? "" : r.insurer, coverKind(p, t), r.custCode || "", r.customer || "", fmtDate(v.proposalDate), address,
      r.sumInsured || "", fmtDate(v.issueDate), fmtDate(v.riskStart), fmtDate(v.riskEnd), v.planName || "", v.uin || "", policyTerm(v.riskStart, v.riskEnd),
      inst > 1 ? `${inst} instalments` : "Single premium", premium, gst, r2(premium + gst), uniq(recs.map((x) => irdaiMode(x.mode))).join("; "),
      dates(recs.map((x) => x.date)), dates(recs.map((x) => x.remitDate)), bb?.name || "",
      r.branch === "--" ? "" : r.branch, coverage(t).label,
      irdaiLob(p), r.brokeragePct, r.brokerage, bGst, r2((r.brokerage || 0) + bGst), bb?.qualifiedPerson || "",
      verifiedBy(db, t.id), r.nr === "Renewal" ? "Renewal" : r.nr === "New" ? "New" : r.nr || "",
    ];
  });
}

const esc = (x) => { const s = x == null ? "" : String(x); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** The register as CSV: the header row first, nothing above it, so it lines up with the IRDAI sheet. */
export const irdaiCsv = (db, rows) => [IRDAI_HEADERS, ...irdaiRows(db, rows)].map((r) => r.map(esc).join(",")).join("\r\n");

/** The business report fields irdaiRows needs, for one policy year (used on the policy page). */
export function reportRowFor(db, t, helpers) {
  const { insurerOf, branchOf, brokerageOf } = helpers;
  const p = db.policies.find((x) => x.id === t.policyId) || {};
  const c = db.customers.find((x) => x.id === p.customerId) || {};
  const v = t.values || {};
  const ins = insurerOf(db, p.insurerId), br = branchOf(db, p.insurerId, p.branchId);
  return { termId: t.id, policyId: p.id, policyNo: v.policyNo, insurer: ins?.name || "--", custCode: c.code, customer: c.name, sumInsured: +v.sumInsured || 0,
    grossPremium: +v.grossPremium || 0, gst: +v.gst || 0, branch: br ? `${br.name}, ${br.city}` : "--", brokeragePct: +v.brokeragePct || 0, brokerage: brokerageOf(v), nr: t.nr };
}

/** Where to fill a blank register column. */
export const IRDAI_WHERE = {
  "Proposal Date": "Enter it in the policy details (Continue review, or an endorsement once confirmed).",
  "Client Address": "Add it to the customer's details.",
  "Insurance Plan Name": "Enter it in the policy details.",
  "Product UIN Number": "Enter it in the policy details.",
  "Premium paid in (Cash/ Cheque/ Electronic Transfer)": "Record the receipt in the Payments tab.",
  "Date of payment of premium by client": "Record the receipt in the Payments tab.",
  "Date of remittance of premium with insurer": "Add the remittance date to the receipt in the Payments tab.",
  "Broker's Branch Name": "Add your branch under Lists and team, Our branches, and choose it on the customer.",
  "Name of the Broker Qualified Person": "Add it to your branch under Lists and team, Our branches.",
  "Name of the Authorized Verified, if any": "Filled when the record is confirmed.",
  "Policy Issued on (date)": "Enter it in the policy details.",
  "Sum Insured": "Enter it in the policy details.",
};
