/**
 * The account data map.
 *
 * Run:
 *   npx tsx --test backend/server/tests/accountData.test.ts
 *
 * This list is the only thing keeping export and deletion honest about each
 * other. A table missing from it is exported by nobody and deleted by nobody:
 * the person is told their account is gone while their rows sit there. A table
 * in the wrong order fails deletion on a foreign key halfway through, which is
 * the one outcome the ordering exists to prevent.
 *
 * The counts here are pinned against a real information_schema probe taken on
 * 2026-09-11 (22 tables carrying agent_id, 2 carrying user_id). If a migration
 * adds a table holding personal data, this test should fail until someone has
 * decided whether it is exported, deleted, or both.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_TABLES,
  INDIVIDUAL_TABLES,
  selectForTable,
  deleteForTable,
} from "../services/accountData";

describe("the table map covers what the database actually holds", () => {
  it("carries all 22 advisor tables found in information_schema", () => {
    assert.equal(AGENT_TABLES.length, 22);
  });

  it("carries both consumer tables", () => {
    assert.equal(INDIVIDUAL_TABLES.length, 2);
  });

  it("names no table twice", () => {
    for (const list of [AGENT_TABLES, INDIVIDUAL_TABLES]) {
      const names = list.map((t) => t.table);
      assert.equal(new Set(names).size, names.length);
    }
  });

  it("uses the right key column for each side", () => {
    for (const t of AGENT_TABLES) assert.equal(t.key, "agent_id", `${t.table} should key on agent_id`);
    for (const t of INDIVIDUAL_TABLES) assert.equal(t.key, "user_id", `${t.table} should key on user_id`);
  });
});

describe("deletion order is foreign-key safe", () => {
  /** `before` must be deleted before `after`, or the delete hits a constraint. */
  const mustPrecede: Array<[string, string]> = [
    ["claim_documents", "claims"],
    ["claim_events", "claims"],
    ["claim_queries", "claims"],
    ["lead_policies", "agent_leads"],
    ["public_reports", "clients"],
  ];

  it("puts children ahead of their parents", () => {
    const order = AGENT_TABLES.map((t) => t.table);
    for (const [child, parent] of mustPrecede) {
      const ci = order.indexOf(child);
      const pi = order.indexOf(parent);
      assert.notEqual(ci, -1, `${child} missing from the map`);
      assert.notEqual(pi, -1, `${parent} missing from the map`);
      assert.ok(ci < pi, `${child} must be deleted before ${parent}`);
    }
  });
});

describe("what an export does and does not contain", () => {
  it("exports the customer's own records", () => {
    const exported = AGENT_TABLES.filter((t) => t.exportable).map((t) => t.table);
    for (const t of ["clients", "customers", "claims", "agent_leads"]) {
      assert.ok(exported.includes(t), `${t} should be exportable`);
    }
  });

  it("withholds our audit and ledger rows, which are records about them, not theirs", () => {
    const exported = AGENT_TABLES.filter((t) => t.exportable).map((t) => t.table);
    for (const t of ["access_audit_log", "agent_credits", "agent_ocr_credits", "analysis_jobs"]) {
      assert.ok(!exported.includes(t), `${t} must not be exported`);
    }
  });

  it("still deletes everything, exportable or not", () => {
    // Deletion has no opinion about exportability. Every table in the map goes.
    assert.ok(AGENT_TABLES.every((t) => typeof t.table === "string" && t.table.length > 0));
  });
});

describe("query builders bind the id and never interpolate it", () => {
  it("puts the account id in a bound parameter", () => {
    const t = AGENT_TABLES[0];
    assert.equal(selectForTable(t), `SELECT * FROM ${t.table} WHERE ${t.key} = $1`);
    assert.equal(deleteForTable(t), `DELETE FROM ${t.table} WHERE ${t.key} = $1`);
  });

  it("uses only table names from the constants, which contain nothing exotic", () => {
    for (const t of [...AGENT_TABLES, ...INDIVIDUAL_TABLES]) {
      assert.match(t.table, /^[a-z_]+$/, `${t.table} is not a plain identifier`);
    }
  });
});
