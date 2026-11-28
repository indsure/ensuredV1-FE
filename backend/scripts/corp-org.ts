/**
 * Organisations of IndSure Commercial. Run on the server, from the repo root:
 *
 *   npx tsx backend/scripts/corp-org.ts list
 *   npx tsx backend/scripts/corp-org.ts create "Organisation name" owner@example.com
 *   npx tsx backend/scripts/corp-org.ts owner IC12345 owner@example.com     set or reset an owner (new link)
 *   npx tsx backend/scripts/corp-org.ts rename IC12345 "New name"
 *   npx tsx backend/scripts/corp-org.ts off IC12345     (and: on IC12345)
 *
 * Prints the owner's setup link. Send it to them yourself: it works once, for 3 days, and is not stored.
 */
import "../server/loadEnv";
import { pool } from "../server/lib/db";
import { createOrg, inviteOwner, cleanCode, cleanEmail, emailOk, logEvent } from "../server/services/corpAuth";

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "list") {
    const { rows } = await pool.query("SELECT o.code, o.name, o.owner_email, o.owner_hash IS NOT NULL AS owner_ready, o.active, (SELECT count(*) FROM corp_members m WHERE m.org_id = o.id AND m.active) AS people FROM corp_orgs o ORDER BY o.id");
    console.table(rows);
  } else if (cmd === "create") {
    const r = await createOrg(pool, a, b);
    console.log(`OrgID: ${r.code}\nOwner setup link (works once, 3 days):\n${r.link}`);
  } else if (cmd === "owner" || cmd === "rename" || cmd === "on" || cmd === "off") {
    const { rows } = await pool.query("SELECT id, name FROM corp_orgs WHERE code = $1", [cleanCode(a)]);
    if (!rows.length) throw new Error("no such OrgID");
    if (cmd === "owner") {
      const email = cleanEmail(b);
      if (!emailOk(email)) throw new Error("a valid owner email is needed");
      const r = await inviteOwner(pool, rows[0].id, email);
      console.log(`Owner setup link for ${rows[0].name} (works once, 3 days):\n${r.link}`);
    } else if (cmd === "rename") {
      if (!b?.trim()) throw new Error("a name is needed");
      await pool.query("UPDATE corp_orgs SET name = $2 WHERE id = $1", [rows[0].id, b.trim().slice(0, 120)]);
      console.log("Renamed.");
    } else {
      await pool.query("UPDATE corp_orgs SET active = $2 WHERE id = $1", [rows[0].id, cmd === "on"]);
      console.log(cmd === "on" ? "Switched on." : "Switched off. Its owner and employees can no longer sign in.");
    }
    await logEvent(pool, rows[0].id, "IndSure", `Organisation ${cmd}`);
  } else console.log("Commands: list | create <name> <email> | owner <OrgID> <email> | rename <OrgID> <name> | on <OrgID> | off <OrgID>");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e?.message || e); process.exit(1); });
