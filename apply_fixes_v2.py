import re

file_path = r"d:\ensuredV1-FE\backend\server\routes.ts"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

content = "".join(lines)

# 1. Clean up the messy pool section
# We'll find the section starting with "// DB Pool" and ending with "});"
# and replace it with our new pool.
pattern_pool = re.compile(r'// DB Pool.*?const pool = new Pool\(\{.*?\}\);', re.DOTALL)
new_pool_code = """// DB Pool — Supabase Transaction Pooler
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query('SELECT 1').then(() => {
  console.log('✅ DB connected successfully');
}).catch((err) => {
  console.error('❌ DB connection failed:', err.message);
});"""

content = pattern_pool.sub(new_pool_code, content)

# 2. Fix JOINs in /api/public-report/:uuid
# We'll find the specific query in the public-report route
pattern_query = re.compile(r'FROM public_reports pr\s+JOIN clients c ON pr\.client_id = c\.id\s+JOIN agents a ON pr\.agent_id = a\.id', re.MULTILINE)
new_query_part = """FROM public_reports pr
        LEFT JOIN clients c ON pr.client_id = c.id
        LEFT JOIN agents a ON pr.agent_id = a.id"""

content = pattern_query.sub(new_query_part, content)

# 3. Update Logging in catch block
pattern_catch = re.compile(r'\} catch \(err: any\) \{\s+console\.error\("ERROR in fetching public report:", err\);', re.MULTILINE)
new_catch_part = """    } catch (err: any) {
      console.error("PUBLIC REPORT ERROR:", err.message, err.stack);"""

content = pattern_catch.sub(new_catch_part, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Cleanup and replacement complete.")
