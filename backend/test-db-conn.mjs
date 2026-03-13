import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres';

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
