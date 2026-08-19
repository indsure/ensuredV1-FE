import { apiFetch } from "@/lib/api";

// Client half of the upload-before-signup flow.
//
// A visitor with no account uploads a policy, the server parks it and hands
// back an opaque token, and we hold that token here while they sign up. On the
// way back — from either /signup or /login — the token is redeemed and the
// normal metered analysis begins.
//
// sessionStorage, not localStorage, on purpose: the token is a claim on a file
// that expires server-side in 24 hours, and it should not outlive the tab. A
// stale token in localStorage would resurface days later and fail confusingly.

const KEY = "indsure_pending_upload";

export type PendingUpload = {
  token: string;
  filename: string;
  insuranceType: string;
  expiresInHours: number;
};

export function savePendingUpload(p: PendingUpload) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode / storage disabled — the flow still works, it just cannot
       survive a page reload, and the upload screen re-prompts. */
  }
}

export function readPendingUpload(): PendingUpload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingUpload) : null;
  } catch {
    return null;
  }
}

export function clearPendingUpload() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

export type ClaimResult =
  | { status: "started"; policyId: string; jobId: string }
  | { status: "needs_upgrade"; reason?: string }
  | { status: "none" }
  | { status: "failed"; message: string };

// Redeem a held upload. Call after authentication and after /api/me/bootstrap,
// so the profile row the quota check reads definitely exists.
//
// The token is kept on NEEDS_UPGRADE and cleared on every other outcome: an
// upgrade is recoverable and the file is still parked server-side, whereas an
// expired or already-claimed token will never succeed and holding it would put
// the user in a loop.
export async function claimPendingUpload(): Promise<ClaimResult> {
  const pending = readPendingUpload();
  if (!pending?.token) return { status: "none" };

  try {
    const res = await apiFetch("/api/me/claim-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: pending.token }),
    });

    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      return { status: "needs_upgrade", reason: body.reason };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      clearPendingUpload();
      return { status: "failed", message: body.message || "We could not start your analysis." };
    }

    const { policyId, jobId } = await res.json();
    clearPendingUpload();
    return { status: "started", policyId, jobId };
  } catch (e: any) {
    clearPendingUpload();
    return { status: "failed", message: e?.message || "We could not start your analysis." };
  }
}
