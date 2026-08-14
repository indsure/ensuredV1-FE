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

    const query = `
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'policies';
    `;
    
    const res = await client.query(query);
    console.log("Columns requiring input (NOT NULL and no default):");
    for (const row of res.rows) {
      if (row.is_nullable === 'NO' && row.column_default === null) {
        console.log(`- ${row.column_name}`);
      }
    }

  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

run();
