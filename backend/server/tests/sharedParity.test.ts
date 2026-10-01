/**
 * The backend runs copies of the portal's pure modules (shared/), because the
 * frontend folder is not deployed to the server. They must stay identical.
 *
 * Run:  npx tsx --test backend/server/tests/sharedParity.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const norm = (s: string) => s.replace(/\r\n/g, "\n");

for (const f of ["policyNumbers.ts", "exactMath.ts", "policyDocTypes.ts", "documentRules.ts", "policyEvidence.ts", "productRules.ts"]) {
  test(`shared/${f} matches frontend/client/src/lib/${f}`, () => {
    const a = norm(fs.readFileSync(path.resolve(here, "../../../shared", f), "utf8"));
    const b = norm(fs.readFileSync(path.resolve(here, "../../../frontend/client/src/lib", f), "utf8"));
    assert.equal(a, b, `run: cp frontend/client/src/lib/${f} shared/${f}`);
  });
}
