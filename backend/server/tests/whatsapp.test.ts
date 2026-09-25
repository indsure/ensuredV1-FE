import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAnswerNumbers, numbersIn, parseIntent } from "../whatsapp/answerGuard";
import { normaliseWaNumber, resolveWaBotAgent, displayName } from "../whatsapp/routes";

const KEY = "k".repeat(40);

function req(over: any = {}) {
  return {
    method: "POST",
    route: { path: "/api/agent/analyze" },
    headers: { "x-wa-bot-key": KEY, "x-wa-agent-id": "not-a-uuid" },
    socket: { remoteAddress: "127.0.0.1" },
    ...over,
  };
}

test("number guard: numbers must come from the facts, digit for digit", () => {
  assert.deepEqual(numbersIn("₹1,50,000.00 and 10%"), ["150000", "10"]);
  const facts = { score: 65, room: { perDay: 5000 }, text: "₹40,000 on a ₹3L bill" };
  assert.deepEqual(checkAnswerNumbers("Room rent is ₹5,000 a day; score 65/100.", facts), { ok: true });
  assert.equal(checkAnswerNumbers("You would pay about ₹12,000 extra.", facts).ok, false);
  // lakh arithmetic is not understood on purpose
  assert.equal(checkAnswerNumbers("Cover is 5 lakh.", { base: 500000 }).ok, false);
});

test("model intent is clamped to the fixed list", () => {
  assert.equal(parseIntent("renewals"), "renewals");
  assert.equal(parseIntent("Share."), "share");
  assert.equal(parseIntent("delete_all_policies"), "unknown");
  assert.equal(parseIntent(""), "unknown");
});

test("WhatsApp numbers normalise to 91 + 10 digits", () => {
  assert.equal(normaliseWaNumber("98123 45678"), "919812345678");
  assert.equal(normaliseWaNumber("+91-98123-45678"), "919812345678");
  assert.equal(normaliseWaNumber("09812345678"), "919812345678");
  assert.equal(normaliseWaNumber("12345"), null);
});

test("bot auth: no bot headers means normal JWT auth", async () => {
  assert.equal(await resolveWaBotAgent({ headers: {}, method: "GET", route: { path: "/x" } }), undefined);
});

test("bot auth: refused off the two allowed routes, whatever the key", async () => {
  process.env.WA_BOT_KEY = KEY;
  assert.equal(await resolveWaBotAgent(req({ method: "DELETE", route: { path: "/api/agent/delete-client/:id" } })), null);
  assert.equal(await resolveWaBotAgent(req({ method: "GET", route: { path: "/api/agent/export" } })), null);
});

test("bot auth: refused on a wrong key, a short key, proxy headers, or a non-loopback socket", async () => {
  process.env.WA_BOT_KEY = KEY;
  assert.equal(await resolveWaBotAgent(req({ headers: { "x-wa-bot-key": "k".repeat(39) + "x", "x-wa-agent-id": "a" } })), null);
  assert.equal(await resolveWaBotAgent(req({ headers: { "x-wa-bot-key": KEY, "x-wa-agent-id": "a", "x-forwarded-for": "127.0.0.1" } })), null);
  assert.equal(await resolveWaBotAgent(req({ socket: { remoteAddress: "10.0.0.5" } })), null);
  process.env.WA_BOT_KEY = "short";
  assert.equal(await resolveWaBotAgent(req({ headers: { "x-wa-bot-key": "short", "x-wa-agent-id": "a" } })), null);
});

test("bot auth: a malformed agent id is refused before any database read", async () => {
  process.env.WA_BOT_KEY = KEY;
  assert.equal(await resolveWaBotAgent(req()), null);
});

test("routes over real HTTP: bot surface hides behind the key, portal routes need a JWT", async () => {
  const express = (await import("express")).default;
  const { registerWhatsappRoutes } = await import("../whatsapp/routes");
  process.env.WA_BOT_KEY = KEY;
  const app = express();
  app.use(express.json());
  registerWhatsappRoutes(app as any, async (_req: any, res: any) => { res.status(401).json({ error: "Missing authorization" }); return null; });
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    // No key, wrong key, or a proxied request: the internal surface does not exist.
    assert.equal((await fetch(`${base}/api/internal/wa/renewals`)).status, 404);
    assert.equal((await fetch(`${base}/api/internal/wa/renewals`, { headers: { "x-wa-bot-key": "nope" } })).status, 404);
    assert.equal((await fetch(`${base}/api/internal/wa/renewals`, { headers: { "x-wa-bot-key": KEY, "x-forwarded-for": "1.2.3.4" } })).status, 404);
    // Right key but no linked advisor id: refused before any data.
    assert.equal((await fetch(`${base}/api/internal/wa/renewals`, { headers: { "x-wa-bot-key": KEY, "x-wa-agent-id": "bad" } })).status, 403);
    // Phase 1b routes: right key, no linked advisor: refused before any data.
    for (const path of ["profile", "catalog", "leads", "calculator", "compare", "leads/search?q=ram", "followups", "lookup?q=ram", "views", "claims", "policies", "leads/00000000-0000-4000-8000-000000000000/update"]) {
      const method = ["leads", "calculator", "compare"].includes(path) || path.endsWith("/update") ? "POST" : "GET";
      assert.equal((await fetch(`${base}/api/internal/wa/${path}`, { method, headers: { "x-wa-bot-key": KEY, "x-wa-agent-id": "bad" } })).status, 403, path);
    }
    // Portal routes go through verifyJwt.
    assert.equal((await fetch(`${base}/api/agent/whatsapp`)).status, 401);
    assert.equal((await fetch(`${base}/api/agent/whatsapp/link-code`, { method: "POST" })).status, 401);
  } finally {
    server.close();
  }
});

test("plug-in OFF (no WA_BOT_KEY): no routes, auth hook steps aside, no limiter exemption", async () => {
  const express = (await import("express")).default;
  const { mountWhatsapp, whatsappBotAuth, isWaBotRequest } = await import("../whatsapp");
  delete process.env.WA_BOT_KEY;
  // Bot headers on a normal request fall through to ordinary JWT auth, exactly as if the
  // plug-in did not exist.
  assert.equal(await whatsappBotAuth(req({ headers: { "x-wa-bot-key": KEY, "x-wa-agent-id": "a" } })), undefined);
  assert.equal(isWaBotRequest(req()), false);
  const app = express();
  let jwtCalls = 0;
  mountWhatsapp(app as any, async () => { jwtCalls++; return null; });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    assert.equal((await fetch(`${base}/api/agent/whatsapp`)).status, 404);
    assert.equal((await fetch(`${base}/api/internal/wa/resolve`, { method: "POST" })).status, 404);
    assert.equal(jwtCalls, 0);
  } finally {
    server.close();
  }
});

test("display name: a saved file name is skipped in favour of the report's insured", () => {
  const report_data = { identity: { insured_names: ["Rajesh Iyer"] } };
  assert.equal(displayName({ policyholder_name: "Policy Kit PROHLV .pdf", report_data }), "Rajesh Iyer");
  assert.equal(displayName({ customer_name: "Sunita Rao", policyholder_name: "x.pdf", report_data }), "Sunita Rao");
  assert.equal(displayName({ policyholder_name: "Ramesh Kumar", report_data }), "Ramesh Kumar");
  assert.equal(displayName({ policyholder_name: "scan.PDF" }), null);
});
