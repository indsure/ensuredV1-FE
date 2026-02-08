
import * as fs from 'fs';
import * as path from 'path';

// Define types (simplified)
interface RawHospitalRecord {
    insurer_slug: string;
    record_index: number;
    raw_hospital_text: string;
}

const RAW_RECORDS_PATH = 'e:\\v2final\\server\\data\\insurance_networks\\insurance_hospital_raw_records.json';
const OUTPUT_PATH = 'e:\\v2final\\trace_output_cuttack.txt';

function traceCuttack() {
    console.log("Reading raw records...");
    const rawRecords: RawHospitalRecord[] = JSON.parse(fs.readFileSync(RAW_RECORDS_PATH, 'utf-8'));

    // Filter for Cuttack/Bhubaneshwar in Bajaj Allianz
    const targets = rawRecords.filter(r =>
        r.insurer_slug === 'bajaj_allianz' &&
        (r.raw_hospital_text.toLowerCase().includes('cuttack') || r.raw_hospital_text.toLowerCase().includes('bhubaneshwar'))
    );

    console.log(`Found ${targets.length} records for Cuttack/Bhubaneshwar.`);

    let output = `--- TRACING CUTTACK/BHUBANESHWAR FOR BAJAJ ALLIANZ ---\n\n`;
    output += `Total Records Found: ${targets.length}\n\n`;

    // Dump the first 50 records to see if they are "merged" (too long) or normal
    output += `--- RAW RECORDS SAMPLE ---\n`;

    // Sort by length to find potentially merged records (longest first)
    targets.sort((a, b) => b.raw_hospital_text.length - a.raw_hospital_text.length);

    targets.slice(0, 50).forEach(r => {
        output += `[RECORD ${r.record_index}] (Length: ${r.raw_hospital_text.length})\n`;
        output += r.raw_hospital_text + "\n";
        output += `-------------------\n\n`;
    });

    fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
    console.log(`Trace output written to ${OUTPUT_PATH}`);
}

traceCuttack();
