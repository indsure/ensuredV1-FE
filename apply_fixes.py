import os

file_path = r"d:\ensuredV1-FE\backend\server\routes.ts"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Pool
old_pool = """// DB Pool — Supabase Transaction Pooler (port 6543)
const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.khxbabotbvnyjwvqtumt',
  password: 'zQqau#PVNTZG,m6',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});"""

new_pool = """// DB Pool — Supabase Transaction Pooler
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query('SELECT 1').then(() => {
  console.log('✅ DB connected successfully');
}).catch((err) => {
  console.error('❌ DB connection failed:', err.message);
});"""

# Try replacement with less specific comment to avoid encoding issues
content = content.replace("const pool = new Pool({", new_pool, 1) if "const pool = new Pool({" in content else content

# 2. Update JOINs in /api/public-report/:uuid
old_query = """        FROM public_reports pr
        JOIN clients c ON pr.client_id = c.id
        JOIN agents a ON pr.agent_id = a.id
        WHERE pr.id = $1"""

new_query = """        FROM public_reports pr
        LEFT JOIN clients c ON pr.client_id = c.id
        LEFT JOIN agents a ON pr.agent_id = a.id
        WHERE pr.id = $1"""

content = content.replace(old_query, new_query)

# 3. Update Logging
old_catch = """    } catch (err: any) {
      console.error("ERROR in fetching public report:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }"""

new_catch = """    } catch (err: any) {
      console.error("PUBLIC REPORT ERROR:", err.message, err.stack);
      res.status(500).json({ error: "Internal Server Error" });
    }"""

content = content.replace(old_catch, new_catch)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement complete.")
