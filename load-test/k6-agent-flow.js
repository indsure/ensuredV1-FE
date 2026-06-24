/**
 * k6 load test — IndSure agent portal
 *
 * Simulates the real agent flow:
 *   1. Login via Supabase (get JWT)
 *   2. GET /api/agent/me
 *   3. GET /api/agent/summary/:agentId
 *   4. POST /api/agent/create-batch  (light — no file upload)
 *
 * Run:
 *   k6 run k6-agent-flow.js
 *
 * Ramp scenarios (edit --env flags or the options block below):
 *   Smoke  : 5 VUs, 1 min
 *   Load   : 50 VUs, 5 min
 *   Stress : ramp to 100, watch for errors
 *
 * Required env vars (pass with -e or export before running):
 *   AGENT_EMAIL     — a real agent login email
 *   AGENT_PASSWORD  — its password
 *   SUPABASE_URL    — e.g. https://xxxx.supabase.co
 *   SUPABASE_ANON   — anon/public key
 *   API_BASE        — e.g. http://51.21.168.103 or https://beta.indsure.in
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ─── custom metrics ──────────────────────────────────────────────────────────
const errorRate = new Rate("error_rate");
const loginDuration = new Trend("login_duration", true);
const meDuration = new Trend("me_duration", true);
const summaryDuration = new Trend("summary_duration", true);

// ─── scenario config ─────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: "1m", target: 50 },  // ramp up to 50 users
    { duration: "3m", target: 50 },  // hold at 50
    { duration: "1m", target: 0 },   // ramp down
  ],

  thresholds: {
    // fail the test if error rate > 5%
    error_rate: [{ threshold: "rate<0.05", abortOnFail: false }],
    // fail if p95 of /me calls > 2s
    me_duration: [{ threshold: "p(95)<2000", abortOnFail: false }],
    http_req_duration: [{ threshold: "p(95)<3000", abortOnFail: false }],
  },
};

// ─── helpers ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = __ENV.SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON = __ENV.SUPABASE_ANON || "YOUR_ANON_KEY";
const API_BASE = __ENV.API_BASE || "https://api.indsure.in";
const EMAIL = __ENV.AGENT_EMAIL || "deepshah399@gmail.com";
const PASSWORD = __ENV.AGENT_PASSWORD || "";

function login() {
  const start = Date.now();
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    {
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON,
      },
    }
  );
  loginDuration.add(Date.now() - start);

  const ok = check(res, {
    "login 200": (r) => r.status === 200,
    "has access_token": (r) => !!r.json("access_token"),
  });
  errorRate.add(!ok);
  if (!ok) return null;

  return {
    token: res.json("access_token"),
    userId: res.json("user.id"),
  };
}

function agentMe(token) {
  const start = Date.now();
  const res = http.get(`${API_BASE}/api/agent/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  meDuration.add(Date.now() - start);

  const ok = check(res, { "agent/me 200": (r) => r.status === 200 });
  errorRate.add(!ok);
  return ok ? res.json() : null;
}

function agentSummary(token, agentId) {
  const start = Date.now();
  const res = http.get(`${API_BASE}/api/agent/summary/${agentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  summaryDuration.add(Date.now() - start);

  const ok = check(res, { "summary 200": (r) => r.status === 200 });
  errorRate.add(!ok);
}

// ─── main VU loop ─────────────────────────────────────────────────────────────
export default function () {
  // Step 1 — login
  const session = login();
  if (!session) {
    sleep(2);
    return;
  }

  sleep(0.5); // simulate user landing on dashboard

  // Step 2 — fetch own profile
  const profile = agentMe(session.token);
  const agentId = profile?.agent?.id || session.userId;

  sleep(0.5);

  // Step 3 — fetch dashboard summary (the heavy DB read)
  agentSummary(session.token, agentId);

  sleep(1); // user reads the screen for ~1s before next action
}
