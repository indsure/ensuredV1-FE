/**
 * Adapter: ABSLI Nishchit Aayush Plan, UIN 109N137V01, benefit option Long Term
 * Income, income variant Level Income with lumpsum Benefit.
 *
 * Built from one privately supplied policy document (not in the repo) and
 * checked against synthetic fixtures that copy its layout. Another UIN, option,
 * variant, or a document missing the headings below is refused.
 *
 * Read from the document's own wording only:
 *   - Policy Schedule (Part A): term, premium paying term, mode, annualized
 *     premium, modal loading, issue date, last premium date, income benefit and
 *     its frequency and first payment date, sum assured, enhanced lumpsum.
 *   - Part C: sum assured on death (higher of sum assured and 105% of premiums
 *     paid), grace periods. Part D: GSV rule, two years to acquire, loan cap.
 *   - Annexure 1: the GSV factor column for this policy's term, every year.
 *   - The benefit illustration (part of the contract): income is paid in every
 *     policy year of the term, which fixes the last income date.
 *
 * Customer identity rows (names, policy number, addresses, contacts, nominee)
 * are never read.
 */

import { parseIsoDate } from "../../../../../shared/policyNumbers";
import { paiseFromRupeeText, type Bps, type Paise } from "../../../../../shared/exactMath";
import type { FieldState, Frequency, ParsedFields, ReviewFlag, SourceRef } from "../../../../../shared/policyDocTypes";
import { findLines, norm, sourceOf, type Hit } from "../docQuery";
import type { Identification, PolicyAdapter } from "../registry";
import type { DocumentText, PageText, TextItem } from "../textLayer";

const ID = "absli-nishchit-aayush-109N137V01-long-term-income-level-lumpsum";
const VERSION = "1.0.0";
const UIN = "109N137V01";
const OPTION = "Long Term Income";
const VARIANT = "Level Income with lumpsum Benefit";

const TITLE_RE = /^ABSLI Nishchit Aayush Plan Part A$/;
const UIN_RE = /^Product Unique Identification Number : ([0-9]{3}[A-Z][0-9]{3}V[0-9]{2})\b/;
const FINGERPRINT: [string, RegExp][] = [
  ["Part D heading", /^PART D - POLICY TERMS AND CONDITIONS$/],
  ["4. Surrender Benefits", /^4\. Surrender Benefits$/],
  ["5. Policy Loan", /^5\. Policy Loan$/],
  ["Annexure 1", /^ANNEXURE 1: GSV Factor \(% of Total Premiums Paid\)$/],
  ["Benefit illustration", /^Your Benefit Illustration$/],
];

const FREQ: Record<string, Frequency> = { "Annual(1)": "annual", "Semi-Annual(2)": "half_yearly", "Quarterly(4)": "quarterly", "Monthly(12)": "monthly" };
const PER_YEAR: Record<string, number> = { annual: 1, half_yearly: 2, quarterly: 4, monthly: 12 };

