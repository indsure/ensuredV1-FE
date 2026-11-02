/**
 * Mock Supabase client for the agent playground.
 *
 * Implements just enough of supabase-js for the agent portal to run fully
 * offline against the in-memory seed (./seed): the auth surface, a chainable
 * query builder that actually honours filters/order/limit/count so the
 * dashboard numbers are consistent, and a no-op storage surface. It also stubs
 * `/api/*` fetches (analyze/rerun/upload) so those flows simulate instead of
 * hitting the real backend.
 *
 * Reads return seeded rows; writes mutate the in-memory store so the demo feels
 * live within a session. Nothing persists past a reload, and the real backend
 * is never contacted while in playground mode.
 */

import {
  buildSeed, buildCatalogComparison, buildUploadedPolicy,
  DEMO_CATALOG, DEMO_COMPARE_RESPONSE, type Store,
} from "./seed";
import { DEMO_AGENT_ID, DEMO_EMAIL, exitPlayground, isPlaygroundMode } from "./mode";
import { playgroundTeamApi } from "./teamSeed";
import { buildDemoDocumentRules } from "./policyTermsSeed";

let store: Store | null = null;
/** Exported for the WhatsApp demo phone (features/wa-demo), which answers from this same
 *  store so a lead added in the chat shows up on the Leads page, and the other way round. */
export function getStore(): Store {
  if (!store) store = buildSeed();
  return store;
}

// Development builds only: lets a person (or a test session) load synthetic
// rows into the demo store from the console. import.meta.env.DEV is false in
// production builds, so this whole statement is removed there.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).__playgroundStore = getStore;
}

const ok = (data: any, count: number | null = null) => ({
  data,
  error: null,
  count,
  status: 200,
  statusText: "OK",
});

// ---- Filtering engine -------------------------------------------------------

type Filter = { col: string; op: string; val: any };

function passes(row: any, f: Filter): boolean {
  const v = row[f.col];
  switch (f.op) {
    case "eq": return v === f.val;
    case "neq": return v !== f.val;
    case "gt": return v != null && v > f.val;
    case "gte": return v != null && v >= f.val;
    case "lt": return v != null && v < f.val;
    case "lte": return v != null && v <= f.val;
    case "in": return Array.isArray(f.val) && f.val.includes(v);
    case "is": return f.val === null ? v == null : v === f.val;
    case "not_is": return f.val === null ? v != null : v !== f.val;
    case "contains": return true; // not meaningfully used by the portal
    default: return true;
  }
}

