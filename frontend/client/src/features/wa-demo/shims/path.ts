/** Browser stand-in for "node:path", only for the WhatsApp demo phone. */
export const sep = "/";
export function join(...parts: string[]): string {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}
export function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i > 0 ? p.slice(0, i) : "/";
}
export default { sep, join, dirname };
