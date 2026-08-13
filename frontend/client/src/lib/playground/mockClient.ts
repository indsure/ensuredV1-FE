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
import { DEMO_AGENT_ID, DEMO_EMAIL, exitPlayground } from "./mode";

let store: Store | null = null;
function getStore(): Store {
  if (!store) store = buildSeed();
  return store;
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
    let out = rows;
    for (const o of this.orders) {
      out = [...out].sort((a, b) => {
        const av = a[o.col];
        const bv = b[o.col];
        if (av == null && bv == null) return 0;
        if (av == null) return o.nullsFirst ? -1 : 1;
        if (bv == null) return o.nullsFirst ? 1 : -1;
        if (av < bv) return o.ascending ? -1 : 1;
        if (av > bv) return o.ascending ? 1 : -1;
        return 0;
      });
    }
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

let fetchPatched = false;
export function installPlaygroundFetch(): void {
  if (fetchPatched || typeof window === "undefined" || !window.fetch) return;
  fetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? "";
    if (url && url.includes("/api/")) {
      // Small delay so the "reading both wordings…" spinner reads as real work.
      if (url.includes("/api/compare/") || url.includes("/api/agent/compare")) {
        await new Promise((r) => setTimeout(r, 900));
      }
      return playgroundApiResponse(url, init);
    }
    return orig(input, init);
  };
}
