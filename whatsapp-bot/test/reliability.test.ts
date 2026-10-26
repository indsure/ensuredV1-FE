import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SendQueue, SentStore, TtlCache, snapshotAuthDir, useSafeAuthState, withTimeout, writeFileAtomic } from "../src/transport/reliability.js";

/** A fake clock: sleep() moves time forward instead of waiting. */
function clock() {
  let t = 1_000_000;
  const slept: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => { slept.push(ms); t += ms; },
    advance: (ms: number) => { t += ms; },
    slept,
  };
}

const lib = {
  initAuthCreds: () => ({ fresh: true, registered: false }),
  BufferJSON: { replacer: (_k: string, v: any) => v, reviver: (_k: string, v: any) => v },
  fromAppStateSyncKey: (v: any) => ({ wrapped: v }),
};

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "wa-rel-"));

test("send queue: sends run one at a time, in order, with the gap between them", async () => {
  const c = clock();
  const q = new SendQueue({ minGapMs: 700, jitterMs: 0, waitUntilReady: async () => {}, sleep: c.sleep, now: c.now, random: () => 0 });
  const order: string[] = [];
  await Promise.all(["a", "b", "c"].map((x) => q.push(async () => { order.push(x); })));
  assert.deepEqual(order, ["a", "b", "c"]);
  // The first send has nothing before it; the next two each wait the full gap.
  assert.deepEqual(c.slept, [700, 700]);
  assert.equal(q.size, 0);
});

test("send queue: the random extra gap is added on top of the minimum", async () => {
  const c = clock();
  const q = new SendQueue({ minGapMs: 700, jitterMs: 500, waitUntilReady: async () => {}, sleep: c.sleep, now: c.now, random: () => 0.999 });
  await q.push(async () => {});
  await q.push(async () => {});
  assert.deepEqual(c.slept, [1200]);
});

test("send queue: no extra wait when the last send was long ago", async () => {
  const c = clock();
  const q = new SendQueue({ minGapMs: 700, jitterMs: 0, waitUntilReady: async () => {}, sleep: c.sleep, now: c.now, random: () => 0 });
  await q.push(async () => {});
  c.advance(5000);
  await q.push(async () => {});
  assert.deepEqual(c.slept, []);
});

test("send queue: one failed send does not block the ones behind it", async () => {
  const c = clock();
  const q = new SendQueue({ minGapMs: 0, jitterMs: 0, waitUntilReady: async () => {}, sleep: c.sleep, now: c.now });
  const first = q.push(async () => { throw new Error("boom"); });
  const second = q.push(async () => "ok");
  await assert.rejects(first, /boom/);
  assert.equal(await second, "ok");
});

test("send queue: a send waits for the socket, and fails cleanly if it never comes back", async () => {
  let ready: () => void = () => {};
  let calls = 0;
  const q = new SendQueue({
    minGapMs: 0, jitterMs: 0,
    waitUntilReady: () => (++calls === 1 ? new Promise<void>((r) => { ready = r; }) : Promise.reject(new Error("whatsapp not connected"))),
  });
  let sent = false;
  const p = q.push(async () => { sent = true; });
  await new Promise((r) => setImmediate(r));
  assert.equal(sent, false, "nothing is sent while the socket is down");
  ready();
  await p;
  assert.equal(sent, true);
  await assert.rejects(q.push(async () => {}), /not connected/);
});

test("send queue: a send that never finishes fails after the time limit, the next one still goes", async () => {
  const q = new SendQueue({ minGapMs: 0, jitterMs: 0, waitUntilReady: async () => {}, sendTimeoutMs: 20 });
  const stuck = q.push(() => new Promise<void>(() => {}));
  const next = q.push(async () => "ok");
  await assert.rejects(stuck, /timed out/);
  assert.equal(await next, "ok");
});

test("send queue: checks the socket again after the gap, in case it dropped meanwhile", async () => {
  const c = clock();
  let checks = 0;
  const q = new SendQueue({ minGapMs: 700, jitterMs: 0, waitUntilReady: async () => { checks++; }, sleep: c.sleep, now: c.now, random: () => 0 });
  await q.push(async () => {});
  await q.push(async () => {});
  assert.equal(checks, 3, "first send: once; second send: before and after its gap");
});

test("ttl cache: values expire, and the oldest keys go first when full", () => {
  const c = clock();
  const cache = new TtlCache(1000, 2, c.now);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  assert.equal(cache.get("a"), undefined, "trimmed: over the key limit");
  assert.equal(cache.get("b"), 2);
  c.advance(1001);
  assert.equal(cache.get("b"), undefined, "expired");
  cache.set("d", 4);
  cache.del("d");
  assert.equal(cache.get("d"), undefined);
});

test("sent store: remembers a sent message by id for resend requests", () => {
  const s = new SentStore<{ conversation: string }>();
  s.remember("ABC", { conversation: "hello" });
  s.remember(undefined, { conversation: "ignored" });
  assert.deepEqual(s.get("ABC"), { conversation: "hello" });
  assert.equal(s.get("nope"), undefined);
  assert.equal(s.get(null), undefined);
});

