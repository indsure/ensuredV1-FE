/**
 * Insurer name -> metrics row matching for the compare page scorecard.
 *
 * NO NETWORK, NO DB, NO GEMINI. The fixture is invented test data with fake
 * insurer names and example.invalid sources; it lives only under tests and is
 * never imported by the app.
 *
 * Run:  npx tsx --test backend/server/tests/insurerMetrics.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeInsurerName, matchInsurer, usableMetric, sourceLabel, formatMetric,
  type InsurerMetricsDataset, type InsurerMetricsRow,
} from "../../../frontend/client/src/lib/insurerMetrics";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

const FAKE: InsurerMetricsDataset = readJson("backend/server/tests/fixtures/insurerMetrics.fake.json");
const SHIPPED: InsurerMetricsDataset = readJson("shared/data/insurerMetrics.json");

const nameOnly = (slug: string, name: string, aliases: string[] = []): InsurerMetricsRow =>
  ({ slug, name, aliases, csr: null, icr: null, grievances_per_10k: null });

describe("normalizeInsurerName", () => {
  test("drops case, punctuation and the generic company words", () => {
    assert.equal(normalizeInsurerName("HDFC ERGO General Insurance Co. Ltd."), "hdfcergo");
    assert.equal(normalizeInsurerName("hdfc ergo"), "hdfcergo");
    assert.equal(normalizeInsurerName("Niva Bupa Health Insurance Company Limited"), "nivabupa");
    assert.equal(normalizeInsurerName("Star Health & Allied Insurance Co. Ltd."), "star");
    assert.equal(normalizeInsurerName("Star Health and Allied Insurance"), "star");
    assert.equal(normalizeInsurerName("ManipalCigna Health Insurance"), "manipalcigna");
    assert.equal(normalizeInsurerName("Manipal Cigna"), "manipalcigna");
  });

  test("drops bracketed asides like a former name", () => {
    assert.equal(normalizeInsurerName("Niva Bupa Health Insurance (formerly Max Bupa)"), "nivabupa");
  });

  test("keeps life and india so different companies stay apart", () => {
    assert.notEqual(normalizeInsurerName("SBI General Insurance"), normalizeInsurerName("SBI Life Insurance"));
    assert.equal(normalizeInsurerName("The New India Assurance Co. Ltd."), "newindia");
  });

  test("a name made only of generic words reduces to nothing", () => {
    assert.equal(normalizeInsurerName("General Insurance Co. Ltd."), "");
  });
});

describe("matchInsurer", () => {
  test("matches the full legal name, an alias, and loose spellings of either", () => {
    assert.equal(matchInsurer("Fakeco Health Insurance Co. Ltd.", FAKE)?.slug, "fakeco-health");
    assert.equal(matchInsurer("FAKECO", FAKE)?.slug, "fakeco-health");
    assert.equal(matchInsurer("fakeco health insurance company limited", FAKE)?.slug, "fakeco-health");
    assert.equal(matchInsurer("Pretendia General Insurance Co. Ltd", FAKE)?.slug, "pretendia-general");
  });

  test("real insurer names match their dataset row across spellings", () => {
    const ds: InsurerMetricsDataset = {
      dataset_version: "test",
      insurers: [
        nameOnly("hdfc-ergo", "HDFC ERGO General Insurance Co. Ltd.", ["HDFC ERGO", "HDFC Ergo General"]),
        nameOnly("sbi-general", "SBI General Insurance Company Limited"),
      ],
    };
    assert.equal(matchInsurer("HDFC Ergo", ds)?.slug, "hdfc-ergo");
    assert.equal(matchInsurer("HDFC ERGO General Insurance Company Limited", ds)?.slug, "hdfc-ergo");
    assert.equal(matchInsurer("SBI General", ds)?.slug, "sbi-general");
    assert.equal(matchInsurer("SBI Life Insurance", ds), null);
  });

  test("no match, empty or null text gives null, never a guess", () => {
    assert.equal(matchInsurer("Some Other Insurer", FAKE), null);
    assert.equal(matchInsurer("Fake", FAKE), null);
    assert.equal(matchInsurer("", FAKE), null);
    assert.equal(matchInsurer(null, FAKE), null);
    assert.equal(matchInsurer(undefined, FAKE), null);
    assert.equal(matchInsurer("Insurance Co. Ltd.", FAKE), null);
  });

  test("a key that fits two different insurers gives null", () => {
    assert.equal(matchInsurer("Twin Dummy", FAKE), null);
  });

  test("the shipped placeholder matches nothing", () => {
    assert.deepEqual(SHIPPED.insurers, []);
    assert.equal(matchInsurer("Fakeco", SHIPPED), null);
  });
});

describe("usableMetric", () => {
  const fakeco = matchInsurer("Fakeco", FAKE);
  const pretendia = matchInsurer("Pretendia", FAKE);
  const unchecked = matchInsurer("Unchecked Mock Insurance", FAKE);

  test("returns a sourced, second-read number", () => {
    assert.equal(usableMetric(fakeco, "csr")?.value, 11.11);
    assert.equal(usableMetric(fakeco, "grievances_per_10k")?.value, 3.333);
  });

  test("null metric, unlinkable source, unverified row or no row give null", () => {
    assert.equal(usableMetric(pretendia, "icr"), null);
    assert.equal(usableMetric(pretendia, "grievances_per_10k"), null);
    assert.equal(usableMetric(unchecked, "csr"), null);
    assert.equal(usableMetric(null, "csr"), null);
  });
});

describe("display helpers", () => {
  test("source label names IRDAI once", () => {
    assert.equal(sourceLabel("IRDAI Annual Report 2023-24"), "IRDAI Annual Report 2023-24");
    assert.equal(sourceLabel("Handbook on Indian Insurance Statistics 2023-24"), "IRDAI, Handbook on Indian Insurance Statistics 2023-24");
  });

  test("numbers keep at most two decimals", () => {
    assert.equal(formatMetric(98.6), "98.6");
    assert.equal(formatMetric(3.333), "3.33");
    assert.equal(formatMetric(0), "0");
  });
});
