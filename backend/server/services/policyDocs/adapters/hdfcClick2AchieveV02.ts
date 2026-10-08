/**
 * Adapter: HDFC Life Click 2 Achieve, UIN 101N186V02,
 * option Dream Achiever, benefit choice Early Income.
 *
 * Built from one privately supplied policy document (not in the repo) and
 * checked against synthetic fixtures that copy its layout. It supports THAT
 * layout. Another UIN version, option, benefit choice, or a document missing
 * the clause headings below is refused, never parsed "as near enough".
 *
 * Every value is read by matching the document's own wording exactly (after
 * the fixed normalisations in ../docQuery). A critical number, date or formula
 * that does not match, for example because OCR dropped a symbol, is marked
 * unsupported or missing. Nothing is corrected, rounded or filled in.
 *
 * Customer identity rows in the schedule (name, policy number, address,
 * contact details, nominee) are never read.
 */

import { parseIsoDate } from "../../../../../shared/policyNumbers";
import {
  num, op, paiseFromRupeeText, parseDecimal, parsePercentText, rat, v, div, mul,
  type Bps, type Expr, type Paise,
} from "../../../../../shared/exactMath";
import type {
  FieldKey, FieldState, Frequency, GsvBand, ParsedFields, PolicyFields, RateRule, ReviewFlag, SourceRef,
} from "../../../../../shared/policyDocTypes";
import { clauseText, findLines, norm, sourceOf, tableRows, valuesRightOf, type Located } from "../docQuery";
import type { Identification, PolicyAdapter } from "../registry";
import type { DocumentText, PageText } from "../textLayer";

const ID = "hdfc-click2achieve-101N186V02-dream-achiever-early-income";
const VERSION = "1.0.0";
const UIN = "101N186V02";
const OPTION = "Dream Achiever";
const BENEFIT = "Early Income";

const TITLE_RE = /POLICY DOCUMENT\s*-\s*HDFC Life Click 2 Achieve\b/i;
const UIN_RE = /Unique Identification Number:\s*([0-9]{3}[A-Z][0-9]{3}V[0-9]{2})\b/;

/** The clause headings this layout must have. A different edition will not carry the same set. */
const FINGERPRINT: [string, RegExp][] = [
  ["Part D", /^Part D$/],
  ["1. Surrender Value", /^1\. Surrender Value$/],
  ["2. Lapsed Policies and Paid-Up policies", /^2\. Lapsed Policies and Paid-Up policies$/i],
  ["3. Revival of the Policy", /^3\. Revival of the Policy$/],
  ["8. Loans", /^8\. Loans:?$/],
  ["Policy Anniversary definition", /Policy Anniversary ?- ?means the annual anniversary of the Date of Risk/],
];

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/* ───────────── value readers (each returns null when the text is not exactly in the expected form) ───────────── */

