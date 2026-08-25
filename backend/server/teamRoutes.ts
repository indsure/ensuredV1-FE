// ============================================================================
// Agency teams — the whole server surface for owners, members and invites.
//
// Lives in its own file rather than in routes.ts because of ONE property that
// has to stay obvious to whoever reads it next: every route below that returns
// a member's data writes a team_access_log row as it serves. That promise is
// made to the advisor twice in the UI ("your owner can read your book — you see
// each time they open it"), and it only holds while this is the ONLY way the
// owner can reach that data.
//
// Which is why migration 017 widens no RLS policy. These handlers query through
// the service-role pool, which does not consult RLS at all; the browser's anon
// key still cannot read another agent's row. If someone later adds a
// `USING (is_team_owner_of(agent_id))` policy "so the frontend can just query
// it directly", the audit log silently stops being complete and the sentence we
// show the advisor becomes false. Don't.
//
// The second thing to keep: the owner reads. Nothing here lets an owner write,
// update or delete anything belonging to a member — the only writes are to
// team-owned rows (invites, membership, credit balances the agency paid for).
// ============================================================================

import type { Express } from "express";
import crypto from "crypto";
import { pool } from "./lib/db";
import { sendMail } from "./lib/mailer";
import { log } from "./lib/logger";

/** What one paid seat carries per month. Mirrors the Agency tier on
 *  advisors-pricing.tsx; the data-entry half is enforced by
 *  OCR_MONTHLY_ALLOWANCE.agency in routes.ts. */
export const CHECKS_PER_SEAT = 10;

/** An invite is a bearer grant sitting in someone's inbox. A week is long
 *  enough for a busy advisor and short enough that a forwarded mail from last
 *  quarter is inert. */
const INVITE_TTL_DAYS = 7;

type VerifyJwt = (req: any, res: any) => Promise<string | null>;
type IsAdmin = (req: any, res: any, next: any) => void;

interface TeamRow {
  id: string;
  name: string;
  owner_id: string;
  seats: number;
}

/** The raw token goes in the email and nowhere else; we store only this. A
 *  database read — a leaked backup, an over-broad query — cannot redeem an
 *  invite it can see. */
function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function appOrigin(): string {
  return (process.env.PUBLIC_APP_ORIGIN || "https://indsure.in").replace(/\/+$/, "");
}

/**
 * Mint the single-use `invite_codes` row that lets the invitee through agent
 * signup at all.
 *
 * Agent signup requires an invite code (SignupStep1.tsx validates one before it
 * will create an account), and someone invited to a team has no reason to hold
 * one. Rather than opening a second, less-guarded route into agent signup, the
 * team invite brings its own code along.
 *
 * UPPERCASE because signup compares the typed value both raw and
 * `.toUpperCase()`; a lowercase code passes one check and fails the other.
 * `max_uses = 1` puts it on the counting branch of that flow, which increments
 * `current_uses` and thereby spends it.
 */
async function mintSignupCode(expiresAt: Date): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `TEAM${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    try {
      await pool.query(
        `INSERT INTO invite_codes (code, is_active, max_uses, current_uses, expires_at)
         VALUES ($1, true, 1, 0, $2)`,
        [code, expiresAt]
      );
      return code;
    } catch (err: any) {
      if (err?.code === "23505") continue; // astronomically unlikely; retry anyway
      throw err;
    }
  }
  throw new Error("Could not mint a signup code");
}

/** Deliberately loose: the authority on whether an address works is whether the
 *  invite arrives. This only catches typing accidents and obvious junk. */
function looksLikeEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Write the audit row. Fire-and-forget on purpose: a logging failure must never
 * cost the owner the page they asked for, and the row is a record for the
 * advisor rather than a transactional guarantee. It is awaited nowhere, and its
 * failure is logged loudly enough to notice.
 */
function logAccess(
  teamId: string,
  ownerId: string,
  memberId: string,
  surface: string,
  entityId?: string | null
): void {
  void pool
    .query(
      `INSERT INTO team_access_log (team_id, owner_id, member_id, surface, entity_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [teamId, ownerId, memberId, surface, entityId ?? null]
    )
    .catch((err) => {
      log.error("team_access_log_write_failed", {
        teamId, ownerId, memberId, surface, message: err?.message ?? String(err),
      });
    });
}

