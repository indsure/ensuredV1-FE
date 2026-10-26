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

// Creates the order and opens the payment box. Resolves with the order reference once the
// box closes (paid, failed or dismissed); the caller then shows /pay/status, which asks the
// server what really happened. In browsers that cannot show the box (in-app browsers),
// Cashfree navigates to /pay/status itself and this never resolves.
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
  const Cashfree = await loadSdk().catch(() => {
    throw new PayError("SDK", "The payment window could not load. Check your internet and try again.");
  });
  const cashfree = Cashfree({ mode: body.mode === "production" ? "production" : "sandbox" });
  await cashfree.checkout({ paymentSessionId: body.paymentSessionId, redirectTarget: "_modal" });
  return body.orderRef as string;
}
