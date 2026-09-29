/**
 * Model bake-off: Gemini 3.1 Flash-Lite vs Gemini 2.5 Flash-Lite on the intent test set.
 *
 *   npx tsx eval/run-intent-eval.ts --dry        # check the test set, no API calls, no cost
 *   npx tsx eval/run-intent-eval.ts              # the real run (spends money: capped)
 *
 * Same instructions, same response schema, temperature 0, thinking off, 3 runs per message.
 * Hard stop when estimated spend passes MAX_USD. The key is read from IndSure/.env and never
 * printed. Every name and number in the test set is made up.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, TODAY, type Case, type ExpAction } from "./cases.js";
import {
  RESPONSE_SCHEMA, WRITE_ACTIONS, normalise, systemPrompt, userPrompt, type Action, type Understanding,
} from "../src/core/understand.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const MODELS = [
  // USD per 1M tokens, paid tier standard, from ai.google.dev/gemini-api/docs/pricing (2026-09-24).
  { id: "gemini-3.1-flash-lite", inUsd: 0.25, outUsd: 1.5 },
  { id: "gemini-3.5-flash-lite", inUsd: 0.30, outUsd: 2.50 },
];
const RUNS = 3;
const MAX_USD = 0.20; // about ₹17 hard stop for a single-model confirmation run
const INR = 85;
const CONCURRENCY = 4;

/* ── Scoring ─────────────────────────────────────────────────────────── */

const normName = (s: string | null | undefined) =>
  String(s ?? "").toLowerCase().replace(/[^a-zऀ-ॿ ]/g, " ").replace(/\s+/g, " ").trim();

function nameOk(exp: ExpAction["name"], got: string | null): boolean {
  if (exp === undefined) return true;
  if (exp === null) return got === null;
  const alts = Array.isArray(exp) ? exp : [exp];
  return alts.some((a) => normName(a) === normName(got));
}

function actionOk(e: ExpAction, g: Action): boolean {
  const types = Array.isArray(e.type) ? e.type : [e.type];
  if (!types.includes(g.type)) return false;
  if (!nameOk(e.name, g.name)) return false;
  for (const k of ["phone", "status", "follow_up_date", "interest", "draft_kind", "language"] as const) {
    if (e[k] !== undefined && e[k] !== g[k]) return false;
  }
  return true;
}

/** A write that would really change something: a lead with a name or number, or an undo. */
const realWrite = (a: Action) => WRITE_ACTIONS.includes(a.type) && (a.type === "undo" || !!a.name || !!a.phone);

function score(c: Case, u: Understanding): { correct: boolean; dangerous: boolean; why: string } {
  const writes = u.actions.filter(realWrite);
  // Forbidden outcomes are dangerous whatever else.
  for (const a of u.actions) {
    if (c.forbid?.status && a.status === c.forbid.status) return { correct: false, dangerous: true, why: `set status ${a.status}` };
    if (c.forbid?.types?.includes(a.type) && realWrite(a)) return { correct: false, dangerous: true, why: `forbidden ${a.type}` };
  }
  if (c.askOnly) {
    return writes.length
      ? { correct: false, dangerous: true, why: `wrote ${writes[0].type} ${writes[0].name ?? ""} ${writes[0].status ?? ""}`.trim() }
      : { correct: true, dangerous: false, why: "" };
  }
  const alts = c.any ?? [];
  const correct = alts.some((alt) => alt.length === u.actions.length && alt.every((e, i) => actionOk(e, u.actions[i])));
  if (correct) return { correct, dangerous: false, why: "" };
  // Not correct. Dangerous if any real write is not backed by a matching expected write:
  // wrong person, wrong status, or a write where none was wanted. A wrong follow-up DATE
  // alone is an error, not a danger: the confirmation shows the date before anything saves.
  const expWrites = alts.flat().filter((e) => (Array.isArray(e.type) ? e.type : [e.type]).some((t) => WRITE_ACTIONS.includes(t)));
  for (const w of writes) {
    const backed = expWrites.some((e) => {
      const types = Array.isArray(e.type) ? e.type : [e.type];
      if (!types.includes(w.type) || !nameOk(e.name, w.name)) return false;
      // A status the model set must be exactly the one expected; setting one nobody asked
      // for (e.g. marking someone won on a note) is a real, wrong change.
      if (w.status && w.status !== e.status) return false;
      return true;
    });
    if (!backed) return { correct: false, dangerous: true, why: `unbacked ${w.type} name=${w.name} status=${w.status}` };
  }
  return { correct: false, dangerous: false, why: `got ${u.actions.map((a) => `${a.type}(${a.name ?? ""}${a.status ? "," + a.status : ""}${a.follow_up_date ? "," + a.follow_up_date : ""})`).join(" + ")}` };
}

/* ── Gemini ──────────────────────────────────────────────────────────── */

