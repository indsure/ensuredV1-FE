/**
 * The public share allowlist.
 *
 * Run:
 *   npx tsx --test backend/server/tests/dataEntryShare.test.ts
 *
 * These tests exist because the failure they guard against is silent and
 * public. `pickShareableFields` is the last thing standing between
 * `extracted_data` and an unauthenticated web page, and a regression there
 * publishes engine numbers, nominees and home addresses without erroring,
 * without logging, and without anyone noticing until a customer does.
 *
 * The forbidden-key test is deliberately written against a payload that
 * contains EVERY withheld key for EVERY type at once. A future field added to
 * the extraction registry is not covered by this file, which is precisely why
 * the implementation is an allowlist: an unknown key is dropped by default, and
 * the last test here proves that.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SHAREABLE_FIELDS,
  SHAREABLE_TYPES,
  isShareableType,
  pickShareableFields,
  hasShareableContent,
} from "../../../shared/dataEntryShare";

/** Every key that must never reach a browser, across all types. */
const FORBIDDEN = [
  "policy_number",
  "vehicle_registration_no",
  "engine_number",
  "chassis_number",
  "nominee_name",
  "life_assured_name",
  "traveller_names",
  "property_address",
  "risk_location",
  "project_site",
  "age_at_entry",
  "policy_parameters",
];

/** A row carrying every forbidden value, plus one field that IS publishable. */
function pollutedRow(): Record<string, unknown> {
  const row: Record<string, unknown> = { insurer: "Acme General" };
  for (const key of FORBIDDEN) row[key] = `SECRET-${key}`;
  return row;
}

describe("pickShareableFields withholds identifiers and third parties", () => {
  for (const type of SHAREABLE_TYPES) {
    it(`${type}: publishes no forbidden key`, () => {
      const out = pickShareableFields(type, pollutedRow());
      for (const key of FORBIDDEN) {
        assert.ok(!(key in out), `${type} leaked ${key}`);
      }
      // And it did produce something, so the test is not passing vacuously.
      assert.equal(out.insurer, "Acme General");
    });
  }

  it("no type's registry lists a forbidden key", () => {
    for (const type of SHAREABLE_TYPES) {
      for (const field of SHAREABLE_FIELDS[type]) {
        assert.ok(
          !FORBIDDEN.includes(field.key),
          `${type} registry lists forbidden key ${field.key}`,
        );
      }
    }
  });

  it("an unknown key is dropped, so a new extraction field is private by default", () => {
    const out = pickShareableFields("motor", {
      insurer: "Acme General",
      some_field_invented_next_year: "should not be published",
    });
    assert.ok(!("some_field_invented_next_year" in out));
  });
});

describe("pickShareableFields shape", () => {
  it("drops null, undefined and blank strings so no empty rows render", () => {
    const out = pickShareableFields("motor", {
      insurer: "Acme General",
      plan_name: null,
      coverage_type: undefined,
      make_and_model: "   ",
      premium: 0,
    });
    assert.deepEqual(Object.keys(out).sort(), ["insurer", "premium"]);
    // Zero is a real premium, not an absent one.
    assert.equal(out.premium, 0);
  });

  it("returns nothing for health, which uses the audit lane", () => {
    assert.deepEqual(pickShareableFields("health", { insurer: "Acme" }), {});
  });

  it("returns nothing for an unknown type or missing data", () => {
    assert.deepEqual(pickShareableFields("banana", { insurer: "Acme" }), {});
    assert.deepEqual(pickShareableFields("motor", null), {});
    assert.deepEqual(pickShareableFields("motor", undefined), {});
  });
});

describe("hasShareableContent gates the page", () => {
  it("is false when nothing publishable was read", () => {
    assert.equal(hasShareableContent("motor", { policy_number: "P-1", engine_number: "E-1" }), false);
    assert.equal(hasShareableContent("motor", {}), false);
    assert.equal(hasShareableContent("motor", null), false);
  });

  it("is true once one publishable field exists", () => {
    assert.equal(hasShareableContent("motor", { insurer: "Acme General" }), true);
  });

  it("is false for health, whose readiness is the audit report", () => {
    assert.equal(hasShareableContent("health", { insurer: "Acme General" }), false);
  });
});

describe("isShareableType", () => {
  it("accepts every data-entry type and rejects health and nonsense", () => {
    for (const type of SHAREABLE_TYPES) assert.equal(isShareableType(type), true);
    assert.equal(isShareableType("health"), false);
    assert.equal(isShareableType(null), false);
    assert.equal(isShareableType(undefined), false);
    assert.equal(isShareableType(""), false);
  });
});
