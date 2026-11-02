// Where records are kept. Live records go to the local server (corporate-server/server.mjs: a SQLite
// file and a PDF folder on this computer) when it is running on the dev machine. Otherwise, and always
// for the fictional demo, they stay in this browser's storage. The server is only ever 127.0.0.1.
import { LIVE } from "./data.js";

const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
// ?server=5429 points a test run at its own server instance; ?local forces browser storage.
export const SERVER = `http://127.0.0.1:${(import.meta.env.DEV && params.get("server")) || "5420"}`;
const useServer = LIVE && import.meta.env.DEV && !params.has("local");

let kind = "browser"; // "server" | "browser" | "browser-fallback"
let version = 0;
let dataDir = "";
let status = () => {};
export const storeInfo = () => ({ kind, dataDir, version });
export const onSaveStatus = (fn) => { status = fn; };

async function getJson(url, ms = 2500) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); return { status: r.status, body: r.status === 204 ? null : await r.json() }; } finally { clearTimeout(t); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Loads the book. seed() gives the starting book when nothing has been saved yet.
export async function openStore(key, seed) {
  if (useServer) {
    try {
      const h = await getJson(`${SERVER}/api/corp/health`, 1500);
      if (h.status === 200) {
        kind = "server"; dataDir = h.body.dataDir;
        const b = await getJson(`${SERVER}/api/corp/book`);
        if (b.status === 200) { version = b.body.version; return b.body.db; }
        const d = seed(); version = 0; return d;
      }
    } catch (e) { /* server not running */ }
    kind = "browser-fallback";
  }
  try { const raw = localStorage.getItem(key); if (raw) { const d = JSON.parse(raw); if (d && d.version === 2) return d; } } catch (e) { /* storage blocked */ }
  return seed();
}

// Saves are queued: only the newest book is sent, one request at a time. A failed save retries.
let pending = null, busy = false;
export const hasUnsaved = () => kind === "server" && (busy || !!pending);
export function save(key, d, note = "") {
  if (kind !== "server") {
    try { localStorage.setItem(key, JSON.stringify(d)); status({ state: "saved", at: new Date() }); }
    catch (e) { status({ state: "error", reason: e?.name === "QuotaExceededError" ? "full" : "blocked" }); }
    return;
  }
  pending = { d, note };
  if (!busy) flush();
}
async function flush() {
  busy = true;
  while (pending) {
    const job = pending; pending = null;
    status({ state: "saving" });
    try {
      const r = await fetch(`${SERVER}/api/corp/book`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseVersion: version, db: job.d, note: job.note }) });
      if (r.status === 409) { status({ state: "conflict" }); break; }
      if (!r.ok) throw new Error(`save failed ${r.status}`);
      const j = await r.json();
      version = j.version;
      status({ state: "saved", at: new Date(j.savedAt), version });
    } catch (e) {
      status({ state: "offline" });
      if (!pending) pending = job;
      await sleep(3000);
    }
  }
  busy = false;
}

// Another window saved first: take its book and carry on from there.
export async function reloadLatest() {
  const b = await getJson(`${SERVER}/api/corp/book`);
  if (b.status !== 200) throw new Error("could not reload");
  version = b.body.version;
  return b.body.db;
}

export async function listVersions() { const r = await getJson(`${SERVER}/api/corp/versions`); return r.status === 200 ? r.body : []; }
export async function getVersion(v) { const r = await getJson(`${SERVER}/api/corp/versions/${v}`); if (r.status !== 200) throw new Error("no such version"); return r.body; }

// Keeps the original PDF on this computer. Returns its id, or null when there is no server.
export async function saveFile(file) {
  if (kind !== "server" || !file || file.size > 40 * 1024 * 1024) return null;
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...head) !== "%PDF-") return null;
    const r = await fetch(`${SERVER}/api/corp/files`, { method: "POST", headers: { "x-file-name": encodeURIComponent(file.name) }, body: file });
    return r.ok ? (await r.json()).id : null;
  } catch (e) { return null; }
}
export const fileUrl = (id) => `${SERVER}/api/corp/files/${id}`;
