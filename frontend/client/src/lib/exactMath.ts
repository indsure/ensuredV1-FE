/**
 * Exact arithmetic for policy rules: fractions, rupees in paise, rates in
 * basis points, and a small typed formula tree.
 *
 * A contract formula such as "50% + 40% x (Policy Year - 7) / (Policy Term - 8)"
 * is stored as a tree of the operations below and evaluated with exact
 * fractions, so year 8 of a 15-year term is exactly 39/70, not 0.557142857...
 * Nothing here ever turns text into code: there is no eval, no Function, and
 * only the operations listed can appear in a tree.
 *
 * Zero imports. Copied byte for byte to shared/exactMath.ts (backend) and the
 * WhatsApp bot, with parity tests.
 */

/* ───────────────────────── Fractions ───────────────────────── */

// BigInt constants without literal syntax: the portal compiles for an older
// target that does not accept Z-style literals or ** on BigInt.
const Z = BigInt(0), ONE = BigInt(1), TEN = BigInt(10), HUNDRED = BigInt(100);
const pow10 = (k: number) => { let r = ONE; for (let i = 0; i < k; i++) r *= TEN; return r; };

export interface Rational {
  n: bigint;
  d: bigint;
}

const babs = (x: bigint) => (x < Z ? -x : x);
function gcd(a: bigint, b: bigint): bigint {
  a = babs(a); b = babs(b);
  while (b) [a, b] = [b, a % b];
  return a || ONE;
}

export function rat(n: bigint | number, d: bigint | number = 1): Rational {
  let N = BigInt(n), D = BigInt(d);
  if (D === Z) throw new RangeError("division_by_zero");
  if (D < Z) { N = -N; D = -D; }
  const g = gcd(N, D);
  return { n: N / g, d: D / g };
}

export const add = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational) => {
  if (b.n === Z) throw new RangeError("division_by_zero");
  return rat(a.n * b.d, a.d * b.n);
};
export const cmp = (a: Rational, b: Rational) => {
  const x = a.n * b.d - b.n * a.d;
  return x < Z ? -1 : x > Z ? 1 : 0;
};
export const maxR = (...xs: Rational[]) => xs.reduce((m, x) => (cmp(x, m) > 0 ? x : m));
export const minR = (...xs: Rational[]) => xs.reduce((m, x) => (cmp(x, m) < 0 ? x : m));
export const eqR = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;

/** "50", "0.5", "12.75" as an exact fraction. Refuses anything else. */
export function parseDecimal(s: string): Rational | null {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!m) return null;
  const frac = m[3] ?? "";
  const n = BigInt(m[2] + frac) * (m[1] ? -ONE : ONE);
  return rat(n, pow10(frac.length));
}

/** "50%" or "50 %" as 1/2. Refuses anything else. */
export function parsePercentText(s: string): Rational | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(s);
  if (!m) return null;
  const v = parseDecimal(m[1]);
  return v ? div(v, rat(100)) : null;
}

export const toNumber = (r: Rational) => Number(r.n) / Number(r.d);

/** Fixed decimal string, rounded half away from zero, for display only. */
export function toFixed(r: Rational, places: number): string {
  const scale = pow10(places);
  const neg = r.n < Z;
  const num = babs(r.n) * scale;
  let q = num / r.d;
  if ((num % r.d) * BigInt(2) >= r.d) q += ONE;
  const s = q.toString().padStart(places + 1, "0");
  const out = places ? s.slice(0, -places) + "." + s.slice(-places) : s;
  return (neg && q !== Z ? "-" : "") + out;
}

/* ───────────────────────── Money and rates ───────────────────────── */

/** Rupees held as whole paise. JSON carries the integer; arithmetic uses BigInt. */
export interface Paise {
  paise: number;
}

