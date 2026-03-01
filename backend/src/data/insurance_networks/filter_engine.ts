import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface HospitalRecord {
    insurer_slug: string;
    hospital_name: string;
    address: string;
    city: string | null;
    state: string | null;
    pincode: string | null;
    source_pdf: string;
}

interface FilterParams {
    state?: string;
    city?: string;
    pincode?: string;
}

interface InsurerCount {
    insurer_slug: string;
    hospital_count: number;
}

interface CityLevelResult {
    city: string;
    insurers: InsurerCount[];
}

interface PincodeLevelResult {
    pincode: string;
    insurers: InsurerCount[];
}

interface FilterEngineResult {
    cityLevel: CityLevelResult[];
    pincodeLevel: PincodeLevelResult[];
}

/**
 * Load hospital data
 */
function loadHospitalData(): HospitalRecord[] {
    const dataPath = path.join(__dirname, 'insurance_hospital_networks.json');
    return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}

/**
 * Filter hospitals based on geo parameters
 */
function filterHospitals(hospitals: HospitalRecord[], params: FilterParams): HospitalRecord[] {
    return hospitals.filter(hospital => {
        // State filter
        if (params.state && hospital.state !== params.state) {
            return false;
        }

        // City filter
        if (params.city && hospital.city !== params.city) {
            return false;
        }

        // Pincode filter
        if (params.pincode && hospital.pincode !== params.pincode) {
            return false;
        }

        return true;
    });
}

/**
 * Aggregate by city and insurer
 */
function aggregateByCity(hospitals: HospitalRecord[]): CityLevelResult[] {
    const cityMap = new Map<string, Map<string, number>>();

    for (const hospital of hospitals) {
        if (!hospital.city) continue;

        if (!cityMap.has(hospital.city)) {
            cityMap.set(hospital.city, new Map());
        }

        const insurerMap = cityMap.get(hospital.city)!;
        insurerMap.set(hospital.insurer_slug, (insurerMap.get(hospital.insurer_slug) || 0) + 1);
    }

    // Convert to result format
    const results: CityLevelResult[] = [];
    for (const [city, insurerMap] of cityMap.entries()) {
        const insurers: InsurerCount[] = Array.from(insurerMap.entries())
            .map(([insurer_slug, hospital_count]) => ({ insurer_slug, hospital_count }))
            .filter(i => i.hospital_count > 0)
            .sort((a, b) => b.hospital_count - a.hospital_count);

        if (insurers.length > 0) {
            results.push({ city, insurers });
        }
    }

    // Sort by total hospital count (descending)
    results.sort((a, b) => {
        const totalA = a.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
        const totalB = b.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
        return totalB - totalA;
    });

    return results;
}

/**
 * Aggregate by pincode and insurer
 */
function aggregateByPincode(hospitals: HospitalRecord[]): PincodeLevelResult[] {
    const pincodeMap = new Map<string, Map<string, number>>();

    for (const hospital of hospitals) {
        if (!hospital.pincode) continue;

        if (!pincodeMap.has(hospital.pincode)) {
            pincodeMap.set(hospital.pincode, new Map());
        }

        const insurerMap = pincodeMap.get(hospital.pincode)!;
        insurerMap.set(hospital.insurer_slug, (insurerMap.get(hospital.insurer_slug) || 0) + 1);
    }

    // Convert to result format
    const results: PincodeLevelResult[] = [];
    for (const [pincode, insurerMap] of pincodeMap.entries()) {
        const insurers: InsurerCount[] = Array.from(insurerMap.entries())
            .map(([insurer_slug, hospital_count]) => ({ insurer_slug, hospital_count }))
            .filter(i => i.hospital_count > 0)
            .sort((a, b) => b.hospital_count - a.hospital_count);

        if (insurers.length > 0) {
            results.push({ pincode, insurers });
        }
    }

    // Sort by total hospital count (descending)
    results.sort((a, b) => {
        const totalA = a.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
        const totalB = b.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
        return totalB - totalA;
    });

    return results;
}

/**
 * Main filter engine function
 */
