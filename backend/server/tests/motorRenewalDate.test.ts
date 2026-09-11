/**
 * Which date a motor policy renews on.
 *
 * Run:
 *   npx tsx --test backend/server/tests/motorRenewalDate.test.ts
 *
 * `clients.expiry_date` is the one date every renewal surface reads: the
 * policies list, the dashboard, Insights, the customer page and the team view.
 * On a bundled motor policy the own-damage cover ends after a year and the
 * third-party cover after three (private car) or five (two-wheeler), so the
 * single "policy expiry" the extractor used to capture could be either one.
 * Picking the third-party date means chasing a renewal that is not due and
 * missing the one that is, which costs the advisor the sale.
 *
 * These tests pin the preference order, and pin the fallback just as hard: a
 * document with no OD date, and every row written before this change, must
 * behave exactly as it did.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  deriveSharedColumns,
  buildExtractionPrompt,
  EXTRACTION_FIELDS,
} from "../services/extractionFields";

describe("motor renews on the own-damage date", () => {
  it("prefers the OD date over the generic policy expiry", () => {
    const out = deriveSharedColumns("motor", {
      policy_expiry_date: "2030-11-07", // third-party, five years out
      od_expiry_date: "2026-11-07",     // own damage, the one to chase
      tp_expiry_date: "2030-11-07",
    });
    assert.equal(out.expiry_date, "2026-11-07");
  });

  it("falls back to the policy expiry when no OD date was read", () => {
    const out = deriveSharedColumns("motor", { policy_expiry_date: "2026-11-07" });
    assert.equal(out.expiry_date, "2026-11-07");
  });

  it("treats an empty OD date as absent rather than overriding with nothing", () => {
    for (const empty of ["", null, undefined]) {
      const out = deriveSharedColumns("motor", {
        policy_expiry_date: "2026-11-07",
        od_expiry_date: empty,
      });
      assert.equal(out.expiry_date, "2026-11-07", `empty value ${String(empty)} must not win`);
    }
  });

  it("uses the OD date even when the generic expiry is missing entirely", () => {
    const out = deriveSharedColumns("motor", { od_expiry_date: "2026-11-07" });
    assert.equal(out.expiry_date, "2026-11-07");
  });

  it("does not apply the override to any other type", () => {
    // A life policy carrying a stray od_expiry_date must not have its maturity
    // date hijacked by a key that means nothing for it.
    const out = deriveSharedColumns("life", {
      maturity_date: "2040-01-01",
      od_expiry_date: "2026-11-07",
    });
    assert.equal(out.expiry_date, "2040-01-01");
  });
});

describe("the extractor is told to read both dates", () => {
  it("motor carries both fields in the registry", () => {
    const keys = EXTRACTION_FIELDS.motor.map((f) => f.key);
    assert.ok(keys.includes("od_expiry_date"));
    assert.ok(keys.includes("tp_expiry_date"));
  });

  it("the motor prompt explains the bundled case and forbids copying one into the other", () => {
    const prompt = buildExtractionPrompt("motor");
    assert.match(prompt, /od_expiry_date/);
    assert.match(prompt, /tp_expiry_date/);
    assert.match(prompt, /BUNDLED|LONG-TERM/);
    assert.match(prompt, /Never copy one into the other/);
  });

  it("no other type gets the motor rule", () => {
    for (const type of ["life", "term", "travel", "property", "fire", "marine"] as const) {
      assert.doesNotMatch(
        buildExtractionPrompt(type),
        /od_expiry_date/,
        `${type} should not carry the motor OD rule`,
      );
    }
  });
});
