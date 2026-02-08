import * as fs from 'fs';
import * as path from 'path';

// Canonical insurer slugs
const INSURER_SLUGS = [
    'bajaj_allianz', 'galaxy_health', 'new_india', 'reliance', 'tata_aig',
    'hdfc_ergo', 'icici_lombard', 'star_health', 'niva_bupa', 'care_health',
    'kotak_general', 'aditya_birla', 'magma_hdi', 'universal_sompo', 'zuno', 'manipal_cigna'
];

interface HospitalRecord {
    insurer_slug: string;
    record_index: number;
    raw_hospital_text: string;
}

/**
 * Check if a line starts a new hospital record
 * A new hospital starts when the line contains " - " (hospital name - city pattern)
 * This is the most reliable indicator across all PDFs
 */
function isNewHospitalRecord(line: string): boolean {
    const trimmed = line.trim();

    // Empty lines don't start records
    if (!trimmed) {
        return false;
    }

    // Must start with capital letter
    if (!/^[A-Z]/.test(trimmed)) {
        return false;
    }

    // The most reliable pattern: "Hospital Name - City"
    // This appears in almost all hospital entries
    // Relaxed to allow for missing spaces (e.g. "Name-City")

    // CRITICAL FIX: Ignore "(City - Name)" pattern which looks like a separator
    // Use regex to be robust against spacing and casing
    if (/\(City\s*-/i.test(trimmed)) {
        return false;
    }

    // Exclude common address patterns that misleadingly look like headers
    // "Shop No. - 8"
    if (/^Shop\s*No/i.test(trimmed)) return false;
    // "Plot No - 170"
    if (/^Plot\s*No/i.test(trimmed)) return false;
    // "Llp) - "
    if (/^Llp\)/i.test(trimmed)) return false;
    // "Kandiwali West - " (Location posing as header)
    if (/^Kandiwali\s*West\s*-/i.test(trimmed)) return false;
    if (/^Kandivali\s*West\s*-/i.test(trimmed)) return false;

    // Check for separators
    // 1. " - " (Standard)
    // 2. "-[A-Z]" (Compact Name-City)
    // 3. "- [A-Z]" (Hyphen Space Name- City)
    // 4. " -$" or "-$" (Trailing hyphen)
    if (/(?: - |-[A-Z]|-\s[A-Z]| -$|-$)/.test(trimmed)) {
        return true;
    }

    // SPECIAL CASE FOR DROPPED RECORDS (e.g. Anurag Maternity)
    // Some records are just "Hospital Name\nAddress..." without a hyphen separator line.
    // If the line ends with "Nursing Home" or "Hospital" AND the next line (fetched via lookahead/context) looks like an address...
    // But we only have 'line' here. We need to be smarter.
    // However, if the line CONTAINS "Nursing Home" or "Hospital" and doesn't look like an address line...
    // Let's try to be conservative: records usually start with a name.

    // If line has no common address markers and ends in Hospital/Nursing Home/Clinic
    // AND is CamelCase/UPPERCASE
    // Relaxed to allow text AFTER the keyword (e.g. "Hospital Bhubaneswar" or "Hospital (Unit of...)")
    // Also allowed () in the name part
    // Suffix regex now includes & and ' and . to handle "Women & Children" etc.
    const isHospitalName = /^[A-Za-z0-9 .&'()]+(Hospital|Hospitals|Nursing Home|Clinic|Eye Care|Maternity|General Hospital|Medical Centre|Multi Speciality)(?:[\s,.-]+[A-Za-z0-9 ()&'.]+)?$/i.test(trimmed);

    // Fixed: 'In' and 'At' now require a following space to avoid matching "Institute" or "Atlas"
    // 'No.' matches 'No.' literal, so unlikely to match 'Nobel'
    const isAddressLine = /^(Near|Opp|Behind|Beside|At\s|In\s|Plot|Road|Street|Floor|Sector|Shop|Flat|House|No\.|S\.no)/i.test(trimmed);

    // Stricter length check prevents matching long paragraphs
    if (isHospitalName && !isAddressLine && trimmed.length > 5 && trimmed.length < 120) {
        // High confidence it's a name header
        return true;
    }

    return false;
}

/**
 * Segment raw text file into hospital records
 */
function segmentHospitalRecords(insurerSlug: string): HospitalRecord[] {
    const rawTextPath = path.join(
        'E:\\v2final\\server\\data\\insurance_networks\\raw_text',
        `${insurerSlug}.txt`
    );

    if (!fs.existsSync(rawTextPath)) {
        console.log(`⚠️  Skipping ${insurerSlug} - raw text file not found`);
        return [];
    }

    const content = fs.readFileSync(rawTextPath, 'utf-8');
    const lines = content.split('\n');

    const records: HospitalRecord[] = [];
    let currentRecord: string[] = [];
    let recordIndex = 0;

    for (const line of lines) {
        // Skip page delimiters
        if (line.trim().startsWith('--- PAGE')) {
            continue;
        }

        // Check if this line starts a new hospital record
        if (isNewHospitalRecord(line)) {
            // Save previous record if it exists
            if (currentRecord.length > 0) {
                const rawText = currentRecord.join('\n').trim();
                if (rawText && rawText.length > 10) {
                    records.push({
                        insurer_slug: insurerSlug,
                        record_index: recordIndex++,
                        raw_hospital_text: rawText
                    });
                }
            }

            // Start new record
            currentRecord = [line];
        } else if (line.trim()) {
            // Continue current record (only non-empty lines)
            currentRecord.push(line);
        }
    }

    // Save last record
    if (currentRecord.length > 0) {
        const rawText = currentRecord.join('\n').trim();
        if (rawText && rawText.length > 10) {
            records.push({
                insurer_slug: insurerSlug,
                record_index: recordIndex++,
                raw_hospital_text: rawText
            });
        }
    }

    return records;
}

/**
 * Main segmentation function
 */
async function segmentAllHospitals() {
    console.log('Starting hospital record segmentation...\n');

    const allRecords: HospitalRecord[] = [];
    const stats: { [key: string]: number } = {};

    for (const insurerSlug of INSURER_SLUGS) {
        console.log(`Processing: ${insurerSlug}...`);

        const records = segmentHospitalRecords(insurerSlug);
        allRecords.push(...records);
        stats[insurerSlug] = records.length;

        console.log(`  ✅ Segmented ${records.length} hospital records`);
    }

    // Write to JSON file
    const outputPath = 'E:\\v2final\\server\\data\\insurance_networks\\insurance_hospital_raw_records.json';
    fs.writeFileSync(outputPath, JSON.stringify(allRecords, null, 2), 'utf-8');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Total hospital records segmented: ${allRecords.length}`);
    console.log('\nBreakdown by insurer:');
    for (const [slug, count] of Object.entries(stats)) {
        console.log(`  ${slug}: ${count} records`);
    }
    console.log(`\n📄 Output saved to: ${outputPath}`);
    console.log('='.repeat(60));
}

// Run segmentation
segmentAllHospitals().catch(console.error);