export function filterHospitalNetwork(params: FilterParams): FilterEngineResult {
    // Load data
    const allHospitals = loadHospitalData();

    let cityResults: CityLevelResult[] = [];
    let pincodeResults: PincodeLevelResult[] = [];

    // 1. City-Level Query
    // Runs if State OR City is provided (Standard hierarchical search)
    // If City provided -> Filter by State(optional) + City -> Aggregate by City(singleton)
    // If State only -> Filter by State -> Aggregate all Cities in State
    if (params.state || params.city) {
        const cityScopeHospitals = allHospitals.filter(h => {
            if (params.state && h.state !== params.state) return false;
            if (params.city && h.city !== params.city) return false;
            return true;
        });
        cityResults = aggregateByCity(cityScopeHospitals);
    }

    // 2. Pincode-Level Query
    // Runs if Pincode is provided (Specific local search)
    // Independent of City query.
    // Logic: If Pincode exists, find matches for that pincode.
    if (params.pincode) {
        const pincodeScopeHospitals = allHospitals.filter(h => {
            // Note: We intentionally DO NOT allow State/City to restrict Pincode search 
            // if a specific Pincode is asked for. Pincode is globally unique enough 
            // (or usually implies a specific state).
            // However, IF the user provided state context, strict safety dictates we might check it,
            // but the requirement says "Run pincode-level aggregation: insurer x pincode".
            // Direct Pincode match is the most precise intent.
            return h.pincode === params.pincode;
        });
        pincodeResults = aggregateByPincode(pincodeScopeHospitals);
    } else if (params.city && !params.pincode) {
        // Fallback: If only City is provided, we might want to show Pincodes *within* that city 
        // to be helpful? The requirements didn't explicitly forbid this "drill-down" behavior 
        // for pure city searches, but the user emphasized "Independent".
        // Let's stick to the user's strict pseudocode: "if (pincode exists) -> query_pincode".
        // BUT, existing behavior likely showed breakdown.
        // Let's look at the "Fallback" logic from before...
        // Actually, the user said: "If City provided: Run city-level aggregation... If Pincode provided: Run pincode-level..."
        // This implies if NO Pincode is provided, we might NOT want to populate pincodeLevel?
        // Let's check the old behavior: `aggregateByPincode(filteredHospitals)` where filteredHospitals had City applied.
        // So simply selecting a City *did* return all pincodes in that city.
        // The user's compliant: "When BOTH... is executing ONLY city-level... Pincode input is ignored".
        // So we should maintain "Drill down" behavior if Pincode is MISSING, 
        // but strictly separate them if Pincode IS PRESENT.

        // Revised Logic for Contextual Drill-down:
        // If I search "Mumbai", I expect to see "Hospitals in Mumbai" AND "Hospitals in 400001, 400002..."
        // If I search "Mumbai" + "400001", I expect "Hospitals in Mumbai" AND "Hospitals in 400001" (just that one).

        const cityDrillDownHospitals = allHospitals.filter(h => {
            if (params.state && h.state !== params.state) return false;
            if (params.city && h.city !== params.city) return false;
            return true;
        });
        pincodeResults = aggregateByPincode(cityDrillDownHospitals);
    }

    return {
        cityLevel: cityResults,
        pincodeLevel: pincodeResults
    };
}

// Demo/Test function
function demo() {
    console.log('Hospital Network Filter Engine Demo\n');
    console.log('='.repeat(60));

    // Test 1: No filters (all data)
    console.log('\n1. No filters (top 5 cities):');
    const result1 = filterHospitalNetwork({});
    console.log(`   Total cities: ${result1.cityLevel.length}`);
    console.log(`   Total pincodes: ${result1.pincodeLevel.length}`);
    result1.cityLevel.slice(0, 5).forEach(c => {
        const total = c.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
        console.log(`   ${c.city}: ${total} hospitals across ${c.insurers.length} insurers`);
    });

    // Test 2: Filter by state
    console.log('\n2. Filter by state (Maharashtra, top 5 cities):');
    const result2 = filterHospitalNetwork({ state: 'Maharashtra' });
    console.log(`   Total cities: ${result2.cityLevel.length}`);
    console.log(`   Total pincodes: ${result2.pincodeLevel.length}`);
    result2.cityLevel.slice(0, 5).forEach(c => {
        const total = c.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
        console.log(`   ${c.city}: ${total} hospitals across ${c.insurers.length} insurers`);
    });

    // Test 3: Filter by city
    console.log('\n3. Filter by city (Mumbai):');
    const result3 = filterHospitalNetwork({ city: 'Mumbai' });
    console.log(`   Pincodes: ${result3.pincodeLevel.length}`);
    result3.pincodeLevel.slice(0, 5).forEach(p => {
        const total = p.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
        console.log(`   ${p.pincode}: ${total} hospitals across ${p.insurers.length} insurers`);
    });

    // Test 4: Filter by pincode
    console.log('\n4. Filter by pincode (400001):');
    const result4 = filterHospitalNetwork({ pincode: '400001' });
    if (result4.pincodeLevel.length > 0) {
        const p = result4.pincodeLevel[0];
        console.log(`   Insurers in ${p.pincode}:`);
        p.insurers.forEach(i => {
            console.log(`     ${i.insurer_slug}: ${i.hospital_count} hospitals`);
        });
    } else {
        console.log('   No hospitals found for this pincode');
    }

    // Test 5: Combined filters
    console.log('\n5. Filter by state + city (Maharashtra, Pune):');
    const result5 = filterHospitalNetwork({ state: 'Maharashtra', city: 'Pune' });
    console.log(`   Pincodes: ${result5.pincodeLevel.length}`);
    result5.pincodeLevel.slice(0, 5).forEach(p => {
        const total = p.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
        console.log(`   ${p.pincode}: ${total} hospitals across ${p.insurers.length} insurers`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Filter engine demo complete');
}

// Only run demo if executed directly (ESM compatible)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    demo();
}

