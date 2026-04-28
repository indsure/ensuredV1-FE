/**
 * Extraction Orchestrator - Main entry point for PDF extraction
 */

import { loadPDF, PDFLoadError } from './pdf-loader';
import { extractWithLLM, ExtractionError } from './llm-extractor';
import { resolveInsurer } from './insurer-resolver-bridge';
import type { ExtractedPolicy } from '../types/policy';

export class OrchestrationError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'OrchestrationError';
  }
}

/**
 * Extract policy data from PDF buffer
 * 
 * Pipeline:
 * 1. Load PDF and extract text (with OCR fallback if needed)
 * 2. Use LLM to extract structured data
 * 3. Validate against schema
 * 4. Resolve insurer name to ID
 * 5. Return ExtractedPolicy
 */
export async function extractPolicy(fileBuffer: Buffer): Promise<ExtractedPolicy> {
  try {
    // Step 1: Load PDF
    console.log('Loading PDF...');
    const pdfData = await loadPDF(fileBuffer);
    
    if (!pdfData.fullText || pdfData.fullText.trim().length === 0) {
      throw new OrchestrationError('PDF contains no extractable text');
    }
    
    console.log(`Extracted ${pdfData.fullText.length} characters from ${pdfData.pages.length} pages`);
    
    // Step 2: LLM extraction
    console.log('Extracting structured data with LLM...');
    const policy = await extractWithLLM(pdfData.fullText, pdfData.pages);
    
    // Step 3: Resolve insurer
    console.log(`Resolving insurer: ${policy.insurer_raw_name}`);
    const insurerId = await resolveInsurer(policy.insurer_raw_name);
    
    if (insurerId) {
      console.log(`Resolved to insurer ID: ${insurerId}`);
      policy.insurer_id = insurerId;
    } else {
      console.warn(`Could not resolve insurer: ${policy.insurer_raw_name}`);
      policy.insurer_id = null;
    }
    
    return policy;
    
  } catch (error) {
    if (error instanceof PDFLoadError) {
      throw new OrchestrationError('Failed to load PDF', error);
    }
    
    if (error instanceof ExtractionError) {
      throw new OrchestrationError('Failed to extract policy data', error);
    }
    
    throw new OrchestrationError(
      'Policy extraction failed',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Extract multiple policies in parallel
 */
export async function extractPolicies(fileBuffers: Buffer[]): Promise<ExtractedPolicy[]> {
  const results = await Promise.allSettled(
    fileBuffers.map((buffer) => extractPolicy(buffer))
  );
  
  const policies: ExtractedPolicy[] = [];
  const errors: Error[] = [];
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      policies.push(result.value);
    } else {
      errors.push(result.reason);
    }
  }
  
  if (errors.length > 0 && policies.length === 0) {
    throw new OrchestrationError(
      `All ${fileBuffers.length} extractions failed`,
      errors[0]
    );
  }
  
  if (errors.length > 0) {
    console.warn(`${errors.length} of ${fileBuffers.length} extractions failed`);
  }
  
  return policies;
}
