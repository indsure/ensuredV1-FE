import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Clock, XCircle, Loader2, MessageCircle, Phone } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { apiFetch } from "@/lib/api";
import { getSupabase } from "@/lib/supabaseLazy";
import { TEAM_WHATSAPP, teamWaLink } from "@/components/app/portfolio-utils";
import { useLanguage } from "@/i18n/LanguageContext";

type Status = {
  orderRef: string;
  status: "created" | "pending" | "paid" | "expired" | "refunded";
  label: string;
  amount: number;
  periodEnd: string | null;
  checksAdded: number;
  sku: string;
};

const POLL_MS = 4000;
const POLL_FOR_MS = 2 * 60 * 1000;

// Where every payment lands: after Cashfree's box closes, and as Cashfree's return_url when the
// box could not open (in-app browsers). It only ever shows what OUR server says, and our server
// only says "paid" after Cashfree confirms it.
export default function PayStatus() {
  const { t } = useLanguage();
  const orderRef = new URLSearchParams(window.location.search).get("order_id") || "";
  const [data, setData] = useState<Status | null>(null);
  const [phase, setPhase] = useState<"loading" | "signin" | "notfound" | "ok" | "gaveup">("loading");
  const started = useRef(Date.now());

  useEffect(() => {
    if (!orderRef) {
      setPhase("notfound");
      return;
    }
    let stop = false;
    let timer: number | undefined;

    async function tick() {
      let signedIn = false;
      try {
        const supabase = await getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        signedIn = !!session;
      } catch { /* auth unavailable: treat as signed out rather than spin forever */ }
      if (!signedIn) {
        setPhase("signin");
        return;
      }
      try {
        const r = await apiFetch(`/api/pay/status/${encodeURIComponent(orderRef)}`);
        if (r.status === 404) {
          setPhase("notfound");
          return;
        }
        if (r.ok) {
          const s = (await r.json()) as Status;
          if (stop) return;
          setData(s);
          setPhase("ok");
          if (s.status === "paid" || s.status === "expired" || s.status === "refunded") return;
        }
      } catch { /* network blip: keep polling */ }
      if (Date.now() - started.current > POLL_FOR_MS) {
        setPhase("gaveup");
        return;
      }
      if (!stop) timer = window.setTimeout(tick, POLL_MS);
    }
    tick();
    return () => {
      stop = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderRef]);

  const isAgent = data ? !data.sku.startsWith("personal_") : true;
  const portal = isAgent ? "/agent/dashboard" : "/app";
  const until = data?.periodEnd
    ? new Date(data.periodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
    : null;

  let icon = <Loader2 className="h-12 w-12 animate-spin text-[var(--color-teal-600)]" aria-hidden="true" />;
  let title = t("pay.checking");
  let body: string | null = null;

  if (phase === "signin") {
    icon = <Clock className="h-12 w-12 text-[var(--color-teal-600)]" aria-hidden="true" />;
    title = t("pay.signin_title");
    body = t("pay.signin_body");
  } else if (phase === "notfound") {
    icon = <XCircle className="h-12 w-12 text-[#B91C1C]" aria-hidden="true" />;
    title = t("pay.notfound_title");
    body = t("pay.notfound_body");
  } else if (data?.status === "paid") {
    icon = <CheckCircle2 className="h-12 w-12 text-[var(--color-green-primary)]" aria-hidden="true" />;
    title = t("pay.paid_title");
    body = [
      t("pay.paid_body", { item: data.label }),
      until ? t("pay.paid_until", { date: until }) : null,
      data.checksAdded > 0 ? t("pay.paid_checks", { n: data.checksAdded }) : null,
    ].filter(Boolean).join(" ");
  } else if (data?.status === "expired") {
    icon = <XCircle className="h-12 w-12 text-[#B91C1C]" aria-hidden="true" />;
    title = t("pay.failed_title");
    body = t("pay.failed_body");
  } else if (phase === "gaveup" || data?.status === "pending" || data?.status === "created") {
    icon = <Clock className="h-12 w-12 text-[var(--color-teal-600)]" aria-hidden="true" />;
    title = t("pay.pending_title");
    body = t("pay.pending_body");
  }

  const done = data?.status === "paid";

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />
      <main className="flex-grow pt-28 pb-16 px-4 w-full">
        <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.05)]" aria-live="polite">
          <div className="mb-4 flex justify-center">{icon}</div>
          <h1 className="mb-3 font-serif text-3xl text-[var(--color-navy-900)]">{title}</h1>
          {body && <p className="mb-6 text-[17px] leading-relaxed text-[var(--color-text-secondary)]">{body}</p>}
          {orderRef && (
            <p className="mb-6 text-[15px] text-[var(--color-text-secondary)]">
              {t("pay.ref", { ref: orderRef })}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {phase === "signin" ? (
              <>
                <Link
                  href={`/agent/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                  className="inline-flex h-[52px] items-center justify-center rounded-lg bg-[var(--color-cta)] px-6 text-base font-semibold text-white"
                >
                  {t("pay.signin_cta")}
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-[var(--color-border-medium)] bg-white px-6 text-base font-semibold"
                >
                  {t("pay.signin_personal")}
                </Link>
              </>
            ) : (
              <Link
                href={done ? portal : isAgent ? "/advisors/pricing" : "/pricing"}
                className="inline-flex h-[52px] items-center justify-center rounded-lg bg-[var(--color-cta)] px-6 text-base font-semibold text-white"
              >
                {done ? t("pay.go_portal") : t("pay.back_plans")}
              </Link>
            )}

            {!done && (
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={teamWaLink(`Hi, I need help with my IndSure payment ${orderRef}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[var(--color-border-medium)] bg-white text-base font-semibold"
                >
                  <MessageCircle className="h-5 w-5" aria-hidden="true" /> {t("pay.whatsapp")}
                </a>
                <a
                  href={`tel:+${TEAM_WHATSAPP}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[var(--color-border-medium)] bg-white text-base font-semibold"
                >
                  <Phone className="h-5 w-5" aria-hidden="true" /> {t("pay.call")}
                </a>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