function loadKey(): string {
  const envPath = path.resolve(here, "../../../IndSure/.env");
  const alt = path.resolve(here, "../../.env");
  const file = fs.existsSync(envPath) ? envPath : alt;
  const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith("GEMINI_API_KEY="));
  const key = line?.slice("GEMINI_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("GEMINI_API_KEY not found in .env");
  return key;
}

type Call = { u: Understanding; ms: number; inTok: number; outTok: number; thinkTok: number; err?: string };
const thinkingMode = new Map<string, any>();

async function callGemini(key: string, model: string, text: string, c: Case): Promise<Call> {
  const modes = thinkingMode.has(model)
    ? [thinkingMode.get(model)]
    : [{ thinkingBudget: 0 }, { thinkingLevel: "minimal" }, null];
  let lastErr = "";
  for (const mode of modes) {
    const body: any = {
      systemInstruction: { parts: [{ text: systemPrompt() }] },
      contents: [{ role: "user", parts: [{ text: userPrompt(text, c.ctx ?? {}, TODAY) }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, ...(mode ? { thinkingConfig: mode } : {}) },
    };
    for (let attempt = 0; attempt < 4; attempt++) {
      const t0 = Date.now();
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
      });
      const ms = Date.now() - t0;
      const json: any = await res.json().catch(() => ({}));
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); lastErr = `HTTP ${res.status}`; continue; }
      // While we are still finding which thinking setting this model takes, ANY 400 means try
      // the next one: some models reject a setting with a bare "invalid argument".
      if (res.status === 400 && !thinkingMode.has(model)) { lastErr = `settings rejected: ${String(json?.error?.message ?? "").slice(0, 80)}`; break; }
      if (!res.ok) return { u: normalise(null), ms, inTok: 0, outTok: 0, thinkTok: 0, err: `HTTP ${res.status}: ${String(json?.error?.message ?? "").slice(0, 160)}` };
      thinkingMode.set(model, mode);
      const um = json.usageMetadata ?? {};
      const txt = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
      let parsed: unknown = null;
      try { parsed = JSON.parse(txt); } catch { /* malformed: normalise -> unknown */ }
      return {
        u: normalise(parsed), ms,
        inTok: um.promptTokenCount ?? 0, outTok: um.candidatesTokenCount ?? 0, thinkTok: um.thoughtsTokenCount ?? 0,
        err: parsed ? undefined : "unparseable response",
      };
    }
  }
  return { u: normalise(null), ms: 0, inTok: 0, outTok: 0, thinkTok: 0, err: lastErr || "failed" };
}

/* ── Run ─────────────────────────────────────────────────────────────── */

async function pool<T>(items: T[], n: number, f: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await f(items[i++]); }));
}

