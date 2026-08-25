#!/usr/bin/env node
/**
 * guard.mjs — the machine-checkable half of WORKFLOW.md.
 *
 * Written 2026-08-23 after an audit found 355 UI/UX findings in AI-written code,
 * including violations of rules that were already written down in rules.md.
 * A rule nobody verifies is a preference. This verifies them.
 *
 *   node checks/guard.mjs           # report
 *   node checks/guard.mjs --json    # machine-readable
 *
 * Exit 1 on any FAIL, or if a WARN budget is exceeded.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "frontend", "client", "src");
const JSON_OUT = process.argv.includes("--json");

/* Public marketing pages: claims here are read by strangers, so they are held
   to the strictest standard. Consumer/agent app screens are excluded. */
const PUBLIC_PAGES = [
  "pages/home.tsx", "pages/pricing.tsx", "pages/advisors-pricing.tsx",
  "pages/how-it-works.tsx", "pages/why-indsure.tsx", "pages/mission.tsx",
  "pages/vision.tsx", "pages/team.tsx", "pages/help.tsx", "pages/life.tsx",
  "pages/term.tsx", "pages/vehicle.tsx", "pages/blog.tsx",
  "pages/agent/Landing.tsx", "pages/start.tsx",
];

const findings = [];
const add = (level, rule, file, line, msg, evidence) =>
  findings.push({ level, rule, file, line, msg, evidence });

/* ---------- file walking ---------- */

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).map((p) => ({
  path: p,
  rel: relative(SRC, p).split(sep).join("/"),
  text: readFileSync(p, "utf8"),
}));
const lines = (f) => f.text.split(/\r?\n/);
const isUI = (f) => f.rel.endsWith(".tsx");
const isPublic = (f) => PUBLIC_PAGES.includes(f.rel);

/* Strip comments so a rule about *user-visible* text is not tripped by a note
   to a developer. Crude but adequate: we only need to avoid false positives. */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ================= FAIL rules — these block ================= */

/* 1. Unsourced claims on public pages (the "10,000+ Policies Decoded" class).
      Any hard number or absolute promise must carry a source annotation:
        {/* claim-source: SELECT count(*) FROM policy_analyses (2026-08-23) *␘/}
      or be marked TODO(claim). */
const CLAIM_PATTERNS = [
  [/\b\d{1,3}(,\d{3})+\s*\+/g, "large number with +"],
  [/\b\d+\s*[kK]\+/g, "abbreviated count (10K+)"],
  [/\b(?:no|zero)\s+(?:signup|sign-up|account|registration)\s+(?:required|needed)/gi, "no-signup promise"],
  [/\bnever\s+(?:store|stored|storing|share|shared)\b/gi, "absolute retention promise"],
  [/\bcompletely\s+free\b/gi, "completely-free promise"],
  [/\b(?:free\s+forever|forever\s+free|no\s+expiry)\b/gi, "free-forever promise"],
  [/\bwe\s+delete\s+(?:your|the)\s+\w+/gi, "deletion promise"],
  [/\btrusted\s+by\b/gi, "trusted-by claim"],
  [/\bunlimited\s+\w+/gi, "unlimited promise"],
  [/\b(?:thousands|millions|lakhs|crores)\s+of\b/gi, "vague magnitude claim"],
];

for (const f of files.filter(isPublic)) {
  const src = lines(f);
  src.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("//") || line.startsWith("*")) return;
    // A source annotation within 2 lines discharges the requirement.
    const ctx = src.slice(Math.max(0, i - 2), i + 3).join("\n");
    if (/claim-source:|TODO\(claim\)/.test(ctx)) return;
    for (const [re, label] of CLAIM_PATTERNS) {
      const m = raw.match(re);
      if (m) {
        add("FAIL", "unsourced-claim", f.rel, i + 1,
          `${label} with no claim-source annotation`, m[0].trim());
        break;
      }
    }
  });
}

