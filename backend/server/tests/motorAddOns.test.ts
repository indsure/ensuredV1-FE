/**
 * Motor add-on detection tests.
 *
 * NO NETWORK, NO DB, NO AI. Pure text in, findings out.
 *
 * The fixtures are two real policies, scrubbed of personal data with the field
 * SHAPES kept, because the field labels are themselves the traps:
 *   - motor_car_royal_sundaram.txt   declares its add-ons AND prices them
 *   - motor_bike_icici_lombard.txt   declares nothing and prices nothing
 *
 * Every assertion below corresponds to something that went wrong, or would have
 * gone wrong, on a real document. Run:
 *   npx tsx --test backend/server/tests/motorAddOns.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
    detectMotorAddOns,
    detectVehicleClass,
    ADD_ON_CATALOG,
    type AddOnScan,
} from "../../../shared/motorAddOns";

/* tsx runs this through its CJS transform, where import.meta.dirname is
   undefined but __dirname is real. Take whichever the runtime actually has. */
const HERE: string =
    typeof __dirname !== "undefined" ? __dirname : (import.meta as any).dirname;

const fixture = (name: string) => readFileSync(join(HERE, "fixtures", name), "utf-8");

const CAR = fixture("motor_car_royal_sundaram.txt");
const BIKE = fixture("motor_bike_icici_lombard.txt");

const scan = (t: string): AddOnScan => {
    const r = detectMotorAddOns(t);
    assert.ok(r, "expected a scan");
    return r;
};
const find = (s: AddOnScan, id: string) => {
    const f = s.findings.find((x) => x.id === id);
    assert.ok(f, `no finding for ${id}`);
    return f;
};

