import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}

const connectionString = DATABASE_URL;

async function update() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database.');
    
    await client.query('ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT \'info\'');
    console.log('Added type column to notifications table.');
  } catch (err) {
    console.error('Error updating table:', err);
  } finally {
    await client.end();
  }
}

update();
