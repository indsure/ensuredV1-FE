/**
 * The advisor's own letterhead for every PDF that leaves the advisor portal.
 *
 * Founder decision, 2026-11-28: a report an advisor hands to a client must look
 * like the advisor's own document. Their name and photo (from My Page) go at the
 * top; IndSure appears once per page, in the footer, as "~researched by IndSure".
 *
 * Why the photo and any non-Latin name become images here, in the browser:
 *  - react-pdf draws only JPEG and PNG, and does not reliably clip an <Image>
 *    to a circle. A canvas normalises any photo to a round PNG.
 *  - The PDF font (Noto Sans) has no Devanagari, and react-pdf does no complex
 *    shaping, so a Hindi name set as PDF text loses its matras and conjuncts.
 *    The browser shapes it correctly on a canvas.
 *
 * Every failure falls back quietly: no photo -> initials, nothing usable -> null,
 * which means today's IndSure document. A download must never break on this.
 */

import { fetchMyPage } from "@/lib/advisorPage";

export type PdfBrand = {
  /** Plain-text name, for PDF metadata, the file name and Latin rendering. */
  name: string;
  /** Round PNG data URL: the advisor's photo, or their initials. */
  avatar: string | null;
  /** Set when the name uses a script the PDF font cannot draw. Size in points. */
  nameImage: { src: string; width: number; height: number } | null;
};

export type AdvisorIdentity = { name?: string | null; photoUrl?: string | null };

/** Latin letters (with accents), digits, spaces and name punctuation. */
const PDF_FONT_SAFE = /^[ -~ -ɏḀ-ỿ’]*$/;

export const isPdfFontSafe = (text: string) => PDF_FONT_SAFE.test(text);

const TEAL = "#0D9488";
const INK = "#101828";
const AVATAR_PX = 240;

function cleanName(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
}

function graphemes(word: string): string[] {
  const Seg = (Intl as any).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(word), (s: any) => s.segment);
  return Array.from(word);
}

function initials(name: string): string {
  const words = name.split(" ").filter(Boolean);
  const first = words[0] ? graphemes(words[0])[0] ?? "" : "";
  const last = words.length > 1 ? graphemes(words[words.length - 1])[0] ?? "" : "";
  return (first + last).toUpperCase();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  return [c, ctx];
}

const SANS = "'Noto Sans', 'Noto Sans Devanagari', 'Nirmala UI', 'Mangal', system-ui, sans-serif";

async function photoAvatar(url: string): Promise<string> {
  const res = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error(`photo ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const [c, ctx] = canvas(AVATAR_PX, AVATAR_PX);
  // Cover-crop to the centre square, then clip to a circle.
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.beginPath();
  ctx.arc(AVATAR_PX / 2, AVATAR_PX / 2, AVATAR_PX / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
  bitmap.close?.();
  return c.toDataURL("image/png");
}

function initialsAvatar(name: string): string | null {
  const letters = initials(name);
  if (!letters) return null;
  const [c, ctx] = canvas(AVATAR_PX, AVATAR_PX);
  ctx.fillStyle = TEAL;
  ctx.beginPath();
  ctx.arc(AVATAR_PX / 2, AVATAR_PX / 2, AVATAR_PX / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `600 ${letters.length > 2 ? 72 : 92}px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letters, AVATAR_PX / 2, AVATAR_PX / 2 + 4);
  return c.toDataURL("image/png");
}

/** The name drawn as an image, for scripts the PDF font cannot draw. */
function nameAsImage(name: string): PdfBrand["nameImage"] {
  const pt = 13; // matches the masthead name size in the documents
  const scale = 6; // pixels per point, so print stays sharp
  const font = `700 ${pt * scale}px ${SANS}`;
  const [, probe] = canvas(1, 1);
  probe.font = font;
  const m = probe.measureText(name);
  const heightPt = pt * 1.6;
  // 240pt fits the masthead beside the photo; a longer name is drawn narrower.
  const widthPt = Math.min(240, Math.ceil(m.width / scale) + 2);
  const [c, ctx] = canvas(Math.ceil(widthPt * scale), Math.ceil(heightPt * scale));
  ctx.font = font;
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.fillText(name, 0, c.height / 2, c.width);
  return { src: c.toDataURL("image/png"), width: widthPt, height: heightPt };
}

/**
 * Build the letterhead. Resolves to null only when there is no usable name, in
 * which case the caller prints today's IndSure document.
 */
export async function buildPdfBrand(id: AdvisorIdentity | null | undefined): Promise<PdfBrand | null> {
  try {
    const name = cleanName(id?.name);
    if (!name) return null;

    let avatar: string | null = null;
    if (id?.photoUrl) {
      try {
        avatar = await withTimeout(photoAvatar(id.photoUrl), 6000);
      } catch {
        avatar = null;
      }
    }
    if (!avatar) {
      try {
        avatar = initialsAvatar(name);
      } catch {
        avatar = null;
      }
    }

    let nameImage: PdfBrand["nameImage"] = null;
    if (!isPdfFontSafe(name)) {
      try {
        nameImage = nameAsImage(name);
      } catch {
        nameImage = null;
      }
    }
    return { name, avatar, nameImage };
  } catch {
    return null;
  }
}

/**
 * The signed-in advisor's identity: My Page name and photo, else the account
 * name. The person downloading is the person handing the report over, so the
 * portal always brands with the viewer, not the row's owner.
 */
export async function myAdvisorIdentity(agent: { agentId: string; name: string } | null | undefined): Promise<AdvisorIdentity | null> {
  if (!agent) return null;
  try {
    const page = await withTimeout(fetchMyPage(agent.agentId), 5000);
    return {
      name: cleanName(page?.display_name) || cleanName(agent.name),
      photoUrl: page?.photo_url ?? null,
    };
  } catch {
    return { name: agent.name, photoUrl: null };
  }
}

/** A file-name stem from a person's name: letters and digits only, any script. */
export function fileStem(text: string | null | undefined, fallback: string): string {
  const stem = String(text ?? "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return stem || fallback;
}
