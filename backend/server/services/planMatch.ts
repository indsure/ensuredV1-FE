/**
 * Client Plan Match (advisor portal only).
 *
 * After an advisor runs the cover calculator, pick the best plan from each
 * insurer the advisor works with, judged against what this client said:
 * travel abroad, the hospital they want, conditions in the family, deductibles,
 * parents' age, how much financial shock they can take. Spec, signed off
 * 2026-11-03: https://claude.ai/artifact/2QeP6jsCb1xXJYwy4uL1X1
 *
 * Pure: answers and catalogue plans in, picks and reasons out. No AI, no I/O.
 * Every need it reports names the catalogue clause it was read from, so the
 * advisor can show the client the wording behind each tick.
 */
import { AXES, toneFor, type AxisDatum, type WordingProfile } from "../types/wordingProfile";
import { scoreCompleteness } from "./planCompleteness";

export const MATCH_VERSION = "1.0.0";
export const MAX_PICKS = 3;

/** The calculator answers the match reads (a subset of UserInputs). */
export interface MatchAnswers {
  familyStructure?: string;
  exactAge?: number;
  spouseAge?: number;
  fatherAge?: number;
  motherAge?: number;
  globalTravel?: string;
  hospitalPreference?: string;
  recurringExpenses?: string;
  okWithDeductibles?: boolean;
  riskPosture?: string;
  preExistingConditions?: string[];
  spousePreExistingConditions?: string[];
  fatherPreExistingConditions?: string[];
  motherPreExistingConditions?: string[];
}

export interface MatchPlan {
  plan_key: string;
  insurer: string;
  plan_name: string;
  variant: string;
  max_si: number | null;
  score: number;                  // public completeness
  profile: WordingProfile;
  entry_age?: { adult_min: number | null; adult_max: number | null; segment: string | null } | null;
}

export type NeedKey = "abroad" | "room" | "deductible" | "ped" | "parents_copay" | "cover" | "age";
export type NeedStatus = "met" | "addon" | "unmet" | "unclear";

export interface Need {
  key: NeedKey;
  must: boolean;
  status: NeedStatus;
  /** The wording's own words for this clause, e.g. "Inbuilt (planned hospitalisation abroad)". */
  detail: string;
}

export interface PlanVerdict {
  plan_key: string;
  insurer: string;
  plan_name: string;
  variant: string;
  completeness: number;
  fit: number;
  needs: Need[];
  met: number;                    // needs met, an add-on counting as met
  addons: number;
  unclear: number;
  failed_must: Need | null;
}

export interface WhyNot {
  plan_key: string;
  insurer: string;
  plan_name: string;
  variant: string;
  completeness: number;
  /** fail: a must-have it fails. same_insurer: that insurer's pick is better. lower: ranked below the picks. */
  kind: "fail" | "same_insurer" | "lower";
  need: Need | null;
  met: number;
  of: number;
}

export interface MatchResult {
  version: string;
  needs: { key: NeedKey; must: boolean; why: string }[];
  adult_ages: number[];
  picks: PlanVerdict[];
  why_not: WhyNot[];
  /** No plan in the pool meets every must-have. */
  blocked: { need: NeedKey; closest: PlanVerdict | null; elsewhere: number } | null;
}

/* ── Answers to rules ───────────────────────────────────────────── */

const real = (xs?: string[]) => (xs ?? []).filter((c) => c && c !== "none");

export function adultAgesOf(a: MatchAnswers): number[] {
  const couple = (a.familyStructure ?? "").startsWith("Couple");
  const parents = a.familyStructure === "Parents included";
  return [a.exactAge, couple ? a.spouseAge : undefined, parents ? a.fatherAge : undefined, parents ? a.motherAge : undefined]
    .filter((n): n is number => typeof n === "number" && n >= 18 && n <= 110);
}

interface Rules {
  needs: { key: NeedKey; must: boolean; why: string }[];
  weights: Record<string, number>;
  adultAges: number[];
}