describe("car policy that carries add-ons (Royal Sundaram)", () => {
    const s = scan(CAR);

    test("reads as a car and finds both declaring channels", () => {
        assert.equal(s.vehicleClass, "car");
        assert.equal(s.declaredListFound, true);
        assert.equal(s.pricedLines.length, 6);
    });

    test("finds exactly the four the insurer says were opted", () => {
        const present = s.findings.filter((f) => f.state === "present").map((f) => f.id).sort();
        assert.deepEqual(present, [
            "consumables", "key_replacement", "roadside_assistance", "zero_depreciation",
        ]);
        assert.equal(s.present, 4);
        assert.equal(s.applicable, ADD_ON_CATALOG.car.length);
    });

    test("zero depreciation is found even though the words never appear", () => {
        // The single most important assertion in this file. "zero dep" occurs
        // ZERO times in this document; the insurer calls it "Depreciation
        // Waiver" and writes it as one CamelCase token in the opted list. The
        // obvious alias would have reported no zero-dep on a policy holding
        // UNLIMITED zero-dep worth Rs 4,394, the priciest line on the schedule.
        assert.equal(CAR.toLowerCase().includes("zero dep"), false);
        const z = find(s, "zero_depreciation");
        assert.equal(z.state, "present");
        assert.equal(z.amount, 4394);
        assert.match(z.evidence!, /Depreciation Waiver/);
    });

    test("every tick carries its amount and its line", () => {
        for (const f of s.findings.filter((x) => x.state === "present")) {
            assert.ok(f.evidence && f.evidence.length > 3, `${f.id} has no evidence`);
            assert.ok(typeof f.amount === "number" && f.amount > 0, `${f.id} has no amount`);
        }
    });

    test("'Engine No.' does not tick engine protection", () => {
        // Appears 3 times in this document. A bare `engine` alias ticks a cover
        // the customer never bought.
        assert.ok((CAR.match(/Engine No\./gi) ?? []).length >= 3);
        assert.notEqual(find(s, "engine_protect").state, "present");
    });

    test("'GST Invoice No.' does not tick return to invoice", () => {
        assert.match(CAR, /GST Invoice No\./i);
        assert.notEqual(find(s, "return_to_invoice").state, "present");
    });

    test("a cover priced at or below zero is never a tick", () => {
        // "Smart Save Pro" is priced -207.52 (a discount scheme) and "Smart Use"
        // 0.00 (bundled free). Both sit in the same table as the real add-ons.
        const names = s.pricedLines.map((p) => p.name).join(" | ");
        assert.match(names, /Smart Save Pro/);
        assert.match(names, /Smart Use/);
        assert.ok(s.pricedLines.some((p) => p.amount < 0));
        assert.ok(s.pricedLines.some((p) => p.amount === 0));
        // Neither is in the catalog, so neither reaches a finding at all.
        assert.equal(s.findings.filter((f) => f.state === "check_manually").length, 0);
    });

    test("the own-damage arithmetic reconciles to the rupee", () => {
        assert.deepEqual(s.arithmetic, { basicOd: 2594, totalOd: 7150, headroom: 4556 });
        assert.ok(s.reconciliation);
        assert.equal(s.reconciliation!.named, 5075.2);
        assert.equal(s.reconciliation!.ncb, -518.8);
        // Rounding only. Anything material here means the catalog has a hole.
        assert.ok(Math.abs(s.reconciliation!.unexplained) < 1, "add-on premium is unaccounted for");
    });

    test("the insurer's own opted list rules out what is not in it", () => {
        // "Add-on Covers Opted   Consumable, DepreciationWaiverPremium,
        // RoadSideAssistanceCover, KeyReplacementCover". That is the insurer
        // enumerating what was bought, so the rest was not bought. Filing them
        // as merely "not found" is what let a one-add-on policy score 100.
        const absent = s.findings.filter((f) => f.state === "absent_proven").map((f) => f.id).sort();
        assert.deepEqual(absent, [
            "engine_protect", "ncb_protect", "personal_belongings",
            "return_to_invoice", "tyre_protect",
        ]);
        for (const f of s.findings.filter((x) => x.state === "absent_proven")) {
            assert.match(f.evidence!, /Add-on Covers Opted/i, `${f.id} must cite the list`);
        }
    });

    test("the ARITHMETIC alone still never proves absence on a non-zero headroom", () => {
        // The other channel, pinned separately now that the declared list can
        // prove absence on its own. An add-on bundled at zero rupees leaves no
        // trace in the arithmetic and this document carries one ("Smart Use
        // ... 0"), so a reconciled non-zero headroom proves nothing by itself.
        // Strip the heading and the declared channel goes silent.
        const noList = CAR.replace(/Add-on Covers Opted/gi, "Cover Particulars");
        const bare = scan(noList);
        assert.equal(bare.declaredListFound, false);
        assert.ok(bare.arithmetic!.headroom > 0);
        assert.equal(bare.findings.some((f) => f.state === "absent_proven"), false);
    });

    test("the product's own footer UIN is not read as an add-on", () => {
        // IRDAN102RP0004V03201617 appears in the page footer as the policy's own
        // registration. Scanning the whole document instead of the own-damage
        // block turned it into a phantom priced line.
        assert.equal(s.pricedLines.some((p) => /GSTIN|PAN|amount may be/i.test(p.name)), false);
    });
});

describe("bike policy that carries none (ICICI Lombard)", () => {
    const s = scan(BIKE);

    test("reads as a bike and uses the two-wheeler catalog", () => {
        assert.equal(s.vehicleClass, "bike");
        assert.equal(s.applicable, ADD_ON_CATALOG.bike.length);
        assert.ok(s.findings.some((f) => f.id === "pillion_cover"));
        assert.equal(s.findings.some((f) => f.id === "key_replacement"), false);
    });

    test("neither declaring channel exists on this insurer", () => {
        // The word "add-on" appears zero times and the only UIN is the product's
        // own. A detector built on the car policy alone is useless here, which
        // is the whole reason the arithmetic channel exists.
        assert.equal(/add[\s-]?on/i.test(BIKE), false);
        assert.equal(s.declaredListFound, false);
        assert.equal(s.pricedLines.length, 0);
    });

    test("absence is proven by arithmetic, not assumed from silence", () => {
        assert.deepEqual(s.arithmetic, { basicOd: 556, totalOd: 556, headroom: 0 });
        assert.equal(s.present, 0);
        for (const f of s.findings) {
            assert.equal(f.state, "absent_proven", `${f.id} should be proven absent`);
            assert.match(f.evidence!, /556/);
        }
    });

    test("'Solo With Pillion' in the model name does not tick pillion cover", () => {
        // The Honda is sold as "ACTIVA 125 DISC OBD2B Solo With Pillion". That
        // is the seating variant, not a rider cover. Only a real bike policy
        // would have shown this one.
        assert.match(BIKE, /Solo With Pillion/i);
        assert.equal(find(s, "pillion_cover").state, "absent_proven");
    });

    test("'Additional Accessories' IDV headers do not tick accessories cover", () => {
        assert.match(BIKE, /Additional Accessories/i);
        assert.equal(find(s, "accessories_cover").state, "absent_proven");
    });
});

