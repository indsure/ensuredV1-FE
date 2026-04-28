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
 * Cached data
 */
let cachedHospitals: HospitalRecord[] | null = null;
let cachedIndexes: any = null;
let cachedAggregates: any = null;
let insurersByCityMap = new Map<string, InsurerCount[]>();
let insurersByPincodeMap = new Map<string, InsurerCount[]>();

function IndSureataLoaded() {
    if (cachedHospitals && cachedIndexes && cachedAggregates && insurersByCityMap.size > 0) return;

    try {
        const dataPath = path.join(__dirname, 'insurance_hospital_networks.json');
        const indexesPath = path.join(__dirname, 'indexes.json');
        const aggregatesPath = path.join(__dirname, 'aggregates.json');

        console.log(`[FilterEngine] Checking files in: ${__dirname}`);
        console.log(`[FilterEngine] Data exists: ${fs.existsSync(dataPath)}`);
        console.log(`[FilterEngine] Indexes exists: ${fs.existsSync(indexesPath)}`);
        console.log(`[FilterEngine] Aggregates exists: ${fs.existsSync(aggregatesPath)}`);

        const start = Date.now();

        if (fs.existsSync(dataPath)) {
            cachedHospitals = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            console.log(`[FilterEngine] Loaded hospitals: ${cachedHospitals?.length}`);
        }
        if (fs.existsSync(indexesPath)) {
            cachedIndexes = JSON.parse(fs.readFileSync(indexesPath, 'utf-8'));
            console.log(`[FilterEngine] Loaded indexes: ${Object.keys(cachedIndexes?.byState || {}).length} states`);
        }
        if (fs.existsSync(aggregatesPath)) {
            cachedAggregates = JSON.parse(fs.readFileSync(aggregatesPath, 'utf-8'));
            
            // Pre-index insurers for fast lookup (ONCE)
            if (cachedAggregates.insurerByCity) {
                insurersByCityMap.clear();
                Object.entries(cachedAggregates.insurerByCity).forEach(([key, count]) => {
                    const [insurer_slug, city] = key.split('|');
                    if (!insurersByCityMap.has(city)) insurersByCityMap.set(city, []);
                    insurersByCityMap.get(city)!.push({ insurer_slug, hospital_count: count as number });
                });
            }

            if (cachedAggregates.insurerByPincode) {
                insurersByPincodeMap.clear();
                Object.entries(cachedAggregates.insurerByPincode).forEach(([key, count]) => {
                    const [insurer_slug, pincode] = key.split('|');
                    if (!insurersByPincodeMap.has(pincode)) insurersByPincodeMap.set(pincode, []);
                    insurersByPincodeMap.get(pincode)!.push({ insurer_slug, hospital_count: count as number });
                });
            }
            console.log(`[FilterEngine] Aggregates processed: ${insurersByCityMap.size} cities, ${insurersByPincodeMap.size} pincodes`);
        }
        
        console.log(`[FilterEngine] Data load took ${Date.now() - start}ms`);
    } catch (error) {
        console.error('[FilterEngine] Error loading hospital data:', error);
    }
}

/**
 * Filter hospitals based on geo parameters (Optimized)
 */
function filterHospitalsOptimized(params: FilterParams): HospitalRecord[] {
    IndSureataLoaded();
    if (!cachedHospitals || !cachedIndexes) return [];

    let indices: number[] | null = null;

    // Use indexes to narrow down search
    if (params.pincode && cachedIndexes.byPincode[params.pincode]) {
        indices = cachedIndexes.byPincode[params.pincode];
    } else if (params.city && cachedIndexes.byCity[params.city]) {
        indices = cachedIndexes.byCity[params.city];
    } else if (params.state && cachedIndexes.byState[params.state]) {
        indices = cachedIndexes.byState[params.state];
    }

    // If no index hit and no filters, return all (not recommended for performance)
    if (indices === null) {
        if (!params.state && !params.city && !params.pincode) {
            return cachedHospitals;
        }
        return [];
    }

    // Filter the indexed records further if needed
    return indices.map(idx => cachedHospitals![idx]).filter(hospital => {
        if (params.state && hospital.state !== params.state) return false;
        if (params.city && hospital.city !== params.city) return false;
        if (params.pincode && hospital.pincode !== params.pincode) return false;
        return true;
    });
}

/**
 * Main filter engine function (Optimized)
 */
