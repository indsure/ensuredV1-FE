import * as fs from 'fs';
import * as path from 'path';

// Official Indian states and UTs for normalization
const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry', 'Pondicherry'
];

interface ExtractedRecord {
    insurer_slug: string;
    record_index: number;
    hospital_name: string | null;
    pincode: string | null;
    city: string | null;
    state: string | null;
    address: string | null;
    raw_hospital_text: string;
}

interface NormalizedRecord {
    insurer_slug: string;
    hospital_name: string;
    address: string;
    city: string | null;
    state: string | null;
    pincode: string | null;
    source_pdf: string;
}

/**
 * Normalize state to canonical spelling
 */
function normalizeState(state: string | null): string | null {
    if (!state) return null;

    // Direct match
    if (INDIAN_STATES.includes(state)) {
        return state;
    }

    // Case-insensitive match
    const lowerState = state.toLowerCase();
    for (const canonicalState of INDIAN_STATES) {
        if (canonicalState.toLowerCase() === lowerState) {
            return canonicalState;
        }
    }

    return state; // Return as-is if no match
}

/**
 * Normalize city to canonical spelling (basic cleanup)
 */
function normalizeCity(city: string | null): string | null {
    if (!city) return null;

    // Trim and remove extra whitespace
    let normalized = city.trim().replace(/\s+/g, ' ');

    // Remove common suffixes/prefixes
    normalized = normalized.replace(/^(City\s*-\s*)/i, '');
    normalized = normalized.replace(/\(City\s*-\s*/gi, '');
    normalized = normalized.replace(/\)$/g, '');

    // Capitalize first letter of each word
    normalized = normalized.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    return normalized;
}

/**
 * Normalize pincode - numeric, 6-digit only
 */
function normalizePincode(pincode: string | null): string | null {
    if (!pincode) return null;

    // Remove non-digits
    const digits = pincode.replace(/\D/g, '');

    // Must be exactly 6 digits
    if (digits.length !== 6) return null;

    // Must start with 1-9
    if (!/^[1-9]/.test(digits)) return null;

    return digits;
}

/**
 * Clean hospital name - trim, remove suffix noise
 */
function cleanHospitalName(name: string | null): string | null {
    if (!name) return null;

    let cleaned = name.trim();

    // Remove trailing dashes and whitespace
    cleaned = cleaned.replace(/[\s\-]+$/, '');

    // Remove common noise patterns
    cleaned = cleaned.replace(/\(City\s*-.*$/i, '');
    cleaned = cleaned.replace(/,\s*$/, '');

    // Remove if it's just a location marker
    if (/^(City|Near|Opp|Behind|Beside|At|In|Plot|Road|Street)/i.test(cleaned)) {
        return null;
    }

    return cleaned.trim();
}

/**
 * Clean address
 */
function cleanAddress(address: string | null): string {
    if (!address) return '';

    let cleaned = address.trim();

    // Remove leading dashes
    cleaned = cleaned.replace(/^[\s\-]+/, '');

    return cleaned;
}

/**
 * Normalize a single record
 */
function normalizeRecord(record: ExtractedRecord): NormalizedRecord | null {
    const hospitalName = cleanHospitalName(record.hospital_name);
    const pincode = normalizePincode(record.pincode);
    const city = normalizeCity(record.city);
    const state = normalizeState(record.state);
    const address = cleanAddress(record.address);

    // Drop records with no city AND no pincode
    if (!city && !pincode) {
        return null;
    }

    // Drop records with no hospital name
    if (!hospitalName) {
        return null;
    }

    // Generate source_pdf from insurer_slug
    const sourcePdf = `${record.insurer_slug}.pdf`;

    return {
        insurer_slug: record.insurer_slug,
        hospital_name: hospitalName,
        address: address,
        city: city,
        state: state,
        pincode: pincode,
        source_pdf: sourcePdf
    };
}

/**
 * Main normalization function
 */
async function normalizeAllRecords() {
    console.log('Starting normalization and cleaning...\n');

    // Read extracted records
    const extractedPath = 'E:\\v2final\\server\\data\\insurance_networks\\insurance_hospitals_extracted.json';
    const extractedRecords: ExtractedRecord[] = JSON.parse(fs.readFileSync(extractedPath, 'utf-8'));

    console.log(`Processing ${extractedRecords.length} extracted records...\n`);

    const normalizedRecords: NormalizedRecord[] = [];
    let droppedCount = 0;
    let processedCount = 0;

    for (const record of extractedRecords) {
        const normalized = normalizeRecord(record);

        if (normalized) {
            normalizedRecords.push(normalized);
        } else {
            droppedCount++;
        }

        processedCount++;
        if (processedCount % 10000 === 0) {
            console.log(`  Processed ${processedCount} / ${extractedRecords.length} records...`);
        }
    }

    // Write normalized records
    const outputPath = 'E:\\v2final\\server\\data\\insurance_networks\\insurance_hospital_networks.json';
    fs.writeFileSync(outputPath, JSON.stringify(normalizedRecords, null, 2), 'utf-8');

    // Statistics
    const stats = {
        total_input: extractedRecords.length,
        total_output: normalizedRecords.length,
        dropped: droppedCount,
        with_city: normalizedRecords.filter(r => r.city).length,
        with_state: normalizedRecords.filter(r => r.state).length,
        with_pincode: normalizedRecords.filter(r => r.pincode).length,
        with_all_fields: normalizedRecords.filter(r => r.city && r.state && r.pincode).length
    };

    // Breakdown by insurer
    const byInsurer: { [key: string]: number } = {};
    for (const record of normalizedRecords) {
        byInsurer[record.insurer_slug] = (byInsurer[record.insurer_slug] || 0) + 1;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Normalization complete`);
    console.log(`\nInput: ${stats.total_input} records`);
    console.log(`Output: ${stats.total_output} records`);
    console.log(`Dropped: ${stats.dropped} records (${(stats.dropped / stats.total_input * 100).toFixed(1)}%)`);
    console.log('\nField coverage in final dataset:');
    console.log(`  City: ${stats.with_city} (${(stats.with_city / stats.total_output * 100).toFixed(1)}%)`);
    console.log(`  State: ${stats.with_state} (${(stats.with_state / stats.total_output * 100).toFixed(1)}%)`);
    console.log(`  Pincode: ${stats.with_pincode} (${(stats.with_pincode / stats.total_output * 100).toFixed(1)}%)`);
    console.log(`  All fields: ${stats.with_all_fields} (${(stats.with_all_fields / stats.total_output * 100).toFixed(1)}%)`);
    console.log('\nRecords by insurer:');
    for (const [slug, count] of Object.entries(byInsurer).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${slug}: ${count}`);
    }
    console.log(`\n📄 Output saved to: ${outputPath}`);
    console.log('='.repeat(60));
}

// Run normalization
normalizeAllRecords().catch(console.error);
