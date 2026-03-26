const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.khxbabotbvnyjwvqtumt:zQqau%23PVNTZG%2Cm6@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=no-verify'
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
