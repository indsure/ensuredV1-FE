// Cashfree checkout from the browser. The server picks the price and creates the order
// (backend/server/services/payments.ts); this file only opens Cashfree's payment box with the
// session id it gets back. Nothing here decides that a payment succeeded: /pay/status asks
// the server, which asks Cashfree.

import { apiFetch } from "./api";

export type PaySku =
  | "agent_monthly" | "agent_yearly" | "topup_5" | "topup_15"
  | "personal_monthly" | "personal_yearly";

export type PayConfig = { enabled: boolean; mode: "sandbox" | "production" };

let configPromise: Promise<PayConfig> | null = null;

export function getPayConfig(): Promise<PayConfig> {
  if (!configPromise) {
    configPromise = apiFetch("/api/pay/config")
      .then((r) => (r.ok ? r.json() : { enabled: false, mode: "sandbox" }))
      .catch(() => ({ enabled: false, mode: "sandbox" as const }));
  }
  return configPromise;
}

// Cashfree.js v3, loaded only when someone actually pays (keeps it off every other page).
const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";
let sdkPromise: Promise<any> | null = null;

function loadSdk(): Promise<any> {
  if ((window as any).Cashfree) return Promise.resolve((window as any).Cashfree);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => ((window as any).Cashfree ? resolve((window as any).Cashfree) : reject(new Error("sdk")));
      s.onerror = () => {
        sdkPromise = null;
        reject(new Error("sdk"));
      };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

export class PayError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

// Creates the order and opens the payment box. Resolves with the order reference when the box
// finishes a payment; the caller then shows /pay/status, which asks the server what really
// happened. Throws PayError("NOT_PAID") when the payment fails or the box is closed. In browsers
// that cannot show the box (in-app browsers), Cashfree navigates to /pay/status itself and this
// never resolves.
export async function startCheckout(sku: PaySku, phone?: string): Promise<string> {
  const res = await apiFetch("/api/pay/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku, ...(phone ? { phone } : {}) }),
  });
  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new PayError(body?.error || "ERROR", body?.message || "Something went wrong. Please try again.");
  }
  const cashfree = await getCashfree(body.mode === "production" ? "production" : "sandbox");
  const result = await cashfree.checkout({ paymentSessionId: body.paymentSessionId, redirectTarget: "_modal" });
  // Three outcomes (pg/web-sdk): an error (failed, or the box was closed) keeps the person on the
  // page with the message; a redirect means Cashfree is already navigating to /pay/status; payment
  // details mean the box finished, and /pay/status asks the server whether it was really paid.
  if (result?.error && !result?.paymentDetails) {
    throw new PayError("NOT_PAID", result.error.message || "The payment was not completed. You can try again.");
  }
  if (result?.redirect) return new Promise<string>(() => { /* the page is navigating away */ });
  return body.orderRef as string;
}

// One Cashfree instance per page (Cashfree's rule: initialise once, not on every click).
let instance: { mode: string; cf: any } | null = null;

async function getCashfree(mode: "sandbox" | "production"): Promise<any> {
  if (instance?.mode === mode) return instance.cf;
  const Cashfree = await loadSdk().catch(() => {
    throw new PayError("SDK", "The payment window could not load. Check your internet and try again.");
  });
  instance = { mode, cf: Cashfree({ mode }) };
  return instance.cf;
}
