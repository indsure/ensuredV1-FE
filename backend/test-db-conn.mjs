import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}

const connectionString = DATABASE_URL;

async function testConnection() {
  const client = new Client({
    connectionString: connectionString,
  });
  try {
    await client.connect();
    console.log('Connected to Supabase DB successfully!');
    const res = await client.query('SELECT current_database();');
    console.log('Current Database:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection error:', err);
  }
}

testConnection();
