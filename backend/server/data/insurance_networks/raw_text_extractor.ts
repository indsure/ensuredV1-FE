import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load pdfjs-dist dynamically
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

// Canonical insurer slugs
const INSURER_SLUGS = [
    'bajaj_allianz', 'galaxy_health', 'new_india', 'reliance', 'tata_aig',
    'hdfc_ergo', 'icici_lombard', 'star_health', 'niva_bupa', 'care_health',
    'kotak_general', 'aditya_birla', 'magma_hdi', 'universal_sompo', 'zuno', 'manipal_cigna'
];

interface ExtractionResult {
    insurer_slug: string;
    success: boolean;
    page_count?: number;
    raw_text_path?: string;
    extracted_at?: string;
    error?: string;
}

/**
 * Strip global noise patterns from text
 */
function stripGlobalNoise(text: string): string {
    const noisePatterns = [
        /List of hospitals/gi,
        /Supplier Name/gi,
        /Disclaimer:.*?change/gi,
        /Network lists are subject to change/gi,
        /Page \d+ of \d+/gi,
        /^\d+$/gm, // Standalone page numbers
    ];

    let cleaned = text;
    for (const pattern of noisePatterns) {
        cleaned = cleaned.replace(pattern, '');
    }

    return cleaned;
}

/**
 * Extract text from PDF page by page using pdfjs-dist
 */
async function extractRawText(pdfPath: string): Promise<{ pages: string[], pageCount: number }> {
    const dataBuffer = fs.readFileSync(pdfPath);
    const uint8Array = new Uint8Array(dataBuffer);

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;
    const pageCount = pdfDocument.numPages;
    const pages: string[] = [];

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Preserve line breaks and order
        let pageText = '';
        let lastY = -1;

        for (const item of textContent.items) {
            if ('str' in item) {
                // Check if we need a line break (new Y position)
                if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                    pageText += '\n';
                }
                pageText += item.str;
                lastY = item.transform[5];
            }
        }

        // Strip global noise but preserve content
        const cleanedText = stripGlobalNoise(pageText);
        pages.push(cleanedText.trim());
    }

    return { pages, pageCount };
}

/**
 * Process a single insurer's PDF
 */
async function processInsurerPDF(insurerSlug: string): Promise<ExtractionResult> {
    const pdfDir = path.join('E:\\v2final\\backend\\data\\insurance_networks\\raw_pdfs', insurerSlug);
    const outputDir = 'E:\\v2final\\backend\\data\\insurance_networks\\raw_text';

    try {
        // Find PDF file in insurer folder
        if (!fs.existsSync(pdfDir)) {
            return {
                insurer_slug: insurerSlug,
                success: false,
                error: 'PDF directory not found'
            };
        }

        const files = fs.readdirSync(pdfDir);
        const pdfFile = files.find(f => f.toLowerCase().endsWith('.pdf'));

        if (!pdfFile) {
            return {
                insurer_slug: insurerSlug,
                success: false,
                error: 'No PDF file found in directory'
            };
        }

        const pdfPath = path.join(pdfDir, pdfFile);
        console.log(`Processing: ${insurerSlug}/${pdfFile}...`);

        // Extract raw text
        const { pages, pageCount } = await extractRawText(pdfPath);

        // Validate
        if (pages.length !== pageCount) {
            return {
                insurer_slug: insurerSlug,
                success: false,
                error: `Page count mismatch: extracted ${pages.length}, expected ${pageCount}`
            };
        }

        if (pages.length === 0) {
            return {
                insurer_slug: insurerSlug,
                success: false,
                error: 'Output file is empty'
            };
        }

        // Check if text collapsed into one paragraph (heuristic: very few line breaks)
        const totalText = pages.join('');
        const lineBreakCount = (totalText.match(/\n/g) || []).length;
        if (lineBreakCount < pages.length * 2) {
            return {
                insurer_slug: insurerSlug,
                success: false,
                error: 'Text appears to have collapsed into one paragraph'
            };
        }

        // Write output file with page delimiters
        const outputPath = path.join(outputDir, `${insurerSlug}.txt`);
        let outputContent = '';

        for (let i = 0; i < pages.length; i++) {
            outputContent += `--- PAGE ${i + 1} ---\n`;
            outputContent += pages[i];
            outputContent += '\n\n';
        }

        fs.writeFileSync(outputPath, outputContent, 'utf-8');

        console.log(`  ✅ SUCCESS: ${pageCount} pages extracted`);

        return {
            insurer_slug: insurerSlug,
            success: true,
            page_count: pageCount,
            raw_text_path: outputPath,
            extracted_at: new Date().toISOString()
        };

    } catch (error) {
        return {
            insurer_slug: insurerSlug,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Main extraction function
 */
async function extractAllRawText() {
    console.log('Starting raw text extraction...\n');

    const results: ExtractionResult[] = [];
    const failures: ExtractionResult[] = [];

    for (const insurerSlug of INSURER_SLUGS) {
        const result = await processInsurerPDF(insurerSlug);
        results.push(result);

        if (!result.success) {
            console.log(`  ❌ FAILED: ${result.error}`);
            failures.push(result);
        }
    }

    // Update registry
    const registryPath = 'E:\\v2final\\backend\\data\\insurance_networks\\insurance_network_pdf_registry.json';
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));

    for (const result of results) {
        if (result.success) {
            const entry = registry.find((r: any) => r.insurer_slug === result.insurer_slug);
            if (entry) {
                entry.raw_text_generated = true;
                entry.raw_text_path = result.raw_text_path;
                entry.extracted_at = result.extracted_at;
            }
        }
    }

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');

    // Log failures
    if (failures.length > 0) {
        const failuresPath = 'E:\\v2final\\backend\\data\\insurance_networks\\raw_text_extraction_failures.json';
        fs.writeFileSync(failuresPath, JSON.stringify(failures, null, 2), 'utf-8');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Successfully extracted: ${results.filter(r => r.success).length} PDFs`);
    console.log(`❌ Failed: ${failures.length} PDFs`);
    if (failures.length > 0) {
        console.log(`⚠️  Failures logged to: raw_text_extraction_failures.json`);
    }
    console.log('='.repeat(60));
}

// Run extraction
extractAllRawText().catch(console.error);
