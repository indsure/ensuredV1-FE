/**
 * Pieces that keep the Baileys connection steady. Kept apart from baileys.ts so each one is
 * plain code with its own tests, no socket needed.
 *
 * - SendQueue: every outgoing message goes through ONE queue with a gap between sends, so a
 *   busy minute never looks like a spam burst to WhatsApp (the main ban risk), and a message
 *   sent during a short disconnect waits for the socket instead of failing.
 * - TtlCache: the small cache Baileys wants for counting message retries.
 * - SentStore: the last messages we sent, so when a phone asks for one again (it could not
 *   decrypt it, "Waiting for this message") Baileys can resend it.
 * - useSafeAuthState: the WhatsApp login files, written so a full disk or a crash mid-write
 *   can never leave a half-written creds.json (that happened on 7 Oct and logged the bot out).
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

/* ── Send queue ─────────────────────────────────────────────────────────── */

export type SendQueueOptions = {
  /** Smallest gap between two sends, in ms. */
  minGapMs: number;
  /** Extra random gap on top, 0..jitterMs, so sends are not machine-regular. */
  jitterMs: number;
  /** Resolves when the socket is open; rejects if it stays down past the caller's wait. */
  waitUntilReady: () => Promise<void>;
  /** A send still running after this long fails, so one stuck send cannot hold up every
   *  reply behind it. */
  sendTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
};

export class SendQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private lastSentAt = 0;
  private pending = 0;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(private readonly opts: SendQueueOptions) {
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? Date.now;
    this.random = opts.random ?? Math.random;
  }

  /** How many sends are waiting or running. */
  get size(): number {
    return this.pending;
  }

  /** Runs `send` after every earlier send has finished and the gap has passed. One failed
   *  send never blocks the ones behind it. */
  push<T>(send: () => Promise<T>): Promise<T> {
    this.pending++;
    const run = async () => {
      try {
        await this.opts.waitUntilReady();
        const gap = this.opts.minGapMs + Math.floor(this.random() * (this.opts.jitterMs + 1));
        const wait = this.lastSentAt + gap - this.now();
        if (wait > 0) {
          await this.sleep(wait);
          await this.opts.waitUntilReady(); // the socket may have dropped during the gap
        }
        try {
          return await this.limit(send());
        } finally {
          this.lastSentAt = this.now();
        }
      } finally {
        this.pending--;
      }
    };
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => {});
    return result;
  }

  private limit<T>(p: Promise<T>): Promise<T> {
    const ms = this.opts.sendTimeoutMs;
    if (!ms) return p;
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`send timed out after ${ms} ms`)), ms);
      p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  }
}

/* ── Retry counter cache ────────────────────────────────────────────────── */

/** Minimal in-memory cache with a time limit per key, shaped like Baileys' CacheStore. */
export class TtlCache {
  private readonly map = new Map<string, { v: unknown; until: number }>();

  constructor(private readonly ttlMs: number, private readonly maxKeys = 5000, private readonly now: () => number = Date.now) {}

  get<T>(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.until <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return e.v as T;
  }

  set<T>(key: string, value: T): void {
    this.map.delete(key);
    this.map.set(key, { v: value, until: this.now() + this.ttlMs });
    // Oldest first in a Map, so trimming from the front drops the stalest keys.
    while (this.map.size > this.maxKeys) this.map.delete(this.map.keys().next().value as string);
  }

  del(key: string): void {
    this.map.delete(key);
  }

  flushAll(): void {
    this.map.clear();
  }
}

/* ── Sent messages, for resend requests ─────────────────────────────────── */

export class SentStore<M> {
  private readonly cache: TtlCache;

  constructor(ttlMs = 24 * 60 * 60 * 1000, maxKeys = 1000, now: () => number = Date.now) {
    this.cache = new TtlCache(ttlMs, maxKeys, now);
  }

  remember(id: string | null | undefined, message: M | null | undefined): void {
    if (id && message) this.cache.set(id, message);
  }

  get(id: string | null | undefined): M | undefined {
    return id ? this.cache.get<M>(id) : undefined;
  }
}

/* ── Login files ────────────────────────────────────────────────────────── */

/** Writes `data` to `file` so a reader only ever sees the old file or the whole new one:
 *  write a temp file, flush it to disk, then rename over the old one. */
