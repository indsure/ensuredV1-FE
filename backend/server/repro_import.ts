
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Current directory:", __dirname);

async function testImport() {
    try {
        const filterEnginePath = "./data/insurance_networks/filter_engine";
        console.log("Attempting import from:", filterEnginePath);
        const module = await import(filterEnginePath);
        console.log("Import successful!");
        console.log("Exports:", Object.keys(module));

        // Try running the function
        const result = module.filterHospitalNetwork({ state: 'Maharashtra' });
        console.log("Function execution result count:", result.cityLevel.length);

    } catch (error: any) {
        console.error("Import failed:", error);
        console.error("Error details:", error.message);
        if (error.code) console.error("Error code:", error.code);
    }
}

testImport();
