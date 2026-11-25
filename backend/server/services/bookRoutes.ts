/** Routes over services/bookStore.ts. Kept out of routes.ts so the rules and their tests sit together. */
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import { pool } from "../lib/db";
import { log } from "../lib/logger";
import { isLimitedFree, NEEDS_UPGRADE } from "../lib/entitlement";
import { deriveSharedColumns } from "./extractionFields";
import {
  addManualPolicy, attachDocument, carryLeadPolicies, deleteClaim, isId, linkRenewal, mergeCustomers, saveHealthFacts, type RunTx,
} from "./bookStore";

interface Deps {
  verifyJwt: (req: any, res: any) => Promise<string | null>;
  recordAccess: (req: any, agentId: string, clientId: string | null, action: string) => unknown;
  supabaseAdmin: any;
  pdfBucket: string;
  /** Sign-in check, then multer for one "file": an unsigned caller never writes to disk. */
  oneFile: ((req: any, res: any, next: () => void) => void)[];
  ownedStorageObject: (url: unknown, accountId: string) => { bucket: string; path: string } | null;
}

type Out = { status: number; body: any };

/** Commits only a success. A refusal returned from inside (status 400 and up) is rolled back. */
const runTx: RunTx = async (fn) => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c as any);
    await c.query(((out as any)?.status ?? 200) >= 400 ? "ROLLBACK" : "COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
};

export function registerBookRoutes(app: Express, d: Deps) {
  const route = (paid: boolean, action: string, fn: (req: Request, agentId: string) => Promise<Out>) =>
    async (req: Request, res: Response) => {
      const agentId = await d.verifyJwt(req, res);
      if (!agentId) return;
      try {
        const isAgent = await pool.query("SELECT 1 FROM agents WHERE id = $1", [agentId]);
        if (!isAgent.rows[0]) return res.status(403).json({ error: "WRONG_ACCOUNT_TYPE", message: "This is for advisor accounts." });
        if (paid && (await isLimitedFree(agentId))) return res.status(403).json(NEEDS_UPGRADE);
        const out = await fn(req, agentId);
        if (out.status === 200 && action) {
          void d.recordAccess(req, agentId, isId(req.params.id) ? req.params.id : out.body?.id ?? null, action);
        }
        return res.status(out.status).json(out.body);
      } catch (err: any) {
        log.error("book_route_failed", { path: req.route?.path, message: err?.message });
        return res.status(500).json({ error: "INTERNAL", message: "Something went wrong. Please try again." });
      }
    };
  const store = d.supabaseAdmin.storage;

  app.patch("/api/agent/policies/:id/facts", route(false, "update_client", (req, a) =>
    saveHealthFacts(pool as any, a, req.params.id as string, req.body)));
  app.post("/api/agent/policies/manual", route(true, "policy_manual_add", (req, a) =>
    addManualPolicy(pool as any, a, req.body, { deriveSharedColumns })));
  app.post("/api/agent/policies/:id/renews", route(false, "policy_renewal_link", (req, a) =>
    linkRenewal(pool as any, a, req.params.id as string, req.body?.old_id)));
  app.post("/api/agent/customers/:id/merge", route(true, "customer_merge", (req, a) =>
    mergeCustomers(runTx, a, req.params.id as string, req.body?.from_id)));

  app.post("/api/agent/leads/:id/carry-policies", route(true, "lead_policies_carry", (req, a) =>
    carryLeadPolicies(runTx, a, req.params.id as string, {
      newId: () => crypto.randomUUID(),
      async copy(fromUrl, clientId) {
        const owned = d.ownedStorageObject(fromUrl, a);
        if (!owned) return null;
        const { data: blob, error } = await store.from(owned.bucket).download(owned.path);
        if (error || !blob) return null;
        // The path an uploaded policy gets, so deleting the policy finds this file too.
        const ext = (owned.path.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "pdf";
        const path = `${a}/${clientId}.${ext}`;
        const up = await store.from(d.pdfBucket).upload(path, Buffer.from(await blob.arrayBuffer()), {
          contentType: blob.type || "application/pdf",
        });
        if (up.error) return null;
        const { data: signed } = await store.from(d.pdfBucket).createSignedUrl(path, 3600);
        if (!signed?.signedUrl) {
          await store.from(d.pdfBucket).remove([path]);
          return null;
        }
        return { url: signed.signedUrl, path };
      },
      undo: (path) => store.from(d.pdfBucket).remove([path]),
      async drop(fromUrl) {
        const owned = d.ownedStorageObject(fromUrl, a);
        if (owned) await store.from(owned.bucket).remove([owned.path]);
      },
    })));

  app.post("/api/agent/policies/:id/document", ...d.oneFile, async (req: Request, res: Response) => {
    const f = (req as any).file as { path: string; originalname: string; size: number; mimetype: string } | undefined;
    try {
      await route(false, "policy_attach_document", (_r, a) =>
        attachDocument(pool as any, a, req.params.id as string, f ? { name: f.originalname, size: f.size } : null, {
          async put(path) {
            const up = await store.from(d.pdfBucket).upload(path, fs.readFileSync(f!.path), { contentType: f!.mimetype || "application/pdf", upsert: true });
            if (up.error) return null;
            const { data: signed } = await store.from(d.pdfBucket).createSignedUrl(path, 3600);
            return signed?.signedUrl ?? null;
          },
        }))(req, res);
    } finally {
      if (f?.path) fs.promises.unlink(f.path).catch(() => {});
    }
  });

  app.delete("/api/agent/claims/:id", route(false, "claim_delete", (req, a) =>
    deleteClaim(pool as any, a, req.params.id as string, async (paths) => {
      const { error } = await store.from(d.pdfBucket).remove(paths);
      if (error) log.error("claim_delete_files_failed", { message: error.message });
      return !error;
    })));

  app.get("/api/agent/comparisons", route(false, "", async (_req, a) => {
    const r = await pool.query(
      `SELECT r.id, r.name_a, r.name_b, r.created_at, r.customer_id, c.name AS customer_name,
              CASE WHEN jsonb_typeof(r.result::jsonb->'sides') = 'array'
                   THEN jsonb_array_length(r.result::jsonb->'sides') ELSE 0 END AS plans
         FROM comparison_reports r
         LEFT JOIN customers c ON c.id = r.customer_id AND c.agent_id = r.agent_id
        WHERE r.agent_id = $1 ORDER BY r.created_at DESC LIMIT 200`,
      [a]
    );
    return { status: 200, body: { rows: r.rows } };
  }));
  const missing: Out = { status: 404, body: { error: "NOT_FOUND", message: "Comparison not found" } };
  app.patch("/api/agent/comparisons/:id", route(true, "", async (req, a) => {
    const cid = req.body?.customer_id ?? null;
    if (!isId(req.params.id) || (cid !== null && !isId(cid))) return missing;
    const r = await pool.query(
      `UPDATE comparison_reports SET customer_id = $3::uuid WHERE id = $1 AND agent_id = $2
          AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM customers WHERE id = $3::uuid AND agent_id = $2)) RETURNING id`,
      [req.params.id, a, cid]
    );
    return r.rows[0] ? { status: 200, body: { ok: true } } : missing;
  }));
  app.delete("/api/agent/comparisons/:id", route(false, "", async (req, a) => {
    if (!isId(req.params.id)) return missing;
    const r = await pool.query("DELETE FROM comparison_reports WHERE id = $1 AND agent_id = $2 RETURNING id", [req.params.id, a]);
    return r.rows[0] ? { status: 200, body: { ok: true } } : missing;
  }));
}
