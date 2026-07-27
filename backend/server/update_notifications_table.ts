import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres';

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
