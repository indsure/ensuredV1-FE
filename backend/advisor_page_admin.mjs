/**
 * Allowlist tool for advisor landing pages. Run from backend/.
 *
 *   node advisor_page_admin.mjs list
 *   node advisor_page_admin.mjs grant <agent-email-or-id> <slug>
 *   node advisor_page_admin.mjs disable <slug>
 *   node advisor_page_admin.mjs enable  <slug>
 *
 * `grant` is how an advisor gets a page at all: it mints their agent_pages row
 * with the slug WE choose and enabled = true. The advisor then fills in their
 * details at /agent/my-page and presses Publish themselves.
 *
 * Slugs are permanent on purpose. Advisors print them as QR codes on visiting
 * cards and society standees, so a changed slug is a dead standee — `grant`
 * refuses to move an existing one rather than quietly breaking printed material.
 *
 * `disable` is the kill switch: it takes the page off the internet immediately
 * (the public read policy requires enabled AND published) without deleting the
 * advisor's leads or their settings.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const [cmd, arg1, arg2] = process.argv.slice(2);

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(import.meta.dirname, "..", ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const conn = env.DATABASE_URL.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, "");
const pool = new pg.Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/;

function usage() {
  console.log(`usage:
  node advisor_page_admin.mjs list
  node advisor_page_admin.mjs grant <agent-email-or-id> <slug>
  node advisor_page_admin.mjs disable <slug>
  node advisor_page_admin.mjs enable <slug>`);
}

try {
  if (cmd === "list") {
    const rows = await q(
      `SELECT p.slug, p.display_name, p.city, p.enabled, p.published, p.published_at,
              a.email,
              (SELECT count(*) FROM agent_leads l WHERE l.landing_slug = p.slug) AS leads,
              (SELECT coalesce(sum(v.views),0) FROM advisor_page_views v WHERE v.page_id = p.id) AS views
         FROM agent_pages p JOIN agents a ON a.id = p.agent_id
        ORDER BY p.created_at DESC`,
    );
    if (rows.length === 0) {
      console.log("No advisor pages yet. Use `grant` to create one.");
    } else {
      console.log(`${rows.length} advisor page(s):\n`);
      for (const r of rows) {
        const state = !r.enabled ? "DISABLED" : r.published ? "LIVE" : "draft";
        console.log(
          `  ${String(r.slug).padEnd(24)} ${String(state).padEnd(9)} ` +
            `${String(r.display_name || "").padEnd(22)} ${String(r.email || "").padEnd(30)} ` +
            `${r.views} views · ${r.leads} leads`,
        );
        console.log(`    https://indsure.in/a/${r.slug}`);
      }
    }
  } else if (cmd === "grant") {
    if (!arg1 || !arg2) { usage(); process.exit(1); }
    const slug = arg2.toLowerCase();

    if (!SLUG_RE.test(slug)) {
      console.error(`❌ "${slug}" is not a valid slug. Use 3-40 lowercase letters, digits and hyphens, e.g. rajesh-sharma`);
      process.exit(1);
    }
    const reserved = await q(`SELECT 1 FROM reserved_slugs WHERE slug = $1`, [slug]);
    if (reserved.length) {
      console.error(`❌ "${slug}" is reserved (route or brand name). Pick another.`);
      process.exit(1);
    }

    const isUuid = /^[0-9a-f-]{36}$/i.test(arg1);
    const agents = await q(
      isUuid ? `SELECT id, name, full_name, email, city, location FROM agents WHERE id = $1`
             : `SELECT id, name, full_name, email, city, location FROM agents WHERE lower(email) = lower($1)`,
      [arg1],
    );
    if (agents.length === 0) { console.error(`❌ No agent matching "${arg1}".`); process.exit(1); }
    const agent = agents[0];

    const taken = await q(`SELECT agent_id FROM agent_pages WHERE slug = $1`, [slug]);
    if (taken.length && taken[0].agent_id !== agent.id) {
      console.error(`❌ Slug "${slug}" already belongs to another advisor.`);
      process.exit(1);
    }

    const existing = await q(`SELECT slug, enabled FROM agent_pages WHERE agent_id = $1`, [agent.id]);
    if (existing.length) {
      if (existing[0].slug !== slug) {
        console.error(
          `❌ ${agent.email} already has the slug "${existing[0].slug}".\n` +
          `   Slugs are permanent — advisors print them as QR codes, so changing one\n` +
          `   silently breaks every card and standee already handed out.`,
        );
        process.exit(1);
      }
      await q(`UPDATE agent_pages SET enabled = true WHERE agent_id = $1`, [agent.id]);
      console.log(`✅ Re-enabled existing page for ${agent.email} → https://indsure.in/a/${slug}`);
    } else {
      await q(
        `INSERT INTO agent_pages (agent_id, slug, display_name, city, enabled, published)
         VALUES ($1, $2, $3, $4, true, false)`,
        [agent.id, slug, agent.full_name || agent.name || "Insurance Advisor", agent.city || agent.location || null],
      );
      console.log(`✅ Page created for ${agent.full_name || agent.name} (${agent.email})`);
      console.log(`   https://indsure.in/a/${slug}`);
      console.log(`   It is NOT live yet — they finish their details at /agent/my-page and press Publish.`);
    }
  } else if (cmd === "disable" || cmd === "enable") {
    if (!arg1) { usage(); process.exit(1); }
    const rows = await q(
      `UPDATE agent_pages SET enabled = $2 WHERE slug = $1 RETURNING display_name, published`,
      [arg1.toLowerCase(), cmd === "enable"],
    );
    if (rows.length === 0) { console.error(`❌ No page with slug "${arg1}".`); process.exit(1); }
    console.log(
      cmd === "disable"
        ? `✅ ${rows[0].display_name}'s page is off the internet. Visitors now see "no longer active". Their leads are untouched.`
        : `✅ ${rows[0].display_name}'s page is enabled again${rows[0].published ? " and live" : " (still unpublished by the advisor)"}.`,
    );
  } else {
    usage();
  }
} catch (err) {
  console.error("❌", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
