/**
 * Re-read the identity fields of stored reports. DRY RUN BY DEFAULT.
 *
 * Two extraction bugs shipped wrong values into `clients.insurer` and
 * `clients.policy_name`:
 *
 *   - a bare substring match let the key `digit` fire inside "digitally
 *     signed", which is in the signature block of nearly every Indian policy
 *     PDF, so unlisted insurers were filed as Go Digit;
 *   - a capture group that allows spaces ran past the plan name into the next
 *     column's heading, so "India Plan" was stored as "India Plan  Tenure".
 *
 * Both are fixed in extractPolicyMetadata. This re-runs that function over the
 * stored source document and reports what would change.
 *
 * NO GEMINI. Neither field comes from the model on these rows: the plan name is
 * picked as `metadata.product || metadata.plan || coverage_structure.policy_name`
 * so the regex wins, and `identity.insurer_name` only exists from prompt 1.4.0
 * onward. Nothing the model produced is recomputed, so scores, findings and
 * waiting periods are untouched either way.
 *
 *   npx tsx backend/scripts/identity-backfill.ts            # dry run, writes nothing
 *   npx tsx backend/scripts/identity-backfill.ts --apply    # writes
 *   npx tsx backend/scripts/identity-backfill.ts --id <uuid>
 *
 * Rows whose `policy_name_source` is 'agent' are never renamed. A person set
 * that name, and the provenance column exists to stop a machine overwriting it.
 * --apply reports them as skipped so the decision stays visible.
 */

import "../server/loadEnv";
import { createClient } from "@supabase/supabase-js";
import pkg from "pg";

import { pgPoolConfig } from "../server/lib/db";
import { appearsInDocument, extractPolicyMetadata } from "../server/utils/policyWordingsFetcher";

const { Pool } = pkg;

const APPLY = process.argv.includes("--apply");
const ONLY_ID = (() => {
    const i = process.argv.indexOf("--id");
    return i > -1 ? process.argv[i + 1] : null;
})();

// Its own pool, not the app's shared one: importing that module would also
// start its idle-error handler and keep a connection open for the process life.
// Same config though, because Supabase's pooler presents a self-signed chain
// that a default `sslmode=require` now rejects.
const pool = new Pool(pgPoolConfig());

const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

interface Row {
    id: string;
    insurer: string | null;
    policy_name: string | null;
    policy_name_source: string | null;
    pdf_url: string | null;
}

/**
 * Storage paths have been written in three shapes over the life of the bucket:
 * a signed URL, a public URL, and (early rows) the bare object path. Take the
 * bucket and key from whichever this is.
 */
function storageRef(pdfUrl: string): { bucket: string; key: string } {
    const signed = pdfUrl.match(/\/storage\/v1\/object\/(?:sign|public)\/(.+?)(?:\?|$)/);
    const raw = signed ? signed[1] : pdfUrl.replace(/^\/+/, "").split("?")[0];
    if (/^https?:\/\//i.test(raw)) throw new Error("not a storage URL");
    const [bucket, ...rest] = raw.split("/");
    if (!bucket || !rest.length) throw new Error("unrecognised storage URL");
    return { bucket, key: rest.join("/") };
}

/**
 * Pull the document text back the same way the pipeline first read it.
 *
 * One document at a time, and each one released before the next is opened.
 * Holding them blew a 908MB box's memory and the OOM killer took the script,
 * which is why this is not something to run beside the live backend.
 */
async function textOf(pdfUrl: string): Promise<string> {
    const { bucket, key } = storageRef(pdfUrl);
    const { data, error } = await supabase.storage.from(bucket).download(key);
    if (error || !data) throw new Error(error?.message || "download returned nothing");

    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // pdf.js warns per embedded font it cannot map, dozens of times per policy,
    // which buries the only thing this script prints. The text layer is what we
    // want and it comes through regardless.
    const realWarn = console.warn;
    console.warn = () => {};
    const doc = await pdfjs.getDocument({
        data: new Uint8Array(await data.arrayBuffer()),
        disableFontFace: true,
    }).promise;
    try {
        let text = "";
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((it: any) => it.str).join(" ") + "\n";
            page.cleanup();
        }
        return text;
    } finally {
        await doc.destroy();
        console.warn = realWarn;
    }
}

