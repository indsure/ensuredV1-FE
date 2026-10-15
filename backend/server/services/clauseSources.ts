/**
 * Clause source quotes and the premium block, checked while the policy text is
 * still in memory.
 *
 * The policy text is deliberately not retained after an audit (see the note at
 * the end of runAnalysisPipeline), so this is the only place a quote can be
 * checked against the document it claims to come from. Founder rule,
 * 2026-10-15: "if we dont find, how are we quoting it? we have to be sure about
 * it." So every gate here fails closed. A quote that does not pass is removed
 * entirely and the finding is shown without one. Nothing unverified is stored.
 *
 * The model writes `source_quote` (a plain string). The server alone writes
 * `source`, and deletes any `source` the model wrote, so `verified: true` can
 * only ever come from this file.
 */
import { appearsInDocument } from "../utils/policyWordingsFetcher";
import { containsPersonalData } from "../lib/pii";
import { parseRupees } from "../../../shared/policyNumbers";
import type { ClauseSource, PolicyPremium } from "../../../shared/policy";

type QuoteOrigin = ClauseSource["origin"];
type PremiumFrequency = NonNullable<PolicyPremium["frequency"]>;

export interface QuoteDocuments {
  /** The uploaded policy text the model saw, companion covers excluded. */
  evidence: string;
  /** The insurer's official wording the model saw, if one was matched. */
  wordings: string | null;
  insuredNames: unknown;
}

/**
 * The clause findings that carry a quote. Narrative fields (where_policy_fails,
 * deductions, the verdict) are left out on purpose: they summarise several
 * clauses, so asking for one sentence would invite a stitched-together quote.
 * personal_waiting_periods is left out too: those are person-specific
 * exclusions from the schedule, so the sentence is about the insured's health.
 */
export const QUOTE_FIELD_PATHS: readonly (readonly string[])[] = [
  ["claim_risk_analysis", "room_rent"],
  ["claim_risk_analysis", "co_payment"],
  ["claim_risk_analysis", "sub_limits"],
  ["claim_risk_analysis", "deductibles"],
  ["waiting_period_analysis", "initial_waiting_period"],
  ["waiting_period_analysis", "pre_existing_disease"],
  ["waiting_period_analysis", "specific_diseases"],
  ["waiting_period_analysis", "maternity"],
  ["coverage_structure", "restoration"],
];

/** Squashed length floor. Below this a "quote" is a phrase that could match
 *  anywhere in a long document and proves nothing about the clause. */
const MIN_QUOTE_CHARS = 15;
/** One sentence, not a paragraph. */
const MAX_QUOTE_CHARS = 400;

const squashedLength = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").length;

/** True when the quote names any insured person. Whole names, and each part of
 *  a name that is four letters or longer, matched as whole words. */
export function mentionsInsuredName(quote: string, insuredNames: unknown): boolean {
  if (!Array.isArray(insuredNames)) return false;
  const hay = ` ${quote.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  for (const raw of insuredNames) {
    if (typeof raw !== "string") continue;
    const parts = raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
    if (parts.length === 0) continue;
    if (hay.includes(` ${parts.join(" ")} `)) return true;
    for (const p of parts) {
      if (p.length >= 4 && hay.includes(` ${p} `)) return true;
    }
  }
  return false;
}

/**
 * Gate 1: is the sentence really in a document the model was given, and which
 * one? The uploaded policy wins when it is in both.
 * Gate 2: is it clause text and not the schedule page? Any personal identifier
 * or insured name drops it.
 */
export function verifyQuote(raw: unknown, docs: QuoteDocuments): ClauseSource | null {
  if (typeof raw !== "string") return null;
  const quote = raw.replace(/\s+/g, " ").trim();
  if (quote.length === 0 || quote.length > MAX_QUOTE_CHARS) return null;
  if (squashedLength(quote) < MIN_QUOTE_CHARS) return null;
  // Paraphrase markers: a verbatim sentence has no gap in it.
  if (/\.\.\.|…|\[|\]/.test(quote)) return null;

  let origin: QuoteOrigin | null = null;
  if (appearsInDocument(quote, docs.evidence)) origin = "uploaded";
  else if (docs.wordings && appearsInDocument(quote, docs.wordings)) origin = "official_wording";
  if (!origin) return null;

  if (containsPersonalData(quote)) return null;
  if (mentionsInsuredName(quote, docs.insuredNames)) return null;

  return { quote, origin, verified: true };
}

function nodeAt(parsed: any, path: readonly string[]): any {
  let node = parsed;
  for (const key of path) {
    if (!node || typeof node !== "object") return null;
    node = node[key];
  }
  return node && typeof node === "object" && !Array.isArray(node) ? node : null;
}

/**
 * Replace every model-written `source_quote` with a server-verified `source`,
 * or with nothing. Returns how many quotes were offered and how many survived.
 */
export function attachClauseSources(parsed: any, docs: QuoteDocuments): { offered: number; kept: number } {
  let offered = 0;
  let kept = 0;
  for (const path of QUOTE_FIELD_PATHS) {
    const node = nodeAt(parsed, path);
    if (!node) continue;
    const candidate = node.source_quote;
    delete node.source_quote;
    delete node.source;
    if (candidate == null || candidate === "") continue;
    offered++;
    const source = verifyQuote(candidate, docs);
    if (source) {
      node.source = source;
      kept++;
    }
  }
  // Fields outside the list never carry a quote, whatever the model wrote.
  const personal = parsed?.waiting_period_analysis?.personal_waiting_periods;
  if (Array.isArray(personal)) {
    for (const p of personal) {
      if (p && typeof p === "object") {
        delete p.source_quote;
        delete p.source;
      }
    }
  }
  return { offered, kept };
}

const FREQUENCIES: readonly PremiumFrequency[] = ["annual", "half_yearly", "quarterly", "monthly", "single"];

/**
 * Keep the premium only when it is a real positive rupee amount. The evidence
 * line comes off the schedule page, which is where names and policy numbers
 * live, so it passes the same personal-data gate as a clause quote or is
 * dropped. The amount stands without it.
 */
export function normalizePremium(parsed: any, insuredNames: unknown): void {
  if (!parsed || typeof parsed !== "object") return;
  const p = parsed.premium;
  if (!p || typeof p !== "object") {
    parsed.premium = null;
    return;
  }
  const amount = parseRupees(p.amount);
  if (!amount.ok || amount.value <= 0) {
    parsed.premium = null;
    return;
  }
  const frequency = FREQUENCIES.includes(p.frequency) ? (p.frequency as PremiumFrequency) : null;
  const gst = typeof p.gst_included === "boolean" ? p.gst_included : null;
  let evidence: string | null = typeof p.evidence === "string" ? p.evidence.replace(/\s+/g, " ").trim() : null;
  if (
    !evidence ||
    evidence.length > MAX_QUOTE_CHARS ||
    containsPersonalData(evidence) ||
    mentionsInsuredName(evidence, insuredNames)
  ) {
    evidence = null;
  }
  parsed.premium = { amount: amount.value, frequency, gst_included: gst, evidence } satisfies PolicyPremium;
}