export function rulesFor(a: MatchAnswers, minSi: number): Rules {
  const needs: Rules["needs"] = [];
  const weights: Record<string, number> = {};
  const parents = a.familyStructure === "Parents included";
  const conditions = [
    ...real(a.preExistingConditions),
    ...((a.familyStructure ?? "").startsWith("Couple") ? real(a.spousePreExistingConditions) : []),
    ...(parents ? [...real(a.fatherPreExistingConditions), ...real(a.motherPreExistingConditions)] : []),
  ];

  if (a.globalTravel === "Yes, I travel abroad") needs.push({ key: "abroad", must: true, why: "travels abroad" });
  if (a.hospitalPreference === "Large private hospitals" || a.hospitalPreference === "Premium corporate hospitals") {
    needs.push({ key: "room", must: true, why: a.hospitalPreference });
  }
  if (a.okWithDeductibles === false) needs.push({ key: "deductible", must: true, why: "no deductible" });
  if (a.okWithDeductibles === true) weights.deductible = 0;
  if (conditions.length > 0) {
    weights.ped_waiting = 3;
    needs.push({ key: "ped", must: false, why: [...new Set(conditions)].join(", ") });
  }
  if (a.recurringExpenses === "Chronic but stable") {
    weights.ped_waiting = Math.max(weights.ped_waiting ?? 1, 2);
    weights.sub_limits = 1.5;
  }
  const parentAges = parents ? [a.fatherAge, a.motherAge].filter((n): n is number => typeof n === "number") : [];
  if (parentAges.some((n) => n >= 60)) {
    weights.copayment = 2;
    needs.push({ key: "parents_copay", must: false, why: `parent aged ${Math.max(...parentAges)}` });
  }
  if (a.riskPosture === "Zero financial shock") {
    weights.restoration = 1.5;
    weights.consumables = 1.5;
  }
  if (minSi > 0) needs.push({ key: "cover", must: true, why: `${Math.round(minSi / 1e5)} lakh` });
  const adultAges = adultAgesOf(a);
  if (adultAges.length > 0) needs.push({ key: "age", must: true, why: adultAges.join(", ") });
  return { needs, weights, adultAges };
}

/* ── One clause, one status ─────────────────────────────────────── */

const ADDON_RE = /optional|add-?on|rider|package|on payment of additional premium/i;
const axis = (key: string) => AXES.find((a) => a.key === key)!;
const datum = (p: WordingProfile, key: string): AxisDatum => {
  const v = p[key];
  return v && typeof v === "object" ? (v as AxisDatum) : { display: "" };
};

function needStatus(key: NeedKey, plan: MatchPlan, minSi: number, adultAges: number[]): Need {
  const p = plan.profile;
  const base = (status: NeedStatus, detail: string): Need => ({ key, must: false, status, detail });
  switch (key) {
    case "abroad": {
      const d = datum(p, "global_cover");
      const tone = toneFor(axis("global_cover"), d);
      if (tone === "good" && !d.optional) return base("met", d.display);
      // An add-on the wording offers keeps the plan in, ranked below inbuilt.
      // Catalogue extraction is uneven: some optional covers carry optional,
      // others only say so in the text, so both count.
      // "Optional (maternity only)" or "(emergency assistance only)" is a narrow
      // cover, not treatment abroad: the advisor has to confirm it.
      if (/\bonly\b/i.test(d.display ?? "")) return base("unclear", d.display);
      if (d.optional || ADDON_RE.test(d.display ?? "")) return base("addon", d.display);
      return base(tone === "unknown" ? "unclear" : "unmet", d.display || "not stated");
    }
    case "room": {
      const d = datum(p, "room_rent");
      const tone = toneFor(axis("room_rent"), d);
      return base(tone === "good" ? "met" : tone === "unknown" ? "unclear" : "unmet", d.display || "not stated");
    }
    case "deductible": {
      const d = datum(p, "deductible");
      const tone = toneFor(axis("deductible"), d);
      return base(tone === "good" ? "met" : tone === "unknown" ? "unclear" : "unmet", d.display || "not stated");
    }
    case "ped": {
      const d = datum(p, "ped_waiting");
      const tone = toneFor(axis("ped_waiting"), d);
      return base(tone === "good" ? "met" : tone === "unknown" ? "unclear" : "unmet", d.display || "not stated");
    }
    case "parents_copay": {
      const d = datum(p, "copayment");
      const tone = toneFor(axis("copayment"), d);
      return base(tone === "good" ? "met" : tone === "unknown" ? "unclear" : "unmet", d.display || "not stated");
    }
    case "cover": {
      if (plan.max_si == null) return base("unclear", "cover amount not stated in the wording");
      return base(plan.max_si >= minSi ? "met" : "unmet", `up to ${fmtAmount(plan.max_si)}`);
    }
    case "age": {
      const ea = plan.entry_age;
      const known = ea && (ea.adult_min != null || ea.adult_max != null);
      const range = known ? `${ea!.adult_min ?? "any"} to ${ea!.adult_max ?? "no limit"}` : "not stated";
      if (ea?.segment && !known) return base("unmet", `${ea.segment} plan, ages not confirmed`);
      // General plans take adults from 18 to at least 65, so an unstated age
      // only needs confirming when someone is past 60.
      if (!known) return base(adultAges.some((n) => n > 60) ? "unclear" : "met", "no entry age stated");
      const ok = adultAges.every((n) => (ea!.adult_min == null || n >= ea!.adult_min) && (ea!.adult_max == null || n <= ea!.adult_max));
      return base(ok ? "met" : "unmet", `entry age ${range}`);
    }
  }
}

function fmtAmount(n: number): string {
  if (n >= Number.MAX_SAFE_INTEGER) return "unlimited";
  if (n >= 1e7) return `₹${+(n / 1e7).toFixed(2)} Cr`;
  return `₹${+(n / 1e5).toFixed(2)} L`;
}

