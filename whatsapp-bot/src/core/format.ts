/**
 * How things READ in a chat. Display only: nothing here changes a stored value or a number.
 *
 *   - Insurer legal names shortened: "ManipalCigna Health Insurance Company Limited" -> "ManipalCigna"
 *   - Plan labels without the stutter: "Care Health Insurance" + "Care Supreme" -> "Care Supreme"
 *   - Names in ALL CAPS or all lower title-cased: "JIGNESH RAMNIKLAL BHAGAT" -> "Jignesh Ramniklal Bhagat"
 *   - WhatsApp bold for the one thing per line that matters
 *
 * prettyEngine() applies the name rules to everything the bot reads, so no reply can forget.
 */

import type { Engine } from "../engine.js";

/* ── Insurer and plan names ──────────────────────────────────────────── */

/** Corporate words that say nothing in a chat. "Life" is kept: it is part of the brand
 *  (HDFC Life, SBI Life, Max Life). */
const CORPORATE =
  /\b(?:(?:health|general)\s+(?:and\s+allied\s+)?)?insurance(?:\s+(?:company|co\.?))?(?:\s+(?:of\s+india\s+)?(?:limited|ltd\.?))?|\b(?:company\s+)?(?:limited|ltd\.?|pvt\.?)(?=\s|$)|\bco\.\s*(?=\s|$)/gi;

export function shortInsurer(name: string | null | undefined): string | null {
  if (!name) return null;
  if (/life insurance corporation/i.test(name)) return "LIC";
  const s = String(name).replace(CORPORATE, " ").replace(/[.,]\s*$/, "").replace(/\s+/g, " ").trim();
  return s || String(name).trim();
}

/** "Care" + "Care Supreme" -> "Care Supreme"; "ManipalCigna" + "ProHealth" -> "ManipalCigna ProHealth". */
export function planLabel(insurer: string | null | undefined, plan: string | null | undefined): string {
  const i = shortInsurer(insurer) ?? "";
  const p = String(plan ?? "").trim();
  if (!p) return i;
  if (!i) return p;
  const firstOfPlan = p.split(/\s+/)[0].toLowerCase();
  if (i.toLowerCase().split(/\s+/).includes(firstOfPlan) || p.toLowerCase().startsWith(i.toLowerCase())) return p;
  return `${i} ${p}`;
}

/** An already-joined "Insurer Legal Name Plan" string (the comparison engine's sides). */
export function cleanPlanText(text: string | null | undefined): string {
  if (/life insurance corporation/i.test(String(text ?? ""))) return String(text).replace(/life insurance corporation of india/i, "LIC");
  const s = String(text ?? "").replace(CORPORATE, " ").replace(/\s+/g, " ").trim();
  // "Care Care Supreme" -> "Care Supreme"
  return s.replace(/\b(\w+)\s+\1\b/gi, "$1");
}

/* ── People ──────────────────────────────────────────────────────────── */

/** Title-case a name that arrived ALL CAPS or all lower. Mixed case is left as typed. */
export function titleName(name: string | null | undefined): string | null {
  if (!name) return name ?? null;
  const s = String(name).trim().replace(/\s+/g, " ");
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_, a, c) => a + c.toUpperCase());
}

export const firstName = (name: string | null | undefined) => String(name ?? "").trim().split(/\s+/)[0] || "";

/* ── Text ────────────────────────────────────────────────────────────── */

/** WhatsApp bold. Asterisks inside would break it, so they are dropped. */
export const b = (text: string | null | undefined) => (text ? `*${String(text).replace(/\*/g, "")}*` : "");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-09-30" -> "Wed 30 Sep". */
export function dayMonth(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  if (isNaN(d.getTime())) return String(isoDate);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/* ── The engine, as the bot sees it ──────────────────────────────────── */

const cleanClient = <T extends Record<string, any>>(c: T): T =>
  c ? { ...c, policyholderName: titleName(c.policyholderName), insurer: shortInsurer(c.insurer) } : c;
const cleanLead = <T extends Record<string, any>>(r: T): T => (r ? { ...r, name: titleName(r.name) } : r);

/** Wraps an Engine so every name the bot shows is already clean. Matching and storage are
 *  untouched: only returned values are reshaped, and only names, never numbers. */
export function prettyEngine(e: Engine): Engine {
  const wrap: Partial<Record<keyof Engine, (r: any) => any>> = {
    getClient: cleanClient,
    findClients: (rows: any[]) => rows.map(cleanClient),
    lookup: (r: any) => ({ policies: r.policies.map(cleanClient), leads: r.leads.map(cleanLead) }),
    policies: (r: any) => ({ ...r, rows: r.rows.map((x: any) => ({ ...x, name: titleName(x.name), insurer: shortInsurer(x.insurer) })) }),
    leadSearch: (rows: any[]) => rows.map(cleanLead),
    leadUpdate: cleanLead,
    followups: (rows: any[]) => rows.map(cleanLead),
    renewals: (r: any) => ({
      leads: r.leads.map((x: any) => ({ ...x, name: titleName(x.name), insurer: shortInsurer(x.insurer) })),
      customers: r.customers.map((x: any) => ({ ...x, name: titleName(x.name), insurer: shortInsurer(x.insurer) })),
    }),
    views: (rows: any[]) => rows.map((x: any) => ({ ...x, name: titleName(x.name), insurer: shortInsurer(x.insurer) })),
    claims: (rows: any[]) => rows.map((x: any) => ({ ...x, customer_name: titleName(x.customer_name), insurer: shortInsurer(x.insurer) })),
    compare: (r: any) => ({ ...r, names: (r.names || []).map((n: string | null) => (n ? cleanPlanText(n) : n)) }),
    searchCustomers: (rows: any[]) => rows.map((x: any) => ({ ...x, name: titleName(x.name) })),
    profile: (p: any) => ({ ...p, name: titleName(p.name) }),
  };
  return new Proxy(e, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv);
      const f = wrap[prop as keyof Engine];
      if (typeof v !== "function" || !f) return typeof v === "function" ? v.bind(target) : v;
      return async (...args: unknown[]) => f(await v.apply(target, args));
    },
  }) as Engine;
}