function money(s: string): Paise | null {
  const m = /^₹\s*([\d,]+\.\d{2})$/.exec(s.trim());
  return m ? paiseFromRupeeText(m[1]) : null;
}
function ddmmyyyy(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const p = parseIsoDate(`${m[3]}-${m[2]}-${m[1]}`);
  return p.ok ? p.value : null;
}
function longDate(s: string): string | null {
  const m = /^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+) (\d{4})$/.exec(s.trim());
  if (!m) return null;
  const mo = MONTHS.indexOf(m[2].toLowerCase());
  if (mo < 0) return null;
  const p = parseIsoDate(`${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  return p.ok ? p.value : null;
}
function dayMonth(s: string): { day: number; month: number } | null {
  const m = /^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+)$/.exec(s.trim());
  if (!m) return null;
  const mo = MONTHS.indexOf(m[2].toLowerCase());
  const d = Number(m[1]);
  return mo >= 0 && d >= 1 && d <= 31 ? { day: d, month: mo + 1 } : null;
}
function years(s: string): number | null {
  const m = /^(\d{1,3}) Years?$/i.exec(s.trim());
  return m ? Number(m[1]) : null;
}
function frequency(s: string): Frequency | null {
  const t = s.trim().toLowerCase();
  return t === "annual" ? "annual" : t === "half yearly" || t === "half-yearly" ? "half_yearly" : t === "quarterly" ? "quarterly" : t === "monthly" ? "monthly" : t === "single" ? "single" : null;
}
function pctToBps(s: string): Bps | null {
  const r = parsePercentText(s);
  if (!r) return null;
  const b = mul(r, rat(10000));
  return b.d === BigInt(1) ? { bps: Number(b.n) } : null;
}
function percentNumberToBps(s: string): Bps | null {
  const r = parseDecimal(s);
  if (!r) return null;
  const b = mul(r, rat(100));
  return b.d === BigInt(1) ? { bps: Number(b.n) } : null;
}

/* ───────────── the adapter ───────────── */

function schedulePages(doc: DocumentText): number[] {
  const h = findLines(doc, /^POLICY SCHEDULE$/);
  if (!h.length) return [];
  const p = h[0].page.index;
  return [p, p + 1].filter((i) => i <= doc.pageCount);
}

function identify(doc: DocumentText): Identification {
  if (!findLines(doc, TITLE_RE).length) return { result: "no_match", reason: "Not an HDFC Life Click 2 Achieve policy document (title not found)." };
  const uins = new Set(findLines(doc, UIN_RE).map((h) => h.match[1]));
  if (uins.size === 0) return { result: "no_match", reason: "Click 2 Achieve document without a readable UIN, so the product version cannot be confirmed." };
  if (uins.size > 1) return { result: "conflict", reason: `The document shows more than one UIN (${[...uins].join(", ")}).` };
  const uin = [...uins][0];
  if (uin !== UIN) return { result: "no_match", reason: `Click 2 Achieve UIN ${uin} is a version this reader does not support (supported: ${UIN}).` };
  if (findLines(doc, /^POLICY SCHEDULE$/).length > 1) return { result: "conflict", reason: "The file seems to contain more than one policy schedule." };
  const pages = schedulePages(doc);
  const opt = valuesRightOf(doc, /^Plan Option\b/, pages).map((x) => x.text);
  const ben = valuesRightOf(doc, /^Benefit Chosen\b/, pages).map((x) => x.text);
  if (new Set(opt).size > 1 || new Set(ben).size > 1) return { result: "conflict", reason: "The schedule shows conflicting plan options." };
  if (opt[0] !== OPTION) return { result: "no_match", reason: `Click 2 Achieve option "${opt[0] ?? "not found"}" is not supported (supported: ${OPTION}).` };
  if (ben[0] !== BENEFIT) return { result: "no_match", reason: `Click 2 Achieve benefit choice "${ben[0] ?? "not found"}" is not supported (supported: ${BENEFIT}).` };
  const missing = FINGERPRINT.filter(([, re]) => !doc.pages.some((p) => p.lines.some((l) => re.test(norm(l.text))) || re.test(norm(p.text.replace(/\n/g, " ")))));
  if (missing.length) {
    return { result: "no_match", reason: `The layout differs from the supported edition (missing: ${missing.map(([n]) => n).join(", ")}).` };
  }
  return { result: "match" };
}

function parse(doc: DocumentText): { fields: ParsedFields; flags: ReviewFlag[] } {
  const ctx = { sha256: doc.sha256, parser: ID, parserVersion: VERSION };
  const fields: ParsedFields = {};
  const flags: ReviewFlag[] = [];
  const set = <K extends FieldKey>(k: K, f: FieldState<PolicyFields[K]>) => { (fields as any)[k] = f; };
  const src = (loc: { page: PageText; region: Located["region"] }, excerpt: string | null, clause: string | null): SourceRef => sourceOf(loc, excerpt, clause, ctx);

  const sched = schedulePages(doc);
  const SCHEDULE = "Policy Schedule";

  /* A schedule value: every occurrence on the schedule pages must agree. */
  function scheduleField<K extends FieldKey>(k: K, labelRe: RegExp, label: string, read: (s: string) => PolicyFields[K] | null, opts: { variantRe?: RegExp; na?: boolean } = {}) {
    const vals = valuesRightOf(doc, labelRe, sched, { variantRe: opts.variantRe });
    if (!vals.length) return set(k, { state: "missing", reason: `"${label}" not found in the policy schedule.` });
    const distinct = new Set(vals.map((x) => x.text));
    if (distinct.size > 1) {
      return set(k, { state: "conflicting", reason: `"${label}" appears with different values.`, candidates: vals.map((x) => ({ raw: x.text, source: src(x, `${label}: ${x.text}`, SCHEDULE) })) });
    }
    const x = vals[0];
    const source = src(x, `${label}: ${x.text}`, SCHEDULE);
    if (opts.na && /^NA$/i.test(x.text)) return set(k, { state: "not_applicable", raw: x.text, source });
    const value = read(x.text);
    if (value === null) return set(k, { state: "unsupported", reason: `"${label}" is printed as "${x.text}", which is not in the expected form.`, raw: x.text, source });
    set(k, { state: "found", value, raw: x.text, source });
  }

  /* A value from clause wording. */
  function clauseField<K extends FieldKey>(k: K, clause: (Located & { pages: number[] }) | null, clauseName: string, re: RegExp, build: (m: RegExpExecArray) => PolicyFields[K] | null, what: string) {
    if (!clause) return set(k, { state: "missing", reason: `Clause "${clauseName}" not found.` });
    const m = re.exec(clause.text);
    if (!m) return set(k, { state: "missing", reason: `The wording for ${what} was not found exactly as expected in "${clauseName}".` });
    const value = build(m);
    const source = src(clause, m[0], clauseName);
    if (value === null) return set(k, { state: "unsupported", reason: `The wording for ${what} could not be read as a value.`, raw: m[0], source });
    set(k, { state: "found", value, raw: m[0], source });
  }

  /* ── Identity ── */
  const title = findLines(doc, TITLE_RE)[0];
  const titleSrc = src({ page: title.page, region: title.line.region }, norm(title.line.text), "Policy document title");
  set("identity.insurer", { state: "found", value: "HDFC Life", raw: norm(title.line.text), source: titleSrc });
  set("identity.plan", { state: "found", value: "Click 2 Achieve", raw: norm(title.line.text), source: titleSrc });
  const u = findLines(doc, UIN_RE)[0];
  set("identity.uin", { state: "found", value: u.match[1], raw: u.match[0], source: src({ page: u.page, region: u.line.region }, u.match[0], "Policy document title") });
  scheduleField("identity.option", /^Plan Option\b/, "Plan Option", (s) => (s === OPTION ? s : null));
  scheduleField("identity.benefit_choice", /^Benefit Chosen\b/, "Benefit Chosen", (s) => (s === BENEFIT ? s : null));
  const cls = findLines(doc, /Non Linked, Non Participating, Individual, Savings Life Insurance Plan/)[0];
  if (cls) {
    const s = src({ page: cls.page, region: cls.line.region }, cls.match[0], "Policy document title");
    set("identity.linked", { state: "found", value: "non_linked", raw: cls.match[0], source: s });
    set("identity.participating", { state: "found", value: "non_participating", raw: cls.match[0], source: s });
  } else {
    set("identity.linked", { state: "missing", reason: "Linked / non-linked statement not found." });
    set("identity.participating", { state: "missing", reason: "Participating statement not found." });
  }

  /* ── Schedule ── */
  scheduleField("schedule.annualized_premium", /^Annualized Premium\b/, "Annualized Premium", money);
  scheduleField("schedule.instalment_premium_first_year", /^Premium per Frequency of Premium\b/, "Premium per Frequency of Premium Payment (For First Year)", money, { variantRe: /\(For First Year\)/ });
  scheduleField("schedule.instalment_premium_renewal", /^Premium per Frequency of Premium\b/, "Premium per Frequency of Premium Payment (For Second Onwards)", money, { variantRe: /\(For Second Onwards\)/ });
  scheduleField("schedule.extra_premium", /^Underwriting Extra Premium per Frequency\b/, "Underwriting Extra Premium", money);
  scheduleField("schedule.policy_term_years", /^Policy Term\b/, "Policy Term", years);
  scheduleField("schedule.premium_paying_term_years", /^Premium Paying Term\b/, "Premium Paying Term", years);
  scheduleField("schedule.frequency", /^Frequency of Premium Payment\b/, "Frequency of Premium Payment", frequency);
  scheduleField("schedule.commencement_date", /^Date of Commencement of Policy\b/, "Date of Commencement of Policy", ddmmyyyy);
  scheduleField("schedule.risk_commencement_date", /^Date of Risk Commencement\b/, "Date of Risk Commencement", longDate);
  scheduleField("schedule.premium_due_day_month", /^Premium Due Date\(s\)/, "Premium Due Date(s)", dayMonth);
  scheduleField("schedule.final_premium_due_date", /^Final Premium Due Date\b/, "Final Premium Due Date", ddmmyyyy);
  // Printed as "Maturity Date", but this option pays no maturity benefit: it is the policy end date.
  scheduleField("schedule.policy_end_date", /^Maturity Date\b/, "Maturity Date (policy end)", ddmmyyyy);
  scheduleField("schedule.grace_days", /^Grace Period\b/, "Grace Period", (s) => { const m = /^(\d{1,3}) days$/i.exec(s); return m ? Number(m[1]) : null; });
  scheduleField("schedule.sum_assured_on_death", /^Sum Assured on Death at inception\b/, "Sum Assured on Death at inception", money);
  scheduleField("schedule.juvenile_ci_sum_assured", /^Sum Assured on Juvenile CI at inception\b/, "Sum Assured on Juvenile CI at inception", money, { na: true });
  const yesNo = (s: string) => (s === "Yes" ? true : s === "No" ? false : null);
  scheduleField("schedule.deferral_selected", /^Deferral of Survival\/Income Benefit\b/, "Deferral of Survival/Income Benefit", yesNo);
  scheduleField("schedule.premium_offset_selected", /^Premium Offset\b/, "Premium Offset", yesNo);
  set("schedule.currency", { state: "found", value: "INR", raw: "Indian Rupees", source: titleSrc });
  const tax = findLines(doc, /The Premium amount is excluding any applicable Taxes/, sched)[0];
  set("schedule.premium_excludes_taxes", tax
    ? { state: "found", value: true, raw: tax.match[0], source: src({ page: tax.page, region: tax.line.region }, tax.match[0], SCHEDULE) }
    : { state: "missing", reason: "The statement that premiums exclude taxes was not found." });

  /* ── Benefit cashflows ── */
  readCashflows();

  function readCashflows() {
    const page = doc.pages.find((p) => sched.includes(p.index) && p.lines.some((l) => /Survival benefit Payment dates/.test(norm(l.text))));
    if (!page) {
      for (const k of ["benefits.survival_recurring", "benefits.survival_terminal", "benefits.maturity", "benefits.income"] as const) set(k, { state: "missing", reason: "Benefit cashflow table not found." });
      return;
    }
    const sbHead = page.lines.find((l) => /Survival benefit Payment dates/.test(norm(l.text)))!;
    const matHead = page.lines.find((l) => /Maturity benefit Payment date/.test(norm(l.text)));
    const incHead = page.lines.find((l) => /Income benefit Payment dates/.test(norm(l.text)));
    // The amount column starts right of the "payment dates" header cell, on the header's row.
    const datesHdr = page.items.find((i) => /Survival benefit Payment dates/.test(norm(i.s)))
      ?? { x: sbHead.region.x, w: sbHead.region.w * 0.5, y: sbHead.region.y, h: sbHead.region.h, s: "" };
    const amountHdr = page.items
      .filter((i) => i.x > datesHdr.x + datesHdr.w - 2 && Math.abs(i.y - datesHdr.y) <= Math.max(2, i.h * 0.5))
      .sort((a, b) => a.x - b.x)[0];
    if (!amountHdr) {
      for (const k of ["benefits.survival_recurring", "benefits.survival_terminal", "benefits.maturity", "benefits.income"] as const) set(k, { state: "missing", reason: "Benefit cashflow table columns not found." });
      return;
    }
    const amountX = amountHdr.x - 4;
    const header2 = (y: number) => page.items.some((i) => i.x >= amountX && Math.abs(i.y - y) <= 2 && /^Amount$/.test(norm(i.s)));
    const band = (top: number, bottom: number) => page.items.filter((i) => i.y < top - 1 && i.y > bottom + 1 && i.x >= datesHdr.x - 4 && !(/^Amount$/.test(norm(i.s)) && header2(i.y)));
    const rowsOf = (its: typeof page.items) => {
      const rows: { y: number; date: string; amt: string }[] = [];
      for (const it of [...its].sort((a, b) => b.y - a.y)) {
        let r = rows.find((x) => Math.abs(x.y - it.y) <= Math.max(2, it.h * 0.5));
        if (!r) { r = { y: it.y, date: "", amt: "" }; rows.push(r); }
        if (it.x >= amountX) r.amt = norm(r.amt + " " + it.s); else r.date = norm(r.date + " " + it.s);
      }
      return rows;
    };
    const sbRows = rowsOf(band(sbHead.region.y, matHead ? matHead.region.y : -Infinity));
    const sbText = norm(sbRows.map((r) => r.date).join(" "));
    const sbAmts = sbRows.map((r) => r.amt).filter(Boolean);
    const sbLoc = { page, region: sbHead.region };
    const rec = /Every Monthly starting From (\d{2}\/\d{2}\/\d{4}) Till (\d{2}\/\d{2}\/\d{4})/.exec(sbText);
    if (rec && sbAmts.length >= 1) {
      const amount = money(sbAmts[0]);
      const from = ddmmyyyy(rec[1]);
      const to = ddmmyyyy(rec[2]);
      const raw = `${rec[0]}: ${sbAmts[0]}`;
      set("benefits.survival_recurring", amount && from && to
        ? { state: "found", value: { amount, frequency: "monthly", from, to }, raw, source: src(sbLoc, `Survival Benefit ${raw}`, SCHEDULE) }
        : { state: "unsupported", reason: "The recurring survival benefit row could not be read exactly.", raw, source: src(sbLoc, raw, SCHEDULE) });
    } else {
      set("benefits.survival_recurring", { state: "missing", reason: "The monthly survival benefit row was not found." });
    }
    // A single-date row after the recurring one: the terminal survival benefit. Kept as survival, never relabelled maturity.
    const term = sbRows.find((r) => /^\d{2}\/\d{2}\/\d{4}$/.test(r.date) && r.amt);
    if (term) {
      const amount = money(term.amt);
      const date = ddmmyyyy(term.date);
      const raw = `${term.date}: ${term.amt}`;
      set("benefits.survival_terminal", amount && date
        ? { state: "found", value: { amount, date }, raw, source: src(sbLoc, `Survival Benefit ${raw}`, SCHEDULE) }
        : { state: "unsupported", reason: "The final survival benefit row could not be read exactly.", raw, source: src(sbLoc, raw, SCHEDULE) });
    } else {
      set("benefits.survival_terminal", { state: "missing", reason: "No final survival benefit row was found." });
    }
    const naBlock = (headLine: typeof matHead, nextY: number, k: "benefits.maturity" | "benefits.income", name: string) => {
      if (!headLine) return set(k, { state: "missing", reason: `${name} rows not found.` });
      const rows = rowsOf(band(headLine.region.y, nextY));
      const all = rows.flatMap((r) => [r.date, r.amt]).filter(Boolean);
      const loc = { page, region: headLine.region };
      if (all.length && all.every((t) => /^NA$/i.test(t))) set(k, { state: "not_applicable", raw: "NA", source: src(loc, `${name}: NA`, SCHEDULE) });
      else set(k, { state: "unsupported", reason: `${name} is printed with values this reader does not handle for this option.`, raw: all.join(" "), source: src(loc, null, SCHEDULE) });
    };
    naBlock(matHead, incHead ? incHead.region.y : -Infinity, "benefits.maturity", "Maturity Benefit");
    const after = page.lines.find((l) => /The Premium amount is excluding/.test(norm(l.text)));
    naBlock(incHead, after ? after.region.y : -Infinity, "benefits.income", "Income Benefit");
  }

  /* ── Definitions ── */
  const defsText = (re: RegExp) => {
    for (const p of doc.pages) {
      const flow = norm(p.lines.map((l) => l.text).join(" "));
      const m = re.exec(flow);
      if (m) return { m, loc: { page: p, region: p.lines.find((l) => norm(l.text).includes(m[0].slice(0, 20)))?.region ?? p.lines[0].region } };
    }
    return null;
  };
  const DEFS = "Definitions";
  {
    const d = defsText(/Policy Anniversary ?- ?means the annual anniversary of the Date of Risk Commencement/);
    set("definitions.policy_anniversary_anchor", d
      ? { state: "found", value: "risk_commencement_date", raw: d.m[0], source: src(d.loc, d.m[0], `${DEFS}: Policy Anniversary`) }
      : { state: "missing", reason: "The definition of Policy Anniversary was not found." });
    const t = defsText(/Total Premiums Paid ?- ?means total of all the premiums received, excluding ([^.;]+)[.;]/);
    set("definitions.total_premiums_paid_excludes", t
      ? { state: "found", value: t.m[1].split(/,| and /).map((x) => x.trim().replace(/^any /, "")).filter(Boolean), raw: t.m[0], source: src(t.loc, t.m[0], `${DEFS}: Total Premiums Paid`) }
      : { state: "missing", reason: "The definition of Total Premiums Paid was not found." });
    const a = defsText(/Annualized Premium shall be the premium amount payable in a year chosen by the policyholder, excluding ([^.;]+?)(?:, if any)?[.;]/);
    set("definitions.annualized_premium_excludes", a
      ? { state: "found", value: a.m[1].split(/,| and /).map((x) => x.trim().replace(/^the /, "")).filter(Boolean), raw: a.m[0], source: src(a.loc, a.m[0], `${DEFS}: Annualized Premium`) }
      : { state: "missing", reason: "The definition of Annualized Premium was not found." });
  }

  /* ── Grace (general clause) ── */
  const pay = clauseText(doc, /^3\. Payment and cessation of Premiums$/, /^4\. |^Part D$/);
  clauseField("grace.rule", pay, "Part C 3. Payment and cessation of Premiums",
    /grace period of (\d+) days for monthly Premium paying frequency and (\d+) days for other Premium paying frequencies/,
    (m) => ({ monthlyDays: Number(m[1]), otherDays: Number(m[2]) }), "the grace period");

  /* ── Part D 1: Surrender ── */
  const D1 = "Part D 1. Surrender Value";
  const surr = clauseText(doc, /^1\. Surrender Value$/, /^2\. Lapsed Policies/i, { afterRe: /^Part D$/ });
  clauseField("surrender.selection", surr, D1, /The Surrender Benefit will be higher of GSV \(Guaranteed Surrender Value\) and SSV \(Special Surrender Value\)/, () => "higher_of_gsv_ssv", "the surrender benefit");
  clauseField("surrender.gsv_acquisition_min_premium_years", surr, D1,
    /acquire a Guaranteed Surrender Value \(GSV\) upon the payment of at least first (\d+) \((\w+)\) years' premiums/,
    (m) => (NUMBER_WORDS[m[2].toLowerCase()] === Number(m[1]) ? Number(m[1]) : null), "when GSV is acquired");
  const MULT = " ?(?:×|x) ?";
  const DIV = " ?÷ ?";
  clauseField("surrender.gsv_formula", surr, D1,
    new RegExp(`Guaranteed Surrender Value \\(GSV\\) = Max \\(GSV Factor${MULT}Total premiums paid ?- ?Survival Benefits applicable till date, 0\\)`),
    () => op("max", op("sub", op("mul", v("gsv_factor"), v("total_premiums_paid")), v("survival_benefits_till_date")), num(rat(0))) as Expr,
    "the GSV formula");
  readGsvBands();
  clauseField("surrender.ssv_basis", surr, D1, /SSV shall be calculated as the discounted value of all outstanding survival and maturity benefits/, () => "discounted_outstanding_survival_and_maturity_benefits", "the SSV basis");
  clauseField("surrender.ssv_reference_tenor", surr, D1,
    /yields of the (\d+) years G-Sec security for policy term up to (\d+) years and (\d+) years G-Sec security for policy term greater than (\d+) years/,
    (m) => (m[2] === m[4] ? { upToTermYears: Number(m[2]), tenorUpTo: Number(m[1]), tenorAbove: Number(m[3]) } : null), "the SSV reference bond");
  clauseField("surrender.ssv_discount_rule", surr, D1,
    /Annualized Yield on reference government bond \+ k, rounded up to the nearest (\d+) basis points\.? Where k = (\d+) basis points.*?effective from (\d+)(?:st|nd|rd|th) February and (\d+)(?:st|nd|rd|th) August/,
    (m): RateRule => ({ base: "annualized_yield_reference_gsec", roundUpBps: Number(m[1]), roundBeforeSpread: false, spread: { bps: Number(m[2]) }, reviewDayMonth: [{ day: Number(m[3]), month: 2 }, { day: Number(m[4]), month: 8 }] }),
    "the SSV discount rate rule");
  clauseField("surrender.ssv_printed_rate", surr, D1, /SSV factors have been derived using a discount rate of (\d+(?:\.\d+)?)%/, (m) => percentNumberToBps(m[1]), "the printed SSV rate");

  function readGsvBands() {
    const page = surr ? doc.pages.find((p) => surr.pages.includes(p.index) && p.lines.some((l) => /^Policy Year GSV Factor$/.test(norm(l.text)))) : null;
    if (!page) return set("surrender.gsv_factor_bands", { state: "missing", reason: "The GSV factor table was not found." });
    const rows = tableRows(page, /^Policy Year GSV Factor$/, /^SSV shall be calculated/, /^\d+%/, /^(\d+( to .*)?$|\(Policy Term less)/);
    const header = page.lines.find((l) => /^Policy Year GSV Factor$/.test(norm(l.text)))!;
    const loc = { page, region: header.region };
    if (!rows) return set("surrender.gsv_factor_bands", { state: "missing", reason: "The GSV factor table was not found." });
    const raw = rows.map((r) => `${r.left} | ${r.right}`).join("; ");
    const ramp = op("add", num(rat(1, 2)), op("div", op("mul", num(rat(2, 5)), op("sub", v("policy_year"), num(rat(7)))), op("sub", v("policy_term"), num(rat(8)))));
    const expected: { left: RegExp; right: RegExp; band: (m: RegExpExecArray) => GsvBand | null }[] = [
      { left: /^2$/, right: /^(\d+)%$/, band: (m) => flat(2, 2, m[0]) },
      { left: /^3$/, right: /^(\d+)%$/, band: (m) => flat(3, 3, m[0]) },
      { left: /^4 to 7$/, right: /^(\d+)%$/, band: (m) => flat(4, 7, m[0]) },
      { left: /^8 to \(Policy Term less 2\)$/, right: new RegExp(`^50% \\+ 40%${MULT}\\(Policy Year ?- ?7\\)${DIV}\\(Policy Term ?- ?8\\)$`), band: (m) => ({ from: 8, to: "term_minus_2", factor: ramp, raw: m[0] }) },
      { left: /^\(Policy Term less 1\) to Policy Term$/, right: /^(\d+)%$/, band: (m) => flat("term_minus_1", "term", m[0]) },
    ];
    function flat(from: GsvBand["from"], to: GsvBand["to"], pct: string): GsvBand | null {
      const r = parsePercentText(pct);
      return r ? { from, to, factor: num(r), raw: pct } : null;
    }
    if (rows.length !== expected.length) {
      return set("surrender.gsv_factor_bands", { state: "unsupported", reason: `The GSV factor table has ${rows.length} rows; the supported edition has ${expected.length}. Not read.`, raw, source: src(loc, null, D1) });
    }
    const bands: GsvBand[] = [];
    for (let i = 0; i < rows.length; i++) {
      const lm = expected[i].left.exec(rows[i].left);
      const rm = expected[i].right.exec(rows[i].right);
      const b = lm && rm ? expected[i].band(rm) : null;
      if (!b) return set("surrender.gsv_factor_bands", { state: "unsupported", reason: `GSV table row "${rows[i].left}" was not read exactly. Not guessed.`, raw, source: src(loc, null, D1) });
      bands.push(b);
    }
    set("surrender.gsv_factor_bands", { state: "found", value: bands, raw, source: src(loc, "GSV factor table: Policy Year 2, 3, 4 to 7, 8 to (Policy Term less 2), (Policy Term less 1) to Policy Term", D1) });
  }

  /* ── Part D 2: lapse and paid-up ── */
  const D2 = "Part D 2. Lapsed Policies and Paid-Up policies";
  const lapse = clauseText(doc, /^2\. Lapsed Policies and Paid-Up policies$/i, /^3\. Revival of the Policy$/, { afterRe: /^Part D$/ });
  clauseField("status.lapse_without_gsv", lapse, D2, /has not acquired a GSV, your Policy's status will be altered to lapsed status and the cover will cease.*No Benefits shall be payable under a lapsed Policy/, () => "lapsed_cover_ceases_no_benefits", "lapse without GSV");
  clauseField("status.lapse_with_gsv", lapse, D2, /has acquired a GSV, your Policy's status will be altered to paid- ?up status/, () => "paid_up", "paid-up on lapse");
  clauseField("status.paid_up_formula", lapse, D2,
    new RegExp(`Paid-up value = survival\\/maturity\\/death payout \\(as applicable\\)${MULT}Number of premiums paid${DIV}Total Number of premiums payable`),
    () => op("div", op("mul", v("payout"), v("premiums_paid_count")), v("premiums_payable_count")) as Expr, "the paid-up formula");

  /* ── Part D 3: revival ── */
  const D3 = "Part D 3. Revival of the Policy";
  const rev = clauseText(doc, /^3\. Revival of the Policy$/, /^4\. Discount rate$/, { afterRe: /^Part D$/ });
  clauseField("revival.window", rev, D3, /within (\w+) years from the due date of the first unpaid Premium and before the expiry of the Policy Term/,
    (m) => { const n = NUMBER_WORDS[m[1].toLowerCase()] ?? (/^\d+$/.test(m[1]) ? Number(m[1]) : null); return n ? { years: n, from: "due_date_of_first_unpaid_premium", beforeTermExpiry: true } : null; }, "the revival window");
  clauseField("revival.conditions", rev, D3, /subject to satisfactory evidence of continued insurability of the Life Assured and payment of outstanding Premiums with interest/,
    () => ["satisfactory evidence of continued insurability of the Life Assured", "payment of outstanding Premiums with interest", "terms and conditions the insurer may specify"], "the revival conditions");
  clauseField("revival.printed_rate", rev, D3, /current rate of interest is (\d+(?:\.\d+)?)% p\.a/, (m) => percentNumberToBps(m[1]), "the printed revival interest rate");
  clauseField("revival.rate_rule", rev, D3, avgRule(), buildAvg, "the revival interest rule");

  function avgRule() {
    return /Average Annuali[sz]ed 10-year benchmark G-Sec Yield \(over last 6 months (?:&|and) rounded up to the nearest (\d+) bps\) \+ (\d+(?:\.\d+)?)%.*?effective from (\d+)(?:st|nd|rd|th) February and (\d+)(?:st|nd|rd|th) August/;
  }
  function buildAvg(m: RegExpExecArray): RateRule | null {
    const spread = percentNumberToBps(m[2]);
    return spread ? { base: "average_annualized_10y_gsec_6_months", roundUpBps: Number(m[1]), roundBeforeSpread: true, spread, reviewDayMonth: [{ day: Number(m[3]), month: 2 }, { day: Number(m[4]), month: 8 }] } : null;
  }

  /* ── Part D 4: general discount rate (separate from the SSV rule) ── */
  const D4 = "Part D 4. Discount rate";
  const disc = clauseText(doc, /^4\. Discount rate$/, /^5\. /, { afterRe: /^Part D$/ });
  clauseField("discount_rate.general_rule", disc, D4,
    /Annualized Yield on reference government bond \+ k, rounded up to the nearest (\d+) basis points\.? Where k = (\d+) basis points/,
    (m): RateRule => ({ base: "annualized_yield_reference_gsec", roundUpBps: Number(m[1]), roundBeforeSpread: false, spread: { bps: Number(m[2]) }, reviewDayMonth: [] }),
    "the general discount rate rule");

  /* ── Part D 8: loans ── */
  const D8 = "Part D 8. Loans";
  const loan = clauseText(doc, /^8\. Loans:?$/, /^9\. |^10\. /, { afterRe: /^Part D$/ });
  clauseField("loan.cap_pct_of_surrender_value", loan, D8, /The loan amount will be subject to a maximum of (\d+(?:\.\d+)?%) of the surrender value/, (m) => pctToBps(m[1]), "the loan limit");
  clauseField("loan.deduction_before_benefits", loan, D8, /Before any benefits are paid out, loan outstanding together with the interest thereon will be deducted/, () => true, "the loan deduction");
  clauseField("loan.foreclosure", loan, D8,
    /For other than in-force and fully paid up policies, in case the outstanding loan amount including interest exceeds (\d+(?:\.\d+)?%) of surrender value, the policy shall be foreclosed/,
    (m) => { const b = pctToBps(m[1]); return b ? { appliesTo: "other_than_in_force_and_fully_paid_up", thresholdPctOfSurrenderValue: b, comparison: "strictly_greater" } : null; },
    "the foreclosure condition");
  clauseField("loan.foreclosure_exemption", loan, D8,
    /For inforce and fully paid up policy, the policy shall not be foreclosed on the ground of outstanding loan amount including interest exceeding the surrender value/,
    () => ({ statuses: ["in_force", "fully_paid_up"], groundWording: "exceeding_the_surrender_value" }), "the foreclosure exemption");
  clauseField("loan.rate_fixed_for_term_clause", loan, D8, /Once the rate of interest is decided it shall not change for the entire Policy Term/, () => true, "the fixed-rate clause");
  clauseField("loan.rate_revised_until_next_revision_clause", loan, D8, /In case upon review the interest rate is revised, the same shall apply until next revision/, () => true, "the revision clause");
  clauseField("loan.rate_rule", loan, D8, avgRule(), buildAvg, "the loan interest rule");
  clauseField("loan.printed_rate", loan, D8, /The current interest rate on loan is (\d+(?:\.\d+)?)% p\.a/, (m) => percentNumberToBps(m[1]), "the printed loan rate");
  clauseField("loan.msme_concessions", loan, D8,
    /Female policyholder: interest rate shall be reduced by (\d+(?:\.\d+)?)%.*?Other than female policyholders: interest rate shall be reduced by (\d+(?:\.\d+)?)%/,
    (m) => { const a = percentNumberToBps(m[1]); const b = percentNumberToBps(m[2]); return a && b ? [{ who: "female", reductionBps: a.bps }, { who: "other_than_female", reductionBps: b.bps }] : null; },
    "the MSME concessions");

  /* ── Product options available (separate from what this schedule selected) ── */
  const defer = findLines(doc, /^7\. Deferral of Survival Benefit\(s\):?$/)[0];
  set("options.deferral_available", defer ? { state: "found", value: true, raw: norm(defer.line.text), source: src({ page: defer.page, region: defer.line.region }, norm(defer.line.text), "Part D 7. Deferral of Survival Benefit(s)") } : { state: "missing", reason: "Deferral clause not found." });
  const offset = findLines(doc, /^10\. Premium offset$/i)[0];
  set("options.premium_offset_available", offset ? { state: "found", value: true, raw: norm(offset.line.text), source: src({ page: offset.page, region: offset.line.region }, norm(offset.line.text), "Part D 10. Premium offset") } : { state: "missing", reason: "Premium offset clause not found." });

  /* ── Points the advisor must decide, raised from the wording itself ── */
  if (fields["surrender.gsv_factor_bands"]?.state === "found") {
    flags.push({
      id: "gsv_factor_rounding_not_stated", fieldKeys: ["surrender.gsv_factor_bands"], blocksCalculation: true,
      note: "The GSV factor for years 8 to (term less 2) is a formula, and the clause does not say how it is rounded. The insurer's benefit illustration for this product matches whole-percent rounding. Confirm with the insurer which applies.",
      choices: ["exact_as_printed", "whole_percent_as_in_illustration"],
    });
  }
  flags.push({
    id: "survival_benefit_deduction_timing", fieldKeys: ["surrender.gsv_formula", "benefits.survival_recurring"], blocksCalculation: true,
    note: "GSV takes off \"Survival Benefits applicable till date\". The clause does not say whether that means payouts made by the surrender date or payouts for completed policy years. The insurer's illustration uses completed years. Confirm with the insurer.",
    choices: ["payouts_made_by_surrender_date", "payouts_for_completed_policy_years"],
  });
  flags.push({
    id: "ssv_needs_current_rate", fieldKeys: ["surrender.ssv_discount_rule", "surrender.ssv_printed_rate"], blocksCalculation: true,
    note: "SSV needs the current G-Sec based discount rate and the insurer's SSV method. The 9.25% printed in the document is the rate the factors were derived with, not today's rate. The surrender value (higher of GSV and SSV) cannot be worked out from the document alone.",
    choices: [],
  });
  if (fields["loan.rate_fixed_for_term_clause"]?.state === "found" && fields["loan.rate_revised_until_next_revision_clause"]?.state === "found") {
    flags.push({
      id: "loan_rate_clauses_conflict", fieldKeys: ["loan.rate_fixed_for_term_clause", "loan.rate_revised_until_next_revision_clause", "loan.rate_rule"], blocksCalculation: true,
      note: "One loan clause says a decided rate does not change for the whole term; another says a revised rate applies until the next revision. Ask the insurer which applies before using any loan interest rate.",
      choices: [],
    });
  }
  if (fields["loan.msme_concessions"]?.state === "found") {
    flags.push({
      id: "msme_concession_needs_eligibility", fieldKeys: ["loan.msme_concessions"], blocksCalculation: false,
      note: "Lower loan interest for MSME owners applies only with evidence of eligibility and the insurer's terms. It is never applied automatically.",
      choices: [],
    });
  }
  if (fields["loan.foreclosure_exemption"]?.state === "found") {
    flags.push({
      id: "foreclosure_exemption_wording", fieldKeys: ["loan.foreclosure", "loan.foreclosure_exemption"], blocksCalculation: false,
      note: "Foreclosure at more than 90% of surrender value applies to policies other than in-force and fully paid-up. For in-force and fully paid-up policies the exemption is worded as loan plus interest exceeding the surrender value. A reduced paid-up policy is not fully paid-up.",
      choices: ["noted"],
    });
  }
  const ocrFields = (Object.entries(fields) as [FieldKey, FieldState<unknown>][])
    .filter(([, f]) => (f.state === "found" || f.state === "not_applicable") && f.source.method === "ocr").map(([k]) => k);
  if (ocrFields.length) {
    flags.push({
      id: "read_by_ocr", fieldKeys: ocrFields, blocksCalculation: false,
      note: "These values were read from a scanned page. Check each number, date and percentage against the document before confirming.",
      choices: [],
    });
  }
  return { fields, flags };
}

export const hdfcClick2AchieveV02: PolicyAdapter = {
  id: ID,
  version: VERSION,
  insurer: "HDFC Life",
  product: "Click 2 Achieve",
  uin: UIN,
  supports: `HDFC Life Click 2 Achieve, UIN ${UIN}, option ${OPTION}, benefit choice ${BENEFIT}, in the policy document layout seen so far.`,
  identify,
  parse,
};

// Silence unused-import lint for helpers kept for future rows.
void div;