let tmpSeq = 0;
export async function writeFileAtomic(file: string, data: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${Date.now()}.${++tmpSeq}.tmp`;
  const fh = await fsp.open(tmp, "w", 0o600);
  try {
    await fh.writeFile(data);
    await fh.sync();
  } finally {
    await fh.close();
  }
  try {
    await fsp.rename(tmp, file);
  } catch (e) {
    await fsp.unlink(tmp).catch(() => {});
    throw e;
  }
}

/** The pieces of Baileys useSafeAuthState needs. Passed in so this file does not import the
 *  library (and the tests can run without it). */
export type AuthLib = {
  initAuthCreds: () => any;
  BufferJSON: { replacer: (k: string, v: any) => any; reviver: (k: string, v: any) => any };
  fromAppStateSyncKey: (v: any) => any;
};

const fixFileName = (file: string) => file.replace(/\//g, "__").replace(/:/g, "-");

/**
 * Same files and names as Baileys' useMultiFileAuthState (so the paired session on the server
 * loads unchanged), with two differences:
 * - every write is atomic (see writeFileAtomic), and each good creds.json is also kept as
 *   creds.json.bak;
 * - if creds.json cannot be read, it falls back to creds.json.bak instead of silently
 *   starting a NEW login (which needs someone with the phone to pair again).
 * Writes to one file run one at a time, in order.
 */
export async function useSafeAuthState(folder: string, lib: AuthLib, onWarn: (msg: string, meta?: Record<string, unknown>) => void = () => {}) {
  await fsp.mkdir(folder, { recursive: true, mode: 0o700 });
  const chains = new Map<string, Promise<unknown>>();
  const serial = <T>(file: string, job: () => Promise<T>): Promise<T> => {
    const prev = chains.get(file) ?? Promise.resolve();
    const next = prev.then(job, job);
    chains.set(file, next.catch(() => {}));
    return next;
  };
  const full = (file: string) => path.join(folder, fixFileName(file));

  const readJson = async (file: string): Promise<any | null> => {
    try {
      return JSON.parse(await fsp.readFile(full(file), "utf8"), lib.BufferJSON.reviver);
    } catch {
      return null;
    }
  };
  const writeJson = (file: string, data: unknown) =>
    serial(file, () => writeFileAtomic(full(file), JSON.stringify(data, lib.BufferJSON.replacer)));
  const remove = (file: string) => serial(file, () => fsp.unlink(full(file)).catch(() => {}));

  let creds = await readJson("creds.json");
  if (!creds) {
    const backup = await readJson("creds.json.bak");
    if (backup) {
      onWarn("creds.json unreadable, using creds.json.bak");
      creds = backup;
    } else if (fs.existsSync(full("creds.json"))) {
      onWarn("creds.json unreadable and no backup: a new pairing will be needed");
    }
  }
  creds = creds || lib.initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, any> = {};
          await Promise.all(ids.map(async (id) => {
            let value = await readJson(`${type}-${id}.json`);
            if (type === "app-state-sync-key" && value) value = lib.fromAppStateSyncKey(value);
            data[id] = value;
          }));
          return data;
        },
        set: async (data: Record<string, Record<string, unknown>>) => {
          const jobs: Array<() => Promise<unknown>> = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const file = `${category}-${id}.json`;
              jobs.push(() => (value ? writeJson(file, value) : remove(file)));
            }
          }
          // A fresh pairing writes ~800 keys at once; a few at a time stays under the
          // open-files limit (each write holds its file open until it is flushed).
          for (let i = 0; i < jobs.length; i += 32) await Promise.all(jobs.slice(i, i + 32).map((j) => j()));
        },
      },
    },
    saveCreds: async () => {
      await writeJson("creds.json", creds);
      // Only a creds.json that was just written in full becomes the backup.
      await serial("creds.json.bak", () => writeFileAtomic(full("creds.json.bak"), JSON.stringify(creds, lib.BufferJSON.replacer)));
    },
  };
}

const isGone = (e: any) => e?.code === "ENOENT";

/**
 * Copies the login folder to <folder>-backups/<YYYY-MM-DD>/, keeps the newest `keep` days.
 * Skips when today's copy exists or the folder is larger than `maxBytes` (the server disk
 * is small). Baileys deletes used keys while this runs, so a file that vanishes mid-copy is
 * simply left out.
 */
export async function snapshotAuthDir(
  folder: string,
  opts: { keep?: number; maxBytes?: number; today?: string } = {},
): Promise<{ dir: string } | { skipped: "exists" | "too_big"; bytes?: number }> {
  const keep = opts.keep ?? 3;
  const maxBytes = opts.maxBytes ?? 50 * 1024 * 1024;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const root = `${folder.replace(/[\\/]+$/, "")}-backups`;
  const dest = path.join(root, today);
  if (fs.existsSync(dest)) return { skipped: "exists" };

  const files: string[] = [];
  let total = 0;
  for (const d of await fsp.readdir(folder, { withFileTypes: true })) {
    if (!d.isFile() || d.name.endsWith(".tmp")) continue;
    try {
      total += (await fsp.stat(path.join(folder, d.name))).size;
      files.push(d.name);
    } catch (e) {
      if (!isGone(e)) throw e;
    }
  }
  if (total > maxBytes) return { skipped: "too_big", bytes: total };

  await fsp.mkdir(root, { recursive: true, mode: 0o700 });
  // Leftovers from a copy that was cut off (process restart) go first.
  for (const n of await fsp.readdir(root)) {
    if (n.endsWith(".partial")) await fsp.rm(path.join(root, n), { recursive: true, force: true });
  }
  const tmp = `${dest}.partial`;
  await fsp.mkdir(tmp, { mode: 0o700 });
  for (const f of files) {
    await fsp.copyFile(path.join(folder, f), path.join(tmp, f)).catch((e) => { if (!isGone(e)) throw e; });
  }
  await fsp.rename(tmp, dest);

  const days = (await fsp.readdir(root)).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  for (const old of days.slice(0, Math.max(0, days.length - keep))) {
    await fsp.rm(path.join(root, old), { recursive: true, force: true });
  }
  return { dir: dest };
}

/** Resolves with the promise's value, or with `fallback` if it takes longer than `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); });
  });
}