export function paiseFromRupeeText(s: string): Paise | null {
  const v = parseDecimal(s.replace(/,/g, ""));
  if (!v) return null;
  const p = mul(v, rat(100));
  if (p.d !== ONE || p.n < Z || p.n > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return { paise: Number(p.n) };
}
export const paiseToRational = (p: Paise) => rat(BigInt(p.paise), HUNDRED);

/**
 * A money result from exact maths, in paise. Contract formulas rarely say how
 * to round; this truncates toward zero (never rounds a payout up) and the
 * caller labels the figure as calculated, not quoted.
 */
export function rationalToPaiseFloor(r: Rational): Paise {
  const p = mul(r, rat(100));
  let q = p.n / p.d;
  if (p.n < Z && p.n % p.d !== Z) q -= ONE;
  return { paise: Number(q) };
}

export const formatRupees = (p: Paise) => {
  const neg = p.paise < 0;
  const abs = Math.abs(p.paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  return (neg ? "-" : "") + "₹" + rupees.toLocaleString("en-IN") + (rest ? "." + String(rest).padStart(2, "0") : "");
};

/** A rate in basis points (1% = 100 bps). Whole basis points only. */
export interface Bps {
  bps: number;
}
export function bpsFromPercentText(s: string): Bps | null {
  const v = parseDecimal(s.replace(/%/, "").trim());
  if (!v) return null;
  const b = mul(v, rat(100));
  return b.d === ONE ? { bps: Number(b.n) } : null;
}
/** Round UP to the next multiple of `step` bps (25 or 50 in the wordings seen). */
export function ceilBps(b: Bps, step: number): Bps {
  return { bps: Math.ceil(b.bps / step) * step };
}

/* ───────────────────────── Formula tree ───────────────────────── */

export type VarName =
  | "policy_year"
  | "policy_term"
  | "total_premiums_paid"
  | "survival_benefits_till_date"
  | "premiums_paid_count"
  | "premiums_payable_count"
  | "payout";

export type Expr =
  | { k: "num"; n: string; d: string }
  | { k: "var"; name: VarName }
  | { k: "add" | "sub" | "mul" | "div" | "max" | "min"; args: Expr[] };

export const num = (r: Rational): Expr => ({ k: "num", n: r.n.toString(), d: r.d.toString() });
export const v = (name: VarName): Expr => ({ k: "var", name });
export const op = (k: "add" | "sub" | "mul" | "div" | "max" | "min", ...args: Expr[]): Expr => ({ k, args });

const VARS: ReadonlySet<string> = new Set([
  "policy_year", "policy_term", "total_premiums_paid", "survival_benefits_till_date",
  "premiums_paid_count", "premiums_payable_count", "payout",
]);

export type EvalResult = { ok: true; value: Rational } | { ok: false; reason: "division_by_zero" | "unknown_variable" | "missing_variable" | "bad_tree" };

/** Check a stored tree only uses allowed shapes. Run on anything read back from storage. */
export function isExpr(x: unknown, depth = 0): x is Expr {
  if (!x || typeof x !== "object" || depth > 32) return false;
  const e = x as any;
  if (e.k === "num") return typeof e.n === "string" && typeof e.d === "string" && /^-?\d+$/.test(e.n) && /^[1-9]\d*$/.test(e.d);
  if (e.k === "var") return typeof e.name === "string" && VARS.has(e.name);
  if (["add", "sub", "mul", "div", "max", "min"].includes(e.k)) {
    return Array.isArray(e.args) && e.args.length >= 2 && e.args.length <= 8 && e.args.every((a: unknown) => isExpr(a, depth + 1));
  }
  return false;
}

export function evaluate(e: Expr, env: Partial<Record<VarName, Rational>>): EvalResult {
  if (!isExpr(e)) return { ok: false, reason: "bad_tree" };
  const go = (x: Expr): Rational => {
    switch (x.k) {
      case "num": return rat(BigInt(x.n), BigInt(x.d));
      case "var": {
        const val = env[x.name];
        if (!val) throw new Error("missing_variable");
        return val;
      }
      default: {
        const a = x.args.map(go);
        if (x.k === "add") return a.reduce(add);
        if (x.k === "sub") return a.reduce(sub);
        if (x.k === "mul") return a.reduce(mul);
        if (x.k === "div") return a.reduce(div);
        if (x.k === "max") return maxR(...a);
        return minR(...a);
      }
    }
  };
  try {
    return { ok: true, value: go(e) };
  } catch (err: any) {
    const m = String(err?.message ?? "");
    if (m === "division_by_zero") return { ok: false, reason: "division_by_zero" };
    if (m === "missing_variable") return { ok: false, reason: "missing_variable" };
    return { ok: false, reason: "bad_tree" };
  }
}

/** Plain-English rendering of a tree, for the review screen. */
export function describe(e: Expr): string {
  const NAMES: Record<VarName, string> = {
    policy_year: "Policy Year", policy_term: "Policy Term", total_premiums_paid: "Total premiums paid",
    survival_benefits_till_date: "Survival benefits till date", premiums_paid_count: "Number of premiums paid",
    premiums_payable_count: "Total number of premiums payable", payout: "Payout",
  };
  const SYM = { add: " + ", sub: " - ", mul: " × ", div: " ÷ " } as const;
  const go = (x: Expr, top: boolean): string => {
    if (x.k === "num") {
      const r = rat(BigInt(x.n), BigInt(x.d));
      const pct = mul(r, rat(100));
      return pct.d === ONE && r.d !== ONE ? `${pct.n}%` : r.d === ONE ? r.n.toString() : `${r.n}/${r.d}`;
    }
    if (x.k === "var") return NAMES[x.name];
    if (x.k === "max" || x.k === "min") return `${x.k === "max" ? "Max" : "Min"}(${x.args.map((a) => go(a, true)).join(", ")})`;
    const s = x.args.map((a) => go(a, false)).join(SYM[x.k]);
    return top ? s : `(${s})`;
  };
  return go(e, true);
}
