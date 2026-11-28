/**
 * The storage folder walker that export, account deletion and the leftover
 * clean-up all share.
 *
 * Run:
 *   npx tsx --test backend/server/tests/storageWalk.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { companionUrls, listFolder, type ListableStorage } from "../services/storageWalk";

/** A fake bucket: a flat list of keys, answered one folder level at a time,
 *  with a page cap below what the caller asks for (as real servers may do). */
function fakeStorage(keys: string[], pageCap = 2, failOn?: string): ListableStorage & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    from() {
      return {
        async list(prefix, { offset }) {
          calls.push(`${prefix}@${offset}`);
          if (failOn && prefix === failOn) return { data: null, error: { message: "boom" } };
          const names = new Map<string, boolean>(); // name -> isFolder
          for (const k of keys) {
            if (!k.startsWith(prefix + "/")) continue;
            const rest = k.slice(prefix.length + 1).split("/");
            names.set(rest[0], rest.length > 1 || names.get(rest[0]) === true);
          }
          const all = [...names.entries()].sort(([a], [b]) => a.localeCompare(b));
          const page = all.slice(offset, offset + pageCap).map(([name, folder]) => ({
            name,
            id: folder ? null : `id-${name}`,
            metadata: folder ? null : { size: name.length * 10 },
            updated_at: folder ? null : "2026-11-01T00:00:00Z",
          }));
          return { data: page, error: null };
        },
      };
    },
  };
}

const A = "11111111-2222-4333-8444-555555555555";

describe("listFolder", () => {
  it("finds every file, through folders and past a capped page size", async () => {
    const keys = [
      `${A}/a.pdf`, `${A}/b.pdf`, `${A}/c.pdf`, `${A}/d.pdf`, `${A}/e.pdf`,
      `${A}/claims/k1/case/x.pdf`, `${A}/lead-policies/y.jpg`,
      `${A}/.emptyFolderPlaceholder`,
      `OTHER/z.pdf`,
    ];
    const got = await listFolder(fakeStorage(keys), "b", A);
    assert.deepEqual(got.map((o) => o.key).sort(), keys.filter((k) => k.startsWith(A) && !k.endsWith("Placeholder")).sort());
    assert.equal(got.find((o) => o.key === `${A}/a.pdf`)?.size, 50);
    assert.equal(got[0].updatedAt, "2026-11-01T00:00:00Z");
  });

  it("throws when a listing fails, so callers can fall back", async () => {
    await assert.rejects(listFolder(fakeStorage([`${A}/claims/x.pdf`], 2, `${A}/claims`), "b", A));
  });

  it("stops at the object cap", async () => {
    const keys = Array.from({ length: 10 }, (_, i) => `${A}/f${i}.pdf`);
    const got = await listFolder(fakeStorage(keys), "b", A, { maxObjects: 3 });
    assert.equal(got.length, 3);
  });
});

describe("companionUrls", () => {
  it("returns the stored URL of each extra cover, and nothing for anything else", () => {
    assert.deepEqual(companionUrls({ __companions: [{ pdf_url: "u1" }, { pdf_url: null }, { kind: "x" }, { pdf_url: "u2" }] }), ["u1", "u2"]);
    assert.deepEqual(companionUrls(null), []);
    assert.deepEqual(companionUrls({ __companions: "nope" }), []);
  });
});
