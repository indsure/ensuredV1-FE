// Readers that work across a whole document rather than one label: premium figures matched by arithmetic,
// the client's GSTIN, liability schedules, "other details", and dates pasted by hand.
import { findAmounts, findDates } from "./extract.js";

const amounts = (s) => findAmounts(s).map((a) => a.v);
const close = (a, b, tol = 2) => Math.abs(a - b) <= tol;
const NOT_PREMIUM = /\b(paid|wages|past|previous|additional|deposit|refund|minimum|rate|lives|no\.?\s*of|gstin|sum\s*insured|in\s*words|received|cheque)\b/i;

// ---- Premium. Gross premium + GST = net premium, the final amount paid. Policies use these words in opposite
// ways ("Net Premium" before tax on one, "Gross Premium" before tax on another), so the figures decide, not the words.
export function premiumFigures(lines, preCands = [], postCands = [], gstCands = []) {
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
    const text = parts.join(", ").replace(/^[,\s]+|[,\s]+$/g, "");
    if (!text || !/\d/.test(text) || /person in respect|complaints|zip code|admission|practitioner/i.test(text)) return null;
    const low = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
    const at = (c) => low.lastIndexOf(` ${c.toLowerCase()} `);
    let city = cities.map((c) => [c, at(c)]).filter((x) => x[1] >= 0).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
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
