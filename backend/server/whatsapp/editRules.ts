// ============================================================================
// WhatsApp stage 2: the value rules for edits. Pure: no imports, no side effects.
// Used by the server (edits.ts) and copied BYTE FOR BYTE into the bot
// (whatsapp-bot/src/shared/editRules.ts, by whatsapp-bot/scripts/sync-shared.mjs) so the bot
// can show "old -> new" exactly as the server will store it. units.test.ts fails on any drift.
// They mirror the portal: lib/leads.ts and lib/customers.ts cleanDraft.
// ============================================================================

export const LEAD_STATUSES = ["new", "contacted", "interested", "won", "lost"];
/** The portal's interest chips (lib/leads.ts), stored as "Health, Motor" in one text column. */
export const INTERESTS = ["Health", "Motor", "Life", "Term", "Travel", "Property"];
export const LEAD_SOURCES = ["Referral", "WhatsApp", "Phone call", "Walk-in", "Website", "Social media", "Other"];

/* ── Value rules (pure) ─────────────────────────────────────────────────── */

const text = (v: unknown, max: number): string | null => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t.slice(0, max);
};

/** An Indian mobile as its last 10 digits, or an error. Empty clears it. */
function phone(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || String(v).trim() === "") return { ok: true, value: null };
  const d = String(v).replace(/\D/g, "");
  const last = d.slice(-10);
  if (d.length > 12 || !/^[6-9]\d{9}$/.test(last)) return { ok: false };
  return { ok: true, value: last };
}

function email(v: unknown): { ok: true; value: string | null } | { ok: false } {
  const t = text(v, 200);
  if (t === null) return { ok: true, value: null };
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? { ok: true, value: t.toLowerCase() } : { ok: false };
}

function isoDate(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || String(v).trim() === "") return { ok: true, value: null };
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(s + "T00:00:00Z").getTime())) return { ok: false };
  return { ok: true, value: s };
}

/** "health, motor" / ["Motor","Health"] -> "Health, Motor" in the portal's chip order. */
export function cleanInterests(v: unknown): string | null {
  const parts = (Array.isArray(v) ? v : String(v ?? "").split(/[,/&+]|\band\b|\baur\b/i))
    .map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  const picked = INTERESTS.filter((i) => parts.includes(i.toLowerCase()));
  return picked.length ? picked.join(", ") : null;
}

/** lib/leads.ts num(): digits and a dot only; "25,000" -> 25000. */
export function money(v: unknown): { ok: true; value: number | null } | { ok: false } {
  if (v === null || v === undefined || String(v).trim() === "") return { ok: true, value: null };
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 0 && n < 1e10 ? { ok: true, value: n } : { ok: false };
}

export type FieldErrors = Record<string, string>;
export type Clean = { set: Record<string, unknown>; errors: FieldErrors };

/** Lead fields the bot may change, cleaned the portal's way. Only keys present are kept. */
export function cleanLeadSet(raw: Record<string, unknown>): Clean {
  const set: Record<string, unknown> = {};
  const errors: FieldErrors = {};
  for (const [k, v] of Object.entries(raw || {})) {
    switch (k) {
      case "name": { const t = text(v, 120); if (!t || t.length < 2) errors.name = "a name is needed"; else set.name = t; break; }
      case "phone": { const p = phone(v); if (!p.ok) errors.phone = "not a 10 digit mobile number"; else set.phone = p.value; break; }
      case "email": { const e = email(v); if (!e.ok) errors.email = "not an email address"; else set.email = e.value; break; }
      case "city": set.city = text(v, 80); break;
      case "source": {
        const t = text(v, 40);
        set.source = t === null ? null : LEAD_SOURCES.find((s) => s.toLowerCase() === t.toLowerCase()) ?? t;
        break;
      }
      case "insurance_interest": {
        const i = cleanInterests(v);
        if (v !== null && String(v).trim() !== "" && !i) errors.insurance_interest = "pick from Health, Motor, Life, Term, Travel, Property";
        else set.insurance_interest = i;
        break;
      }
      case "expected_value": { const m = money(v); if (!m.ok) errors.expected_value = "not an amount"; else set.expected_value = m.value; break; }
      case "status": if (LEAD_STATUSES.includes(String(v))) set.status = v; else errors.status = "unknown status"; break;
      case "next_follow_up": { const d = isoDate(v); if (!d.ok) errors.next_follow_up = "not a date"; else set.next_follow_up = d.value; break; }
      default: errors[k] = "cannot be changed from WhatsApp";
    }
  }
  return { set, errors };
}

