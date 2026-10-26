import { useEffect, useState } from "react"
import { Link } from "wouter"
import { CalendarClock, CheckCircle2, AlertTriangle, MessageCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useAgent } from "@/context/AgentContext"
import { apiFetch } from "@/lib/api"
import { isPlaygroundMode } from "@/lib/playground/mode"
import { PayButton } from "@/components/PayButton"
import { getPayConfig } from "@/lib/payments"
import { teamWaLink } from "@/components/app/portfolio-utils"
import { useLanguage } from "@/i18n/LanguageContext"

// /agent/plan: the advisor's own plan, and the only in-portal way to pay. Everything shown comes
// from GET /api/pay/billing (backend/server/services/payments.ts); prices match its SKUS table.

type Billing = {
  kind: "agent" | "individual"
  plan: string
  activeUntil: string | null
  inGrace: boolean
  payments: { orderRef: string; label: string; amount: number; status: string; paidAt: string | null; periodEnd: string | null; checksAdded: number }[]
}

const fmtDate = (d: string | null, locale: string) =>
  d ? new Date(d).toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) : ""

const btn = "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 text-base font-semibold text-white hover:bg-[#0f766e] disabled:opacity-60"
const btnOutline = "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#0D9488] bg-white px-4 text-base font-semibold text-[#0f766e] hover:bg-teal-50 disabled:opacity-60"

