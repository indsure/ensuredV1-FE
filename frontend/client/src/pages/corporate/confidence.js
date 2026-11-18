// How sure the reader is about a value it found, as green (sure), amber (please check) or red (please
// verify). One place holds the thresholds and the points, so the review screens, the bulk upload and the
// Admin settings all agree. Pure functions only: no screen code here.
import { VOCAB, phraseRe } from "./vocab.js";

// The thresholds an Admin can change (db.settings.ocr). The points below are fixed and shown on the Admin screen.
export const OCR_DEFAULTS = { green: 85, amber: 60, gap: 10 };
// One value next to a known label scores 85 (green) on any page; on page 1 or 2, or printed twice, more.
export const POINTS = { base: 45, label: 40, early: 10, repeated: 10, sums: 20, prior: -50, scan: -20 };
export const POINT_WORDS = [
  ["label", "Next to a known label from the naming map"],
  ["early", "On page 1 or 2"],
  ["repeated", "Printed more than once"],
  ["sums", "The figures add up"],
  ["prior", "Next to \"prior\", \"previous\" or \"former\""],
  ["scan", "Read from a scan"],
];
// The fields that get a colour and a pick list.
export const PICK_FIELDS = ["insurer", "policyNo", "sumInsured"];
export const PICK_LABELS = { insurer: "Insurer", policyNo: "Policy number", sumInsured: "Sum insured" };

export function ocrSettings(db) {
  const s = (db && db.settings && db.settings.ocr) || {};
  const num = (v, d) => (Number.isFinite(+v) && v !== "" && v != null ? Math.max(0, Math.min(100, +v)) : d);
  const green = num(s.green, OCR_DEFAULTS.green);
  return { green, amber: Math.min(green, num(s.amber, OCR_DEFAULTS.amber)), gap: num(s.gap, OCR_DEFAULTS.gap) };
}

// The page a line is on, from the "[Page N]" markers in the reader's lines (strings or objects).
export function pageOf(lines, ref) {
  for (let i = Math.min((lines || []).length, ref) - 1; i >= 0; i--) {
    const t = typeof lines[i] === "string" ? lines[i] : lines[i]?.text;
    const m = /^\[Page (\d+)\]$/.exec(t || "");
    if (m) return +m[1];
  }
  return 1;
}

const labelRes = {};
const knownLabel = (key, label) => {
  if (!label) return false;
  const re = (labelRes[key] ||= VOCAB[key] ? phraseRe(VOCAB[key]) : null);
  return !!(re && re.test(label));
};

// Points for one candidate, with the reasons in words.
export function scoreCandidate(key, c, { lines, ocr } = {}) {
  const why = [];
  let s = POINTS.base;
  const add = (k, n = POINTS[k]) => { s += n; why.push(k); };
  const page = c.firstPage || pageOf(lines, c.ref);
  const labelled = key === "insurer" ? ["labelled", "stated", "known", "security"].includes(c.how) : knownLabel(key, c.label) || /^(total idv|limit|sum insured|idv|aoy)/i.test(c.label || "");
  if (labelled && !c.prior) add("label");
  if (page <= 2) add("early");
  if ((c.count || 1) >= 2 || (c.pages || 1) >= 2) add("repeated");
  if (c.sums) add("sums");
  if (c.prior) add("prior");
  if (ocr) add("scan");
  return { ...c, page, score: Math.max(0, Math.min(100, s)), why };
}

// The colour for a field, and its candidates best first. "inUse" is the value the reader put in the field.
export function judgeField(key, cands, { lines, ocr, settings = OCR_DEFAULTS, inUse } = {}) {
  const scored = (cands || []).map((c) => scoreCandidate(key, c, { lines, ocr }));
  scored.sort((a, b) => (a.prior === b.prior ? 0 : a.prior ? 1 : -1) || b.score - a.score || (inUse != null && String(b.v) === String(inUse)) - (inUse != null && String(a.v) === String(inUse)) || a.ref - b.ref);
  // The value the reader chose always stays first: its own rules (Total IDV, AOY, the limit cell) know more
  // than these points. The points only decide the colour.
  if (inUse != null) {
    const i = scored.findIndex((c) => String(c.v) === String(inUse));
    if (i > 0) scored.unshift(scored.splice(i, 1)[0]);
  }
  const [top, second] = scored;
  if (!top || top.prior) return { state: "red", cands: scored, reason: top ? "Only an earlier policy's value was found." : "Nothing was found on the document." };
  const close = second && !second.prior && top.score - second.score < settings.gap;
  if (top.score < settings.amber || close) return { state: "red", cands: scored, reason: close ? "Two values are about as likely as each other." : "The value found is not clearly labelled." };
  // A second value counts when it is a real rival, or another policy's number or an earlier name (the usual
  // mistake). A weak one-off mention deep in the wording is still listed, but does not make the field amber.
  const rival = !!second && (second.prior || second.score >= settings.amber);
  if (top.score < settings.green || rival || ocr) return { state: "amber", cands: scored, reason: rival ? `${scored.length} ${key === "insurer" ? "names" : "values"} were found.` : ocr ? "Read from a scan." : "The label next to it is not a usual one." };
  return { state: "green", cands: scored, reason: "One clear value next to a known label." };
}

// The reader's candidates for the three pick fields of a read document (fx from readPolicyPdf).
export function pickCandidates(fx) {
  if (!fx) return {};
  const f = fx.fields || {}, info = fx.info || {};
  return {
    insurer: info.insurerCands || [],
    policyNo: f.policyNo?.cands || info.policyNoCands || [],
    sumInsured: f.sumInsured?.cands || info.sumInsuredCands || [],
  };
}

// One entry for the corrections log: short strings only, at most three candidates, so the book stays small.
// The book is saved whole on every change, so the log is capped at about 40 KB.
export const LOG_MAX = 200;
// Local date and time, "2026-11-18T12:54", the same way the rest of the book stamps things.
export const localStamp = (t = Date.now()) => new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export function logEntry({ key, cands, suggested, final, how, by, doc, state }) {
  const cut = (s, n = 40) => String(s ?? "").slice(0, n);
  return {
    at: localStamp(), key, state: state || "",
    found: (cands || []).slice(0, 3).map((c) => ({ v: cut(c.v), ref: c.ref, l: cut(c.label, 24) })),
    sug: cut(suggested), fin: cut(final, 60), how, by: cut(by, 30), doc: cut(doc, 60),
  };
}
// Once a record is confirmed its pick lists are done with: drop them from the saved document (about 500
// bytes each), since the book is saved whole. Drafts keep them until they are confirmed.
export function dropCands(doc) {
  if (!doc) return;
  for (const k of ["policyNo", "sumInsured"]) if (doc.fixtureFields?.[k]?.cands) { const { cands, ...rest } = doc.fixtureFields[k]; doc.fixtureFields[k] = rest; }
  if (doc.info) for (const k of ["insurerCands", "policyNoCands", "sumInsuredCands"]) delete doc.info[k];
}
export function addLog(db, entries) {
  const list = [...(db.ocrLog || []), ...entries];
  return { ...db, ocrLog: list.slice(-LOG_MAX) };
}
