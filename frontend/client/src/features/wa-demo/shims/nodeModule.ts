/**
 * Browser stand-ins for "node:module" and "node:url", only for the WhatsApp demo phone.
 * pdfInspect.ts locates pdfjs's font folder when it loads; the demo never reads a real PDF
 * (it injects its own inspector), so any harmless path will do.
 */
export function createRequire(_from: string) {
  return { resolve: (_id: string) => "/pdfjs-dist/package.json" };
}
export function pathToFileURL(p: string) {
  return { href: `file://${p}` };
}
export default { createRequire, pathToFileURL };
