const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase DB");

    const query = `
      ALTER TABLE policies 
      ADD COLUMN IF NOT EXISTS days_to_expiry INTEGER,
      ADD COLUMN IF NOT EXISTS action_recommendation TEXT,
      ADD COLUMN IF NOT EXISTS shareable_link TEXT;
    `;
    
    await client.query(query);
    console.log("Successfully added columns to policies table.");

  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

run();