/** Attach a known embedded resource (only relationship the portal uses). */
function applyEmbed(table: string, selectStr: string, rows: any[]): any[] {
  if (table === "lead_policies" && /agent_leads\s*\(/.test(selectStr)) {
    const leads = getStore().agent_leads;
    return rows.map((r) => {
      const lead = leads.find((l) => l.id === r.lead_id);
      return { ...r, agent_leads: lead ? { id: lead.id, name: lead.name, phone: lead.phone } : null };
    });
  }
  return rows;
}

/** PostgREST JSON paths in a select (`alias:col->key`, `col->>key`). The real
 *  API returns just that value under the alias (or the key); without this the
 *  mock returns whole rows and a page that selects narrowly reads nothing. */
function applyJsonPaths(selectStr: string, rows: any[]): any[] {
  const paths: { name: string; col: string; key: string; text: boolean }[] = [];
  for (const token of selectStr.split(",")) {
    const m = token.trim().match(/^(?:(\w+)\s*:\s*)?(\w+)\s*(->>?)\s*(\w+)$/);
    if (m) paths.push({ name: m[1] ?? m[4], col: m[2], key: m[4], text: m[3] === "->>" });
  }
  if (!paths.length) return rows;
  return rows.map((r) => {
    const out = { ...r };
    for (const p of paths) {
      const v = r[p.col]?.[p.key];
      out[p.name] = v == null ? null : !p.text ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
    }
    return out;
  });
}

class QueryBuilder {
  private table: string;
  private filters: Filter[] = [];
  private orders: { col: string; ascending: boolean; nullsFirst: boolean }[] = [];
  private limitN: number | null = null;
  private op: "select" | "insert" | "update" | "delete" = "select";
  private selectStr = "*";
  private countMode: string | null = null;
  private headOnly = false;
  private payload: any = null;
  private wantSingle: false | "single" | "maybe" = false;

  constructor(table: string) {
    this.table = table;
  }

  select(str?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") this.selectStr = str ?? "*";
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(rows: any) { this.op = "insert"; this.payload = rows; return this; }
  update(vals: any) { this.op = "update"; this.payload = vals; return this; }
  upsert(rows: any) { this.op = "insert"; this.payload = rows; return this; }
  delete() { this.op = "delete"; return this; }

  eq(col: string, val: any) { this.filters.push({ col, op: "eq", val }); return this; }
  neq(col: string, val: any) { this.filters.push({ col, op: "neq", val }); return this; }
  gt(col: string, val: any) { this.filters.push({ col, op: "gt", val }); return this; }
  gte(col: string, val: any) { this.filters.push({ col, op: "gte", val }); return this; }
  lt(col: string, val: any) { this.filters.push({ col, op: "lt", val }); return this; }
  lte(col: string, val: any) { this.filters.push({ col, op: "lte", val }); return this; }
  in(col: string, val: any[]) { this.filters.push({ col, op: "in", val }); return this; }
  is(col: string, val: any) { this.filters.push({ col, op: "is", val }); return this; }
  contains(col: string, val: any) { this.filters.push({ col, op: "contains", val }); return this; }
  not(col: string, operator: string, val: any) {
    this.filters.push({ col, op: operator === "is" ? "not_is" : "neq", val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ col, ascending: opts?.ascending !== false, nullsFirst: !!opts?.nullsFirst });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range() { return this; }

  single() { this.wantSingle = "single"; return this; }
  maybeSingle() { this.wantSingle = "maybe"; return this; }

  private currentTable(): any[] {
    const s = getStore();
    if (!s[this.table]) s[this.table] = [];
    return s[this.table];
  }

  private filtered(): any[] {
    return this.currentTable().filter((row) => this.filters.every((f) => passes(row, f)));
  }

  private sortAndLimit(rows: any[]): any[] {
    // Like PostgREST: the first .order() decides, later ones only break ties.
    let out = this.orders.length === 0 ? rows : [...rows].sort((a, b) => {
      for (const o of this.orders) {
        const av = a[o.col];
        const bv = b[o.col];
        if (av == null && bv == null) continue;
        if (av == null) return o.nullsFirst ? -1 : 1;
        if (bv == null) return o.nullsFirst ? 1 : -1;
        if (av < bv) return o.ascending ? -1 : 1;
        if (av > bv) return o.ascending ? 1 : -1;
      }
      return 0;
    });
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }

  private run() {
    if (this.op === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const table = this.currentTable();
      const inserted = rows.map((r) => {
        const row = {
          id: r.id ?? `pg-${Math.random().toString(36).slice(2, 10)}`,
          agent_id: r.agent_id ?? DEMO_AGENT_ID,
          created_at: r.created_at ?? new Date().toISOString(),
          ...r,
        };
        table.push(row);
        return row;
      });
      const data = this.wantSingle ? inserted[0] ?? null : inserted;
      return ok(this.selectStr ? data : null);
    }

    if (this.op === "update") {
      const matches = this.filtered();
      matches.forEach((row) => Object.assign(row, this.payload, { updated_at: new Date().toISOString() }));
      const data = this.wantSingle ? matches[0] ?? null : matches;
      return ok(data);
    }

    if (this.op === "delete") {
      const matches = this.filtered();
      const table = this.currentTable();
      const ids = new Set(matches);
      const remaining = table.filter((r) => !ids.has(r));
      getStore()[this.table] = remaining;
      return ok(matches);
    }

    // select
    const matched = this.filtered();
    if (this.headOnly) return ok(null, matched.length);
    let rows = this.sortAndLimit(matched);
    rows = applyEmbed(this.table, this.selectStr, rows);
    rows = applyJsonPaths(this.selectStr, rows);
    if (this.wantSingle) {
      const one = rows[0] ?? null;
      return { ...ok(one, this.countMode ? matched.length : null), error: one == null && this.wantSingle === "single" ? { message: "No rows found", code: "PGRST116" } : null };
    }
    return ok(rows, this.countMode ? matched.length : null);
  }

  // Thenable so `await supabase.from(...)...` resolves.
  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    try {
      return Promise.resolve(this.run()).then(resolve, reject);
    } catch (e) {
      return Promise.resolve({ data: null, error: e, count: null }).then(resolve, reject);
    }
  }
}

// ---- Auth surface -----------------------------------------------------------

const DEMO_USER = {
  id: DEMO_AGENT_ID,
  email: DEMO_EMAIL,
  user_metadata: { full_name: "Rajesh Kumar" },
  app_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};
const DEMO_SESSION = {
  access_token: "demo-playground-token",
  refresh_token: "demo-playground-refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: DEMO_USER,
};

const auth = {
  getSession: async () => ({ data: { session: DEMO_SESSION }, error: null }),
  getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
  onAuthStateChange: (cb: (event: string, session: any) => void) => {
    try { setTimeout(() => cb("SIGNED_IN", DEMO_SESSION), 0); } catch { /* ignore */ }
    return { data: { subscription: { unsubscribe() {} } } };
  },
  signInWithPassword: async () => ({ data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }),
  signUp: async () => ({ data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }),
  signOut: async () => { exitPlayground(); return { error: null }; },
  updateUser: async () => ({ data: { user: DEMO_USER }, error: null }),
  refreshSession: async () => ({ data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }),
  resetPasswordForEmail: async () => ({ data: {}, error: null }),
};

// ---- Storage surface (no-op) ------------------------------------------------

const storage = {
  from: () => ({
    upload: async () => ({ data: { path: "demo/uploaded.pdf", id: "demo", fullPath: "demo/uploaded.pdf" }, error: null }),
    createSignedUrl: async () => ({ data: { signedUrl: "#demo" }, error: null }),
    getPublicUrl: () => ({ data: { publicUrl: "#demo" } }),
    remove: async () => ({ data: [], error: null }),
  }),
};

// ---- Mock client ------------------------------------------------------------

const mockClient = {
  auth,
  storage,
  from: (table: string) => new QueryBuilder(table),
  rpc: async () => ok(null),
};

export function getMockClient() {
  return mockClient as any;
}

// ---- /api fetch stub --------------------------------------------------------
// Analyze/rerun/upload/compare flows POST to the backend. In playground we
// answer them locally with believable shapes so every flow completes without
// ever touching the real server.

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const demoUuid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Uploads in flight. The upload flow starts an analysis and then polls a job id
 * until it reports `completed`, so the mock has to remember the job long enough
 * to answer the poll and mark the policy done.
 */
const pendingJobs = new Map<string, { clientId: string }>();

/** Read a field off a FormData body without assuming one is present. */
function field(init: any, key: string): string | undefined {
  try {
    const body = init?.body;
    if (body && typeof body.get === "function") {
      const v = body.get(key);
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v && typeof v === "object" && "name" in v) return (v as File).name;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Route a simulated `/api/*` request to a canned response. */
function playgroundApiResponse(url: string, init?: any): Response {
  // Agency teams. Handled first because these are the only /api routes the
  // portal has that never fall back to supabase-js — without a mock they would
  // hit the generic "simulated" reply below, which reads as "you have no team"
  // and hides the whole feature from the demo.
  const team = playgroundTeamApi(url, init);
  if (team) return team;

  // Public advisor page (/a/<slug>), opened by My Page's Preview button. Without
  // this the generic reply below has no `live` field, so the page showed "no
  // longer active". Answers from the seeded row, so demo edits show up too.
  const advisorPage = url.match(/\/api\/p\/([^/?#]+)(\/[a-z]+)?/);
  if (advisorPage) {
    if (advisorPage[2] === "/lead") return json({ ok: true, files_saved: 0 });
    if (advisorPage[2]) return new Response(null, { status: 204 });
    const slug = decodeURIComponent(advisorPage[1]);
    const row = getStore().agent_pages?.find((p) => p.slug === slug);
    if (!row) return json({ error: "not_found" }, 404);
    if (!row.enabled || !row.published) return json({ live: false, display_name: row.display_name });
    return json({
      live: true, slug: row.slug, display_name: row.display_name, photo_url: row.photo_url,
      city: row.city, languages: row.languages, lines_of_business: row.lines_of_business,
      primary_locale: row.primary_locale, whatsapp_number: row.whatsapp_number,
    });
  }

  // Analysis status poll — must be tested before /api/agent/analyze itself,
  // which is a prefix of this path.
  if (url.includes("/api/agent/analyze/status/")) {
    const jobId = url.split("/api/agent/analyze/status/")[1].split(/[?#]/)[0];
    const job = pendingJobs.get(jobId);
    if (job) {
      pendingJobs.delete(jobId);
      const row = getStore().clients.find((c) => c.id === job.clientId);
      if (row) Object.assign(row, buildUploadedPolicy(job.clientId, row));
    }
    return json({ status: "completed", clientId: job?.clientId ?? null });
  }

  if (url.includes("/api/agent/analyze")) {
    const clientId = demoUuid("demo-policy");
    const jobId = demoUuid("demo-job");
    // Land it in the list as "processing" straight away, so My Queue and the
    // dashboard reflect the upload while the card is still spinning.
    getStore().clients.unshift({
      ...buildUploadedPolicy(clientId, {
        policyholder_name: field(init, "policyholder_name"),
        insurance_type: field(init, "type"),
        filename: field(init, "file"),
      }),
      status: "processing",
      score: null,
      report_data: null,
    });
    pendingJobs.set(jobId, { clientId });
    return json({ clientId, jobId, success: true });
  }

  /* Saving the reviewed data-entry fields. Without this the PATCH fell through
     to the generic "simulated" reply below: the form said "Details saved", then
     reloaded from a store nothing had written to and every field the user had
     just corrected reverted in front of them. */
  const extracted = url.match(/\/api\/agent\/clients\/([^/]+)\/extracted-data/);
  if (extracted) {
    const clientId = decodeURIComponent(extracted[1]);
    let patch: Record<string, any> = {};
    try {
      patch = JSON.parse(init?.body ?? "{}").extracted_data ?? {};
    } catch {
      /* ignore */
    }
    const row = getStore().clients.find((c) => c.id === clientId);
    if (row) {
      // Merge, so the keys the form does not render (the add-on scan, the
      // charge table) survive a save of the ones it does. The save revision
      // moves on as it does on the real server, so the value card's
      // conflict check behaves the same in the demo.
      const rest = { ...patch };
      delete rest._rev;
      const rev = Number.isInteger(row.extracted_data?._rev) ? row.extracted_data._rev : 0;
      row.extracted_data = { ...(row.extracted_data ?? {}), ...rest, _rev: rev + 1 };
    }
    return json({ ok: true, extracted_data: row?.extracted_data ?? patch, rev: row?.extracted_data?._rev ?? null });
  }

  /* Policy terms read from a document. The demo has no reader, so the savings
     policies start with the terms the general reader would return for them
     (./policyTermsSeed); that is what fills the Policy summary table. Review
     actions are applied in memory, the same way the server appends revisions. */
  const docRules = url.match(/\/api\/agent\/clients\/([^/]+)\/document-rules(?:\/(review|flags|parse|confirm-many))?/);
  if (docRules) {
    const id = decodeURIComponent(docRules[1]);
    const st: any = getStore();
    st.documentRules = st.documentRules ?? buildDemoDocumentRules(st.clients);
    const cur = st.documentRules[id] ?? { parse: null, fields: [], history: {}, flagDecisions: {} };
    let body: any = {};
    try { body = JSON.parse(init?.body ?? "{}"); } catch { /* ignore */ }
    if (docRules[2] === "parse") return json({ ok: false, code: "demo", message: "Demo mode: documents are not read." });
    if (docRules[2] === "review") {
      const f = cur.fields.find((x: any) => x.field_key === body.field_key);
      if (!f) return json({ error: "field_not_found" }, 404);
      if (f.revision !== body.expected_revision) return json({ error: "stale", message: "This field changed since you opened it." }, 409);
      const next = {
        ...f, revision: f.revision + 1,
        state: body.action === "confirm" ? "reviewed" : body.action === "correct" ? "corrected" : "rejected",
        corrected_value: body.action === "correct" ? body.value : null, reason: body.reason ?? null, created_at: new Date().toISOString(),
      };
      cur.fields = cur.fields.map((x: any) => (x.field_key === f.field_key ? next : x));
      cur.history[f.field_key] = [...(cur.history[f.field_key] ?? [f]), next];
      st.documentRules[id] = cur;
      return json({ revision: next.revision, repeated: false });
    }
    if (docRules[2] === "confirm-many") {
      const items: any[] = Array.isArray(body.items) ? body.items : [];
      for (const it of items) {
        const f = cur.fields.find((x: any) => x.field_key === it.field_key);
        if (!f || f.revision !== it.expected_revision) return json({ error: "stale", message: "This field changed since you opened it." }, 409);
      }
      for (const it of items) {
        const f = cur.fields.find((x: any) => x.field_key === it.field_key);
        const next = { ...f, revision: f.revision + 1, state: "reviewed", corrected_value: null, reason: null, created_at: new Date().toISOString() };
        cur.fields = cur.fields.map((x: any) => (x.field_key === f.field_key ? next : x));
        cur.history[f.field_key] = [...(cur.history[f.field_key] ?? [f]), next];
      }
      st.documentRules[id] = cur;
      return json({ confirmed: items.length, repeated: false });
    }
    if (docRules[2] === "flags") {
      cur.flagDecisions[body.flag_id] = { choice: body.choice, reason: body.reason ?? null };
      st.documentRules[id] = cur;
      return json({ repeated: false });
    }
    return json(cur);
  }

  /* The surrender-value book. The real route is scoped to the signed-in
     agent; the demo has one agent, so every life and term row is theirs. */
  if (url.includes("/api/agent/policy-values")) {
    const rows = getStore().clients
      .filter((c: any) => c.insurance_type === "life" || c.insurance_type === "term")
      .map((c: any) => ({
        id: c.id, name: c.name, policyholder_name: c.policyholder_name, insurer: c.insurer,
        policy_name: c.policy_name, insurance_type: c.insurance_type, status: c.status, extracted_data: c.extracted_data,
      }));
    return json({ rows });
  }

  // Plan Match on the demo calculator. The demo catalogue has cell points (0
  // to 3) per row and no cover-abroad row, so abroad always reads "confirm".
  if (url.includes("/api/agent/plan-match")) {
    let a: any = {};
    try { a = JSON.parse(init?.body ?? "{}").answers ?? {}; } catch { /* ignore */ }
    const conds = [...(a.preExistingConditions ?? []), ...(a.spousePreExistingConditions ?? [])].filter((c: string) => c && c !== "none");
    const needs = [
      a.globalTravel === "Yes, I travel abroad" && { key: "abroad", must: true, why: "travels abroad" },
      /Large|Premium/.test(a.hospitalPreference ?? "") && { key: "room", must: true, why: a.hospitalPreference },
      a.okWithDeductibles === false && { key: "deductible", must: true, why: "no deductible" },
      conds.length > 0 && { key: "ped", must: false, why: conds.join(", ") },
      { key: "cover", must: true, why: "recommended cover" },
    ].filter(Boolean) as { key: string; must: boolean; why: string }[];
    const cellIdx: Record<string, number> = { room: 0, deductible: 2, ped: 3 };
    const verdicts = DEMO_CATALOG.map((p) => {
      const ns = needs.map((n) => {
        if (n.key === "abroad") return { key: n.key, must: n.must, status: "unclear", detail: "Not in the demo catalogue" };
        if (n.key === "cover") return { key: n.key, must: n.must, status: "met", detail: p.sum_insured_options };
        const c = p.cells[cellIdx[n.key]];
        return { key: n.key, must: n.must, status: c[1] >= 2 ? "met" : "unmet", detail: c[0] };
      });
      const met = ns.filter((n) => n.status === "met").length;
      const completeness = Math.round((p.cells.reduce((s, c) => s + c[1], 0) / (p.cells.length * 3)) * 100);
      return { plan_key: p.uin, insurer: p.insurer, plan_name: p.plan_name, variant: "", completeness, fit: completeness, needs: ns, met, addons: 0, unclear: ns.filter((n) => n.status === "unclear").length, failed: ns.find((n) => n.must && n.status === "unmet") ?? null };
    }).sort((x, y) => y.met - x.met || y.fit - x.fit);
    const seen = new Set<string>();
    const picks = verdicts.filter((v) => !v.failed && !seen.has(v.insurer) && seen.add(v.insurer)).slice(0, 3);
    const pickKeys = new Set(picks.map((p) => p.plan_key));
    const why_not = verdicts.filter((v) => !pickKeys.has(v.plan_key)).map((v) => ({
      plan_key: v.plan_key, insurer: v.insurer, plan_name: v.plan_name, variant: "", completeness: v.completeness,
      kind: v.failed ? "fail" : "lower", need: v.failed, met: v.met, of: needs.length,
    }));
    return json({ source: "insurers", stars: 0, insurers: [...new Set(DEMO_CATALOG.map((p) => p.insurer))], unmatched: [], needs, picks, why_not, blocked: null });
  }
  // Top 3 and the advisor's preferred list. The demo catalogue carries cell
  // points (0 to 3), not wording profiles, so its "completeness" is the share
  // of points a plan earns. The list lives in memory for the demo session.
  if (url.includes("/api/compare/recommend")) {
    const plans = DEMO_CATALOG
      .filter((p) => demoPreferred.length === 0 || demoPreferred.includes(p.uin))
      .map((p) => ({
        plan_key: p.uin, uin: p.uin, variant: "", insurer: p.insurer, plan_name: p.plan_name,
        sum_insured_options: p.sum_insured_options,
        score: Math.round((p.cells.reduce((a, c) => a + c[1], 0) / (p.cells.length * 3)) * 100),
        strengths: p.cells.filter((c) => c[1] === 3).slice(0, 2).map((c) => c[0]),
        // Demo cells carry a value but no clause name, so a gap would read as a
        // bare "Not covered". Strengths read fine on their own.
        gaps: [] as string[],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return json({ source: demoPreferred.length ? "preferred" : "catalog", plans });
  }
  if (url.includes("/api/agent/preferred-plans")) {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST") {
      try {
        const key = JSON.parse(init?.body ?? "{}").plan_key;
        if (key && !demoPreferred.includes(key)) demoPreferred.push(key);
      } catch { /* ignore */ }
    } else if (method === "DELETE") {
      const key = decodeURIComponent(url.split("/api/agent/preferred-plans/")[1] ?? "");
      demoPreferred = demoPreferred.filter((k) => k !== key);
    }
    return json({ plan_keys: demoPreferred });
  }
  if (url.includes("/api/compare/catalog")) return json({ policies: DEMO_CATALOG });
  if (url.includes("/api/compare/from-catalog")) {
    let uins: string[] = [];
    try {
      uins = JSON.parse(init?.body ?? "{}").uins ?? [];
    } catch {
      /* ignore */
    }
    return json({ result: buildCatalogComparison(uins) });
  }
  if (url.includes("/api/agent/compare")) return json(DEMO_COMPARE_RESPONSE);
  if (url.includes("/api/compare/save-report")) return json({ uuid: demoUuid("demo-compare"), success: true });
  if (url.includes("/api/calculator/save-report")) return json({ uuid: demoUuid("demo-calc"), success: true });
  return json({ ok: true, simulated: true, message: "Demo mode — this action is simulated and nothing was saved." });
}

let demoPreferred: string[] = [];

let fetchPatched = false;
export function installPlaygroundFetch(): void {
  if (fetchPatched || typeof window === "undefined" || !window.fetch) return;
  fetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? "";
    // Asked per call, not once at install: the patch outlives the portal page
    // that installed it, and off the portal every request must be real.
    if (url && url.includes("/api/") && isPlaygroundMode()) {
      // Small delay so the "reading both wordings…" spinner reads as real work.
      if (url.includes("/api/compare/") || url.includes("/api/agent/compare")) {
        await new Promise((r) => setTimeout(r, 900));
      }
      return playgroundApiResponse(url, init);
    }
    return orig(input, init);
  };
}
