import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabaseLazy";
import { getPayConfig, startCheckout, PayError, type PaySku } from "@/lib/payments";
import { useLanguage } from "@/i18n/LanguageContext";

type Props = {
  sku: PaySku;
  /** Which login a signed-out visitor is sent to. */
  audience: "agent" | "individual";
  className: string;
  children: ReactNode;
  /** Where the button goes while payments are switched off on the server (the old WhatsApp path). */
  fallbackHref: string;
  /** Label for that fallback link, e.g. "Upgrade on WhatsApp". */
  fallbackLabel: ReactNode;
};

// A Pay button that degrades to the previous WhatsApp link until the backend has Cashfree keys,
// so the frontend can ship before (or without) the backend switch.
export function PayButton({ sku, audience, className, children, fallbackHref, fallbackLabel }: Props) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askPhone, setAskPhone] = useState(false);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    let live = true;
    getPayConfig().then((c) => live && setEnabled(c.enabled));
    return () => { live = false; };
  }, []);

  if (enabled === false) {
    return (
      <a href={fallbackHref} target="_blank" rel="noopener noreferrer" className={className}>
        {fallbackLabel}
      </a>
    );
  }

  async function pay() {
    setError(null);
    setBusy(true);
    try {
      const supabase = await getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const here = window.location.pathname + window.location.search;
        setLocation(`${audience === "agent" ? "/agent/login" : "/login"}?next=${encodeURIComponent(here)}`);
        return;
      }
      const ref = await startCheckout(sku, askPhone ? phone : undefined);
      setLocation(`/pay/status?order_id=${encodeURIComponent(ref)}`);
    } catch (e) {
      if (e instanceof PayError && e.code === "PHONE_REQUIRED") {
        setAskPhone(true);
        setError(askPhone ? e.message : null);
      } else {
        setError(e instanceof Error ? e.message : t("pay.err_generic"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {askPhone && (
        <label className="flex flex-col gap-1 text-left text-[15px] text-[var(--color-text-main)]">
          {t("pay.phone_label")}
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98765 43210"
            className="h-12 rounded-lg border border-[var(--color-border-medium)] bg-white px-3 text-base"
          />
        </label>
      )}
      <button type="button" onClick={pay} disabled={busy || enabled === null} className={className}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {askPhone ? t("pay.continue") : children}
      </button>
      {error && (
        <p role="alert" className="text-left text-[15px] font-medium text-[#B91C1C]">
          {error}
        </p>
      )}
    </div>
  );
}
