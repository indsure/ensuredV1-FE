import re

file_path = r"d:\ensuredV1-FE\backend\server\routes.ts"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Surgical fix for the Pool section
# We'll replace everything from the first "DB Pool" comment down to the "upload = multer" line
pool_replacement = """// DB Pool — Supabase Transaction Pooler
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query('SELECT 1').then(() => {
  console.log('✅ DB connected successfully');
}).catch((err) => {
  console.error('❌ DB connection failed:', err.message);
});


const upload = multer({"""

# Regex to find everything from "// DB Pool" until "const upload = multer({"
content = re.sub(r'// DB Pool.*?(?=const upload = multer\(\{)', pool_replacement, content, flags=re.DOTALL)

# 2. Surgical fix for the /api/public-report/:uuid query
# We'll match the entire SELECT block to be safe
old_query_block = re.compile(r'const reportRes = await pool\.query\(`\s+SELECT\s+pr\.recommendation_data,.*?`\, \[uuid\]\);', re.DOTALL)

new_query_block = """const reportRes = await pool.query(`
        SELECT 
          pr.recommendation_data,
          pr.is_active,
          c.policyholder_name as client_name,
          c.insurer as current_insurer,
          c.score as current_score,
          c.flaws as current_flaws,
          a.full_name as agent_name
        FROM public_reports pr
        LEFT JOIN clients c ON pr.client_id = c.id
        LEFT JOIN agents a ON pr.agent_id = a.id
        WHERE pr.id = $1
      `, [uuid]);"""

content = old_query_block.sub(new_query_block, content)

# 3. Surgical fix for the catch block
pattern_catch = re.compile(r'\} catch \(err: any\) \{\s+(?:console\.error\(.*?\);|\s+)*res\.status\(500\)\.json\(\{ error: "Internal Server Error" \}\);\s+\}', re.DOTALL | re.MULTILINE)
# We need to be careful as there are many catch blocks. We'll target the one after the public report query.
# Actually, let's just find the first one after our new query block.

split_content = content.split(new_query_block)
if len(split_content) > 1:
    after_query = split_content[1]
    new_after_query = re.sub(r'\} catch \(err: any\) \{.*?res\.status\(500\)\.json\(\{ error: "Internal Server Error" \}\);\s+\}', 
                             """    } catch (err: any) {
      console.error("PUBLIC REPORT ERROR:", err.message, err.stack);
      res.status(500).json({ error: "Internal Server Error" });
    }""", after_query, count=1, flags=re.DOTALL)
    content = split_content[0] + new_query_block + new_after_query

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Final surgical fix complete.")