export function registerTeamRoutes(app: Express, verifyJwt: VerifyJwt, isAdmin: IsAdmin): void {

  /* ── Guards ───────────────────────────────────────────────────────────── */

  /** Resolve the caller as the OWNER of a team, or answer 403 and return null. */
  async function requireOwner(req: any, res: any): Promise<{ userId: string; team: TeamRow } | null> {
    const userId = await verifyJwt(req, res);
    if (!userId) return null;

    const teamRes = await pool.query(
      "SELECT id, name, owner_id, seats FROM teams WHERE owner_id = $1",
      [userId]
    );
    if (teamRes.rows.length === 0) {
      res.status(403).json({ error: "NOT_TEAM_OWNER", message: "You do not own a team." });
      return null;
    }
    return { userId, team: teamRes.rows[0] as TeamRow };
  }

  /**
   * Resolve a member id the owner is allowed to read. Every book route funnels
   * through this — it is the single place that decides "is this person mine to
   * look at", so there is one line to audit rather than seven.
   */
  async function requireMember(
    res: any,
    team: TeamRow,
    memberId: string
  ): Promise<{ id: string; name: string; email: string } | null> {
    if (!memberId || !/^[0-9a-f-]{36}$/i.test(memberId)) {
      res.status(400).json({ error: "BAD_MEMBER_ID" });
      return null;
    }
    const m = await pool.query(
      `SELECT id, COALESCE(full_name, name, '') AS name, email
         FROM agents WHERE id = $1 AND team_id = $2`,
      [memberId, team.id]
    );
    if (m.rows.length === 0) {
      // Same answer whether the agent does not exist or is on someone else's
      // team: an owner should not be able to probe for account ids.
      res.status(404).json({ error: "NOT_A_TEAM_MEMBER", message: "No such advisor on your team." });
      return null;
    }
    return m.rows[0];
  }

  /* ── Read: the team ───────────────────────────────────────────────────── */

  // The Team tab. Answers for an owner (full picture) and for a member (who
  // they are with, and who can see their book) — the member's answer carries no
  // other advisor's data.
  app.get("/api/team", async (req, res) => {
    try {
      const userId = await verifyJwt(req, res);
      if (!userId) return;

      const me = await pool.query(
        "SELECT team_id FROM agents WHERE id = $1",
        [userId]
      );
      const teamId = me.rows[0]?.team_id ?? null;

      const ownRes = await pool.query(
        "SELECT id, name, owner_id, seats FROM teams WHERE owner_id = $1",
        [userId]
      );
      const team: TeamRow | null = ownRes.rows[0] ?? null;

      // Someone who said "agency" at signup is not on a team yet, but they are
      // not nobody either. Carrying the pending request here is what lets the
      // portal say "we are setting yours up" instead of "you have no team",
      // which would read as though their answer had been thrown away.
      const reqRes = await pool.query(
        `SELECT agency_name, seats_wanted, status, created_at
           FROM team_requests
          WHERE agent_id = $1 AND status = 'pending'
          ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      const pendingRequest = reqRes.rows[0]
        ? {
            agencyName: reqRes.rows[0].agency_name,
            seatsWanted: reqRes.rows[0].seats_wanted,
            requestedAt: reqRes.rows[0].created_at,
          }
        : null;

      if (!team && !teamId) return res.json({ inTeam: false, request: pendingRequest });

      if (!team) {
        // A member: name of the team, name of the person who can read their book.
        const t = await pool.query(
          `SELECT t.id, t.name, COALESCE(o.full_name, o.name, o.email) AS owner_name
             FROM teams t JOIN agents o ON o.id = t.owner_id WHERE t.id = $1`,
          [teamId]
        );
        if (t.rows.length === 0) return res.json({ inTeam: false });
        return res.json({
          inTeam: true,
          role: "member",
          team: { id: t.rows[0].id, name: t.rows[0].name, ownerName: t.rows[0].owner_name },
        });
      }

      // The owner's picture. Usage per member is derived, never stored: counts
      // come from the rows themselves so the tab cannot drift from reality.
      const members = await pool.query(
        `SELECT a.id,
                COALESCE(a.full_name, a.name, '') AS name,
                a.email,
                a.created_at,
                (a.id = $2)                                            AS is_owner,
                COALESCE(cr.balance, 0)                                AS checks_left,
                COALESCE(ocr.balance, 0)                               AS entry_left,
                (SELECT count(*) FROM customers  c WHERE c.agent_id = a.id) AS customers,
                (SELECT count(*) FROM clients    p WHERE p.agent_id = a.id) AS policies,
                GREATEST(
                  COALESCE((SELECT max(created_at) FROM clients     WHERE agent_id = a.id), a.created_at),
                  COALESCE((SELECT max(created_at) FROM customers   WHERE agent_id = a.id), a.created_at),
                  COALESCE((SELECT max(created_at) FROM agent_leads WHERE agent_id = a.id), a.created_at)
                ) AS last_activity_at
           FROM agents a
           LEFT JOIN agent_credits     cr  ON cr.agent_id  = a.id
           LEFT JOIN agent_ocr_credits ocr ON ocr.agent_id = a.id
          WHERE a.team_id = $1
          ORDER BY (a.id = $2) DESC, name ASC`,
        [team.id, team.owner_id]
      );

      const invites = await pool.query(
        `SELECT id, email, invited_name, expires_at, created_at
           FROM team_invites
          WHERE team_id = $1 AND status = 'pending' AND expires_at > now()
          ORDER BY created_at DESC`,
        [team.id]
      );

      const used = members.rows.length + invites.rows.length;
      return res.json({
        inTeam: true,
        role: "owner",
        team: { id: team.id, name: team.name, seats: team.seats },
        seats: {
          total: team.seats,
          members: members.rows.length,
          pending: invites.rows.length,
          free: Math.max(team.seats - used, 0),
        },
        checksPerSeat: CHECKS_PER_SEAT,
        members: members.rows,
        invites: invites.rows,
      });
    } catch (err: any) {
      log.error("team_get_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to load team" });
    }
  });

  /* ── Read: one member, and their book ─────────────────────────────────── */

  app.get("/api/team/members/:id", async (req, res) => {
    try {
      const ctx = await requireOwner(req, res);
      if (!ctx) return;
      const member = await requireMember(res, ctx.team, req.params.id);
      if (!member) return;

      const row = await pool.query(
        `SELECT a.id,
                COALESCE(a.full_name, a.name, '') AS name,
                a.email, a.phone, a.city, a.created_at,
                COALESCE(cr.balance, 0)  AS checks_left,
                COALESCE(ocr.balance, 0) AS entry_left,
                (SELECT count(*) FROM customers  WHERE agent_id = a.id) AS customers,
                (SELECT count(*) FROM clients    WHERE agent_id = a.id) AS policies,
                (SELECT count(*) FROM agent_leads WHERE agent_id = a.id) AS leads,
                (SELECT count(*) FROM claims     WHERE agent_id = a.id) AS claims
           FROM agents a
           LEFT JOIN agent_credits     cr  ON cr.agent_id  = a.id
           LEFT JOIN agent_ocr_credits ocr ON ocr.agent_id = a.id
          WHERE a.id = $1`,
        [member.id]
      );

      logAccess(ctx.team.id, ctx.userId, member.id, "overview");
      return res.json({ member: row.rows[0], checksPerSeat: CHECKS_PER_SEAT });
    } catch (err: any) {
      log.error("team_member_get_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to load advisor" });
    }
  });

  // The member's policy book. NOTE THE SELECT LIST: pdf_url and share_token are
  // absent by decision — the owner reads the ANALYSIS, never the customer's
  // original document, and cannot mint a share link over someone else's work.
  app.get("/api/team/members/:id/policies", async (req, res) => {
    try {
      const ctx = await requireOwner(req, res);
      if (!ctx) return;
      const member = await requireMember(res, ctx.team, req.params.id);
      if (!member) return;

      const rows = await pool.query(
        `SELECT id, name, policyholder_name, insurer, insurance_type, policy_name,
                sum_insured, expiry_date, score, status, created_at
           FROM clients
          WHERE agent_id = $1
          ORDER BY created_at DESC
          LIMIT 500`,
        [member.id]
      );

      logAccess(ctx.team.id, ctx.userId, member.id, "policies");
      return res.json({ policies: rows.rows });
    } catch (err: any) {
      log.error("team_member_policies_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to load policies" });
    }
  });

  app.get("/api/team/members/:id/customers", async (req, res) => {
    try {
      const ctx = await requireOwner(req, res);
      if (!ctx) return;
      const member = await requireMember(res, ctx.team, req.params.id);
      if (!member) return;

      const rows = await pool.query(
        `SELECT c.id, c.name, c.phone, c.email, c.city, c.created_at,
                (SELECT count(*) FROM clients p WHERE p.customer_id = c.id) AS policies
           FROM customers c
          WHERE c.agent_id = $1
          ORDER BY c.created_at DESC
          LIMIT 500`,
        [member.id]
      );

      logAccess(ctx.team.id, ctx.userId, member.id, "customers");
      return res.json({ customers: rows.rows });
    } catch (err: any) {
      log.error("team_member_customers_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to load customers" });
    }
  });

  app.get("/api/team/members/:id/leads", async (req, res) => {
    try {
      const ctx = await requireOwner(req, res);
      if (!ctx) return;
      const member = await requireMember(res, ctx.team, req.params.id);
      if (!member) return;

      const rows = await pool.query(
        `SELECT id, name, phone, city, source, insurance_interest, expected_value,
                status, next_follow_up, created_at
           FROM agent_leads
          WHERE agent_id = $1 AND COALESCE(is_spam, false) = false
          ORDER BY created_at DESC
          LIMIT 500`,
        [member.id]
      );

      logAccess(ctx.team.id, ctx.userId, member.id, "leads");
      return res.json({ leads: rows.rows });
    } catch (err: any) {
      log.error("team_member_leads_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to load leads" });
    }
  });

  // Claims: the RECORD, so an owner can help chase a stuck settlement — and not
  // one byte of claim_documents. Those are hospital bills and discharge
  // summaries, held under the purge/consent clock in 015_claims.sql for a
  // single reader. There is deliberately no route here that mints a signed URL
  // for a member's claim file; adding one would break that promise.
  app.get("/api/team/members/:id/claims", async (req, res) => {
    try {
      const ctx = await requireOwner(req, res);
      if (!ctx) return;
      const member = await requireMember(res, ctx.team, req.params.id);
      if (!member) return;

      const rows = await pool.query(
        `SELECT cl.id, cl.claim_type, cl.status, cl.insurer, cl.tpa, cl.hospital,
                cl.ailment, cl.claimed_amount, cl.settled_amount, cl.created_at,
                cu.name AS customer_name,
                (SELECT count(*) FROM claim_queries q
                  WHERE q.claim_id = cl.id) AS query_rounds
           FROM claims cl
           LEFT JOIN customers cu ON cu.id = cl.customer_id
          WHERE cl.agent_id = $1
          ORDER BY cl.created_at DESC
          LIMIT 500`,
        [member.id]
      );

      logAccess(ctx.team.id, ctx.userId, member.id, "claims");
      return res.json({ claims: rows.rows });
    } catch (err: any) {
      log.error("team_member_claims_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to load claims" });
    }
  });

  /* ── The advisor's side of the audit ──────────────────────────────────── */

  // What the advisor sees: every time their owner opened their book. This is
  // the route that makes the sentence on the invite screen true, so it answers
  // for the MEMBER, reading their own rows.
  app.get("/api/team/access-log", async (req, res) => {
    try {
      const userId = await verifyJwt(req, res);
      if (!userId) return;

      const rows = await pool.query(
        `SELECT l.id, l.surface, l.created_at,
                COALESCE(o.full_name, o.name, o.email) AS owner_name
           FROM team_access_log l
           JOIN agents o ON o.id = l.owner_id
          WHERE l.member_id = $1
          ORDER BY l.created_at DESC
          LIMIT 100`,
        [userId]
      );
      return res.json({ reads: rows.rows });
    } catch (err: any) {
      log.error("team_access_log_read_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to load access history" });
    }
  });

  /* ── Invites ──────────────────────────────────────────────────────────── */

  app.post("/api/team/invites", async (req, res) => {
    try {
      const ctx = await requireOwner(req, res);
      if (!ctx) return;

      const email = String(req.body?.email ?? "").trim();
      const name = String(req.body?.name ?? "").trim() || null;

      if (!looksLikeEmail(email)) {
        return res.status(400).json({ error: "BAD_EMAIL", message: "That does not look like an email address." });
      }

      // Seats are the agency's paid ceiling, and a pending invite has already
      // claimed one. Counted in the same statement that inserts, below, so two
      // invites racing for the last seat cannot both win.
      const counts = await pool.query(
        `SELECT (SELECT count(*) FROM agents WHERE team_id = $1) AS members,
                (SELECT count(*) FROM team_invites
                  WHERE team_id = $1 AND status = 'pending' AND expires_at > now()) AS pending`,
        [ctx.team.id]
      );
      const used = Number(counts.rows[0].members) + Number(counts.rows[0].pending);
      if (used >= ctx.team.seats) {
        return res.status(409).json({
          error: "NO_SEATS",
          message: `All ${ctx.team.seats} seats are taken. Revoke a pending invite or remove an advisor to free one.`,
        });
      }

      // Already somewhere? Say which, plainly — "invite failed" teaches nobody.
      const existing = await pool.query(
        "SELECT id, team_id FROM agents WHERE lower(email) = lower($1)",
        [email]
      );
      if (existing.rows.length > 0 && existing.rows[0].team_id) {
        const sameTeam = existing.rows[0].team_id === ctx.team.id;
        return res.status(409).json({
          error: sameTeam ? "ALREADY_ON_TEAM" : "ON_ANOTHER_TEAM",
          message: sameTeam
            ? "They are already on your team."
            : "That advisor is already on another agency's team. They have to leave it first.",
        });
      }

      const token = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

      const signupCode = await mintSignupCode(expiresAt);

      let inviteId: string;
      try {
        const ins = await pool.query(
          `INSERT INTO team_invites (team_id, email, invited_name, token_hash, invited_by, expires_at, signup_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [ctx.team.id, email, name, hashToken(token), ctx.userId, expiresAt, signupCode]
        );
        inviteId = ins.rows[0].id;
      } catch (err: any) {
        // The partial unique index on (team_id, lower(email)) WHERE pending.
        if (err?.code === "23505") {
          return res.status(409).json({
            error: "ALREADY_INVITED",
            message: "There is already a live invite for that address. Revoke it first, or resend it.",
          });
        }
        throw err;
      }

      const sent = await sendInviteEmail({
        to: email,
        toName: name,
        token,
        signupCode,
        teamName: ctx.team.name,
        ownerName: await ownerDisplayName(ctx.userId),
        expiresAt,
      });

      // The invite row is the truth; the email is best-effort (sendMail is a
      // no-op when SMTP is unconfigured). Tell the owner which happened rather
      // than showing a success that did not reach anybody.
      return res.status(201).json({
        id: inviteId,
        email,
        expiresAt,
        emailed: sent,
        message: sent
          ? `Invite sent to ${email}.`
          : `Invite created, but the email could not be sent. Use Resend once mail is configured.`,
      });
    } catch (err: any) {
      log.error("team_invite_create_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to create the invite" });
    }
  });

  // Resend MINTS A NEW TOKEN. It has to: we only ever stored the old one's
  // hash, so the original link is unrecoverable by design. The old link stops
  // working the moment this succeeds, which is also the honest behaviour — one
  // live link per invite.
  app.post("/api/team/invites/:id/resend", async (req, res) => {
    try {
      const ctx = await requireOwner(req, res);
      if (!ctx) return;

      const inv = await pool.query(
        `SELECT id, email, invited_name, signup_code FROM team_invites
          WHERE id = $1 AND team_id = $2 AND status = 'pending'`,
        [req.params.id, ctx.team.id]
      );
      if (inv.rows.length === 0) {
        return res.status(404).json({ error: "NO_SUCH_INVITE", message: "That invite is no longer pending." });
      }

      const token = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

      // Keep the same signup code — the invitee may already have started an
      // account with it — but push its expiry out with the link's, or the
      // renewed invite would arrive with a code that dies first.
      let signupCode: string = inv.rows[0].signup_code;
      if (signupCode) {
        await pool.query(
          "UPDATE invite_codes SET expires_at = $1, is_active = true WHERE code = $2",
          [expiresAt, signupCode]
        );
      } else {
        signupCode = await mintSignupCode(expiresAt);
      }

      await pool.query(
        `UPDATE team_invites SET token_hash = $1, expires_at = $2, signup_code = $3, updated_at = now()
          WHERE id = $4`,
        [hashToken(token), expiresAt, signupCode, inv.rows[0].id]
      );

      const sent = await sendInviteEmail({
        to: inv.rows[0].email,
        toName: inv.rows[0].invited_name,
        token,
        signupCode,
        teamName: ctx.team.name,
        ownerName: await ownerDisplayName(ctx.userId),
        expiresAt,
      });

      return res.json({
        emailed: sent,
        expiresAt,
        message: sent
          ? `A fresh link is on its way to ${inv.rows[0].email}. The earlier link no longer works.`
          : "The link was renewed, but the email could not be sent.",
      });
    } catch (err: any) {
      log.error("team_invite_resend_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to resend the invite" });
    }
  });

  app.post("/api/team/invites/:id/revoke", async (req, res) => {
    try {
      const ctx = await requireOwner(req, res);
      if (!ctx) return;

      const upd = await pool.query(
        `UPDATE team_invites SET status = 'revoked', updated_at = now()
          WHERE id = $1 AND team_id = $2 AND status = 'pending'
        RETURNING email`,
        [req.params.id, ctx.team.id]
      );
      if (upd.rowCount === 0) {
        return res.status(404).json({ error: "NO_SUCH_INVITE", message: "That invite is no longer pending." });
      }
      return res.json({ message: `The invite to ${upd.rows[0].email} will not work any more. The seat is free.` });
    } catch (err: any) {
      log.error("team_invite_revoke_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to revoke the invite" });
    }
  });

  /* ── Redeeming ────────────────────────────────────────────────────────── */

  // Public preview, so the join screen can say who invited them and to what
  // before asking for an account. Returns the invited address in full: whoever
  // holds this link already received it at that address, and showing it is what
  // lets someone realise a link was forwarded to the wrong person.
  app.get("/api/team/invite/:token", async (req, res) => {
    try {
      const inv = await pool.query(
        `SELECT i.id, i.email, i.invited_name, i.status, i.expires_at, i.signup_code,
                t.name AS team_name,
                COALESCE(o.full_name, o.name, o.email) AS owner_name
           FROM team_invites i
           JOIN teams  t ON t.id = i.team_id
           JOIN agents o ON o.id = i.invited_by
          WHERE i.token_hash = $1`,
        [hashToken(String(req.params.token || ""))]
      );

      if (inv.rows.length === 0) {
        return res.status(404).json({ error: "INVALID", message: "This invite link is not valid." });
      }

      const row = inv.rows[0];
      const expired = new Date(row.expires_at).getTime() < Date.now();

      if (row.status === "pending" && expired) {
        // Lazily record what is already true, so the owner's tab stops showing
        // it as live. No sweeper needed: an unredeemed invite does nothing.
        await pool.query(
          "UPDATE team_invites SET status = 'expired', updated_at = now() WHERE id = $1",
          [row.id]
        );
      }

      const state = row.status !== "pending" ? row.status : expired ? "expired" : "pending";
      return res.json({
        state,
        email: row.email,
        invitedName: row.invited_name,
        teamName: row.team_name,
        ownerName: row.owner_name,
        expiresAt: row.expires_at,
        checksPerSeat: CHECKS_PER_SEAT,
        // Only while the invite is live, and only to whoever holds the link —
        // which is the person it was emailed to. A spent invite hands out nothing.
        signupCode: state === "pending" ? row.signup_code : null,
      });
    } catch (err: any) {
      log.error("team_invite_preview_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to read the invite" });
    }
  });

  // Redeem. Requires a signed-in agent whose address matches the invite: the
  // link alone is not enough, which is the whole point of an email-bound invite.
  app.post("/api/team/invite/:token/accept", async (req, res) => {
    const client = await pool.connect();
    try {
      const userId = await verifyJwt(req, res);
      // No explicit release here: the finally below owns it, and pg throws on a
      // second release.
      if (!userId) return;

      await client.query("BEGIN");

      // Lock the invite row for the length of the redemption so two taps on a
      // slow phone cannot both consume it.
      const inv = await client.query(
        `SELECT id, team_id, email, status, expires_at
           FROM team_invites WHERE token_hash = $1 FOR UPDATE`,
        [hashToken(String(req.params.token || ""))]
      );
      if (inv.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "INVALID", message: "This invite link is not valid." });
      }
      const invite = inv.rows[0];

      if (invite.status !== "pending") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: invite.status.toUpperCase(),
          message: invite.status === "accepted"
            ? "This invite has already been used."
            : "This invite is no longer valid. Ask for a new one.",
        });
      }
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        await client.query(
          "UPDATE team_invites SET status = 'expired', updated_at = now() WHERE id = $1",
          [invite.id]
        );
        await client.query("COMMIT");
        return res.status(409).json({ error: "EXPIRED", message: "This invite has expired. Ask for a new one." });
      }

      const me = await client.query(
        "SELECT id, email, team_id FROM agents WHERE id = $1 FOR UPDATE",
        [userId]
      );
      if (me.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "NOT_AN_AGENT",
          message: "This invite is for an advisor account. Finish signing up first.",
        });
      }
      if (me.rows[0].team_id) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "ALREADY_ON_TEAM",
          message: "You are already on a team. Leave it before joining another.",
        });
      }
      if (String(me.rows[0].email || "").toLowerCase() !== String(invite.email).toLowerCase()) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "WRONG_ACCOUNT",
          message: `This invite is for ${invite.email}. Sign in with that address to accept it.`,
        });
      }

      // Re-check seats INSIDE the transaction: the owner may have filled the
      // last one while this invite sat in an inbox.
      const seatRes = await client.query(
        `SELECT t.seats, (SELECT count(*) FROM agents WHERE team_id = t.id) AS members
           FROM teams t WHERE t.id = $1 FOR UPDATE`,
        [invite.team_id]
      );
      if (Number(seatRes.rows[0].members) >= Number(seatRes.rows[0].seats)) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "NO_SEATS",
          message: "That team has no free seat right now. Ask the owner to free one.",
        });
      }

      // Join: membership, and the plan the seat is paid for. 'agency' is what
      // gives them the 50 data-entry policies a month that the invite promised
      // (OCR_MONTHLY_ALLOWANCE.agency in routes.ts).
      await client.query(
        "UPDATE agents SET team_id = $1, plan = 'agency', updated_at = now() WHERE id = $2",
        [invite.team_id, userId]
      );

      // Seed this month's checks. ON CONFLICT DO NOTHING, never an overwrite: a
      // returning advisor keeps whatever they had rather than being topped up
      // by re-joining.
      await client.query(
        `INSERT INTO agent_credits (agent_id, balance)
         VALUES ($1, $2) ON CONFLICT (agent_id) DO NOTHING`,
        [userId, CHECKS_PER_SEAT]
      );

      await client.query(
        `UPDATE team_invites
            SET status = 'accepted', accepted_by = $1, accepted_at = now(), updated_at = now()
          WHERE id = $2`,
        [userId, invite.id]
      );

      await client.query("COMMIT");

      const team = await pool.query("SELECT name FROM teams WHERE id = $1", [invite.team_id]);
      return res.json({
        joined: true,
        teamName: team.rows[0]?.name ?? "",
        message: `You are on ${team.rows[0]?.name ?? "the team"}.`,
      });
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      log.error("team_invite_accept_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to accept the invite" });
    } finally {
      client.release();
    }
  });

  /* ── Seats and allowances ─────────────────────────────────────────────── */

  // Move unused policy checks between advisors. The agency paid for them, so
  // the owner may redistribute them — within the team, and only what is
  // actually there.
  app.post("/api/team/checks/move", async (req, res) => {
    const client = await pool.connect();
    try {
      const ctx = await requireOwner(req, res);
      if (!ctx) return; // released by the finally below, once

      const fromId = String(req.body?.fromId ?? "");
      const toId = String(req.body?.toId ?? "");
      const count = Number(req.body?.count);

      if (!Number.isInteger(count) || count < 1) {
        return res.status(400).json({ error: "BAD_COUNT", message: "Choose how many checks to move." });
      }
      if (fromId === toId) {
        return res.status(400).json({ error: "SAME_ADVISOR", message: "Pick two different advisors." });
      }

      const from = await requireMember(res, ctx.team, fromId);
      if (!from) return;
      const to = await requireMember(res, ctx.team, toId);
      if (!to) return;

      await client.query("BEGIN");

      // Lock the source first, then check. Doing it the other way round lets two
      // moves each see a balance that only one of them can actually spend.
      const src = await client.query(
        "SELECT balance FROM agent_credits WHERE agent_id = $1 FOR UPDATE",
        [fromId]
      );
      const available = src.rows[0]?.balance ?? 0;
      if (available < count) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "NOT_ENOUGH",
          message: `${from.name || "That advisor"} has only ${available} check${available === 1 ? "" : "s"} left.`,
        });
      }

      await client.query(
        "UPDATE agent_credits SET balance = balance - $1 WHERE agent_id = $2",
        [count, fromId]
      );
      await client.query(
        `INSERT INTO agent_credits (agent_id, balance) VALUES ($1, $2)
         ON CONFLICT (agent_id) DO UPDATE SET balance = agent_credits.balance + $2`,
        [toId, count]
      );

      await client.query("COMMIT");
      return res.json({
        message: `${count} check${count === 1 ? "" : "s"} moved to ${to.name || "them"}. This lasts until the monthly refill.`,
      });
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      log.error("team_checks_move_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to move the checks" });
    } finally {
      client.release();
    }
  });

  // Remove an advisor. Nothing of theirs is deleted — membership is cleared and
  // the plan the agency was paying for goes back to free. Their customers,
  // policies and claims stay exactly where they are, and the owner stops being
  // able to read them the moment this returns.
  app.delete("/api/team/members/:id", async (req, res) => {
    try {
      const ctx = await requireOwner(req, res);
      if (!ctx) return;

      if (req.params.id === ctx.userId) {
        return res.status(400).json({
          error: "CANNOT_REMOVE_OWNER",
          message: "You own this team. Ask us to move ownership before leaving it.",
        });
      }

      const member = await requireMember(res, ctx.team, req.params.id);
      if (!member) return;

      await pool.query(
        "UPDATE agents SET team_id = NULL, plan = 'free', updated_at = now() WHERE id = $1",
        [member.id]
      );

      return res.json({
        message: `${member.name || "They"} are off the team and the seat is free. Their customers and policies stay theirs — you can no longer see them.`,
      });
    } catch (err: any) {
      log.error("team_member_remove_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to remove the advisor" });
    }
  });

  /* ── Enterprise signup requests ───────────────────────────────────────── */

  // Admin: everyone who said "agency" at signup and is still waiting.
  app.get("/api/admin/team-requests", isAdmin, async (_req, res) => {
    try {
      const rows = await pool.query(
        `SELECT r.id, r.agency_name, r.seats_wanted, r.contact_phone, r.status,
                r.created_at, r.handled_at, r.team_id, r.agent_id,
                COALESCE(a.full_name, a.name, '') AS agent_name,
                a.email AS agent_email,
                a.city  AS agent_city,
                a.plan  AS agent_plan
           FROM team_requests r
           JOIN agents a ON a.id = r.agent_id
          ORDER BY (r.status = 'pending') DESC, r.created_at DESC
          LIMIT 200`
      );
      return res.json({ requests: rows.rows });
    } catch (err: any) {
      log.error("team_requests_admin_list_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to load enterprise requests" });
    }
  });

  // Admin: turn a request into a real team. THIS is the only path that creates
  // one — the signup form cannot, and neither can the advisor.
  //
  // `seats` comes from the admin, not from the request: seats_wanted is what
  // was asked for; what bills is what is set here.
  app.post("/api/admin/team-requests/:id/provision", isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
      const seats = Number(req.body?.seats);
      const nameOverride = String(req.body?.teamName ?? "").trim();

      if (!Number.isInteger(seats) || seats < 1) {
        return res.status(400).json({ error: "BAD_SEATS", message: "Set how many seats this agency has paid for." });
      }

      await client.query("BEGIN");

      const r = await client.query(
        `SELECT id, agent_id, agency_name, status FROM team_requests WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );
      if (r.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "NO_SUCH_REQUEST" });
      }
      if (r.rows[0].status !== "pending") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "ALREADY_HANDLED",
          message: `This request was already ${r.rows[0].status}.`,
        });
      }
      const request = r.rows[0];

      // An agent owns at most one team and belongs to at most one. Both are
      // checked rather than assumed: provisioning twice would silently split an
      // advisor across two agencies.
      const existing = await client.query(
        `SELECT (SELECT count(*) FROM teams  WHERE owner_id = $1) AS owns,
                (SELECT team_id FROM agents WHERE id = $1)        AS member_of`,
        [request.agent_id]
      );
      if (Number(existing.rows[0].owns) > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "ALREADY_OWNS_TEAM", message: "That advisor already owns a team." });
      }
      if (existing.rows[0].member_of) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "ALREADY_ON_TEAM",
          message: "That advisor is already on a team. Remove them from it first.",
        });
      }

      const team = await client.query(
        "INSERT INTO teams (name, owner_id, seats) VALUES ($1, $2, $3) RETURNING id, name, seats",
        [nameOverride || request.agency_name, request.agent_id, seats]
      );
      const teamId = team.rows[0].id;

      // The owner occupies a seat and moves onto the plan being paid for.
      await client.query(
        "UPDATE agents SET team_id = $1, plan = 'agency', updated_at = now() WHERE id = $2",
        [teamId, request.agent_id]
      );

      // Same rule as accepting an invite: seed, never overwrite a balance
      // somebody already holds.
      await client.query(
        `INSERT INTO agent_credits (agent_id, balance) VALUES ($1, $2)
         ON CONFLICT (agent_id) DO NOTHING`,
        [request.agent_id, CHECKS_PER_SEAT]
      );

      await client.query(
        `UPDATE team_requests
            SET status = 'provisioned', team_id = $1, handled_by = $2, handled_at = now(), updated_at = now()
          WHERE id = $3`,
        [teamId, (req as any).adminUserId ?? null, request.id]
      );

      await client.query("COMMIT");
      return res.json({
        teamId,
        message: `${team.rows[0].name} is live with ${team.rows[0].seats} seats. They can invite their advisors now.`,
      });
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      log.error("team_request_provision_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to provision the team" });
    } finally {
      client.release();
    }
  });

  app.post("/api/admin/team-requests/:id/decline", isAdmin, async (req, res) => {
    try {
      const upd = await pool.query(
        `UPDATE team_requests
            SET status = 'declined', handled_by = $1, handled_at = now(),
                note = COALESCE($2, note), updated_at = now()
          WHERE id = $3 AND status = 'pending'
        RETURNING agency_name`,
        [(req as any).adminUserId ?? null, req.body?.note ?? null, req.params.id]
      );
      if (upd.rowCount === 0) {
        return res.status(404).json({ error: "NO_SUCH_REQUEST", message: "That request is no longer pending." });
      }
      // Nothing about the advisor's account changes — they carry on as the solo
      // advisor they already were.
      return res.json({ message: `Marked ${upd.rows[0].agency_name} as declined. Their account is untouched.` });
    } catch (err: any) {
      log.error("team_request_decline_failed", { message: err?.message ?? String(err) });
      res.status(500).json({ error: "Failed to update the request" });
    }
  });
}

/* ── Email ──────────────────────────────────────────────────────────────── */

async function ownerDisplayName(ownerId: string): Promise<string> {
  const r = await pool.query(
    "SELECT COALESCE(full_name, name, email) AS n FROM agents WHERE id = $1",
    [ownerId]
  );
  return r.rows[0]?.n ?? "Your team owner";
}

async function sendInviteEmail(opts: {
  to: string;
  toName: string | null;
  token: string;
  signupCode: string;
  teamName: string;
  ownerName: string;
  expiresAt: Date;
}): Promise<boolean> {
  const link = `${appOrigin()}/agent/join/${opts.token}`;
  const greeting = opts.toName ? `Hello ${opts.toName},` : "Hello,";

  // The two facts that stop this reading like a phishing mail: it names who
  // invited them, and it says plainly what the owner will be able to see.
  return sendMail({
    to: opts.to,
    subject: `${opts.ownerName} has invited you to join ${opts.teamName} on IndSure`,
    text: [
      greeting,
      "",
      `${opts.ownerName} has invited you to join ${opts.teamName} on IndSure, with your own advisor account.`,
      "",
      "Open this link to accept:",
      link,
      "",
      `The link works only for ${opts.to}, can be used once, and expires on ${opts.expiresAt.toDateString()}.`,
      "",
      `If you do not have an IndSure account yet, the link will set one up. Your signup code is ${opts.signupCode}.`,
      "",
      `Your seat carries ${CHECKS_PER_SEAT} policy checks and 50 data-entry policies every month.`,
      "",
      `As team owner, ${opts.ownerName} will be able to read the customers, policies, leads and claims you add — not change them — and you will see each time they do.`,
      "",
      "If you were not expecting this, ignore this email. Nothing is created until you accept.",
      "",
      "— Team IndSure",
    ].join("\n"),
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f2233;max-width:520px">
        <p>${greeting}</p>
        <p><strong>${opts.ownerName}</strong> has invited you to join <strong>${opts.teamName}</strong> on IndSure, with your own advisor account.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#0D9488;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">Accept the invite</a>
        </p>
        <p style="color:#64748B;font-size:14px">The link works only for ${opts.to}, can be used once, and expires on ${opts.expiresAt.toDateString()}.</p>
        <p style="color:#64748B;font-size:14px">No IndSure account yet? The link sets one up — your signup code is <strong style="color:#0f2233;letter-spacing:0.08em">${opts.signupCode}</strong>.</p>
        <p>Your seat carries <strong>${CHECKS_PER_SEAT} policy checks</strong> and <strong>50 data-entry policies</strong> every month.</p>
        <p style="color:#64748B;font-size:14px">As team owner, ${opts.ownerName} will be able to read the customers, policies, leads and claims you add — not change them — and you will see each time they do.</p>
        <p style="color:#94A3B8;font-size:13px">If you were not expecting this, ignore this email. Nothing is created until you accept.</p>
        <p>— Team IndSure</p>
      </div>
    `,
  });
}
