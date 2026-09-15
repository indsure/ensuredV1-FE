/**
 * Consistency of the signup -> profile insurer map.
 *
 * NO NETWORK, NO DATABASE. It reads the three source files as text and checks
 * they still agree, which is the failure this map is prone to: someone renames
 * an option in the profile selector, the map keeps pointing at the old string,
 * and the signup answer silently stops reaching the calculator again. That is
 * exactly the bug the map was written to fix, and nothing else would catch it
 * coming back.
 *
 * Run:  npx tsx --test backend/server/tests/insurerMap.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// import.meta.dirname is not populated under tsx here; derive it.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const MAP_FILE     = "frontend/client/src/lib/data/signup-insurer-map.ts";
const PROFILE_FILE = "frontend/client/src/pages/agent/MyProfile.tsx";
const SIGNUP_FILE  = "frontend/client/src/pages/agent/SignupStep2.tsx";
const ALIAS_FILE   = "frontend/client/src/lib/data/insurer-aliases.ts";

/** "a": "b" pairs inside SIGNUP_TO_PARTNER. */
function signupToPartner(): Array<[string, string]> {
  const src = read(MAP_FILE);
  const block = src.slice(src.indexOf("SIGNUP_TO_PARTNER"));
  const body = block.slice(block.indexOf("{") + 1, block.indexOf("};"));
  return [...body.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]);
}

/** The profile selector's option names: the vocabulary partnered_companies uses. */
function profileNames(): string[] {
  const src = read(PROFILE_FILE);
  const start = src.indexOf("const HEALTH_INSURANCE_COMPANIES");
  const body = src.slice(start, src.indexOf("\n];", start));
  return [...body.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
}

/** Everything SignupStep2 offers, across all three lines of business. */
function signupNames(): string[] {
  const src = read(SIGNUP_FILE);
  const start = src.indexOf("const INSURERS_BY_CATEGORY");
  const body = src.slice(start, src.indexOf("\n}", start));
  return [...body.matchAll(/'([^']{3,})'/g)].map((m) => m[1]);
}

describe("signup -> profile insurer map", () => {
  test("is not empty", () => {
    assert.ok(signupToPartner().length >= 7, "the map lost entries");
  });

  test("every key is a real signup option", () => {
    const offered = new Set(signupNames());
    for (const [from] of signupToPartner()) {
      assert.ok(offered.has(from), `map key "${from}" is not offered at signup any more`);
    }
  });

  test("every value is a real profile option", () => {
    // The one that actually bites. A profile rename makes the backfilled value
    // unselectable in the UI and unmatchable by the calculator, while the map
    // goes on looking correct.
    const valid = new Set(profileNames());
    for (const [from, to] of signupToPartner()) {
      assert.ok(valid.has(to), `"${from}" maps to "${to}", which is not a profile option`);
    }
  });

  test("every mapped partner resolves to a rider-DB company", () => {
    // If it does not, the calculator has the partner and still produces neutral
    // output, so the whole chain is pointless for that insurer.
    const aliases = read(ALIAS_FILE);
    for (const [, to] of signupToPartner()) {
      assert.ok(
        aliases.includes(`"${to}"`),
        `"${to}" appears in no INSURER_ALIASES entry, so the calculator cannot use it`
      );
    }
  });

  test("no life or general insurer is mapped", () => {
    // Guessing across lines of business is the specific mistake this map exists
    // to prevent: "SBI Life" is not "SBI Health Insurance".
    for (const [from] of signupToPartner()) {
      assert.ok(
        !/\bLife\b|\bGeneral\b/.test(from),
        `"${from}" is not a health insurer and must not be mapped to one`
      );
    }
  });
});
