import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres';

async function setup() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database.');
    
    const sql = fs.readFileSync(path.join(process.cwd(), 'setup_notifications.sql'), 'utf-8');
    await client.query(sql);
    console.log('SQL setup script executed successfully.');
  } catch (err) {
    console.error('Error executing setup script:', err);
  } finally {
    await client.end();
  }
}

setup();