describe("guards", () => {
    test("a scanned or empty document yields nothing rather than a false zero", () => {
        // extractTextFromPDF treats under 200 characters as a scan. The card
        // must not render "0 of 9" for a document nobody could read.
        assert.equal(detectMotorAddOns(""), null);
        assert.equal(detectMotorAddOns("   "), null);
        assert.equal(detectMotorAddOns("Policy schedule"), null);
    });

    test("vehicle class defaults to car and never throws", () => {
        assert.equal(detectVehicleClass("private car package policy"), "car");
        assert.equal(detectVehicleClass("TWO WHEELER PACKAGE"), "bike");
        assert.equal(detectVehicleClass("Motor Cycle"), "bike");
        assert.equal(detectVehicleClass(""), "car");
    });

    test("no catalog entry uses a bare single word except where it is safe", () => {
        // "consumable" is the one word with no other meaning on a schedule.
        for (const [cls, entries] of Object.entries(ADD_ON_CATALOG)) {
            for (const e of entries) {
                for (const a of e.aliases) {
                    if (a === "consumable") continue;
                    assert.ok(
                        a.includes(" "),
                        `${cls}.${e.id} alias "${a}" is a bare word and will false-positive`
                    );
                }
            }
        }
    });
});

/* ── Acko ─────────────────────────────────────────────────────────────────
 * The third insurer, added after a real Acko scooter policy scored 100 out of
 * 100 on the strength of a single readable word.
 *
 * Acko prints neither of the two things the scanner originally relied on: no
 * "Add-on Covers Opted" heading and no own-damage premium breakdown. It writes
 * "Addons Selected" and follows it with prose, then runs straight into
 * "What's not covered". So the policy really did hold Consumables, and we
 * reported every add-on as absent.
 */
describe("Acko: a third way of declaring add-ons", () => {
  const text = fixture("motor_acko_scooter.txt");

  test("finds the add-on this policy actually holds", () => {
    const s = scan(text);
    const consumables = s.findings.find((f) => f.id === "consumables");
    assert.ok(consumables, "consumables must be in the catalog");
    assert.equal(consumables!.state, "present");
    assert.ok(s.declaredListFound, '"Addons Selected" must be read as a declared list');
  });

  test("does not swallow the exclusions that follow the list", () => {
    const s = scan(text);
    // "What's not covered" terminates the window. Without that, every phrase in
    // the exclusions arrives as an unrecognised add-on and the review queue
    // fills with noise.
    const noise = s.unrecognisedDeclared.join(" ").toLowerCase();
    assert.ok(!noise.includes("wear and tear"), "exclusions must not leak into the declared list");
    assert.ok(!noise.includes("tyres"), "exclusions must not leak into the declared list");
  });

  test("does not invent add-ons this policy does not have", () => {
    const s = scan(text);
    for (const id of ["zero_depreciation", "return_to_invoice", "engine_protect"]) {
      const f = s.findings.find((x) => x.id === id);
      assert.notEqual(f?.state, "present", `${id} is not on this policy and must not be reported`);
    }
  });
});
