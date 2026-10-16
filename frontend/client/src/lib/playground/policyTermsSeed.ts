/**
 * Policy terms "read from the document" for the playground's savings policies.
 *
 * The demo has no document reader, so without this the Policy summary table
 * (premiums paid, surrender value now and at the next policy year, payouts,
 * maturity, life cover) never appeared on any demo policy, and the terms panel
 * said nothing had been read. These rows are what the general reader
 * (backend adapters/genericIllustration.ts) returns for a plan whose PDF
 * carries the year-by-year benefit illustration: the illustration rows, the
 * policy term, the premium paying term, the annualized premium and the start
 * date, each pending the advisor's review.
 *
 * The figures are synthetic and built from each policy's own seed row (premium,
 * term, sum assured, payouts, maturity), so the summary agrees with the details
 * form above it. Surrender value = a whole-percent factor of the premiums paid,
 * less the payouts already received, never below zero.
 *
 * The unit linked plan (no surrender column) and the pure term plan (no
 * surrender value at all) are left unread, as the general reader would refuse
 * both.
 */

import type { RulesResponse } from "@/components/agent/policyValue/useDocumentRules";

const PARSER = "general-benefit-illustration";
const PARSER_VERSION = "1.0.0";
const rs = (rupees: number) => ({ paise: Math.round(rupees) * 100 });

/** A plausible GSV factor (whole percent of premiums paid) for each policy year. */
function gsvPct(year: number, term: number): number {
  if (year <= 1) return 0;
  if (year === 2) return 30;
  if (year === 3) return 35;
  if (year >= term - 1) return 90;
  return Math.round(50 + (40 * (year - 4)) / Math.max(1, term - 5));
}

interface Plan {
  start: string;
  term: number;
  ppt: number;
  premium: number;
  survivalPerYear: number;
  maturity: number;
  death: number;
  page: number;
}

function illustration(p: Plan) {
  const rows = [];
  let paid = 0;
  let received = 0;
  for (let year = 1; year <= p.term; year++) {
    const premium = year <= p.ppt ? p.premium : 0;
    paid += premium;
    received += p.survivalPerYear;
    rows.push({
      year,
      premium: rs(premium),
      survival: rs(p.survivalPerYear),
      maturity: rs(year === p.term ? p.maturity : 0),
      death: rs(p.death),
      gsv: rs(Math.max(0, Math.floor((paid * gsvPct(year, p.term)) / 100) - received)),
    });
  }
  return rows;
}

function rules(id: string, p: Plan): RulesResponse {
  const created = "2026-10-01T10:00:00.000Z";
  const source = (excerpt: string | null, clause: string, page: number) => ({
    documentSha256: `demo-${id}`, pdfPage: page, printedPage: null, clause, excerpt,
    region: { x: 40, y: 120, w: 515, h: 560 }, method: "text", parser: PARSER, parserVersion: PARSER_VERSION,
  });
  const table = source("Benefit illustration: Policy Year | Premium | Survival Benefit | Maturity Benefit | Death Benefit | Guaranteed Surrender Value", "Benefit illustration", p.page);
  const rows = illustration(p);
  const found: [string, unknown, string, ReturnType<typeof source>][] = [
    ["illustration.rows", rows, "Policy Year | Premium | Survival Benefit | Maturity Benefit | Death Benefit | Guaranteed Surrender Value", table],
    ["schedule.policy_term_years", p.term, `Illustration years 1 to ${p.term}`, table],
    ["schedule.premium_paying_term_years", p.ppt, `Premium in illustration years 1 to ${p.ppt}`, table],
    ["schedule.annualized_premium", rs(p.premium), "Illustration, year 1 premium", table],
    ["schedule.commencement_date", p.start, `Date of Commencement of Policy: ${p.start.split("-").reverse().join("/")}`, source(null, "Policy schedule", 1)],
  ];
  return {
    parse: {
      id: `demo-parse-${id}`, status: "supported", reasons: [], adapter_id: PARSER, page_count: p.page + 2,
      page_methods: Array.from({ length: p.page + 2 }, (_, i) => ({ page: i + 1, method: "text", usable: true })),
      flags: [{
        id: "read_from_illustration", fieldKeys: ["illustration.rows"], choices: [], blocksCalculation: false,
        note: "Read by the general reader from the insurer's benefit illustration. Surrender values are the insurer's year-end figures; check them against the illustration.",
      }] as any,
    },
    fields: found.map(([field_key, value, raw, src]) => ({
      field_key: field_key as any, revision: 1, state: "document_pending" as const,
      document_field: { state: "found", value, raw, source: src }, corrected_value: null, reason: null, created_at: created,
    })),
    history: {},
    flagDecisions: {},
  };
}

/** Keyed by client id; each call builds a fresh copy, so review actions never touch the template. */
export function buildDemoDocumentRules(): Record<string, RulesResponse> {
  return {
    // Suresh's LIC Jeevan Anand: 21 years, premium every year, death cover 125% of the sum assured.
    "pol-8": rules("pol-8", { start: "2018-03-15", term: 21, ppt: 21, premium: 96400, survivalPerYear: 0, maturity: 2000000, death: 2500000, page: 6 }),
    // Anita's LIC New Endowment: 15 years, premium every year.
    "pol-14": rules("pol-14", { start: "2021-02-20", term: 15, ppt: 15, premium: 72000, survivalPerYear: 0, maturity: 1500000, death: 1875000, page: 5 }),
    // Prakash's HDFC Life Click 2 Achieve: 7 premiums, Rs 3,380 a month for 15 years, then the maturity amount.
    "pol-15": rules("pol-15", { start: "2024-03-04", term: 15, ppt: 7, premium: 200000, survivalPerYear: 3380 * 12, maturity: 1400000, death: 2000000, page: 7 }),
  };
}
