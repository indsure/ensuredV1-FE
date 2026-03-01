import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  uuid,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/pg-core";

// Custom pgvector type
const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return "vector(768)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    // Parse "[0.1,0.2,...]" format from postgres
    const str = String(value);
    return str
      .slice(1, -1)
      .split(",")
      .map(Number);
  },
});

// --- Structured hospital records ---
export const hospitals = pgTable(
  "hospitals",
  {
    id: serial("id").primaryKey(),
    insurerSlug: text("insurer_slug").notNull(),
    hospitalName: text("hospital_name").notNull(),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    sourcePdf: text("source_pdf"),
    qualityScore: real("quality_score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_hospitals_insurer").on(table.insurerSlug),
    index("idx_hospitals_city").on(table.city),
    index("idx_hospitals_state").on(table.state),
    index("idx_hospitals_pincode").on(table.pincode),
    index("idx_hospitals_quality").on(table.qualityScore),
  ]
);

// --- Hospital group embeddings ---
export const hospitalNetworkEmbeddings = pgTable(
  "hospital_network_embeddings",
  {
    id: serial("id").primaryKey(),
    insurerSlug: text("insurer_slug").notNull(),
    city: text("city").notNull(),
    state: text("state"),
    summaryText: text("summary_text").notNull(),
    hospitalCount: integer("hospital_count").notNull(),
    topHospitals: text("top_hospitals").array().notNull(),
    pincodes: text("pincodes").array().notNull(),
    embedding: vector("embedding").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_hne_insurer_city").on(table.insurerSlug, table.city),
    index("idx_hne_state").on(table.state),
  ]
);

// --- Policy wording chunks ---
export const policyWordingChunks = pgTable(
  "policy_wording_chunks",
  {
    id: serial("id").primaryKey(),
    insurer: text("insurer").notNull(),
    plan: text("plan").notNull(),
    year: integer("year"),
    sectionTitle: text("section_title"),
    chunkIndex: integer("chunk_index").notNull(),
    chunkText: text("chunk_text").notNull(),
    charCount: integer("char_count").notNull(),
    embedding: vector("embedding").notNull(),
    sourceFile: text("source_file").notNull(),
    sourceType: text("source_type").notNull().default("manual"),
    checksum: text("checksum").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_pwc_unique_chunk").on(
      table.insurer,
      table.plan,
      table.year,
      table.chunkIndex
    ),
    index("idx_pwc_insurer_plan_year").on(
      table.insurer,
      table.plan,
      table.year
    ),
    index("idx_pwc_source_type").on(table.sourceType),
    index("idx_pwc_checksum").on(table.checksum),
  ]
);

// --- User profiles ---
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  age: integer("age"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  preExistingConditions: text("pre_existing_conditions").array().default([]),
  householdIncome: numeric("household_income"),
  familySize: integer("family_size").default(1),
  preferredLanguage: text("preferred_language").default("en"),
  cityTier: text("city_tier"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Analysis jobs ---
export const analysisJobs = pgTable("analysis_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").references(() => userProfiles.id),
  status: text("status").notNull().default("pending"),
  insuranceType: text("insurance_type"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// --- Analysis results ---
export const analysisResults = pgTable("analysis_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => analysisJobs.id),
  reportJson: jsonb("report_json"),
  policyText: text("policy_text"),
  policyMetadata: jsonb("policy_metadata"),
  suitabilityResult: jsonb("suitability_result"),
  ragProvenance: jsonb("rag_provenance"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// --- Chat sessions ---
export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").references(() => userProfiles.id),
  jobId: uuid("job_id").references(() => analysisJobs.id),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
