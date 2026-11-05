// Seed data, masters, OCR sample fixtures. Everything in the demo seed is fictional.
import { demoCargoProfile } from "./marine.js";
import { placeOf } from "./places.js";

// LIVE: real records. Every built portal (beta) and the local dev server run live: an empty book to
// start, today's date, records saved by store.js. ?demo on the dev server opens the fictional demo.
export const LIVE = import.meta.env.VITE_CORPORATE_DATA === "live"
  || (import.meta.env.DEV && import.meta.env.VITE_CORPORATE_DATA !== "demo" && !(typeof location !== "undefined" && new URLSearchParams(location.search).has("demo")));
const localDate = () => { const d = new Date(); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
export const TODAY = LIVE ? localDate() : "2026-10-31";

export const DEPARTMENTS = {
  Fire: ["Fire Loss of Profit", "Industrial All Risks Insurance", "Standard Fire and Special Perils"],
  Engineering: ["Advance Loss of Profit Insurance", "Boiler and Pressure Plant Insurance", "Contractor All Risk Insurance", "Contractors Plant and Machinery Insurance", "Electronic Equipments Insurance", "Erection All Risk Insurance", "Machinery Breakdown Insurance", "Machinery Loss of Profit"],
  Agriculture: ["Weather Insurance Policy"],
  Marine: ["Charterers Liability", "Contractual Liability", "Delay in start up", "Freight, Demurrage and Defence", "Loss of Hire", "Marine Cargo - Open Policy", "Marine Cargo - Specific Policy", "Marine Hull & Machinery", "Marine Legal Liability", "Marine Transit Policy", "Protection & Indemnity"],
  Liability: ["Agency Liability", "Bankers Indemnity Insurance", "Carrier Legal Liability", "Commercial General Liability Insurance", "Cyber Security Insurance", "Directors and Officers Liability Insurance", "Errors and Ommissions Insurance", "FMC BOND", "Media Liability Insurance", "Multi Model Transport Operator", "Product Liability Insurance", "Professional Indemnity Insurance", "Public Liability Insurance - Act", "Public Liability Insurance - Industrial", "Public Liability Insurance - Non Industrial", "Ship Brokers Liability", "Signature Professional Indemnity", "Workmens Compensation Policy"],
  Miscellaneous: ["ATM Safe Insurance", "Baggage Insurance", "Burglary Insurance", "Cattle Insurance", "Cellular Network Insurance", "Commercial Package policy", "Credit Insurance", "Customs duty package", "Event Cancellation Insurance", "Fidelity Guarantee Insurance", "Film Insurance", "Fine Arts", "Home Package Policy", "Hotel and Restaurant Package Policy", "Jewellers Block Insurance", "Kidnap Ransom and Extortion Insurance", "Lift Irrigation Insurance", "Money Insurance", "Neon Sign insurance", "Office Package Policy", "Plate Glass Insurance", "Port Package Policy", "Portable Equipment Insurance", "Shopkeeper Package Policy", "Signage Insurance", "Special contingency", "Traders Package Policy"],
  Health: ["Critical illness", "Group Mediclaim Policy", "Group Personal Accident Policy", "Group Travel Insurance", "Health Family Floater Policy", "Hospital Cash", "Individual Mediclaim Policy", "Individual Personal Accident Policy", "TOP UP MEDICLAIM", "Travel Insurance"],
  Motor: ["CPA Pvt Car", "CPA two wheeler", "Motor Commercial Vehicle Policy", "Motor Miscellaneous Policy", "Motor Private Car Package Policy", "Motor Third Party Liability Policy", "Motor Two Wheeler Policy", "PVT Car OD only", "Two wheeler OD only"],
};

export const VESSEL_TYPES = ["Protection & Indemnity", "Marine Hull & Machinery", "Charterers Liability"];
export const isVesselType = (t) => VESSEL_TYPES.includes(t);
export const isCargoOpen = (t) => t === "Marine Cargo - Open Policy";
export const isCharterers = (t) => t === "Charterers Liability";

export const CURRENCIES = ["INR", "USD", "AED", "EUR"];

// The register fields a reviewer sees. `req` = needed before a record can be confirmed (PROPOSED list).
export const FIELDS = [
  { key: "policyNo", label: "Policy number", group: "Identification", type: "text", req: true },
  { key: "planName", label: "Plan name", group: "Identification", type: "text" },
  { key: "uin", label: "UIN", group: "Identification", type: "text" },
  { key: "proposalDate", label: "Proposal date", group: "Dates", type: "date", help: "Date the proposal was signed" },
  { key: "issueDate", label: "Policy issue date", group: "Dates", type: "date", req: true, help: "Issued does not mean cover has started" },
  { key: "riskStart", label: "Risk start date", group: "Dates", type: "date", req: true, help: "Cover starts on this date" },
  { key: "riskEnd", label: "Risk end (expiry) date", group: "Dates", type: "date", req: true },
  { key: "bookDate", label: "Business booked date", group: "Dates", type: "date", req: true, help: "Starts as the policy issue date. Change it if needed." },
  { key: "currency", label: "Currency", group: "Amounts", type: "currency", req: true },
  { key: "sumInsured", label: "Sum insured / limit", group: "Amounts", type: "money", req: true },
  { key: "premiumRate", label: "Premium rate (%)", group: "Amounts", type: "pct" },
  { key: "grossPremium", label: "Gross premium", group: "Amounts", type: "money", req: true, help: "Before GST" },
  { key: "gstPct", label: "GST (%)", group: "Amounts", type: "pct" },
  { key: "gst", label: "GST amount", group: "Amounts", type: "money", req: true },
  { key: "stampDuty", label: "Stamp duty", group: "Amounts", type: "money" },
  { key: "netPremium", label: "Net premium", group: "Amounts", type: "money", req: true, help: "The final amount paid: gross + GST, plus stamp duty if the policy's total includes it" },
  { key: "excess", label: "Policy excess", group: "Amounts", type: "text" },
  { key: "location", label: "Location / Jurisdiction", group: "Other", type: "text" },
  { key: "share", label: "Our share (%)", group: "Other", type: "pct" },
  { key: "coBrokerShare", label: "Co-broker share (%)", group: "Other", type: "pct" },
  { key: "renewable", label: "Is renewable", group: "Other", type: "yesno", req: true, help: "Entered by a person. Never guessed." },
  { key: "brokeragePct", label: "Brokerage (%)", group: "Brokerage", type: "pct", req: true },
];
export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
export const NUMERIC = new Set(FIELDS.filter((f) => ["money", "pct"].includes(f.type)).map((f) => f.key));

const day = (iso) => iso;

// ---------------------------------------------------------------- fixtures
// A fixture is a sample document with pre-written "OCR" results. Each field points at the line it came from.
// conf: "high" | "low". Fields absent from `fields` are reported as not found on the document.
export const FIXTURES = [
  {
    id: "FX-HM-01", kind: "Policy schedule", dept: "Marine", type: "Marine Hull & Machinery",
    title: "Hull & Machinery schedule, MV Konkan Star (clean scan)",
    lines: [
      "COASTLINE GENERAL ASSURANCE (fictional)",
      "Mumbai BKC Branch",
      "MARINE HULL & MACHINERY POLICY SCHEDULE",
      "Policy No: CGA/HM/2026/2291",
      "Plan: Hull ITC 1/10/83 basis",
      "UIN: DEMO-HM-0042",
      "Insured: Konkan Bulk Carriers Pvt Ltd",
      "Vessel: MV Konkan Star   IMO 9000002",
      "Date of proposal: 18-Oct-2026",
      "Date of issue: 27-Oct-2026",
      "Period: 01-Nov-2026 to 31-Oct-2027 (both days inclusive)",
      "Agreed value: USD 2,750,000",
      "Rate: 0.95%",
      "Premium: USD 26,125.00",
      "GST @ 18%: USD 4,702.50",
      "Stamp duty: USD 0.00",
      "Total premium: USD 30,827.50",
      "Deductible: USD 25,000 each accident",
      "Trading limits: Indian coastal and Middle East",
    ],
    fields: {
      policyNo: { v: "CGA/HM/2026/2291", ref: 4, conf: "high" },
      planName: { v: "Hull ITC 1/10/83 basis", ref: 5, conf: "high" },
      uin: { v: "DEMO-HM-0042", ref: 6, conf: "high" },
      proposalDate: { v: "2026-10-18", ref: 9, conf: "high" },
      issueDate: { v: "2026-10-27", ref: 10, conf: "high" },
      riskStart: { v: "2026-11-01", ref: 11, conf: "high" },
      riskEnd: { v: "2027-10-31", ref: 11, conf: "high" },
      currency: { v: "USD", ref: 12, conf: "high" },
      sumInsured: { v: 2750000, ref: 12, conf: "high" },
      premiumRate: { v: 0.95, ref: 13, conf: "high" },
      grossPremium: { v: 26125, ref: 14, conf: "high" },
      gstPct: { v: 18, ref: 15, conf: "high" },
      gst: { v: 4702.5, ref: 15, conf: "high" },
      stampDuty: { v: 0, ref: 16, conf: "high" },
      netPremium: { v: 30827.5, ref: 17, conf: "high" },
      excess: { v: "USD 25,000 each accident", ref: 18, conf: "high" },
      location: { v: "Indian coastal and Middle East", ref: 19, conf: "low" },
    },
  },
  {
    id: "FX-FIRE-POOR", kind: "Policy schedule", dept: "Fire", type: "Standard Fire and Special Perils",
    title: "Standard Fire schedule (faint scan, several fields unreadable)",
    lines: [
      "NORTHSTAR GENERAL INSURANCE (fictional)",
      "Surat Ring Road Branch",
      "STANDARD FIRE & SPECIAL PERILS POLICY",
      "Policy No: NGI/FIRE/26/0#9#1   [smudged]",
      "Insured: ........ (unreadable)",
      "Date of issue: 2?-Oct-2026",
      "Period of insurance: 15-Nov-2026 to ##-###-2027",
      "Sum insured: Rs. 4,50,00,000",
      "Gross premium: Rs. 54,000",
      "GST: [stamp covers this area]",
      "Total: Rs. 63,720",
      "Situation: Plot 14, GIDC (rest torn)",
    ],
    fields: {
      policyNo: { v: "NGI/FIRE/26/0991", ref: 4, conf: "low" },
      issueDate: { v: "2026-10-27", ref: 6, conf: "low" },
      riskStart: { v: "2026-11-15", ref: 7, conf: "high" },
      currency: { v: "INR", ref: 8, conf: "high" },
      sumInsured: { v: 45000000, ref: 8, conf: "high" },
      grossPremium: { v: 54000, ref: 9, conf: "high" },
      netPremium: { v: 63720, ref: 11, conf: "high" },
      location: { v: "Plot 14, GIDC", ref: 12, conf: "low" },
    },
  },
  {
    id: "FX-GMC-01", kind: "Policy schedule", dept: "Health", type: "Group Mediclaim Policy",
    title: "Group Mediclaim schedule, 64 employees (clean scan)",
    lines: [
      "SAHYADRI GENERAL INSURANCE (fictional)",
      "Pune Baner Branch",
      "GROUP MEDICLAIM POLICY SCHEDULE",
      "Policy No: SGI/GMC/2026/7710",
      "Product: Group Health Secure",
      "UIN: DEMO-GMC-0007",
      "Proposal date: 20-Oct-2026",
      "Issued on: 29-Oct-2026",
      "Period: 01-Dec-2026 to 30-Nov-2027",
      "Members: 64 employees and dependants",
      "Family floater sum insured: Rs. 3,00,000 per family",
      "Aggregate sum insured: Rs. 1,92,00,000",
      "Premium: Rs. 4,48,000",
      "GST 18%: Rs. 80,640",
      "Net premium: Rs. 5,28,640",
    ],
    fields: {
      policyNo: { v: "SGI/GMC/2026/7710", ref: 4, conf: "high" },
      planName: { v: "Group Health Secure", ref: 5, conf: "high" },
      uin: { v: "DEMO-GMC-0007", ref: 6, conf: "high" },
      proposalDate: { v: "2026-10-20", ref: 7, conf: "high" },
      issueDate: { v: "2026-10-29", ref: 8, conf: "high" },
      riskStart: { v: "2026-12-01", ref: 9, conf: "high" },
      riskEnd: { v: "2027-11-30", ref: 9, conf: "high" },
      currency: { v: "INR", ref: 12, conf: "high" },
      sumInsured: { v: 19200000, ref: 12, conf: "high" },
      grossPremium: { v: 448000, ref: 13, conf: "high" },
      gstPct: { v: 18, ref: 14, conf: "high" },
      gst: { v: 80640, ref: 14, conf: "high" },
      netPremium: { v: 528640, ref: 15, conf: "high" },
    },
  },
  {
    id: "FX-CARGO-01", kind: "Policy schedule", dept: "Marine", type: "Marine Cargo - Open Policy",
    title: "Marine Cargo open policy, export shipments (clean scan)",
    lines: [
      "NORTHSTAR GENERAL INSURANCE (fictional)",
      "Pune Camp Branch",
      "MARINE CARGO OPEN POLICY",
      "Policy No: NGI/MOP/2026/3104",
      "Issued: 26-Oct-2026",
      "Period: 01-Nov-2026 to 31-Oct-2027",
      "Open policy limit (aggregate): Rs. 6,00,00,000",
      "Basis of valuation: CIF + 10%",
      "Deposit premium: Rs. 30,000",
      "GST @ 18%: Rs. 5,400",
      "Total: Rs. 35,400",
      "Declarations: monthly, by the 10th",
    ],
    fields: {
      policyNo: { v: "NGI/MOP/2026/3104", ref: 4, conf: "high" },
      issueDate: { v: "2026-10-26", ref: 5, conf: "high" },
      riskStart: { v: "2026-11-01", ref: 6, conf: "high" },
      riskEnd: { v: "2027-10-31", ref: 6, conf: "high" },
      currency: { v: "INR", ref: 7, conf: "high" },
      sumInsured: { v: 60000000, ref: 7, conf: "high" },
      grossPremium: { v: 30000, ref: 9, conf: "high" },
      gstPct: { v: 18, ref: 10, conf: "high" },
      gst: { v: 5400, ref: 10, conf: "high" },
      netPremium: { v: 35400, ref: 11, conf: "high" },
    },
  },
];
export const fixtureById = (id) => FIXTURES.find((f) => f.id === id);

// Sample documents that never go through extraction (pre-policy, debit notes, proofs).
export const PLAIN_SAMPLES = [
  { kind: "Quote", name: "Insurer quote (sample).pdf" },
  { kind: "KYC", name: "KYC documents (sample).pdf" },
  { kind: "GST certificate", name: "GST certificate (sample).pdf" },
  { kind: "Debit note", name: "Debit note (sample).pdf" },
  { kind: "Receipt proof", name: "Bank receipt advice (sample).pdf" },
  { kind: "Supporting document", name: "Survey report (sample).pdf" },
];

const fmtD = (iso) => {
  if (!iso) return "--";
  const [y, m, d] = iso.split("-");
  return `${d}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m - 1]}-${y}`;
};
const addYears = (iso, n) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${+y + n}-${m}-${d}`; };
const r2 = (x) => Math.round(x * 100) / 100;
const nf = (n, cur) => (n == null || n === "" ? "--" : Number(n).toLocaleString(cur === "INR" ? "en-IN" : "en-US", { maximumFractionDigits: 2 }));

// Generated sample documents, built from a term's values so the demo has something to review.
// They are labelled as generated in the UI; nothing reads a real file.
export function makeEndorsementFixture(kind, term, endoNo) {
  const v = term.values;
  const cur = v.currency || "INR";
  const effective = TODAY;
  if (kind === "premium") {
    const gross = r2((+v.grossPremium || 0) * 1.08);
    const gst = r2(gross * ((+v.gstPct || 0) / 100));
    const net = r2(gross + gst + (+v.stampDuty || 0));
    return {
      id: `GEN-END-P-${term.id}-${endoNo}`, generated: true, kind: "Endorsement", title: `Premium revision endorsement ${endoNo} (generated sample)`,
      lines: [
        "ENDORSEMENT (sample generated for this demo)",
        `Endorsement No: ${endoNo}`,
        `Attaching to policy: ${v.policyNo}`,
        `Effective from: ${fmtD(effective)}`,
        "Reason: revision of premium following insurer review",
        `Revised gross premium: ${cur} ${nf(gross, cur)}`,
        `Revised GST: ${cur} ${nf(gst, cur)}`,
        `Revised total premium: ${cur} ${nf(net, cur)}`,
        `Sum insured: ${cur} ${nf(v.sumInsured, cur)} (unchanged)`,
        `Period: ${fmtD(v.riskStart)} to ${fmtD(v.riskEnd)} (unchanged)`,
        "Printed date: 30-Oct-2026",
      ],
      fields: {
        grossPremium: { v: gross, ref: 6, conf: "high" }, gst: { v: gst, ref: 7, conf: "high" }, netPremium: { v: net, ref: 8, conf: "high" },
        sumInsured: { v: +v.sumInsured, ref: 9, conf: "high" }, riskStart: { v: v.riskStart, ref: 10, conf: "high" }, riskEnd: { v: v.riskEnd, ref: 10, conf: "high" },
        issueDate: { v: "2026-10-30", ref: 11, conf: "low", note: "This is the endorsement's print date, not the policy issue date" },
      },
      effective,
    };
  }
  const si = r2((+v.sumInsured || 0) * 1.2);
  const gross = r2((+v.grossPremium || 0) * 1.2);
  const gst = r2(gross * ((+v.gstPct || 0) / 100));
  const net = r2(gross + gst + (+v.stampDuty || 0));
  return {
    id: `GEN-END-S-${term.id}-${endoNo}`, generated: true, kind: "Endorsement", title: `Sum insured increase endorsement ${endoNo} (generated sample)`,
    lines: [
      "ENDORSEMENT (sample generated for this demo)",
      `Endorsement No: ${endoNo}`,
      `Attaching to policy: ${v.policyNo}`,
      `Effective from: ${fmtD(effective)}`,
      "Reason: increase in sum insured at insured's request",
      `Revised sum insured: ${cur} ${nf(si, cur)}`,
      `Additional premium brings gross premium to: ${cur} ${nf(gross, cur)}`,
      `GST: ${cur} ${nf(gst, cur)}`,
      `Total premium: ${cur} ${nf(net, cur)}`,
      `Insured location: ${v.location || "Not stated"}`,
    ],
    fields: {
      sumInsured: { v: si, ref: 6, conf: "high" }, grossPremium: { v: gross, ref: 7, conf: "high" }, gst: { v: gst, ref: 8, conf: "high" },
      netPremium: { v: net, ref: 9, conf: "high" }, location: { v: v.location || "", ref: 10, conf: "low" },
    },
    effective,
  };
}

export function makeRenewalFixture(oldTerm, policy, insurerName) {
  const v = oldTerm.values;
  const cur = v.currency || "INR";
  const start = addYears(v.riskStart, 1), end = addYears(v.riskEnd, 1);
  const gross = r2((+v.grossPremium || 0) * 1.05);
  const gst = r2(gross * ((+v.gstPct || 0) / 100));
  const net = r2(gross + gst + (+v.stampDuty || 0));
  const pn = (v.policyNo || "NEW").replace(/\d{4}/, (y) => String(+y + 1));
  return {
    id: `GEN-REN-${oldTerm.id}`, generated: true, kind: "Renewal schedule", dept: policy.dept, type: policy.type,
    title: `Renewal schedule for ${v.policyNo} (generated sample)`,
    lines: [
      `${insurerName.toUpperCase()}`,
      "RENEWAL POLICY SCHEDULE (sample generated for this demo)",
      `Policy No: ${pn}`,
      `Previous policy: ${v.policyNo}`,
      `Period: ${fmtD(start)} to ${fmtD(end)}`,
      `Sum insured: ${cur} ${nf(v.sumInsured, cur)}`,
      `Gross premium: ${cur} ${nf(gross, cur)}`,
      "GST: [not printed on this page]",
      `Total premium: ${cur} ${nf(net, cur)}`,
      `Situation: ${v.location || "--"}`,
    ],
    fields: {
      policyNo: { v: pn, ref: 3, conf: "high" }, riskStart: { v: start, ref: 5, conf: "high" }, riskEnd: { v: end, ref: 5, conf: "high" },
      currency: { v: cur, ref: 6, conf: "high" }, sumInsured: { v: +v.sumInsured || 0, ref: 6, conf: "high" }, grossPremium: { v: gross, ref: 7, conf: "high" },
      netPremium: { v: net, ref: 9, conf: "high" }, ...(v.location ? { location: { v: v.location, ref: 10, conf: "low" } } : {}),
    },
  };
}

// ---------------------------------------------------------------- seed
const blankTerm = () => ({
  status: "confirmed", cancelled: false, nr: "New", values: {}, sources: {}, outcome: "Open", lossDetail: "",
  brokerageSnap: null, brokerageConfirmed: true, instalments: [], receipts: [], endorsements: [], vesselSchedules: [],
  cargoDecls: [], charterDecls: [], prevTermId: null, nextTermId: null, docId: null,
});

function srcAll(values, docId, conf = "high") {
  const s = {};
  Object.keys(values).forEach((k, i) => { if (values[k] !== "" && values[k] != null) s[k] = { docId, ref: i + 3, conf }; });
  return s;
}

// Live mode starts from the same shape with every list empty: no customers, insurers, team or rates.
export function seed() {
  if (!LIVE) return demoSeed();
  const d = demoSeed();
  Object.keys(d).forEach((k) => { if (Array.isArray(d[k])) d[k] = []; });
  d.settings = { balanceThresholdPct: 30 };
  return d;
}
function demoSeed() {
  const d = {
    version: 2, premiumModel: 2, seq: 500,
    remittances: [],
    insurers: [
      { id: "INS1", name: "Bharat Shield General Insurance", branches: [
        { id: "BR1", name: "Mumbai Fort", city: "Mumbai", country: "India" },
        { id: "BR2", name: "Chennai Harbour", city: "Chennai", country: "India" }] },
      { id: "INS2", name: "Coastline General Assurance", branches: [
        { id: "BR3", name: "Mumbai BKC", city: "Mumbai", country: "India" },
        { id: "BR4", name: "Dubai DIFC", city: "Dubai", country: "UAE" }] },
      { id: "INS3", name: "Northstar General Insurance", branches: [
        { id: "BR5", name: "Surat Ring Road", city: "Surat", country: "India" },
        { id: "BR6", name: "Pune Camp", city: "Pune", country: "India" }] },
      { id: "INS4", name: "Sahyadri General Insurance", branches: [
        { id: "BR7", name: "Pune Baner", city: "Pune", country: "India" },
        { id: "BR8", name: "Kolkata Park Street", city: "Kolkata", country: "India" }] },
    ],
    team: [
      { code: "CSC014", name: "Meera Joshi", role: "CSC" },
      { code: "CSC022", name: "Arun Pillai", role: "CSC" },
      { code: "RM07", name: "Kavita Rao", role: "RM" },
      { code: "RM11", name: "Sanjay Menon", role: "RM" },
      { code: "ACC02", name: "Farah Khan", role: "Accounts" },
    ],
    fx: [],
    presets: [
      { id: "PR1", insurerId: "INS2", policyType: "Protection & Indemnity", versions: [{ v: 1, pct: 8, status: "confirmed", at: "2026-04-01T10:00:00", by: "Admin (demo)" }] },
      { id: "PR2", insurerId: "INS1", policyType: "Marine Hull & Machinery", versions: [{ v: 1, pct: 10, status: "confirmed", at: "2026-04-01T10:00:00", by: "Admin (demo)" }] },
      { id: "PR3", insurerId: "INS2", policyType: "Marine Hull & Machinery", versions: [{ v: 1, pct: 9, status: "confirmed", at: "2026-04-01T10:00:00", by: "Admin (demo)" }, { v: 2, pct: 9.5, status: "confirmed", at: "2026-09-01T10:00:00", by: "Admin (demo)" }] },
      { id: "PR4", insurerId: "INS3", policyType: "Standard Fire and Special Perils", versions: [{ v: 1, pct: 12.5, status: "confirmed", at: "2026-04-01T10:00:00", by: "Admin (demo)" }] },
      { id: "PR5", insurerId: "INS4", policyType: "Group Mediclaim Policy", versions: [{ v: 1, pct: 7.5, status: "confirmed", at: "2026-04-01T10:00:00", by: "Admin (demo)" }] },
      { id: "PR6", insurerId: "INS3", policyType: "Marine Cargo - Open Policy", versions: [{ v: 1, pct: 15, status: "confirmed", at: "2026-04-01T10:00:00", by: "Admin (demo)" }, { v: 2, pct: 14, status: "draft", at: "2026-10-20T16:00:00", by: "Admin (demo)" }] },
    ],
    customers: [], policies: [], terms: [], documents: [], audit: [], snapshots: [],
    settings: { balanceThresholdPct: 30 },
  };

  // Demo FX rates: fictional, not market data.
  const base = { USD: 83.2, AED: 22.65, EUR: 90.4 };
  ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].forEach((m, i) => {
    Object.entries(base).forEach(([cur, r]) => {
      d.fx.push({ month: m, cur, versions: [{ rate: r2(r + i * (cur === "AED" ? 0.03 : 0.11)), at: `${m}-01T09:00:00`, by: "Accounts (demo)", note: "Demo rate" }] });
    });
  });
  // November 2026 is left without rates on purpose, so reports show the missing-rate state.

  const cust = (o) => d.customers.push({ address: "", phone: "", email: "", gst: "", source: "Direct", referral: "", tags: [], createdAt: "2026-04-01T09:00:00", ...o });
  cust({ id: "C1", code: "CUST-1001", name: "Konkan Bulk Carriers Pvt Ltd", vertical: "Corporate", city: "Mumbai", country: "India", address: "4th floor, Harbour View, Ballard Estate", phone: "+91 90000 00101", email: "ops@konkanbulk.example", gst: "27AAACK0000A1Z0", cse: "CSC014", rm: "RM07", tags: ["Marine", "Fleet owner"] });
  cust({ id: "C2", code: "CUST-1002", name: "Deccan Agro Exports LLP", vertical: "Corporate", city: "Pune", country: "India", phone: "+91 90000 00102", email: "accounts@deccanagro.example", gst: "27AAAFD0000B1Z0", source: "Referral", referral: "REF-03 Pune CA network", cse: "CSC022", rm: "RM11", tags: ["Exporter"] });
  cust({ id: "C3", code: "CUST-1003", name: "Riverbend Textiles Ltd", vertical: "Corporate", city: "Surat", country: "India", phone: "+91 90000 00103", email: "admin@riverbend.example", gst: "24AAACR0000C1Z0", cse: "CSC014", rm: "RM11", tags: ["Manufacturing"] });
  cust({ id: "C4", code: "CUST-1004", name: "Gulf Horizon Shipping FZE", vertical: "Corporate", city: "Dubai", country: "UAE", phone: "+971 50 000 0104", email: "chartering@gulfhorizon.example", source: "Referral", referral: "REF-07 Dubai P&I desk", cse: "CSC022", rm: "RM07", tags: ["Charterer"] });
  cust({ id: "C5", code: "CUST-1005", name: "Sunrise Events and Expos", vertical: "Corporate", city: "Mumbai", country: "India", phone: "+91 90000 00105", cse: "CSC022", rm: "RM11" });
  cust({ id: "C6", code: "CUST-1006", name: "Rohan Mehta", vertical: "Retail", city: "Pune", country: "India", phone: "+91 90000 00106", cse: "CSC014", rm: "" });
  cust({ id: "C7", code: "CUST-1007", name: "Lotus Clinics Pvt Ltd", vertical: "Corporate", city: "Mumbai", country: "India", phone: "+91 90000 00107", gst: "27AAACL0000D1Z0", source: "Referral", referral: "REF-03 Pune CA network", cse: "CSC014", rm: "RM07", tags: ["Prospect"] });
  cust({ id: "C8", code: "CUST-1008", name: "Vikram Nair", vertical: "Retail", city: "Mumbai", country: "India", phone: "+91 90000 00108", cse: "CSC022", rm: "" });

  const doc = (o) => { const id = `DOC${d.documents.length + 1}`; d.documents.push({ id, policyId: null, termId: null, fixtureId: null, addedAt: "2026-04-01T09:00:00", addedBy: "Meera Joshi (CSC014)", note: "", ...o }); return id; };
  const log = (o) => d.audit.push({ id: `A${d.audit.length + 1}`, who: "Meera Joshi (CSC014)", ...o });

  let ctl = 1;
  const pol = (o) => { const id = `P${d.policies.length + 1}`; d.policies.push({ id, controlNo: `CN-${String(ctl++).padStart(4, "0")}`, cover: "", vesselMode: "", termIds: [], ...o }); return id; };
  const term = (pid, o) => {
    const p = d.policies.find((x) => x.id === pid);
    const id = `T${d.terms.length + 1}`;
    const t = { ...blankTerm(), id, policyId: pid, termNo: p.termIds.length + 1, ...o };
    if (!t.docId) t.docId = doc({ customerId: p.customerId, policyId: pid, termId: id, kind: "Policy schedule", name: `Policy schedule ${t.values.policyNo || ""}.pdf`, addedAt: `${t.values.issueDate || "2026-04-01"}T11:00:00` });
    if (!Object.keys(t.sources).length) t.sources = srcAll(t.values, t.docId);
    d.terms.push(t); p.termIds.push(id);
    log({ at: `${t.values.issueDate || "2026-04-01"}T11:05:00`, customerId: p.customerId, policyId: pid, termId: id, action: t.status === "draft" ? "Draft saved" : "Term confirmed", detail: `Term ${t.termNo} ${t.status === "draft" ? "saved as draft" : "confirmed after review"}` });
    return t;
  };
  const snap = (presetId, v, pct) => ({ presetId, version: v, pct });

  // P1: P&I fleet, USD, quarterly instalments, late receipt, one vessel added mid-term.
  const p1 = pol({ customerId: "C1", dept: "Marine", type: "Protection & Indemnity", insurerId: "INS2", branchId: "BR3", vesselMode: "Fleet" });
  const t1 = term(p1, { values: { policyNo: "CGA/PI/2026/0457", planName: "P&I Entry, owners", uin: "", proposalDate: "2026-02-02", issueDate: "2026-02-18", riskStart: "2026-02-20", riskEnd: "2027-02-19", bookDate: "2026-04-08", currency: "USD", sumInsured: 5000000, premiumRate: "", grossPremium: 48000, gstPct: 18, gst: 8640, stampDuty: 0, netPremium: 56640, excess: "USD 10,000 per claim", location: "Worldwide trading", share: 100, coBrokerShare: 0, renewable: "Yes", brokeragePct: 8 }, brokerageSnap: snap("PR1", 1, 8) });
  t1.instalments = [
    { no: 1, due: "2026-02-20", amount: 12000, taxPct: 18 }, { no: 2, due: "2026-05-20", amount: 12000, taxPct: 18 },
    { no: 3, due: "2026-08-20", amount: 12000, taxPct: 18 }, { no: 4, due: "2026-11-20", amount: 12000, taxPct: 18 }];
  const rp = doc({ customerId: "C1", policyId: p1, termId: t1.id, kind: "Receipt proof", name: "Bank advice USD 14,160 (Mar).pdf", addedAt: "2026-03-02T15:00:00" });
  t1.receipts = [
    { id: "R1", instNo: 1, date: "2026-03-02", amount: 14160, mode: "Bank transfer", ref: "UTR DEMO0302A", bank: "Demo Bank, Fort", remitDate: "2026-03-05", proofDocId: rp },
    { id: "R2", instNo: 2, date: "2026-05-18", amount: 14160, mode: "Bank transfer", ref: "UTR DEMO0518B", bank: "Demo Bank, Fort", remitDate: "2026-05-21", proofDocId: null },
    { id: "R3", instNo: 3, date: "2026-09-14", amount: 14160, mode: "Bank transfer", ref: "UTR DEMO0914C", bank: "Demo Bank, Fort", remitDate: "", proofDocId: null }];
  const dn = doc({ customerId: "C1", policyId: p1, termId: t1.id, kind: "Debit note", name: "Debit note CGA-DN-0457.pdf", addedAt: "2026-02-19T10:00:00" });
  const endDoc = doc({ customerId: "C1", policyId: p1, termId: t1.id, kind: "Endorsement", name: "Endorsement CGA/PI/END/02 (vessel added).pdf", addedAt: "2026-07-03T12:00:00" });
  t1.vesselSchedules = [
    { version: 1, effectiveFrom: "2026-02-20", vessels: [{ name: "MV Konkan Pride", imo: "9000001", gt: 32000 }, { name: "MV Konkan Star", imo: "9000002", gt: 28500 }, { name: "MV Ratnagiri Dawn", imo: "9000003", gt: 18200 }], change: null, at: "2026-02-18T11:00:00", by: "Meera Joshi (CSC014)" },
    { version: 2, effectiveFrom: "2026-07-01", vessels: [{ name: "MV Konkan Pride", imo: "9000001", gt: 32000 }, { name: "MV Konkan Star", imo: "9000002", gt: 28500 }, { name: "MV Ratnagiri Dawn", imo: "9000003", gt: 18200 }, { name: "MV Konkan Crest", imo: "9000004", gt: 24100 }], change: { type: "Add", vessel: "MV Konkan Crest", effDate: "2026-07-01", premiumAdj: 6000, brokerageAdj: 480, docId: endDoc, note: "Amounts as stated on insurer endorsement CGA/PI/END/02. No formula applied." }, at: "2026-07-03T12:10:00", by: "Meera Joshi (CSC014)" }];
  log({ at: "2026-07-03T12:10:00", customerId: "C1", policyId: p1, termId: t1.id, action: "Fleet change confirmed", detail: "Added MV Konkan Crest from 01-Jul-2026. Premium adjustment USD 6,000, brokerage adjustment USD 480 (reviewed). Schedule v1 kept." });
  [["2026-03-02", "R1"], ["2026-05-18", "R2"], ["2026-09-14", "R3"]].forEach(([dt, r]) => log({ at: `${dt}T16:00:00`, who: "Farah Khan (ACC02)", customerId: "C1", policyId: p1, termId: t1.id, action: "Receipt recorded", detail: `Receipt ${r} recorded against an instalment. Policy values unchanged.` }));
  void dn;

  // P2: H&M, individual vessel, USD, single payment.
  const p2 = pol({ customerId: "C1", dept: "Marine", type: "Marine Hull & Machinery", insurerId: "INS1", branchId: "BR1", vesselMode: "Individual vessel" });
  const t2 = term(p2, { values: { policyNo: "BSG/HM/2026/1182", planName: "Hull ITC basis", uin: "", proposalDate: "2026-03-20", issueDate: "2026-03-28", riskStart: "2026-04-01", riskEnd: "2027-03-31", bookDate: "2026-04-02", currency: "USD", sumInsured: 3200000, premiumRate: 0.9, grossPremium: 28800, gstPct: 18, gst: 5184, stampDuty: 0, netPremium: 33984, excess: "USD 30,000 each accident", location: "Indian coastal", share: 100, coBrokerShare: 0, renewable: "Yes", brokeragePct: 10 }, brokerageSnap: snap("PR2", 1, 10) });
  t2.vesselSchedules = [{ version: 1, effectiveFrom: "2026-04-01", vessels: [{ name: "MV Konkan Pride", imo: "9000001", gt: 32000 }], change: null, at: "2026-03-28T11:00:00", by: "Meera Joshi (CSC014)" }];
  t2.receipts = [{ id: "R4", instNo: null, date: "2026-04-10", amount: 33984, mode: "Bank transfer", ref: "UTR DEMO0410D", bank: "Demo Bank, Fort", remitDate: "2026-04-12", proofDocId: null }];

  // P3: Group Mediclaim: term 1 renewed, term 2 issued but not yet started, unpaid.
  const p3 = pol({ customerId: "C1", dept: "Health", type: "Group Mediclaim Policy", insurerId: "INS4", branchId: "BR7", cover: "Group" });
  const t3a = term(p3, { values: { policyNo: "SGI/GMC/2025/5521", planName: "Group Health Secure", uin: "DEMO-GMC-0007", proposalDate: "2025-11-01", issueDate: "2025-11-10", riskStart: "2025-11-15", riskEnd: "2026-11-14", bookDate: "2025-11-10", currency: "INR", sumInsured: 5000000, premiumRate: "", grossPremium: 600000, gstPct: 18, gst: 108000, stampDuty: 0, netPremium: 708000, excess: "", location: "Mumbai", share: 100, coBrokerShare: 0, renewable: "Yes", brokeragePct: 7.5 }, brokerageSnap: snap("PR5", 1, 7.5), outcome: "Renewed" });
  t3a.receipts = [{ id: "R5", instNo: null, date: "2025-11-12", amount: 708000, mode: "Cheque", ref: "CHQ 000451", bank: "Demo Bank, Fort", remitDate: "2025-11-13", proofDocId: null }];
  const t3b = term(p3, { nr: "Renewal", prevTermId: t3a.id, values: { policyNo: "SGI/GMC/2026/5521", planName: "Group Health Secure", uin: "DEMO-GMC-0007", proposalDate: "2026-10-20", issueDate: "2026-10-28", riskStart: "2026-11-15", riskEnd: "2027-11-14", bookDate: "2026-10-28", currency: "INR", sumInsured: 5000000, premiumRate: "", grossPremium: 640000, gstPct: 18, gst: 115200, stampDuty: 0, netPremium: 755200, excess: "", location: "Mumbai", share: 100, coBrokerShare: 0, renewable: "Yes", brokeragePct: 7.5 }, brokerageSnap: snap("PR5", 1, 7.5) });
  t3a.nextTermId = t3b.id;
  log({ at: "2026-10-28T11:10:00", customerId: "C1", policyId: p3, termId: t3a.id, action: "Renewal confirmed", detail: `Linked forward to term 2 (${t3b.values.policyNo}). Term 1 and its documents kept.` });

  // P4: Cargo open policy with declarations (balance below the 30% example).
  const p4 = pol({ customerId: "C2", dept: "Marine", type: "Marine Cargo - Open Policy", insurerId: "INS3", branchId: "BR6" });
  const t4 = term(p4, { values: { policyNo: "NGI/MOP/2026/1460", planName: "Export open cover", uin: "", proposalDate: "2026-05-20", issueDate: "2026-05-28", riskStart: "2026-06-01", riskEnd: "2027-05-31", bookDate: "2026-06-03", currency: "INR", sumInsured: 100000000, premiumRate: 0.05, grossPremium: 50000, gstPct: 18, gst: 9000, stampDuty: 0, netPremium: 59000, excess: "Rs. 25,000 each consignment", location: "Pune warehouse to world ports", share: 100, coBrokerShare: 0, renewable: "Yes", brokeragePct: 15 }, brokerageSnap: snap("PR6", 1, 15) });
  t4.coverProfile = demoCargoProfile(100000000);
  t4.receipts = [{ id: "R6", instNo: null, date: "2026-06-05", amount: 59000, mode: "NEFT", ref: "UTR DEMO0605E", bank: "Demo Bank, Pune", remitDate: "2026-06-08", proofDocId: null }];
  const decl = (n, from, to, cert, vessel, pol_, pod, dest, bl, fcCur, fcVal, siInr, rate, prem, goods) => ({
    id: `DEC${n}`, no: `D-${String(n).padStart(3, "0")}`, from, to, certNo: cert, certDate: to, vesselNo: vessel, portLoading: pol_, portDischarge: pod, finalDest: dest,
    blNo: bl, blDate: from, currency: fcCur, siFc: fcVal, siInr, rate, premiumInr: prem, premiumFc: r2(prem / (fcCur === "USD" ? 83.5 : 1)), invoiceNo: `INV-${n}0${n}`, invoiceDate: from,
    goods, basis: "CIF + 10%", marks: `DAE/${n}/1-${n * 40}`, packages: `${n * 40} bags`, coverage: "ICC (A)", lrNo: "", lrDate: "", at: `${to}T15:00:00`, by: "Arun Pillai (CSC022)",
  });
  t4.cargoDecls = [
    decl(1, "2026-07-01", "2026-07-31", "CERT-7701", "VSL-DEMO-11", "Nhava Sheva", "Jebel Ali", "Dubai", "BL-DEMO-0711", "USD", 287425, 24000000, 0.05, 12000, "Basmati rice in 50 kg bags"),
    decl(2, "2026-08-01", "2026-08-31", "CERT-7702", "VSL-DEMO-12", "Nhava Sheva", "Rotterdam", "Antwerp", "BL-DEMO-0812", "USD", 371257, 31000000, 0.05, 15500, "Dehydrated onion flakes"),
    decl(3, "2026-09-01", "2026-09-30", "CERT-7703", "VSL-DEMO-13", "Mundra", "Port Klang", "Kuala Lumpur", "BL-DEMO-0913", "USD", 269461, 22500000, 0.05, 11250, "Grapes, refrigerated")];

  // P5: Fire, expiring within 30 days, renewable, with a past endorsement.
  const p5 = pol({ customerId: "C3", dept: "Fire", type: "Standard Fire and Special Perils", insurerId: "INS3", branchId: "BR5" });
  const t5 = term(p5, { values: { policyNo: "NGI/FIRE/2025/0812", planName: "Standard Fire and Special Perils", uin: "", proposalDate: "2025-11-20", issueDate: "2025-11-27", riskStart: "2025-12-01", riskEnd: "2026-11-30", bookDate: "2025-11-28", currency: "INR", sumInsured: 180000000, premiumRate: 0.12, grossPremium: 216000, gstPct: 18, gst: 38880, stampDuty: 0, netPremium: 254880, excess: "5% of claim, min Rs. 10,000", location: "Plot 22, GIDC Sachin, Surat", share: 100, coBrokerShare: 0, renewable: "Yes", brokeragePct: 12.5 }, brokerageSnap: snap("PR4", 1, 12.5) });
  const e1doc = doc({ customerId: "C3", policyId: p5, termId: t5.id, kind: "Endorsement", name: "Endorsement NGI-END-01 (stock increase).pdf", addedAt: "2026-03-10T12:00:00" });
  t5.endorsements = [{ id: "E1", no: "END-01", docId: e1doc, effDate: "2026-03-10", at: "2026-03-10T12:30:00", by: "Meera Joshi (CSC014)",
    changes: [
      { field: "sumInsured", before: 160000000, after: 180000000, beforeSrc: { docId: t5.docId, ref: 8 }, afterSrc: { docId: e1doc, ref: 6 } },
      { field: "grossPremium", before: 192000, after: 216000, beforeSrc: { docId: t5.docId, ref: 9 }, afterSrc: { docId: e1doc, ref: 7 } },
      { field: "gst", before: 34560, after: 38880, beforeSrc: { docId: t5.docId, ref: 10 }, afterSrc: { docId: e1doc, ref: 8 } },
      { field: "netPremium", before: 226560, after: 254880, beforeSrc: { docId: t5.docId, ref: 11 }, afterSrc: { docId: e1doc, ref: 9 } }],
    unchanged: ["riskStart", "riskEnd", "location"] }];
  ["sumInsured", "grossPremium", "gst", "netPremium"].forEach((k, i) => { t5.sources[k] = { docId: e1doc, ref: 6 + i, conf: "high", via: "END-01" }; });
  log({ at: "2026-03-10T12:30:00", customerId: "C3", policyId: p5, termId: t5.id, action: "Endorsement confirmed", detail: "END-01 changed 4 reviewed fields (sum insured, gross premium, GST, net premium). Earlier values kept." });
  t5.receipts = [{ id: "R7", instNo: null, date: "2025-11-29", amount: 226560, mode: "NEFT", ref: "UTR DEMO1129F", bank: "Demo Bank, Surat", remitDate: "2025-12-01", proofDocId: null },
    { id: "R8", instNo: null, date: "2026-03-18", amount: 28320, mode: "NEFT", ref: "UTR DEMO0318G", bank: "Demo Bank, Surat", remitDate: "2026-03-20", proofDocId: null }];
  doc({ customerId: "C3", kind: "Quote", name: "Renewal quote from Northstar (sample).pdf", addedAt: "2026-10-22T10:00:00", note: "Pre-renewal quote, not yet linked to a policy" });

  // P6: Charterers Liability, USD, Dubai branch.
  const p6 = pol({ customerId: "C4", dept: "Marine", type: "Charterers Liability", insurerId: "INS2", branchId: "BR4", vesselMode: "Fleet" });
  const t6 = term(p6, { values: { policyNo: "CGA/CL/2026/0088", planName: "Charterers liability, time and voyage", uin: "", proposalDate: "2026-04-20", issueDate: "2026-04-28", riskStart: "2026-05-01", riskEnd: "2027-04-30", bookDate: "2026-05-06", currency: "USD", sumInsured: 10000000, premiumRate: "", grossPremium: 22000, gstPct: 0, gst: 0, stampDuty: 0, netPremium: 22000, excess: "USD 15,000", location: "Worldwide", share: 100, coBrokerShare: 20, renewable: "Yes", brokeragePct: 10 }, brokerageSnap: null });
  t6.sources.gst = { docId: null, ref: null, conf: "manual", note: "Entered by Arun Pillai. Tax treatment for this branch is not verified." };
  t6.sources.gstPct = { docId: null, ref: null, conf: "manual" };
  t6.vesselSchedules = [{ version: 1, effectiveFrom: "2026-05-01", vessels: [{ name: "MV Desert Falcon (chartered)", imo: "9000011", gt: 41000 }, { name: "MV Pearl Current (chartered)", imo: "9000012", gt: 36500 }], change: null, at: "2026-04-28T11:00:00", by: "Arun Pillai (CSC022)" }];
  t6.charterDecls = [
    { id: "CD1", period: "May 2026", reference: "CP-DEMO-0501", vessel: "MV Desert Falcon (chartered)", remarks: "Time charter, 45 days", at: "2026-06-04T10:00:00", by: "Arun Pillai (CSC022)" },
    { id: "CD2", period: "Jun 2026", reference: "CP-DEMO-0602", vessel: "MV Pearl Current (chartered)", remarks: "Voyage charter", at: "2026-07-03T10:00:00", by: "Arun Pillai (CSC022)" }];
  t6.receipts = [{ id: "R9", instNo: null, date: "2026-05-12", amount: 22000, mode: "SWIFT", ref: "SWIFT DEMO0512H", bank: "Demo Bank, Dubai", remitDate: "2026-05-15", proofDocId: null }];

  // P7: Event Cancellation, NOT renewable, expiring 20-Nov-2026.
  const p7 = pol({ customerId: "C5", dept: "Miscellaneous", type: "Event Cancellation Insurance", insurerId: "INS1", branchId: "BR1" });
  const t7 = term(p7, { values: { policyNo: "BSG/EC/2026/0331", planName: "Event cancellation, single event", uin: "", proposalDate: "2026-08-01", issueDate: "2026-08-08", riskStart: "2026-08-15", riskEnd: "2026-11-20", bookDate: "2026-08-10", currency: "INR", sumInsured: 7500000, premiumRate: 1.5, grossPremium: 112500, gstPct: 18, gst: 20250, stampDuty: 0, netPremium: 132750, excess: "", location: "Exhibition centre, Goregaon", share: 100, coBrokerShare: 0, renewable: "No", brokeragePct: 10 }, brokerageSnap: null });
  t7.receipts = [{ id: "R10", instNo: null, date: "2026-08-09", amount: 132750, mode: "UPI", ref: "UPI DEMO0809I", bank: "", remitDate: "2026-08-11", proofDocId: null }];

  // P8: Motor retail: term 1 renewed into an active term 2.
  const p8 = pol({ customerId: "C6", dept: "Motor", type: "Motor Private Car Package Policy", insurerId: "INS4", branchId: "BR7", cover: "Individual" });
  const t8a = term(p8, { outcome: "Renewed", values: { policyNo: "SGI/MPC/2025/9001", planName: "Private car package", uin: "", proposalDate: "2025-10-05", issueDate: "2025-10-08", riskStart: "2025-10-12", riskEnd: "2026-10-11", bookDate: "2025-10-08", currency: "INR", sumInsured: 680000, premiumRate: "", grossPremium: 17200, gstPct: 18, gst: 3096, stampDuty: 0, netPremium: 20296, excess: "Rs. 1,000", location: "Pune", share: 100, coBrokerShare: 0, renewable: "Yes", brokeragePct: 15 } });
  const t8b = term(p8, { nr: "Renewal", prevTermId: t8a.id, values: { policyNo: "SGI/MPC/2026/9001", planName: "Private car package", uin: "", proposalDate: "2026-10-05", issueDate: "2026-10-09", riskStart: "2026-10-12", riskEnd: "2027-10-11", bookDate: "2026-10-09", currency: "INR", sumInsured: 620000, premiumRate: "", grossPremium: 18400, gstPct: 18, gst: 3312, stampDuty: 0, netPremium: 21712, excess: "Rs. 1,000", location: "Pune", share: 100, coBrokerShare: 0, renewable: "Yes", brokeragePct: 15 } });
  t8a.nextTermId = t8b.id;
  t8b.receipts = [{ id: "R11", instNo: null, date: "2026-10-09", amount: 21712, mode: "Debit card", ref: "AUTH DEMO1009J", bank: "Demo Bank", remitDate: "2026-10-10", proofDocId: null }];

  // P9: Health floater lost at renewal.
  const p9 = pol({ customerId: "C8", dept: "Health", type: "Health Family Floater Policy", insurerId: "INS1", branchId: "BR1", cover: "Individual" });
  const t9 = term(p9, { outcome: "Lost", lossDetail: "Customer said he renewed through another intermediary ", values: { policyNo: "BSG/HFF/2025/4410", planName: "Family floater", uin: "", proposalDate: "2025-09-28", issueDate: "2025-10-02", riskStart: "2025-10-06", riskEnd: "2026-10-05", bookDate: "2025-10-02", currency: "INR", sumInsured: 1000000, premiumRate: "", grossPremium: 24500, gstPct: 18, gst: 4410, stampDuty: 0, netPremium: 28910, excess: "", location: "Mumbai", share: 100, coBrokerShare: 0, renewable: "Yes", brokeragePct: 15 } });
  log({ at: "2026-10-07T10:00:00", customerId: "C8", policyId: p9, termId: t9.id, action: "Marked lost", detail: "Renewal outcome set to Lost with detail entered by Arun Pillai." });

  // P10: draft from a poor scan, fields missing.
  const p10 = pol({ customerId: "C2", dept: "Miscellaneous", type: "Burglary Insurance", insurerId: "INS3", branchId: "BR6" });
  const fdoc = doc({ customerId: "C2", policyId: p10, kind: "Policy schedule", name: "Burglary schedule (faint scan).pdf", fixtureId: "FX-FIRE-POOR", addedAt: "2026-10-29T15:00:00", addedBy: "Arun Pillai (CSC022)" });
  const t10 = term(p10, { status: "draft", docId: fdoc, values: { policyNo: "NGI/BUR/26/0#41", issueDate: "2026-10-27", riskStart: "2026-11-01", riskEnd: "", bookDate: "", currency: "INR", sumInsured: 12000000, grossPremium: 18000, gstPct: "", gst: "", netPremium: 21240, location: "", renewable: "", brokeragePct: "" }, brokerageConfirmed: false,
    sources: { policyNo: { docId: fdoc, ref: 4, conf: "low" }, issueDate: { docId: fdoc, ref: 6, conf: "low" }, riskStart: { docId: fdoc, ref: 7, conf: "high" }, currency: { docId: fdoc, ref: 8, conf: "high" }, sumInsured: { docId: fdoc, ref: 8, conf: "high" }, grossPremium: { docId: fdoc, ref: 9, conf: "high" }, netPremium: { docId: fdoc, ref: 11, conf: "high" } } });
  d.documents.find((x) => x.id === fdoc).termId = t10.id;

  // Pre-policy documents for a prospect with no policy yet.
  doc({ customerId: "C7", kind: "Quote", name: "Group Mediclaim quote, 40 staff (sample).pdf", addedAt: "2026-10-24T11:00:00", note: "Awaiting customer decision" });
  doc({ customerId: "C7", kind: "KYC", name: "KYC documents (sample).pdf", addedAt: "2026-10-24T11:05:00" });
  doc({ customerId: "C7", kind: "GST certificate", name: "GST certificate (sample).pdf", addedAt: "2026-10-24T11:06:00" });

  // Brokerage paid by insurers. Bharat Shield short-paid the event policy; Coastline has not paid the charterers policy.
  d.remittances = [
    { id: "RM0", insurerId: "INS4", date: "2025-12-05", ref: "SGI/BRK/1205", note: "", at: "2025-12-06T10:00:00", by: "Farah Khan (ACC02)", lines: [{ termId: t3a.id, amount: 45000 }, { termId: t8a.id, amount: 2580 }] },
    { id: "RM00", insurerId: "INS1", date: "2025-11-12", ref: "BSG/BRK/1112", note: "", at: "2025-11-13T10:00:00", by: "Farah Khan (ACC02)", lines: [{ termId: t9.id, amount: 3675 }] },
    { id: "RM1", insurerId: "INS1", date: "2026-09-15", ref: "BSG/BRK/0915", note: "", at: "2026-09-16T10:00:00", by: "Farah Khan (ACC02)", lines: [{ termId: t2.id, amount: 2880 }, { termId: t7.id, amount: 9000 }] },
    { id: "RM2", insurerId: "INS2", date: "2026-08-20", ref: "CGA NEFT 0820", note: "", at: "2026-08-21T10:00:00", by: "Farah Khan (ACC02)", lines: [{ termId: t1.id, amount: 3840 }] },
    { id: "RM3", insurerId: "INS3", date: "2026-07-10", ref: "NGI-BRK-0710", note: "", at: "2026-07-11T10:00:00", by: "Farah Khan (ACC02)", lines: [{ termId: t4.id, amount: 7500 }, { termId: t5.id, amount: 27000 }] },
  ];
  d.remittances.forEach((r) => log({ at: r.at, who: r.by, action: "Brokerage received", detail: `${r.ref}: ${r.lines.length} polic${r.lines.length === 1 ? "y" : "ies"} from ${d.insurers.find((i) => i.id === r.insurerId).name}.` }));

  // States come from the city, the same way the forms fill them.
  d.customers.forEach((c) => { c.state = c.state || placeOf(c.city)?.state || ""; });
  d.insurers.forEach((i) => i.branches.forEach((br) => { br.state = br.state || placeOf(br.city)?.state || ""; }));

  d.audit.sort((a, b) => a.at.localeCompare(b.at));
  return d;
}
void day;
