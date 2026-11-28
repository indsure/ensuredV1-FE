// Member register for group health and group personal accident policies: who is covered on a policy year,
// additions and deletions as endorsements, the cash deposit (CD) balance, imports from Excel or the policy document.
// Everything lives on the term: term.members, term.memberChanges, term.cdBalance. Old terms have none of these.
import { useState, useMemo } from "react";
import { TODAY, fixtureById } from "./data.js";
import { fmtDate, fmtStamp, fmtMoney, isNum, r2, nowIso, plural } from "./lib.js";
import { findAmounts } from "./extract.js";
import { docText } from "./store.js";
import { useApp, Pill, Card, Empty, Btn, Labeled, Select, Modal, Table, KV, DateInput, MoneyInput } from "./ui.jsx";

export const RELATIONS = ["Self", "Spouse", "Son", "Daughter", "Father", "Mother", "Other"];
export const GENDERS = ["Male", "Female", "Other"];
const GROUP_DEPTS = ["Health", "Personal Accident"];

/** True for group health and group personal accident covers, the ones that carry a member list. */
export function isGroupPolicy(p, term) {
  if (!p) return false;
  const type = String(p.type || "");
  const healthOrPa = GROUP_DEPTS.includes(p.dept) || /personal\s*accident|mediclaim|health/i.test(type);
  if (!healthOrPa) return false;
  return /\bgroup\b/i.test(type) || p.cover === "Group" || (Array.isArray(term?.members) && term.members.length > 0);
}

// ---------------------------------------------------------------- small pure helpers
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const normHead = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const titleCase = (s) => clean(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

/** A member's relation in the register's words: "Wife" becomes Spouse, "Employee" becomes Self. */
export function normRelation(raw) {
  const s = clean(raw).toLowerCase().replace(/[^a-z\- ]/g, "").trim();
  if (!s) return "";
  if (/^(self|employee|emp|member|primary|primary member|insured|principal|proposer)$/.test(s)) return "Self";
  if (/^(spouse|wife|husband|partner)$/.test(s)) return "Spouse";
  if (/^(son|daughter|father|mother)$/.test(s)) return titleCase(s);
  if (/^(child|kid|dependent child|dependant child)$/.test(s)) return "Child";
  return titleCase(raw);
}
export function normGender(raw) {
  const s = clean(raw).toLowerCase();
  if (!s) return "";
  if (/^(m|male|man)$/.test(s)) return "Male";
  if (/^(f|female|woman)$/.test(s)) return "Female";
  return titleCase(raw);
}

/** A date of birth typed day first: 14/08/1980, 14-08-80, 14 Aug 1980, 1980-08-14, or an Excel day number. */
export function parseDob(raw, today = TODAY) {
  const s = clean(raw);
  if (!s) return null;
  const nowY = +today.slice(0, 4);
  const real = (y, m, d) => {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  };
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return real(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[\/\-. ]+(\d{1,2}|[A-Za-z]{3,9})[\/\-., ]+(\d{2}|\d{4})$/);
  if (m) {
    const mon = /^\d+$/.test(m[2]) ? +m[2] : MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith("sept") ? 4 : 3)];
    let y = +m[3];
    // Two-digit years: a birth year cannot be in the future, so 05 is 2005 and 80 is 1980.
    if (m[3].length === 2) y = y <= nowY % 100 ? 2000 + y : 1900 + y;
    return mon ? real(y, mon, +m[1]) : null;
  }
  // Excel sometimes copies a date as its day number (1 = 01/01/1900).
  if (/^\d{5}$/.test(s) && +s > 7000 && +s < 80000) {
    const dt = new Date(Date.UTC(1899, 11, 30) + +s * 86400000);
    return dt.toISOString().slice(0, 10);
  }
  return null;
}

/** Whole years between a date of birth and a date. */
export function ageOn(dob, on = TODAY) {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number), [Y, M, D] = on.slice(0, 10).split("-").map(Number);
  return Y - y - (M < m || (M === m && D < d) ? 1 : 0);
}
const ageOf = (mb, on = TODAY) => (mb.dob ? ageOn(mb.dob, on) : isNum(mb.age) ? +mb.age : null);

function parseMoney(raw) {
  const s = clean(raw);
  if (!s) return null;
  const a = findAmounts(s);
  if (a.length) return a[0].v;
  const digits = s.replace(/[^\d.]/g, "");
  return digits && isNum(digits) ? +digits : NaN;
}

// ---------------------------------------------------------------- reading pasted rows
// Each field and the column headings that mean it, best match first.
const HEADINGS = [
  ["name", [/^(member|insured|beneficiary|patient|person)s?\s*name$/, /^name\s*of\s*(the\s*)?(member|insured|person|beneficiary|insured person)$/, /^(full\s*)?name$/, /^name\b/, /^(employee|emp|staff)\s*name$/, /\bname\b/]],
  ["empId", [/^(emp|employee|staff)\s*(id|no|number|code)$/, /^(emp|employee|staff)\s*(id|no|code|number)\b/, /\b(emp|employee|staff)\s*(id|no|code|number)\b/, /^(emp|employee)\s*(i d)$/, /^id$/]],
  ["relation", [/^relation(ship)?\b/, /\brelation(ship)?\b/]],
  ["dob", [/^(dob|d o b)$/, /\bdate\s*of\s*birth\b/, /\bbirth\s*date\b/, /\bdob\b/]],
  ["age", [/^age\b/, /\bage\b/]],
  ["gender", [/^(gender|sex)$/, /\b(gender|sex)\b/]],
  ["sumInsured", [/^(sum\s*insured|si|sum\s*assured)\b/, /\bsum\s*(insured|assured)\b/, /^(cover|coverage|si\s*amount|insured\s*amount|amount)\b/]],
  ["nominee", [/^nominee(\s*name)?$/, /\bnominee\b/]],
];
const NOT_NAME = /nominee|father|husband|company|branch|hospital|tpa|insurer|plan/;

/** Matches column headings to the register's fields. Returns { field: column index }. */
export function mapHeadings(cells) {
  const heads = cells.map(normHead);
  const map = {};
  const taken = new Set();
  for (const [field, res] of HEADINGS) {
    for (const re of res) {
      const i = heads.findIndex((h, k) => h && !taken.has(k) && re.test(h) && !(field === "name" && NOT_NAME.test(h)) && !(field === "relation" && /nominee/.test(h)));
      if (i >= 0) { map[field] = i; taken.add(i); break; }
    }
  }
  return map;
}

function splitCsvLine(line, sep) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"' && !cur.trim()) { q = true; cur = ""; }
    else if (c === sep) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** Builds one member row from raw cell text, with its problems (block the import) and warnings (allowed). */
