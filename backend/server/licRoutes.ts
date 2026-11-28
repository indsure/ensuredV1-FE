// LIC Premium Due + Commission sheets (migration 043). Plan: docs/plans/2026-11-28-lic-premium-due.md
//
// Every query is scoped to the signed-in agent's own id; there is no route that takes another
// agent's id, and a sheet id from someone else answers 404 exactly like a missing one.

import type { Express } from "express";
import multer from "multer";
import crypto from "node:crypto";

import { pool } from "./lib/db";
import { parseLicSheet, LicParseError, type LicSheet } from "./services/lic/parseSheets";
import { matchDueList, todayIST, type MatchDueRow, type MatchPaidRow } from "./services/lic/match";

type VerifyJwt = (req: any, res: any) => Promise<string | null>;

const MAX_BYTES = 10 * 1024 * 1024;
// In memory: these sheets are small, are parsed and dropped, and never touch the disk (the
// 2026-10-07 outage was a full disk).
const sheetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

const DUE_COLS = `policy_no AS "policyNo", holder_name AS "holderName", to_char(doc, 'YYYY-MM-DD') AS doc,
  plan_no AS "planNo", lic_term AS "licTerm", mode, fup, flag, inst_prem::float8 AS "instPrem",
  due_count AS "dueCount", total_prem::float8 AS "totalPrem", est_comm::float8 AS "estComm"`;
const PAID_COLS = `policy_no AS "policyNo", plan_no AS "planNo", term, to_char(due_date, 'YYYY-MM-DD') AS "dueDate",
  to_char(risk_date, 'YYYY-MM-DD') AS "riskDate", to_char(adj_date, 'YYYY-MM-DD') AS "adjDate",
  premium::float8 AS premium, commission::float8 AS commission`;

