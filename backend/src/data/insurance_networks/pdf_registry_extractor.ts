import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// pdf-parse exports a function directly
const pdf = require('pdf-parse');

// Canonical insurer slug mapping
const INSURER_SLUG_MAP: Record<string, string> = {
    'bajaj_allianz': 'Bajaj Allianz',
    'galaxy_health': 'Galaxy Health',
    'new_india': 'New India Assurance',
    'reliance': 'Reliance General',
    'tata_aig': 'Tata AIG',
    'hdfc_ergo': 'HDFC ERGO',
    'icici_lombard': 'ICICI Lombard',
    'star_health': 'Star Health',
    'niva_bupa': 'Niva Bupa',
    'care_health': 'Care Health',
    'kotak_general': 'Kotak General',
    'aditya_birla': 'Aditya Birla',
    'magma_hdi': 'MAGMA HDI',
    'universal_sompo': 'Universal Sompo',
    'zuno': 'Zuno',
    'manipal_cigna': 'Manipal Cigna'
};

interface PDFMetadata {
    insurer_name: string;
    insurer_slug: string;
    last_updated_date: string | null;
    page_count: number;
    source_filename: string;
    file_path: string;
    ingested_at: string;
}

interface ValidationError {
    filename: string;
    reason: string;
}

/**
 * Extract "Last updated on DD/MM/YYYY" from PDF text
 */
function extractLastUpdatedDate(text: string): string | null {
    // Pattern: "Last updated on DD/MM/YYYY" or variations
    const patterns = [
        /Last updated on\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
        /Last Updated:\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
        /Updated on\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
        /As on\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            // Convert DD/MM/YYYY to YYYY-MM-DD
            const dateParts = match[1].split(/[\/\-]/);
            if (dateParts.length === 3) {
                const [day, month, year] = dateParts;
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
        }
    }

    return null;
}

/**
 * Extract metadata from a single PDF
 */
async function extractPDFMetadata(
    insurerSlug: string,
    pdfPath: string
): Promise<PDFMetadata | ValidationError> {
    const filename = path.basename(pdfPath);

    try {
        // Read PDF file
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);

        // Extract header text (first 5 pages only for performance)
        const headerText = data.text.substring(0, 5000);

        // Extract last updated date
        const lastUpdatedDate = extractLastUpdatedDate(headerText);

        // Validate
        if (!lastUpdatedDate) {
            return {
                filename,
                reason: 'Missing last_updated_date in PDF header'
            };
        }

        if (data.numpages === 0) {
            return {
                filename,
                reason: 'page_count = 0'
            };
        }

        if (!INSURER_SLUG_MAP[insurerSlug]) {
            return {
                filename,
                reason: `insurer_slug '${insurerSlug}' not in canonical list`
            };
        }

        // Success - return metadata
        return {
            insurer_name: INSURER_SLUG_MAP[insurerSlug],
            insurer_slug: insurerSlug,
            last_updated_date: lastUpdatedDate,
            page_count: data.numpages,
            source_filename: filename,
            file_path: pdfPath,
            ingested_at: new Date().toISOString()
        };
    } catch (error) {
        return {
            filename,
            reason: `PDF read error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}

/**
 * Main extraction function
 */
async function extractAllMetadata() {
    const rawPdfsDir = 'E:\\v2final\\backend\\data\\insurance_networks\\raw_pdfs';
    const registry: PDFMetadata[] = [];
    const failures: ValidationError[] = [];

    console.log('Starting PDF metadata extraction...\n');

    // Iterate through each insurer folder
    for (const insurerSlug of Object.keys(INSURER_SLUG_MAP)) {
        const insurerDir = path.join(rawPdfsDir, insurerSlug);

        if (!fs.existsSync(insurerDir)) {
            console.log(`⚠️  Skipping ${insurerSlug} - folder not found`);
            continue;
        }

        console.log(`📁 Checking folder: ${insurerDir}`);

        // Find PDF files in this folder
        const files = fs.readdirSync(insurerDir);
        console.log(`   Found ${files.length} files: ${files.join(', ')}`);
        const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
        console.log(`   PDF files: ${pdfFiles.length}`);

        for (const pdfFile of pdfFiles) {
            const pdfPath = path.join(insurerDir, pdfFile);
            console.log(`Processing: ${insurerSlug}/${pdfFile}...`);

            const result = await extractPDFMetadata(insurerSlug, pdfPath);

            if ('reason' in result) {
                // Validation failure
                console.log(`  ❌ FAILED: ${result.reason}`);
                failures.push(result);
            } else {
                // Success
                console.log(`  ✅ SUCCESS: ${result.last_updated_date}, ${result.page_count} pages`);
                registry.push(result);
            }
        }
    }

    // Write registry to JSON
    const registryPath = path.join('E:\\v2final\\backend\\data\\insurance_networks', 'insurance_network_pdf_registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');

    // Write failures log
    if (failures.length > 0) {
        const failuresPath = path.join('E:\\v2final\\backend\\data\\insurance_networks', 'extraction_failures.json');
        fs.writeFileSync(failuresPath, JSON.stringify(failures, null, 2), 'utf-8');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Successfully extracted: ${registry.length} PDFs`);
    console.log(`❌ Failed: ${failures.length} PDFs`);
    console.log(`📄 Registry saved to: ${registryPath}`);
    if (failures.length > 0) {
        console.log(`⚠️  Failures logged to: E:\\v2final\\backend\\data\\insurance_networks\\extraction_failures.json`);
    }
    console.log('='.repeat(60));
}

// Run extraction
extractAllMetadata().catch(console.error);
