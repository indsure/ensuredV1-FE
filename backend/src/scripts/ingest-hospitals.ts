import "dotenv/config";
import fs from "fs";
import path from "path";
import postgres from "postgres";
import { getEmbeddingService, TaskType } from "../services/embedding.service";

// --- Types ---

interface RawHospitalRecord {
  insurer_slug?: string;
  hospital_name?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  source_pdf?: string;
  [key: string]: any;
}

interface CleanedRecord {
  insurerSlug: string;
  hospitalName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  sourcePdf: string | null;
  qualityScore: number;
}

// --- Constants ---

const CITY_ALIASES: Record<string, string> = {
  bombay: "Mumbai",
  bengaluru: "Bangalore",
  calcutta: "Kolkata",
  madras: "Chennai",
  trivandrum: "Thiruvananthapuram",
  cochin: "Kochi",
  pondicherry: "Puducherry",
  poona: "Pune",
  baroda: "Vadodara",
  vizag: "Visakhapatnam",
  gurgaon: "Gurugram",
};

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

const LOCATION_START_KEYWORDS = /^(near|opp|behind|floor|plot|road|beside|above|below|opposite|adjacent)\b/i;
const DATE_PATTERN = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
const INSURER_FULL_NAMES: Record<string, string> = {
  niva_bupa: "Niva Bupa Health Insurance",
  hdfc_ergo: "HDFC ERGO General Insurance",
  star_health: "Star Health and Allied Insurance",
  icici_lombard: "ICICI Lombard General Insurance",
  care_health: "Care Health Insurance",
  aditya_birla: "Aditya Birla Health Insurance",
  manipal_cigna: "ManipalCigna Health Insurance",
  bajaj_allianz: "Bajaj Allianz General Insurance",
  tata_aig: "Tata AIG General Insurance",
  sbi_general: "SBI General Insurance",
  acko: "Acko General Insurance",
  navi: "Navi General Insurance",
  reliance: "Reliance General Insurance",
  digit: "Go Digit General Insurance",
  max_bupa: "Niva Bupa Health Insurance",
  religare: "Care Health Insurance",
};

// --- Quality Scoring ---

function scoreRecord(record: RawHospitalRecord): { score: number; drop: boolean } {
  const name = record.hospital_name?.trim() || "";

  // DROP conditions
  if (!name) return { score: 0, drop: true };
  if (DATE_PATTERN.test(name)) return { score: 0, drop: true };
  if (LOCATION_START_KEYWORDS.test(name)) return { score: 0, drop: true };

  let score = 1.0;

  if (name.length < 4) score -= 0.3;
  if (name.includes("( City") || name.includes("(City")) score -= 0.4;
  if (/^\d/.test(name)) score -= 0.2;
  if (!record.city?.trim()) score -= 0.2;
  if (!record.state?.trim()) score -= 0.1;
  if (!record.pincode?.trim()) score -= 0.1;
  if (record.city && /^\d+$/.test(record.city.trim())) score -= 0.3;
  if (!record.address?.trim() || (record.address?.trim().length || 0) < 10) score -= 0.1;

  return { score: Math.max(0, score), drop: score < 0.3 };
}

// --- Normalization ---

function normalizeCity(raw: string | undefined): string | null {
  if (!raw) return null;
  let city = raw.trim().replace(/\s+/g, " ");

  // Numeric city is bad extraction
  if (/^\d+$/.test(city)) return null;

  // Title case
  city = city
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  // Strip trailing numbers
  city = city.replace(/\s+\d+$/, "");

  // Apply aliases
  const lower = city.toLowerCase();
  if (CITY_ALIASES[lower]) city = CITY_ALIASES[lower];

  return city || null;
}

function normalizeState(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Exact match (case-insensitive)
  const exact = INDIAN_STATES.find(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) return exact;

  // Fuzzy match (Levenshtein distance <= 2)
  for (const state of INDIAN_STATES) {
    if (levenshtein(state.toLowerCase(), trimmed.toLowerCase()) <= 2) {
      return state;
    }
  }

  return trimmed; // Return as-is if no match
}

function normalizePincode(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 6 && /^[1-9]/.test(digits)) return digits;
  return null;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

