// IndSure Commercial local server. Keeps the corporate portal's records in a SQLite file and the
// original policy PDFs in a folder, both on this computer only. Listens on 127.0.0.1, so nothing on
// the network can reach it. No dependencies: Node's built-in http and node:sqlite.
//
//   node corporate-server/server.mjs            data in E:\Indsurefi\commercial-data, port 5420
//   PORT=5421 DATA_DIR=<folder> node ...        a separate instance (the automated tests use this)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const PORT = Number(process.env.PORT || 5420);
const DATA_DIR = process.env.DATA_DIR || "E:/Indsurefi/commercial-data";
const FILES = path.join(DATA_DIR, "files");
const KEEP_VERSIONS = 200;
const MAX_BOOK = 50 * 1024 * 1024;
const MAX_PDF = 40 * 1024 * 1024;
// Only the local dev server's pages may call this.
const ORIGINS = new Set(["http://localhost:5412", "http://127.0.0.1:5412"]);

fs.mkdirSync(FILES, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "commercial.sqlite"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS book (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, data TEXT NOT NULL, saved_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS book_versions (version INTEGER PRIMARY KEY, data TEXT NOT NULL, saved_at TEXT NOT NULL, note TEXT);
  CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, name TEXT NOT NULL, size INTEGER NOT NULL, saved_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, message TEXT, page TEXT, file_id TEXT, saved_at TEXT NOT NULL);
`);
const now = () => new Date().toISOString();
const getBook = () => db.prepare("SELECT version, data, saved_at FROM book WHERE id = 1").get();

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { "content-type": isBuf ? "application/octet-stream" : "application/json", ...headers });
  res.end(isBuf ? body : JSON.stringify(body));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error("too large"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
const TYPES = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" };
function kindOf(buf) {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  return null;
}
// The book is the portal's whole record set. It must look like one before it is stored.
function validBook(b) {
  return b && typeof b === "object" && b.version === 2 && ["customers", "policies", "terms", "documents", "insurers", "team", "audit"].every((k) => Array.isArray(b[k]));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const cors = origin && ORIGINS.has(origin) ? { "access-control-allow-origin": origin, "vary": "origin" } : {};
  if (origin && !ORIGINS.has(origin)) return send(res, 403, { error: "origin not allowed" });
  if (req.method === "OPTIONS") {
    res.writeHead(204, { ...cors, "access-control-allow-methods": "GET, PUT, POST", "access-control-allow-headers": "content-type, x-file-name", "access-control-max-age": "600" });
    return res.end();
  }
  const url = new URL(req.url, "http://local");
  const p = url.pathname;
  try {
    if (req.method === "GET" && p === "/api/corp/health") {
      const b = getBook();
      return send(res, 200, { ok: true, dataDir: path.resolve(DATA_DIR), version: b?.version ?? 0, savedAt: b?.saved_at ?? null, files: db.prepare("SELECT COUNT(*) AS n FROM files").get().n }, cors);
    }
    if (req.method === "GET" && p === "/api/corp/book") {
      const b = getBook();
      if (!b) return send(res, 404, { error: "no book yet" }, cors);
      return send(res, 200, { version: b.version, savedAt: b.saved_at, db: JSON.parse(b.data) }, cors);
    }
    // Save. baseVersion must match what is stored, so two windows cannot silently overwrite each other.
    if (req.method === "PUT" && p === "/api/corp/book") {
      const body = JSON.parse((await readBody(req, MAX_BOOK)).toString("utf8"));
      if (!validBook(body.db)) return send(res, 400, { error: "not a valid book" }, cors);
      const cur = getBook();
      const curVersion = cur?.version ?? 0;
      if ((body.baseVersion ?? 0) !== curVersion) return send(res, 409, { error: "changed elsewhere", version: curVersion }, cors);
      const version = curVersion + 1, at = now(), data = JSON.stringify(body.db);
      db.exec("BEGIN");
      try {
        db.prepare("INSERT INTO book (id, version, data, saved_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET version = excluded.version, data = excluded.data, saved_at = excluded.saved_at").run(version, data, at);
        db.prepare("INSERT INTO book_versions (version, data, saved_at, note) VALUES (?, ?, ?, ?)").run(version, data, at, String(body.note || "").slice(0, 200));
        db.prepare("DELETE FROM book_versions WHERE version <= ?").run(version - KEEP_VERSIONS);
        db.exec("COMMIT");
      } catch (e) { db.exec("ROLLBACK"); throw e; }
      return send(res, 200, { version, savedAt: at }, cors);
    }
    // Earlier saves, newest first, so a mistake can be undone.
    if (req.method === "GET" && p === "/api/corp/versions") {
      const rows = db.prepare("SELECT version, saved_at, note, length(data) AS bytes FROM book_versions ORDER BY version DESC LIMIT 60").all();
      return send(res, 200, rows.map((r) => ({ version: r.version, savedAt: r.saved_at, note: r.note, bytes: r.bytes })), cors);
    }
    const vm = p.match(/^\/api\/corp\/versions\/(\d+)$/);
    if (req.method === "GET" && vm) {
      const r = db.prepare("SELECT version, data, saved_at FROM book_versions WHERE version = ?").get(Number(vm[1]));
      if (!r) return send(res, 404, { error: "no such version" }, cors);
      return send(res, 200, { version: r.version, savedAt: r.saved_at, db: JSON.parse(r.data) }, cors);
    }
    // Original PDFs and photos, stored by content hash: the same file attached twice is kept once.
    if (req.method === "POST" && p === "/api/corp/files") {
      const buf = await readBody(req, MAX_PDF);
      const ext = kindOf(buf);
      if (!ext) return send(res, 400, { error: "not a PDF, JPG or PNG" }, cors);
      const id = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32);
      const name = decodeURIComponent(String(req.headers["x-file-name"] || "document.pdf")).replace(/[\\/:*?"<>|\r\n]/g, "_").slice(0, 160);
      const file = path.join(FILES, `${id}.${ext}`);
      if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
      db.prepare("INSERT INTO files (id, name, size, saved_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").run(id, name, buf.length, now());
      return send(res, 200, { id, size: buf.length }, cors);
    }
    const fm = p.match(/^\/api\/corp\/files\/([a-f0-9]{32})$/);
    if (req.method === "GET" && fm) {
      const row = db.prepare("SELECT name FROM files WHERE id = ?").get(fm[1]);
      const ext = Object.keys(TYPES).find((e) => fs.existsSync(path.join(FILES, `${fm[1]}.${e}`)));
      if (!row || !ext) return send(res, 404, { error: "no such file" }, cors);
      const file = path.join(FILES, `${fm[1]}.${ext}`);
      const how = url.searchParams.has("download") ? "attachment" : "inline";
      res.writeHead(200, { ...cors, "content-type": TYPES[ext], "content-disposition": `${how}; filename="${row.name.replace(/"/g, "")}"` });
      return fs.createReadStream(file).pipe(res);
    }
    if (req.method === "POST" && p === "/api/corp/feedback") {
      const f = JSON.parse((await readBody(req, 64 * 1024)).toString("utf8"));
      if (!String(f.message || "").trim()) return send(res, 400, { error: "say what happened" }, cors);
      const r = db.prepare("INSERT INTO feedback (kind, message, page, file_id, saved_at) VALUES (?, ?, ?, ?, ?)").run(String(f.kind || ""), String(f.message), String(f.page || ""), f.fileId || null, now());
      return send(res, 200, { id: Number(r.lastInsertRowid) }, cors);
    }
    return send(res, 404, { error: "not found" }, cors);
  } catch (e) {
    return send(res, e.status || 500, { error: e.status === 413 ? "too large" : "server error", detail: String(e.message || e).slice(0, 200) }, cors);
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`IndSure Commercial local server on http://127.0.0.1:${PORT}, data in ${path.resolve(DATA_DIR)}`));