function ddmmyyyy(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const p = parseIsoDate(`${m[3]}-${m[2]}-${m[1]}`);
  return p.ok ? p.value : null;
}
const money = (s: string): Paise | null => (/^₹ ?[\d,]+\.\d{2}$/.test(s.trim()) ? paiseFromRupeeText(s.replace(/₹/, "").trim()) : null);
function pctBps(s: string): Bps | null {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?%$/.exec(s.trim());
  if (!m) return null;
  return { bps: Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0")) };
}
function addYears(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(y + n).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function identify(doc: DocumentText): Identification {
  if (!findLines(doc, TITLE_RE).length) return { result: "no_match", reason: "Not an ABSLI Nishchit Aayush Plan policy document (title not found)." };
  const uins = new Set(findLines(doc, UIN_RE).map((h) => h.match[1]));
  if (uins.size === 0) return { result: "no_match", reason: "ABSLI Nishchit Aayush Plan, but the product UIN could not be read." };
  if (uins.size > 1) return { result: "conflict", reason: "The schedule shows more than one product UIN." };
  if (Array.from(uins)[0] !== UIN) return { result: "no_match", reason: `ABSLI Nishchit Aayush Plan version ${Array.from(uins)[0]} is not supported yet (only ${UIN}).` };
  const opt = findLines(doc, /^Benefit Option : (.+?) Income Variant : (.+)$/);
  if (opt.length !== 1) return { result: "no_match", reason: "The benefit option row was not found exactly once." };
  if (opt[0].match[1] !== OPTION) return { result: "no_match", reason: `Benefit option "${opt[0].match[1]}" is not supported yet (only ${OPTION}).` };
  if (variantOf(opt[0]) !== VARIANT) return { result: "no_match", reason: "This income variant is not supported yet." };
  for (const [name, re] of FINGERPRINT) if (!findLines(doc, re).length) return { result: "no_match", reason: `Expected heading missing: ${name}.` };
  return { result: "match" };
}

/** The income variant wraps onto the next line of the schedule. */
function variantOf(h: Hit): string {
  const next = h.page.lines[h.lineIndex + 1];
  const tail = next && /^lumpsum Benefit$/.test(norm(next.text)) ? " lumpsum Benefit" : "";
  return norm(h.match[2] + tail);
}

function parse(doc: DocumentText): { fields: ParsedFields; flags: ReviewFlag[] } {
  const ctx = { sha256: doc.sha256, parser: ID, parserVersion: VERSION };
  const fields: ParsedFields = {};
  const flags: ReviewFlag[] = [];
  const src = (h: { page: PageText; line: { region: any; text: string } }, clause: string | null): SourceRef =>
    sourceOf({ page: h.page, region: h.line.region }, norm(h.line.text), clause, ctx);
  const set = (k: keyof ParsedFields, v: FieldState<any>) => { (fields as any)[k] = v; };
  const missing = (k: keyof ParsedFields, reason: string) => set(k, { state: "missing", reason });

  /** One schedule row, matched exactly once; `read` turns the captured text into a value. */
  function one<T>(k: keyof ParsedFields, re: RegExp, read: (m: RegExpExecArray) => T | null, clause = "Part A Policy Schedule") {
    const hits = findLines(doc, re);
    if (!hits.length) return missing(k, "Not found in the document.");
    const distinct = new Set(hits.map((h) => h.match.slice(1).join("|")));
    if (distinct.size > 1) return set(k, { state: "conflicting", reason: "The document gives different values.", candidates: hits.map((h) => ({ raw: h.match[0], source: src(h, clause) })) });
    const v = read(hits[0].match);
    if (v === null) return set(k, { state: "unsupported", reason: "Printed in a form this reader does not accept.", raw: hits[0].match[0], source: src(hits[0], clause) });
    set(k, { state: "found", value: v, raw: hits[0].match[0], source: src(hits[0], clause) });
  }
  const val = <T,>(k: keyof ParsedFields): T | undefined => ((fields as any)[k]?.state === "found" ? (fields as any)[k].value : undefined);

  // Identity (contract-level, never the customer's).
  const t = findLines(doc, TITLE_RE)[0];
  set("identity.insurer", { state: "found", value: "Aditya Birla Sun Life Insurance Company Limited", raw: "Aditya Birla Sun Life Insurance", source: src(t, "Part A") });
  set("identity.plan", { state: "found", value: "ABSLI Nishchit Aayush Plan", raw: norm(t.line.text), source: src(t, "Part A") });
  one("identity.uin", UIN_RE, (m) => m[1]);
  const opt = findLines(doc, /^Benefit Option : (.+?) Income Variant : (.+)$/)[0];
  set("identity.option", { state: "found", value: OPTION, raw: opt.match[0], source: src(opt, "Part A Benefit Information") });
  set("identity.benefit_choice", { state: "found", value: VARIANT, raw: variantOf(opt), source: src(opt, "Part A Benefit Information") });
  one("identity.linked", /^A Non-Linked Non-Participating Individual Savings Life Insurance Plan\b/i, () => "non_linked" as const, "Part A");
  one("identity.participating", /^A Non-Linked Non-Participating Individual Savings Life Insurance Plan\b/i, () => "non_participating" as const, "Part A");

  // Schedule.
  set("schedule.currency", { state: "found", value: "INR", raw: "₹", source: src(t, "Part A") });
  one("schedule.premium_paying_term_years", /^Premium Payment Term : (\d{1,2}) Years Policy Term : \d{1,3} Years$/, (m) => Number(m[1]));
  one("schedule.policy_term_years", /^Premium Payment Term : \d{1,2} Years Policy Term : (\d{1,3}) Years$/, (m) => Number(m[1]));
  one("schedule.frequency", /^Deferment Period : \d{1,2} Years? Premium Payment Mode : (\S+)$/, (m) => FREQ[m[1]] ?? null);
  one("schedule.annualized_premium", /^Modal Loading Factor : [\d.]+% Annualized Premium\* : (₹ ?[\d,]+\.\d{2})$/, (m) => money(m[1]));
  one("schedule.commencement_date", /Policy Issue Date : (\d{2}\/\d{2}\/\d{4})$/, (m) => ddmmyyyy(m[1]));
  one("schedule.final_premium_due_date", /^Last Premium due on : (\d{2}\/\d{2}\/\d{4})\b/, (m) => ddmmyyyy(m[1]));
  one("schedule.sum_assured_on_death", /Sum Assured : (₹ ?[\d,]+\.\d{2})$/, (m) => money(m[1]));
  set("definitions.policy_anniversary_anchor", (() => {
    const h = findLines(doc, /Policy Anniversary" means the date corresponds numerically with the Policy Issue Date/);
    return h.length ? { state: "found", value: "policy_issue_date", raw: h[0].match[0], source: src(h[0], "Part B Definitions") } : { state: "missing", reason: "Definition not found." };
  })() as any);

  // Instalment premium for Total Premiums Paid: the annualized premium per instalment, only when
  // there is no modal loading (the schedule's instalment figure includes taxes, which are excluded).
  {
    const ml = findLines(doc, /^Modal Loading Factor : ([\d.]+%) Annualized Premium/);
    const ap = val<Paise>("schedule.annualized_premium");
    const per = PER_YEAR[val<string>("schedule.frequency") ?? ""];
    if (ml.length === 1 && ml[0].match[1] === "0.00%" && ap && per && ap.paise % per === 0) {
      const v = { state: "found", value: { paise: ap.paise / per }, raw: `${ml[0].match[0]} (no modal loading)`, source: src(ml[0], "Part A Policy Schedule") } as const;
      set("schedule.instalment_premium_first_year", v as any);
      set("schedule.instalment_premium_renewal", v as any);
      set("schedule.premium_excludes_taxes", { state: "found", value: true, raw: "Annualized Premium excludes taxes", source: src(ml[0], "Part B Definitions") });
    } else {
      missing("schedule.instalment_premium_first_year", "Modal loading is not 0%, so the premium per instalment is not read.");
      missing("schedule.instalment_premium_renewal", "Modal loading is not 0%, so the premium per instalment is not read.");
    }
  }

  // Benefits.
  {
    const inc = findLines(doc, /^Income Benefit : (₹ ?[\d,]+\.\d{2}) Income Frequency : (\w+)$/);
    const first = findLines(doc, /^First Income Benefit Payment Date : (\d{2}\/\d{2}\/\d{4}) Sum Assured/);
    const issue = val<string>("schedule.commencement_date");
    const term = val<number>("schedule.policy_term_years");
    const everyYear = term ? illustrationIncomeEveryYear(doc, term) : null;
    const amount = inc.length === 1 ? money(inc[0].match[1]) : null;
    const from = first.length === 1 ? ddmmyyyy(first[0].match[1]) : null;
    if (inc.length === 1 && inc[0].match[2] === "Monthly" && amount && from && issue && term && everyYear) {
      set("benefits.survival_recurring", {
        state: "found", value: { amount, frequency: "monthly", from, to: addYears(issue, term) },
        raw: `${inc[0].match[0]}; ${first[0].match[0].replace(/ Sum Assured$/, "")}; income in every policy year of the illustration`,
        source: src(inc[0], "Part A Benefit Information"),
      });
    } else {
      set("benefits.survival_recurring", { state: "unsupported", reason: "The income amount, monthly frequency, first payment date or income period could not be read exactly." });
    }
    const lump = findLines(doc, /^Enhanced Guaranteed Lumpsum : (₹ ?[\d,]+\.\d{2}) Income Benefit Factor/);
    const lv = lump.length === 1 ? money(lump[0].match[1]) : null;
    if (lv && issue && term) {
      set("benefits.maturity", { state: "found", value: { amount: lv, date: addYears(issue, term) }, raw: lump[0].match[0], source: src(lump[0], "Part C 3. Maturity Benefit") });
      set("schedule.policy_end_date", { state: "found", value: addYears(issue, term), raw: "Policy Issue Date plus Policy Term", source: src(lump[0], "Part C 3. Maturity Benefit") });
    } else missing("benefits.maturity", "Enhanced Guaranteed Lumpsum not read.");
  }

  // Part C / D rules.
  one("death.min_pct_of_premiums_paid", /^- (\d{3})% of the Total Premiums Paid till the date of death$/, (m) => ({ bps: Number(m[1]) * 100 }), "Part C 1. Death Benefit");
  one("grace.rule", /Grace Period of (\d{2}) days \((\d{2}) days in case of monthly mode\)/, (m) => ({ monthlyDays: Number(m[2]), otherDays: Number(m[1]) }), "Part C 5. Grace Period");
  one("surrender.gsv_acquisition_min_premium_years", /^This Policy shall acquire a Surrender Value provided all the due Instalment Premiums for the first (two) Policy$/, () => 2, "Part D 4. Surrender Benefits");
  one("surrender.selection", /^The Surrender Value payable will be equal to the higher of Guaranteed Surrender Value and Special Surrender$/, () => "higher_of_gsv_ssv" as const, "Part D 4. Surrender Benefits");
  one("surrender.payout_deduction", /^- Any Survival Benefit already paid$/, () => "paid_before_surrender_date" as const, "Part D 4. Surrender Benefits");
  one("loan.cap_pct_of_surrender_value", /maximum is (\d{2})% of the then applicable Surrender Value/, (m) => ({ bps: Number(m[1]) * 100 }), "Part D 5. Policy Loan");

  // Annexure 1, this policy's term column.
  {
    const term = val<number>("schedule.policy_term_years");
    const table = term ? gsvColumn(doc, term) : null;
    if (table) set("surrender.gsv_factor_table", { state: "found", value: table.rows, raw: `Annexure 1 column for a ${term}-year policy term, years 1 to ${term}`, source: sourceOf({ page: table.page, region: table.region }, `GSV factor, policy term ${term}`, "Annexure 1", ctx) });
    else set("surrender.gsv_factor_table", { state: "unsupported", reason: "The GSV factor column for this policy term could not be read for every year." });
  }

  flags.push({
    id: "ssv_needs_current_rate", fieldKeys: ["surrender.selection"], choices: [], blocksCalculation: false,
    note: "The surrender value is the higher of the GSV and a special surrender value the insurer sets from time to time. Only the GSV can be worked out from the document.",
  });
  return { fields, flags };
}

/** GSV factors for every year 1..term from the Annexure 1 column headed with this term. */
function gsvColumn(doc: DocumentText, term: number): { rows: { year: number; pct: Bps }[]; page: PageText; region: any } | null {
  const head = findLines(doc, /^ANNEXURE 1: GSV Factor \(% of Total Premiums Paid\)$/);
  if (head.length !== 1) return null;
  for (const page of doc.pages.filter((p) => p.index >= head[0].page.index && p.index <= head[0].page.index + 3)) {
    const items = page.items;
    // Header rows: "Surrender" followed by policy terms on the same baseline.
    const headers = items.filter((i) => i.s.trim() === String(term) && items.some((s) => s.s.trim() === "Surrender" && Math.abs(s.y - i.y) <= 3 && s.x < i.x));
    if (headers.length !== 1) continue;
    const h = headers[0];
    const cx = h.x + h.w / 2;
    const rows: { year: number; pct: Bps }[] = [];
    const yearLabels = items.filter((i) => /^\d{1,3}$/.test(i.s.trim()) && i.y < h.y - 3 && i.x < h.x - 60).sort((a, b) => b.y - a.y);
    for (let year = 1; year <= term; year++) {
      const label = yearLabels.find((l) => Number(l.s.trim()) === year);
      if (!label) return null;
      const cell = items.filter((i: TextItem) => Math.abs(i.y - label.y) <= 3 && Math.abs(i.x + i.w / 2 - cx) <= 15 && /%$/.test(i.s.trim()));
      if (cell.length !== 1) return null;
      const b = pctBps(cell[0].s);
      if (!b || b.bps > 10000) return null;
      rows.push({ year, pct: b });
    }
    const last = yearLabels.find((l) => Number(l.s.trim()) === term)!;
    return { rows, page, region: { x: h.x - 5, y: last.y, w: h.w + 10, h: h.y - last.y } };
  }
  return null;
}

/**
 * True when the illustration lists a positive survival benefit in every policy
 * year 1..term (and stops there). Rows are rebuilt from word positions, since a
 * wide table can be split by the page's column detection.
 */
function illustrationIncomeEveryYear(doc: DocumentText, term: number): boolean {
  const ROW = /^(\d{1,3}) (?:[\d,]+|0) (?:[\d,]+|0) ([\d,]+) (?:[\d,]+|0) [\d,]+ [\d,]+ (?:[\d,]+|0) (?:[\d,]+|0)$/;
  const years = new Map<number, number>();
  for (const page of doc.pages) {
    if (!page.lines.some((l) => /^Your Benefit Illustration$/.test(norm(l.text)))) continue;
    // Anchor each row at its year number and read the eight cells to its right
    // (other text can sit beside the table on the same baseline).
    for (const a of page.items.filter((i) => /^\d{1,3}$/.test(i.s.trim()))) {
      const cells = page.items
        .filter((i) => i !== a && Math.abs(i.y - a.y) <= Math.max(2, a.h * 0.45) && i.x > a.x && i.s.trim())
        .sort((p, q) => p.x - q.x)
        .slice(0, 8);
      const m = ROW.exec(norm([a, ...cells].map((i) => i.s.trim()).join(" ")));
      if (m) years.set(Number(m[1]), Number(m[2].replace(/,/g, "")));
    }
  }
  for (let y = 1; y <= term; y++) if (!(years.get(y)! > 0)) return false;
  return !years.has(term + 1);
}

export const absliNishchitAayushV01: PolicyAdapter = {
  id: ID, version: VERSION, insurer: "Aditya Birla Sun Life Insurance", product: "ABSLI Nishchit Aayush Plan", uin: UIN,
  supports: "ABSLI Nishchit Aayush Plan (UIN 109N137V01), Long Term Income option, Level Income with lumpsum Benefit variant, as laid out in the Ver10/Nov/2022 policy contract.",
  identify, parse,
};