export function judge(plan: MatchPlan, rules: Rules, minSi: number): PlanVerdict {
  const needs = rules.needs.map((n) => ({ ...needStatus(n.key, plan, minSi, rules.adultAges), must: n.must }));
  const failed = needs.find((n) => n.must && n.status === "unmet") ?? null;
  return {
    plan_key: plan.plan_key,
    insurer: plan.insurer,
    plan_name: plan.plan_name,
    variant: plan.variant,
    completeness: plan.score,
    fit: scoreCompleteness(plan.profile, rules.weights).score,
    needs,
    met: needs.filter((n) => n.status === "met" || n.status === "addon").length,
    addons: needs.filter((n) => n.status === "addon").length,
    unclear: needs.filter((n) => n.status === "unclear").length,
    failed_must: failed,
  };
}

/** Better first: more needs met, then fewer add-ons, then fewer unknowns, then fit. */
export function compareVerdicts(a: PlanVerdict, b: PlanVerdict): number {
  return b.met - a.met || a.addons - b.addons || a.unclear - b.unclear || b.fit - a.fit || a.plan_name.localeCompare(b.plan_name);
}

/* ── The match ──────────────────────────────────────────────────── */

export function matchPlans(answers: MatchAnswers, minSi: number, pool: MatchPlan[], outside: MatchPlan[] = []): MatchResult {
  const rules = rulesFor(answers, minSi);
  const verdicts = pool.map((p) => judge(p, rules, minSi));
  const passing = verdicts.filter((v) => !v.failed_must).sort(compareVerdicts);

  const bestByInsurer = new Map<string, PlanVerdict>();
  for (const v of passing) if (!bestByInsurer.has(v.insurer)) bestByInsurer.set(v.insurer, v);
  const ranked = [...bestByInsurer.values()].sort(compareVerdicts);
  const picks = ranked.slice(0, MAX_PICKS);
  const pickKeys = new Set(picks.map((p) => p.plan_key));

  const why_not: WhyNot[] = verdicts
    .filter((v) => !pickKeys.has(v.plan_key))
    .map((v) => {
      const of = v.needs.length;
      if (v.failed_must) return { ...slim(v), kind: "fail" as const, need: v.failed_must, met: v.met, of };
      const sameInsurer = picks.some((p) => p.insurer === v.insurer);
      return { ...slim(v), kind: sameInsurer ? ("same_insurer" as const) : ("lower" as const), need: firstWeaker(v, picks.find((p) => p.insurer === v.insurer)), met: v.met, of };
    })
    .sort((a, b) => b.completeness - a.completeness || a.plan_name.localeCompare(b.plan_name));

  let blocked: MatchResult["blocked"] = null;
  if (picks.length === 0 && verdicts.length > 0) {
    const counts = new Map<NeedKey, number>();
    for (const v of verdicts) if (v.failed_must) counts.set(v.failed_must.key, (counts.get(v.failed_must.key) ?? 0) + 1);
    const need = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "cover";
    const closest = [...verdicts].sort(compareVerdicts)[0] ?? null;
    const elsewhere = outside.map((p) => judge(p, rules, minSi)).filter((v) => !v.failed_must).length;
    blocked = { need, closest, elsewhere };
  }

  return { version: MATCH_VERSION, needs: rules.needs, adult_ages: rules.adultAges, picks, why_not, blocked };
}

function slim(v: PlanVerdict) {
  return { plan_key: v.plan_key, insurer: v.insurer, plan_name: v.plan_name, variant: v.variant, completeness: v.completeness };
}

/** The first need where this plan does worse than its insurer's pick. */
function firstWeaker(v: PlanVerdict, pick: PlanVerdict | undefined): Need | null {
  if (!pick) return v.needs.find((n) => n.status === "unmet" || n.status === "unclear") ?? null;
  const rank = (s: NeedStatus) => ({ met: 0, addon: 1, unclear: 2, unmet: 3 })[s];
  return v.needs.find((n, i) => pick.needs[i] && rank(n.status) > rank(pick.needs[i].status)) ?? null;
}

/* ── Insurer names ──────────────────────────────────────────────── */

/**
 * The advisor profile says "Tata AIG Health Insurance"; the catalogue says
 * "TATA AIG General Insurance Company Limited". Both reduce to "tataaig".
 * Matched by prefix as well, because insurers rename ("Bajaj Allianz" is now
 * "Bajaj General").
 */
export function insurerToken(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(the|health|general|life|insurance|assurance|company|co|limited|ltd|and allied|ms)\b\.?/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

export function sameInsurer(profileName: string, catalogName: string): boolean {
  const a = insurerToken(profileName), b = insurerToken(catalogName);
  if (!a || !b) return false;
  return a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b));
}
