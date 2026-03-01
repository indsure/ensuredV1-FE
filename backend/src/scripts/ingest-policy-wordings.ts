import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import postgres from "postgres";
import { chunkDocument } from "../utils/chunker";
import { getEmbeddingService, TaskType } from "../services/embedding.service";
import insurerMap from "../data/insurer_normalization.json" with { type: "json" };
import planAliases from "../data/plan_aliases.json" with { type: "json" };

const KB_PATH = path.join(process.cwd(), "src", "knowledge_base");

interface ParsedFilename {
  insurer: string;
  plan: string;
  year: number | null;
}

function parseFilename(filename: string): ParsedFilename | null {
  // Pattern: {InsurerNoSpecials}_{PlanNoSpecials}_{Year}.txt
  const base = filename.replace(/\.txt$/i, "");
  const parts = base.split("_");

  if (parts.length < 2) return null;

  // Try to extract year from last part
  let year: number | null = null;
  const lastPart = parts[parts.length - 1];
  if (/^\d{4}$/.test(lastPart)) {
    year = parseInt(lastPart);
    parts.pop();
  }

  // Resolve insurer from first part(s)
  let insurer: string | null = null;
  const insurerMapTyped = insurerMap as Record<string, string>;

  // Try progressively longer prefixes
  for (let i = 1; i <= parts.length; i++) {
    const candidate = parts.slice(0, i).join("_").toLowerCase();
    const candidateNoSpecials = candidate.replace(/[^a-z0-9]/g, "");

    for (const [key, val] of Object.entries(insurerMapTyped)) {
      const keyClean = key.replace(/[^a-z0-9]/g, "");
      if (candidateNoSpecials.includes(keyClean) || keyClean.includes(candidateNoSpecials)) {
        insurer = val;
        break;
      }
    }
    if (insurer) {
      parts.splice(0, i);
      break;
    }
  }

  if (!insurer) {
    // Use raw first part as insurer name
    insurer = parts.shift() || "Unknown";
  }

  // Resolve plan from remaining parts
  let plan = parts.join(" ") || "Unknown";
  const planAliasesTyped = planAliases as Record<string, { canonical: string; aliases: string[] }>;

  const planLower = plan.toLowerCase();
  for (const [, data] of Object.entries(planAliasesTyped)) {
    if (data.canonical.toLowerCase() === planLower) {
      plan = data.canonical;
      break;
    }
    if (data.aliases.some((alias) => planLower.includes(alias))) {
      plan = data.canonical;
      break;
    }
  }

  return { insurer, plan, year };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 5 });
  const embeddingService = getEmbeddingService();

  // Find all .txt files in knowledge_base
  const files = fs
    .readdirSync(KB_PATH)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => path.join(KB_PATH, f));

  console.log(`[PolicyIngest] Found ${files.length} policy files`);

  for (const filePath of files) {
    const filename = path.basename(filePath);
    console.log(`\n[PolicyIngest] Processing: ${filename}`);

    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.trim()) {
      console.log(`[PolicyIngest] Skipping empty file: ${filename}`);
      continue;
    }

    // Parse filename for metadata
    const parsed = parseFilename(filename);
    if (!parsed) {
      console.warn(`[PolicyIngest] Could not parse filename: ${filename}`);
      continue;
    }

    const { insurer, plan, year } = parsed;
    console.log(`[PolicyIngest] Metadata: insurer=${insurer}, plan=${plan}, year=${year}`);

    // Check if already ingested via file checksum
    const fileChecksum = crypto
      .createHash("sha256")
      .update(content)
      .digest("hex");

    const existing = await sql`
      SELECT COUNT(*)::int as count FROM policy_wording_chunks
      WHERE insurer = ${insurer} AND plan = ${plan}
      AND ${year ? sql`year = ${year}` : sql`year IS NULL`}
    `;

    if (existing[0].count > 0) {
      // Delete existing chunks to allow re-ingestion
      console.log(`[PolicyIngest] Removing ${existing[0].count} existing chunks for re-ingestion`);
      await sql`
        DELETE FROM policy_wording_chunks
        WHERE insurer = ${insurer} AND plan = ${plan}
        AND ${year ? sql`year = ${year}` : sql`year IS NULL`}
      `;
    }

    // Chunk the document
    const chunks = chunkDocument(content);
    console.log(`[PolicyIngest] Generated ${chunks.length} chunks (avg ${Math.round(content.length / chunks.length)} chars)`);

    // Embed all chunks
    const chunkTexts = chunks.map((c) => c.chunkText);
    const embeddings = await embeddingService.embedBatch(
      chunkTexts,
      TaskType.RETRIEVAL_DOCUMENT,
      50
    );

    // Insert chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkChecksum = crypto
        .createHash("sha256")
        .update(chunk.chunkText)
        .digest("hex");
      const embeddingStr = `[${embeddings[i].join(",")}]`;

      await sql`
        INSERT INTO policy_wording_chunks
        (insurer, plan, year, section_title, chunk_index, chunk_text, char_count,
         embedding, source_file, source_type, checksum)
        VALUES (
          ${insurer}, ${plan}, ${year}, ${chunk.sectionTitle},
          ${chunk.chunkIndex}, ${chunk.chunkText}, ${chunk.charCount},
          ${embeddingStr}::vector, ${filename}, 'manual', ${chunkChecksum}
        )
      `;
    }

    console.log(`[PolicyIngest] Inserted ${chunks.length} chunks for ${insurer} - ${plan}`);
  }

  // Final stats
  const [{ count: totalChunks }] = await sql`SELECT COUNT(*)::int as count FROM policy_wording_chunks`;
  console.log(`\n=== Policy Ingestion Complete ===`);
  console.log(`Total chunks in DB: ${totalChunks}`);

  await sql.end();
}

main().catch((err) => {
  console.error("[PolicyIngest] Fatal error:", err);
  process.exit(1);
});
