// Readers that work across a whole document rather than one label: premium figures matched by arithmetic,
// the client's GSTIN, liability schedules, "other details", and dates pasted by hand.
import { findAmounts, findDates } from "./extract.js";

const amounts = (s) => findAmounts(s).map((a) => a.v);
const close = (a, b, tol = 2) => Math.abs(a - b) <= tol;
const NOT_PREMIUM = /\b(paid|wages|past|previous|additional|deposit|refund|minimum|rate|lives|no\.?\s*of|gstin|sum\s*insured|in\s*words|received|cheque)\b/i;

// ---- Premium. Gross premium + GST = net premium, the final amount paid. Policies use these words in opposite
// ways ("Net Premium" before tax on one, "Gross Premium" before tax on another), so the figures decide, not the words.
export function premiumFigures(lines, preCands = [], postCands = [], gstCands = [], stampCands = []) {
  const pre = [...preCands], post = [...postCands], tables = [];
  const parts = {};
  const nextRow = (i) => { for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) if (!lines[j].marker) return j; return -1; };
  lines.forEach((l, i) => {
    if (l.marker) return;
    const t = l.text;
    // A table: the words on one line and the figures under them.
    if (/premium|taxable/i.test(t) && /total/i.test(t) && !amounts(t).length) {
      const j = nextRow(i);
      const a = j >= 0 ? amounts(lines[j].text) : [];
      if (a.length >= 3 && close(a[0] + a[1], a[2])) tables.push({ p: a[0], tax: a[1], n: a[2], ref: j + 1 });
      else if (a.length >= 4 && close(a[0] + a[1] + a[2], a[3])) tables.push({ p: a[0], tax: a[1] + a[2], n: a[3], ref: j + 1 });
      return;
    }
    if (!/gstin|regist|\buin\b/i.test(t)) {
      const tax = [["c", /\bcgst\b|central\s*gst/i], ["s", /\b(sgst|ugst|utgst)\b|state\s*gst/i], ["i", /\bigst\b|integrated\s*gst/i]];
      for (const [k, re] of tax) {
        const m = t.match(re);
        if (!m || parts[k]) continue;
        const a = amounts(t.slice(m.index + m[0].length));
        if (a.length) parts[k] = { v: a[0], ref: i + 1 };
      }
    }
    if (/total\s*\(\s*in\s*figures\s*\)/i.test(t)) { const a = amounts(t.slice(t.search(/total\s*\(/i))); if (a.length) post.push({ v: a[0], ref: i + 1 }); return; }
    if (NOT_PREMIUM.test(t)) return;
    if (/\b(total|final|grand)\b|\bpayable\b/i.test(t) && /premium|amount|payable|rounded|figures|\(\s*[`₹]|\(\s*rs|\(\s*inr|\btotal\s*[:`₹]/i.test(t)) {
      const a = amounts(t); if (a.length) post.push({ v: a[0], ref: i + 1 });
    } else if (/\bpremium\b|taxable\s*value/i.test(t)) {
      const a = amounts(t); if (a.length) pre.push({ v: a[0], ref: i + 1 });
    }
  });
  const uniq = (xs) => { const seen = new Set(); return xs.filter((x) => { if (!(x.v > 0) || seen.has(x.v)) return false; seen.add(x.v); return true; }); };
  const P = uniq(pre), N = uniq(post), all = uniq([...pre, ...post]);
  const partList = Object.values(parts);
  const taxSum = partList.reduce((a, x) => a + x.v, 0);
  const taxRef = partList.find((x) => x.v > 0)?.ref;
  const namedTax = gstCands.find((c) => c.v > 0);
  const T = taxSum > 0 ? { v: Math.round(taxSum * 100) / 100, ref: taxRef } : namedTax ? { v: namedTax.v, ref: namedTax.ref } : null;

  const out = (g, t, n, ok, note) => {
    const mk = (x) => (x ? { v: x.v, ref: x.ref, conf: ok ? "high" : "low", ...(note ? { note } : {}) } : null);
    return { gross: mk(g), gst: mk(t), net: mk(n) };
  };
  if (tables.length) { const x = tables[0]; return out({ v: x.p, ref: x.ref }, { v: x.tax, ref: x.ref }, { v: x.n, ref: x.ref }, true); }
  // Only CGST or only SGST found: the other half is the same amount.
  if (partList.length === 1 && (parts.c || parts.s)) {
    const half = partList[0];
    for (const n of N) for (const p of P) if (p.v < n.v && close(p.v + 2 * half.v, n.v)) return out(p, { v: 2 * half.v, ref: half.ref }, n, true);
  }
  // Some totals include stamp duty: gross + GST + stamp = the final amount paid.
  let stamp = stampCands.find((c) => c.v > 0);
  if (!stamp) {
    const i = lines.findIndex((l) => !l.marker && /\bstamp\s*duty\b/i.test(l.text) && !amounts(l.text).length && l.text.length < 90);
    const a = i >= 0 ? [lines[i + 1], lines[i + 2]].filter((l) => l && !l.marker).map((l) => amounts(l.text)).find((x) => x.length) : null;
    if (a && a[0] > 0) stamp = { v: a[0], ref: i + 1 };
  }
  if (T && stamp) for (const n of N) for (const p of P) if (p.v < n.v && close(p.v + T.v + stamp.v, n.v) && Math.abs(p.v + T.v + stamp.v - n.v) < Math.abs(p.v + T.v - n.v)) { const r = out(p, T, n, true, `The total includes stamp duty of ${stamp.v}.`); r.stamp = { v: stamp.v, ref: stamp.ref, conf: "high" }; return r; }
  if (T) {
    for (const n of [...N, ...P]) for (const p of [...P, ...N]) if (p.v < n.v && close(p.v + T.v, n.v)) return out(p, T, n, true);
  } else {
    // No GST line: a usual GST rate between two figures is enough.
    for (const n of N) for (const p of all) if (p.v < n.v && [1.18, 1.12, 1.05, 1.28].some((r) => Math.abs(n.v / p.v - r) < 0.006)) return out(p, { v: Math.round((n.v - p.v) * 100) / 100, ref: n.ref }, n, true, "GST worked out as net minus gross. Check it.");
  }
  const g = P[0] || null;
  const n = N.find((x) => !g || x.v > g.v) || null;
  if (g && T && n) return out(g, T, n, false, "Gross premium + GST does not equal net premium on this document. Check all three.");
  if (g && n) return out(g, null, n, false, "Could not confirm which figure is before GST. Check both.");
  return out(g, T, n, false, g || n ? "Only part of the premium was found. Check it." : undefined);
}

// ---- The client's GSTIN, never the insurer's or the broker's.
const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/g;
const NOT_CLIENT = /issuing|office|service\s*accounting|\bsac\b|\bhsn\b|\birda|uin\s*no|insurer|insurance\s*(co|company)|assurance|broker|\bgci\b|\bnia\b|general\s*insurance|registered/i;
export function clientGstin(lines, insuredName = "") {
  const firstWord = String(insuredName).trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();
  const insurerPans = new Set();
  lines.forEach((l) => { const m = !l.marker && l.text.match(/\bPAN\s*(?:NUMBER|NO\.?)?\s*[:\-]?\s*([A-Z]{5}\d{4}[A-Z])\b/i); if (m && /\b(nia|insurer|company|ltd)\b/i.test(l.text.slice(0, m.index))) insurerPans.add(m[1].toUpperCase()); });
  // A GSTIN shown beside insurer words anywhere in the document is the insurer's everywhere.
  const notClient = new Set();
  lines.forEach((l) => {
    if (l.marker) return;
    const segs = l.segs?.length ? l.segs : [{ s: l.text }];
    segs.forEach((seg, k) => { const m = seg.s.match(GSTIN); if (m && (NOT_CLIENT.test(seg.s) || (k > 0 && NOT_CLIENT.test(segs[k - 1].s)) || /\birda|uin\s*no|service\s*accounting|\bsac\b/i.test(l.text))) m.forEach((x) => notClient.add(x)); });
  });
  let officeX = null, officeUntil = -1;
  const hits = [];
  let saidNone = null;
  lines.forEach((l, i) => {
    if (l.marker) return;
    const hdr = (l.segs || []).find((s) => /issuing\s*office|insurer.?s?\s*details|office\s*details/i.test(s.s));
    if (hdr && (l.segs || []).length > 1) { officeX = hdr.x; officeUntil = i + 16; }
    for (const seg of l.segs?.length ? l.segs : [{ s: l.text, x: 0 }]) {
      if (officeX != null && i <= officeUntil && seg.x >= officeX - 12) continue;
      if (/gstin|gst\s*(no|reg)/i.test(seg.s) && /:\s*(na|n\/a|-)\s*(\/|$)/i.test(seg.s)) { saidNone ??= i + 1; continue; }
      const m = seg.s.match(GSTIN);
      if (!m) continue;
      const near = [lines[i - 1]?.text, lines[i - 2]?.text, l.text].join(" ").toLowerCase();
      const tied = (firstWord && near.includes(firstWord)) || /gstin\s*\/\s*uin|customer|insured|assured|proposer|client|policy\s*holder/i.test(seg.s);
      if (NOT_CLIENT.test(seg.s) || (NOT_CLIENT.test(l.text) && !tied)) continue;
      if (insurerPans.has(m[0].slice(2, 12)) || notClient.has(m[0])) continue;
      hits.push({ v: m[0], ref: i + 1, tied });
    }
  });
  if (!hits.length) return null;
  const best = hits.find((h) => h.tied) || hits[0];
  const distinct = [...new Set(hits.map((h) => h.v))];
  if (saidNone && !best.tied) return null;
  return { v: best.v, ref: best.ref, conf: best.tied && distinct.length === 1 ? "high" : "low", ...(best.tied && distinct.length === 1 ? {} : { note: distinct.length > 1 ? `The document shows ${distinct.length} GSTINs. Check this one is the client's.` : "Not clearly labelled as the client's. Check it is not the insurer's." }) };
}

// ---- Liability schedules with one row of limits: retroactive date, jurisdiction, AOA, AOY, deductible.
export function liabilitySchedule(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].marker || !/jurisdiction/i.test(lines[i].text) || !/\bAOA\b/.test(lines[i].text)) continue;
    for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
      const m = lines[j].text.match(/(\d{2}\/\d{2}\/\d{4})\s+([A-Za-z(][^\d]*?)\s+(\d[\d,]*)\s+(\d+:\d+)\s+(\d[\d,]*)\s+[A-Za-z&]+\s+(\d[\d,]*)/);
      if (!m) continue;
      let place = m[2].trim();
      for (let k = j + 1; k < Math.min(lines.length, j + 6); k++) {
        const t = lines[k].text.trim();
        if (lines[k].marker || /^(retro|deduct)/i.test(t) || (lines[k].segs || []).length > 1) break;
        place += (/[(]$/.test(place) ? " " : " ") + t;
      }
      const num = (x) => +x.replace(/,/g, "");
      const [dd, mm, yy] = m[1].split("/");
      return { ref: j + 1, retro: `${dd}/${mm}/${yy}`, jurisdiction: place.replace(/\(\s+/g, "(").replace(/\s+/g, " ").replace(/\(\s*/, " (").replace(/\s+\(/, " (").trim(), aoa: num(m[3]), ratio: m[4], aoy: num(m[5]), deductible: num(m[6]) };
    }
  }
  return null;
}

// ---- "Other details": what a policy says that has no field of its own.
const isNone = (s) => /^(na|n\/a|nil|none|not applicable|-+|\.)?$/i.test(String(s).trim());
const HEADED = [
  ["Special conditions", /^special\s*conditions?\b/i],
  ["Special exclusions", /^special\s*exclusions?\b/i],
  ["Special excess or deductible", /^special\s*(excess|deductible)/i],
  ["Warranties", /^(special\s*)?warrant(y|ies)\b/i],
  ["Trading warranty", /^trading\s*(warranty|limits?)\b/i],
  ["Interest insured", /^interest\s*insured\b/i],
  ["Type of risk", /^type\s*of\s*risk\b/i],
  ["Business of the insured", /^(business\s*(description|of\s*the\s*(insured|assured))|nature\s*of\s*business|occupancy)\b/i],
  ["Voyage", /^voyage\b(?!\s*type)/i],
  ["Conveyance", /^(conveyance|mode\s*of\s*transit)\b/i],
  ["Retroactive date", /^retro(active)?[\s-]*date\b/i],
];
// Short "Label : value" pairs that can sit anywhere on a line.
const INLINE = [
  ["Add on cover", /^add[\s-]*on\s*covers?\s*:/i], ["Clauses", /^clauses?\s*:/i], ["Terms of cover", /^terms\s*of\s*cover\s*:/i],
  ["Basis of valuation", /^basis\s*of\s*valuation\s*:/i], ["Packing details", /^packing\s*details\s*:/i], ["Marks and numbers", /^marks\s*&?\s*(and\s*)?numbers\s*:/i],
  ["LR / RR / AWB / BL number", /^(lr|rr|awb|bl)\s*\/.*number\s*:/i], ["Mode of conveyance", /^mode\s*of\s*conveyance\s*:/i], ["Conveyance name", /^conveyance\s*name\s*:/i],
  ["Voyage type", /^voyage\s*type\s*:/i], ["Consignee", /^consignee(\s*name)?(\s*&\s*address)?\s*:/i], ["Settling agent", /^settling\s*agent\s*:/i],
  ["Claims representative", /^claims\s*representative\s*:/i], ["Co-payment", /^co-?payment\b.*:/i], ["Intermediary", /^intermediary\s*name\s*:/i],
  ["Number of locations", /^number\s*of\s*locations\s*:/i], ["Debris removal", /^debris\s*removal\s*:/i], ["Remarks", /^remarks\s*:/i],
];
const STOP = new RegExp(HEADED.map((h) => h[1].source).join("|") + /|^this\s+policy|^premium\b|^in\s+witness|^page\s+\d|^deductibles?$/.source, "i");

export function otherDetails(lines) {
  const out = [];
  const add = (label, value, ref) => {
    const v = String(value).replace(/\s+/g, " ").replace(/^[\s:\-]+/, "").trim();
    if (!isNone(v) && !out.some((x) => x.label === label && x.value === v)) out.push({ label, value: v.slice(0, 400), ref });
  };
  const money = (s) => s.replace(/`\s*(?=\d)/g, "₹ ");
  lines.forEach((l, i) => {
    if (l.marker) return;
    // Extensions table: name, sub limit, deductible, with names that may wrap onto the next line.
    if (/name\s*of\s*the\s*extension/i.test(l.text)) {
      let cur = null;
      for (let j = i + 1; j < Math.min(lines.length, i + 40); j++) {
        const r = lines[j];
        if (r.marker || STOP.test(r.text.trim())) break;
        const segs = r.segs || [];
        if (segs.length >= 2) {
          if (cur) add(`Extension: ${cur.name}`, cur.detail, cur.ref);
          cur = { name: segs[0].s, detail: [segs[1] && `Sub limit ${money(segs[1].s)}`, segs[2] && `Deductible ${money(segs[2].s)}`].filter(Boolean).join(", "), ref: j + 1 };
        } else if (cur && segs.length === 1) cur.name += ` ${segs[0].s}`;
        else break;
      }
      if (cur) add(`Extension: ${cur.name}`, cur.detail, cur.ref);
      return;
    }
    (l.segs || []).forEach((seg, k) => {
      const hit = INLINE.find(([, re]) => re.test(seg.s));
      if (!hit) return;
      const v = seg.s.replace(hit[1], "").trim() || l.segs[k + 1]?.s || "";
      add(hit[0], v, i + 1);
    });
    const first = (l.segs && l.segs[0]?.s) || l.text;
    const h = HEADED.find(([, re]) => re.test(first));
    if (!h) return;
    const re = h[1];
    let val = first.replace(re, "").replace(/^[\s:\-]+/, "");
    if (l.segs && l.segs.length > 1) val = [val, ...l.segs.slice(1).map((s) => s.s)].filter(Boolean).join(" ");
    // A value can run on to lines of its own, until the next heading.
    for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
      const r = lines[j];
      if (r.marker || (r.segs || []).length !== 1 || STOP.test(r.text.trim()) || /:\s/.test(r.text) || isNone(r.text)) break;
      val += ` ${r.text}`;
    }
    add(h[0], val, i + 1);
  });
  return out;
}

// ---- A date typed or pasted by hand. Day first, because Indian policies almost always are.
export function parseDateText(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const digits = s.match(/^(\d{2})(\d{2})(\d{2}|\d{4})$/);
  const d = findDates(digits ? `${digits[1]}/${digits[2]}/${digits[3]}` : s);
  if (d.length) {
    const iso = d[0].iso;
    const [y, m, dd] = iso.split("-");
    return { iso, ambiguous: !!d[0].ambiguous, swapped: d[0].ambiguous ? `${y}-${dd}-${m}` : null };
  }
  // 08/14/2026 can only be month first.
  const us = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/);
  if (us && +us[1] <= 12 && +us[2] > 12) {
    const alt = findDates(`${us[2]}/${us[1]}/${us[3]}`);
    if (alt.length) return { iso: alt[0].iso, ambiguous: false, swapped: null, monthFirst: true };
  }
  return null;
}

// ---- The client's address and city. Every address block on the first pages is a candidate; blocks beside an
// agent, broker or issuing office are not. The usable block nearest the insured's name wins.
export function clientPlace(lines, nameRef, cities, areas) {
  const flat = (s) => s.replace(/\b((?:[A-Za-z] ){2,}[A-Za-z])\b/g, (m) => m.replace(/ /g, "")); // "M U M B A I"
  const insurerish = /issuing|insurer|insurance\s*(co|company|ltd|limited)|general\s*insurance|assurance|regd|toll\s*free|broker|service\s*provider/i;
  const firstSeg = (l) => (l?.segs && l.segs[0]?.s) || l?.text || "";
  const nearOffice = (i) => [i, i - 1, i - 2, i - 3].some((k) => /agent|broker|issuing|insurer|office/i.test(firstSeg(lines[k])));
  const block = (start) => {
    const parts = [];
    for (let j = start; j < Math.min(lines.length, start + 9); j++) {
      const l = lines[j];
      if (l.marker) break;
      let t = firstSeg(l);
      if (j === start && /address/i.test(t)) t = t.replace(/^.*?address(\s*of(\s*the)?(\s*(policy|assured|insured|proposer))?)?\s*[:\-]?\s*/i, "") || (l.segs && l.segs[1]?.s) || "";
      else if (/^[A-Za-z][A-Za-z .\/&'-]{1,28}\s*:/.test(t) || /^(phone|mobile|tel|e-?mail|pan\b|gstin|policy|period|premium|customer\s*id|occupation|contact|previous|holder|street\s*and)/i.test(t)) { if (parts.length) break; continue; }
      if (insurerish.test(t) || t.length > 90) break;
      t = flat(t).replace(/\s*\(GSTIN.*$/i, "").replace(/gstin\/uin\.?/i, "").replace(/^[\s:,]+|[\s:,]+$/g, "").trim();
      if (t && !/^address$/i.test(t)) parts.push(t);
    }
    let lastGood = -1;
    parts.forEach((p, i) => { if (/\b\d{3}\s?\d{3}\b/.test(p) || cities.some((c) => new RegExp("\\b" + c + "\\b", "i").test(p))) lastGood = i; });
    const text = (lastGood >= 0 ? parts.slice(0, lastGood + 1) : parts).join(", ").replace(/^[,\s]+|[,\s]+$/g, "");
    if (!text || !/\d/.test(text) || /person in respect|complaints|zip code|admission|practitioner/i.test(text)) return null;
    const low = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
    const at = (c) => low.lastIndexOf(` ${c.toLowerCase()} `);
    let city = cities.map((c) => [c, at(c)]).filter((x) => x[1] >= 0).sort((a, b) => (b[1] + b[0].length) - (a[1] + a[0].length) || b[0].length - a[0].length)[0]?.[0] || "";
    if (!city && areas?.some((a) => at(a) >= 0)) city = "Mumbai";
    if (!city) city = (text.match(/([A-Za-z][A-Za-z ]{2,30}?)\s*[-,]?\s*\d{3}\s?\d{3}\b/)?.[1] || "").trim().split(/\s*,\s*/).pop();
    return city ? { address: text.slice(0, 200), city, ref: start + 1 } : null;
  };
  const starts = [];
  lines.slice(0, 160).forEach((l, i) => { if (!l.marker && l.text.length < 130 && /\baddress\b/i.test(firstSeg(l)) && !nearOffice(i)) starts.push(i); });
  if (nameRef) starts.push(nameRef);
  const near = (i) => (nameRef ? Math.abs(i - nameRef) + (i < nameRef - 1 ? 20 : 0) : i);
  starts.sort((a, b) => near(a) - near(b));
  for (const s of starts) { const r = block(s); if (r) return r; }
  return null;
}

// ---- An instalment table on the policy: No., due date, premium, GST, stamp duty, instalment amount.
// Works on plain lines of text, so it can also read a document already saved in the records.
// A scan can read "Inst." as "lnst." or "1nst.", and table borders as "|", so both are allowed for.
export function instalmentTable(lines) {
  const text = lines.map((l) => (typeof l === "string" ? l : l.marker ? "" : l.text).replace(/\s*[|]\s*/g, "    "));
  for (let i = 0; i < text.length; i++) {
    if (!/(?:^|[^a-z])[il1]nst(al?l?ments?)?\.?\s*(no|#)/i.test(text[i]) || !/\bdue\b/i.test(text[i])) continue;
    const hasGst = /\b(gst|tax)\b/i.test(text[i]), hasStamp = /\bstamp\b/i.test(text[i]);
    const rows = [];
    for (let j = i + 1; j < Math.min(text.length, i + 40); j++) {
      const m = text[j].match(/^\W*(\d{1,2})\W+(\d{1,2}\s?[\/\-.]\s?(?:\d{1,2}|[A-Za-z]{3})\s?[\/\-.]\s?\d{2,4})\s+(.*)$/);
      if (!m) { if (rows.length) break; continue; }
      const due = findDates(m[2])[0];
      const nums = (m[3].match(/\d[\d,]*(?:\.\d+)?/g) || []).map((x) => +x.replace(/,/g, ""));
      if (!due || nums.length < 2) { if (rows.length) break; continue; }
      const total = nums[nums.length - 1], premium = nums[0];
      const gst = hasGst && nums.length >= 3 ? nums[1] : 0;
      const stamp = hasStamp && nums.length >= 4 ? nums[2] : 0;
      rows.push({ no: +m[1], due: due.iso, amount: premium, taxPct: premium ? Math.round((gst / premium) * 10000) / 100 : 0, stampDuty: stamp, gst, total, adds: Math.abs(premium + gst + stamp - total) <= 2 });
    }
    if (rows.length >= 2 && rows.every((r, k) => r.no === k + 1)) return { rows, ref: i + 1, adds: rows.every((r) => r.adds) };
  }
  return null;
}

// ---- Shared helpers for the readers below. Each reader fills a key only when the document prints it.
const segsOf = (l) => (l.segs && l.segs.length ? l.segs : [{ s: l.text, x: 0 }]);
const field = (v, ref, conf = "high", note) => ({ v, ref, conf, ...(note ? { note } : {}) });
// Words that make a line part of the policy wording rather than a schedule entry.
const WORDING = /\b(shall|will\s+(?:be|not|pay)|herein|hereunder|hereby|provided\s+that|whereas|in\s+the\s+event)\b/i;
const tidy = (s) => String(s).replace(/`\s*(?=\d)/g, "₹ ").replace(/\s+/g, " ").replace(/^[\s:\-–.,]+|[\s:\-–,;]+$/g, "").trim();
const money = (s, min = 1000) => findAmounts(s).find((a) => a.v >= min) || null;
const EMPTY_VALUE = /^(na|n\/a|nil|none|not\s+applicable|-+|\.|as\s+per\b.*|to\s+be\s+(declared|advised|agreed).*|tba|tbd|various|attached)$/i;

// The value after a label: the rest of its own cell after a colon, else the next cell on the line.
function labelled(lines, re, { colon = true } = {}) {
  const out = [];
  lines.forEach((l, i) => {
    if (l.marker) return;
    const segs = segsOf(l);
    segs.forEach((seg, k) => {
      const m = seg.s.match(re);
      if (!m || m.index !== 0) return;
      const rest = seg.s.slice(m[0].length);
      const hasColon = /^\s*[:\-–=]/.test(rest);
      if (colon && !hasColon && rest.trim()) return;
      let v = tidy(rest);
      if (!v && segs[k + 1]) v = tidy(segs[k + 1].s);
      if (!v && !colon) return;
      if (v) out.push({ v, ref: i + 1, line: i, k });
    });
  });
  return out;
}

// ---- Liability policies: limit any one accident (AOA), any one year (AOY), retroactive and continuity
// dates, the deductible as printed, and whether cover is on a claims made basis.
const AOA_RE = /any\s*one\s*(accident|claim|occurrence|event|loss)|\bAOA\b|\bper\s*(claim|occurrence|accident)\b/i;
const AOY_RE = /any\s*one\s*(year|period)|\bAOY\b|in\s*the\s*aggregate|aggregate\s*limit|annual\s*aggregate|limit\s*in\s*the\s*aggregate/i;
const LIMIT_WORD = /limit|indemnity|liability|\bAOA\b|\bAOY\b/i;
const NOT_LIMIT = /sub[\s-]*limit|deductible|excess|retention|ratio|%|premium|\brate\b|per\s*(person|employee|vessel|member|workman)|turnover|wages|sub\s*limited/i;
const RETRO_RE = /\bretro(?:active)?[\s-]*dates?\b|\bretroactive\b/i;
const dateAfter = (s, re) => { const m = s.match(re); return m ? findDates(s.slice(m.index + m[0].length))[0] || null : null; };

export function liabilityDetails(lines, sch = null) {
  const out = {};
  // Limits printed as a small table: "Any One Accident (AOA)  Any One Year (AOY)" with the figures below.
  for (let i = 0; i < lines.length && !out.aoaLimit; i++) {
    const l = lines[i];
    if (l.marker || findAmounts(l.text).length) continue;
    const segs = segsOf(l);
    const ha = segs.find((s) => AOA_RE.test(s.s) && !/ratio|:\s*AOY/i.test(s.s)), hy = segs.find((s) => AOY_RE.test(s.s) && !/ratio|AOA\s*:/i.test(s.s));
    if (!ha || !hy || ha === hy) continue;
    const next = lines[i + 1];
    if (!next || next.marker) continue;
    const ns = segsOf(next);
    const vals = ns.map((s) => money(s.s)).filter(Boolean);
    if (vals.length < 2 || vals.length > 4) continue;
    const under = (h) => ns.find((s) => money(s.s) && (s.x2 ?? s.x + 1) > h.x - 10 && s.x < (h.x2 ?? h.x + 200) + 10);
    const a = (ha.x2 != null && under(ha)) ? money(under(ha).s) : vals[0];
    const y = (hy.x2 != null && under(hy)) ? money(under(hy).s) : vals[1];
    if (a) out.aoaLimit = field(a.v, i + 2, "high", "Read from the cell below the label");
    if (y) out.aoyLimit = field(y.v, i + 2, "high", "Read from the cell below the label");
  }
  // Limits written on one line: "Limit of Indemnity Any One Accident: Rs. 50,00,000".
  const hits = { aoaLimit: [], aoyLimit: [] };
  lines.forEach((l, i) => {
    if (l.marker || l.text.length > 170 || WORDING.test(l.text)) return;
    const t = l.text;
    if (!LIMIT_WORD.test(t) || NOT_LIMIT.test(t)) return;
    const a = money(t);
    if (!a) return;
    // The limit is labelled before its figure: "Limit of liability USD 15,000,000 any one accident".
    const at = t.search(/(?:₹|`|rs\.?|inr|usd|us\$|\$)?\s*(?:\d{1,3}(?:,\d{2,3})+|\d{4,})/i);
    if (at < 0 || !LIMIT_WORD.test(t.slice(0, at))) return;
    if (AOA_RE.test(t)) hits.aoaLimit.push({ v: a.v, ref: i + 1 });
    if (AOY_RE.test(t)) hits.aoyLimit.push({ v: a.v, ref: i + 1 });
  });
  for (const k of ["aoaLimit", "aoyLimit"]) {
    if (out[k] || !hits[k].length) continue;
    const first = hits[k][0];
    const other = hits[k].find((h) => h.v !== first.v);
    out[k] = field(first.v, first.ref, other ? "low" : "high", other ? `The policy shows more than one limit (lines ${first.ref} and ${other.ref}). The first one was used.` : undefined);
  }
  if (sch) {
    out.aoaLimit = field(sch.aoa, sch.ref);
    out.aoyLimit = field(sch.aoy, sch.ref);
  }
  // Retroactive date and continuity date: on the label's line, or on the line just below a label on its own.
  const dated = (re, key) => {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.marker || !re.test(l.text) || /retrospective/i.test(l.text.match(re)?.[0] || "")) continue;
      const d = dateAfter(l.text, re);
      if (d && !WORDING.test(l.text)) return field(d.iso, i + 1, d.ambiguous ? "low" : "high", d.ambiguous ? "Read as day/month/year." : undefined);
      if (d || WORDING.test(l.text) || l.text.length > 90) continue;
      for (const j of [i + 1, i + 2]) {
        const n = lines[j];
        if (!n || n.marker || WORDING.test(n.text) || n.text.length > 90) break;
        const nd = findDates(n.text)[0];
        if (nd) return field(nd.iso, j + 1, "low", `Read from the line under the ${key === "retroDate" ? "retroactive date" : "continuity date"} label. Check it.`);
      }
    }
    return null;
  };
  const retro = sch ? (() => { const d = findDates(sch.retro)[0]; return d ? field(d.iso, sch.ref) : null; })() : dated(RETRO_RE, "retroDate");
  if (retro) out.retroDate = retro;
  const cont = dated(/\bcontinuity\s*dates?\b/i, "continuityDate");
  if (cont) out.continuityDate = cont;
  // Claims made basis: said in so many words, never inferred.
  const cm = lines.findIndex((l) => !l.marker && /\bclaims?[\s-]*made(\s+and(\s+first)?\s+reported)?\s*(basis|policy|form|cover|wording)\b|\bpolicy\s*basis\s*:?\s*claims?[\s-]*made\b/i.test(l.text));
  if (cm >= 0) out.claimsMade = field("Yes", cm + 1, "high", "The policy says cover is on a claims made basis.");
  // The deductible as printed, only on a policy that reads as a liability policy.
  if (out.aoaLimit || out.aoyLimit || out.retroDate || out.claimsMade) {
    if (sch) out.deductible = field(String(sch.deductible), sch.ref);
    else {
      const DED = /^(?:policy\s+)?(?:deductibles?|retentions?|excess)(?:\s*\(s\))?(?![\s:]*(?:limit|layer|of\s+(?:the\s+)?(?:limit|policy)))/i;
      for (let i = 0; i < lines.length && !out.deductible; i++) {
        const l = lines[i];
        if (l.marker || WORDING.test(l.text)) continue;
        const segs = segsOf(l);
        const k = segs.findIndex((s) => DED.test(s.s) && !/voluntary|discount|sub[\s-]*limit|of\s+the\s+extension/i.test(s.s));
        if (k < 0) continue;
        const own = tidy(segs[k].s.replace(DED, ""));
        let v = tidy([own, ...segs.slice(k + 1).map((s) => s.s)].filter(Boolean).join(" ")), ref = i + 1;
        if (!v && segs.length === 1 && lines[i + 1] && !lines[i + 1].marker && lines[i + 1].text.length < 140) { v = tidy(lines[i + 1].text); ref = i + 2; }
        if (!v || !/\d/.test(v) || EMPTY_VALUE.test(v)) continue;
        const more = [ref, ref + 1, ref + 2, ref + 3].map((r) => lines[r]).filter((x) => x && !x.marker).some((x) => findAmounts(x.text).length && !DED.test(segsOf(x)[0].s) && !/premium|gst|tax/i.test(x.text));
        out.deductible = field(v.slice(0, 160), ref, more ? "low" : "high", more ? "More than one deductible or retention is printed. The first one is shown." : undefined);
      }
    }
  }
  return out;
}

// ---- Marine cargo: voyage from and to, what is insured, the basis of valuation and the loss payee.
const COMMODITY = /^(?:interest\s*insured|interest|subject[\s-]*matter(?:\s*insured)?|commodity|description\s*of\s*(?:the\s*)?(?:goods|cargo)|goods\s*insured|cargo\s*description)\b/i;
const VALUATION = /^(?:basis\s*of\s*valuation|valuation\s*basis|basis\s*of\s*value|valuation)\b/i;
const LOSS_PAYEE = /^(?:loss\s*payee|mortgagee|hypothecat(?:ed|ion)(?:\s*(?:to|with))?|financier)\b/i;
const placeOk = (s) => s && /[A-Za-z]{3}/.test(s) && !findDates(s).length && !/\d{1,2}[.:]\d{2}\b|\b(gmt|hours|a\.m\.|p\.m\.)\b/i.test(s) && s.length <= 90;

export function marineDetails(lines) {
  const out = {};
  // Only on a marine document: "commodity" or "loss payee" printed on a fire policy belongs to other fields.
  const head = lines.filter((l) => !l.marker).slice(0, 120).map((l) => l.text).join(" ");
  if (!/\bmarine\b|\bcargo\b|\bvoyage\b|bill\s*of\s*lading|institute\s*cargo/i.test(head)) return out;
  // "From : JNPT, INDIA    To : JEDDAH" as two cells on one line.
  for (let i = 0; i < lines.length && !out.voyageFrom; i++) {
    const l = lines[i];
    if (l.marker) continue;
    const segs = segsOf(l);
    const f = segs.findIndex((s) => /^(?:voyage\s*)?from\s*[:\-–]\s*\S/i.test(s.s));
    const t = segs.findIndex((s, k) => k > f && /^to\s*[:\-–]\s*\S/i.test(s.s));
    if (f < 0 || t < 0) continue;
    const a = tidy(segs[f].s.replace(/^(?:voyage\s*)?from\s*[:\-–]/i, "")), b = tidy(segs[t].s.replace(/^to\s*[:\-–]/i, ""));
    if (placeOk(a) && placeOk(b)) { out.voyageFrom = field(a, i + 1); out.voyageTo = field(b, i + 1); }
  }
  // "Voyage: From Mumbai To Jebel Ali", or a territorial limit written as a voyage.
  for (let i = 0; i < lines.length && !out.voyageFrom; i++) {
    const l = lines[i];
    if (l.marker) continue;
    const m = l.text.replace(/\s{2,}/g, " ").match(/^(?:\d+[.)]\s*)?(voyage|transit|journey|sailing|territorial\s*limits?)\s*[:\-–]?\s*from\s*[:\-–]?\s+(.+?)\s+to\s*[:\-–]?\s+(.+?)\s*$/i);
    if (!m) continue;
    let to = m[3];
    const n = lines[i + 1];
    if (n && !n.marker && segsOf(n).length === 1 && n.text.length < 40 && !/:/.test(n.text) && /\.$/.test(n.text.trim()) && !/[.]$/.test(to)) to += " " + n.text.trim();
    const a = tidy(m[2]), b = tidy(to.replace(/\.$/, ""));
    if (!placeOk(a) || !placeOk(b)) continue;
    const loose = /territorial/i.test(m[1]);
    out.voyageFrom = field(a, i + 1, loose ? "low" : "high", loose ? "Read from the territorial limit. Check it is the voyage." : undefined);
    out.voyageTo = field(b, i + 1, loose ? "low" : "high", loose ? "Read from the territorial limit. Check it is the voyage." : undefined);
  }
  const first = (re, bad) => labelled(lines, re).find((c) => !EMPTY_VALUE.test(c.v) && /[A-Za-z]{2}/.test(c.v) && !(bad && bad.test(c.v)));
  const com = first(COMMODITY, /h\s*&\s*m\b|hull|freight|increased\s*value|disburse|machinery\s*and|liabilit|amount|sum\s*insured|rupees|^\d|%/i);
  if (com) out.commodity = field(com.v.slice(0, 140), com.ref);
  const val = first(VALUATION);
  if (val) out.valuationBasis = field(val.v.slice(0, 80), val.ref);
  const lp = first(LOSS_PAYEE);
  if (lp) out.lossPayee = field(lp.v.slice(0, 120), lp.ref);
  return out;
}

// ---- Engineering projects: the contract value and the principal (employer or owner of the project).
const CONTRACT_VALUE = /\b(?:total\s*)?(?:contract\s*(?:value|price|amount|sum)|value\s*of\s*(?:the\s*)?contract|project\s*(?:value|cost)|estimated\s*(?:final\s*)?(?:completed\s*)?(?:contract\s*)?value)\b/i;
const PRINCIPAL = /^(?:name\s*of\s*(?:the\s*)?)?(?:principal|employer|project\s*owner|owner\s*of\s*(?:the\s*)?project)(?:\s*name)?\b/i;
const orgName = (s) => { const v = tidy(String(s).replace(/^\(?[a-z]{1,3}\)\s*/i, "").replace(/^m\/s\.?\s*/i, "")); return /[A-Za-z]{3}/.test(v) && v.split(/\s+/).length <= 12 && v.length <= 100 ? v : null; };

export function projectDetails(lines) {
  const out = {};
  const text = lines.filter((l) => !l.marker).map((l) => l.text).join(" ");
  if (!/\b(project|construction|erection|contract\s*works|contractors?)\b/i.test(text)) return out;
  lines.forEach((l, i) => {
    if (out.contractValue || l.marker || WORDING.test(l.text) || l.text.length > 170) return;
    const m = l.text.match(CONTRACT_VALUE);
    if (!m) return;
    const a = money(l.text.slice(m.index + m[0].length));
    if (a) out.contractValue = field(a.v, i + 1);
  });
  const lab = labelled(lines, PRINCIPAL).map((c) => ({ ...c, v: orgName(c.v) })).find((c) => c.v && !EMPTY_VALUE.test(c.v));
  if (lab) out.principal = field(lab.v, lab.ref);
  else {
    // Wording such as "M/s Example Corporation Limited as the principal and ... as the main contractor".
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.marker) continue;
      for (const seg of segsOf(l)) {
        const m = seg.s.match(/\bm\/s\.?\s+([A-Za-z][A-Za-z&.,'\- ]{3,90}?)\s+as\s+(?:the\s+)?principal\b/i);
        const v = m && orgName(m[1]);
        if (v && !/\b(insured|assured|policy|company\s+shall)\b/i.test(v)) { out.principal = field(v, i + 1, "low", "Read from the policy wording that names the principal. Check it."); return out; }
      }
    }
  }
  return out;
}

// ---- Vessels named on hull, P&I and charterers documents: name, IMO number and gross tonnage.
const VESSEL_DOC = /\bhull\b|\bh\s*&\s*m\b|\bp\s*&\s*i\b|protection\s*(?:and|&)\s*indemnity|charterer|inland\s*vessels?|shipowner|insured\s*vessel/i;
const CARGO_DOC = /marine\s*cargo|cargo\s*(?:insurance|policy)|institute\s*cargo\s*clauses/i;
const IMO_RE = /\bIMO\s*(?:no\.?|number|#)?\s*[:\-.]?\s*(\d{7})\b/i;
const GT_RE = /\b(?:GRT|GT|G\.T\.?)\s*[:\-.]?\s*(\d[\d,]*(?:\.\d+)?)\b|\bgross\s*(?:registered\s*)?tonnage\s*[:\-.]?\s*(\d[\d,]*(?:\.\d+)?)\b/;
const VESSEL_INLINE = /\b(?:name\s*of\s*(?:the\s*)?(?:vessel|ship)|vessel(?:['’]?s)?\s*name|ship\s*name|vessel)\s*[:\-–]\s*/i;
const NOT_VESSEL = /^(as\s*per|all\b|any\b|to\s*be|tba|tbd|n\.?a\.?$|nil$|various|attached|declared|vessels?\b)/i;
const cutName = (s) => s.split(/\s{2,}|\s*[,;(]\s*|\s+(?=\b(?:IMO|YOB|GRT|GT|G\.T|built|flag|year)\b)/i)[0].replace(/[.\s]+$/, "").trim();

export function vesselList(lines) {
  const body = lines.filter((l) => !l.marker);
  const head = body.slice(0, 150).map((l) => l.text).join(" ");
  if (!VESSEL_DOC.test(head) || CARGO_DOC.test(head)) return [];
  const found = [];
  const add = (name, i) => {
    name = cutName(name);
    if (!name || NOT_VESSEL.test(name) || !/[A-Za-z]{2}/.test(name) || name.length > 40 || found.some((v) => v.name.toLowerCase() === name.toLowerCase())) return;
    // IMO number and tonnage: on the same line after the name, or in the few lines below it.
    const v = { name, ref: i + 1 };
    for (let j = i; j < Math.min(lines.length, i + 9); j++) {
      const l = lines[j];
      if (!l || l.marker || (j > i && VESSEL_INLINE.test(l.text))) break;
      const t = l.text;
      if (!v.imo) { const m = t.match(IMO_RE); if (m) v.imo = m[1]; }
      if (!v.gt) { const m = t.match(GT_RE); if (m) v.gt = (m[1] || m[2]).replace(/,/g, ""); }
    }
    found.push(v);
  };
  // A table of vessels: a name column and an IMO column, one vessel per row.
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.marker || !l.segs || l.segs.length < 2) continue;
    const hn = l.segs.find((s) => /^(?:name\s*of\s*(?:the\s*)?(?:vessel|ship)|vessel(?:['’]?s)?\s*name|vessel|ship\s*name)$/i.test(s.s.trim()));
    const hi = l.segs.find((s) => /^IMO(\s*(no\.?|number))?$/i.test(s.s.trim()));
    if (!hn || !hi) continue;
    const hg = l.segs.find((s) => /^(GRT|GT|gross\s*tonnage)$/i.test(s.s.trim()));
    const col = (segs, h) => segs.find((s) => Math.abs(s.x - h.x) < 25);
    for (let j = i + 1; j < Math.min(lines.length, i + 40); j++) {
      const r = lines[j];
      if (r.marker || !r.segs) break;
      const imo = col(r.segs, hi), nm = col(r.segs, hn);
      if (!imo || !/^\d{7}$/.test(imo.s.trim()) || !nm) break;
      const gt = hg && col(r.segs, hg);
      const name = cutName(nm.s);
      if (name && !found.some((v) => v.name === name)) found.push({ name, imo: imo.s.trim(), ...(gt && /^\d[\d,.]*$/.test(gt.s.trim()) ? { gt: gt.s.trim().replace(/,/g, "") } : {}), ref: j + 1 });
    }
    if (found.length) return found;
  }
  // "Vessel Name: MV Example Star  IMO No. 9000001", or "Vessel:KB-" with the name running onto the next line.
  lines.forEach((l, i) => {
    if (l.marker) return;
    const m = l.text.match(VESSEL_INLINE);
    if (!m) return;
    let rest = l.text.slice(m.index + m[0].length);
    if (/^\S+-$/.test(rest.trim()) && lines[i + 1] && !lines[i + 1].marker) rest = rest.trim() + lines[i + 1].text.trim().split(/[\s,;(]/)[0];
    add(rest, i);
  });
  // A block of particulars under a heading: "Insured object(s)" then "Name  AQUA STAR".
  lines.forEach((l, i) => {
    if (l.marker || !/^(insured\s*objects?(\s*\(s\))?|vessel\s*details|particulars\s*of\s*(the\s*)?(vessel|ship)|insured\s*vessels?)\s*:?$/i.test(l.text.trim())) return;
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const segs = segsOf(lines[j]);
      if (/^name$/i.test(segs[0].s.trim()) && segs[1]) { add(segs[1].s, j); break; }
      const m = segs[0].s.match(/^name\s*[:\-–]\s*(.+)$/i);
      if (m) { add(m[1], j); break; }
    }
  });
  return found;
}

// ---- The risk address set out as a table column ("Location Address with Pin Code") on fire and similar
// schedules: the first row's address, which can wrap over several lines, ends at its PIN code.
const ADDR_COL = /^(?:risk\s*)?location\s*address|^risk\s*(?:location|address)|^address\s*of\s*(?:the\s*)?(?:risk|premises|location)|^premises\s*address|^situation\s*of\s*risk/i;
export function riskAddressTable(lines) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.marker || !l.segs || l.segs.length < 3) continue;
    const h = l.segs.find((s) => ADDR_COL.test(s.s) && !/:\s*\S/.test(s.s));
    if (!h) continue;
    const x2 = h.x2 ?? h.x + h.s.length * 5;
    const inCol = (s) => s.x >= h.x - 20 && s.x <= x2 && !/^\d{1,2}\.?$/.test(s.s.trim()) && /[A-Za-z]{2}/.test(s.s);
    const rowNo = (r) => r && !r.marker && r.segs && /^\d{1,2}\.?$/.test(r.segs[0]?.s.trim() || "") && r.segs[0].x < h.x;
    let start = -1;
    for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) if (rowNo(lines[j]) && lines[j].segs.some(inCol)) { start = j; break; }
    if (start < 0) continue;
    const parts = [];
    let end = start;
    for (let j = start; j < Math.min(lines.length, start + 9); j++) {
      const r = lines[j];
      if (r.marker || (j > start && rowNo(r))) break;
      const seg = (r.segs || []).find(inCol);
      if (!seg) break;
      parts.push(seg.s.trim());
      end = j;
      if (/\b\d{3}\s?\d{3}\b/.test(seg.s)) break;
    }
    const v = tidy(parts.join(" ").replace(/\s*,\s*/g, ", ").replace(/,(\s*,)+/g, ","));
    if (!/\b\d{3}\s?\d{3}\b/.test(v) || v.length < 12) continue;
    const more = lines.slice(end + 1, end + 30).some((r) => rowNo(r) && r.segs[0].s.trim().replace(".", "") === "2" && r.segs.some(inCol));
    return field(v.slice(0, 200), start + 1, more ? "low" : "high", more ? "The policy lists more than one location. The first one is shown." : "Read from the location table.");
  }
  return null;
}

// ---- The kind of policy when the document names an engineering project cover in its heading, which the
// type names alone do not match ("Offshore Construction Project Policy" is a contractor's all risks cover).
export function engineeringType(lines) {
  const heads = lines.filter((l) => !l.marker).slice(0, 160).flatMap((l) => segsOf(l).map((s) => s.s.trim()));
  if (heads.some((s) => /^erection\s+all\s+risks?\b/i.test(s))) return { type: "Erection All Risk Insurance", dept: "Engineering" };
  if (heads.some((s) => /^(?:offshore\s+)?construction\s+(?:project\s+policy|all\s+risks?)\b|^contractors?['’]?\s+all\s+risks?\b|^WELCAR\b/i.test(s))) return { type: "Contractor All Risk Insurance", dept: "Engineering" };
  return null;
}