export default function AgentPlan() {
  const { t, locale } = useLanguage()
  const { agent, creditsRemaining, refresh } = useAgent()
  const [billing, setBilling] = useState<Billing | null>(null)
  const [failed, setFailed] = useState(false)
  const [payOn, setPayOn] = useState<boolean | null>(null)
  const demo = isPlaygroundMode()

  useEffect(() => {
    if (demo) return
    let live = true
    getPayConfig().then((c) => live && setPayOn(c.enabled))
    apiFetch("/api/pay/billing")
      .then(async (r) => {
        if (!live) return
        if (r.ok) setBilling(await r.json())
        else setFailed(true)
      })
      .catch(() => live && setFailed(true))
    void refresh()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo])

  // The server's billing view when it loads; otherwise the advisor's own profile row (what the
  // rest of the portal shows). Never a guess: a failed load must not show a paid advisor as Free.
  const plan = (billing?.plan || agent?.plan || "free").toLowerCase()
  const paid = plan !== "free"
  const activeUntil = billing ? billing.activeUntil : agent?.planExpiresAt ?? null
  const until = fmtDate(activeUntil, locale)
  const GRACE_MS = 3 * 86400_000
  const ended = !!activeUntil && new Date(activeUntil).getTime() < Date.now()
  const inGrace = paid && ended && new Date(activeUntil!).getTime() + GRACE_MS > Date.now()
  const waBuy = teamWaLink("Hi, I would like to buy or renew my IndSure Agent plan.")

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="border-b border-slate-100 pb-6">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("agentplan.title")}</h1>
        <p className="text-slate-600 font-medium text-[15px]">{t("agentplan.subtitle")}</p>
      </div>

      {demo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[15px] text-amber-900">{t("agentplan.demo")}</div>
      )}

      {/* CURRENT PLAN (not in the demo: it has no real plan to show) */}
      {!demo && <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">{t("agentplan.your_plan")}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{t(`agentplan.plan_${plan === "agent" || plan === "agency" ? plan : "free"}`)}</p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">{t("agentplan.active_until")}</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <CalendarClock className="h-5 w-5 text-[#0D9488]" aria-hidden="true" />
              {paid ? (until || t("agentplan.no_end")) : t("agentplan.free_forever")}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">{t("agentplan.checks_left")}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{creditsRemaining}</p>
          </div>
        </CardContent>
      </Card>}

      {inGrace && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[15px] text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{t("agentplan.grace", { date: until })}</p>
        </div>
      )}

      {!demo && payOn === false && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-[15px] text-slate-700">{t("agentplan.pay_off")}</div>
      )}
      {!demo && payOn === true && failed && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-[15px] text-slate-700">{t("agentplan.load_failed")}</div>
      )}

      {plan === "agency" ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 space-y-4">
            <p className="text-[15px] text-slate-700">{t("agentplan.agency_note")}</p>
            <a href={teamWaLink("Hi, I would like to renew or change my IndSure Agency plan.")} target="_blank" rel="noopener noreferrer" className={`${btnOutline} sm:w-auto`}>
              <MessageCircle className="h-5 w-5" aria-hidden="true" /> {t("agentplan.talk_wa")}
            </a>
          </CardContent>
        </Card>
      ) : !demo && (
        <>
          {/* AGENT PLAN: buy or renew */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">{paid ? t("agentplan.renew_title") : t("agentplan.upgrade_title")}</h2>
            <p className="text-[15px] text-slate-600">
              {paid && until ? t("agentplan.renew_note", { date: until }) : t("agentplan.upgrade_note")}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{t("agentplan.monthly")}</p>
                    <p className="text-3xl font-bold text-slate-900 tabular-nums">₹1,499</p>
                    <p className="text-[15px] text-slate-600">{t("agentplan.monthly_sub")}</p>
                  </div>
                  <PayButton sku="agent_monthly" audience="agent" className={btn} fallbackHref={waBuy} fallbackLabel={t("agentplan.buy_wa")}>
                    {t("agentplan.pay", { price: "₹1,499" })}
                  </PayButton>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white ring-2 ring-[#0D9488]">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{t("agentplan.yearly")}</p>
                    <p className="text-3xl font-bold text-slate-900 tabular-nums">₹14,990</p>
                    <p className="text-[15px] text-slate-600">{t("agentplan.yearly_sub")}</p>
                  </div>
                  <PayButton sku="agent_yearly" audience="agent" className={btn} fallbackHref={waBuy} fallbackLabel={t("agentplan.buy_wa")}>
                    {t("agentplan.pay", { price: "₹14,990" })}
                  </PayButton>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* TOP-UPS */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">{t("agentplan.topup_title")}</h2>
            {paid ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([["topup_5", 5, "₹449"], ["topup_15", 15, "₹1,199"]] as const).map(([sku, n, price]) => (
                  <Card key={sku} className="border-none shadow-sm bg-white">
                    <CardContent className="p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-2xl font-bold text-slate-900 tabular-nums">{price}</p>
                        <p className="text-[15px] text-slate-600">{t("agentplan.n_checks", { n })}</p>
                      </div>
                      <div className="sm:w-48">
                        <PayButton
                          sku={sku}
                          audience="agent"
                          className={btnOutline}
                          fallbackHref={teamWaLink(`Hi, I would like to buy the ${n}-check pack (${price}) on IndSure.`)}
                          fallbackLabel={t("agentplan.buy_wa")}
                        >
                          {t("agentplan.buy")}
                        </PayButton>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-[15px] text-slate-600">{t("agentplan.topup_needs_plan")}</p>
            )}
          </section>
        </>
      )}

      {/* HISTORY */}
      {billing && billing.payments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">{t("agentplan.history")}</h2>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-0 divide-y divide-slate-100">
              {billing.payments.map((p) => (
                <div key={p.orderRef} className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-slate-900">{p.label}</p>
                    <p className="text-sm text-slate-600">{fmtDate(p.paidAt, locale)} · {p.orderRef}</p>
                  </div>
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                    {p.status === "refunded"
                      ? <span className="text-slate-600">{t("agentplan.refunded")}</span>
                      : <CheckCircle2 className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />}
                    ₹{p.amount.toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <p className="text-[15px] text-slate-600">
        {t("agentplan.footer")}{" "}
        <Link href="/refunds" className="font-semibold text-[#0f766e] underline">{t("agentplan.refund_link")}</Link>
      </p>
    </div>
  )
}
