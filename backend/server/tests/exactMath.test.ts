/**
 * Exact arithmetic and the formula tree.
 *
 * NO NETWORK, NO DB, NO MODEL CALL. Expected values are worked by hand.
 *
 * Run:  npx tsx --test backend/server/tests/exactMath.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  rat, add, sub, mul, div, cmp, eqR, parseDecimal, parsePercentText, toFixed,
  paiseFromRupeeText, rationalToPaiseFloor, formatRupees, bpsFromPercentText, ceilBps,
  num, v, op, evaluate, isExpr, describe as describeExpr,
} from "../../../frontend/client/src/lib/exactMath";

describe("fractions", () => {
  test("reduce and keep exact values", () => {
    assert.deepEqual(rat(6, 8), rat(3, 4));
    assert.ok(eqR(add(rat(1, 2), rat(2, 5)), rat(9, 10)));
    assert.ok(eqR(sub(rat(1, 2), rat(2, 5)), rat(1, 10)));
    assert.ok(eqR(mul(rat(2, 3), rat(9, 4)), rat(3, 2)));
    assert.ok(eqR(div(rat(1, 2), rat(1, 4)), rat(2)));
    assert.equal(cmp(rat(1, 3), rat(33, 100)), 1);
  });
  test("refuse division by zero", () => {
    assert.throws(() => rat(1, 0), /division_by_zero/);
    assert.throws(() => div(rat(1), rat(0)), /division_by_zero/);
  });
  test("parse only plain decimals and percentages", () => {
    assert.ok(eqR(parseDecimal("12.75")!, rat(51, 4)));
    assert.ok(eqR(parsePercentText("35%")!, rat(7, 20)));
    assert.equal(parseDecimal("1,000"), null);
    assert.equal(parsePercentText("35"), null);
    assert.equal(parsePercentText("3S%"), null);
  });
  test("display rounding is half away from zero", () => {
    assert.equal(toFixed(rat(39, 70), 6), "0.557143");
    assert.equal(toFixed(rat(-1, 8), 2), "-0.13");
  });
});

describe("money and rates", () => {
  test("rupee text to paise, exactly", () => {
    assert.deepEqual(paiseFromRupeeText("200,000.00"), { paise: 20000000 });
    assert.deepEqual(paiseFromRupeeText("3,380.00"), { paise: 338000 });
    assert.equal(paiseFromRupeeText("3,380.005"), null);
    assert.equal(paiseFromRupeeText("about 3,380"), null);
  });
  test("a calculated amount is never rounded up", () => {
    assert.deepEqual(rationalToPaiseFloor(rat(78000000, 70)), { paise: 111428571 });
    assert.equal(formatRupees({ paise: 50008000 }), "₹5,00,080");
    assert.equal(formatRupees({ paise: 338050 }), "₹3,380.50");
  });
  test("basis points and rounding up to 25 or 50", () => {
    assert.deepEqual(bpsFromPercentText("9.25%"), { bps: 925 });
    assert.deepEqual(bpsFromPercentText("9.255%"), null);
    // 6.81% + 150 bps = 831 bps, up to the next 25 = 850
    assert.deepEqual(ceilBps({ bps: 681 + 150 }, 25), { bps: 850 });
    // exactly on a step stays where it is
    assert.deepEqual(ceilBps({ bps: 825 }, 25), { bps: 825 });
    assert.deepEqual(ceilBps({ bps: 701 }, 50), { bps: 750 });
  });
});

describe("formula tree", () => {
  // 50% + 40% x (Policy Year - 7) / (Policy Term - 8), exactly as the clause prints it
  const ramp = op("add", num(rat(1, 2)),
    op("div", op("mul", num(rat(2, 5)), op("sub", v("policy_year"), num(rat(7)))), op("sub", v("policy_term"), num(rat(8)))));

  test("year 8 of 15 is exactly 0.5 + 0.4/7", () => {
    const r = evaluate(ramp, { policy_year: rat(8), policy_term: rat(15) });
    assert.ok(r.ok && eqR(r.value, add(rat(1, 2), rat(2, 35))));
    assert.ok(r.ok && eqR(r.value, rat(39, 70)));
  });

  test("year 13 of 15 is exactly 0.5 + 2.4/7", () => {
    const r = evaluate(ramp, { policy_year: rat(13), policy_term: rat(15) });
    assert.ok(r.ok && eqR(r.value, add(rat(1, 2), rat(12, 35))));
  });

  test("a term of 8 makes the denominator zero and is refused, not guessed", () => {
    const r = evaluate(ramp, { policy_year: rat(8), policy_term: rat(8) });
    assert.deepEqual(r, { ok: false, reason: "division_by_zero" });
  });

  test("a missing input is refused", () => {
    assert.deepEqual(evaluate(ramp, { policy_year: rat(8) }), { ok: false, reason: "missing_variable" });
  });

  test("a stored tree with anything unexpected is refused", () => {
    assert.equal(isExpr({ k: "eval", src: "process.exit()" }), false);
    assert.equal(isExpr({ k: "var", name: "constructor" }), false);
    assert.equal(isExpr({ k: "num", n: "1", d: "0" }), false);
    assert.equal(isExpr({ k: "add", args: [num(rat(1))] }), false);
    assert.deepEqual(evaluate({ k: "pow", args: [] } as any, {}), { ok: false, reason: "bad_tree" });
  });

  test("renders in plain words for review", () => {
    assert.equal(describeExpr(ramp), "50% + ((40% × (Policy Year - 7)) ÷ (Policy Term - 8))");
  });
});

describe("backend copy", () => {
  test("shared/exactMath.ts is byte-identical to the frontend module", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const norm = (s: string) => s.replace(/\r\n/g, "\n");
    const a = norm(fs.readFileSync(path.resolve(here, "../../../shared/exactMath.ts"), "utf8"));
    const b = norm(fs.readFileSync(path.resolve(here, "../../../frontend/client/src/lib/exactMath.ts"), "utf8"));
    assert.equal(a, b, "run: cp frontend/client/src/lib/exactMath.ts shared/exactMath.ts");
  });
});
