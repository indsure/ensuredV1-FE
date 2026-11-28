import { apiFetch } from "./api";

/**
 * Download the account export with live progress.
 *
 * Fetched rather than linked, because the route needs the auth header and a
 * plain anchor cannot carry one. The body is read chunk by chunk so the page
 * can show how much has arrived. The server sends X-Export-Bytes, its estimate
 * of the zip's size (exact for every file whose size storage knows). It is an
 * estimate, so the bar is held at 99% until the last byte is in.
 */

export type ExportProgress =
  | { phase: "preparing" }
  | { phase: "downloading"; received: number; total: number | null; secondsLeft: number | null }
  | { phase: "saving" };

export async function downloadAccountExport(path: string, onProgress: (p: ExportProgress) => void): Promise<void> {
  onProgress({ phase: "preparing" });
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`EXPORT_${res.status}`);

  // A zip from the current server, or records-only JSON from an older one
  // (and from the demo), which a .zip name would make unopenable.
  const ext = (res.headers.get("Content-Type") || "").includes("zip") ? "zip" : "json";
  const totalHeader = Number(res.headers.get("X-Export-Bytes"));
  const total = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : null;

  const chunks: BlobPart[] = [];
  if (res.body) {
    const reader = res.body.getReader();
    const started = performance.now();
    let received = 0;
    let lastReport = 0;
    onProgress({ phase: "downloading", received: 0, total, secondsLeft: null });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const now = performance.now();
      // A few updates a second is smooth; one per chunk would re-render hundreds of times.
      if (now - lastReport > 200) {
        lastReport = now;
        const elapsed = (now - started) / 1000;
        const rate = elapsed > 1 ? received / elapsed : 0;
        const secondsLeft = total && rate > 0 ? Math.max(0, Math.round((total - received) / rate)) : null;
        onProgress({ phase: "downloading", received, total, secondsLeft });
      }
    }
  } else {
    chunks.push(await res.blob());
  }

  onProgress({ phase: "saving" });
  const blob = new Blob(chunks, { type: ext === "zip" ? "application/zip" : "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `indsure-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Released on the next tick: revoking straight after click() can cancel the save in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Percent for the bar: real when the size is known, never 100 until the end. */
export function exportPercent(p: ExportProgress | null): number | null {
  if (!p) return null;
  if (p.phase === "saving") return 100;
  if (p.phase !== "downloading" || !p.total) return null;
  return Math.min(99, Math.floor((p.received / p.total) * 100));
}

export function megabytes(bytes: number): string {
  const mb = bytes / 1048576;
  return mb < 10 ? mb.toFixed(1) : String(Math.round(mb));
}