async function main() {
  const dry = process.argv.includes("--dry");
  const ids = new Set<string>();
  for (const c of CASES) {
    if (ids.has(c.id)) throw new Error(`duplicate id ${c.id}`);
    ids.add(c.id);
    if (!c.askOnly && !c.any?.length) throw new Error(`${c.id}: no expected answer`);
  }
  const byCat = CASES.reduce<Record<string, number>>((m, c) => ((m[c.cat] = (m[c.cat] ?? 0) + 1), m), {});
  console.log(`test set: ${CASES.length} messages`, byCat);
  const approxIn = Math.round((systemPrompt().length + 1200) / 4);
  const est = MODELS.reduce((s, m) => s + CASES.length * RUNS * (approxIn * m.inUsd + 120 * m.outUsd) / 1e6, 0);
  console.log(`estimated cost: $${est.toFixed(3)} (about ₹${Math.round(est * INR)}), cap $${MAX_USD}`);
  // Scorer self-test, free: the expected answer must score correct; a wrong write must be dangerous.
  const blank = (t: any): Action => ({ type: t, name: null, phone: null, status: null, follow_up_date: null, note: null, interest: null, draft_kind: null, language: null, plans: null, question: null, policy_type: null });
  let selfBad = 0;
  for (const c of CASES) {
    const alt = c.any?.[0];
    const good: Understanding = alt
      ? { clarify: null, actions: alt.map((e) => ({ ...blank(Array.isArray(e.type) ? e.type[0] : e.type), ...Object.fromEntries(Object.entries(e).filter(([k]) => k !== "type")), name: Array.isArray(e.name) ? e.name[0] : (e.name ?? null) })) }
      : { clarify: "which one?", actions: [blank("unknown")] };
    const s1 = score(c, good);
    if (!s1.correct || s1.dangerous) { selfBad++; console.log("SELFTEST expected-answer fails:", c.id, s1.why); }
    const harmful: Understanding = { clarify: null, actions: [{ ...blank("update_lead"), name: "Zzz Wrongperson", status: "won" }] };
    const s2 = score(c, harmful);
    if (!s2.dangerous) { selfBad++; console.log("SELFTEST harmful write not flagged:", c.id); }
  }
  console.log(selfBad ? `scorer self-test: ${selfBad} problems` : "scorer self-test: OK (every expected answer correct, every wrong write dangerous)");
  if (dry || selfBad) return;

  const key = loadKey();
  let spent = 0;
  const results: any[] = [];
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  for (const m of MODELS) {
    if (only && m.id !== only) continue;
    const jobs = CASES.flatMap((c) => Array.from({ length: RUNS }, (_, run) => ({ c, run })));
    const out: any[] = [];
    await pool(jobs, CONCURRENCY, async ({ c, run }) => {
      if (spent > MAX_USD) return;
      const r = await callGemini(key, m.id, c.text, c);
      spent += (r.inTok * m.inUsd + (r.outTok + r.thinkTok) * m.outUsd) / 1e6;
      out.push({ model: m.id, id: c.id, cat: c.cat, run, ...score(c, r.u), ms: r.ms, inTok: r.inTok, outTok: r.outTok, thinkTok: r.thinkTok, err: r.err, got: r.u });
    });
    results.push(...out);
    console.log(`${m.id}: done, thinking mode ${JSON.stringify(thinkingMode.get(m.id))}, spent so far $${spent.toFixed(4)}`);
    if (spent > MAX_USD) { console.log("COST CAP HIT: stopped"); break; }
  }

  // Summary per model
  const lines: string[] = [`# Intent bake-off ${new Date().toISOString().slice(0, 16)}`, "", `${CASES.length} messages × ${RUNS} runs per model. Today fixed at ${TODAY}.`, ""];
  lines.push("| Model | Correct | Dangerous | Inconsistent messages | Hinglish+Hindi correct | p50 ms | p95 ms | Thinking tokens | Cost per 1,000 msgs |", "|---|---|---|---|---|---|---|---|---|");
  for (const m of MODELS) {
    const rs = results.filter((r) => r.model === m.id);
    if (!rs.length) continue;
    const pct = (xs: any[]) => `${((100 * xs.filter((r) => r.correct).length) / Math.max(1, xs.length)).toFixed(1)}%`;
    const danger = rs.filter((r) => r.dangerous).length;
    const byCase = new Map<string, string[]>();
    for (const r of rs) byCase.set(r.id, [...(byCase.get(r.id) ?? []), JSON.stringify(r.got.actions)]);
    const inconsistent = [...byCase.values()].filter((v) => new Set(v).size > 1).length;
    const ms = rs.map((r) => r.ms).filter(Boolean).sort((a, b) => a - b);
    const q = (p: number) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] ?? 0;
    const cost = rs.reduce((s, r) => s + (r.inTok * m.inUsd + (r.outTok + r.thinkTok) * m.outUsd) / 1e6, 0);
    const think = rs.reduce((s, r) => s + (r.thinkTok || 0), 0);
    lines.push(`| ${m.id} | ${pct(rs)} | ${danger} | ${inconsistent} | ${pct(rs.filter((r) => r.cat === "hinglish" || r.cat === "hindi"))} | ${q(0.5)} | ${q(0.95)} | ${think} | $${((cost / rs.length) * 1000).toFixed(3)} (₹${((cost / rs.length) * 1000 * INR).toFixed(1)}) |`);
  }
  lines.push("", "## By category (correct %)", "", `| Category | ${MODELS.map((m) => m.id).join(" | ")} |`, `|---|${MODELS.map(() => "---").join("|")}|`);
  for (const cat of Object.keys(byCat)) {
    lines.push(`| ${cat} (${byCat[cat]}) | ${MODELS.map((m) => {
      const xs = results.filter((r) => r.model === m.id && r.cat === cat);
      return xs.length ? `${((100 * xs.filter((r) => r.correct).length) / xs.length).toFixed(0)}%` : "-";
    }).join(" | ")} |`);
  }
  for (const m of MODELS) {
    const bad = results.filter((r) => r.model === m.id && (r.dangerous || !r.correct));
    const seen = new Set<string>();
    lines.push("", `## ${m.id}: misses (first run of each)`, "");
    for (const r of bad.sort((a, b) => Number(b.dangerous) - Number(a.dangerous))) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const c = CASES.find((x) => x.id === r.id)!;
      lines.push(`- ${r.dangerous ? "**DANGEROUS** " : ""}${r.id} "${c.text}": ${r.why}${r.err ? ` [${r.err}]` : ""}`);
    }
  }
  lines.push("", `Total spent: $${spent.toFixed(4)} (about ₹${(spent * INR).toFixed(1)}).`);
  const dir = path.join(here, "results");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify(results, null, 1));
  fs.writeFileSync(path.join(dir, `${stamp}.md`), lines.join("\n"));
  console.log(lines.join("\n"));
}

main().catch((e) => { console.error("eval failed:", e?.message ?? e); process.exit(1); });