const show = (v: string | null) => (v == null ? "(null)" : JSON.stringify(v));

(async () => {
    const rows: Row[] = (
        await pool.query(
            `SELECT id, insurer, policy_name, policy_name_source, pdf_url
               FROM clients
              WHERE insurance_type = 'health'
                AND status = 'done'
                AND pdf_url IS NOT NULL AND pdf_url <> ''
                ${ONLY_ID ? "AND id = $1" : ""}
              ORDER BY created_at`,
            ONLY_ID ? [ONLY_ID] : [],
        )
    ).rows;

    console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${rows.length} stored report(s) with a source document\n`);

    let changed = 0;
    let leftToAdvisor = 0;
    let refusedAsGuess = 0;
    let failed = 0;

    for (const row of rows) {
        let text: string;
        let meta;
        try {
            text = await textOf(row.pdf_url!);
            meta = await extractPolicyMetadata(text);
        } catch (err: any) {
            failed++;
            console.log(`${row.id}  COULD NOT READ: ${err?.message}`);
            continue;
        }

        const newInsurer = meta.insurer ?? null;
        const newPlan = meta.plan ?? null;

        // Never clear a value we already hold on the strength of a null. An
        // extractor that finds nothing has not disproved what is stored.
        const insurerMoves = !!newInsurer && newInsurer !== row.insurer;
        const planMoves = !!newPlan && newPlan !== row.policy_name;
        const planIsAgents = row.policy_name_source === "agent";

        // A name may replace a stored one only if the document names it in a
        // field. Two separate tests, because each catches what the other misses.
        //
        // The alias map is excluded by source. It fires on one matched word
        // anywhere in the text, and in this corpus it wanted to rewrite a Niva
        // Bupa "ReAssure 2.0" as Care Health's "Care Advantage". Its output can
        // still pass appearsInDocument, because the phrase it guessed may well
        // be somewhere in a hundred pages: a brand mentioned in a comparison
        // table, a portability clause, a footer. Present in the text is not the
        // same as named as this policy's plan. That is a new error dressed as a
        // correction, and a backfill is exactly where it would go unnoticed.
        //
        // appearsInDocument is the pipeline's own rule, kept for the readings:
        // a field can still be misparsed, and a value we cannot find in the
        // document has no business overwriting one a person may have checked.
        const planIsGuess =
            meta.planSource === null ||
            meta.planSource === "Alias Map Fallback" ||
            !appearsInDocument(newPlan, text);
        const planBlocked = planIsAgents || planIsGuess;

        if (!insurerMoves && !planMoves) continue;

        changed++;
        console.log(row.id);
        if (insurerMoves) {
            console.log(`   insurer  ${show(row.insurer)}  ->  ${show(newInsurer)}`);
        }
        if (planMoves) {
            const why = planIsAgents
                ? "   SKIPPED: set by the advisor, not by us"
                : planIsGuess
                  ? "   SKIPPED: a guess, not a reading"
                  : "";
            console.log(`   plan     ${show(row.policy_name)}  ->  ${show(newPlan)}${why}`);
            console.log(`   read from: ${meta.planSource ?? "nothing in the document"}`);
            if (planIsAgents) leftToAdvisor++;
            else if (planIsGuess) refusedAsGuess++;
        }

        if (APPLY) {
            const sets: string[] = [];
            const vals: any[] = [];
            if (insurerMoves) {
                sets.push(`insurer = $${sets.length + 1}`);
                vals.push(newInsurer);
            }
            if (planMoves && !planBlocked) {
                sets.push(`policy_name = $${sets.length + 1}`);
                vals.push(newPlan);
            }
            if (sets.length) {
                vals.push(row.id);
                await pool.query(`UPDATE clients SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);
                console.log("   written");
            } else {
                console.log("   nothing written for this row");
            }
        }
        console.log("");
    }

    console.log(
        `\n${changed} row(s) would change. ` +
            `${leftToAdvisor} plan name(s) left to the advisor, ` +
            `${refusedAsGuess} refused as a guess, ${failed} unreadable.`,
    );
    if (!APPLY && changed) console.log("Nothing was written. Re-run with --apply to commit.");

    await pool.end();
})();
