import * as fs from 'fs';
import * as path from 'path';

// Official Indian states and UTs
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

interface RawHospitalRecord {
    insurer_slug: string;
    record_index: number;
    raw_hospital_text: string;
}

interface ExtractedHospitalRecord {
    insurer_slug: string;
    record_index: number;
    hospital_name: string | null;
    pincode: string | null;
    city: string | null;
    state: string | null;
    address: string | null;
    raw_hospital_text: string;
}

/**
 * Extract hospital name - first capitalized phrase before address tokens
 */
function extractHospitalName(text: string): string | null {
    const lines = text.split('\n');

    // Look for the first line that looks like a hospital name
    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        // Skip lines that start with address markers
        if (/^(Near|Opp|Behind|Beside|At|In|Plot|Road|Street|Floor|\d)/i.test(trimmed)) {
            continue;
        }

        // Skip city markers
        if (trimmed.startsWith('(City -')) {
            continue;
        }

        // If line contains " - " it's likely "Hospital Name - City"
        if (/ - /.test(trimmed)) {
            const parts = trimmed.split(' - ');
            return parts[0].trim();
        }

        // Otherwise, take the first substantial capitalized line
        if (/^[A-Z]/.test(trimmed) && trimmed.length > 5) {
            return trimmed;
        }
    }

    return null;
}

/**
 * Extract pincode - first valid 6-digit number
 */
function extractPincode(text: string): string | null {
    const matches = text.match(/\b[1-9]\d{5}\b/g);
    return matches ? matches[0] : null;
}

/**
 * Extract city - prefer (City - X) pattern, else nearest city-like token before state
 */
function extractCity(text: string): string | null {
    // First, try to find (City - X) pattern
    const cityMatch = text.match(/\(City\s*-\s*([^)]+)\)/i);
    if (cityMatch) {
        return cityMatch[1].trim();
    }

    // Fallback: look for city-like tokens before state mention
    // This is heuristic and may not be perfect
    const lines = text.split('\n');
    for (const line of lines) {
        // Look for patterns like "City, State"
        for (const state of INDIAN_STATES) {
            if (line.includes(state)) {
                // Extract the token before the state
                const beforeState = line.substring(0, line.indexOf(state));
                const tokens = beforeState.split(/[,\s]+/).filter(t => t.length > 2);
                if (tokens.length > 0) {
                    // Return the last substantial token before state
                    return tokens[tokens.length - 1].replace(/[,\s]+$/, '');
                }
            }
        }
    }

    return null;
}

/**
 * Extract state - match against official Indian state list
 */
function extractState(text: string): string | null {
    // Try exact match first
    for (const state of INDIAN_STATES) {
        if (text.includes(state)) {
            return state;
        }
    }

    // Try case-insensitive match
    const lowerText = text.toLowerCase();
    for (const state of INDIAN_STATES) {
        if (lowerText.includes(state.toLowerCase())) {
            return state;
        }
    }

    return null;
}

/**
 * Extract address - remainder text after hospital name
 */
function extractAddress(text: string, hospitalName: string | null): string | null {
    if (!hospitalName) {
        // If no hospital name, return the whole text as address
        return text.trim();
    }

    // Find where hospital name ends and extract everything after
    const nameIndex = text.indexOf(hospitalName);
    if (nameIndex === -1) {
        return text.trim();
    }

    const afterName = text.substring(nameIndex + hospitalName.length).trim();

    // Clean up the address
    return afterName || null;
}

/**
 * Extract all fields from a single hospital record
 */
function extractFields(record: RawHospitalRecord): ExtractedHospitalRecord {
    const text = record.raw_hospital_text;

    const hospitalName = extractHospitalName(text);
    const pincode = extractPincode(text);
    const city = extractCity(text);
    const state = extractState(text);
    const address = extractAddress(text, hospitalName);

    return {
        insurer_slug: record.insurer_slug,
        record_index: record.record_index,
        hospital_name: hospitalName,
        pincode: pincode,
        city: city,
        state: state,
        address: address,
        raw_hospital_text: text
    };
}

/**
 * Main extraction function
 */
async function extractAllFields() {
    console.log('Starting field extraction...\n');

    // Read raw records
    const rawRecordsPath = 'E:\\v2final\\server\\data\\insurance_networks\\insurance_hospital_raw_records.json';
    const rawRecords: RawHospitalRecord[] = JSON.parse(fs.readFileSync(rawRecordsPath, 'utf-8'));

    console.log(`Processing ${rawRecords.length} hospital records...\n`);

    const extractedRecords: ExtractedHospitalRecord[] = [];
    let processedCount = 0;

    for (const record of rawRecords) {
        const extracted = extractFields(record);
        extractedRecords.push(extracted);

        processedCount++;
        if (processedCount % 10000 === 0) {
            console.log(`  Processed ${processedCount} / ${rawRecords.length} records...`);
        }
    }

    // Write extracted records
    const outputPath = 'E:\\v2final\\server\\data\\insurance_networks\\insurance_hospitals_extracted.json';
    fs.writeFileSync(outputPath, JSON.stringify(extractedRecords, null, 2), 'utf-8');

    // Statistics
    const stats = {
        total: extractedRecords.length,
        with_hospital_name: extractedRecords.filter(r => r.hospital_name).length,
        with_pincode: extractedRecords.filter(r => r.pincode).length,
        with_city: extractedRecords.filter(r => r.city).length,
        with_state: extractedRecords.filter(r => r.state).length,
        with_address: extractedRecords.filter(r => r.address).length
    };

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Total records processed: ${stats.total}`);
    console.log('\nField extraction coverage:');
    console.log(`  Hospital Name: ${stats.with_hospital_name} (${(stats.with_hospital_name / stats.total * 100).toFixed(1)}%)`);
    console.log(`  Pincode: ${stats.with_pincode} (${(stats.with_pincode / stats.total * 100).toFixed(1)}%)`);
    console.log(`  City: ${stats.with_city} (${(stats.with_city / stats.total * 100).toFixed(1)}%)`);
    console.log(`  State: ${stats.with_state} (${(stats.with_state / stats.total * 100).toFixed(1)}%)`);
    console.log(`  Address: ${stats.with_address} (${(stats.with_address / stats.total * 100).toFixed(1)}%)`);
    console.log(`\n📄 Output saved to: ${outputPath}`);
    console.log('='.repeat(60));
}

// Run extraction
extractAllFields().catch(console.error);
