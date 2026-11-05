import { apiFetch } from "@/lib/api";

// Client half of "Check My Existing Policy" on a calculator report.
//
// A signed-out visitor presses it, we hold the report's id here, they sign in
// or sign up, and /app saves the calculation to their account so the portfolio
// can show ideal cover against the cover they hold.
//
// localStorage, not sessionStorage (unlike pendingUpload.ts): the id is not a
// claim on anything private, and signup ends with a confirmation email that is
// often opened in a new tab, which sessionStorage would not reach. It expires
// after a day so a stale id cannot resurface weeks later.

const KEY = "indsure_pending_calculation";
const TTL_MS = 24 * 60 * 60 * 1000;

export function savePendingCalculation(uuid: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ uuid, at: Date.now() }));
  } catch {
    /* private mode / storage disabled: the person lands on /app without the card */
  }
}

function readPendingCalculation(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { uuid?: string; at?: number };
    if (!p.uuid || !p.at || Date.now() - p.at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return p.uuid;
  } catch {
    return null;
  }
}

function clearPendingCalculation() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/**
 * Save a held calculation to the signed-in account. Returns true when one was
 * saved. Cleared on every outcome except a network failure, so a report that
 * has expired cannot keep failing on every visit.
 */
export async function claimPendingCalculation(): Promise<boolean> {
  const uuid = readPendingCalculation();
  if (!uuid) return false;
  try {
    const res = await apiFetch("/api/me/calculator/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uuid }),
    });
    clearPendingCalculation();
    return res.ok;
  } catch {
    return false;
  }
}

export type LatestCalculation = { uuid: string; createdAt: string; recommendedCover: number };

export async function fetchLatestCalculation(): Promise<LatestCalculation | null> {
  try {
    const res = await apiFetch("/api/me/calculator/latest");
    if (!res.ok) return null;
    const body = await res.json();
    return body?.report ?? null;
  } catch {
    return null;
  }
}
