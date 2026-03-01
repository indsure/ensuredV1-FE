import postgres from "postgres";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function migrate() {
  const sql = postgres(connectionString!, { max: 1 });

  console.log("[Migrate] Running database migrations...");

  try {
    // Enable pgvector extension
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log("[Migrate] pgvector extension enabled");

    // --- hospitals ---
    await sql`
      CREATE TABLE IF NOT EXISTS hospitals (
        id              SERIAL PRIMARY KEY,
        insurer_slug    TEXT NOT NULL,
        hospital_name   TEXT NOT NULL,
        address         TEXT,
        city            TEXT,
        state           TEXT,
        pincode         TEXT,
        source_pdf      TEXT,
        quality_score   REAL NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_hospitals_insurer ON hospitals (insurer_slug)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals (city)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_hospitals_state ON hospitals (state)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_hospitals_pincode ON hospitals (pincode)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_hospitals_quality ON hospitals (quality_score)`;
    console.log("[Migrate] hospitals table created");

    // --- hospital_network_embeddings ---
    await sql`
      CREATE TABLE IF NOT EXISTS hospital_network_embeddings (
        id              SERIAL PRIMARY KEY,
        insurer_slug    TEXT NOT NULL,
        city            TEXT NOT NULL,
        state           TEXT,
        summary_text    TEXT NOT NULL,
        hospital_count  INT NOT NULL,
        top_hospitals   TEXT[] NOT NULL,
        pincodes        TEXT[] NOT NULL,
        embedding       vector(768) NOT NULL,
        metadata        JSONB,
        created_at      TIMESTAMPTZ DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_hne_insurer_city ON hospital_network_embeddings (insurer_slug, city)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_hne_state ON hospital_network_embeddings (state)`;
    console.log("[Migrate] hospital_network_embeddings table created");

    // --- policy_wording_chunks ---
    await sql`
      CREATE TABLE IF NOT EXISTS policy_wording_chunks (
        id              SERIAL PRIMARY KEY,
        insurer         TEXT NOT NULL,
        plan            TEXT NOT NULL,
        year            INT,
        section_title   TEXT,
        chunk_index     INT NOT NULL,
        chunk_text      TEXT NOT NULL,
        char_count      INT NOT NULL,
        embedding       vector(768) NOT NULL,
        source_file     TEXT NOT NULL,
        source_type     TEXT NOT NULL DEFAULT 'manual',
        checksum        TEXT NOT NULL,
        metadata        JSONB,
        created_at      TIMESTAMPTZ DEFAULT now()
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_pwc_unique_chunk ON policy_wording_chunks (insurer, plan, year, chunk_index)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pwc_insurer_plan_year ON policy_wording_chunks (insurer, plan, year)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pwc_source_type ON policy_wording_chunks (source_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pwc_checksum ON policy_wording_chunks (checksum)`;
    console.log("[Migrate] policy_wording_chunks table created");

    // --- user_profiles ---
    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        age                     INT,
        city                    TEXT,
        state                   TEXT,
        pincode                 TEXT,
        pre_existing_conditions TEXT[] DEFAULT '{}',
        household_income        NUMERIC,
        family_size             INT DEFAULT 1,
        preferred_language      TEXT DEFAULT 'en',
        city_tier               TEXT,
        created_at              TIMESTAMPTZ DEFAULT now(),
        updated_at              TIMESTAMPTZ DEFAULT now()
      )
    `;
    console.log("[Migrate] user_profiles table created");

    // --- analysis_jobs ---
    await sql`
      CREATE TABLE IF NOT EXISTS analysis_jobs (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id      UUID REFERENCES user_profiles(id),
        status          TEXT NOT NULL DEFAULT 'pending',
        insurance_type  TEXT,
        error           TEXT,
        created_at      TIMESTAMPTZ DEFAULT now(),
        completed_at    TIMESTAMPTZ
      )
    `;
    console.log("[Migrate] analysis_jobs table created");

    // --- analysis_results ---
    await sql`
      CREATE TABLE IF NOT EXISTS analysis_results (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id              UUID NOT NULL REFERENCES analysis_jobs(id),
        report_json         JSONB,
        policy_text         TEXT,
        policy_metadata     JSONB,
        suitability_result  JSONB,
        rag_provenance      JSONB,
        created_at          TIMESTAMPTZ DEFAULT now()
      )
    `;
    console.log("[Migrate] analysis_results table created");

    // --- chat_sessions ---
    await sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id  UUID REFERENCES user_profiles(id),
        job_id      UUID REFERENCES analysis_jobs(id),
        messages    JSONB NOT NULL DEFAULT '[]',
        created_at  TIMESTAMPTZ DEFAULT now(),
        updated_at  TIMESTAMPTZ DEFAULT now()
      )
    `;
    console.log("[Migrate] chat_sessions table created");

    // --- HNSW indexes for vector search ---
    await sql`
      CREATE INDEX IF NOT EXISTS idx_hospital_embeddings_hnsw
      ON hospital_network_embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `;
    console.log("[Migrate] HNSW index on hospital_network_embeddings created");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_policy_chunks_hnsw
      ON policy_wording_chunks
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `;
    console.log("[Migrate] HNSW index on policy_wording_chunks created");

    console.log("[Migrate] All migrations completed successfully!");
  } catch (error) {
    console.error("[Migrate] Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
