import * as fs from 'fs';
import * as path from 'path';

interface HospitalRecord {
    insurer_slug: string;
    hospital_name: string;
    address: string;
    city: string | null;
    state: string | null;
    pincode: string | null;
    source_pdf: string;
}

/**
 * Normalize hospital name for comparison (case-insensitive, trim whitespace)
 */
function normalizeForComparison(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Generate deduplication keys for a record
 */
function generateDeduplicationKeys(record: HospitalRecord): string[] {
    const keys: string[] = [];
    const normalizedName = normalizeForComparison(record.hospital_name);

    // Key 1: hospital_name + pincode
    if (record.pincode) {
        keys.push(`${normalizedName}|${record.pincode}`);
    }

    // Key 2: hospital_name + city
    if (record.city) {
        const normalizedCity = normalizeForComparison(record.city);
        keys.push(`${normalizedName}|${normalizedCity}`);
    }

    return keys;
}

/**
 * Deduplicate records within a single insurer
 */
function deduplicateInsurer(records: HospitalRecord[]): HospitalRecord[] {
    const seen = new Set<string>();
    const deduplicated: HospitalRecord[] = [];

    for (const record of records) {
        const keys = generateDeduplicationKeys(record);

        // Check if any of the keys have been seen
        let isDuplicate = false;
        for (const key of keys) {
            if (seen.has(key)) {
                isDuplicate = true;
                break;
            }
        }

        if (!isDuplicate) {
            // Add all keys to seen set
            for (const key of keys) {
                seen.add(key);
            }
            deduplicated.push(record);
        }
    }

    return deduplicated;
}

/**
 * Main deduplication function
 */
async function deduplicateAllRecords() {
    console.log('Starting deduplication...\n');

    // Read normalized records
    const normalizedPath = 'E:\\v2final\\server\\data\\insurance_networks\\insurance_hospital_networks.json';
    const allRecords: HospitalRecord[] = JSON.parse(fs.readFileSync(normalizedPath, 'utf-8'));

    console.log(`Processing ${allRecords.length} normalized records...\n`);

    // Group records by insurer
    const byInsurer: { [key: string]: HospitalRecord[] } = {};
    for (const record of allRecords) {
        if (!byInsurer[record.insurer_slug]) {
            byInsurer[record.insurer_slug] = [];
        }
        byInsurer[record.insurer_slug].push(record);
    }

    // Deduplicate within each insurer
    const deduplicatedRecords: HospitalRecord[] = [];
    const stats: { [key: string]: { before: number; after: number; removed: number } } = {};

    for (const [insurerSlug, records] of Object.entries(byInsurer)) {
        const beforeCount = records.length;
        const deduplicated = deduplicateInsurer(records);
        const afterCount = deduplicated.length;
        const removedCount = beforeCount - afterCount;

        deduplicatedRecords.push(...deduplicated);
        stats[insurerSlug] = {
            before: beforeCount,
            after: afterCount,
            removed: removedCount
        };

        console.log(`  ${insurerSlug}: ${beforeCount} → ${afterCount} (removed ${removedCount})`);
    }

    // Write deduplicated records
    const outputPath = 'E:\\v2final\\server\\data\\insurance_networks\\insurance_hospital_networks.json';
    fs.writeFileSync(outputPath, JSON.stringify(deduplicatedRecords, null, 2), 'utf-8');

    // Overall statistics
    const totalBefore = allRecords.length;
    const totalAfter = deduplicatedRecords.length;
    const totalRemoved = totalBefore - totalAfter;

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Deduplication complete`);
    console.log(`\nInput: ${totalBefore} records`);
    console.log(`Output: ${totalAfter} records`);
    console.log(`Removed: ${totalRemoved} duplicates (${(totalRemoved / totalBefore * 100).toFixed(1)}%)`);
    console.log('\nTop insurers by duplicates removed:');

    const sortedByRemoved = Object.entries(stats)
        .sort((a, b) => b[1].removed - a[1].removed)
        .slice(0, 10);

    for (const [slug, stat] of sortedByRemoved) {
        if (stat.removed > 0) {
            console.log(`  ${slug}: ${stat.removed} duplicates (${(stat.removed / stat.before * 100).toFixed(1)}%)`);
        }
    }

    console.log(`\n📄 Output saved to: ${outputPath}`);
    console.log('='.repeat(60));
}

// Run deduplication
deduplicateAllRecords().catch(console.error);