test("atomic write leaves no temp file and replaces the old content", async () => {
  const dir = tmpDir();
  const f = path.join(dir, "creds.json");
  fs.writeFileSync(f, "old");
  await writeFileAtomic(f, "new");
  assert.equal(fs.readFileSync(f, "utf8"), "new");
  assert.deepEqual(fs.readdirSync(dir), ["creds.json"]);
});

test("auth state: reads the same file names Baileys writes, so the live pairing still loads", async () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "creds.json"), JSON.stringify({ registered: true, me: "x" }));
  fs.writeFileSync(path.join(dir, "session-91999__1.json"), JSON.stringify({ k: 1 }));
  fs.writeFileSync(path.join(dir, "app-state-sync-key-AAA.json"), JSON.stringify({ k: 2 }));
  const { state } = await useSafeAuthState(dir, lib);
  assert.deepEqual(state.creds, { registered: true, me: "x" });
  assert.deepEqual(await state.keys.get("session", ["91999/1"]), { "91999/1": { k: 1 } });
  assert.deepEqual(await state.keys.get("app-state-sync-key", ["AAA"]), { AAA: { wrapped: { k: 2 } } });
});

test("auth state: saving creds also keeps a backup, keys are written and removed", async () => {
  const dir = tmpDir();
  const { state, saveCreds } = await useSafeAuthState(dir, lib);
  state.creds.registered = true;
  await saveCreds();
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "creds.json"), "utf8")).registered, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "creds.json.bak"), "utf8")).registered, true);
  await state.keys.set({ "pre-key": { "5": { a: 1 } } });
  assert.ok(fs.existsSync(path.join(dir, "pre-key-5.json")));
  await state.keys.set({ "pre-key": { "5": null } });
  assert.ok(!fs.existsSync(path.join(dir, "pre-key-5.json")));
});

test("auth state: a fresh pairing's ~800 keys are all written", async () => {
  const dir = tmpDir();
  const { state } = await useSafeAuthState(dir, lib);
  const keys: Record<string, unknown> = {};
  for (let i = 1; i <= 812; i++) keys[String(i)] = { i };
  await state.keys.set({ "pre-key": keys });
  assert.equal(fs.readdirSync(dir).filter((f) => f.startsWith("pre-key-")).length, 812);
  assert.equal(fs.readdirSync(dir).filter((f) => f.endsWith(".tmp")).length, 0);
});

test("auth state: a broken creds.json falls back to the backup instead of a new pairing", async () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "creds.json"), '{"registered": tr'); // cut off mid-write
  fs.writeFileSync(path.join(dir, "creds.json.bak"), JSON.stringify({ registered: true }));
  const warnings: string[] = [];
  const { state } = await useSafeAuthState(dir, lib, (m) => warnings.push(m));
  assert.deepEqual(state.creds, { registered: true });
  assert.match(warnings[0], /creds\.json\.bak/);
});

test("auth state: broken creds and no backup warns loudly, then starts fresh", async () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "creds.json"), "{");
  const warnings: string[] = [];
  const { state } = await useSafeAuthState(dir, lib, (m) => warnings.push(m));
  assert.equal(state.creds.fresh, true);
  assert.match(warnings[0], /new pairing/);
});

test("auth state: an empty folder starts fresh without a warning (first pairing)", async () => {
  const warnings: string[] = [];
  const { state } = await useSafeAuthState(tmpDir(), lib, (m) => warnings.push(m));
  assert.equal(state.creds.fresh, true);
  assert.deepEqual(warnings, []);
});

test("login backup: one copy a day, keeps the newest three, skips a folder that is too big", async () => {
  const dir = tmpDir();
  const auth = path.join(dir, "wa-auth");
  fs.mkdirSync(auth);
  fs.writeFileSync(path.join(auth, "creds.json"), "{}");
  fs.writeFileSync(path.join(auth, "creds.json.1.2.tmp"), "half");
  const root = path.join(dir, "wa-auth-backups");
  fs.mkdirSync(path.join(root, "2026-10-19.partial"), { recursive: true }); // a copy cut off earlier
  for (const day of ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]) {
    assert.deepEqual(await snapshotAuthDir(auth, { today: day }), { dir: path.join(root, day) });
  }
  assert.deepEqual(await snapshotAuthDir(auth, { today: "2026-10-23" }), { skipped: "exists" });
  assert.deepEqual(fs.readdirSync(root).sort(), ["2026-10-21", "2026-10-22", "2026-10-23"], "old days and leftovers removed");
  assert.deepEqual(fs.readdirSync(path.join(root, "2026-10-23")), ["creds.json"], "temp files are not copied");
  assert.deepEqual(await snapshotAuthDir(auth, { today: "2026-10-24", maxBytes: 1 }), { skipped: "too_big", bytes: 2 });
});

test("withTimeout: a slow or failing promise gives the fallback", async () => {
  assert.equal(await withTimeout(new Promise<number>(() => {}), 10, 7), 7);
  assert.equal(await withTimeout(Promise.reject(new Error("x")), 1000, 7), 7);
  assert.equal(await withTimeout(Promise.resolve(3), 1000, 7), 3);
});