/* 2. console.log in shipped code — already banned by rules.md, shipped anyway. */
for (const f of files) {
  lines(f).forEach((raw, i) => {
    if (/^\s*(\/\/|\*)/.test(raw)) return;
    if (/\bconsole\.log\s*\(/.test(raw))
      add("FAIL", "console-log", f.rel, i + 1, "console.log in shipped code (rules.md)", raw.trim().slice(0, 80));
  });
}

/* 3. Personal data in web storage — banned by rules.md, shipped anyway
      (lib/pendingUpload.ts, and a signup draft that stored a plaintext password). */
const STORAGE_RE = /(localStorage|sessionStorage)\.setItem\s*\(\s*[`'"]([^`'"]+)/g;
const SENSITIVE = /policy|password|pwd|token|aadha|pan\b|phone|mobile|email|customer|client|upload|draft|dob|nominee/i;
for (const f of files) {
  lines(f).forEach((raw, i) => {
    for (const m of raw.matchAll(STORAGE_RE)) {
      if (SENSITIVE.test(m[2]))
        add("FAIL", "pii-in-storage", f.rel, i + 1,
          `personal data in ${m[1]} (rules.md)`, m[2]);
    }
  });
}

/* 4. Unchecked .delete() — the PoliciesNew.tsx:201 class. Supabase returns
      { error } rather than throwing, so a bare try/catch is dead code. */
for (const f of files) {
  const src = lines(f);
  src.forEach((raw, i) => {
    if (!/\.delete\s*\(\s*\)/.test(raw)) return;
    // Look BACKWARDS as well as forwards: the idiomatic fix destructures
    // `const { error: dErr } = await supabase...` on a line ABOVE the .delete(),
    // and a forward-only window scores that as unchecked.
    const window = src.slice(Math.max(0, i - 4), i + 6).join("\n");
    if (!/\berror\b/i.test(window))
      add("FAIL", "unchecked-delete", f.rel, i + 1,
        "delete() result never checked — UI will lie about success", raw.trim().slice(0, 80));
  });
}

/* 5. A toast system that is imported but never mounted swallows every message
      it is given (pages/hospitals.tsx called toast.error into the void). */
const usesSonner = files.filter((f) => /from\s+["']sonner["']/.test(f.text));
if (usesSonner.length) {
  const mounted = files.some((f) =>
    /<Toaster/.test(f.text) && /sonner/.test(f.text) && /App|main|Providers/i.test(f.rel));
  if (!mounted)
    add("FAIL", "toaster-not-mounted", usesSonner[0].rel, 1,
      `sonner used in ${usesSonner.length} file(s) but <Toaster /> is never mounted — those toasts are silently discarded`,
      usesSonner.map((f) => f.rel).slice(0, 3).join(", "));
}

/* 6. Inverted responsive type — text that SHRINKS on larger screens. */
for (const f of files.filter(isUI)) {
  lines(f).forEach((raw, i) => {
    const base = raw.match(/(?<![a-z:])text-\[(\d+)px\]/);
    const up = raw.match(/\b(?:sm|md|lg):text-\[(\d+)px\]/);
    if (base && up && Number(up[1]) < Number(base[1]))
      add("FAIL", "inverted-type-scale", f.rel, i + 1,
        `type shrinks on larger screens (${base[1]}px -> ${up[1]}px)`, raw.trim().slice(0, 80));
  });
}

/* 7. react-router-dom — banned by rules.md. */
for (const f of files) {
  if (/from\s+["']react-router-dom["']/.test(f.text))
    add("FAIL", "react-router-dom", f.rel, 1, "react-router-dom is banned — use wouter (rules.md)", "");
}

/* 8. Cross-origin links without rel — security + the audit's social-icon finding. */
for (const f of files.filter(isUI)) {
  lines(f).forEach((raw, i) => {
    if (/target\s*=\s*["']_blank["']/.test(raw) && !/rel\s*=/.test(raw))
      add("FAIL", "blank-without-rel", f.rel, i + 1,
        'target="_blank" without rel="noopener noreferrer"', raw.trim().slice(0, 80));
  });
}

/* ================= WARN rules — budgeted, must not grow ================= */

/* Budgets are the counts measured on 2026-08-23, the day the ratchet was installed.
   Lower them as debt is paid; never raise them. A rise means new debt was added. */
const BUDGETS = {
  "sub-14px-type": 980,
  "low-contrast-token": 396,
  "native-dialog": 8,
  "placeholder-as-label": 2,
  // Weak detector: only catches `>...AI...<` on a single line, so it under-reports.
  // The audit found "AI" user-facing on at least six public pages. Treat a rise as
  // real, but do not read 1 as "we are clean".
  "house-copy-ai": 1,
};

for (const f of files.filter(isUI)) {
  lines(f).forEach((raw, i) => {
    if (/\btext-(?:slate|gray)-400\b/.test(raw))
      add("WARN", "low-contrast-token", f.rel, i + 1, "text-*-400 is ~2.85:1 — below WCAG AA", raw.trim().slice(0, 60));

    if (/\btext-xs\b/.test(raw) || /text-\[(?:9|10|11|12|13)px\]/.test(raw))
      add("WARN", "sub-14px-type", f.rel, i + 1, "sub-14px type — below the 40+ legibility floor", raw.trim().slice(0, 60));

    if (/\b(?:alert|confirm)\s*\(/.test(raw) && !/\/\//.test(raw.split(/alert|confirm/)[0]))
      add("WARN", "native-dialog", f.rel, i + 1, "native alert()/confirm() instead of app UI", raw.trim().slice(0, 60));

    if (/placeholder\s*=\s*["'][^"']*\*/.test(raw))
      add("WARN", "placeholder-as-label", f.rel, i + 1, "required marker lives in the placeholder — it vanishes on first keystroke", raw.trim().slice(0, 60));
  });
}

/* House copy rule: "AI" and "credits" must not be user-facing words. */
for (const f of files.filter(isPublic)) {
  lines(stripComments(f.text) === f.text ? f : { text: stripComments(f.text) }).forEach((raw, i) => {
    const m = raw.match(/>[^<]*\b(AI|A\.I\.|credits?)\b/);
    if (m && !/aria-|className|import|from\s+["']/.test(raw))
      add("WARN", "house-copy-ai", f.rel, i + 1,
        'house copy rule: say "policy check" / "Sach assistant", not "AI"/"credits"', m[0].trim().slice(0, 60));
  });
}

/* ================= report ================= */

const fails = findings.filter((f) => f.level === "FAIL");
const warns = findings.filter((f) => f.level === "WARN");
const byRule = (list) =>
  list.reduce((acc, f) => ((acc[f.rule] = (acc[f.rule] || 0) + 1), acc), {});

const overBudget = Object.entries(byRule(warns))
  .filter(([rule, n]) => BUDGETS[rule] !== undefined && n > BUDGETS[rule])
  .map(([rule, n]) => ({ rule, count: n, budget: BUDGETS[rule] }));

if (JSON_OUT) {
  console.log(JSON.stringify({ fails: byRule(fails), warns: byRule(warns), overBudget, findings }, null, 2));
} else {
  const C = { r: "\x1b[31m", y: "\x1b[33m", g: "\x1b[32m", d: "\x1b[2m", x: "\x1b[0m" };
  console.log(`\n  guard — ${files.length} files scanned\n`);

  if (fails.length) {
    console.log(`  ${C.r}FAIL${C.x}  ${fails.length} blocking\n`);
    for (const [rule, n] of Object.entries(byRule(fails)).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${C.r}x${C.x} ${rule} ${C.d}(${n})${C.x}`);
      for (const f of fails.filter((x) => x.rule === rule).slice(0, 4))
        console.log(`      ${f.file}:${f.line} ${C.d}${f.evidence || f.msg}${C.x}`);
      if (n > 4) console.log(`      ${C.d}...and ${n - 4} more${C.x}`);
    }
    console.log("");
  } else console.log(`  ${C.g}PASS${C.x}  no blocking failures\n`);

  console.log(`  ${C.y}WARN${C.x}  budgeted debt\n`);
  for (const [rule, n] of Object.entries(byRule(warns)).sort((a, b) => b[1] - a[1])) {
    const b = BUDGETS[rule];
    const over = b !== undefined && n > b;
    const tag = b === undefined ? `${C.d}(no budget)${C.x}`
      : over ? `${C.r}OVER budget ${b}${C.x}` : `${C.d}budget ${b}${C.x}`;
    console.log(`  ${over ? C.r + "!" + C.x : C.y + "-" + C.x} ${rule} ${C.d}(${n})${C.x} ${tag}`);
  }

  if (overBudget.length) {
    console.log(`\n  ${C.r}Debt grew.${C.x} Budgets may fall as debt is paid, never rise.`);
    for (const o of overBudget) console.log(`      ${o.rule}: ${o.count} > ${o.budget}`);
  }
  console.log("");
}

process.exit(fails.length || overBudget.length ? 1 : 0);
