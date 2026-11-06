// Where records are kept. Live records go to the local server (corporate-server/server.mjs: a SQLite
// file and a PDF folder on this computer) when it is running on the dev machine. Otherwise, and always
// for the fictional demo, they stay in this browser's storage. The server is only ever 127.0.0.1.
import { LIVE } from "./data.js";

const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
// ?server=5429 points a test run at its own server instance; ?local forces browser storage.
// Built portals (beta) use the IndSure backend and need a sign-in. ?api=<url> tries that against a test server.
const devApi = import.meta.env.DEV ? params.get("api") : null;
const REMOTE = LIVE && (!import.meta.env.DEV || !!devApi);
const API = devApi || import.meta.env.VITE_API_URL || "https://api.indsure.in";
export const SERVER = REMOTE ? API : `http://127.0.0.1:${(import.meta.env.DEV && params.get("server")) || "5420"}`;
const useServer = REMOTE || (LIVE && import.meta.env.DEV && !params.has("local"));

// ---- Sign-in (built portals only)
const SESSION = "indsure-commercial-session";
export class SignedOut extends Error {}
function session() {
  try { const s = JSON.parse(localStorage.getItem(SESSION) || "null"); return s && s.exp > Date.now() ? s : null; } catch (e) { return null; }
}
export const needsLogin = () => REMOTE && !session();
export const isRemote = () => REMOTE;
export function logout() { try { localStorage.removeItem(SESSION); } catch (e) { /* storage blocked */ } }
export async function login(email, password) {
  try {
    const r = await fetch(`${API}/api/corp/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (r.status === 401) return { ok: false, reason: "wrong" };
    if (r.status === 429) return { ok: false, reason: "limit" };
    if (!r.ok) return { ok: false, reason: "down" };
    const j = await r.json();
    localStorage.setItem(SESSION, JSON.stringify(j));
    return { ok: true };
  } catch (e) { return { ok: false, reason: "down" }; }
}
const auth = () => { const s = REMOTE ? session() : null; return s ? { authorization: `Bearer ${s.token}` } : {}; };

let kind = "browser"; // "server" | "browser" | "browser-fallback"
let version = 0;
let dataDir = "";
let status = () => {};
export const storeInfo = () => ({ kind, dataDir, version });
export const onSaveStatus = (fn) => { status = fn; };

async function getJson(url, ms = REMOTE ? 30000 : 2500) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, headers: auth() }); return { status: r.status, body: r.status === 204 ? null : await r.json() }; } finally { clearTimeout(t); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Document text. Each document's lines are most of a record's size, and every save sends the whole
// book, so online the text is stored once on its own and fetched only when a document is opened.
const texts = new Map();
const sent = new Set();
const toSend = new Map();
let textStore = false;
const stripOne = (x) => {
  if (!x.lines) return x;
  const id = x.textId || x.id;
  texts.set(id, x.lines);
  if (!sent.has(id)) toSend.set(id, x.lines);
  const { lines, ...rest } = x;
  return { ...rest, hasText: true };
};
const stripBook = (d) => (textStore ? { ...d, documents: d.documents.map(stripOne), inbox: (d.inbox || []).map(stripOne) } : d);
async function sendTexts() {
  while (toSend.size) {
    const batch = [...toSend].slice(0, 40);
    const r = await fetch(`${SERVER}/api/corp/doctext`, { method: "POST", headers: { "content-type": "application/json", ...auth() }, body: JSON.stringify({ items: batch.map(([id, lines]) => ({ id, lines })) }) });
    if (!r.ok) throw new Error(`text save failed ${r.status}`);
    batch.forEach(([id]) => { toSend.delete(id); sent.add(id); });
  }
}
/** The lines of a document or draft, if they are here. Call loadTexts first for one opened from a saved book. */
export const docText = (d) => (d ? d.lines || texts.get(d.textId || d.id) || null : null);
/** Fetches any text not already here. Never rejects: a document without text simply shows none. */
export async function loadTexts(ids) {
  const need = [...new Set(ids.filter(Boolean))].filter((id) => !texts.has(id));
  if (!textStore || !need.length) return;
  for (let i = 0; i < need.length; i += 40) {
    try {
      const b = await getJson(`${SERVER}/api/corp/doctext?ids=${encodeURIComponent(need.slice(i, i + 40).join(","))}`, 30000);
      if (b.status === 200) Object.entries(b.body).forEach(([id, lines]) => { texts.set(id, lines); sent.add(id); });
    } catch (e) { /* shown as no text; opening again retries */ }
  }
}
export async function fileBlobUrl(id) {
  try { const r = await fetch(fileUrl(id)); return r.ok ? URL.createObjectURL(await r.blob()) : null; } catch (e) { return null; }
}
// The text store may not be on the server yet: until it is, text simply stays inside the book, as before.
async function checkTextStore() { try { const b = await getJson(`${SERVER}/api/corp/doctext?ids=`, 8000); textStore = b.status === 200; } catch (e) { textStore = false; } }

// Loads the book. seed() gives the starting book when nothing has been saved yet.
export async function openStore(key, seed) {
  if (REMOTE) {
    kind = "server";
    const b = await getJson(`${SERVER}/api/corp/book`);
    if (b.status === 401) { logout(); throw new SignedOut(); }
    if (b.status === 200) { version = b.body.version; await checkTextStore(); return b.body.db; }
    if (b.status === 404) { version = 0; await checkTextStore(); return seed(); }
    throw new Error(`records unavailable (${b.status})`);
  }
  if (useServer) {
    try {
      const h = await getJson(`${SERVER}/api/corp/health`, 1500);
      if (h.status === 200) {
        kind = "server"; dataDir = h.body.dataDir; await checkTextStore();
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
      const small = stripBook(job.d);
      await sendTexts();
      const r = await fetch(`${SERVER}/api/corp/book`, { method: "PUT", headers: { "content-type": "application/json", ...auth() }, body: JSON.stringify({ baseVersion: version, db: small, note: job.note }) });
      if (r.status === 401) { pending = job; status({ state: "signedout" }); break; }
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

// Keeps the original PDF or photo on this computer. Returns its id, or null when there is no server.
export async function saveFile(file) {
  if (kind !== "server" || !file || file.size > 40 * 1024 * 1024) return null;
  try {
    const h = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const pdf = String.fromCharCode(...h.slice(0, 5)) === "%PDF-", png = h[0] === 0x89 && h[1] === 0x50, jpg = h[0] === 0xff && h[1] === 0xd8;
    if (!pdf && !png && !jpg) return null;
    // The backend's CORS rules allow only standard headers, so online the name travels in the address.
    const r = REMOTE ? await fetch(`${SERVER}/api/corp/files?name=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "content-type": "application/octet-stream", ...auth() }, body: file })
      : await fetch(`${SERVER}/api/corp/files`, { method: "POST", headers: { "x-file-name": encodeURIComponent(file.name) }, body: file });
    return r.ok ? (await r.json()).id : null;
  } catch (e) { return null; }
}
export const fileUrl = (id, download = false) => {
  const q = [REMOTE && session() ? `t=${encodeURIComponent(session().fileKey)}` : "", download ? "download=1" : ""].filter(Boolean).join("&");
  return `${SERVER}/api/corp/files/${id}${q ? `?${q}` : ""}`;
};

// ---- Online only: who is signed in, logins, problem reports, reminders
export const currentUser = () => (REMOTE ? session()?.user || { name: "Admin", role: "admin" } : null);
async function api(method, path, body) {
  const r = await fetch(`${SERVER}${path}`, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...auth() }, body: body ? JSON.stringify(body) : undefined });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) };
}
export async function listLogins() { const r = await api("GET", "/api/corp/users"); if (!r.ok) throw new Error("logins"); return r.body; }
export async function addLogin(u) { try { return await api("POST", "/api/corp/users", u); } catch (e) { return { ok: false }; } }
export async function changeLogin(email, patch) { try { return await api("PATCH", `/api/corp/users/${encodeURIComponent(email)}`, patch); } catch (e) { return { ok: false }; } }
export async function remindersSent() { if (!REMOTE) return []; try { const r = await api("GET", "/api/corp/reminders"); return r.ok ? r.body : []; } catch (e) { return []; } }
export async function sendFeedback(report) {
  if (kind !== "server") return { ok: false };
  try { const r = await api("POST", "/api/corp/feedback", report); return { ok: r.ok, id: r.body?.id }; } catch (e) { return { ok: false }; }
}
