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

interface Index {
    [key: string]: number[]; // key -> array of record indices
}

interface AggregateView {
    [key: string]: number; // composite key -> count
}

/**
 * Build indexes on specified fields
 */
function buildIndexes(records: HospitalRecord[]): {
    byState: Index;
    byCity: Index;
    byPincode: Index;
    byInsurerSlug: Index;
} {
    const byState: Index = {};
    const byCity: Index = {};
    const byPincode: Index = {};
    const byInsurerSlug: Index = {};

    records.forEach((record, idx) => {
        // State index
        if (record.state) {
            if (!byState[record.state]) byState[record.state] = [];
            byState[record.state].push(idx);
        }

        // City index
        if (record.city) {
            if (!byCity[record.city]) byCity[record.city] = [];
            byCity[record.city].push(idx);
        }

        // Pincode index
        if (record.pincode) {
            if (!byPincode[record.pincode]) byPincode[record.pincode] = [];
            byPincode[record.pincode].push(idx);
        }

        // Insurer slug index
        if (!byInsurerSlug[record.insurer_slug]) byInsurerSlug[record.insurer_slug] = [];
        byInsurerSlug[record.insurer_slug].push(idx);
    });

    return { byState, byCity, byPincode, byInsurerSlug };
}

/**
 * Materialize aggregate views
 */
function materializeAggregates(records: HospitalRecord[]): {
    insurerByCity: AggregateView;
    insurerByPincode: AggregateView;
} {
    const insurerByCity: AggregateView = {};
    const insurerByPincode: AggregateView = {};

    records.forEach((record) => {
        // insurer × city
        if (record.city) {
            const key = `${record.insurer_slug}|${record.city}`;
            insurerByCity[key] = (insurerByCity[key] || 0) + 1;
        }

        // insurer × pincode
        if (record.pincode) {
            const key = `${record.insurer_slug}|${record.pincode}`;
            insurerByPincode[key] = (insurerByPincode[key] || 0) + 1;
        }
    });

    return { insurerByCity, insurerByPincode };
}

/**
 * Convert index to summary stats
 */
function indexToStats(index: Index): { key: string; count: number }[] {
    return Object.entries(index)
        .map(([key, indices]) => ({ key, count: indices.length }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Main indexing function
 */
async function createIndexesAndAggregates() {
    console.log('Starting geo indexing and aggregation...\n');

    // Read deduplicated records
    const dataPath = 'E:\\v2final\\backend\\data\\insurance_networks\\insurance_hospital_networks.json';
    const records: HospitalRecord[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    console.log(`Processing ${records.length} hospital records...\n`);

    // Build indexes
    console.log('Building indexes...');
    const indexes = buildIndexes(records);

    console.log(`  ✅ State index: ${Object.keys(indexes.byState).length} unique states`);
    console.log(`  ✅ City index: ${Object.keys(indexes.byCity).length} unique cities`);
    console.log(`  ✅ Pincode index: ${Object.keys(indexes.byPincode).length} unique pincodes`);
    console.log(`  ✅ Insurer index: ${Object.keys(indexes.byInsurerSlug).length} insurers`);

    // Materialize aggregates
    console.log('\nMaterializing aggregate views...');
    const aggregates = materializeAggregates(records);

    console.log(`  ✅ Insurer × City: ${Object.keys(aggregates.insurerByCity).length} combinations`);
    console.log(`  ✅ Insurer × Pincode: ${Object.keys(aggregates.insurerByPincode).length} combinations`);

    // Save indexes
    const indexesPath = 'E:\\v2final\\backend\\data\\insurance_networks\\indexes.json';
    fs.writeFileSync(indexesPath, JSON.stringify(indexes, null, 2), 'utf-8');

    // Save aggregates
    const aggregatesPath = 'E:\\v2final\\backend\\data\\insurance_networks\\aggregates.json';
    fs.writeFileSync(aggregatesPath, JSON.stringify(aggregates, null, 2), 'utf-8');

    // Generate summary statistics
    const stateStats = indexToStats(indexes.byState).slice(0, 10);
    const cityStats = indexToStats(indexes.byCity).slice(0, 10);
    const insurerStats = indexToStats(indexes.byInsurerSlug);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Indexing and aggregation complete\n');

    console.log('Top 10 states by hospital count:');
    stateStats.forEach(s => console.log(`  ${s.key}: ${s.count}`));

    console.log('\nTop 10 cities by hospital count:');
    cityStats.forEach(c => console.log(`  ${c.key}: ${c.count}`));

    console.log('\nHospitals by insurer:');
    insurerStats.forEach(i => console.log(`  ${i.key}: ${i.count}`));

    console.log(`\n📄 Indexes saved to: ${indexesPath}`);
    console.log(`📄 Aggregates saved to: ${aggregatesPath}`);
    console.log('='.repeat(60));
}

// Run indexing
createIndexesAndAggregates().catch(console.error);