/** Customer fields the bot may change (lib/customers.ts cleanDraft, minus notes). */
export function cleanCustomerSet(raw: Record<string, unknown>): Clean {
  const set: Record<string, unknown> = {};
  const errors: FieldErrors = {};
  for (const [k, v] of Object.entries(raw || {})) {
    switch (k) {
      case "name": { const t = text(v, 120); if (!t || t.length < 2) errors.name = "a name is needed"; else set.name = t; break; }
      case "phone": { const p = phone(v); if (!p.ok) errors.phone = "not a 10 digit mobile number"; else set.phone = p.value; break; }
      case "email": { const e = email(v); if (!e.ok) errors.email = "not an email address"; else set.email = e.value; break; }
      case "city": set.city = text(v, 80); break;
      case "dob": { const d = isoDate(v); if (!d.ok) errors.dob = "not a date"; else set.dob = d.value; break; }
      default: errors[k] = "cannot be changed from WhatsApp";
    }
  }
  return { set, errors };
}

/** Normalise a stored or expected value for comparison (dates to YYYY-MM-DD, numbers to text). */
export function norm(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return String(v);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s;
}

/**
 * UPDATE that writes only `set`, and only if every column in `expect` still holds the
 * expected value (compared as text, null-safe). Column names come from the whitelist
 * above, never from the request, so they are safe to interpolate.
 */
export function guardedUpdate(table: string, cols: string[], set: Record<string, unknown>, expect: Record<string, unknown>, extraSet = "") {
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length + 2}`; }; // $1 id, $2 agent
  const sets = Object.entries(set).map(([k, v]) => `${k} = ${p(v)}`);
  const checks = Object.entries(expect).map(([k, v]) => `${k}::text IS NOT DISTINCT FROM ${p(norm(v))}::text`);
  for (const k of [...Object.keys(set), ...Object.keys(expect)]) if (!cols.includes(k)) throw new Error(`column ${k} not allowed`);
  const sql = `UPDATE ${table} SET ${[...sets, extraSet].filter(Boolean).join(", ")}
     WHERE id = $1 AND agent_id = $2${checks.length ? " AND " + checks.join(" AND ") : ""}
     RETURNING *`;
  return { sql, params };
}

const DATE_COLS = new Set(["next_follow_up", "dob"]);
/**
 * Undo: put back exactly what was stored before, even if it predates today's format rules
 * (a landline, a free-text interest, a mixed-case email). Only the column's TYPE is checked;
 * the route still requires `expect` (compare-before), so nothing newer is overwritten.
 */
export function restoreSet(raw: Record<string, unknown>, cols: string[]): Clean {
  const set: Record<string, unknown> = {};
  const errors: FieldErrors = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (!cols.includes(k)) { errors[k] = "cannot be changed from WhatsApp"; continue; }
    if (v === null || v === undefined || v === "") { set[k] = null; continue; }
    if (k === "status") { if (LEAD_STATUSES.includes(String(v))) set[k] = v; else errors[k] = "unknown status"; continue; }
    if (k === "expected_value") { const n = Number(v); if (Number.isFinite(n) && n >= 0) set[k] = n; else errors[k] = "not an amount"; continue; }
    if (DATE_COLS.has(k)) { const d = String(v).slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set[k] = d; else errors[k] = "not a date"; continue; }
    if (k === "name" && String(v).trim().length < 2) { errors[k] = "a name is needed"; continue; }
    set[k] = String(v).slice(0, 500);
  }
  return { set, errors };
}

/** Every column being changed must come with the value the advisor saw (compare-before). */
export function missingExpect(set: Record<string, unknown>, expect: Record<string, unknown>): string[] {
  return Object.keys(set).filter((k) => !(k in expect));
}
