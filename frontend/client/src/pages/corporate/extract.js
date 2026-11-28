import { SELFTEST_PDF } from "./selftest.js";
import { VOCAB, phraseRe, CITIES, MUMBAI_AREAS } from "./vocab.js";
import { premiumFigures, clientGstin, liabilitySchedule, otherDetails, clientPlace, liabilityDetails, marineDetails, projectDetails, vesselList, riskAddressTable, engineeringType, instalmentTable } from "./extract-extra.js";
export { parseDateText } from "./extract-extra.js";
// Reads the text layer of a PDF in the browser (pdf.js) and finds register fields with fixed label rules.
// Nothing is uploaded. Scanned PDFs and photos are read with OCR (tesseract.js), also inside the browser:
// only the OCR program and its English word data are downloaded, the policy never leaves this computer.
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
export const PDFJS_BASE = PDFJS;
// The insurer's PDFs are read up to 60 pages, so premium tables in an annexure near the end are found.
const MAX_PAGES = 60;
const MAX_LINES = 3000;
// A scan is read on every page too (about 10 seconds a page): limits and premium tables are often deep in
// the schedule (WELCAR prints its sum insured on page 13 of 17).
const OCR_PAGES = MAX_PAGES;
const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const IMAGE_RE = /\.(jpe?g|png|webp|bmp|gif)$/i;
export const isImage = (f) => IMAGE_RE.test(f?.name || "") || /^image\/(jpeg|png|webp|bmp|gif)$/.test(f?.type || "");

export class ReadError extends Error { constructor(code, message, detail = "") { super(message); this.code = code; this.detail = detail; } }

let loading = null;
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("could not load " + src)); document.head.appendChild(s); });
}
// pdf.js and its worker are normally loaded by plain <script> tags at page start (the same way React is),
// so pdf.js runs on the page itself and needs no Worker. Loading on demand is only a fallback.
export function loadPdfJs() {
  if (!loading) loading = (async () => {
    if (!window.pdfjsLib) await loadScript(PDFJS + "pdf.min.js");
    if (!window.pdfjsWorker) await loadScript(PDFJS + "pdf.worker.min.js");
    if (!window.pdfjsLib || !window.pdfjsWorker) throw new Error("pdf.js loaded but did not start");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
    return window.pdfjsLib;
  })().catch((e) => { loading = null; throw new ReadError("load", "The PDF reader could not load. Check the internet connection and try again.", e?.message || String(e)); });
  return loading;
}

// Reads a tiny built-in PDF once, so the page can say whether reading works in this view.
let selfTest = null;
export function readerSelfTest() {
  if (!selfTest) selfTest = (async () => {
    try {
      const b64 = SELFTEST_PDF;
      if (!b64) return { state: "fail", detail: "self-test file missing from the page" };
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const file = new File([bytes], "self-test.pdf", { type: "application/pdf" });
      const fx = await readPolicyPdf(file);
      return fx.fields.policyNo?.v === "SELFTEST-001" ? { state: "ok" } : { state: "fail", detail: `read the test PDF but found "${fx.fields.policyNo?.v || "no policy number"}"` };
    } catch (e) {
      return { state: "fail", detail: e?.detail ? `${e.message} (${e.detail})` : `${e?.name || "Error"}: ${e?.message || e}` };
    }
  })();
  return selfTest;
}

// ---- PDF -> lines with x positions
export async function pdfToLines(file, onProgress = () => {}) {
  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  if (!isPdf) throw new ReadError("type", /\.(heic|heif|tiff?)$/i.test(file.name) ? "This photo format cannot be opened in a browser. Save it as JPG or PNG, or as a PDF, and attach that." : "Only a PDF or a photo (JPG, PNG) can be read. Choose the policy file.");
  const lib = await loadPdfJs();
  let pdf;
  try {
    pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true }).promise;
  } catch (e) {
    if (e && e.name === "PasswordException") throw new ReadError("password", "This PDF is password protected. Open it, save a copy without the password, and attach that.");
    throw new ReadError("broken", "This file could not be opened as a PDF. It may be damaged.", `${e?.name || "Error"}: ${e?.message || e}`);
  }
  const lines = [];
  const pages = Math.min(pdf.numPages, MAX_PAGES);
  for (let p = 1; p <= pages; p++) {
    onProgress(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const vp1 = page.getViewport({ scale: 1 });
    const items = tc.items.filter((i) => i.str && i.str.trim()).map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 10, s: i.str.replace(/\u00a0/g, " ") }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    for (const it of items) {
      const row = rows.find((r) => Math.abs(r.y - it.y) <= Math.max(2, it.h * 0.45));
      if (row) row.items.push(it); else rows.push({ y: it.y, items: [it] });
    }
    rows.sort((a, b) => b.y - a.y);
    if (pages > 1) lines.push({ page: p, text: `[Page ${p}]`, segs: [], marker: true });
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      const segs = [];
      for (const it of r.items) {
        const last = segs[segs.length - 1];
        const gap = last ? it.x - last.x2 : Infinity;
        if (last && gap < it.h * 1.2) { last.s += (gap > it.h * 0.15 ? " " : "") + it.s; last.x2 = it.x + it.w; }
        else segs.push({ x: it.x, x2: it.x + it.w, s: it.s });
      }
      segs.forEach((s) => (s.s = s.s.replace(/\s+/g, " ").trim()));
      // Where the line sits on the page, as fractions of the page size, for "View in PDF". pdf.js counts y from the bottom.
      const h = Math.max(...r.items.map((it) => it.h));
      const g = [segs[0].x / vp1.width, (vp1.height - r.y - h) / vp1.height, segs[segs.length - 1].x2 / vp1.width, (vp1.height - r.y + h * 0.3) / vp1.height].map((n) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000);
      lines.push({ page: p, text: segs.map((s) => s.s).join("    "), segs, g });
    }
  }
  return { pdf, lines: lines.slice(0, MAX_LINES), pages: pdf.numPages, readPages: pages, textChars: lines.reduce((a, l) => a + (l.marker ? 0 : l.text.length), 0) };
}

// ---- OCR for scans and photos
let tess = null;
function loadTesseract() {
  if (!tess) tess = (async () => {
    if (!window.Tesseract) await loadScript(TESSERACT);
    if (!window.Tesseract) throw new Error("tesseract.js loaded but did not start");
    const worker = await window.Tesseract.createWorker("eng", 1);
    // Find the layout automatically and keep the gaps between columns.
    await worker.setParameters({ tessedit_pageseg_mode: "3", preserve_interword_spaces: "1" });
    return worker;
  })().catch((e) => { tess = null; throw new ReadError("load", "The scan reader could not load. Check the internet connection and try again, or type the values in.", e?.message || String(e)); });
  return tess;
}
// One OCR'd image -> lines in the same shape as a PDF's text layer (segments split where the gap is wide).
async function ocrCanvas(canvas, page, multi, psm = "3") {
  const worker = await loadTesseract();
  // "3" finds the page layout; "11" reads every word on its own, which catches small table cells the
  // layout mode skips. The rows are rebuilt from where each word sits either way.
  if (psm !== "3") await worker.setParameters({ tessedit_pageseg_mode: psm });
  let data;
  try { ({ data } = await worker.recognize(canvas)); } finally { if (psm !== "3") await worker.setParameters({ tessedit_pageseg_mode: "3" }); }
  const out = multi ? [{ page, text: `[Page ${page}]`, segs: [], marker: true }] : [];
  // OCR reports each table column as its own block, so a label and its value come back far apart. Rebuild
  // the rows from where the words sit on the page, which gives the same shape as a digital PDF. Only the
  // faintest words are dropped: a real label read with low confidence still matters.
  const all = (data.lines || []).flatMap((ln) => ln.words || []).filter((w) => w.text && w.text.trim() && (w.confidence > 25 || (w.confidence > 5 && /[A-Za-z0-9]{2}/.test(w.text))));
  const rows = [];
  for (const w of [...all].sort((a, b) => a.bbox.y0 + a.bbox.y1 - b.bbox.y0 - b.bbox.y1)) {
    const cy = (w.bbox.y0 + w.bbox.y1) / 2, wh = w.bbox.y1 - w.bbox.y0;
    const row = rows.find((r) => Math.abs(r.cy - cy) <= Math.max(6, Math.min(r.h, wh) * 0.55));
    if (row) { row.words.push(w); row.cy = (row.cy * (row.words.length - 1) + cy) / row.words.length; row.h = Math.max(row.h, wh); }
    else rows.push({ cy, h: wh, words: [w] });
  }
  rows.sort((a, b) => a.cy - b.cy);
  for (const ln of rows) {
    const words = ln.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const h = Math.max(8, ln.h);
    const segs = [];
    for (const w of words) {
      const last = segs[segs.length - 1];
      if (last && w.bbox.x0 - last.x2 < h * 1.6) { last.s += " " + w.text; last.x2 = w.bbox.x1; }
      else segs.push({ x: w.bbox.x0, x2: w.bbox.x1, s: w.text });
    }
    // Table borders read as "|" and a scanned ":" often comes out as "©", "¢" or "+". Tidy both.
    const clean = [];
    for (const sg of segs) {
      let t = sg.s.replace(/\s+/g, " ").replace(/^[|\[\]{}_\s]+|[|\[\]{}_\s]+$/g, "").replace(/\s\|\s/g, "    ").trim();
      const colon = /^[©¢+~:;]+(\s|$)/.test(t);
      if (colon) t = t.replace(/^[©¢+~:;]+\s*/, "");
      if (colon && clean.length && !/:$/.test(clean[clean.length - 1].s)) clean[clean.length - 1].s += " :";
      if (!t || /^[^A-Za-z0-9₹]{1,3}$/.test(t)) continue;
      clean.push({ ...sg, s: t });
    }
    const W = canvas.width || 1, H = canvas.height || 1, r3 = (n) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
    if (clean.length) out.push({ page, text: clean.map((x) => x.s).join("    "), segs: clean, g: [r3(clean[0].x / W), r3((ln.cy - h / 2) / H), r3(clean[clean.length - 1].x2 / W), r3((ln.cy + h / 2) / H)] });
  }
  return out;
}
const canvasOf = (w, h) => { const c = document.createElement("canvas"); c.width = Math.round(w); c.height = Math.round(h); return c; };
async function ocrPdf(pdf, onProgress) {
  const n = Math.min(pdf.numPages, OCR_PAGES);
  const lines = [];
  for (let p = 1; p <= n; p++) {
    onProgress(p, n, true);
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 3 });
    const c = canvasOf(vp.width, vp.height);
    await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    lines.push(...await ocrCanvas(c, p, n > 1));
  }
  return { lines, readPages: n };
}
// A scan whose premium table was not found: read the pages that talk about premium again, word by word, and
// add those lines after the rest (marked "[Page N, read again]"), so the line numbers already read stay the same.
async function ocrPremiumPages(pdf, lines, onProgress) {
  const pages = [...new Set(lines.filter((l) => !l.marker && /\bpremium\b/i.test(l.text)).map((l) => l.page))].slice(0, 3);
  const out = [];
  for (const p of pages) {
    onProgress(p, pdf.numPages, true);
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 3 });
    const c = canvasOf(vp.width, vp.height);
    await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    const got = await ocrCanvas(c, p, false, "11");
    out.push({ page: p, text: `[Page ${p}, read again]`, segs: [], marker: true }, ...got);
  }
  return out;
}
async function ocrImage(file, onProgress) {
  onProgress(1, 1, true);
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { throw new ReadError("broken", "This photo could not be opened. It may be damaged, or in a format the browser cannot show.", e?.message || String(e)); }
  // Small photos are enlarged and huge ones shrunk: OCR reads best at about 2000 to 3000 pixels wide.
  const k = Math.min(3, Math.max(0.5, 2400 / bmp.width));
  const c = canvasOf(bmp.width * k, bmp.height * k);
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  return { lines: await ocrCanvas(c, 1, false), readPages: 1 };
}

// ---- value parsers
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12, january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const DATE_RE = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)?[\s\/\-.]+(\d{1,2}|[A-Za-z]{3,9})[\s\/\-.,]+(\d{4}|\d{2})\b|\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g;
const pad = (n) => String(n).padStart(2, "0");
function mkDate(y, m, d) {
  y = +y; if (y < 100) y += 2000;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCDate() !== +d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}
