/** The WhatsApp due-date list (edits.ts lifeDueDates) must be exactly the schedule the value
 *  engine counts payments against (frontend/client/src/lib/policyValue.ts). A payment booked on
 *  any other date covers nothing. Runs in this repo only (the server has no frontend). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { valuePolicy } from "../../../frontend/client/src/lib/policyValue";
import { lifeDueDates } from "../whatsapp/edits";

const AS_OF = "2026-10-22";
const freqs = ["Yearly", "annual", "Half-yearly", "semi annual", "Quarterly", "Monthly", "Single premium", "one time", "", "weird", null];
const starts = ["2010-01-31", "2016-02-29", "2020-10-01", "2026-10-22", "2027-01-01", "31/01/2010", "", null];
const terms: unknown[] = [null, "", 10, "20", 25, 0, 150, "15 years"];

test("WhatsApp's due dates == the value engine's schedule, for every mix of frequency, start and terms", () => {
  let n = 0;
  for (const premium_frequency of freqs) for (const start_date of starts) for (const policy_term_years of terms) for (const premium_paying_term_years of [null, 5, 30, "7"]) {
    const data: Record<string, any> = { premium: 25000, premium_frequency, start_date, policy_term_years, premium_paying_term_years };
    const dues = lifeDueDates(data, AS_OF);
    const v = valuePolicy("life", data, { asOf: AS_OF });
    if (dues === null) { assert.equal(v.payment.state, "schedule_unknown", JSON.stringify(data)); continue; }
    assert.notEqual(v.payment.state, "schedule_unknown", JSON.stringify(data));
    assert.equal(v.payment.dueInstalments, dues.length, JSON.stringify(data));
    // Every date offered is one the engine counts: paying all of them leaves no gap.
    const ev = { schema: 1, loans: [], quotes: [], payments: dues.map((d, i) => ({ id: `p${i}`, kind: "payment", enteredOn: AS_OF, origin: "agent_entered", confirmation: "self_reported", reference: null, note: null, supersedes: null, voided: false, amount: 25000, currency: "INR", dueDate: d, paidOn: d })) };
    const paid = valuePolicy("life", { ...data, value_evidence: ev }, { asOf: AS_OF });
    assert.equal(paid.payment.coveredInstalments, dues.length, JSON.stringify(data));
    n++;
  }
  assert.ok(n > 50, `enough real schedules checked (${n})`);
});
