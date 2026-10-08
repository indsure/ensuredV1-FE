/**
 * Recorded evidence: history kept, bad records refused, origin never upgraded.
 *
 * NO NETWORK, NO DB, NO MODEL CALL. Synthetic records only.
 *
 * Run:  npx tsx --test backend/server/tests/policyEvidence.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  activePayments, addPayment, addLoan, currentLoan, emptyEvidence, readEvidence, voidRecord,
} from "../../../frontend/client/src/lib/policyEvidence";

const pay = (dueDate: string, amount = 50000) => ({
  amount, currency: "INR" as const, dueDate, paidOn: dueDate, confirmation: "self_reported" as const, reference: null, note: null,
});

describe("payments", () => {
  test("a correction keeps the original record", () => {
    let ev = addPayment(emptyEvidence(), pay("2025-03-15", 5000), "2026-09-30");
    const wrong = ev.payments[0].id;
    ev = addPayment(ev, pay("2025-03-15", 50000), "2026-09-30", wrong);
    assert.equal(ev.payments.length, 2, "both the original and the correction are stored");
    const active = activePayments(ev);
    assert.equal(active.length, 1);
    assert.equal(active[0].amount, 50000);
  });

  test("removing a record is a void that supersedes it; the original stays", () => {
    let ev = addPayment(emptyEvidence(), pay("2025-03-15"), "2026-09-30");
    ev = voidRecord(ev, "payments", ev.payments[0].id, "2026-09-30", "entered on the wrong policy");
    assert.equal(ev.payments.length, 2);
    assert.equal(activePayments(ev).length, 0);
  });

  test("the writers never touch the store they were given", () => {
    const before = emptyEvidence();
    addPayment(before, pay("2025-03-15"), "2026-09-30");
    assert.equal(before.payments.length, 0);
  });

  test("a stored store survives a round trip through JSON", () => {
    const ev = addPayment(emptyEvidence(), pay("2025-03-15"), "2026-09-30");
    const back = readEvidence(JSON.parse(JSON.stringify(ev)));
    assert.deepEqual(back.issues, []);
    assert.equal(back.evidence.payments.length, 1);
  });
});

describe("readEvidence refuses, and reports, what is malformed", () => {
  test("bad records are dropped with a reason; good ones survive", () => {
    const { evidence, issues } = readEvidence({
      schema: 1,
      payments: [
        { id: "ok", enteredOn: "2026-09-30", amount: 50000, dueDate: "2025-03-15", paidOn: "2025-03-10" },
        { id: "bad-amount", enteredOn: "2026-09-30", amount: "about fifty", dueDate: "2025-03-15", paidOn: "2025-03-10" },
        { id: "bad-date", enteredOn: "2026-09-30", amount: 50000, dueDate: "15/03/2025", paidOn: "2025-03-10" },
      ],
    });
    assert.equal(evidence.payments.length, 1);
    assert.ok(issues.includes("payment_invalid"));
  });

  test("an unknown schema version is not read at all", () => {
    assert.deepEqual(readEvidence({ schema: 2, payments: [] }).issues, ["evidence_schema_unknown"]);
  });

  test("a premiums-paid-to date after its own statement date is refused", () => {
    const { evidence, issues } = readEvidence({
      schema: 1,
      quotes: [{ id: "q", enteredOn: "2026-09-30", quoteType: "premiums_paid_to", paidTo: "2027-01-01", quoteDate: "2026-09-30" }],
    });
    assert.equal(evidence.quotes.length, 0);
    assert.ok(issues.includes("quote_invalid"));
  });

  test("every record is the advisor's, whatever origin the blob claims", () => {
    const { evidence } = readEvidence({
      schema: 1,
      payments: [{ id: "x", enteredOn: "2026-09-30", amount: 50000, dueDate: "2025-03-15", paidOn: "2025-03-10", origin: "insurer", confirmation: "verified_by_insurer" }],
    });
    assert.equal(evidence.payments[0].origin, "agent_entered");
    assert.equal(evidence.payments[0].confirmation, "self_reported");
  });
});

describe("loans", () => {
  test("interest left blank is unknown, not zero", () => {
    const ev = addLoan(emptyEvidence(), {
      status: "outstanding", principal: 200000, interest: null, asOf: "2026-09-30",
      confirmation: "self_reported", reference: null, note: null,
    }, "2026-09-30");
    const back = readEvidence(JSON.parse(JSON.stringify(ev))).evidence;
    assert.equal(currentLoan(back)?.interest, null);
  });

  test("the newest dated loan record is the current one", () => {
    let ev = addLoan(emptyEvidence(), { status: "outstanding", principal: 200000, interest: 0, asOf: "2026-01-01", confirmation: "self_reported", reference: null, note: null }, "2026-01-02");
    ev = addLoan(ev, { status: "none", principal: 0, interest: 0, asOf: "2026-08-01", confirmation: "insurer_document", reference: "closure letter", note: null }, "2026-08-02");
    assert.equal(currentLoan(ev)?.status, "none");
  });
});