export function findDates(s) {
  const out = [];
  const re = new RegExp(DATE_RE.source, "g");
  for (let m = re.exec(s); m; m = re.exec(s)) {
    let iso = null, ambiguous = false;
    if (m[1]) iso = mkDate(m[1], +m[2], +m[3]);
    else if (m[4]) {
      const mm = /^\d+$/.test(m[5]) ? +m[5] : MON[m[5].toLowerCase()];
      if (mm) { iso = mkDate(m[6], mm, +m[4]); ambiguous = /^\d+$/.test(m[5]) && +m[4] <= 12 && +m[5] <= 12 && +m[4] !== +m[5]; }
    } else if (m[7]) { const mm = MON[m[7].toLowerCase()]; if (mm) iso = mkDate(m[9], mm, +m[8]); }
    if (iso) out.push({ iso, ambiguous, index: m.index, end: m.index + m[0].length });
    else re.lastIndex = m.index + 1;
  }
  return out;
}
const AMT_RE = /(?:(₹|`|rs\.?|inr|usd|us\$|\$|aed|eur|€)\s*)?(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(\s*(?:lakhs?|lacs?|crores?|cr|millions?|mn|billions?|bn|thousand)\b\.?)?(\s*%|\s*\/-)?/gi;
const UNIT = { lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7, cr: 1e7, million: 1e6, millions: 1e6, mn: 1e6, billion: 1e9, billions: 1e9, bn: 1e9, thousand: 1e3 };
// "Rupees Forty Lakh Only", "Eight Thousand Seventeen", "USD Five Million". Indian and international scales.
const SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const WORD_RE = new RegExp(String.raw`\b(rupees|rs\.?|inr|usd|us\s*dollars?|dollars?)?\s*((?:(?:` + Object.keys(SMALL).join("|") + "|hundred|thousand|lakhs?|lacs?|crores?|million|billion|and" + String.raw`)\b[\s-]*)+)(rupees|dollars?)?\s*(only)?`, "gi");
const NUM_WORDS = new RegExp(String.raw`(?:\b(?:` + Object.keys(SMALL).join("|") + String.raw`|hundred|thousand|lakhs?|lacs?|crores?|million|billion)\b[\s-]*)(?:\b(?:` + Object.keys(SMALL).join("|") + String.raw`|hundred|thousand|lakhs?|lacs?|crores?|million|billion|and)\b[\s-]*)*(?:only\b)?`, "i");
export function wordsToAmount(s) {
  for (const m of s.matchAll(WORD_RE)) {
    const words = m[2].toLowerCase().split(/[\s-]+/).filter((w) => w && w !== "and");
    const curWord = m[1] || m[3]; // "Rupees Forty Lakh" or "Forty Lakh Rupees"
    if (!words.length || !(curWord || m[4])) continue; // only with a currency word or "only", never a stray "one"
    // "Rupees Twenty-Nine" at the end of a line, with no "Only", is usually cut off: the rest is on the next line.
    if (!m[4] && !/^(hundred|thousand|lakhs?|lacs?|crores?|million|billion)$/.test(words[words.length - 1]) && /^[\s|]*$/.test(s.slice(m.index + m[0].length))) continue;
    let total = 0, cur = 0;
    for (const w of words) {
      if (w in SMALL) cur += SMALL[w];
      else if (w === "hundred") cur = (cur || 1) * 100;
      else { total += (cur || 1) * UNIT[w]; cur = 0; }
    }
    const v = total + cur;
    if (v > 0) return { v, cur: curWord && /usd|dollar/i.test(curWord) ? "USD" : "INR", words: true };
  }
  return null;
}
export function findAmounts(s) {
  const dates = findDates(s);
  const out = [];
  for (const m of s.matchAll(AMT_RE)) {
    if (m[4] && m[4].includes("%")) continue;
    if (dates.some((d) => m.index >= d.index && m.index < d.end)) continue;
    const prev = s.slice(Math.max(0, m.index - 1), m.index);
    if (/[A-Za-z\/]/.test(prev)) continue; // part of a code like NGI/26/0991
    if (/\bno\.?\s*$/i.test(s.slice(Math.max(0, m.index - 4), m.index))) continue; // a reference number, "No. 67"
    const next = s.slice(m.index + m[0].length, m.index + m[0].length + 1);
    // A list marker "1)" or a code "67-B" is not money; a bracketed amount "( `11126.5)" is.
    const bracketed = next === ")" && /\(\s*$/.test(s.slice(0, m.index));
    if (!m[4] && !m[3] && !bracketed && /^[)\-\/A-Za-z]/.test(next)) continue;
    const unit = m[3] ? UNIT[m[3].trim().toLowerCase().replace(/\.$/, "")] : 1;
    const v = Math.round(+m[2].replace(/,/g, "") * unit * 100) / 100;
    if (!Number.isFinite(v)) continue;
    if (!m[1] && /^(19|20)\d{2}$/.test(m[2])) continue; // a bare year
    if (!m[1] && !m[3] && !m[4] && !/[,.]/.test(m[2]) && v > 0 && v < 100) continue; // too small to be money without a currency mark
    out.push({ v, cur: m[1] ? curOf(m[1]) : null });
  }
  if (!out.length) { const w = wordsToAmount(s); if (w) out.push(w); }
  return out;
}
function curOf(t) { t = t.toLowerCase(); return /usd|us\$|^\$$/.test(t) ? "USD" : t === "aed" ? "AED" : /eur|€/.test(t) ? "EUR" : "INR"; }
const findPct = (s) => { const m = s.match(/(\d{1,2}(?:\.\d{1,3})?)\s*%/); return m ? +m[1] : null; };
// Some insurers print the number in spaced groups, "2302 2089 9690 2000 000" (HDFC ERGO motor). A cell that is
// only digit groups like that, with 10 or more digits in all, is one number: the spaces are dropped.
const SPACED_ID = /^\s*\d{2,6}(?: \d{2,6}){2,}\s*$/;
// The first ID-like token that has a digit: "UIN NUMBER - IRDAN190P0087100001" is the IRDAN code, not "NUMBER".
const findId = (s) => {
  if (SPACED_ID.test(s) && s.replace(/\D/g, "").length >= 10) return s.replace(/\D/g, "");
  const m = [...s.matchAll(/[A-Z0-9][A-Z0-9\/\-.]{4,}[A-Z0-9]/gi)].find((x) => /\d/.test(x[0]));
  return m ? m[0].replace(/^(\d{8,})[A-Za-z]{3,}$/, "$1") : null;
};
const cleanText = (s) => s.replace(/`\s*(?=\d)/g, "₹ ").replace(/^[\s:\-–.]+/, "").replace(/\s{2,}/g, " ").trim().slice(0, 140);

// ---- field rules (order matters: specific labels before generic ones)
const RULES = [
  { key: "policyNo", kind: "id", label: phraseRe(VOCAB.policyNo), not: /previous|prev\b|old\b|expiring|\bbase\s+polic|\bunderlying\s+polic|proposal|endorsement|receipt|invoice|order|claim|transaction|\butr\b|agent|broker|posp|intermediary|quote|quotation/i },
  { key: "uin", kind: "id", label: phraseRe(VOCAB.uin) },
  { key: "planName", kind: "text", label: phraseRe(VOCAB.planName), badValue: /^(both\s+)?(indemnity|benefit)(\s+and\s+(indemnity|benefit))?\b|^(fresh|new|renewal|individual|group|floater)$|^(product|policy|type|details|name)\b\s*\/?/i },
  { key: "proposalDate", kind: "date", label: phraseRe(VOCAB.proposalDate) },
  { key: "issueDate", kind: "date", label: phraseRe(VOCAB.issueDate) },
  { key: "riskStart", kind: "date", label: phraseRe(VOCAB.riskStart), not: /endorsement/i },
  { key: "riskEnd", kind: "date", label: phraseRe(VOCAB.riskEnd), not: /endorsement|renewals*notice/i },
  // Not the policy's sum insured: health bonuses, buffers, deductibles and daily amounts; marine per-sending,
  // per-bottom and per-location limits; a liability any-one-accident limit (unless it is also the aggregate);
  // fire deductible bands ("Sum Insured upto 10 Cr per location"); add-on and PA sums insured.
  { key: "sumInsured", kind: "amount", label: phraseRe(VOCAB.sumInsured), not: /used|balance|basis|sub[\s-]*limit|maximum(?!\s+(annual\s+liability|limit\s+of\s+liability))|%\s*of|per\s*(person|employee|member|vessel|sending|bottom|location|transit|conveyance|day|claim|occurrence)|in\s*words|cumulative\s*bonus|no\s*claim\s*bonus|\bbonus\b|corporate\s*buffer|\bbuffer\b|deductible|threshold|restor|recharge|reload|booster|room\s*rent|daily\s*(cash|allowance)|hospital\s*cash|\bup\s*to\b|\bupto\b|owner[\s-]*driver|unnamed|paid\s*driver|hospitali[sz]ation|battery|charger|any\s*one\s*(accident|claim|occurrence)(?![^.]*(aggregate|combined\s+single\s+limit))|\baoa\b/i },
  { key: "_pre", kind: "amount", label: new RegExp(phraseRe(VOCAB.netPremium).source + "|" + /total\s*premium\s*(before|excl)/i.source, "i") },
  { key: "_post", kind: "amount", label: new RegExp(phraseRe(VOCAB.grossPremium).source + "|" + /\btotal\s*\(\s*(`|₹|rs\.?|inr)\s*\)/i.source, "i"), not: /before|excl|excluding|\bnet\b|without|in\s*words/i },
  // A bare "Premium" label is the premium before tax. Only as a label in its own cell or before a colon.
  { key: "_pre", kind: "amount", label: /\bpremium\b/i, strict: true, not: /total|gross|\bnet\b|rate|payable|deposit|minimum|paid|refund|additional|due|cheque|tax|gst|words|details|head|share|basis|amount|annual|holiday/i },
  // Not "GST INVOICE NO ..." or "Total Premium In Words: ... Two Lakhs" on the same line (WELCAR read GST as 2,00,000).
  { key: "gst", kind: "amount", label: phraseRe(VOCAB.gst), not: /gstin|regist|\bno\.?\b|number|cgst|sgst|utgst|before|excl|invoice|in\s*words/i },
  { key: "stampDuty", kind: "amount", label: phraseRe(VOCAB.stampDuty), zeroOk: true },
  // Never the tax rate column of a GST invoice ("HSN/SAC ... CGST Rate ... SGST Rate").
  { key: "premiumRate", kind: "pct", label: phraseRe(VOCAB.premiumRate), not: /gst|tax|exchange|interest/i, lineNot: /\b(cgst|sgst|igst|utgst|hsn|sac)\b|gst\s*amt|tax\s*amt/i },
  // GST on the broker's commission, when a policy or debit note prints it ("GST on Brokerage @ 18%").
  { key: "brokerageGstPct", kind: "pct", label: /(\b(gst|igst|tax)\s*(on|for)?\s*(the\s*)?(brokerage|commission)|\b(brokerage|commission)\s*(gst|igst)\b)(\s*(@|at\b|rate))?/i },
  { key: "excess", kind: "text", label: phraseRe(VOCAB.excess), needDigit: true, not: /voluntary|discount/i, badValue: /^\d+(\.\d+)+\s+[A-Za-z]|^(clause|section|item)\b/i },
  { key: "location", kind: "text", label: phraseRe(VOCAB.location), badValue: /^(address|e-?\s*mail|phone|name|details?|jurisdiction|city|state|country)\b\s*$|@|\bwww\.|\.(com|co\.in|in|org)\b/i },
  // Jurisdiction and its like are a kind of location, but the words also appear in legal clauses, so only as a label.
  { key: "location", kind: "text", label: phraseRe(VOCAB.jurisdiction), strict: true, not: /court|subject\s+to|law|dispute|arbitration|exclusive/i, badValue: /court|subject\s+to|\blaws?\b|arbitration|^(address|e-?\s*mail|phone|name)\b|@|\bwww\.|\.(com|co\.in|in|org)\b/i },
];
const LABELS = { brokerageGstPct: "GST on brokerage (%)", policyNo: "Policy number", uin: "UIN", planName: "Plan name", proposalDate: "Proposal date", issueDate: "Policy issue date", riskStart: "Risk start date", riskEnd: "Risk end date", sumInsured: "Sum insured", netPremium: "Net premium", grossPremium: "Gross premium", gst: "GST amount", stampDuty: "Stamp duty", premiumRate: "Premium rate", excess: "Policy excess", location: "Insured location",
  aoaLimit: "Limit any one accident (AOA)", aoyLimit: "Limit any one year (AOY)", retroDate: "Retroactive date", continuityDate: "Continuity date", deductible: "Deductible", claimsMade: "Claims made basis",
  voyageFrom: "Voyage from", voyageTo: "Voyage to", commodity: "Goods insured", valuationBasis: "Basis of valuation", lossPayee: "Loss payee", contractValue: "Contract value", principal: "Principal" };

function parseKind(kind, s, zeroOk, needDigit) {
  if (kind === "date") { const d = findDates(s); return d.length ? { v: d[0].iso, ambiguous: d[0].ambiguous } : null; }
  if (kind === "amount") { const a = findAmounts(s).filter((x) => x.v > 0 || (zeroOk && x.v === 0)); return a.length ? { v: a[0].v, cur: a[0].cur } : null; }
  if (kind === "pct") { const p = findPct(s); return p != null ? { v: p } : null; }
  if (kind === "id") { const v = findId(s); return v ? { v } : null; }
  if (kind === "text") { const v = cleanText(s); return v && /[A-Za-z0-9]{2}/.test(v) && (!needDigit || /\d/.test(v)) ? { v } : null; }
  return null;
}

