const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.khxbabotbvnyjwvqtumt:zQqau%23PVNTZG%2Cm6@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=no-verify'
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
