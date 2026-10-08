/**
 * Local OCR for pages whose embedded text is missing or unusable.
 *
 * Conventional OCR (Tesseract, via tesseract.js), run on this machine. No
 * page image leaves the server and no model is involved. The English
 * language data comes from the @tesseract.js-data/eng package, so nothing is
 * downloaded at run time, and the worker keeps no on-disk cache.
 *
 * Resource limits for a small server:
 *   - one OCR worker per process; pages queue behind each other
 *   - page rendered at about 180 DPI, capped in pixels
 *   - a time limit per page; on timeout the worker is terminated and recreated
 *
 * Output is positioned words in PDF units, so ./textLayer lays them out with
 * the same column logic as embedded text. The engine's confidence is passed
 * through for display only.
 */

import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker, type Worker } from "tesseract.js";
import type { PageOcr, TextItem } from "./textLayer";

export const OCR_ENGINE = { id: "tesseract.js", version: "6", lang: "eng" };

const SCALE = 2.5;
const MAX_PIXELS = 3500 * 5000;
const PAGE_TIMEOUT_MS = 60_000;

let worker: Promise<Worker> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function langPath(): string {
  return path.dirname(require.resolve("@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz"));
}

function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = createWorker("eng", 1, { langPath: langPath(), gzip: true, cacheMethod: "none", logger: () => {} });
  }
  return worker;
}

async function resetWorker(): Promise<void> {
  const w = worker;
  worker = null;
  if (w) await (await w).terminate().catch(() => {});
}

/** Terminate the shared worker (tests, shutdown). */
export async function shutdownOcr(): Promise<void> {
  await resetWorker();
}

async function renderPage(pdfBytes: Uint8Array, pageIndex: number): Promise<{ png: Buffer; width: number; height: number; scale: number }> {
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

async function recognise(png: Buffer, width: number, height: number, scale: number) {
  const w = await getWorker();
  const r: any = await w.recognize(png, {}, { blocks: true, text: false });
  const items: TextItem[] = [];
  const confs: number[] = [];
  for (const b of r.data.blocks ?? []) {
    for (const p of b.paragraphs ?? []) {
      for (const l of p.lines ?? []) {
        for (const wd of l.words ?? []) {
          const t = String(wd.text ?? "").trim();
          if (!t) continue;
          const { x0, y0, x1, y1 } = wd.bbox;
          items.push({ s: t, x: x0 / scale, y: height - y1 / scale, w: (x1 - x0) / scale, h: (y1 - y0) / scale });
          confs.push(Number(wd.confidence) || 0);
        }
      }
    }
  }
  const confidence = confs.length ? Math.round(confs.reduce((a, c) => a + c, 0) / confs.length) : 0;
  return { items, confidence, width, height };
}

class TimeoutError extends Error {}

export const tesseractOcr: PageOcr = {
  ocrPage(pdf: Uint8Array, pageIndex: number) {
    const job = queue.then(async () => {
      const { png, width, height, scale } = await renderPage(pdf, pageIndex);
      let timer: NodeJS.Timeout | undefined;
      try {
        return await Promise.race([
          recognise(png, width, height, scale),
          new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new TimeoutError("timeout")), PAGE_TIMEOUT_MS); }),
        ]);
      } catch (e) {
        await resetWorker();
        throw e instanceof TimeoutError ? Object.assign(new Error("timeout"), { code: "timeout" }) : e;
      } finally {
        if (timer) clearTimeout(timer);
      }
    });
    queue = job.catch(() => undefined);
    return job;
  },
};