function rowFrom(get, n, today = TODAY) {
  const name = clean(get("name"));
  const dobText = clean(get("dob")), ageText = clean(get("age"));
  let dob = "", age = null;
  const problems = [], warnings = [];
  const readDob = (t) => {
    if (/^\d{1,3}(\.\d+)?$/.test(t) && +t <= 120) { age = Math.floor(+t); return; }
    const iso = parseDob(t, today);
    if (!iso) problems.push(`Date of birth "${t}" is not a date. Use DD/MM/YYYY.`);
    else if (iso > today) problems.push(`Date of birth ${fmtDate(iso)} is in the future.`);
    else dob = iso;
  };
  if (dobText) readDob(dobText);
  if (ageText && !dob && age == null) {
    if (/^\d{1,3}(\.\d+)?$/.test(ageText) && +ageText <= 120) age = Math.floor(+ageText);
    else if (parseDob(ageText, today)) readDob(ageText);
    else problems.push(`Age "${ageText}" is not a number.`);
  }
  const siText = clean(get("sumInsured"));
  let sumInsured = null;
  if (siText) {
    const v = parseMoney(siText);
    if (!Number.isFinite(v) || v < 0) problems.push(`Sum insured "${siText}" is not an amount.`);
    else sumInsured = v;
  }
  if (!name) problems.push("Name is missing.");
  if (name && /^\d+$/.test(name)) problems.push(`Name "${name}" is only numbers.`);
  if (!dob && age == null && !problems.some((x) => /birth|Age/.test(x))) warnings.push("No date of birth or age.");
  if (sumInsured == null && !siText) warnings.push("No sum insured.");
  const relRaw = clean(get("relation"));
  const relation = normRelation(relRaw) || "Self";
  if (!relRaw) warnings.push("No relation given, taken as Self.");
  return { n, empId: clean(get("empId")), name, relation, dob, age, gender: normGender(get("gender")), sumInsured, nominee: clean(get("nominee")), problems, warnings };
}

/**
 * Rows pasted from Excel (tab separated) or a CSV file, with a heading row.
 * Returns { rows, headings, mapped: {field: heading}, unmapped: [heading], error }.
 */
export function parseMemberRows(text, today = TODAY) {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const first = lines.findIndex((l) => l.trim());
  if (first < 0) return { rows: [], headings: [], mapped: {}, unmapped: [], error: "Nothing pasted yet." };
  const head = lines[first];
  const sep = head.includes("\t") ? "\t" : (head.match(/;/g) || []).length > (head.match(/,/g) || []).length ? ";" : ",";
  const split = (l) => (sep === "\t" ? l.split("\t").map((x) => x.trim()) : splitCsvLine(l, sep));
  const headings = split(head);
  const map = mapHeadings(headings);
  const mapped = Object.fromEntries(Object.entries(map).map(([f, i]) => [f, headings[i]]));
  const unmapped = headings.filter((h, i) => h && !Object.values(map).includes(i));
  if (map.name == null) return { rows: [], headings, mapped, unmapped, error: "No name column found. The first row must be the column headings, for example: Employee ID, Name, Relation, Date of birth, Gender, Sum insured, Nominee." };
  const rows = [];
  for (let i = first + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = split(lines[i]);
    if (cells.every((c) => !c)) continue;
    const get = (f) => (map[f] != null ? cells[map[f]] ?? "" : "");
    if (/^(grand\s*)?total\b/i.test(clean(get("name"))) || /^(grand\s*)?total\b/i.test(clean(cells[0]))) continue;
    rows.push(rowFrom(get, i + 1, today));
  }
  return { rows, headings, mapped, unmapped, error: rows.length ? null : "Only the heading row was found. Paste the member rows under it." };
}

// ---------------------------------------------------------------- reading the policy document
const textOf = (l) => (typeof l === "string" ? l : l && !l.marker ? String(l.text || "") : "");
const cellsOf = (l) => {
  if (l && typeof l === "object" && Array.isArray(l.segs) && l.segs.length > 1) return l.segs.map((s) => clean(s.s)).filter(Boolean);
  return textOf(l).split(/\t| {2,}/).map(clean).filter(Boolean);
};
const REL_WORDS = "self|employee|spouse|wife|husband|son|daughter|father|mother|child";
// A row typed with single spaces: [sr] [emp id] name relation dob-or-age [gender] sum-insured [nominee]
const LOOSE_ROW = new RegExp(String.raw`^\s*(?:\d{1,4}[.)]?\s+)?(?:([A-Za-z]{0,5}[\-\/]?\d[\w\/\-]*)\s+)?([A-Za-z][A-Za-z.' ]*?[A-Za-z.])\s+(` + REL_WORDS + String.raw`)\s+(\d{1,2}[\/\-.](?:\d{1,2}|[A-Za-z]{3})[\/\-.]\d{2,4}|\d{1,3})\s+(?:(m|f|male|female)\s+)?((?:rs\.?\s*|₹\s*)?\d[\d,]*(?:\.\d+)?)\s*(.*)$`, "i");
const HEAD_ORDER = ["empId", "name", "relation", "dob", "age", "gender", "sumInsured", "nominee"];
const HEAD_LABEL = { empId: "Employee ID", name: "Name", relation: "Relation", dob: "Date of birth", age: "Age", gender: "Gender", sumInsured: "Sum insured", nominee: "Nominee" };

function isHeading(cells) {
  if (cells.length < 3 || cells.filter((c) => /\d{3,}/.test(c)).length) return null;
  const map = mapHeadings(cells);
  if (map.name == null) return null;
  const others = ["relation", "dob", "age", "sumInsured", "gender", "empId"].filter((f) => map[f] != null).length;
  return others >= 2 ? map : null;
}

/**
 * Finds the member annexure in a document's text lines: a heading row with a name column and at least two of
 * relation, age or DOB, sum insured, gender, employee id, then the rows under it (also after a repeated heading
 * on later pages). Returns { ref, text, rows, count } where text is the table as tab separated rows, or null.
 */
