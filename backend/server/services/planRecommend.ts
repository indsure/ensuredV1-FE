/**
 * "Compare Plans With This Coverage": the top catalogue health plans that offer
 * at least the cover the calculator recommended, ranked by completeness
 * (planCompleteness.ts). Plus each advisor's preferred list, which narrows the
 * ranking to the plans that advisor works with.
 *
 * Founder decision 2026-11-03: consumers are shown the top 3; an advisor's
 * picks come from their own preferred list.
 *
 * Deterministic and free: stored catalogue profiles only, no AI.
 */
import type { Express } from "express";
import { pool } from "../lib/db";
import type { WordingProfile } from "../types/wordingProfile";
import { COMPLETENESS_VERSION, maxSumInsured, scoreCompleteness, type CompletenessResult } from "./planCompleteness";

export const TOP_N = 3;

/** profile.entry_age, written from backend/catalog_entry_ages.json (migration 035). */
export interface EntryAge {
  adult_min: number | null;
  adult_max: number | null;
  segment: "youth" | "senior" | null;
}

interface ScoredPlan extends CompletenessResult {
  plan_key: string;
  uin: string;
  variant: string;
  insurer: string;
  plan_name: string;
  sum_insured_options: string | null;
  max_si: number | null;
  entry_age?: EntryAge | null;
}

/**
 * Can these adults join this plan? Ages are the adults to be covered; an empty
 * list means we were not told, and the plan must then suit a typical adult
 * (18 to 65). A known limit that excludes anyone rules the plan out. A youth or
 * senior plan whose ages we could not confirm is ruled out too: it is the kind
 * of plan that turns people away. Any other plan with no stated ages stays in,
 * since general plans take adults from 18 to at least 65.
 */
export function ageEligible(ea: EntryAge | null | undefined, adultAges: number[]): boolean {
  if (!ea) return true;
  const known = ea.adult_min != null || ea.adult_max != null;
  if (ea.segment && !known) return false;
  const ages = adultAges.length > 0 ? adultAges : [18, 65];
  return ages.every((a) => (ea.adult_min == null || a >= ea.adult_min) && (ea.adult_max == null || a <= ea.adult_max));
}

// The catalogue changes when someone runs the loader, not per request. Scoring
// 300 profiles is cheap, but there is no reason to repeat it on every page view.
const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; plans: ScoredPlan[] } | null = null;

async function scoredCatalog(): Promise<ScoredPlan[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.plans;
  const { rows } = await pool.query(
    `SELECT plan_key, uin, variant, insurer, plan_name, sum_insured_options, profile
       FROM policy_catalog
      WHERE is_active = true
        AND product_type = 'comprehensive_health_indemnity'`
  );
  const plans: ScoredPlan[] = rows.map((r: any) => ({
    plan_key: r.plan_key || r.uin,
    uin: r.uin,
    variant: r.variant ?? "",
    insurer: r.insurer,
    plan_name: r.plan_name,
    sum_insured_options: r.sum_insured_options,
    max_si: maxSumInsured(r.sum_insured_options),
    entry_age: (r.profile?.entry_age as EntryAge | undefined) ?? null,
    ...scoreCompleteness(r.profile as WordingProfile),
  }));
  cache = { at: Date.now(), plans };
  return plans;
}

/**
 * Rank plans that can carry `minSi` rupees of cover. A plan whose wording does
 * not state its sum insured is left out: we cannot tell the person it offers
 * the cover they need. One plan per insurer, so three variants of one product
 * do not fill the list. Plans the adults cannot join by age are left out
 * (ageEligible).
 */
export function rankPlans(plans: ScoredPlan[], minSi: number, only?: Set<string>, adultAges: number[] = []): ScoredPlan[] {
  const eligible = plans
    .filter((p) => (only ? only.has(p.plan_key) : true))
    .filter((p) => minSi <= 0 || (p.max_si != null && p.max_si >= minSi))
    .filter((p) => ageEligible(p.entry_age, adultAges))
    .sort((a, b) => b.score - a.score || a.unknown - b.unknown || a.insurer.localeCompare(b.insurer));
  const seen = new Set<string>();
  const out: ScoredPlan[] = [];
  for (const p of eligible) {
    if (seen.has(p.insurer)) continue;
    seen.add(p.insurer);
    out.push(p);
    if (out.length === TOP_N) break;
  }
  return out;
}

async function agentIdFrom(req: any, getUserIdFromToken: (t: string) => Promise<string | null>): Promise<string | null> {
  const h = req.headers["authorization"] as string | undefined;
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const userId = await getUserIdFromToken(h.slice(7));
    if (!userId) return null;
    const a = await pool.query("SELECT 1 FROM agents WHERE id = $1", [userId]);
    return a.rows.length > 0 ? userId : null;
  } catch {
    return null;
  }
}