export function registerLicRoutes(app: Express, verifyJwt: VerifyJwt): void {
  /** The caller, if they are an advisor. Consumers get 403. */
  async function requireAgent(req: any, res: any): Promise<string | null> {
    const userId = await verifyJwt(req, res);
    if (!userId) return null;
    const a = await pool.query("SELECT 1 FROM agents WHERE id = $1", [userId]);
    if (a.rows.length === 0) {
      res.status(403).json({ error: "NOT_AN_AGENT", message: "LIC sheets are for advisor accounts." });
      return null;
    }
    return userId;
  }

  async function latestDue(agentId: string) {
    const r = await pool.query(
      `SELECT id, period, batch, lic_agent_code AS "agentCode", row_count AS "rowCount", created_at AS "createdAt"
         FROM lic_uploads WHERE agent_id = $1 AND kind = 'due'
        ORDER BY period DESC, created_at DESC LIMIT 1`,
      [agentId],
    );
    return r.rows[0] ?? null;
  }

  async function allPaid(agentId: string): Promise<MatchPaidRow[]> {
    const r = await pool.query(`SELECT ${PAID_COLS} FROM lic_paid_rows WHERE agent_id = $1`, [agentId]);
    return r.rows;
  }

  /* ── Read: the current list ─────────────────────────────────────────── */

  app.get("/api/lic/overview", async (req, res) => {
    const agentId = await requireAgent(req, res);
    if (!agentId) return;
    try {
      const [due, uploads] = await Promise.all([
        latestDue(agentId),
        pool.query(
          `SELECT id, kind, period, batch, lic_agent_code AS "agentCode", row_count AS "rowCount",
                  totals, created_at AS "createdAt"
             FROM lic_uploads WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 60`,
          [agentId],
        ),
      ]);
      const latestCommission = uploads.rows.find((u: any) => u.kind === "commission") ?? null;
      if (!due) {
        res.json({ dueList: null, latestCommission, uploads: uploads.rows, rows: [], totals: null });
        return;
      }
      const [dueRows, paid] = await Promise.all([
        pool.query(`SELECT ${DUE_COLS} FROM lic_due_rows WHERE upload_id = $1 AND agent_id = $2`, [due.id, agentId]),
        allPaid(agentId),
      ]);
      const m = matchDueList(dueRows.rows as MatchDueRow[], due.period, paid, todayIST());
      res.json({ dueList: due, latestCommission, uploads: uploads.rows, rows: m.rows, totals: m.totals, today: todayIST() });
    } catch (e: any) {
      console.error("[lic] overview failed:", e?.message);
      res.status(500).json({ error: "LIC_READ_FAILED", message: "Could not load your LIC list. Please try again." });
    }
  });

  /* ── Read: one policy (the details page) ────────────────────────────── */

  app.get("/api/lic/policies/:policyNo", async (req, res) => {
    const agentId = await requireAgent(req, res);
    if (!agentId) return;
    const policyNo = String(req.params.policyNo || "");
    if (!/^\d{6,12}$/.test(policyNo)) {
      res.status(400).json({ error: "BAD_POLICY_NO" });
      return;
    }
    try {
      const [due, payments] = await Promise.all([
        latestDue(agentId),
        pool.query(
          `SELECT ${PAID_COLS}, holder_name AS "holderName", cbo, u.period, u.batch
             FROM lic_paid_rows p JOIN lic_uploads u ON u.id = p.upload_id
            WHERE p.agent_id = $1 AND p.policy_no = $2
            ORDER BY p.due_date DESC, p.adj_date DESC`,
          [agentId, policyNo],
        ),
      ]);
      let row: any = null;
      if (due) {
        const d = await pool.query(
          `SELECT ${DUE_COLS} FROM lic_due_rows WHERE upload_id = $1 AND agent_id = $2 AND policy_no = $3`,
          [due.id, agentId, policyNo],
        );
        if (d.rows.length) {
          // Matched against ALL the agent's payments, exactly as the list does.
          const m = matchDueList(d.rows as MatchDueRow[], due.period, await allPaid(agentId), todayIST());
          row = m.rows[0];
        }
      }
      if (!row && payments.rows.length === 0) {
        res.status(404).json({ error: "NOT_FOUND", message: "This policy is not in your LIC sheets." });
        return;
      }
      res.json({ policy: row, dueList: due, payments: payments.rows, today: todayIST() });
    } catch (e: any) {
      console.error("[lic] policy read failed:", e?.message);
      res.status(500).json({ error: "LIC_READ_FAILED", message: "Could not load this policy. Please try again." });
    }
  });

  /* ── Write: upload a sheet ──────────────────────────────────────────── */

  app.post(
    "/api/lic/uploads",
    // Sign-in first, so nothing is read into memory for a stranger.
    async (req: any, res: any, next: () => void) => {
      const agentId = await requireAgent(req, res);
      if (!agentId) return;
      req.licAgentId = agentId;
      next();
    },
    (req: any, res: any, next: () => void) =>
      sheetUpload.single("file")(req, res, (err: any) => {
        if (err?.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "TOO_BIG", message: "This file is over 10 MB. LIC sheets are much smaller, so please check it is the right file." });
          return;
        }
        if (err) {
          res.status(400).json({ error: "BAD_UPLOAD", message: "The file could not be received. Please try again." });
          return;
        }
        next();
      }),
    async (req: any, res: any) => {
      const agentId: string = req.licAgentId;
      const kind = req.body?.kind;
      if (kind !== "due" && kind !== "commission") {
        res.status(400).json({ error: "BAD_KIND", message: "Choose which sheet this is." });
        return;
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: "NO_FILE", message: "Choose a PDF to upload." });
        return;
      }
      if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
        res.status(400).json({ error: "NOT_PDF", message: "This is not a PDF. Upload the PDF LIC gives you." });
        return;
      }

      const sha = crypto.createHash("sha256").update(file.buffer).digest("hex");
      const dup = await pool.query(
        `SELECT kind, period, batch, created_at AS "createdAt" FROM lic_uploads WHERE agent_id = $1 AND file_sha256 = $2`,
        [agentId, sha],
      );
      if (dup.rows.length) {
        res.status(409).json({ error: "ALREADY_UPLOADED", message: "You have already uploaded this sheet.", upload: dup.rows[0] });
        return;
      }

      let sheet: LicSheet;
      try {
        sheet = await parseLicSheet(new Uint8Array(file.buffer), kind);
      } catch (e: any) {
        if (e instanceof LicParseError) {
          res.status(422).json({ error: e.code.toUpperCase(), message: e.message });
          return;
        }
        console.error("[lic] parse failed:", e?.message);
        res.status(422).json({ error: "UNREADABLE", message: "This file could not be read. Please upload the PDF from the LIC agent portal." });
        return;
      }

      // A re-download of the same commission batch has a new footer id, so a new hash. Same
      // agent code + month + batch is the same sheet (critic item 3).
      if (sheet.kind === "commission" && sheet.batch != null) {
        const again = await pool.query(
          `SELECT created_at AS "createdAt" FROM lic_uploads
            WHERE agent_id = $1 AND kind = 'commission' AND lic_agent_code = $2 AND period = $3 AND batch = $4`,
          [agentId, sheet.agentCode, sheet.period, sheet.batch],
        );
        if (again.rows.length) {
          res.status(409).json({
            error: "ALREADY_UPLOADED",
            message: "You have already uploaded this commission batch.",
            upload: { kind: "commission", period: sheet.period, batch: sheet.batch, createdAt: again.rows[0].createdAt },
          });
          return;
        }
      }

      const totals =
        sheet.kind === "due"
          ? { premium: sheet.grandTotalPremium, estCommission: sheet.grandTotalCommission }
          : { premium: sheet.grandTotalPremium, commission: sheet.grandTotalCommission, ...sheet.summary };

      const client = await pool.connect();
      let uploadId: number;
      try {
        await client.query("BEGIN");
        const u = await client.query(
          `INSERT INTO lic_uploads (agent_id, kind, period, batch, lic_agent_code, branch_code, file_sha256, row_count, totals)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [agentId, sheet.kind, sheet.period, sheet.kind === "commission" ? sheet.batch : null,
           sheet.agentCode, sheet.branchCode, sha, sheet.rows.length, totals],
        );
        uploadId = u.rows[0].id;
        if (sheet.kind === "due") {
          const r = sheet.rows;
          await client.query(
            `INSERT INTO lic_due_rows (upload_id, agent_id, sno, policy_no, holder_name, doc, plan_no, lic_term, mode, fup,
                                       flag, inst_prem, due_count, gst, total_prem, est_comm)
             SELECT $1::bigint, $2::uuid, * FROM unnest($3::int[], $4::text[], $5::text[], $6::date[], $7::int[], $8::int[], $9::text[],
                                          $10::text[], $11::text[], $12::numeric[], $13::int[], $14::numeric[], $15::numeric[], $16::numeric[])`,
            [uploadId, agentId, r.map((x) => x.sno), r.map((x) => x.policyNo), r.map((x) => x.holderName), r.map((x) => x.doc),
             r.map((x) => x.planNo), r.map((x) => x.licTerm), r.map((x) => x.mode), r.map((x) => x.fup), r.map((x) => x.flag),
             r.map((x) => x.instPrem), r.map((x) => x.dueCount), r.map((x) => x.gst), r.map((x) => x.totalPrem), r.map((x) => x.estComm)],
          );
        } else {
          const r = sheet.rows;
          await client.query(
            `INSERT INTO lic_paid_rows (upload_id, agent_id, sno, holder_name, policy_no, plan_no, term, due_date, risk_date,
                                        cbo, adj_date, premium, commission)
             SELECT $1::bigint, $2::uuid, * FROM unnest($3::int[], $4::text[], $5::text[], $6::int[], $7::int[], $8::date[], $9::date[],
                                          $10::text[], $11::date[], $12::numeric[], $13::numeric[])`,
            [uploadId, agentId, r.map((x) => x.sno), r.map((x) => x.holderName), r.map((x) => x.policyNo), r.map((x) => x.planNo),
             r.map((x) => x.term), r.map((x) => x.dueDate), r.map((x) => x.riskDate), r.map((x) => x.cbo), r.map((x) => x.adjDate),
             r.map((x) => x.premium), r.map((x) => x.commission)],
          );
        }
        await client.query("COMMIT");
      } catch (e: any) {
        await client.query("ROLLBACK").catch(() => {});
        if (e?.code === "23505") {
          res.status(409).json({ error: "ALREADY_UPLOADED", message: "You have already uploaded this sheet." });
          return;
        }
        console.error("[lic] save failed:", e?.message);
        res.status(500).json({ error: "LIC_SAVE_FAILED", message: "The sheet was read but could not be saved. Nothing was changed. Please try again." });
        return;
      } finally {
        client.release();
      }

      // What this upload did, for the result card.
      const result: Record<string, unknown> = {
        upload: { id: uploadId, kind: sheet.kind, period: sheet.period, batch: sheet.kind === "commission" ? sheet.batch : null,
                  agentCode: sheet.agentCode, branchCode: sheet.branchCode, rowCount: sheet.rows.length, totals },
      };
      try {
        const due = await latestDue(agentId);
        if (due) {
          const dueRows = await pool.query(`SELECT ${DUE_COLS} FROM lic_due_rows WHERE upload_id = $1 AND agent_id = $2`, [due.id, agentId]);
          const all = matchDueList(dueRows.rows as MatchDueRow[], due.period, await allPaid(agentId), todayIST());
          result.totals = all.totals;
          result.dueList = due;
          if (sheet.kind === "commission") {
            const thisOne = matchDueList(dueRows.rows as MatchDueRow[], due.period, sheet.rows, todayIST());
            result.thisSheet = { paidOnList: thisOne.totals.paid, ...thisOne.extras };
          }
        }
      } catch (e: any) {
        console.warn("[lic] result summary failed:", e?.message);
      }
      res.status(201).json(result);
    },
  );

  /* ── Write: remove a sheet ──────────────────────────────────────────── */

  app.delete("/api/lic/uploads/:id", async (req, res) => {
    const agentId = await requireAgent(req, res);
    if (!agentId) return;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ error: "BAD_ID" });
      return;
    }
    try {
      // Rows go with it (ON DELETE CASCADE), in the same statement.
      const r = await pool.query("DELETE FROM lic_uploads WHERE id = $1 AND agent_id = $2", [id, agentId]);
      if (r.rowCount === 0) {
        res.status(404).json({ error: "NOT_FOUND", message: "That sheet is not in your account." });
        return;
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[lic] delete failed:", e?.message);
      res.status(500).json({ error: "LIC_DELETE_FAILED", message: "Could not remove the sheet. Please try again." });
    }
  });
}