export function findAnnexure(lines, today = TODAY) {
  if (!Array.isArray(lines) || !lines.length) return null;
  const out = [];
  let ref = null;
  for (let i = 0; i < lines.length; i++) {
    const cells = cellsOf(lines[i]);
    const map = isHeading(cells);
    if (!map) continue;
    if (ref == null) ref = i + 1;
    let misses = 0, j = i + 1;
    for (; j < lines.length && misses < 4; j++) {
      const l = lines[j];
      const t = textOf(l);
      if (!t.trim()) continue;
      const c = cellsOf(l);
      if (isHeading(c)) break;
      let row = null;
      if (c.length >= cells.length - 1 && c.length <= cells.length) {
        // Same number of columns as the heading (a blank nominee at the end is fine).
        const get = (f) => (map[f] != null ? c[map[f]] ?? "" : "");
        const nm = clean(get("name"));
        if (nm && /[A-Za-z]/.test(nm) && !/^(grand\s*)?total\b/i.test(nm) && /\d/.test(t)) row = Object.fromEntries(HEAD_ORDER.map((f) => [f, clean(get(f))]));
      }
      if (!row) {
        const m = t.match(LOOSE_ROW);
        if (m) {
          const dobOrAge = m[4];
          row = { empId: m[1] || "", name: clean(m[2]), relation: m[3], dob: /^\d{1,3}$/.test(dobOrAge) ? "" : dobOrAge, age: /^\d{1,3}$/.test(dobOrAge) ? dobOrAge : "", gender: m[5] || "", sumInsured: m[6], nominee: clean(m[7]) };
        }
      }
      if (row) { out.push(row); misses = 0; } else misses++;
    }
    i = j - 1;
  }
  if (!out.length) return null;
  const tsv = [HEAD_ORDER.map((f) => HEAD_LABEL[f]).join("\t"), ...out.map((r) => HEAD_ORDER.map((f) => String(r[f] || "").replace(/\t/g, " ")).join("\t"))].join("\n");
  const parsed = parseMemberRows(tsv, today);
  return { ref, text: tsv, rows: parsed.rows, count: parsed.rows.length };
}

// ---------------------------------------------------------------- totals
const membersOf = (term) => (Array.isArray(term?.members) ? term.members : []);
const changesOf = (term) => (Array.isArray(term?.memberChanges) ? term.memberChanges : []);
const isActive = (m) => (m.status || "Active") !== "Removed";

/**
 * Counts on the register. sumInsured is per family when the cover is a floater (every member of a family carries
 * the same sum insured), otherwise the plain total; memberSumInsured is always the plain total.
 */
export function memberSummary(term) {
  const all = membersOf(term);
  const active = all.filter(isActive);
  const employees = active.filter((m) => m.relation === "Self").length;
  const memberSumInsured = r2(active.reduce((a, m) => a + (+m.sumInsured || 0), 0));
  const fams = new Map();
  active.forEach((m) => { const k = clean(m.empId) || `#${m.id}`; if (!fams.has(k)) fams.set(k, []); fams.get(k).push(m); });
  const multi = [...fams.values()].filter((f) => f.length > 1);
  const floater = multi.length > 0 && multi.every((f) => f.every((m) => +m.sumInsured === +f[0].sumInsured && +m.sumInsured > 0));
  const familySumInsured = r2([...fams.values()].reduce((a, f) => a + Math.max(0, ...f.map((m) => +m.sumInsured || 0)), 0));
  return {
    lives: active.length, employees, dependants: active.length - employees, removed: all.length - active.length, total: all.length,
    families: fams.size, floater, sumInsured: floater ? familySumInsured : memberSumInsured, memberSumInsured, familySumInsured,
  };
}

/** The CD (cash deposit) account with the insurer: opening + top-ups + refunds - debits. */
export function cdBalance(term) {
  const cd = term?.cdBalance || {};
  const entries = Array.isArray(cd.entries) ? cd.entries : [];
  const opening = +cd.opening || 0;
  const sum = (k) => r2(entries.filter((e) => e.kind === k).reduce((a, e) => a + (+e.amount || 0), 0));
  const topUps = sum("Top-up"), debits = sum("Debit"), refunds = sum("Refund");
  const balance = r2(opening + topUps + refunds - debits);
  const changes = changesOf(term);
  const last = [...changes].reverse().find((c) => c.kind === "Addition" && +c.premium > 0) || null;
  const lastAddition = last ? +last.premium : 0;
  const used = new Set(entries.map((e) => e.changeId).filter(Boolean));
  // Changes with a premium that have not been put through the CD account yet. Shown as suggestions only.
  const pending = changes.filter((c) => !used.has(c.id) && !c.cdSkip && isNum(c.premium) && +c.premium !== 0 && (c.kind === "Addition" ? +c.premium > 0 : c.kind === "Deletion" ? +c.premium < 0 : false))
    .map((c) => ({ changeId: c.id, kind: c.kind === "Addition" ? "Debit" : "Refund", amount: Math.abs(+c.premium), date: c.effDate, ref: c.endorsementNo || "" }));
  let warn = null, message = "";
  if (balance < 0) { warn = "negative"; message = `The CD balance is below zero by ${fmtMoney(-balance)}. Ask the client to top up before the next addition.`; }
  else if (last && balance < lastAddition) { warn = "low"; message = `The CD balance (${fmtMoney(balance)}) is less than the premium of the last addition (${fmtMoney(lastAddition)}). The next addition may not go through.`; }
  return { opening, topUps, debits, refunds, balance, lastAddition, pending, warn, message, entries: entries.length };
}