async function preferredKeys(agentId: string): Promise<string[]> {
  const r = await pool.query(
    "SELECT plan_key FROM agent_preferred_plans WHERE agent_id = $1 ORDER BY created_at",
    [agentId]
  );
  return r.rows.map((x: any) => x.plan_key);
}

const PLAN_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9 ._:+&()/-]{2,120}$/;

export function registerPlanRecommendRoutes(
  app: Express,
  getUserIdFromToken: (token: string) => Promise<string | null>,
) {
  // PUBLIC. ?min_si is in lakhs, as the calculator report sends it. An advisor's
  // session narrows the ranking to their preferred list when they have one.
  app.get("/api/compare/recommend", async (req, res) => {
    try {
      const lakhs = Number(req.query.min_si ?? 0);
      if (!Number.isFinite(lakhs) || lakhs < 0 || lakhs > 100000) {
        return res.status(400).json({ error: "Invalid cover amount" });
      }
      const minSi = Math.round(lakhs * 1e5);
      // ?ages=42,38 : the adults to be covered, from the calculator. Optional.
      const adultAges = String(req.query.ages ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 18 && n <= 110)
        .slice(0, 6);
      const plans = await scoredCatalog();

      const agentId = await agentIdFrom(req, getUserIdFromToken);
      let source: "catalog" | "preferred" = "catalog";
      let only: Set<string> | undefined;
      if (agentId) {
        // A missing list (or table) falls back to the whole catalogue rather
        // than failing the page for an advisor.
        const keys = await preferredKeys(agentId).catch(() => [] as string[]);
        if (keys.length > 0) { source = "preferred"; only = new Set(keys); }
      }

      const top = rankPlans(plans, minSi, only, adultAges);
      return res.json({
        source,
        min_si: minSi,
        ages: adultAges,
        scoring_version: COMPLETENESS_VERSION,
        plans: top.map((p) => ({
          plan_key: p.plan_key, uin: p.uin, variant: p.variant, insurer: p.insurer,
          plan_name: p.plan_name, sum_insured_options: p.sum_insured_options,
          score: p.score, strengths: p.strengths, gaps: p.gaps,
          entry_age: p.entry_age ? { adult_min: p.entry_age.adult_min, adult_max: p.entry_age.adult_max } : null,
        })),
      });
    } catch (err: any) {
      console.error("ERROR recommending plans:", err?.message ?? err);
      return res.status(500).json({ error: "Could not load plans." });
    }
  });

  // Advisor's preferred list. Advisor accounts only.
  const requireAgent = async (req: any, res: any): Promise<string | null> => {
    const agentId = await agentIdFrom(req, getUserIdFromToken);
    if (!agentId) res.status(401).json({ error: "Advisor sign-in required" });
    return agentId;
  };

  app.get("/api/agent/preferred-plans", async (req, res) => {
    try {
      const agentId = await requireAgent(req, res);
      if (!agentId) return;
      return res.json({ plan_keys: await preferredKeys(agentId) });
    } catch (err: any) {
      console.error("ERROR loading preferred plans:", err?.message ?? err);
      return res.status(500).json({ error: "Could not load your list." });
    }
  });

  app.post("/api/agent/preferred-plans", async (req, res) => {
    try {
      const agentId = await requireAgent(req, res);
      if (!agentId) return;
      const planKey = String(req.body?.plan_key ?? "");
      if (!PLAN_KEY_RE.test(planKey)) return res.status(400).json({ error: "Invalid plan" });
      // Only real, active catalogue plans: the list feeds a ranking shown to clients.
      const exists = await pool.query(
        "SELECT 1 FROM policy_catalog WHERE is_active = true AND (plan_key = $1 OR (variant = '' AND uin = $1))",
        [planKey]
      );
      if (exists.rows.length === 0) return res.status(404).json({ error: "Plan not found in the catalogue" });
      const count = await pool.query("SELECT count(*)::int AS n FROM agent_preferred_plans WHERE agent_id = $1", [agentId]);
      if (count.rows[0].n >= 50) return res.status(400).json({ error: "Your list can hold up to 50 plans" });
      await pool.query(
        "INSERT INTO agent_preferred_plans (agent_id, plan_key) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [agentId, planKey]
      );
      return res.json({ plan_keys: await preferredKeys(agentId) });
    } catch (err: any) {
      console.error("ERROR adding preferred plan:", err?.message ?? err);
      return res.status(500).json({ error: "Could not update your list." });
    }
  });

  app.delete("/api/agent/preferred-plans/:planKey", async (req, res) => {
    try {
      const agentId = await requireAgent(req, res);
      if (!agentId) return;
      await pool.query(
        "DELETE FROM agent_preferred_plans WHERE agent_id = $1 AND plan_key = $2",
        [agentId, String(req.params.planKey)]
      );
      return res.json({ plan_keys: await preferredKeys(agentId) });
    } catch (err: any) {
      console.error("ERROR removing preferred plan:", err?.message ?? err);
      return res.status(500).json({ error: "Could not update your list." });
    }
  });
}