export function filterHospitalNetwork(params: FilterParams): FilterEngineResult {
    IndSureataLoaded();
    
    if (!cachedIndexes || !cachedAggregates) {
        console.warn('Filter engine data not fully loaded. Falling back to manual filter.');
        console.log('cachedIndexes:', !!cachedIndexes, 'cachedAggregates:', !!cachedAggregates);
    }

    // If we have aggregates, we can use them for simple queries
    if (cachedAggregates) {
        let cityResults: CityLevelResult[] = [];
        let pincodeResults: PincodeLevelResult[] = [];

        // 1. City-Level Aggregation
        if (params.city) {
            const insurers = insurersByCityMap.get(params.city);
            if (insurers) {
                cityResults.push({ 
                    city: params.city, 
                    insurers: insurers.sort((a,b) => b.hospital_count - a.hospital_count) 
                });
            }
        } else if (params.state) {
            const citiesInState = new Set<string>();
            const stateIndices = cachedIndexes?.byState[params.state] || [];
            stateIndices.forEach((idx: number) => {
                const city = cachedHospitals?.[idx]?.city;
                if (city) citiesInState.add(city);
            });

            citiesInState.forEach(city => {
                const insurers = insurersByCityMap.get(city);
                if (insurers) {
                    cityResults.push({ 
                        city, 
                        insurers: insurers.sort((a,b) => b.hospital_count - a.hospital_count) 
                    });
                }
            });
            cityResults.sort((a, b) => {
                const totalA = a.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
                const totalB = b.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
                return totalB - totalA;
            });
        }

        // 2. Pincode-Level Aggregation
        if (params.pincode) {
            const insurers = insurersByPincodeMap.get(params.pincode);
            if (insurers) {
                pincodeResults.push({ 
                    pincode: params.pincode, 
                    insurers: insurers.sort((a,b) => b.hospital_count - a.hospital_count) 
                });
            }
        } else if (params.city) {
            const pincodesInCity = new Set<string>();
            const cityIndices = cachedIndexes?.byCity[params.city] || [];
            cityIndices.forEach((idx: number) => {
                const pincode = cachedHospitals?.[idx]?.pincode;
                if (pincode) pincodesInCity.add(pincode);
            });

            pincodesInCity.forEach(pincode => {
                const insurers = insurersByPincodeMap.get(pincode);
                if (insurers) {
                    pincodeResults.push({ 
                        pincode, 
                        insurers: insurers.sort((a,b) => b.hospital_count - a.hospital_count) 
                    });
                }
            });
            pincodeResults.sort((a, b) => {
                const totalA = a.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
                const totalB = b.insurers.reduce((sum, i) => sum + i.hospital_count, 0);
                return totalB - totalA;
            });
        }

        return {
            cityLevel: cityResults,
            pincodeLevel: pincodeResults
        };
    }

    // Fallback to manual filtering if aggregates/indexes not available
    const hospitals = filterHospitalsOptimized(params);
    return {
        cityLevel: aggregateByCity(hospitals),
        pincodeLevel: aggregateByPincode(hospitals)
    };
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
 * Get sample hospital names for a location
 */
export function getHospitalSamples(params: { city?: string; pincode?: string; limit?: number }): { hospital_name: string; address: string; insurer_slug: string }[] {
    IndSureataLoaded();
    
    if (!cachedHospitals || !cachedIndexes) {
        console.warn('[getHospitalSamples] Data not loaded');
        return [];
    }

    const limit = params.limit || 10;
    const uniqueHospitals = new Map<string, { hospital_name: string; address: string; insurer_slug: string }>();
    
    // Get indices based on the filter
    let indices: number[] | null = null;
    
    if (params.pincode && cachedIndexes.byPincode[params.pincode]) {
        indices = cachedIndexes.byPincode[params.pincode];
        console.log(`[getHospitalSamples] Found ${indices.length} hospitals for pincode ${params.pincode}`);
    } else if (params.city && cachedIndexes.byCity[params.city]) {
        indices = cachedIndexes.byCity[params.city];
        console.log(`[getHospitalSamples] Found ${indices.length} hospitals for city ${params.city}`);
    }
    
    if (!indices || indices.length === 0) {
        console.warn(`[getHospitalSamples] No indices found for city=${params.city}, pincode=${params.pincode}`);
        return [];
    }
    
    // Collect unique hospital names
    for (const idx of indices) {
        const hospital = cachedHospitals[idx];
        if (!hospital) continue;
        
        // Apply additional filters if needed
        if (params.pincode && hospital.pincode !== params.pincode) continue;
        if (params.city && hospital.city !== params.city) continue;
        
        if (!uniqueHospitals.has(hospital.hospital_name)) {
            uniqueHospitals.set(hospital.hospital_name, {
                hospital_name: hospital.hospital_name,
                address: hospital.address,
                insurer_slug: hospital.insurer_slug,
            });
        }
        
        if (uniqueHospitals.size >= limit) break;
    }
    
    console.log(`[getHospitalSamples] Returning ${uniqueHospitals.size} unique hospitals`);
    return Array.from(uniqueHospitals.values());
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

