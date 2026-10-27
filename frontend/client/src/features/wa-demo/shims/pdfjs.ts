/**
 * Browser stand-in for pdfjs, only for the WhatsApp demo phone. pdfInspect.ts loads pdfjs to
 * read a real PDF; the demo injects its own inspector and never reads one, and Vercel does
 * not install the bot's packages, so the import must resolve to something.
 */
export function getDocument(): never {
  throw new Error("PDF reading is not available in the demo");
}
export default { getDocument };
