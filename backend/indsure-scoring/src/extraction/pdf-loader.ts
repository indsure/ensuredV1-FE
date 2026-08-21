/**
 * PDF Loader - Extracts text from PDFs (text-based or scanned)
 */

import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';

export interface PDFPage {
  pageNum: number;
  text: string;
}

export interface PDFLoadResult {
  fullText: string;
  pages: PDFPage[];
  isScanned: boolean;
}

export class PDFLoadError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'PDFLoadError';
  }
}

/**
 * Detects if a PDF is scanned (image-based) by checking text density
 */
function isScannedPDF(text: string, pageCount: number): boolean {
  const avgCharsPerPage = text.length / pageCount;
  // If average chars per page < 100, likely scanned
  return avgCharsPerPage < 100;
}

/**
 * Extracts text from a text-based PDF
 */
async function extractTextPDF(buffer: Buffer): Promise<PDFLoadResult> {
  // pdf-parse v2 is a class, not a callable module, and it holds a pdf.js
  // worker open until destroy() — hence the finally.
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();

    const fullText = result.text;
    // v2 returns real per-page text, so no approximation is needed.
    const pages: PDFPage[] = result.pages.map((page) => ({
      pageNum: page.num,
      text: page.text,
    }));
    const pageCount = Math.max(result.total || pages.length, 1);

    return {
      fullText,
      pages,
      isScanned: isScannedPDF(fullText, pageCount),
    };
  } catch (error) {
    throw new PDFLoadError(
      'Failed to extract text from PDF',
      error instanceof Error ? error : undefined
    );
  } finally {
    await parser.destroy();
  }
}

/**
 * Extracts text from a scanned PDF using OCR
 */
async function extractScannedPDF(buffer: Buffer): Promise<PDFLoadResult> {
  const ocrProvider = process.env.EXTRACTION_OCR_PROVIDER || 'tesseract';
  
  if (ocrProvider === 'tesseract') {
    return extractWithTesseract(buffer);
  }
  
  // Future: Add Google Vision / AWS Textract support
  throw new PDFLoadError(`Unsupported OCR provider: ${ocrProvider}`);
}

/**
 * Extracts text using Tesseract.js (local OCR)
 */
async function extractWithTesseract(buffer: Buffer): Promise<PDFLoadResult> {
  try {
    const worker = await createWorker('eng');
    
    // For simplicity, we'll treat the entire PDF as one image
    // In production, you'd convert each page to an image separately
    const { data: { text } } = await worker.recognize(buffer);
    
    await worker.terminate();
    
    return {
      fullText: text,
      pages: [{ pageNum: 1, text }],
      isScanned: true,
    };
  } catch (error) {
    throw new PDFLoadError(
      'OCR extraction failed',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Main entry point: Load PDF and extract text
 */
export async function loadPDF(buffer: Buffer): Promise<PDFLoadResult> {
  // First, try text extraction
  const textResult = await extractTextPDF(buffer);
  
  // If scanned, fall back to OCR
  if (textResult.isScanned && textResult.fullText.trim().length < 500) {
    console.log('PDF appears to be scanned, falling back to OCR...');
    return extractScannedPDF(buffer);
  }
  
  return textResult;
}
