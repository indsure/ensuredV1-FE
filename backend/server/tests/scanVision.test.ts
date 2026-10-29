/**
 * Gemini page read for scanned car policies: the parts that decide what is
 * sent and what is believed.
 *
 * NO NETWORK, NO DB, NO AI. The Gemini call itself is not exercised here;
 * these cover which pages would be paid for and how a reply is checked.
 * Run:
 *   npx tsx --test backend/server/tests/scanVision.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isMotorText, pickVisionPages, parseVisionReply, VISION_MAX_PAGES } from "../services/policyDocs/scanVision";

describe("isMotorText: only car and bike scans are sent", () => {
  test("a car schedule qualifies", () => {
    assert.equal(isMotorText("Registration No PB00X0000  Engine No ABC123  Chassis No XYZ  IDV 99,900"), true);
  });
  test("a health policy does not, even though it says premium", () => {
    assert.equal(isMotorText("Sum Insured 5,00,000. Premium 12,400. Room rent capped at 1% of sum insured."), false);
  });
  test("one motor word alone is not enough", () => {
    assert.equal(isMotorText("Personal accident cover for the owner-driver, own damage not applicable"), false);
  });
});

describe("pickVisionPages: only the add-on and premium pages are paid for", () => {
  // The shape of the real Universal Sompo scan (2026-10-28): page 2 carries
  // the add-on premium line, page 4 the premium details, page 5 the add-on
  // cover table that Tesseract read as 93 letters.
  const pages = [
    { index: 1, text: "Private Car Package Policy. Registration No. Engine No. Chassis No." },
    { index: 2, text: "A464orOB premiumfor | [Ad6: TOTAL ADD ONPREMIUM) | 73g" },
    { index: 3, text: "DISCLAIMER: Policy is valid subject to realization of premium. premium rates may change on renewal" },
    { index: 4, text: "PREMIUM DETAILS  OWN DAMAGE PREMIUM AFTER LOADING/DISCOUNT  TOTAL OWN DAMAGE PREMIUM" },
    { index: 5, text: "ADD-ON COVER DETAILS" },
  ];

  test("picks the add-on and premium pages, not the disclaimer page", () => {
    assert.deepEqual(pickVisionPages(pages), [2, 4, 5]);
  });

  test("never more than the cap, heaviest pages first, returned in page order", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      index: i + 1,
      text: i === 6 ? "Add-on cover: Zero Depreciation, Engine Protect. Total OD premium" : "add-on",
    }));
    const picked = pickVisionPages(many);
    assert.equal(picked.length, VISION_MAX_PAGES);
    assert.ok(picked.includes(7));
    assert.deepEqual(picked, [...picked].sort((a, b) => a - b));
  });

  test("no qualifying page means no call", () => {
    assert.deepEqual(pickVisionPages([{ index: 1, text: "Terms and conditions. Premium is payable in advance." }]), []);
  });
});

describe("parseVisionReply: a reply is used only when it is exactly what was asked", () => {
  test("reads the page JSON", () => {
    const got = parseVisionReply('{"pages":[{"page":5,"text":"Zero Depreciation | Yes | 1,240"}]}', [2, 5]);
    assert.deepEqual([...got!.entries()], [[5, "Zero Depreciation | Yes | 1,240"]]);
  });

  test("tolerates a fenced reply", () => {
    const got = parseVisionReply('```json\n{"pages":[{"page":2,"text":"Total add-on premium 285"}]}\n```', [2]);
    assert.equal(got!.get(2), "Total add-on premium 285");
  });

  test("a page that was never sent rejects the whole reply", () => {
    assert.equal(parseVisionReply('{"pages":[{"page":9,"text":"x"}]}', [2, 5]), null);
  });

  test("prose, a wrong shape, or only empty pages is no reply", () => {
    assert.equal(parseVisionReply("Here is the text of page 5: Zero Depreciation", [5]), null);
    assert.equal(parseVisionReply('{"text":"x"}', [5]), null);
    assert.equal(parseVisionReply('{"pages":[{"page":5,"text":"   "}]}', [5]), null);
  });

  test("NUL characters are stripped, as on every other text path", () => {
    const got = parseVisionReply('{"pages":[{"page":5,"text":"Zero\\u0000 Dep"}]}', [5]);
    assert.equal(got!.get(5), "Zero Dep");
  });
});
