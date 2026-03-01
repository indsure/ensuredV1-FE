import * as fs from 'fs';
import * as path from 'path';

const RAW_RECORDS_PATH = 'e:\\v2final\\server\\data\\insurance_networks\\insurance_hospital_raw_records.json';
const NETWORKS_PATH = 'e:\\v2final\\server\\data\\insurance_networks\\insurance_hospital_networks.json';

function run() {
    console.log('--- TRACING 400067 FOR BAJAJ ALLIANZ ---');

    // 1. RAW / SEGMENTED
    let rawData;
    try {
        rawData = JSON.parse(fs.readFileSync(RAW_RECORDS_PATH, 'utf-8'));
    } catch (e) {
        console.error("Error reading raw records", e);
        return;
    }

    const rawMatches = rawData.filter((r: any) =>
        r.insurer_slug === 'bajaj_allianz' &&
        r.raw_hospital_text &&
        r.raw_hospital_text.includes('400067')
    );

    console.log(`\n[STEP 2: SEGMENTATION] Found ${rawMatches.length} raw records containing "400067".`);
    const rawNames = rawMatches.map((r: any) => {
        const firstLine = r.raw_hospital_text.split('\n')[0];
        return { index: r.record_index, firstLine, fullText: r.raw_hospital_text };
    });

    // 2. AGGREGATED / NETWORKS
    let networksData;
    try {
        networksData = JSON.parse(fs.readFileSync(NETWORKS_PATH, 'utf-8'));
    } catch (e) {
        console.error("Error reading networks data", e);
        return;
    }

    const networkMatches = networksData.filter((r: any) =>
        r.insurer_slug === 'bajaj_allianz' &&
        (String(r.pincode) === "400067")
    );

    console.log(`\n[STEP 6: AGGREGATION] Found ${networkMatches.length} final records with pincode 400067.`);

    // Write output to file
    const output = [
        '--- TRACING 400067 FOR BAJAJ ALLIANZ (POST-FIX) ---',
        `\n[STEP 2: SEGMENTATION] Found ${rawMatches.length} raw records containing "400067" (Should be > 21 if split correctly, or 21 if just cleaner).`,
        '\n--- COMPARISON ---',
        'Raw Records (First Line of Matches):',
        ...rawNames.map((r: any) => ` [${r.index}] ${r.firstLine}`),
        '\nFinal Records (Hospital Name) (NOTE: This will still be low until full pipeline is run):',
        ...networkMatches.map((r: any) => ` - ${r.hospital_name}`),
        '\n--- RAW TEXT OF MATCHES ---',
        ...rawNames.map((r: any) => `\n[RECORD ${r.index}]\n${r.fullText}\n-------------------`)
    ].join('\n');

    fs.writeFileSync('trace_output_fixed.txt', output, 'utf-8');
    console.log('Trace complete. Output written to trace_output_fixed.txt');
}

run();
