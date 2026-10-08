/**
 * Product adapters, and the one place documents are matched to them.
 *
 * An adapter supports ONE observed layout of ONE product version: insurer +
 * full UIN (with its version) + option + benefit variant. It must refuse
 * anything else. A second product is a new module plus one register() call;
 * nothing here or in the calculator changes.
 *
 * Matching rules:
 *   - every adapter is asked; exactly one "match" wins
 *   - no match: unsupported, with each adapter's reason
 *   - more than one match, or an adapter that sees conflicting identity
 *     evidence (two UINs, two schedules): needs review
 *   - there is no nearest-product fallback and no model fallback
 */

import type { ParseOutcome, ParsedFields, ReviewFlag } from "../../../../shared/policyDocTypes";
import type { DocumentText } from "./textLayer";

export type Identification =
  | { result: "match" }
  | { result: "no_match"; reason: string }
  | { result: "conflict"; reason: string };

export interface PolicyAdapter {
  /** Stable id, e.g. "hdfc-click2achieve-101N186V02-dream-achiever-early-income". */
  id: string;
  /** Bumped whenever parsing changes; stored facts record it, and approvals never carry across versions. */
  version: string;
  insurer: string;
  product: string;
  uin: string;
  /** Plain description of exactly what this adapter supports, for advisors. */
  supports: string;
  identify(doc: DocumentText): Identification;
  /**
   * A general reader (for example the benefit-illustration reader). It is tried only when
   * no product-specific reader matched, so an exact reader always wins.
   */
  fallback?: boolean;
  parse(doc: DocumentText): { fields: ParsedFields; flags: ReviewFlag[] };
}

const adapters: PolicyAdapter[] = [];

export function register(a: PolicyAdapter): void {
  if (adapters.some((x) => x.id === a.id)) throw new Error(`adapter already registered: ${a.id}`);
  adapters.push(a);
}

export function registeredAdapters(): readonly PolicyAdapter[] {
  return adapters;
}

/** Match and parse. Never throws on document content: failures come back as reasons. */
export function identifyAndParse(doc: DocumentText, list: readonly PolicyAdapter[] = adapters): ParseOutcome {
  const specific = identifyWith(doc, list.filter((a) => !a.fallback));
  if (specific.status !== "unsupported") return specific;
  const general = identifyWith(doc, list.filter((a) => a.fallback));
  if (general.status === "unsupported") return { ...specific, reasons: [...specific.reasons, ...general.reasons.filter((r) => r !== "No product reader is registered.")] };
  return general;
}

function identifyWith(doc: DocumentText, list: readonly PolicyAdapter[]): ParseOutcome {
  const results = list.map((a) => ({ a, r: a.identify(doc) }));
  const conflicts = results.filter((x) => x.r.result === "conflict");
  const matches = results.filter((x) => x.r.result === "match");
  if (conflicts.length) {
    return { status: "needs_review", adapterId: null, adapterVersion: null, reasons: conflicts.map((x) => (x.r as any).reason), fields: {}, flags: [] };
  }
  if (matches.length > 1) {
    return { status: "needs_review", adapterId: null, adapterVersion: null, reasons: ["More than one product matched this document."], fields: {}, flags: [] };
  }
  if (!matches.length) {
    const reasons = results.map((x) => (x.r as any).reason).filter(Boolean);
    return { status: "unsupported", adapterId: null, adapterVersion: null, reasons: reasons.length ? reasons : ["No product reader is registered."], fields: {}, flags: [] };
  }
  const { a } = matches[0];
  try {
    const { fields, flags } = a.parse(doc);
    return { status: "supported", adapterId: a.id, adapterVersion: a.version, reasons: [], fields, flags };
  } catch {
    return { status: "needs_review", adapterId: a.id, adapterVersion: a.version, reasons: ["The product reader could not finish this document."], fields: {}, flags: [] };
  }
}
