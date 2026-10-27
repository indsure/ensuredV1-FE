/**
 * Browser stand-in for "node:fs/promises", only for the WhatsApp demo phone. The bot parks
 * a received PDF in a temp file while it asks a question, then reads it back and deletes it.
 * Here the "disk" is a Map that lives as long as the page.
 */

const files = new Map<string, Uint8Array>();

async function mkdir(_p: string, _o?: unknown) { /* folders are implied */ }
async function writeFile(p: string, data: Uint8Array | string) {
  files.set(p, typeof data === "string" ? new TextEncoder().encode(data) : data);
}
async function readFile(p: string) {
  const f = files.get(p);
  if (!f) throw Object.assign(new Error(`ENOENT: ${p}`), { code: "ENOENT" });
  return f;
}
async function rm(p: string, _o?: unknown) { files.delete(p); }

export { mkdir, writeFile, readFile, rm };
export default { mkdir, writeFile, readFile, rm };
