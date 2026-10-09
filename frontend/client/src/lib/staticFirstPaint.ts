import { useState } from "react";

/**
 * "Static first paint" mode for prerendered pages.
 *
 * scripts/prerender.mjs renders the main public pages to real HTML at build
 * time, so they paint before any JavaScript arrives, and main.tsx then hydrates
 * that HTML instead of replacing it. Entrance animations break both halves of
 * that: a motion element renders `opacity:0` until it animates, so the HTML
 * would paint as a blank page, and the server and the hydrating client would
 * have to agree on every animated style.
 *
 * So while this mode is on, the motion primitives (and the few hand-rolled
 * entrances on prerendered pages) render their content plainly, exactly as
 * they already do for visitors who ask for reduced motion. It is on for the
 * build-time render and for the hydrating first page view, and switches off at
 * the first client-side navigation, so every page after that animates as
 * before. Each component reads it once, when it mounts, so a mounted element
 * never flips between the two renders.
 */
let staticFirstPaint = false;

export function enableStaticFirstPaint(): void {
  staticFirstPaint = true;
}

export function endStaticFirstPaint(): void {
  staticFirstPaint = false;
}

/** True when this component mounted as part of a prerendered first paint. */
export function useStaticFirstPaint(): boolean {
  const [value] = useState(() => staticFirstPaint);
  return value;
}
