/**
 * Render one PDF page to a PNG, for OCR (./ocr) and for the Gemini page read
 * of scanned car policies (./scanVision).
 *
 * About 180 DPI, capped in pixels so a poster-sized page cannot exhaust the
 * memory of a small server.
 */

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const SCALE = 2.5;
const MAX_PIXELS = 3500 * 5000;

export async function renderPage(
  pdfBytes: Uint8Array,
  pageIndex: number
): Promise<{ png: Buffer; width: number; height: number; scale: number }> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableFontFace: true, isEvalSupported: false, verbosity: 0 }).promise;
  try {
    const page = await pdf.getPage(pageIndex);
    const base = page.getViewport({ scale: 1 });
    let scale = SCALE;
    if (base.width * base.height * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (base.width * base.height));
    const viewport = page.getViewport({ scale });
    const factory = (pdf as any).canvasFactory;
    const { canvas, context } = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    const png = canvas.toBuffer("image/png");
    factory.destroy({ canvas, context });
    return { png, width: base.width, height: base.height, scale };
  } finally {
    await pdf.destroy();
  }
}
