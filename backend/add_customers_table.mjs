import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Creating customers table + clients.customer_id...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        name text NOT NULL,
        phone text,
        email text,
        dob date,
        city text,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_customers_agent ON customers(agent_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_customer ON clients(customer_id);`);

    // Mirror the RLS posture of clients ("Agent: own clients", ALL, auth.uid() = agent_id).
    await pool.query(`ALTER TABLE customers ENABLE ROW LEVEL SECURITY;`);
    await pool.query(`DROP POLICY IF EXISTS "Agent: own customers" ON customers;`);
    await pool.query(`
      CREATE POLICY "Agent: own customers" ON customers
        FOR ALL USING (auth.uid() = agent_id);
    `);

    // Reload PostgREST schema cache so supabase-js sees the new table/column.
    await pool.query(`NOTIFY pgrst, 'reload schema';`);

    const { rows: cols } = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'customers'
      ORDER BY ordinal_position;
    `);
    console.log('customers columns:', cols);

    const { rows: fk } = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'clients' AND column_name = 'customer_id';
    `);
    console.log('clients.customer_id:', fk);

    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error applying schema updates:', error);
    process.exit(1);
  }
}

run();
