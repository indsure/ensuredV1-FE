/**
 * Catalog ingestion via Amazon Bedrock.
 *
 * Reads policy-wording PDFs listed in a worklist TSV, has a Bedrock model extract the
 * WordingProfile defined by backend/server/types/wordingProfile.ts (the single source of
 * truth for the axes AND the prompt), and writes one seed JSON per product into
 * backend/catalog_seed/ — the same folder scripts/ops/load_catalog.mjs already loads.
 *
 * This replaces hand-extraction. It does NOT replace human QA: everything lands with
 * status "unverified", exactly like the 69 seeds that came before it.
 *
 * Credentials come from a file OUTSIDE the repo (default ~/.indsure-bedrock.env) so they
 * can never be picked up by git.
 *
 *   npx tsx scripts/ops/ingest_bedrock.ts --limit 5              # measure cost first
 *   npx tsx scripts/ops/ingest_bedrock.ts --max-usd 60           # then the full run
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import dotenv from "dotenv";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
// wordingProfile.ts is imported dynamically: tsx transpiles it to CommonJS, so its named
// exports arrive under `default` rather than at the top level. Handle both shapes.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SEED_DIR = path.join(REPO_ROOT, "backend", "catalog_seed");

// ── Pricing. ESTIMATES for cost reporting only, not billing truth. Verify against the
// AWS console before trusting the totals for anything that matters.
const USD_PER_M_INPUT = 3.0;
const USD_PER_M_OUTPUT = 15.0;

// A few wordings are enormous (one is 13 MB). The existing Gemini extractor capped at
// 500k chars; keep the same ceiling so behaviour matches.
const MAX_CHARS = 500_000;

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (name: string) => argv.includes(`--${name}`);

const WORKLIST = arg("worklist", path.join(REPO_ROOT, "catalog_worklist.tsv"))!;
const ENV_FILE = arg("env", path.join(os.homedir(), ".indsure-bedrock.env"))!;
const LIMIT = Number(arg("limit", "0"));
const MAX_USD = Number(arg("max-usd", "0"));
const CONCURRENCY = Math.max(1, Number(arg("concurrency", "3")));
// Current Claude models are INFERENCE_PROFILE-only: you invoke the PROFILE id, not the bare
// model id, and the newest profiles carry no "-v1:0" suffix. `aws bedrock
// list-inference-profiles` is the only reliable way to get these.
//
// "global." routes the request worldwide; "apac." keeps it in the Asia-Pacific region. Global
// is fine here because policy wordings are public documents insurers publish. Anything
// touching customer data should use an apac profile instead.
const MODEL = arg("model", "global.anthropic.claude-sonnet-4-6")!;
const DRY = has("dry-run");

// ── credentials ───────────────────────────────────────────────────────────────
// A dry run reads PDFs and calls nothing, so it needs no credentials. Everything else does.
//
// The credentials file is parsed leniently: it accepts either KEY=value lines or the raw
// JSON that `aws iam create-access-key` prints. Splitting that output by hand is fiddly and
// easy to clip, so pasting the whole block verbatim is a supported (and safer) option.
function readCreds(file: string): { id: string; secret: string; region: string } {
  const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  const pick = (envKey: string, jsonKey: string) =>
    (raw.match(new RegExp(`^\\s*${envKey}\\s*=\\s*(.+)$`, "m"))?.[1] ??
      raw.match(new RegExp(`"${jsonKey}"\\s*:\\s*"([^"]+)"`))?.[1] ??
      "").trim().replace(/^["']|["',]$/g, "");
  return {
    id: pick("AWS_ACCESS_KEY_ID", "AccessKeyId"),
    secret: pick("AWS_SECRET_ACCESS_KEY", "SecretAccessKey"),
    region: pick("AWS_REGION", "Region") || "ap-south-1",
  };
}

const creds = readCreds(ENV_FILE);
const REGION = creds.region;
const ACCESS_KEY = creds.id;
const SECRET_KEY = creds.secret;

if (!DRY) {
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`No credentials file at ${ENV_FILE}`);
    process.exit(1);
  }
  // Length is checked up front because a clipped secret fails as an opaque signature error.
  const problems: string[] = [];
  if (!ACCESS_KEY || ACCESS_KEY.includes("PASTE_HERE")) problems.push("access key id is missing");
  else if (ACCESS_KEY.length !== 20) problems.push(`access key id is ${ACCESS_KEY.length} chars, expected 20`);
  if (!SECRET_KEY || SECRET_KEY.includes("PASTE_HERE")) problems.push("secret access key is missing");
  else if (SECRET_KEY.length !== 40) problems.push(`secret access key is ${SECRET_KEY.length} chars, expected 40 — it got clipped when copied`);
  if (problems.length) {
    console.error(`Credentials in ${ENV_FILE} are not usable:`);
    problems.forEach((p) => console.error(`  - ${p}`));
    console.error(`\nYou can paste the whole 'aws iam create-access-key' JSON block into that file as-is.`);
    process.exit(1);
  }
}

const client = new BedrockRuntimeClient({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY || "dry-run",
    secretAccessKey: SECRET_KEY || "dry-run",
  },
});

// ── prompt ────────────────────────────────────────────────────────────────────
// The axis instructions come from wordingProfile.ts so they can never drift. We only add
// product_type, because the worklist contains a few documents that may not be
// comprehensive health at all, and we want the model to tell us rather than guess.
const wpMod: any = await import("../../backend/server/types/wordingProfile.ts");
const buildVariantExtractionPrompt: () => string =
  wpMod.buildVariantExtractionPrompt ?? wpMod.default?.buildVariantExtractionPrompt;
if (typeof buildVariantExtractionPrompt !== "function") {
  console.error("Could not load buildVariantExtractionPrompt from backend/server/types/wordingProfile.ts");
  process.exit(1);
}

// One profile per named variant, and the product_type classification, both come from the prompt
// itself now rather than being patched in here.
const PROMPT = buildVariantExtractionPrompt();

type Row = { uin: string; size_kb: string; filename: string; pdf: string };

function readWorklist(): Row[] {
  if (!fs.existsSync(WORKLIST)) {
    console.error(`No worklist at ${WORKLIST}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(WORKLIST, "utf-8").split(/\r?\n/).filter(Boolean);
  return lines.slice(1).map((l) => {
    const [uin, size_kb, filename, pdf] = l.split("\t");
    return { uin, size_kb, filename, pdf };
  });
}

function pdfText(pdf: string): string {
  const out = execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", pdf, "-"], {
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  });
  // Do NOT collapse runs of spaces. `-layout` encodes table columns AS runs of spaces, so
  // collapsing them destroys every benefit table in the document: a tier grid becomes a row of
  // numbers with nothing tying each one to its plan. That is why variants of Global Health Care,
  // Health Care Supreme and IndusInd Health Global all extracted identically. Tabs are safe to
  // normalise (pdftotext emits none in -layout mode) and 3+ blank lines carry no meaning.
  return out.replace(/\t/g, " ").replace(/\n{3,}/g, "\n\n").slice(0, MAX_CHARS);
}

function slugify(insurer: string, plan: string, uin: string): string {
  const s = `${insurer ?? ""}-${plan ?? ""}`
    .toLowerCase()
    // Tiers are routinely distinguished by punctuation alone: IndusInd Health Global sells Elite,
    // Elite+, Royal and Royal+. Stripping "+" collapsed four variants onto two filenames and the
    // plus tiers silently overwrote the base ones, so half the product vanished with no error.
    // Spell the character out before the non-alphanumeric sweep removes it.
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 3 ? s : `product-${uin.toLowerCase()}`;
}

/** Bedrock may require a regional inference profile rather than the bare model id. */
async function invoke(text: string, modelId: string): Promise<{ body: any; retryId?: string }> {
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    // A three-variant plan repeats every axis three times, so the old 8k ceiling would truncate
    // and the JSON would not parse.
    max_tokens: 24000,
    temperature: 0,
    system: PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text }] }],
  };
  try {
    const res = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      }),
    );
    return { body: JSON.parse(new TextDecoder().decode(res.body)) };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/inference profile|on-demand throughput/i.test(msg) && !modelId.startsWith("apac.")) {
      return invoke(text, `apac.${modelId}`).then((r) => ({ ...r, retryId: `apac.${modelId}` }));
    }
    throw e;
  }
}