// --- Main Ingestion ---

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 5 });

  const dataPath = path.join(
    process.cwd(),
    "src",
    "data",
    "insurance_networks",
    "insurance_hospital_networks.json"
  );

  console.log("[Ingest] Loading hospital data from:", dataPath);
  const rawData: RawHospitalRecord[] = JSON.parse(
    fs.readFileSync(dataPath, "utf-8")
  );
  console.log(`[Ingest] Loaded ${rawData.length} raw records`);

  // Step 1: Truncate existing data
  console.log("[Ingest] Clearing existing hospital data...");
  await sql`TRUNCATE hospitals, hospital_network_embeddings RESTART IDENTITY CASCADE`;

  // Step 2: Clean + score + insert
  let inserted = 0;
  let dropped = 0;
  const batchSize = 1000;
  const cleanedRecords: CleanedRecord[] = [];

  for (const record of rawData) {
    const { score, drop } = scoreRecord(record);
    if (drop) {
      dropped++;
      continue;
    }

    cleanedRecords.push({
      insurerSlug: record.insurer_slug || "unknown",
      hospitalName: record.hospital_name!.trim(),
      address: record.address?.trim() || null,
      city: normalizeCity(record.city),
      state: normalizeState(record.state),
      pincode: normalizePincode(record.pincode),
      sourcePdf: record.source_pdf || null,
      qualityScore: parseFloat(score.toFixed(2)),
    });
  }

  console.log(`[Ingest] After cleaning: ${cleanedRecords.length} records survive, ${dropped} dropped`);

  // Batch insert
  for (let i = 0; i < cleanedRecords.length; i += batchSize) {
    const batch = cleanedRecords.slice(i, i + batchSize);
    await sql`
      INSERT INTO hospitals ${sql(
        batch.map((r) => ({
          insurer_slug: r.insurerSlug,
          hospital_name: r.hospitalName,
          address: r.address,
          city: r.city,
          state: r.state,
          pincode: r.pincode,
          source_pdf: r.sourcePdf,
          quality_score: r.qualityScore,
        }))
      )}
    `;
    inserted += batch.length;
    if ((i / batchSize) % 10 === 0) {
      console.log(`[Ingest] Inserted ${inserted}/${cleanedRecords.length} records...`);
    }
  }

  console.log(`[Ingest] Hospital insert complete: ${inserted} records`);

  // Step 3: Group for embeddings
  console.log("[Ingest] Grouping hospitals for embeddings...");
  const groups = await sql`
    SELECT
      insurer_slug,
      city,
      state,
      COUNT(*)::int as hospital_count,
      ARRAY_AGG(DISTINCT pincode) FILTER (WHERE pincode IS NOT NULL) as pincodes,
      ARRAY_AGG(hospital_name ORDER BY quality_score DESC) as all_names
    FROM hospitals
    WHERE city IS NOT NULL AND quality_score >= 0.5
    GROUP BY insurer_slug, city, state
  `;

  console.log(`[Ingest] Found ${groups.length} groups to embed`);

  // Step 4: Generate summaries and embed
  const embeddingService = getEmbeddingService();
  const summaries: string[] = [];
  const groupData: any[] = [];

  for (const group of groups) {
    const insurerName = INSURER_FULL_NAMES[group.insurer_slug] || group.insurer_slug;
    const topNames = (group.all_names as string[]).slice(0, 5);
    const pincodes = ((group.pincodes as string[]) || []).sort();
    const count = group.hospital_count as number;

    let density = "Limited coverage";
    if (count >= 50) density = "Excellent coverage";
    else if (count >= 20) density = "Good coverage";
    else if (count >= 5) density = "Moderate coverage";

    const summary = [
      `${insurerName} hospital network in ${group.city}, ${group.state || "India"}:`,
      `${count} empanelled hospitals.`,
      `Key facilities: ${topNames.join(", ")}.`,
      pincodes.length > 0 ? `Pincodes served: ${pincodes.join(", ")}.` : "",
      `Coverage density: ${density}.`,
    ]
      .filter(Boolean)
      .join("\n");

    summaries.push(summary);
    groupData.push(group);
  }

  // Embed in batches
  console.log(`[Ingest] Embedding ${summaries.length} group summaries...`);
  const embeddings = await embeddingService.embedBatch(
    summaries,
    TaskType.RETRIEVAL_DOCUMENT,
    50
  );

  // Step 5: Insert embeddings
  console.log("[Ingest] Inserting hospital network embeddings...");
  for (let i = 0; i < groupData.length; i += 100) {
    const batch = groupData.slice(i, i + 100);
    const batchEmbeddings = embeddings.slice(i, i + 100);
    const batchSummaries = summaries.slice(i, i + 100);

    for (let j = 0; j < batch.length; j++) {
      const group = batch[j];
      const topNames = (group.all_names as string[]).slice(0, 5);
      const pincodes = ((group.pincodes as string[]) || []).filter(Boolean);
      const embeddingStr = `[${batchEmbeddings[j].join(",")}]`;

      await sql`
        INSERT INTO hospital_network_embeddings
        (insurer_slug, city, state, summary_text, hospital_count, top_hospitals, pincodes, embedding)
        VALUES (
          ${group.insurer_slug},
          ${group.city},
          ${group.state},
          ${batchSummaries[j]},
          ${group.hospital_count},
          ${sql.array(topNames)},
          ${sql.array(pincodes)},
          ${embeddingStr}::vector
        )
      `;
    }

    console.log(
      `[Ingest] Embedded ${Math.min(i + 100, groupData.length)}/${groupData.length} groups...`
    );
  }

  // Final stats
  const [{ count: hospitalCount }] = await sql`SELECT COUNT(*)::int as count FROM hospitals`;
  const [{ count: embeddingCount }] = await sql`SELECT COUNT(*)::int as count FROM hospital_network_embeddings`;
  const [{ count: lowQuality }] = await sql`SELECT COUNT(*)::int as count FROM hospitals WHERE quality_score < 0.3`;

  console.log("\n=== Ingestion Complete ===");
  console.log(`Hospitals in DB: ${hospitalCount}`);
  console.log(`Embedding groups: ${embeddingCount}`);
  console.log(`Low quality (< 0.3) in DB: ${lowQuality} (should be 0)`);
  console.log(`Records dropped during cleaning: ${dropped}`);

  await sql.end();
}

main().catch((err) => {
  console.error("[Ingest] Fatal error:", err);
  process.exit(1);
});
