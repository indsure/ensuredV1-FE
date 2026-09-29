/** One-message probe: which request settings a model accepts. Costs a fraction of a paisa. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RESPONSE_SCHEMA, systemPrompt, userPrompt } from "../src/core/understand.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const model = process.argv[2] || "gemini-3.5-flash-lite";
const envFile = [path.resolve(here, "../../../IndSure/.env"), path.resolve(here, "../../.env")].find((p) => fs.existsSync(p))!;
const key = fs.readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("GEMINI_API_KEY="))!.slice(15).trim().replace(/^["']|["']$/g, "");

// Schema without the ARRAY min/max bounds, in case those are what is rejected.
const looseSchema = JSON.parse(JSON.stringify(RESPONSE_SCHEMA));
delete looseSchema.properties.actions.minItems;
delete looseSchema.properties.actions.maxItems;

const variants: [string, any][] = [
  ["thinkingBudget 0 + schema", { thinkingConfig: { thinkingBudget: 0 }, schema: RESPONSE_SCHEMA }],
  ["thinkingLevel minimal + schema", { thinkingConfig: { thinkingLevel: "minimal" }, schema: RESPONSE_SCHEMA }],
  ["thinkingLevel low + schema", { thinkingConfig: { thinkingLevel: "low" }, schema: RESPONSE_SCHEMA }],
  ["no thinking config + schema", { schema: RESPONSE_SCHEMA }],
  ["thinkingLevel minimal + loose schema", { thinkingConfig: { thinkingLevel: "minimal" }, schema: looseSchema }],
  ["no thinking config + loose schema", { schema: looseSchema }],
];

for (const [label, v] of variants) {
  const body: any = {
    systemInstruction: { parts: [{ text: systemPrompt() }] },
    contents: [{ role: "user", parts: [{ text: userPrompt("lead Ramesh won", {}, "2026-09-29") }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: v.schema, ...(v.thinkingConfig ? { thinkingConfig: v.thinkingConfig } : {}) },
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body),
  });
  const j: any = await res.json().catch(() => ({}));
  const um = j.usageMetadata ?? {};
  console.log(`${label}: HTTP ${res.status}${res.ok ? ` thinkTok=${um.thoughtsTokenCount ?? 0} out=${String(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").slice(0, 90)}` : ` ${String(j?.error?.message ?? "").slice(0, 200)}`}`);
  if (res.ok) break;
}