const csvCell = (x) => { const s = x == null ? "" : String(x); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** The member list as CSV text. filter: "All" (default), "Active" or "Removed". Dates DD/MM/YYYY. */
export function membersToCsv(term, filter = "All") {
  const rows = membersOf(term).filter((m) => filter === "All" || (filter === "Active" ? isActive(m) : !isActive(m)));
  const head = ["Employee ID", "Name", "Relation", "Date of birth", "Age", "Gender", "Sum insured", "Nominee", "Added on", "Removed on", "Status"];
  const body = rows.map((m) => [m.empId || "", m.name, m.relation, m.dob ? fmtDate(m.dob) : "", ageOf(m) ?? "", m.gender || "", isNum(m.sumInsured) ? +m.sumInsured : "", m.nominee || "", m.addedOn ? fmtDate(m.addedOn) : "", m.removedOn ? fmtDate(m.removedOn) : "", m.status || "Active"]);
  return [head, ...body].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Same person already on the list: same employee id, name and relation (case and spaces ignored). */
const keyOf = (m) => [clean(m.empId).toLowerCase(), clean(m.name).toLowerCase(), clean(m.relation).toLowerCase()].join("|");

// ---------------------------------------------------------------- the tab
const ensure = (t) => {
  if (!Array.isArray(t.members)) t.members = [];
  if (!Array.isArray(t.memberChanges)) t.memberChanges = [];
  if (!t.cdBalance || typeof t.cdBalance !== "object") t.cdBalance = { opening: 0, entries: [] };
  if (!Array.isArray(t.cdBalance.entries)) t.cdBalance.entries = [];
  return t;
};
const linesOfDoc = (d) => docText(d) || (d?.fixtureId ? fixtureById(d.fixtureId)?.lines || null : null);
const PAGE = 100;

export function MembersTab({ p, term, openDoc }) {
  const { db, update, can, log, toast, who } = useApp();
  const [q, setQ] = useState("");
  const [show, setShow] = useState("Active");
  const [limit, setLimit] = useState(PAGE);
  const [form, setForm] = useState(null); // { mode: "add" } | { mode: "edit", member } | { mode: "remove", member }
  const [importing, setImporting] = useState(null); // { text, source }
  const isLatest = term.id === p.termIds[p.termIds.length - 1];
  const live = term.status === "confirmed" && !term.cancelled && isLatest;
  const canMembers = can("endorse") && live;
  const canCd = (can("endorse") || can("receipt")) && live;
  const members = membersOf(term);
  const sum = memberSummary(term);
  const docs = db.documents.filter((d) => d.policyId === p.id && (d.termId === term.id || d.id === term.docId));
  const found = useMemo(() => {
    for (const d of docs) { const a = findAnnexure(linesOfDoc(d) || []); if (a) return { ...a, doc: d }; }
    return null;
  }, [docs.map((d) => d.id).join(), term.id]);

  if (term.status === "draft") return <div className="note">The member list opens once this policy is confirmed.</div>;

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = members.filter((m) => (show === "All" || (show === "Active" ? isActive(m) : !isActive(m)))
    && words.every((w) => [m.empId, m.name, m.relation, m.nominee, m.gender].join(" ").toLowerCase().includes(w)));
  const nameOf = (id) => members.find((m) => m.id === id)?.name || id;

  const download = () => {
    const name = `members-${String(term.values.policyNo || p.controlNo).replace(/[^A-Za-z0-9-]+/g, "-")}.csv`;
    try {
      const url = URL.createObjectURL(new Blob(["﻿" + membersToCsv(term, "All")], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`Downloaded ${name}`);
    } catch (e) { toast("The download did not start. Try again.", "bad"); }
  };

  return (
    <div className="stack">
      {!isLatest && <div className="note">You are viewing an earlier policy year. Its member list is kept as it was; changes go on the latest year.</div>}
      {term.cancelled && <div className="note">This policy is cancelled, so the member list cannot be changed.</div>}
      <div className="stats">
        <div className="stat"><span>Lives covered</span><strong>{sum.lives}</strong><em>{sum.removed ? `${sum.removed} removed during the year` : "Active members"}</em></div>
        <div className="stat"><span>Employees</span><strong>{sum.employees}</strong><em>Relation: Self</em></div>
        <div className="stat"><span>Dependants</span><strong>{sum.dependants}</strong><em>Spouse, children, parents</em></div>
        <div className="stat"><span>Total sum insured</span><strong>{fmtMoney(sum.sumInsured)}</strong><em>{sum.floater ? `Floater: counted once per family (${plural(sum.families, "family", "families")})` : "Active members added up"}</em></div>
      </div>

      {found && canMembers && !members.length && !importing && (
        <div className="note">
          <strong>{found.doc.name} has a member list with {plural(found.count, "row")}.</strong> Check it against the document, then add the members.
          <div className="row gap-s wrap" style={{ marginTop: 8 }}>
            <Btn kind="primary" onClick={() => setImporting({ text: found.text, source: found.doc.name })}>Check the rows</Btn>
            {openDoc && <Btn onClick={() => openDoc(found.doc)}>View document</Btn>}
          </div>
        </div>
      )}

      <Card title="Members" sub="Everyone covered on this policy year. Additions and deletions are kept as endorsements; removed members stay on the list."
        actions={<>
          {canMembers && !form && <Btn kind="primary" onClick={() => setForm({ mode: "add" })}>Add member</Btn>}
          {canMembers && <Btn onClick={() => setImporting({ text: "", source: "" })}>Import from Excel</Btn>}
          {canMembers && found && members.length > 0 && <Btn onClick={() => setImporting({ text: found.text, source: found.doc.name })}>Read from the policy document</Btn>}
          <Btn disabled={!members.length} why="No members yet" onClick={download}>Download CSV</Btn>
        </>}>
        {form && <MemberForm key={`${form.mode}-${form.member?.id || "new"}`} p={p} term={term} mode={form.mode} member={form.member} onDone={() => setForm(null)} />}
        <div className="row gap-s wrap" style={{ marginBottom: 10 }}>
          <input id="mb-search" type="search" aria-label="Search members" placeholder="Search name, employee ID, relation" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} style={{ minWidth: 240 }} />
          <label className="row gap-xs" htmlFor="mb-show"><span className="small">Show</span><Select id="mb-show" value={show} onChange={(v) => { setShow(v); setLimit(PAGE); }} options={["Active", "Removed", "All"]} /></label>
          <span className="small muted" role="status">{plural(list.length, "member")} shown</span>
        </div>
        {list.length ? (
          <>
            <Table><thead><tr><th>Employee ID</th><th>Name</th><th>Relation</th><th>Date of birth</th><th>Gender</th><th className="num">Sum insured</th><th>Nominee</th><th>Added on</th><th>Status</th>{canMembers && <th />}</tr></thead>
              <tbody>{list.slice(0, limit).map((m) => (
                <tr key={m.id}>
                  <td>{m.empId || "--"}</td><td>{m.name}</td><td>{m.relation}</td>
                  <td>{m.dob ? <>{fmtDate(m.dob)} <span className="muted small">({ageOf(m)} yrs)</span></> : isNum(m.age) ? `Age ${m.age}` : "--"}</td>
                  <td>{m.gender || "--"}</td><td className="num">{isNum(m.sumInsured) ? fmtMoney(m.sumInsured) : "--"}</td><td>{m.nominee || "--"}</td>
                  <td>{fmtDate(m.addedOn)}</td>
                  <td>{isActive(m) ? <Pill tone="good">Active</Pill> : <Pill tone="muted" title={`Removed from ${fmtDate(m.removedOn)}`}>Removed {fmtDate(m.removedOn)}</Pill>}</td>
                  {canMembers && <td>{isActive(m) && <div className="row gap-xs wrap"><Btn onClick={() => setForm({ mode: "edit", member: m })}>Correct</Btn><Btn onClick={() => setForm({ mode: "remove", member: m })}>Remove</Btn></div>}</td>}
                </tr>
              ))}</tbody></Table>
            {list.length > limit && <div className="row gap-s" style={{ marginTop: 8 }}><Btn onClick={() => setLimit((n) => n + PAGE * 5)}>Show more ({list.length - limit} more)</Btn></div>}
          </>
        ) : members.length ? <Empty title="No member matches">Try another search, or show All.</Empty>
          : <Empty title="No members recorded">{canMembers ? "Add members one by one, or paste the list from Excel with Import from Excel." : "Members appear here once someone with edit rights adds them."}</Empty>}
      </Card>

      <CdCard p={p} term={term} canCd={canCd} />

      <Card title="Member changes" sub="Each addition, deletion and correction, with its endorsement number and premium.">
        {changesOf(term).length ? (
          <Table><thead><tr><th>Effective</th><th>Change</th><th>Members</th><th className="num">Premium</th><th>Endorsement no.</th><th>Note</th><th>Recorded</th></tr></thead>
            <tbody>{changesOf(term).slice().reverse().map((c) => (
              <tr key={c.id}><td>{fmtDate(c.effDate)}</td><td>{c.kind}</td>
                <td>{c.memberIds.length > 3 ? `${plural(c.memberIds.length, "member")} (${c.memberIds.slice(0, 3).map(nameOf).join(", ")} and others)` : c.memberIds.map(nameOf).join(", ")}</td>
                <td className="num">{isNum(c.premium) && +c.premium !== 0 ? (+c.premium < 0 ? `Refund ${fmtMoney(-c.premium)}` : fmtMoney(c.premium)) : "--"}</td><td>{c.endorsementNo || "--"}</td><td>{c.note || "--"}</td><td className="small">{fmtStamp(c.at)} by {c.by}</td></tr>
            ))}</tbody></Table>
        ) : <Empty title="No changes recorded" />}
      </Card>

      {importing && <ImportModal p={p} term={term} start={importing} onClose={() => setImporting(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- add, correct, remove
const inRisk = (term, d) => d && (!term.values.riskStart || d >= term.values.riskStart) && (!term.values.riskEnd || d <= term.values.riskEnd);
const riskText = (term) => `${fmtDate(term.values.riskStart)} to ${fmtDate(term.values.riskEnd)}`;
const defaultEff = (term) => (inRisk(term, TODAY) ? TODAY : term.values.riskStart || TODAY);

function MemberForm({ p, term, mode, member, onDone }) {
  const { update, log, toast, who } = useApp();
  const members = membersOf(term);
  const m0 = member || {};
  const known = RELATIONS.includes(m0.relation);
  const [f, setF] = useState({
    empId: m0.empId || "", name: m0.name || "", relation: m0.relation ? (known ? m0.relation : "Other") : "Self", relOther: m0.relation && !known ? m0.relation : "",
    dob: m0.dob || "", age: m0.dob ? "" : isNum(m0.age) ? String(m0.age) : "", gender: m0.gender || "", sumInsured: isNum(m0.sumInsured) ? String(m0.sumInsured) : "", nominee: m0.nominee || "",
    effDate: defaultEff(term), premium: "", endorsementNo: "", note: "", withFamily: true,
  });
  const [tried, setTried] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const relation = f.relation === "Other" ? clean(f.relOther) : f.relation;
  const family = mode === "remove" && member.relation === "Self" && clean(member.empId) ? members.filter((m) => m.id !== member.id && isActive(m) && clean(m.empId) === clean(member.empId)) : [];
  const errs = mode === "remove" ? {
    effDate: !f.effDate ? "Enter the date the member leaves the cover" : !inRisk(term, f.effDate) ? `Must fall inside the risk period (${riskText(term)})` : member.addedOn && f.effDate < member.addedOn ? `Cannot be before the member was added (${fmtDate(member.addedOn)})` : null,
    premium: f.premium !== "" && (!isNum(f.premium) || +f.premium < 0) ? "Enter the refund as an amount, or leave it blank" : null,
  } : {
    name: !clean(f.name) ? "Enter the member's name" : null,
    relOther: f.relation === "Other" && !clean(f.relOther) ? "Enter the relation" : null,
    dob: f.dob && f.dob > TODAY ? "Date of birth cannot be in the future" : null,
    age: f.age !== "" && (!/^\d{1,3}$/.test(f.age) || +f.age > 120) ? "Enter the age in years" : null,
    sumInsured: f.sumInsured !== "" && (!isNum(f.sumInsured) || +f.sumInsured < 0) ? "Enter the sum insured as an amount" : null,
    effDate: mode === "add" ? (!f.effDate ? "Enter the date cover starts for this member" : !inRisk(term, f.effDate) ? `Must fall inside the risk period (${riskText(term)})` : null) : null,
    premium: f.premium !== "" && !isNum(f.premium) ? "Enter the premium as an amount, or leave it blank" : null,
    dup: members.some((m) => isActive(m) && m.id !== m0.id && keyOf(m) === keyOf({ empId: f.empId, name: f.name, relation })) ? "This member is already on the list" : null,
  };
  const ok = !Object.values(errs).some(Boolean);
  const save = () => {
    setTried(true);
    if (!ok) return;
    update((d) => {
      const t = ensure(d.terms.find((x) => x.id === term.id));
      const base = { at: nowIso(), by: who, endorsementNo: clean(f.endorsementNo), note: clean(f.note) };
      if (mode === "add") {
        const id = `M${++d.seq}`;
        t.members.push({ id, empId: clean(f.empId), name: clean(f.name), relation, dob: f.dob || "", ...(f.dob ? {} : f.age !== "" ? { age: +f.age } : {}), gender: f.gender, sumInsured: f.sumInsured === "" ? null : +f.sumInsured, nominee: clean(f.nominee), addedOn: f.effDate, removedOn: null, status: "Active" });
        t.memberChanges.push({ id: `MC${++d.seq}`, kind: "Addition", memberIds: [id], effDate: f.effDate, premium: f.premium === "" ? 0 : +f.premium, ...base });
        log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Member added", detail: `${clean(f.name)} (${relation}${clean(f.empId) ? `, employee ID ${clean(f.empId)}` : ""}) added from ${fmtDate(f.effDate)}.${f.premium !== "" ? ` Premium ${fmtMoney(+f.premium)}.` : ""}${clean(f.endorsementNo) ? ` Endorsement ${clean(f.endorsementNo)}.` : ""}` });
      } else if (mode === "edit") {
        const m = t.members.find((x) => x.id === member.id);
        const next = { empId: clean(f.empId), name: clean(f.name), relation, dob: f.dob || "", gender: f.gender, sumInsured: f.sumInsured === "" ? null : +f.sumInsured, nominee: clean(f.nominee) };
        const label = { empId: "Employee ID", name: "Name", relation: "Relation", dob: "Date of birth", gender: "Gender", sumInsured: "Sum insured", nominee: "Nominee" };
        const changed = Object.keys(next).filter((k) => String(m[k] ?? "") !== String(next[k] ?? ""));
        const ageNow = f.dob ? undefined : f.age !== "" ? +f.age : undefined;
        if (String(m.age ?? "") !== String(ageNow ?? "") && !f.dob) changed.push("age");
        const before = changed.map((k) => `${label[k] || "Age"} ${k === "dob" ? fmtDate(m[k]) : m[k] ?? "--"} to ${k === "dob" ? fmtDate(next[k]) : k === "age" ? ageNow ?? "--" : next[k] ?? "--"}`).join("; ");
        Object.assign(m, next);
        if (f.dob || ageNow === undefined) delete m.age; else m.age = ageNow;
        t.memberChanges.push({ id: `MC${++d.seq}`, kind: "Correction", memberIds: [m.id], effDate: m.addedOn || f.effDate, premium: f.premium === "" ? 0 : +f.premium, ...base });
        log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Member corrected", detail: `${m.name}: ${before || "no field changed"}.` });
      } else {
        const ids = [member.id, ...(f.withFamily ? family.map((m) => m.id) : [])];
        ids.forEach((id) => { const m = t.members.find((x) => x.id === id); m.status = "Removed"; m.removedOn = f.effDate; });
        t.memberChanges.push({ id: `MC${++d.seq}`, kind: "Deletion", memberIds: ids, effDate: f.effDate, premium: f.premium === "" ? 0 : -Math.abs(+f.premium), ...base });
        log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Member removed", detail: `${ids.map((id) => t.members.find((x) => x.id === id).name).join(", ")} removed from ${fmtDate(f.effDate)}.${f.premium !== "" && +f.premium ? ` Refund ${fmtMoney(+f.premium)}.` : ""}${clean(f.endorsementNo) ? ` Endorsement ${clean(f.endorsementNo)}.` : ""} Kept on the list as Removed.` });
      }
    });
    toast(mode === "add" ? "Member added" : mode === "edit" ? "Member corrected" : "Member removed");
    onDone();
  };
  const endorsementFields = (premiumLabel, premiumHint) => (
    <>
      <Labeled label={premiumLabel} htmlFor="mf-prem" hint={premiumHint} error={tried && errs.premium}><MoneyInput id="mf-prem" value={f.premium} onChange={set("premium")} /></Labeled>
      <Labeled label="Endorsement no." htmlFor="mf-end"><input id="mf-end" value={f.endorsementNo} onChange={(e) => set("endorsementNo")(e.target.value)} /></Labeled>
      <Labeled label="Note" htmlFor="mf-note" wide><input id="mf-note" value={f.note} onChange={(e) => set("note")(e.target.value)} placeholder="For example: joined on 01/11/2026, as per HR mail" /></Labeled>
    </>
  );
  if (mode === "remove") return (
    <div className="boxed stack" style={{ marginBottom: 12 }}>
      <h4>Remove {member.name} ({member.relation})</h4>
      <p className="small muted">The member stays on the list as Removed, with the date, so the record of who was covered is kept.</p>
      <div className="formgrid">
        <Labeled label="Removed from" htmlFor="mf-eff" req error={tried && errs.effDate} hint={`Inside the risk period, ${riskText(term)}`}><DateInput id="mf-eff" value={f.effDate} onChange={(e) => set("effDate")(e.target.value)} /></Labeled>
        {endorsementFields("Refund premium (optional)", "As stated by the insurer. Leave blank if none.")}
        {family.length > 0 && <div className="fld-wide"><label className="check"><input id="mf-fam" type="checkbox" checked={f.withFamily} onChange={(e) => set("withFamily")(e.target.checked)} /> Also remove their {plural(family.length, "dependant")}: {family.map((m) => `${m.name} (${m.relation})`).join(", ")}</label></div>}
      </div>
      <div className="row gap-s"><Btn onClick={onDone}>Cancel</Btn><Btn kind="danger" onClick={save}>Remove member</Btn></div>
    </div>
  );
  return (
    <div className="boxed stack" style={{ marginBottom: 12 }}>
      <h4>{mode === "add" ? "Add a member" : `Correct ${member.name}`}</h4>
      {tried && errs.dup && <div className="err-text" role="alert">{errs.dup}</div>}
      <div className="formgrid">
        <Labeled label="Employee ID" htmlFor="mf-emp" hint="Dependants use the employee's ID"><input id="mf-emp" value={f.empId} onChange={(e) => set("empId")(e.target.value)} /></Labeled>
        <Labeled label="Name" htmlFor="mf-name" req error={tried && errs.name}><input id="mf-name" value={f.name} onChange={(e) => set("name")(e.target.value)} /></Labeled>
        <Labeled label="Relation" htmlFor="mf-rel"><Select id="mf-rel" value={f.relation} onChange={set("relation")} options={RELATIONS} /></Labeled>
        {f.relation === "Other" && <Labeled label="Relation (other)" htmlFor="mf-relo" req error={tried && errs.relOther}><input id="mf-relo" value={f.relOther} onChange={(e) => set("relOther")(e.target.value)} placeholder="For example: Father-in-law" /></Labeled>}
        <Labeled label="Date of birth" htmlFor="mf-dob" error={tried && errs.dob}><DateInput id="mf-dob" value={f.dob} onChange={(e) => set("dob")(e.target.value)} /></Labeled>
        {!f.dob && <Labeled label="Age (if no date of birth)" htmlFor="mf-age" error={tried && errs.age}><input id="mf-age" inputMode="numeric" value={f.age} onChange={(e) => set("age")(e.target.value.replace(/\D/g, ""))} /></Labeled>}
        <Labeled label="Gender" htmlFor="mf-gen"><Select id="mf-gen" value={f.gender} onChange={set("gender")} options={GENDERS} placeholder="Not given" /></Labeled>
        <Labeled label="Sum insured" htmlFor="mf-si" error={tried && errs.sumInsured}><MoneyInput id="mf-si" value={f.sumInsured} onChange={set("sumInsured")} /></Labeled>
        <Labeled label="Nominee" htmlFor="mf-nom"><input id="mf-nom" value={f.nominee} onChange={(e) => set("nominee")(e.target.value)} /></Labeled>
        {mode === "add" && <Labeled label="Cover starts on" htmlFor="mf-eff" req error={tried && errs.effDate} hint={`Inside the risk period, ${riskText(term)}`}><DateInput id="mf-eff" value={f.effDate} onChange={(e) => set("effDate")(e.target.value)} /></Labeled>}
        {mode === "add" ? endorsementFields("Additional premium (optional)", "As stated by the insurer. Leave blank if none.") : <>
          <Labeled label="Endorsement no." htmlFor="mf-end"><input id="mf-end" value={f.endorsementNo} onChange={(e) => set("endorsementNo")(e.target.value)} /></Labeled>
          <Labeled label="Note" htmlFor="mf-note" wide><input id="mf-note" value={f.note} onChange={(e) => set("note")(e.target.value)} placeholder="For example: name spelling as per Aadhaar" /></Labeled>
        </>}
      </div>
      <div className="row gap-s"><Btn onClick={onDone}>Cancel</Btn><Btn kind="primary" onClick={save}>{mode === "add" ? "Add member" : "Save correction"}</Btn></div>
    </div>
  );
}

// ---------------------------------------------------------------- import (paste or policy document)
function ImportModal({ p, term, start, onClose }) {
  const { update, log, toast, who } = useApp();
  const members = membersOf(term);
  const [text, setText] = useState(start.text || "");
  const [res, setRes] = useState(() => (start.text ? parseMemberRows(start.text) : null));
  const first = !members.length;
  const [f, setF] = useState({ effDate: first ? term.values.riskStart || TODAY : defaultEff(term), premium: "", endorsementNo: "" });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const have = new Set(members.filter(isActive).map(keyOf));
  const seen = new Set();
  const rows = (res?.rows || []).map((r) => {
    const k = keyOf(r);
    const extra = have.has(k) ? ["Already on the member list."] : seen.has(k) ? ["Same person twice in the pasted rows."] : [];
    seen.add(k);
    return { ...r, problems: [...r.problems, ...extra] };
  });
  const good = rows.filter((r) => !r.problems.length), bad = rows.length - good.length;
  const effErr = !f.effDate ? "Enter the date cover starts" : !inRisk(term, f.effDate) ? `Must fall inside the risk period (${riskText(term)})` : null;
  const premErr = f.premium !== "" && !isNum(f.premium) ? "Enter the premium as an amount, or leave it blank" : null;
  const doImport = () => {
    if (!good.length || effErr || premErr) return;
    update((d) => {
      const t = ensure(d.terms.find((x) => x.id === term.id));
      const ids = good.map((r) => {
        const id = `M${++d.seq}`;
        t.members.push({ id, empId: r.empId, name: r.name, relation: r.relation, dob: r.dob || "", ...(r.dob || r.age == null ? {} : { age: r.age }), gender: r.gender, sumInsured: r.sumInsured, nominee: r.nominee, addedOn: f.effDate, removedOn: null, status: "Active" });
        return id;
      });
      t.memberChanges.push({ id: `MC${++d.seq}`, kind: "Addition", memberIds: ids, effDate: f.effDate, premium: f.premium === "" ? 0 : +f.premium, endorsementNo: clean(f.endorsementNo), note: start.source ? `Read from ${start.source}` : "Imported from pasted rows", at: nowIso(), by: who });
      log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Members imported", detail: `${plural(ids.length, "member")} added from ${fmtDate(f.effDate)}, ${start.source ? `read from ${start.source}` : "pasted from a spreadsheet"}.${bad ? ` ${plural(bad, "row")} with problems left out.` : ""}${f.premium !== "" ? ` Premium ${fmtMoney(+f.premium)}.` : ""}${clean(f.endorsementNo) ? ` Endorsement ${clean(f.endorsementNo)}.` : ""}` });
    });
    toast(`${plural(good.length, "member")} added`);
    onClose();
  };
  return (
    <Modal title={start.source ? `Members from ${start.source}` : "Import members"} onClose={onClose} wide>
      <p className="small">{start.source ? "These rows were read from the document. Check them against it; you can correct the text below and read it again." : "In Excel, select the member rows with the heading row on top, copy, and paste here. A CSV file's text works too. Dates are read day first (DD/MM/YYYY)."}</p>
      <textarea id="mb-paste" className="docbox" aria-label="Pasted member rows" value={text} onChange={(e) => setText(e.target.value)} rows={8}
        placeholder={"Employee ID\tName\tRelation\tDate of birth\tGender\tSum insured\tNominee"} />
      <div className="row gap-s wrap"><Btn kind="primary" disabled={!text.trim()} why="Paste the rows first" onClick={() => setRes(parseMemberRows(text))}>Read rows</Btn>{res && !res.error && <span className="small" role="status">{plural(rows.length, "row")} read: {good.length} ready{bad ? `, ${bad} with problems (left out)` : ""}.</span>}</div>
      {res?.error && <div className="note note-warn" role="alert">{res.error}</div>}
      {res && !res.error && (
        <>
          <p className="small muted">Columns used: {Object.entries(res.mapped).map(([k, h]) => `${HEAD_LABEL[k]} = "${h}"`).join(", ")}.{res.unmapped.length ? ` Not used: ${res.unmapped.map((h) => `"${h}"`).join(", ")}.` : ""}</p>
          <Table><thead><tr><th>Row</th><th>Employee ID</th><th>Name</th><th>Relation</th><th>Date of birth / age</th><th>Gender</th><th className="num">Sum insured</th><th>Nominee</th><th>Check</th></tr></thead>
            <tbody>{rows.slice(0, 300).map((r) => (
              <tr key={r.n}><td>{r.n}</td><td>{r.empId || "--"}</td><td>{r.name || "--"}</td><td>{r.relation}</td><td>{r.dob ? fmtDate(r.dob) : r.age != null ? `Age ${r.age}` : "--"}</td><td>{r.gender || "--"}</td><td className="num">{r.sumInsured != null ? fmtMoney(r.sumInsured) : "--"}</td><td>{r.nominee || "--"}</td>
                <td>{r.problems.length ? <span className="err-text small">{r.problems.join(" ")}</span> : r.warnings.length ? <span className="warn-text small">{r.warnings.join(" ")}</span> : <Pill tone="good">Ready</Pill>}</td></tr>
            ))}</tbody></Table>
          {rows.length > 300 && <p className="small muted">Showing the first 300 of {rows.length} rows. All ready rows will be added.</p>}
          <div className="formgrid">
            <Labeled label="Cover starts on" htmlFor="mi-eff" req error={effErr} hint={first ? "The policy start date for the starting list" : `Inside the risk period, ${riskText(term)}`}><DateInput id="mi-eff" value={f.effDate} onChange={(e) => set("effDate")(e.target.value)} /></Labeled>
            <Labeled label="Premium for these members (optional)" htmlFor="mi-prem" error={premErr} hint={first ? "Leave blank for the starting list" : "As stated by the insurer"}><MoneyInput id="mi-prem" value={f.premium} onChange={set("premium")} /></Labeled>
            <Labeled label="Endorsement no." htmlFor="mi-end"><input id="mi-end" value={f.endorsementNo} onChange={(e) => set("endorsementNo")(e.target.value)} /></Labeled>
          </div>
          <div className="row gap-s wrap"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={!good.length || !!effErr || !!premErr} why={!good.length ? "No row is ready" : effErr || premErr} onClick={doImport}>Add {plural(good.length, "member")}</Btn></div>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- CD balance
function CdCard({ p, term, canCd }) {
  const { update, log, toast, who } = useApp();
  const cd = cdBalance(term);
  const entries = Array.isArray(term.cdBalance?.entries) ? term.cdBalance.entries : [];
  const [adding, setAdding] = useState(null); // prefilled entry
  const [opening, setOpening] = useState(null);
  const [tried, setTried] = useState(false);
  const blank = { date: TODAY, kind: "Top-up", amount: "", ref: "", changeId: null };
  const f = adding || blank;
  const set = (k) => (v) => setAdding((x) => ({ ...(x || blank), [k]: v }));
  const errs = { date: !f.date ? "Enter the date" : null, amount: !isNum(f.amount) || +f.amount <= 0 ? "Enter an amount more than 0" : null };
  const saveEntry = () => {
    setTried(true);
    if (errs.date || errs.amount) return;
    update((d) => {
      const t = ensure(d.terms.find((x) => x.id === term.id));
      t.cdBalance.entries.push({ id: `CB${++d.seq}`, date: f.date, kind: f.kind, amount: +f.amount, ref: clean(f.ref), ...(f.changeId ? { changeId: f.changeId } : {}), at: nowIso(), by: who });
      log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: `CD balance ${f.kind.toLowerCase()}`, detail: `${f.kind} of ${fmtMoney(+f.amount)} on ${fmtDate(f.date)}${clean(f.ref) ? `, reference ${clean(f.ref)}` : ""}${f.changeId ? ", for a member change" : ""}.` });
    });
    toast(`CD ${f.kind.toLowerCase()} recorded`);
    setAdding(null); setTried(false);
  };
  const saveOpening = () => {
    if (!isNum(opening)) return;
    update((d) => {
      const t = ensure(d.terms.find((x) => x.id === term.id));
      const was = +t.cdBalance.opening || 0;
      t.cdBalance.opening = +opening;
      log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "CD opening balance set", detail: `Opening balance ${fmtMoney(was)} to ${fmtMoney(+opening)}.` });
    });
    toast("Opening balance saved");
    setOpening(null);
  };
  const skip = (changeId) => {
    update((d) => {
      const t = ensure(d.terms.find((x) => x.id === term.id));
      const c = t.memberChanges.find((x) => x.id === changeId);
      c.cdSkip = true;
      log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "CD suggestion set aside", detail: `${c.kind} of ${fmtDate(c.effDate)} marked as not paid from the CD account.` });
    });
  };
  return (
    <Card title="CD balance" sub="The cash deposit the client keeps with the insurer for additions during the year. Debits are never made by themselves; record each one.">
      {cd.warn && <div className={`note ${cd.warn === "negative" ? "note-warn bad-text" : "note-warn"}`} role="alert" style={{ marginBottom: 10 }}>{cd.message}</div>}
      <KV items={[["Opening balance", fmtMoney(cd.opening)], ["Top-ups", fmtMoney(cd.topUps)], ["Debits", fmtMoney(cd.debits)], ["Refunds", fmtMoney(cd.refunds)], ["Current balance", <strong key="b" className={cd.balance < 0 ? "bad-text" : ""}>{fmtMoney(cd.balance)}</strong>]]} />
      {canCd && opening == null && !adding && <div className="row gap-s wrap" style={{ marginTop: 8 }}><Btn onClick={() => setOpening(String(cd.opening || ""))}>Set opening balance</Btn><Btn kind="primary" onClick={() => setAdding({ ...blank })}>Record CD entry</Btn></div>}
      {opening != null && (
        <div className="formgrid boxed" style={{ marginTop: 8 }}>
          <Labeled label="Opening balance" htmlFor="cd-open"><MoneyInput id="cd-open" value={opening} onChange={setOpening} /></Labeled>
          <div className="row gap-s fld-wide"><Btn onClick={() => setOpening(null)}>Cancel</Btn><Btn kind="primary" disabled={!isNum(opening)} why="Enter an amount" onClick={saveOpening}>Save opening balance</Btn></div>
        </div>
      )}
      {adding && (
        <div className="formgrid boxed" style={{ marginTop: 8 }}>
          <Labeled label="Date" htmlFor="cd-date" req error={tried && errs.date}><DateInput id="cd-date" value={f.date} onChange={(e) => set("date")(e.target.value)} /></Labeled>
          <Labeled label="Entry" htmlFor="cd-kind"><Select id="cd-kind" value={f.kind} onChange={set("kind")} options={["Top-up", "Debit", "Refund"]} /></Labeled>
          <Labeled label="Amount" htmlFor="cd-amt" req error={tried && errs.amount}><MoneyInput id="cd-amt" value={f.amount} onChange={set("amount")} /></Labeled>
          <Labeled label="Reference" htmlFor="cd-ref"><input id="cd-ref" value={f.ref} onChange={(e) => set("ref")(e.target.value)} placeholder="UTR, endorsement no. or insurer statement" /></Labeled>
          <div className="row gap-s fld-wide"><Btn onClick={() => { setAdding(null); setTried(false); }}>Cancel</Btn><Btn kind="primary" onClick={saveEntry}>Save entry</Btn></div>
        </div>
      )}
      {canCd && cd.pending.length > 0 && !adding && (
        <div className="note small" style={{ marginTop: 10 }}>
          <strong>Member changes not yet in the CD account</strong>
          {cd.pending.map((s) => (
            <div key={s.changeId} className="row between wrap gap-s" style={{ marginTop: 6 }}>
              <span>{s.kind === "Debit" ? "Addition" : "Deletion"} from {fmtDate(s.date)}{s.ref ? ` (${s.ref})` : ""}: {s.kind.toLowerCase()} of {fmtMoney(s.amount)}?</span>
              <span className="row gap-xs"><Btn onClick={() => setAdding({ date: s.date && s.date <= TODAY ? s.date : TODAY, kind: s.kind, amount: String(s.amount), ref: s.ref, changeId: s.changeId })}>Record as {s.kind.toLowerCase()}</Btn><Btn onClick={() => skip(s.changeId)}>Not from CD</Btn></span>
            </div>
          ))}
        </div>
      )}
      {entries.length > 0 && (
        <Table><thead><tr><th>Date</th><th>Entry</th><th className="num">Amount</th><th>Reference</th><th>Recorded</th></tr></thead>
          <tbody>{entries.slice().reverse().map((e) => <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{e.kind}</td><td className="num">{e.kind === "Debit" ? "-" : "+"}{fmtMoney(e.amount)}</td><td>{e.ref || "--"}</td><td className="small">{fmtStamp(e.at)} by {e.by}</td></tr>)}</tbody></Table>
      )}
    </Card>
  );
}
