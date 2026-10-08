/**
 * Continuous-cover inception from a renewal schedule.
 *
 * NO NETWORK, NO DB, NO GEMINI. Pure text over schedule excerpts.
 *
 * Why this file exists: a National Mediclaim renewal listed eleven previous
 * policies, oldest expiring 13/12/2014, so cover began 14/12/2013. The model
 * stored 2014 and the report showed a policy age one year short. Policy numbers
 * below are altered; the layout (shuffled order, junk bytes, a truncated last
 * line, proposal and receipt dates on the same page) is the real one.
 *
 * Run:  npx tsx --test backend/server/tests/renewalInception.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    deriveInceptionFromRenewalHistory,
    reconcileInceptionDate,
} from "../utils/renewalInception";

const NATIONAL_SCHEDULE = `
 : 14/12/2025  00:00  13/12/2026      /Policy Effective from 00:00 hours, on 14/12/2025 to
      / /                                    \` 0.00        / Proposal 8800999901761502  /Dt. 01/12/2025
                                             \` 0.00              / Receipt 240600819990004453 /Dt. 01/12/2025
      /Total Amount          \` 7,082.00                                                              240600509990002606/Dt.13/12/2025
                                                           Previous Policy Number and
                                                                                   Expiry Date
                             05/10/2004-21                                 Amount(\`)
/ Remarks: INSURED SAPERATED FROM POLICY NO. 240600509990002606 WITH ALL CONTINUITY BENEFITS AND CB.
PREVIOUS POLICY NOS. 240600509990002606
240600501599990211������/Dt.13/12/2016
24060048148599992010������/Dt.13/12/2015
26080048138599992005������/Dt.13/12/2014
240600501699992126������/Dt.13/12/2017
240600502399993207������/Dt.13/12/202
   01/December/2025
`;

const noteSink = () => {
    const notes: string[] = [];
    return { notes, push: (_p: any, msg: string) => { notes.push(msg); } };
};

describe("deriveInceptionFromRenewalHistory", () => {
    test("oldest previous expiry minus one year, from the real National layout", () => {
        const r = deriveInceptionFromRenewalHistory(NATIONAL_SCHEDULE, "2026-12-13");
        assert.ok(r);
        assert.equal(r.earliestExpiry, "2014-12-13");
        assert.equal(r.inception, "2013-12-14");
    });

    test("proposal, receipt and birth dates never count: wrong anniversary", () => {
        // Same page, no previous-policy lines on the current anniversary.
        const text = `Previous Policy Number: NIL
            Proposal 8800999901761502 /Dt. 01/12/2025
            Receipt 240600819990004453 /Dt. 01/12/2025
            DOB 05/10/2004`;
        assert.equal(deriveInceptionFromRenewalHistory(text, "2026-12-13"), null);
    });

    test("no renewal-history wording at all: nothing derived", () => {
        const text = `Policy 240600509990002606 /Dt.13/12/2014`;
        assert.equal(deriveInceptionFromRenewalHistory(text, "2026-12-13"), null);
    });

    test("an anniversary date with no policy number before it is ignored", () => {
        const text = `Previous policy details below.
            Printed on 13/12/2019 at the branch.`;
        assert.equal(deriveInceptionFromRenewalHistory(text, "2026-12-13"), null);
    });

    test("month-name dates are read too", () => {
        const text = `Preceding Policy No. 1234567890/00 expiry 31-Mar-2019
            Preceding Policy No. 1234567890/01 expiry 31-Mar-2021`;
        const r = deriveInceptionFromRenewalHistory(text, "2027-03-31");
        assert.ok(r);
        assert.equal(r.inception, "2018-04-01");
    });

    test("a ported policy on a different anniversary falls back to the model", () => {
        const text = `Previous policy 99887766554433 expired 05/06/2019 (ported)`;
        assert.equal(deriveInceptionFromRenewalHistory(text, "2026-12-13"), null);
    });

    test("no current expiry: nothing to anchor the anniversary, nothing derived", () => {
        assert.equal(deriveInceptionFromRenewalHistory(NATIONAL_SCHEDULE, null), null);
    });
});

describe("reconcileInceptionDate", () => {
    test("moves a late model date back and recomputes the age", () => {
        const parsed: any = {
            policy_timeline: {
                policy_inception_date: "2014-12-14",
                policy_expiry_date: "2026-12-13",
                policy_age_days: 4316,
            },
        };
        const sink = noteSink();
        const r = reconcileInceptionDate(parsed, NATIONAL_SCHEDULE, "2026-10-08", sink.push);
        assert.ok(r);
        assert.equal(parsed.policy_timeline.policy_inception_date, "2013-12-14");
        assert.equal(parsed.policy_timeline.policy_age_days, 4681);
        assert.equal(sink.notes.length, 1);
        assert.match(sink.notes[0], /2013-12-14 \(was 2014-12-14\)/);
    });

    test("fills a missing model date", () => {
        const parsed: any = { policy_timeline: { policy_inception_date: null, policy_expiry_date: "2026-12-13" } };
        const sink = noteSink();
        reconcileInceptionDate(parsed, NATIONAL_SCHEDULE, "2026-10-08", sink.push);
        assert.equal(parsed.policy_timeline.policy_inception_date, "2013-12-14");
    });

    test("never moves an earlier model date later (it may come from porting)", () => {
        const parsed: any = {
            policy_timeline: { policy_inception_date: "2010-01-01", policy_expiry_date: "2026-12-13", policy_age_days: 6125 },
        };
        const sink = noteSink();
        assert.equal(reconcileInceptionDate(parsed, NATIONAL_SCHEDULE, "2026-10-08", sink.push), null);
        assert.equal(parsed.policy_timeline.policy_inception_date, "2010-01-01");
        assert.equal(parsed.policy_timeline.policy_age_days, 6125);
        assert.equal(sink.notes.length, 0);
    });

    test("a model that already got it right is left alone, no note", () => {
        const parsed: any = { policy_timeline: { policy_inception_date: "2013-12-14", policy_expiry_date: "2026-12-13" } };
        const sink = noteSink();
        assert.equal(reconcileInceptionDate(parsed, NATIONAL_SCHEDULE, "2026-10-08", sink.push), null);
        assert.equal(sink.notes.length, 0);
    });

    test("no timeline object: no crash, no change", () => {
        const sink = noteSink();
        assert.equal(reconcileInceptionDate({}, NATIONAL_SCHEDULE, "2026-10-08", sink.push), null);
    });
});