// A cell under a header must be the value and nothing else, or it is not used.
const WHOLE = {
  amount: /^\s*(₹|rs\.?|inr|usd|us\$|\$|aed|eur|€)?\s*\d[\d,]*(\.\d{1,2})?\s*(\/-)?\s*$/i,
  pct: /^\s*\d{1,2}(\.\d+)?\s*%?\s*$/,
  id: /^\s*[A-Z0-9][A-Z0-9\/\-.]{4,}[A-Z0-9]\s*$/i,
};
const isPunct = (s) => /^[\s:;\-–=|.]*$/.test(s) || /^\s*:?\s*(rs\.?|inr|`|₹)\s*:?\s*$/i.test(s);

const POLICY_DATES = new Set(["proposalDate", "issueDate", "riskStart", "riskEnd"]);
const oldest = new Date().getFullYear() - 15;
function acceptable(rule, v) {
  if (rule.badValue && rule.badValue.test(String(v.v))) return false;
  if (POLICY_DATES.has(rule.key) && +String(v.v).slice(0, 4) < oldest) return false;
  return true;
}

function candidates(lines, rule) {
  const out = [];
  lines.forEach((ln, i) => {
    if (ln.marker) return;
    ln.segs.forEach((seg, j) => {
      const m = seg.s.match(rule.label);
      if (!m || (rule.not && rule.not.test(seg.s))) return;
      if (rule.lineNot && [ln.text, lines[i - 1]?.text, lines[i - 2]?.text].some((t) => t && rule.lineNot.test(t))) return;
      // A scan can split "Previous | Policy No" into two cells: the word in the cell before counts too.
      const prevCell = j > 0 ? ln.segs[j - 1].s : "";
      if (rule.not && prevCell && prevCell.length <= 20 && seg.s.slice(0, m.index).trim() === "" && rule.not.test(prevCell)) return;
      const before = seg.s.slice(0, m.index).replace(/[^\x00-\x7F]+\/?\s*/g, "");
      const after = seg.s.slice(m.index + m[0].length);
      // Only labels that are set out as labels: at the start of a block (after an optional "1." or "a)"),
      // or directly followed by a colon. A label word inside a sentence of policy wording is ignored.
      // Up to two short words may come before a label ("Policy Issue Date", "Own Damage Cover To").
      const atStart = /^\s*((\d{1,2}|[a-z]|[ivx]{1,4})[.)]\s*)?([A-Za-z&]{1,12}\s+){0,2}$/i.test(before) || /[:|]\s*$/.test(before);
      const colonAfter = /^\s*(\([^)]{0,30}\))?\s*(no\.?|number)?\s*[:=–-]/i.test(after);
      // A header cell may carry a bracket or a rate after the label, e.g. "Sum Insured (Rs.)" or "IGST 18%".
      const ownCell = isPunct(after) || /^\s*\/\s*[A-Za-z ]{0,25}:?\s*$/.test(after) || /^\s*\([^)]{0,30}\)\s*$/.test(after) || (rule.kind !== "pct" && /^\s*@?\s*\(?\d{1,2}(\.\d+)?\s*%\)?\s*$/.test(after)); // for a % field the rate is the value
      if (!atStart && !colonAfter) return;
      const idInline = rule.kind === "id" && /^\s+[A-Z0-9][A-Z0-9\/\-.]{3,}[A-Z0-9]\s*$/i.test(after) && /\d/.test(after);
      if ((rule.kind === "text" || rule.kind === "id" || rule.strict) && !colonAfter && !ownCell && !idInline) return;
      const tail = !ownCell && !colonAfter && rule.kind !== "text" && rule.kind !== "id" && /^[^\d:]{1,60}$/.test(after) && /[a-z]/i.test(after) && j < ln.segs.length - 1;
      // 1) after the label on the same line: rest of this cell, then the next cells
      const rest = [...(ownCell ? [] : [after]), ...ln.segs.slice(j + 1).map((x) => x.s)];
      for (const part of rest) {
        if (isPunct(part)) continue;
        const v = parseKind(rule.kind, part, rule.zeroOk, rule.needDigit);
        if (v && acceptable(rule, v)) { out.push({ ...v, ref: i + 1, conf: "high", label: m[0] }); return; }
        if (rule.kind === "text" || rule.kind === "id") break;
        if (!ownCell && !tail) break; // "Label: words" with no value: stop rather than wander along the line
      }
      // 2) table layout: the label is a header cell and the value sits right under it
      const next = lines[i + 1];
      if (ownCell && next && !next.marker) {
        const alone = rule.kind === "text" && ln.segs.length === 1;
        let under = next.segs.find((x) => x.x < seg.x2 + 4 && x.x2 > seg.x - 4) || (alone ? next.segs.find((x) => x.x >= seg.x - 4) : null);
        if (!under) return;
        // "i)    INR 5000 for each loss.": a list marker in its own cell, the value in the next one.
        if (rule.kind === "text" && /^\(?([ivx]{1,4}|\d{1,2}|[a-z])[.)]$/i.test(under.s.trim())) under = next.segs[next.segs.indexOf(under) + 1] || under;
        const whole = rule.kind === "date" ? (() => { const d = findDates(under.s); return d.length && d[0].end - d[0].index >= under.s.trim().length * 0.6; })()
          : rule.kind === "text" ? under.s.length < 120 : WHOLE[rule.kind].test(under.s);
        const v = whole && parseKind(rule.kind, under.s, rule.zeroOk, rule.needDigit);
        if (v && acceptable(rule, v)) out.push({ ...v, ref: i + 2, conf: "high", note: "Read from the cell below the label", label: m[0] });
      }
    });
  });
  return out;
}

function pick(cands, key, ocr) {
  if (!cands.length) return null;
  // On a scan, a garbled word can look like "SI" next to a small number. The sum insured is the largest figure.
  const first = ocr && key === "sumInsured" ? cands.reduce((a, c) => (+c.v > +a.v ? c : a)) : cands[0];
  const distinct = [...new Set(cands.map((c) => String(c.v)))];
  const res = { v: first.v, ref: first.ref, conf: first.conf, note: first.note };
  if (distinct.length > 1) {
    res.conf = "low";
    const other = cands.find((c) => String(c.v) !== String(first.v));
    res.note = `The policy shows different values (lines ${first.ref} and ${other.ref}). ${first === cands[0] ? "The first one was used." : "The largest one was used."} Choose the right one below if needed.`;
    res.alts = distinct.filter((v) => v !== String(first.v)).slice(0, 3).map((v) => { const c = cands.find((x) => String(x.v) === v); return { v: c.v, ref: c.ref }; });
  }
  if (first.ambiguous) { res.note = (res.note ? res.note + " " : "") + "Read as day/month/year."; }
  return res;
}
// The fields that get a pick list of everything found. Others keep the single best reading.
// Every labelled field, except the premium figures: which of those is gross and which net is decided by the
// arithmetic (gross + GST = net), so a list of labelled premium values would mislead.
const NO_CANDS = new Set(["_pre", "_post", "gst", "stampDuty", "grossPremium", "netPremium"]);
const CAND_KEYS = [...new Set(["sumInsured", "policyNo", ...RULES.map((r) => r.key)])].filter((k) => !NO_CANDS.has(k));
const CORE_CANDS = new Set(["sumInsured", "policyNo"]);
// Distinct values, the one in use first, each with its label, line and how many times it was printed.
function candList(cands, first) {
  const by = new Map();
  for (const c of first ? [first, ...cands] : cands) {
    const k = String(c.v);
    const e = by.get(k);
    if (e) { if (c.ref !== e.ref) e.count++; if (!c.prior) e.prior = false; if (!e.label && c.label) e.label = c.label; continue; }
    by.set(k, { v: c.v, ref: c.ref, label: c.label || "", count: 1, prior: !!c.prior, ...(c.note ? { note: c.note } : {}) });
  }
  return [...by.values()].slice(0, 5);
}

export function parseFields(lines, ocr = false) {
  const fields = {};
  const found = {};
  for (const r of RULES) found[r.key] = (found[r.key] || []).concat(candidates(lines, r));
  // Small stamp duties are real: Indian policies often carry Rs. 0.25 or Rs. 0.50 ("Stamp Duty of Rs.0.25/- is paid"). Keep them.
  for (const k of Object.keys(found)) { if (k[0] === "_" || k === "gst") continue; const p = pick(found[k], k, ocr); if (p) fields[k] = p; }
  // Gross premium + GST = net premium. Which is which comes from the figures, not the printed words.
  const prem = premiumFigures(lines, found._pre, found._post, found.gst, found.stampDuty);
  if (prem.gross) fields.grossPremium = prem.gross;
  if (prem.gst) fields.gst = prem.gst;
  if (prem.net) fields.netPremium = prem.net;
  if (prem.stamp && !fields.stampDuty) fields.stampDuty = prem.stamp;
  // "Place: MUMBAI" then "Date: 19/05/2025" at the foot of a schedule is the date it was issued.
  if (!fields.issueDate) {
    const i = lines.findIndex((l, k) => !l.marker && /^date\s*[:\-]/i.test(l.text.trim()) && [lines[k - 1], lines[k - 2]].some((x) => x && /^place\s*[:\-]/i.test(x.text.trim())));
    const d = i >= 0 ? findDates(lines[i].text)[0] : null;
    if (d) fields.issueDate = { v: d.iso, ref: i + 1, conf: "low", note: "The policy calls this just \"Date\", under the place of issue. Check it." };
  }
  // The risk address set out in a table column, when no labelled location was read or it only says "As per ...".
  if (!fields.location || /^as\s+per\b/i.test(String(fields.location.v))) {
    const t = riskAddressTable(lines);
    if (t) fields.location = { ...t, word: "Location" };
  }
  // Show the word the policy itself uses for the location field.
  // A text value cut where the line wraps ("... subject to a minimum of USD" / "5,000 and a maximum of USD 40,000
  // each claim"): the next line carries on the sentence, so it is joined, up to two lines.
  for (const k of ["excess", "location"]) {
    const f = fields[k];
    if (!f || typeof f.v !== "string") continue;
    for (let j = f.ref; j < f.ref + 2; j++) {
      const nx = lines[j];
      if (!nx || nx.marker || (nx.segs && nx.segs.length > 1) || /[.;)]\s*$/.test(f.v) || !/^[a-z0-9(]/.test(nx.text.trim()) || nx.text.length > 140) break;
      f.v = cleanText(f.v + " " + nx.text);
    }
  }
  if (fields.location && !fields.location.word) { const w = lines[fields.location.ref - 1]?.text.match(new RegExp(phraseRe(VOCAB.jurisdiction).source + "|" + phraseRe(VOCAB.location).source, "i")); if (w) fields.location.word = w[0].trim(); }
  // A schedule with one row of limits (MTO and similar).
  const sch = liabilitySchedule(lines);
  if (sch) {
    fields.location = { v: sch.jurisdiction, ref: sch.ref, conf: "high", word: "Jurisdiction" };
    if (!fields.sumInsured || fields.sumInsured.conf === "low") fields.sumInsured = { v: sch.aoy, ref: sch.ref, conf: "high", note: "AOY (any one year), the most the policy pays in a year." };
    if (!fields.excess) fields.excess = { v: String(sch.deductible), ref: sch.ref, conf: "high" };
  }

  // Period lines with two dates, e.g. "Period of insurance: 01/12/2026 to 30/11/2027"
  lines.forEach((ln, i) => {
    if (ln.marker || !/period|from\b.*\bto\b|\bfrom\b/i.test(ln.text)) return;
    // "04 March to 14 March 2028": the year is printed once, for both dates (a year earlier if the start month is later).
    const text = ln.text.replace(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(to|till|until)\s+(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})\b/i, (m, d1, m1, sep, d2, m2, y) => {
      const a = MON[m1.toLowerCase()], b = MON[m2.toLowerCase()];
      return a && b ? `${d1} ${m1} ${a > b ? +y - 1 : y} ${sep} ${d2} ${m2} ${y}` : m;
    });
    let ds = findDates(text).filter((d) => +d.iso.slice(0, 4) >= oldest);
    // "From: 14/08/2026 ... To:" with the end date wrapped onto the next line.
    if (ds.length === 1 && /\bfrom\b/i.test(ln.text) && /\bto\b/i.test(ln.text.slice(ds[0].end)) && lines[i + 1]) {
      const nx = findDates(lines[i + 1].text).filter((d) => d.index < 3 && +d.iso.slice(0, 4) >= oldest);
      if (nx.length) ds = [ds[0], nx[0]];
    }
    if (ds.length === 1 && /\bfrom\b/i.test(ln.text) && !fields.riskStart) { fields.riskStart = { v: ds[0].iso, ref: i + 1, conf: "low", note: "Only a start date is given on this line. Check the end date." }; return; }
    if (ds.length < 2 || !/period|from|to|till/i.test(ln.text)) return;
    const [a, b] = [ds[0].iso, ds[1].iso];
    if (b <= a) return;
    for (const [k, v] of [["riskStart", a], ["riskEnd", b]]) {
      if (!fields[k]) fields[k] = { v, ref: i + 1, conf: "high", note: ds[0].ambiguous || ds[1].ambiguous ? "Read as day/month/year." : undefined };
      else if (fields[k].v !== v && !fields[k].noteSet) { fields[k] = { ...fields[k], conf: "low", note: `Line ${i + 1} gives the period as a different date. Check which is right.`, noteSet: true }; }
    }
  });

  // On a scan the slashes of a date are often lost: "Period To    28032027" is 28/03/2027.
  if (ocr) {
    for (const [k, re] of [["riskStart", /^\s*period\s*from\s*:?\s+(\d{2})(\d{2})(20\d{2})\s*$/i], ["riskEnd", /^\s*period\s*to\s*:?\s+(\d{2})(\d{2})(20\d{2})\s*$/i]]) {
      if (fields[k]) continue;
      const i = lines.findIndex((l) => !l.marker && re.test(l.text));
      if (i < 0) continue;
      const m = lines[i].text.match(re);
      const d = findDates(`${m[1]}/${m[2]}/${m[3]}`)[0];
      if (d && (k === "riskStart" ? !fields.riskEnd || d.iso < fields.riskEnd.v : !fields.riskStart || d.iso > fields.riskStart.v)) fields[k] = { v: d.iso, ref: i + 1, conf: "low", note: "The scan lost the separators in this date, so it was read as day, month, year. Check it." };
    }
  }
  // A certificate's header: "Page | 1 of 6 dated 18 March 2025" in the first lines is the date it was issued.
  if (!fields.issueDate) {
    const head = lines.filter((l) => !l.marker).slice(0, 10);
    const hit = head.find((l) => /\bdated\s+\d/i.test(l.text) && !/\b(clause|cl\.?|endorsement|jc\d|wording)\b/i.test(l.text));
    const d = hit ? findDates(hit.text.slice(hit.text.search(/\bdated\b/i)))[0] : null;
    if (d) fields.issueDate = { v: d.iso, ref: lines.indexOf(hit) + 1, conf: "low", note: "Read from \"dated\" at the top of the certificate. Check it is the issue date." };
  }
  // No issue date printed: the tax invoice date, else the date the schedule was printed, if it falls in the policy's time.
  if (!fields.issueDate) {
    for (const [re, what] of [[/\b(?:tax\s*)?invoice\s*date\b/i, "the invoice date"], [/\b(?:policy\s*)?printed\s*on\b/i, "the date the policy was printed"]]) {
      const i = lines.findIndex((l) => !l.marker && re.test(l.text) && findDates(l.text.slice(l.text.search(re))).length);
      if (i < 0) continue;
      const d = findDates(lines[i].text.slice(lines[i].text.search(re)))[0];
      const lo = fields.riskStart ? new Date(Date.parse(fields.riskStart.v) - 120 * 864e5).toISOString().slice(0, 10) : null;
      if ((lo && d.iso < lo) || (fields.riskEnd && d.iso > fields.riskEnd.v)) continue;
      fields.issueDate = { v: d.iso, ref: i + 1, conf: "low", note: `No issue date is printed. This is ${what}. Check it.` };
      break;
    }
  }

  // GST split into CGST + SGST/UTGST when no single GST line exists
  if (!fields.gst) {
    const c = candidates(lines, { kind: "amount", label: /\bcgst\b/i }), s = candidates(lines, { kind: "amount", label: /\b(sgst|utgst)\b/i });
    if (c.length && s.length) fields.gst = { v: Math.round((c[0].v + s[0].v) * 100) / 100, ref: c[0].ref, conf: "low", note: `CGST (line ${c[0].ref}) and SGST (line ${s[0].ref}) added together` };
  }
  // GST %: only a % written right next to the tax name counts, e.g. "GST @ 18%", "IGST 18%", "CGST (9%)".
  const taxPct = (t, name) => { const m = t.match(new RegExp("\\b(" + name + ")\\b[^%\\d]{0,12}(\\d{1,2}(?:\\.\\d+)?)\\s*%", "i")); return m ? +m[2] : null; };
  const gstLine = lines.find((l) => !l.marker && !/gstin/i.test(l.text) && !/brokerage|commission/i.test(l.text) && (taxPct(l.text, "igst|gst") != null || taxPct(l.text, "cgst") != null));
  if (gstLine) {
    const isSplit = taxPct(gstLine.text, "igst|gst") == null;
    let pct = isSplit ? taxPct(gstLine.text, "cgst") : taxPct(gstLine.text, "igst|gst");
    const sg = lines.map((l) => (l.marker ? null : taxPct(l.text, "sgst|utgst"))).find((x) => x != null);
    if (isSplit && sg != null) pct += sg;
    fields.gstPct = { v: pct, ref: lines.indexOf(gstLine) + 1, conf: isSplit ? "low" : "high", note: isSplit ? "CGST % and SGST % added together" : undefined };
  }
  // GST % from the figures: GST divided by gross, when it lands on a standard rate. It also corrects a
  // half rate read from one line ("State GST (9%)" when the policy charges 9% + 9%).
  if (fields.grossPremium && fields.gst && +fields.grossPremium.v > 0) {
    const r = (100 * +fields.gst.v) / +fields.grossPremium.v;
    const std = [5, 12, 18, 28].find((x) => Math.abs(r - x) < 0.06);
    if (std != null && (!fields.gstPct || +fields.gstPct.v !== std)) {
      const was = fields.gstPct?.v;
      fields.gstPct = { v: std, ref: fields.gst.ref, conf: was != null || fields.gst.conf === "low" || fields.grossPremium.conf === "low" ? "low" : "high", note: was != null ? `Worked out from GST ÷ gross premium. The policy line shows ${was}%${+was * 2 === std ? ", which is one half of the tax (central plus state)" : ""}. Check it.` : "Worked out from GST ÷ gross premium." };
    }
  }

  // Currency: only when the document says so
  const curs = {};
  lines.forEach((l, i) => { if (l.marker) return; for (const a of findAmounts(l.text)) if (a.cur) { (curs[a.cur] ||= []).push(i + 1); } if (/\b(INR|Rupees)\b|₹|\bRs\b/i.test(l.text) && !curs.INR?.includes(i + 1)) (curs.INR ||= []).push(i + 1); });
  const curKeys = Object.keys(curs);
  if (curKeys.length) {
    curKeys.sort((a, b) => curs[b].length - curs[a].length);
    fields.currency = { v: curKeys[0], ref: curs[curKeys[0]][0], conf: curKeys.length === 1 ? "high" : "low", note: curKeys.length > 1 ? `The document mentions ${curKeys.join(" and ")}. Check the policy currency.` : undefined };
  }

  // Sanity checks that lower confidence, never change values
  const n = fields.netPremium, g = fields.grossPremium;
  if (n && g && g.v > n.v) { n.conf = g.conf = "low"; n.note = g.note = "Gross premium is larger than net premium on the document. Check both."; }
  else if (n && g && n.v === g.v) { n.conf = "low"; n.note = "Net premium is the same as gross premium. Check whether GST is included."; }
  const tax = fields.gst;
  if (tax && n && tax.v >= n.v) { tax.conf = n.conf = "low"; tax.note = n.note = "GST is not smaller than the net premium, so one of them is misread. Check both."; }
  if (fields.riskStart && fields.riskEnd && fields.riskEnd.v <= fields.riskStart.v) { fields.riskEnd.conf = "low"; fields.riskEnd.note = "End date is not after the start date. Check it."; }
  Object.values(fields).forEach((f) => { delete f.noteSet; if (!f.note) delete f.note; });

  // No labelled plan name: the product heading at the top of a schedule usually is one, for example "OIL AND ENERGY RISKS".
  if (!fields.planName) {
    const skip = /policy\s+schedule|schedule|certificate|tax\s+invoice|invoice|page\s+\d|government|undertaking|digitally|signed|signer|reason|date|attached|forming\s+part|company|limited|\bltd\b|insurance\s+co|assurance\s+co|office|address|customer|insured|policy\s*(no|number)|uin|gstin|irda/i;
    const product = /\b(risks?|insurance|policy|suraksha|cover|protect\w*|plan|liability|vessels?|package|mediclaim|accident|marine|fire|cargo|hull|indemnity|compensation|operators?|projects?|guard|secure|shield|bharat|udyam)\b/i;
    // Never the letterhead (the line repeated at the top of every page) or a banner line ("DESK | NO REAL COVER").
    const heads = {};
    lines.forEach((l, i) => { if (l.marker && lines[i + 1] && !lines[i + 1].marker) heads[lines[i + 1].text] = (heads[lines[i + 1].text] || 0) + 1; });
    const top = lines.filter((l) => !l.marker && !(heads[l.text] >= 2) && !/\s\|\s/.test(l.text)).slice(0, 14);
    const pickLine = top.find((l) => { const t = ((l.segs && l.segs[0]?.s) || l.text).trim(); const words = t.split(/\s+/); return t.length >= 6 && t.length <= 70 && words.length >= 2 && words.length <= 9 && !/\d{3,}|[:@]/.test(t) && !skip.test(t) && product.test(t) && /^[A-Z]/.test(t) && !/^(insurance|policy|cover)\b/i.test(t) && !/\b(reference|ref|number|no\.?|details|period|wording)\s*$/i.test(t) && !INSURERS.some(([, re]) => re.test(t)); });
    if (pickLine) { const i = lines.indexOf(pickLine); fields.planName = { v: ((pickLine.segs && pickLine.segs[0]?.s) || pickLine.text).trim(), ref: i + 1, conf: "low", note: "Taken from the heading at the top of the policy. Check it is the plan name." }; }
  }
  // Issue date read from the same line as the start date is often the start date again. Ask.
  if (fields.issueDate && fields.riskStart && fields.issueDate.ref === fields.riskStart.ref) { fields.issueDate.conf = "low"; fields.issueDate.note = "Read from the same line as the risk start date. Check the issue date is really this."; }
  // "Valid for 90 days from the policy inception date": the end date is worked out, and marked for checking.
  if (fields.riskStart && !fields.riskEnd) {
    const i = lines.findIndex((l) => !l.marker && /\bvalid\s+(?:for\s+)?(\d{1,3})\s*days?\s+(?:from|after)\b/i.test(l.text));
    if (i >= 0) {
      const n = +lines[i].text.match(/\bvalid\s+(?:for\s+)?(\d{1,3})\s*days?/i)[1];
      const d = new Date(fields.riskStart.v + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n - 1);
      fields.riskEnd = { v: d.toISOString().slice(0, 10), ref: i + 1, conf: "low", note: `Worked out: ${n} days counting the start day, from line ${i + 1}.${/extend|extension/i.test(lines[i].text) ? " The policy can be extended, so check for an extension." : ""}` };
    }
  }
  // Liability limits and dates, marine voyage details and engineering project details, each only when printed.
  const vessels = vesselList(lines);
  const marine = marineDetails(lines);
  if (vessels.length) delete marine.commodity; // on a hull or P&I document "interest insured" is the hull, not goods
  for (const [k, v] of Object.entries({ ...liabilityDetails(lines, sch), ...marine, ...projectDetails(lines) })) if (!fields[k]) fields[k] = v;
  // Information only, never written into fields
  const info = {};
  if (vessels.length) info.vessels = vessels;
  const inst = instalmentTable(lines);
  if (inst) info.instalments = inst;
  { const i = lines.findIndex((l) => !l.marker && /\b(till|until|up\s*to)\b[^.]{0,40}\b(voyage|transit|journey|delivery|arrival)\b[^.]{0,30}\b(complet|end|over|destination)|\b(on|till|until|up\s*to)\s+(the\s+)?(completion|end|termination|arrival)\s+of\s+(the\s+)?(voyage|transit|journey|shipment)/i.test(l.text)); if (i >= 0 && !fields.riskEnd) info.noFixedEnd = { ref: i + 1 }; }
  { const i = lines.findIndex((l) => !l.marker && /premium[^\n]{0,20}as\s+per\s+(the\s+)?(annexure|schedule\s+attached|attached\s+annexure)/i.test(l.text)); if (i >= 0) info.premiumInAnnexure = { ref: i + 1 }; }
  // "100,000 per employee": what the limit applies to.
  if (fields.sumInsured) { const t = lines[fields.sumInsured.ref - 1]?.text || ""; const basis = /per\s+(employee|person|workman|member|life)/i.test(t) ? "Per employee or person" : /any\s+one\s+accident|\bAOA\b/i.test(t) ? "Any one accident" : /any\s+one\s+year|\bAOY\b|aggregate/i.test(t) ? "Any one year" : null; if (basis) fields.siBasis = { v: basis, ref: fields.sumInsured.ref, conf: "low", note: "Read from the line with the limit. Check it." }; }
  // The total written in words ("Total Premium In Words: Indian Rupees Twenty-Nine" / "Thousand Eight Hundred
  // Forty-Eight Only"), for the cross-check against the net premium. The next line is joined when it wraps.
  for (let i = 0; i < lines.length && info.wordsTotal == null; i++) {
    const l = lines[i];
    if (l.marker || !/(total|premium|amount|invoice)[^\n]{0,40}in\s*words/i.test(l.text) || /sum\s*(insured|assured)|\bsi\b|\bidv\b|limit/i.test(l.text)) continue;
    const at = l.text.search(/in\s*words/i);
    // Only the number words of the next line: a two-column page puts other text ("NO 2724947848 UIN:0") between them.
    const nxText = lines[i + 1] && !lines[i + 1].marker ? lines[i + 1].text : "";
    const nx = (nxText.match(NUM_WORDS) || [""])[0];
    const w = wordsToAmount(l.text.slice(at) + " " + nx) || wordsToAmount(l.text.slice(at));
    if (w) info.wordsTotal = w.v;
  }
  const ins = findInsured(lines);
  if (ins) info.insured = ins.v;
  const insurer = findInsurer(lines);
  if (insurer) info.insurer = insurer;
  const office = findOffice(lines);
  if (office) info.branch = office;
  const kind = docKindOf(lines);
  if (kind) info.docKind = kind;
  // Motor: the Total IDV is the sum insured, ahead of any add-on "sum insured" or premium figure.
  const idv = motorIdv(lines);
  if (idv) { fields.sumInsured = idv; info.idv = idv.v; }
  if (!fields.sumInsured) { const lim = limitCell(lines); if (lim) fields.sumInsured = lim; }
  // Sections and classes: their rows go to Other details as printed (no totals are made up).
  const secRows = applySections(lines, fields, found);
  const cls = classBlocks(lines);
  if (secRows.length || cls.rows.length) info.otherRows = [...secRows, ...cls.rows];
  if (cls.byClass) info.classLimits = true;
  // Pick lists: every value found for these fields, the one in use first. Earlier policy numbers are listed
  // last and marked, never used.
  for (const k of CAND_KEYS) {
    const f = fields[k];
    const extra = k === "policyNo" ? candidates(lines, { key: "priorPolicyNo", kind: "id", label: phraseRe(VOCAB.priorPolicyNo) }).map((c) => ({ ...c, prior: true })) : [];
    if (!f && !CORE_CANDS.has(k)) continue;
    const list = candList([...(found[k] || []), ...extra], f ? { v: f.v, ref: f.ref, label: ((found[k] || []).find((c) => String(c.v) === String(f.v)) || {}).label || f.word || "", conf: f.conf } : null);
    // A value found by a table rule has no label of its own: use the first cell of its line ("Limit", "Total IDV").
    if (k === "sumInsured") for (const c of list) if (printedShort(lines[c.ref - 1]?.text, c.v)) c.warn = "Printed one digit short on the policy. Check the figure.";
    for (const c of list) if (!c.label) { const s0 = lines[c.ref - 1]?.segs?.[0]?.s || ""; if (s0.length <= 40 && /[A-Za-z]{3}/.test(s0) && !s0.includes(String(c.v))) c.label = s0.replace(/\s*:$/, ""); }
    // The motor IDV rule checks that the parts add up to the total.
    if (f && k === "sumInsured" && /^(Read as the )?Total IDV/.test(f.note || "") && list[0]) { list[0].label = "Total IDV"; if (f.conf === "high") list[0].sums = true; }
    // The limits table rule (MTO and similar): the AOY column is the sum insured.
    if (f && k === "sumInsured" && /^AOY \(any one year\)/.test(f.note || "") && list[0]) list[0].label = "AOY (any one year)";
    if (f) f.cands = list; else if (list.some((c) => !c.prior)) info[k + "Cands"] = list;
  }
  // Insurer: every candidate, and the letterhead or a labelled issuer when nothing else named one.
  const insCands = insurerCandidates(lines);
  if (insCands.length) info.insurerCands = insCands;
  if (!info.insurer) {
    const top = insCands.filter((c) => !c.prior && (c.how === "labelled" || c.pages >= 2)).sort((a, b) => b.pages - a.pages)[0];
    if (top) { info.insurer = top.v; info.insurerFrom = top.how; }
  }
  return { fields, info };
}

// ---- motor: the IDV is the sum insured
// The IDV block is a header row ending in "Total IDV" or "Total Value" (For the Vehicle | Trailer | accessories |
// CNG/LPG | IDV Booster | Total IDV), with the figures on the first row of plain numbers below it; a multi-year
// table has a row per policy year, and year 1 comes first. Or one line: "Total IDV (Rs.) : 5,00,000".
// Add-on sums insured (emergency medical, PA for owner-driver, battery), premiums and the third-party
// property limit are never the IDV.
const IDV_TOTAL = /\btotal\s*(idv|i\.d\.v\.?)(\s*value)?\b|\btotal\s+value\b/i;
const IDV_WORDS = /\bidv\b|i\.d\.v|insured'?s?\s+declared?\s+value|insureds\s+declared|for\s+the\s+vehicle/i;
const plainNum = (c) => { const s = String(c).replace(/[`₹,]|\brs\.?|\binr\b|\(\s*\)/gi, "").trim(); return /^\d+(\.\d+)?$/.test(s) ? +s : null; };
export function motorIdv(lines) {
  const real = lines.map((l, i) => ({ t: String((l && l.text) ?? l ?? ""), i, marker: l && l.marker })).filter((l) => !l.marker);
  for (let k = 0; k < real.length; k++) {
    const t = real[k].t;
    if (!IDV_TOTAL.test(t)) continue;
    const near = real.slice(Math.max(0, k - 3), k + 1).map((x) => x.t).join(" ");
    if (!IDV_WORDS.test(near) && !/\btotal\s*idv\b/i.test(t)) continue;
    if (/\bpremium\b|%\s*on\s*idv|\brate\b/i.test(t)) continue;
    // One line: the figure after the label.
    const after = t.slice(t.search(IDV_TOTAL)).replace(IDV_TOTAL, "");
    const inline = after.match(/^\s*(?:\(\s*(?:rs\.?|inr|`|₹)?\s*\))?\s*[:\-]?\s*(?:rs\.?|inr|`|₹)?\s*([\d,]{4,}(?:\.\d+)?)/i);
    if (inline) { const v = +inline[1].replace(/,/g, ""); if (v >= 1000) return { v, ref: real[k].i + 1, conf: "high", note: "Total IDV: the motor sum insured." }; }
    // A header row: the first row of plain numbers in the next few lines (year 1 in a multi-year table).
    for (let j = k + 1; j < Math.min(real.length, k + 6); j++) {
      const nums = real[j].t.split(/\s{2,}|\t/).map(plainNum).filter((x) => x != null);
      if (nums.length < 2) continue;
      const year = /^\s*(year|1st|first|policy\s+year)\b/i.test(real[j].t) ? " for year 1" : "";
      const ok = (v) => ({ v, ref: real[j].i + 1, conf: "high", note: `Total IDV${year}: the motor sum insured.` });
      // The total is the figure equal to the sum of the parts before it. Columns after it (owner-driver PA,
      // baggage, a stray 0) are ignored. Some insurers print the total first, equal to the parts after it.
      let run = 0;
      for (let x = 0; x < nums.length; x++) { if (x >= 1 && nums[x] >= 1000 && Math.abs(nums[x] - run) < 1 && nums.slice(0, x).some((n) => n > 0)) return ok(nums[x]); run += nums[x]; }
      for (let y = 2; y < nums.length; y++) { const parts = nums.slice(1, y + 1).reduce((a, b) => a + b, 0); if (nums[0] >= 1000 && Math.abs(nums[0] - parts) < 1) return ok(nums[0]); }
      const last = nums[nums.length - 1];
      if (last >= 1000) return { v: last, ref: real[j].i + 1, conf: "low", note: "Read as the Total IDV, the last figure of the IDV row. The parts do not add up to it, so please check." };
      break;
    }
  }
  return null;
}

// ---- "Limit" in its own cell, when nothing else gave the sum insured
// "Limit    INR 7,50,00,000", "Limit    INR 75,00,000 any one vehicle / INR 2,00,00,000 aggregate". With an
// aggregate or annual figure on the line, that is the one recorded. A figure per vehicle, member, family,
// event or day, or in a foreign currency, is marked for checking.
const LIMIT_CELL = /^(limit|limits|total\s+limit|aggregate\s+limit|annual\s+limit|limit\s+of\s+(indemnity|liability)|indemnity\s+limit|cover\s+limit)\s*:?$/i;
function limitCell(lines) {
  const real = lines.slice(0, 160);
  for (let i = 0; i < real.length; i++) {
    const l = real[i]; if (!l || l.marker) continue;
    const cells = String(l.text || "").split(/\s{3,}|\s+\|\s+/).map((x) => x.trim()).filter(Boolean);
    if (cells.length < 2 || !LIMIT_CELL.test(cells[0])) continue;
    const val = cells.slice(1).join(" ");
    const parts = val.split(/\s*[\/;]\s*/);
    const amt = (s) => { const m = s.match(/(?:rs\.?|inr|usd|eur|gbp|aed|₹)?\s*([\d,]{3,}(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr\b|million|mn\b)?/i); if (!m) return null; let v = +m[1].replace(/,/g, ""); const u = (m[2] || "").toLowerCase(); if (/^la/.test(u)) v *= 1e5; else if (/^cr/.test(u)) v *= 1e7; else if (/^m/.test(u)) v *= 1e6; return v >= 1000 ? v : null; };
    const agg = parts.find((p) => /aggregate|annual|any\s+one\s+year|per\s+(annum|year)|\baoy\b/i.test(p) && amt(p) != null);
    const pick = agg || parts.find((p) => amt(p) != null);
    if (!pick) continue;
    const v = amt(pick);
    const foreign = /\b(usd|eur|gbp|aed)\b|\$/i.test(pick);
    const per = !agg && /per\s+(vehicle|member|family|enrolled|person|employee|day|event|claim|sending|location)|any\s+one\s+(vehicle|event|claim|accident|person)|each\s+(claim|event|loss)/i.test(pick);
    const note = foreign ? `Read from "Limit". It is in ${(pick.match(/\b(usd|eur|gbp|aed)\b/i) || ["a foreign currency"])[0].toUpperCase()}, so check the currency.`
      : per ? "Read from \"Limit\". It is stated per unit, not for the whole policy, so please check." : agg && parts.length > 1 ? "Read from \"Limit\": the aggregate figure, not the per-unit one." : "Read from \"Limit\".";
    return { v, ref: i + 1, conf: foreign || per || parts.length > 2 ? "low" : "high", note };
  }
  return null;
}

// ---- limits, premiums and deductibles set out by class
// "Limits of Liability:" then "Class I: Up to USD 5,000,000 ..." and "Class II: Up to USD 500,000,000 ... subject
// to subsidiary limit(s)". Each class is kept as printed, in Other details. No total is made up from them.
const CLASS_HEAD = /^\s*(risks?\s+covered|deductibles?|limits?\s+of\s+(?:liability|cover|indemnity)|limits?|premiums?|rates?)\s*:\s*$/i;
const CLASS_LINE = /^\s*class\s+(i{1,3}|iv|v|[1-5])\s*[:.\-–]\s*(.*)$/i;
const CLASS_NAME = (h) => (/^risk/i.test(h) ? "Cover" : /^deduct/i.test(h) ? "Deductible" : /^limit/i.test(h) ? "Limit" : /^rate/i.test(h) ? "Rate" : "Premium");
// A general sentence after the classes ("The premiums above are net of ...", "Rates in USD per vessel ...").
const NOTE_START = /^\s*(the\s|rates\s+in\b|all\s+amounts\b|note\b|these\s|taxes\b)/i;
export function classBlocks(lines) {
  const out = [];
  let limits = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l || l.marker || !CLASS_HEAD.test(l.text)) continue;
    const name = CLASS_NAME(l.text.trim());
    const rows = [], notes = [];
    let cur = null;
    for (let j = i + 1; j < Math.min(lines.length, i + 16); j++) {
      const t = lines[j];
      if (!t || t.marker || CLASS_HEAD.test(t.text) || /^\s*[A-Z][A-Za-z’' ]{2,40}:\s*$/.test(t.text)) break;
      const text = t.text.replace(/\s{2,}/g, " ").trim();
      const c = CLASS_LINE.exec(t.text);
      if (c) { cur = { label: `${name}, Class ${c[1].toUpperCase()}`, value: c[2].replace(/\s{2,}/g, " ").trim(), ref: j + 1 }; rows.push(cur); continue; }
      if (!cur) break;
      if (NOTE_START.test(text) || notes.length) { if (notes.length < 3) notes.push(text); else break; continue; }
      // A wrapped sentence joins with a space; another priced row ("Vessels 35,001 to 50,000 GT USD 2,803") with "; ".
      cur.value += (/\d[\d,]*$/.test(cur.value) && /\d/.test(text) ? "; " : " ") + text;
    }
    if (!rows.length) continue;
    if (name === "Limit") limits = Math.max(limits, rows.length);
    for (const r of rows) out.push({ ...r, value: r.value.replace(/\s*;\s*$/, "").slice(0, 300) });
    if (notes.length) out.push({ label: `${name} notes`, value: notes.join(" ").slice(0, 300), ref: i + 2 + rows.length });
  }
  return { rows: out, byClass: limits >= 2 };
}

// ---- a schedule set out in sections: "SECTION I - PHYSICAL DAMAGE" with its rows, "SECTION II - LIABILITY"
// with its own sum insured. The sections are kept apart: each row goes to Other details as printed.
const SECTION_HEAD = /^\s*section\s+(i{1,3}|iv|v|vi|[1-6])\b\s*[-–—:.]?\s*([A-Za-z &/]{0,50})\s*$/i;
// "INR 2,53,70,000", "INR 2.53.70,000" (a scan reads some commas as dots), "Rs. (5.00,000)".
const SEC_AMT = /(?:inr|rs\.?|₹)\s*\(?\s*(\d{1,3}(?:[.,]\d{2,3}){1,5})\s*\)?/i;
function sectionAmount(raw) {
  const groups = raw.split(/[.,]/);
  const value = +groups.join("");
  // An Indian amount always ends in a group of three digits: "2,95,56,64" is printed one digit short.
  const short = groups.length > 1 && groups[groups.length - 1].length !== 3;
  return { value, short, text: raw.replace(/\./g, ",") };
}
export function sectionLimits(lines) {
  const heads = [];
  lines.forEach((l, i) => { if (l && !l.marker) { const m = SECTION_HEAD.exec(l.text); if (m) heads.push({ i, no: m[1].toUpperCase(), name: m[2].trim() }); } });
  const sections = [];
  for (const [k, h] of heads.entries()) {
    const end = Math.min(heads[k + 1]?.i ?? lines.length, h.i + 25);
    const rows = [];
    for (let j = h.i + 1; j < end; j++) {
      const l = lines[j]; if (!l || l.marker) continue;
      if (/^\s*deductibles?\b/i.test(l.text) || /^\s*\d{1,2}\.\s+[A-Z]/.test(l.text)) break; // the next numbered item ("6. PREMIUM:")
      const m = SEC_AMT.exec(l.text); if (!m) continue;
      const a = sectionAmount(m[1]); if (a.value < 1000) continue;
      let label = l.text.slice(0, m.index).replace(/[\s—–:\-]+$/, "").trim();
      if (!label) {
        // The label wraps around the figure: "Lump-sum cost of materials for" / "INR 2,53,70,000" / "execution of entire job".
        const prev = lines[j - 1], next = lines[j + 1];
        const plain = (x) => x && !x.marker && !SEC_AMT.test(x.text) && !SECTION_HEAD.test(x.text) && x.text.length < 70;
        label = [plain(prev) ? prev.text : "", plain(next) && /^[a-z+(]/.test(next.text.trim()) ? next.text : ""].join(" ").replace(/\s+/g, " ").trim();
      }
      if (!label || /^description\b/i.test(label)) continue;
      rows.push({ label, ...a, ref: j + 1 });
    }
    if (rows.length && !sections.some((s) => s.no === h.no && s.name.toLowerCase() === h.name.toLowerCase())) sections.push({ ...h, end, rows });
  }
  return sections.length >= 2 ? sections : [];
}
// Is this figure, as printed on its line, an Indian amount one digit short ("2,95,56,64")?
export function printedShort(lineText, v) {
  for (const m of String(lineText || "").matchAll(/\d{1,3}(?:[.,]\d{2,3})+/g)) { const a = sectionAmount(m[0]); if (a.value === +v && a.short) return true; }
  return false;
}
const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
// Section rows for Other details, and the sum insured: the property section's total, the liability section's
// own figure kept as a separate limit.
function applySections(lines, fields, found) {
  const secs = sectionLimits(lines);
  if (!secs.length) return [];
  const rows = secs.flatMap((s) => s.rows.map((r) => ({ label: `Section ${s.no}${s.name ? ` (${titleCase(s.name)})` : ""}: ${r.label}`, value: `INR ${r.text}${r.short ? " (as printed, looks one digit short: check the policy)" : ""}`, ref: r.ref })));
  const prop = secs.find((s) => !/liabilit/i.test(s.name));
  const total = prop && prop.rows.filter((r) => !r.short && /net|total|lump\s*sum\s*price|sum\s+insured/i.test(r.label)).sort((a, b) => b.value - a.value)[0];
  const cur = fields.sumInsured;
  const inLiab = cur && secs.some((s) => /liabilit/i.test(s.name) && cur.ref > s.i && cur.ref <= s.end);
  if (total && (!cur || inLiab || printedShort(lines[cur.ref - 1]?.text, cur.v))) {
    fields.sumInsured = { v: total.value, ref: total.ref, conf: "low", note: `Section ${prop.no}${prop.name ? ` (${titleCase(prop.name)})` : ""} total. The other sections have their own limits: see Other details.` };
    found.sumInsured = [...(found.sumInsured || []), { v: total.value, ref: total.ref, conf: "low", label: total.label }];
  }
  return rows;
}

// ---- what kind of document this is
// An endorsement says so near the top: "MACHINERY BREAKDOWN - ENDORSEMENT E07", "Endorsement No. 3",
// "Endorsement attached ahead of base schedule", "This endorsement forms part of the policy".
// "Attached to and forming part of policy number ..." is printed on ordinary schedule pages, so it never counts.
const ENDORSEMENT_TITLE = /(^|[-–—:|]\s*)endorsement\s*(no\.?|number|ref(erence)?\.?|schedule|certificate)?\s*[:#.]?\s*[A-Z]{0,4}[\/-]?\d{1,4}\b|^\s*endorsement\s*(schedule|certificate|wording)?\s*$|\bendorsement\s+(attached|schedule|certificate|effective)\b|\bthis\s+endorsement\s+(forms|is\s+attached|is\s+issued)|\bchanges\s+only\s+the\s+(extension|section|item)/i;
function docKindOf(lines) {
  const top = lines.filter((l) => !l.marker).slice(0, 25);
  const hit = top.findIndex((l) => ENDORSEMENT_TITLE.test(String(l.text || "")) && !/attached\s+to\s+and\s+forming\s+part/i.test(String(l.text || "")));
  return hit >= 0 ? { kind: "Endorsement", ref: lines.indexOf(top[hit]) + 1, text: String(top[hit].text).replace(/\s{2,}/g, " ").trim().slice(0, 80) } : null;
}

// ---- who is insured, and by whom
// The insured's name: the value of a label set out as a label, cut at the next cell, and only if it
// looks like a name (not an amount, not a clause of wording).
const INSURED_RULE = { kind: "text", label: phraseRe(VOCAB.insured),
  not: /sum\s*(insured|assured)|insured\s*(object|value|location|address|details|event|peril|property|person|member|employee)|persons?\s*insured|lives\s*insured|interests?\s*insured|subject.?matter|(?<!\bof\s)\bthe\s+(insured|assured)\b/i };
const NOT_A_NAME = /\d{3,}|\b(rs\.?|inr|usd|amt|amount|sum|where|which|shall|will|whose|each|policy|period|premium|said\s+to|contain|limit)\b|;\s*$|^[^A-Za-z]|^[^(]*\)|^(mailing|address|contact|details|place|gstin|pan|mobile|e-?mail|date|holder)\b/i;
function findInsured(lines) {
  // The labelled reading and the no-colon reading ("Name of Insured X", "Name MR X Policy No."): the earlier one wins.
  const a = labelledInsured(lines), b = insuredWithoutColon(lines);
  const r = a && b ? (b.ref < a.ref ? b : a) : a || b;
  if (r) { const v = r.v.replace(COMPANY_TAIL, "$1").replace(DESCRIPTION_TAIL, "").trim(); if (v.length >= 3) r.v = v; }
  return r;
}
const isLabelWord = (v) => LABEL_WORDS.test(String(v).replace(/[’'`]\s*s?\s*$/i, "").replace(/[\s–—:.,-]+$/, "").trim());
function labelledInsured(lines) {
  for (const c of candidates(lines, INSURED_RULE)) {
    const v = c.v.split(/\s{3,}|\s+[|]\s+/)[0].replace(/\s+(e-?mail|intermediary|address|gstin|pan|mobile|phone)\b.*$/i, "").replace(/[.,\s]*\bvessel\s*:.*$/i, ".").replace(/\.\.$/, ".").trim();
    if (INSURERS.some(([, re]) => re.test(v)) || /\b(insurance|assurance)\s+(company|co\.?)\b/i.test(v)) continue; // the insurer, not the insured
    if (v.length >= 3 && v.length <= 90 && /[A-Za-z]{3}/.test(v) && !NOT_A_NAME.test(v) && !isLabelWord(v) && v.split(/\s+/).length <= 10) return { v, ref: c.ref };
  }
  return null;
}
// Labels a name is never: a schedule that prints "Insured" or "Name" alone must not give a customer called "Insured".
export const LABEL_WORDS = /^(the\s+)?(insured|assured|proposer|policy\s*holder|policyholder|customer|client|name|insured\s+name|name\s+of\s+(the\s+)?(insured|assured|proposer)|details|insured\s+details)$/i;
// "Name of Insured NEETH PRAKASH GOPWANI" or, under an "Insured details" heading, "Name MR RONAK H SHAH Policy No. ...":
// the label at the start of the line, no colon, and the name cut where the next label starts.
const NEXT_LABEL = /\s+(policy\s*(no|number)|address|mobile|phone|e-?mail|period|gstin|pan\b|vehicle|registration|reg\.?\s*no|customer\s*id|client\s*id|date|dob|age|occupation|nominee|intermediary|agent|branch)\b.*$/i;
// "Policyholder / insured", "Proposer / Insured", "Name / Insured", "Policyholder", "Policy holder's name".
const LABEL_PART = "(?:policy\\s*holder(?:'?s)?|proposer(?:'?s)?|insured(?:'?s)?|assured(?:'?s)?|name)";
const COMBINED_LABEL = new RegExp(`^(?:${LABEL_PART}\\s*\\/\\s*)+${LABEL_PART}(?:\\s+name)?\\s*:?$|^policy\\s*holder(?:'?s)?(?:\\s+name)?\\s*:?$`, "i");
// A company name followed by a description: "Aster Quay Analytics Private Limited - server room and design studio".
const COMPANY_TAIL = /^(.*?\b(?:limited|ltd\.?|llp|pvt\.?|private|inc\.?|plc|co\.?)\.?)\s+[-–—]\s+.+$/i;
// Any name followed by " - " and a description in lower case: "Tara Glen - individual traveller".
const DESCRIPTION_TAIL = /\s+[-–—]\s+[a-z0-9].*$/;
function cleanInsuredName(raw) {
  let v = String(raw || "").replace(NEXT_LABEL, "").replace(/^(mr|mrs|ms|miss|dr|shri|smt|kumari)\.?\s+/i, "").trim();
  const tail = v.match(COMPANY_TAIL); if (tail) v = tail[1];
  v = v.replace(DESCRIPTION_TAIL, "");
  v = v.replace(/[\s,.:;-]+$/, (m) => (/\b(ltd|co|pvt|inc)$/i.test(v.slice(0, v.length - m.length)) ? "." : "")).trim();
  return v.length >= 3 && v.length <= 90 && /[A-Za-z]{3}/.test(v) && !NOT_A_NAME.test(v) && !isLabelWord(v) && v.split(/\s+/).length <= 10 ? v : null;
}
function insuredWithoutColon(lines) {
  const real = lines.slice(0, 160);
  for (let i = 0; i < real.length; i++) {
    const l = real[i]; if (l.marker) continue;
    const t = String(l.text || "").replace(/\s+/g, " ").trim();
    // A combined label in its own cell ("Policyholder / insured", "Proposer / Insured Name") or "Policyholder":
    // the name is the next cell on the line.
    const cells = String(l.text || "").split(/\s{3,}/).map((x) => x.trim()).filter(Boolean);
    if (cells.length >= 2 && COMBINED_LABEL.test(cells[0])) {
      const v0 = cleanInsuredName(cells[1]);
      if (v0) return { v: v0, ref: i + 1 };
    }
    let m = t.match(/^(name\s+of\s+(the\s+)?(insured|assured|proposer|policy\s*holder)|insured'?s?\s+name|proposer'?s?\s+name)\s*[:\-]?\s+(.+)$/i);
    let v = m && m[4];
    // The label alone on its line ("Name of the Proposer/"): the name is the first cell of the next line.
    if (!v && /^(name\s+of\s+(the\s+)?(insured|assured|proposer|policy\s*holder)|insured'?s?\s+name|proposer'?s?\s+name)[\s/:\-]*$/i.test(t) && real[i + 1] && !real[i + 1].marker) {
      v = String(real[i + 1].text || "").split(/\s{3,}/)[0];
      if (v) { v = v.replace(NEXT_LABEL, "").replace(/[\s,.:;-]+$/, "").trim(); if (v.length >= 3 && /[A-Za-z]{3}/.test(v) && !NOT_A_NAME.test(v) && !isLabelWord(v)) return { v, ref: i + 2 }; }
      continue;
    }
    if (!v) {
      m = t.match(/^name\s*[:\-]?\s+(.+)$/i);
      const heading = real.slice(Math.max(0, i - 3), i).some((x) => /\b(insured|assured|proposer|policy\s*holder)\b/i.test(String(x.text || "")));
      v = m && heading && !/^(of|and|&|the)\b/i.test(m[1]) ? m[1] : null;
    }
    if (!v) continue;
    v = v.replace(NEXT_LABEL, "").replace(/^(mr|mrs|ms|miss|dr|shri|smt|kumari)\.?\s+/i, "").replace(/[\s,.:;-]+$/, "").trim();
    if (v.length >= 3 && v.length <= 90 && /[A-Za-z]{3}/.test(v) && !NOT_A_NAME.test(v) && !isLabelWord(v) && v.split(/\s+/).length <= 8) return { v, ref: i + 1 };
  }
  return null;
}
// The insurer: the registered name that appears most often on the document. Intermediaries and other
// insurers are mentioned once or twice; the issuer's name is on every page.
const INSURERS = [
  ["The New India Assurance Co. Ltd.", /new\s*india\s*assurance/i], ["Tata AIG General Insurance", /tata\s*-?\s*aig/i], ["Zurich Kotak General Insurance", /zurich\s*kotak|kotak\s*mahindra\s*general/i],
  ["Bajaj General Insurance", /bajaj\s*(allianz\s*)?general/i], ["Generali Central Insurance", /generali\s*central|future\s*generali/i], ["National Insurance Co. Ltd.", /national\s*insurance\s*co|\bnic\.co\.in\b/i],
  ["ICICI Lombard General Insurance", /icici\s*lombard|bharti\s*axa\s*general/i], ["HDFC ERGO General Insurance", /hdfc\s*ergo|apollo\s*munich/i], ["United India Insurance", /united\s*india\s*insurance/i], ["The Oriental Insurance Co. Ltd.", /oriental\s*insurance/i],
  ["SBI General Insurance", /sbi\s*general/i], ["IndusInd General Insurance", /indusind\s*general|reliance\s*general/i], ["Royal Sundaram General Insurance", /royal\s*sundaram/i], ["Cholamandalam MS General Insurance", /cholamandalam/i],
  ["IFFCO-Tokio General Insurance", /iffco[\s-]*tokio/i], ["Liberty General Insurance", /liberty\s*general/i], ["Go Digit General Insurance", /go\s*digit|digit\s*insurance/i], ["ACKO General Insurance", /\backo\b/i],
  ["Magma General Insurance", /magma\s*(hdi|general)/i], ["Raheja QBE General Insurance", /raheja\s*qbe/i], ["Shriram General Insurance", /shriram\s*general/i], ["Universal Sompo General Insurance", /universal\s*sompo/i],
  ["Navi General Insurance", /navi\s*general/i], ["Zuno General Insurance", /\bzuno\b|edelweiss\s*general/i], ["Star Health Insurance", /star\s*health/i], ["Care Health Insurance", /care\s*health|religare\s*health/i],
  ["Niva Bupa Health Insurance", /niva\s*bupa|max\s*bupa/i], ["ManipalCigna Health Insurance", /manipal\s*cigna|cigna\s*ttk/i], ["Aditya Birla Health Insurance", /aditya\s*birla\s*health/i], ["ECGC", /\becgc\b/i],
  ["Galaxy Health Insurance", /galaxy\s*health/i], ["Narayana Health Insurance", /narayana\s*health\s*insurance/i], ["Kshema General Insurance", /kshema\s*general/i],
  ["Agriculture Insurance Company of India", /agriculture\s*insurance\s*company/i],
];
// The insurer's office that issued or services the policy: its name, office code and city.
// Offices are printed as "Office Name: HARBOUR ROAD D.O - II (123456)", "Office Code: CORPORATE_OFFICE (654321)",
// "Issued At: PUNE-BANER", "Area Code: Kothrud Branch Office", or only an address under "Policy Servicing Office".
const OFFICE = { name: phraseRe(VOCAB.branchName), code: phraseRe(VOCAB.branchCode), addr: phraseRe(VOCAB.branchAddress) };
const tidyCase = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\b(d\.o|b\.o|r\.o|h\.o)\b/gi, (m) => m.toUpperCase()) : s);
function cityIn(text) {
  const t = " " + text.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ") + " ";
  const city = CITIES.find((c) => t.includes(" " + c.toLowerCase() + " "));
  if (city) return city;
  return MUMBAI_AREAS.some((a) => t.includes(" " + a + " ")) ? "Mumbai" : "";
}
function findOffice(lines) {
  let name = "", code = "", city = "", ref = 0, at = -1, x = 0;
  const looksLikeAddress = (v) => v.length > 45 || (v.match(/,/g) || []).length >= 2 || /\b\d{6}\b/.test(v);
  const paymentLine = (c) => /\b(bank|instrument|cheque|drawee|payment|receipt|neft|utr)\b/i.test(lines[c.ref - 1]?.text || "") || /\b(bank|instrument|cheque|drawee)\b/i.test(lines[c.ref - 2]?.text || "");
  const HEADER = /^(amount|premium|total|date|code|name|address|details|no\.?|number|type|status|remarks?)$/i;
  // Name first, then a lettered office code, then an address-only block.
  for (const c of candidates(lines, { key: "branchName", kind: "text", label: OFFICE.name, not: /insured|customer|claims?|nearest|respective/i })) {
    if (paymentLine(c)) continue;
    let v = c.v.split(/\s{3,}|\s+\|\s+/)[0].trim();
    const m = v.match(/\((\d{3,8})\)\s*$/); if (m) { code = m[1]; v = v.slice(0, m.index).trim(); }
    if (!/[A-Za-z]{3}/.test(v) || HEADER.test(v) || INSURERS.some(([, re]) => re.test(v))) continue;
    if (looksLikeAddress(v)) { city = city || cityIn(v); at = at < 0 ? c.ref - 1 : at; continue; }
    name = tidyCase(v.replace(/\s*branch\s*office$/i, " Branch").trim()); ref = c.ref; at = c.ref - 1; break;
  }
  for (const c of candidates(lines, { key: "branchCode", kind: "text", label: OFFICE.code, not: /sales|channel|agent|intermediary|pin|area\s*code/i })) {
    if (paymentLine(c)) continue;
    const v = c.v.split(/\s{3,}|\s+\|\s+/)[0].trim();
    const m = v.match(/\((\d{3,8})\)/) || v.match(/^(\d{3,8})$/);
    if (m) code = code || m[1];
    const label = v.replace(/\(\d{3,8}\)/, "").replace(/_/g, " ").trim();
    if (!name && /[A-Za-z]{4}/.test(label) && !looksLikeAddress(label)) { name = tidyCase(label); ref = c.ref; }
    if (at < 0) at = c.ref - 1;
    break;
  }
  if (!name) {
    const i = lines.slice(0, 30).findIndex((l) => !l.marker && l.text.trim().split(/\s+/).length <= 7 && /\b(branch(\s+office)?|divisional\s+office|d\.o\.?|branch\s+office)\s*$/i.test(l.text.trim()) && !/nearest|respective|contact|any\b/i.test(l.text));
    if (i >= 0) { name = tidyCase(lines[i].text.trim().replace(/\s*branch(\s+office)?\s*$/i, "").trim()) || ""; ref = i + 1; if (at < 0) at = i; }
  }
  // The address block sits under the label; in two-column layouts only the office's own column counts.
  lines.forEach((l, i) => { if (at < 0 && !l.marker && OFFICE.addr.test(l.text)) at = i; });
  if (at >= 0) {
    const head = lines[at];
    const seg = head?.segs?.find((s) => OFFICE.addr.test(s.s) || OFFICE.code.test(s.s) || OFFICE.name.test(s.s));
    x = seg && head.segs.length > 1 ? seg.x : 0;
    const block = lines.slice(at, at + 7).filter((l) => !l.marker).map((l) => (l.segs || [{ x: 0, s: l.text }]).filter((s) => s.x >= x - 20).map((s) => s.s).join(" ")).join(" ");
    city = city || cityIn(name) || cityIn(block);
  }
  if (!name && !code && !city) return null;
  if (!name) name = code ? "Office " + code : city + " office";
  return { name, code, city, ref: ref || at + 1 };
}

// A company name as printed after "issued by" or "Security:": capitalised words ending like a company
// ("... Agencies Limited", "Great Lakes Insurance SE", "Westfield Syndicate 1200"), never "the relevant authorities".
const COMPANY_END = /\b(limited|ltd\.?|llp|se|plc|inc\.?|ag|s\.?a\.?|n\.?v\.?|gmbh|syndicate\s+\d{3,5}|company|insurance|assurance|agencies|underwriters|club|mutual)$/i;
function companyName(raw) {
  const v = String(raw || "").replace(/^\s*(the|m\/s\.?)\s+/i, "").replace(/\s+/g, " ").replace(/[\s,;:]+$/, "").trim();
  const known = INSURERS.find(([, re]) => re.test(v));
  if (known) return known[0];
  const words = v.split(" ");
  if (words.length < 2 || words.length > 9 || v.length > 80 || !/^[A-Z0-9]/.test(v) || !COMPANY_END.test(v)) return null;
  if (/\b(authorit\w*|government|court|bank|insured|assured|policy\s*holder|you|we)\b/i.test(v)) return null;
  return v === v.toUpperCase() ? v.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\b(Llp|Se|Plc|Ag)\b/g, (m) => m.toUpperCase()) : v;
}
// The company a certificate says issued it: "This Certificate of Insurance is issued by X for and on behalf of ...".
const ISSUE_STOP = /\s+(?:for\s+and\s+on\s+behalf|on\s+behalf|pursuant|under\s+(?:the|its|a)\s|in\s+accordance|acting\s|as\s+agents?|who\s|which\s|whose\s|and\s+is\s|dated\s|at\s+(?:the|its)\s)|[,;(]|\.(?:\s|$)/i;
// "issued by X for and on behalf of the Underwriters": X is a coverholder or managing agent, not the insurer.
// So is "issued by X pursuant to its Authority Agreement with ...", and a document that calls X a coverholder.
const FOR_UNDERWRITERS = /^\s*(?:for\s+and\s+)?on\s+behalf\s+of\s+(?:the\s+)?(?:underwriters|insurers?|lloyd'?s|syndicates?|security)|^\s*pursuant\s+to\s+(?:its|the|a)\s+(?:binding\s+)?authority/i;
function issuedByFull(flatText) {
  const re = /\b(?:issued|underwritten)\s+by\s*:?\s+/gi;
  let m;
  while ((m = re.exec(flatText))) {
    const before = flatText.slice(Math.max(0, m.index - 80), m.index);
    if (!/\b(certificate|policy|document|insurance|cover(?:age)?|schedule|contract|this)\b[^.]*$/i.test(before)) continue;
    const rest = flatText.slice(m.index + m[0].length, m.index + m[0].length + 200);
    const head = rest.split(ISSUE_STOP)[0];
    const name = companyName(head);
    if (name) return { name, agent: FOR_UNDERWRITERS.test(rest.slice(head.length)) || /\bcover\s*-?holder\b/i.test(flatText) };
  }
  return null;
}
const issuedBy = (flatText) => issuedByFull(flatText)?.name || null;
// Regulatory boilerplate names a company without making it the insurer.
const REGULATORY = /authori[sz]ed\s+(and|&)\s+regulated|regulated\s+by|financial\s+conduct\s+authority|\bFCA\b|prudential\s+regulation|registered\s+(office|in\s+england)|company\s+registration|registered\s+number/i;
// London market slips: "SECURITY  100% Great Lakes Insurance SE ..." or "USD 10 Million led by Westfield Syndicate 1200".
function securityLead(lines) {
  for (const [k, l] of lines.entries()) {
    // "Security:" alone on its line, with "100% Great Lakes Insurance SE ..." on the next one.
    const m = l.text.match(/^\s*security\s*:?\s+(.*)$/i) || (/^\s*security\s*:\s*$/i.test(l.text) && lines[k + 1] ? [null, lines[k + 1].text] : null);
    if (!m) continue;
    const v = m[1].replace(/^[\d.]+\s*%\s*/, "");
    const led = v.match(/\bled\s+by\s+(.+)/i);
    const name = companyName((led ? led[1] : v).split(/\s+a\s+wholly|\s+\(|[,;]|\.(?:\s|$)/i)[0]);
    if (name) return name;
  }
  return null;
}

function findInsurer(lines) {
  const text = lines.filter((l) => !l.marker && !REGULATORY.test(l.text)).map((l) => l.text).join("\n");
  const full = issuedByFull(text.replace(/\s+/g, " "));
  // Issued by a coverholder for the underwriters: the insurer is the security named on the slip.
  if (full?.agent) { const lead = securityLead(lines.filter((l) => !l.marker)); if (lead) return lead; }
  const stated = full?.name;
  if (stated) return stated;
  let best = null;
  for (const [name, re] of INSURERS) {
    const n = (text.match(new RegExp(re.source, "gi")) || []).length;
    if (n && (!best || n > best.n)) best = { name, n };
  }
  if (best) return best.name;
  const lead = securityLead(lines.filter((l) => !l.marker));
  if (lead) return lead;
  const top = lines.filter((l) => !l.marker).slice(0, 40).map((l) => l.text.split(/\s{3,}/)[0].replace(/\s*\((fictional|sample)\)\s*/i, "").trim());
  // Ends like a registered insurer ("... Insurance Company Limited", "... Assurance Co. Ltd."); never a broker or a heading.
  const named = top.find((t) => t.length <= 80 && /^[A-Z][A-Za-z&.'\- ]{2,60}\b(insurance|assurance)\s+(company|co\.?)(\s+(limited|ltd\.?))?\.?$|^[A-Z][A-Za-z&.'\- ]{2,60}\b(insurance|assurance)\s+(limited|ltd\.?)\.?$/i.test(t)
    && !/\b(brok|agent|period|of\s+insurance|certificate|policy|schedule|we|you|your)\b/i.test(t));
  return named || null;
}

// Every company the document could mean as its insurer, for the pick list. Each has the line it was read
// from, the words beside it and how many pages show it. A name next to "former", "prior" or "previous" is
// kept but marked, so the screen can show it was found and passed over.
const INSURER_LABEL = /^(current\s+issuer|issuer|insurer(?:'s)?\s+name|name\s+of\s+(?:the\s+)?insurer|insurer|insurance\s+company|insurance\s+co\.?|underwriter|issuing\s+company|issuing\s+office\s+of)\s*:?$/i;
const PRIOR_INSURER_LABEL = /^(former\s+(?:trade\s+style|name|insurer|trading\s+name)|formerly(?:\s+known\s+as)?|previous\s+(?:insurer|name|trade\s+name)|prior\s+(?:insurer|name)|old\s+name|erstwhile(?:\s+name)?|expiring\s+insurer)\s*:?$/i;
const PLAIN = (s) => String(s || "").replace(/\s*\((fictional|sample|specimen|test)\)\s*/gi, " ").replace(/\s+/g, " ").trim();
const insurerKeyOf = (s) => PLAIN(s).toLowerCase().replace(/^the\s+/, "").replace(/[.,]/g, "").replace(/\s+(company|co|limited|ltd|insurance|assurance|general)\b/g, "").replace(/\s+/g, " ").trim();
export function insurerCandidates(lines) {
  const by = new Map();
  const add = (name, ref, label, how, prior = false) => {
    const v = PLAIN(name);
    if (!v) return;
    const k = insurerKeyOf(v);
    const page = lines[ref - 1]?.page || 1;
    const e = by.get(k);
    if (e) {
      e.count++; e.pageSet.add(page); if (!prior) e.prior = false;
      if (how === "labelled" && !prior) e.how = how;
      // Point at the earliest place it is printed, with the words found there.
      if (ref < e.ref) { e.ref = ref; e.label = label || e.label; } else if (!e.label && label) e.label = label;
      return;
    }
    by.set(k, { v, ref, label: label || "", how, prior, count: 1, pageSet: new Set([page]) });
  };
  const real = lines.map((l, i) => ({ l, i })).filter((x) => !x.l.marker && !REGULATORY.test(x.l.text));
  // 0) London market security first: when a coverholder issues the certificate, this is the insurer.
  const lead0 = securityLead(real.map((x) => x.l));
  const flat = real.map((x) => x.l.text).join(" ").replace(/\s+/g, " ");
  const full = issuedByFull(flat);
  if (lead0 && full?.agent) { const at = real.find((x) => /^\s*security\b/i.test(x.l.text)); add(lead0, (at ? at.i : 0) + 1, "Security", "security"); }
  // 1) "issued by X" in the certificate wording. Issued "for and on behalf of the Underwriters", X is the
  // coverholder: listed, but without the points of a named insurer.
  const stated = full?.name;
  if (stated) { const at = real.find((x) => /issued\s+by/i.test(x.l.text)) || real.find((x) => x.l.text.toLowerCase().includes(stated.toLowerCase().split(" ")[0])); add(stated, (at ? at.i : 0) + 1, full.agent ? "Issued for the underwriters by" : "Issued by", full.agent ? "agent" : "stated"); }
  // 2) a label cell and its value: "Current issuer  North Quay Assurance", "Former trade style  Cedar Legacy Assurance"
  for (const { l, i } of real) {
    const segs = l.segs || [];
    for (let j = 0; j < segs.length - 1; j++) {
      const lab = segs[j].s.trim();
      const prior = PRIOR_INSURER_LABEL.test(lab);
      if (!prior && !INSURER_LABEL.test(lab)) continue;
      const name = companyName(PLAIN(segs[j + 1].s));
      if (name) add(name, i + 1, lab.replace(/\s*:$/, ""), "labelled", prior);
    }
  }
  // 3) a registered insurer named anywhere, counted
  for (const [name, re] of INSURERS) {
    const hits = real.filter((x) => re.test(x.l.text));
    for (const h of hits) add(name, h.i + 1, "", "known");
  }
  // 4) the letterhead: the first line of each page, when it reads like an insurance company
  if (lines.some((l) => l.marker)) {
    lines.forEach((l, i) => {
      if (!l.marker) return;
      const nx = lines[i + 1];
      if (!nx || nx.marker) return;
      const t = PLAIN((nx.segs && nx.segs[0]?.s) || nx.text);
      if (!/\b(insurance|assurance|general|underwriters|mutual)\b/i.test(t) || /\b(brok|agent|policy|schedule|certificate|period)\b/i.test(t)) return;
      const name = companyName(t);
      if (name) add(name, i + 2, "Letterhead", "letterhead");
    });
  }
  // 5) London market security
  const lead = securityLead(real.map((x) => x.l));
  if (lead) { const at = real.find((x) => /^\s*security\b/i.test(x.l.text)); add(lead, (at ? at.i : 0) + 1, "Security", "security"); }
  return [...by.values()].map(({ pageSet, ...c }) => ({ ...c, pages: pageSet.size, firstPage: Math.min(...pageSet) })).slice(0, 6);
}

// ---- customer details printed on a policy or GST certificate
// Insurer contact details are common on schedules, so a value on an insurer/helpline line is never used,
// and a value not clearly tied to the insured is marked for checking.
const INSURER_LINE = /insurer|insurance\s*(company|co\b)|assurance|branch|toll\s*free|helpline|customer\s*care|call\s*centre|grievance|claims?\s*(dept|department|desk)|registered\s*office|irdai|corporate\s*office|www\.|website/i;
const INSURED_LINE = /insured|proposer|policy\s*holder|policyholder|customer|client|name\s*of\s*the\s*(firm|company)/i;
const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}/;
const ADDR_LABEL = /\b((insured|proposer|policy\s*holder)('s)?\s*address|address\s*of\s*(the\s*)?(insured|proposer)|correspondence\s*address|communication\s*address|mailing\s*address|principal\s*place\s*of\s*business|address)\b\s*[:\-]/i;

function contactPick(lines, re, labelRe, clean = (x) => x, valid = () => true) {
  const hits = [];
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  lines.forEach((l, i) => {
    if (l.marker || INSURER_LINE.test(l.text)) return;
    if (labelRe && !labelRe.test(l.text)) return;
    const m = [...l.text.matchAll(g)].map((x) => clean(x[0])).find(valid);
    if (m) hits.push({ v: m, ref: i + 1, tied: INSURED_LINE.test(l.text) || INSURED_LINE.test(lines[i - 1]?.text || "") });
  });
  if (!hits.length) return null;
  const best = hits.find((h) => h.tied) || hits[0];
  const distinct = [...new Set(hits.map((h) => h.v))];
  return { v: best.v, ref: best.ref, conf: best.tied && distinct.length === 1 ? "high" : "low", note: !best.tied ? "Not clearly labelled as the customer's. Check it is not the insurer's." : distinct.length > 1 ? `The document shows ${distinct.length} different values. The first one was used.` : undefined };
}

export function parseCustomer(lines) {
  const out = {};
  const ins = findInsured(lines);
  if (ins) out.name = { v: ins.v, ref: ins.ref, conf: "high" };
  const addrLine = lines.findIndex((l) => !l.marker && ADDR_LABEL.test(l.text) && !INSURER_LINE.test(l.text));
  if (addrLine >= 0) {
    const v = cleanText(lines[addrLine].text.replace(new RegExp(".*?" + ADDR_LABEL.source, "i"), "").replace(/^[\s:\-]+/, "").split(/\s{3,}/)[0]);
    const generic = !/insured|proposer|holder|correspondence|communication|mailing|principal/i.test(lines[addrLine].text);
    if (v && v.length > 4 && !EMAIL_RE.test(v) && /[A-Za-z]{3}/.test(v)) out.address = { v, ref: addrLine + 1, conf: generic ? "low" : "high", note: generic ? "Labelled only \"Address\". Check it is the customer's address." : undefined };
  }
  const cityLine = lines.findIndex((l) => !l.marker && /\bcity\s*[:\-]/i.test(l.text) && !INSURER_LINE.test(l.text));
  if (cityLine >= 0) { const v = cleanText(lines[cityLine].text.replace(/.*?\bcity\s*[:\-]/i, "").replace(/^[\s:\-]+/, "").split(/\s{3,}|,/)[0]); if (/^[A-Za-z][A-Za-z .'-]{1,39}$/.test(v)) out.city = { v, ref: cityLine + 1, conf: "high" }; }
  const place = clientPlace(lines, ins?.ref, CITIES, MUMBAI_AREAS);
  if (place) {
    out.address = { v: place.address, ref: place.ref, conf: ins ? "high" : "low", ...(ins ? {} : { note: "Check this is the customer's address, not the insurer's." }) };
    if (!out.city && place.city) out.city = { v: place.city.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase()), ref: place.ref, conf: "high", note: "Read from the customer's address." };
  }
  const gst = clientGstin(lines, out.name?.v);
  if (gst) out.gst = gst;
  const email = contactPick(lines, EMAIL_RE, null, (x) => x.toLowerCase());
  if (email) out.email = email;
  // At least 10 digits, and never a toll-free or helpline series (1800 / 1860), which belong to insurers.
  const phone = contactPick(lines, PHONE_RE, /\b(mobile|mob\.?|phone|tel\.?|telephone|contact\s*(no|number)?)\b/i, (x) => x.trim(),
    (x) => { const d = x.replace(/\D/g, ""); return d.length >= 10 && !/^(91)?1[89]\d0/.test(d); });
  if (phone) out.phone = phone;
  return out;
}

export async function readPolicyPdf(file, onProgress = () => {}) {
  let res, ocr = false;
  if (isImage(file)) { res = { ...(await ocrImage(file, onProgress)), pages: 1 }; ocr = true; }
  else {
    res = await pdfToLines(file, onProgress);
    // No text layer: the pages are pictures, so read them with OCR.
    if (res.textChars < 40) { const o = await ocrPdf(res.pdf, onProgress); res = { ...res, lines: o.lines, readPages: o.readPages }; ocr = true; }
  }
  const base = { id: `USER-${Date.now()}`, extracted: true, title: file.name, fileName: file.name, fileSize: file.size, pages: res.pages, readPages: res.readPages, ocr };
  const chars = res.lines.reduce((a, l) => a + (l.marker ? 0 : l.text.length), 0);
  if (chars < 40) {
    return { ...base, noText: true, lines: ["No readable text was found, even after reading the pages as a scan.", "The scan may be too faint or blurred. Enter the values by hand, or attach the digital PDF from the insurer."], fields: {}, info: {}, customer: {} };
  }
  let lines = res.lines.slice(0, MAX_LINES);
  let { fields, info } = parseFields(lines, ocr);
  // A scanned premium table often comes back without its labels. Read those pages again, word by word.
  if (ocr && res.pdf && (!fields.gst || !fields.grossPremium || !fields.netPremium)) {
    const again = await ocrPremiumPages(res.pdf, lines, onProgress);
    if (again.length) { lines = [...lines, ...again].slice(0, MAX_LINES); ({ fields, info } = parseFields(lines, ocr)); }
  }
  const customer = parseCustomer(lines);
  // A scan can misread a letter or digit, so every value read from one is marked for checking.
  if (ocr) for (const set of [fields, customer]) for (const k of Object.keys(set)) set[k] = { ...set[k], conf: "low", note: [set[k].note, "Read from a scan. Check it against the document."].filter(Boolean).join(" ") };
  if (ocr && info.vessels) info.vessels = info.vessels.map((v) => ({ ...v, conf: "low", note: "Read from a scan. Check the name and numbers against the document." }));
  // A project cover named only in its heading: the reader says which type it is, and add.jsx uses it.
  const eng = engineeringType(lines);
  if (eng) { base.type = eng.type; base.dept = eng.dept; base.typeFrom = "document"; }
  const other = [...(info.otherRows || []), ...otherDetails(lines)];
  delete info.otherRows;
  const sch = liabilitySchedule(lines);
  if (sch) other.unshift({ label: "AOA (any one accident)", value: String(sch.aoa), ref: sch.ref }, { label: "AOY (any one year)", value: String(sch.aoy), ref: sch.ref }, { label: "AOA to AOY ratio", value: sch.ratio, ref: sch.ref }, { label: "Deductible", value: String(sch.deductible), ref: sch.ref }, { label: "Retroactive date", value: sch.retro, ref: sch.ref });
  // geo: where each line sits ([page, x0, y0, x1, y1] as fractions of the page), for "View in PDF". Kept only
  // while the document is being reviewed, never saved with the book.
  return { ...base, lines: lines.map((l) => l.text), geo: lines.map((l) => (l.g ? [l.page, ...l.g] : [l.page || 1])), fields, info, customer, other: other.filter((x, i, a) => a.findIndex((y) => y.label === x.label) === i) };
}
export { LABELS as EXTRACT_LABELS };