function extractJson(raw: string): any {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON object in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function main() {
  fs.mkdirSync(SEED_DIR, { recursive: true });
  let rows = readWorklist();
  if (LIMIT > 0) rows = rows.slice(0, LIMIT);

  console.log(`region=${REGION} model=${MODEL} concurrency=${CONCURRENCY}`);
  console.log(`${rows.length} document(s) to process`);
  if (MAX_USD > 0) console.log(`hard stop at $${MAX_USD.toFixed(2)}`);
  if (DRY) console.log(`DRY RUN — reading PDFs, calling nothing\n`);
  else console.log("");

  let inTok = 0, outTok = 0, done = 0, skipped = 0, failed = 0, stopped = false;
  let dryChars = 0;

  // Every document that reached a verdict is logged, so a re-run resumes instead of paying
  // twice. A skip counts: deciding "this is personal accident, not comparable" cost a call.
  // Per-corpus by default would be safer still, but the flag is the escape hatch: two corpora
  // downloaded from the same insurers share filenames, so one shared ledger silently skips
  // genuinely new documents. Measured at 90 collisions out of 301 on the 30-insurer set.
  const LEDGER = arg("ledger", path.join(SEED_DIR, ".ingested.log"))!;
  const ledger = new Set<string>(
    fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, "utf-8").split(/\r?\n/).filter(Boolean) : [],
  );
  const markDone = (name: string) => { ledger.add(name); fs.appendFileSync(LEDGER, name + "\n"); };
  if (ledger.size && !DRY) console.log(`resuming: ${ledger.size} already processed\n`);
  const failures: string[] = [];
  const cost = () => (inTok / 1e6) * USD_PER_M_INPUT + (outTok / 1e6) * USD_PER_M_OUTPUT;

  let cursor = 0;
  async function worker() {
    while (true) {
      if (stopped) return;
      const i = cursor++;
      if (i >= rows.length) return;
      const r = rows[i];
      const tag = `[${String(i + 1).padStart(3)}/${rows.length}] ${r.filename.slice(0, 52)}`;

      try {
        if (ledger.has(r.filename)) { skipped++; continue; }
        if (!fs.existsSync(r.pdf)) { console.log(`${tag} — file missing, skipped`); skipped++; continue; }
        const text = pdfText(r.pdf);
        if (text.trim().length < 2000) { console.log(`${tag} — no readable text (scanned?), skipped`); skipped++; continue; }
        if (DRY) { dryChars += text.length; console.log(`${tag} — ${(text.length / 1000).toFixed(0)}k chars`); done++; continue; }

        const { body } = await invoke(text, MODEL);
        inTok += body?.usage?.input_tokens ?? 0;
        outTok += body?.usage?.output_tokens ?? 0;

        const doc = extractJson(body?.content?.[0]?.text ?? "");
        const uin = doc.uin || (r.uin !== "UNKNOWN" ? r.uin : null);
        const ptype = doc.product_type ?? "other";

        if (!uin) { console.log(`${tag} — no UIN found, skipped`); markDone(r.filename); skipped++; continue; }
        if (ptype !== "comprehensive_health_indemnity") {
          console.log(`${tag} — ${ptype}, not comparable, skipped`);
          markDone(r.filename); skipped++; continue;
        }

        // One document can describe several products. Classic and Elite share a UIN but differ
        // on the clauses the comparison ranks, so each becomes its own row.
        const variants: any[] = Array.isArray(doc.variants) && doc.variants.length
          ? doc.variants
          : [];
        if (!variants.length) {
          console.log(`${tag} — no variants returned, skipped`);
          markDone(r.filename); skipped++; continue;
        }

        // Two variants whose names differ only by punctuation slugify to one filename, and the
        // second silently overwrites the first: a whole tier disappears with no error and the
        // catalogue looks merely incomplete rather than wrong. Refuse the document instead, so
        // this shows up as a failure to fix rather than as data nobody knows is missing.
        const slugs = new Map<string, string>();
        let collision = "";
        for (const v of variants) {
          const name = typeof v?.variant === "string" ? v.variant.trim() : "";
          const slug = slugify(doc.insurer, [doc.plan_name, name].filter(Boolean).join(" "), uin);
          if (slugs.has(slug)) collision = `"${slugs.get(slug)}" and "${name}" both map to ${slug}`;
          slugs.set(slug, name);
        }
        if (collision) {
          failures.push(`${r.filename}: variant filename collision — ${collision}`);
          console.log(`${tag} — FAILED: variant filename collision — ${collision}`);
          continue;
        }

        const written: string[] = [];
        for (const v of variants) {
          const variant = typeof v?.variant === "string" ? v.variant.trim() : "";
          const seed = {
            ...v,
            insurer: doc.insurer,
            plan_name: doc.plan_name,
            uin,
            variant,
            product_type: ptype,
            source_file: path.basename(r.pdf),
            status: "unverified",
            extracted_by: `bedrock:${MODEL}`,
            extracted_at: new Date().toISOString(),
          };
          const file = path.join(
            SEED_DIR,
            `${slugify(doc.insurer, [doc.plan_name, variant].filter(Boolean).join(" "), uin)}.json`,
          );

          // Re-extracting can yield a slightly different plan name, so a different filename. Two
          // seed files describing the same (uin, variant) would both load and the last would win
          // arbitrarily. Retire the older file. Matching on the PAIR matters: retiring on uin
          // alone would have each variant delete its siblings as it was written.
          for (const other of fs.readdirSync(SEED_DIR).filter((f) => f.endsWith(".json"))) {
            const otherPath = path.join(SEED_DIR, other);
            if (otherPath === file) continue;
            try {
              const o = JSON.parse(fs.readFileSync(otherPath, "utf-8"));
              if (o?.uin === uin && (o?.variant ?? "") === variant) {
                fs.renameSync(otherPath, otherPath + ".superseded");
              }
            } catch { /* unreadable seed: leave it alone */ }
          }

          fs.writeFileSync(file, JSON.stringify(seed, null, 2) + "\n", "utf-8");
          written.push(variant || "(single)");
        }

        // A document that used to produce one blank-variant row now produces named ones. The old
        // row is not superseded by the loop above, because that matches on (uin, variant) and
        // "Silver" never equals "". Left alone it would survive as a stale duplicate carrying the
        // single ranked value this whole change exists to remove.
        if (written.some((w) => w !== "(single)")) {
          for (const other of fs.readdirSync(SEED_DIR).filter((f) => f.endsWith(".json"))) {
            const otherPath = path.join(SEED_DIR, other);
            try {
              const o = JSON.parse(fs.readFileSync(otherPath, "utf-8"));
              if (o?.uin === uin && (o?.variant ?? "") === "") {
                fs.renameSync(otherPath, otherPath + ".superseded");
                console.log(`${tag} — retired the variant-less row`);
              }
            } catch { /* unreadable seed: leave it alone */ }
          }
        }

        markDone(r.filename);
        done++;
        const label = written.length > 1 ? `${written.length} variants: ${written.join(", ")}` : written[0];
        console.log(`${tag} — ok  ${doc.insurer ?? "?"} / ${doc.plan_name ?? "?"}  [${label}]  [$${cost().toFixed(2)} so far]`);

        if (MAX_USD > 0 && cost() >= MAX_USD) {
          stopped = true;
          console.log(`\nSTOPPED: hit the $${MAX_USD.toFixed(2)} ceiling.`);
          return;
        }
      } catch (e: any) {
        failed++;
        failures.push(`${r.filename}: ${String(e?.message ?? e).slice(0, 160)}`);
        console.log(`${tag} — FAILED: ${String(e?.message ?? e).slice(0, 110)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\n${"─".repeat(60)}`);
  console.log(`written: ${done}   skipped: ${skipped}   failed: ${failed}`);
  console.log(`tokens:  ${inTok.toLocaleString()} in / ${outTok.toLocaleString()} out`);
  console.log(`cost:    ~$${cost().toFixed(2)}  (estimate — confirm in Cost Explorer)`);
  if (done > 0 && !DRY) console.log(`per doc: ~$${(cost() / done).toFixed(3)}`);
  if (DRY && done > 0) {
    // ~4 chars per token for English prose; output assumed ~4k tokens of JSON per document.
    const estIn = dryChars / 4;
    const estOut = done * 4000;
    const estUsd = (estIn / 1e6) * USD_PER_M_INPUT + (estOut / 1e6) * USD_PER_M_OUTPUT;
    console.log(`text:    ${(dryChars / 1e6).toFixed(1)}M chars across ${done} documents`);
    console.log(`ESTIMATE ~${(estIn / 1e6).toFixed(2)}M input tokens + ~${(estOut / 1e3).toFixed(0)}k output`);
    console.log(`         ~$${estUsd.toFixed(2)} total, ~$${(estUsd / done).toFixed(3)} per document`);
    console.log(`         (rough — the real run reports billed tokens)`);
  }
  if (failures.length) {
    console.log(`\nfailures:`);
    failures.slice(0, 15).forEach((f) => console.log(`  - ${f}`));
  }
  console.log(`\nseeds in ${SEED_DIR}`);
  console.log(`next:    node scripts/ops/load_catalog.mjs`);
}

main().catch((e) => { console.error(e); process.exit(1); });
