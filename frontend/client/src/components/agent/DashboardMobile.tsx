import { Link } from "wouter"
import { CalendarDays, AlertTriangle, TrendingDown, ChevronRight, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { useLanguage } from "@/i18n/LanguageContext"
import { dateLocale } from "@/i18n"

/**
 * The phone view of the agent dashboard.
 *
 * Desktop opens on stat tiles and a performance chart — useful when you are
 * sitting down to review the book. On a phone the agent is between calls, so
 * this leads with the three things that need doing today and puts WhatsApp one
 * tap from each name.
 *
 * Built entirely from data the dashboard already fetches. No extra requests.
 */

type Policy = {
  id: string
  name: string | null
  policyholder_name: string | null
  insurer: string
  score: number | null
  expiry_date: string | null
}

type FailedJob = {
  id: string
  error_message: string | null
  policy_name: string | null
  name: string | null
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function displayName(p: Policy) {
  return p.policyholder_name || p.name || "—"
}

function Section({
  title,
  count,
  tone,
  icon,
  cta,
  href,
  children,
}: {
  title: string
  count: number
  tone: "amber" | "red" | "teal"
  icon: React.ReactNode
  cta: string
  href: string
  children: React.ReactNode
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-600",
    teal: "bg-teal-50 text-teal-700",
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-3.5 py-3">
        <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] ${tones[tone]}`}>
          {icon}
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-bold tracking-tight text-slate-900">{title}</span>
        <span className={`inline-flex min-h-[22px] shrink-0 items-center rounded-full px-2.5 text-xs font-extrabold ${tones[tone]}`}>
          {count}
        </span>
      </div>
      {children}
      <Link
        href={href}
        className="flex min-h-[46px] items-center justify-center gap-1.5 text-[13px] font-bold text-[#0D9488]"
      >
        {cta}
        <ChevronRight className="h-[15px] w-[15px]" strokeWidth={2.2} />
      </Link>
    </div>
  )
}

function Row({
  id,
  title,
  sub,
  chip,
  chipCls,
  onOpen,
}: {
  id: string
  title: string
  sub: string
  chip?: string
  chipCls?: string
  onOpen: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-50 px-3.5 py-2.5">
      <button
        type="button"
        onClick={() => onOpen(id)}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
      >
        <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{title}</span>
        <span className="truncate text-[13px] text-slate-500">{sub}</span>
        {chip && (
          <span className={`mt-1 inline-flex min-h-[22px] w-fit items-center rounded-md px-2 text-xs font-bold ${chipCls}`}>
            {chip}
          </span>
        )}
      </button>
    </div>
  )
}

export function DashboardMobile({
  agentName,
  loading,
  expiringSoon,
  atRisk,
  failedJobs,
  onOpenPolicy,
  onOpenQueue,
}: {
  agentName: string
  loading: boolean
  expiringSoon: Policy[]
  atRisk: Policy[]
  failedJobs: FailedJob[]
  onOpenPolicy: (id: string) => void
  onOpenQueue: () => void
}) {
  const { t, locale } = useLanguage()
  const hour = new Date().getHours()
  const greeting = t(hour < 12 ? "dashboard.good_morning" : hour < 17 ? "dashboard.good_afternoon" : "dashboard.good_evening")

  const renewals = expiringSoon.slice(0, 3)
  const risky = atRisk.slice(0, 3)
  const failures = failedJobs.slice(0, 3)
  const total = renewals.length + risky.length + failures.length

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
          {greeting}, {agentName}
        </h1>
        <p className="text-[13px] font-medium text-slate-500">{format(new Date(), "EEEE, d MMMM", { locale: dateLocale(locale) })}</p>
      </div>

      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">{t("dash_mobile.needs_you")}</span>
        <span className="text-xs font-bold text-[#0D9488]">
          {t(total === 1 ? "dash_mobile.item_one" : "dash_mobile.item_many", { count: total })}
        </span>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-[15px] font-semibold text-slate-700">{t("dash_mobile.nothing_title")}</p>
          <p className="mt-1 text-[13px] text-slate-500">{t("dash_mobile.nothing_desc")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {renewals.length > 0 && (
            <Section
              title={t("dash_mobile.renewals_title")}
              count={renewals.length}
              tone="amber"
              icon={<CalendarDays className="h-[17px] w-[17px]" strokeWidth={2} />}
              cta={t("dash_mobile.renewals_cta")}
              href="/agent/policies"
            >
              {renewals.map((p) => {
                const d = daysUntil(p.expiry_date)
                return (
                  <Row
                    key={p.id}
                    id={p.id}
                    title={displayName(p)}
                    sub={p.insurer || "—"}
                    chip={d === null ? undefined : d < 0 ? t("dash_mobile.overdue") : t("dash_mobile.renews_in", { days: d })}
                    chipCls={d !== null && d <= 7 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}
                    onOpen={onOpenPolicy}
                  />
                )
              })}
            </Section>
          )}

          {risky.length > 0 && (
            <Section
              title={t("dash_mobile.weak_title")}
              count={risky.length}
              tone="red"
              icon={<TrendingDown className="h-[17px] w-[17px]" strokeWidth={2} />}
              cta={t("dash_mobile.weak_cta")}
              href="/agent/policies"
            >
              {risky.map((p) => (
                <Row
                  key={p.id}
                  id={p.id}
                  title={displayName(p)}
                  sub={p.insurer || "—"}
                  chip={p.score !== null ? t("dash_mobile.scores", { score: p.score }) : undefined}
                  chipCls="bg-red-50 text-red-600"
                  onOpen={onOpenPolicy}
                />
              ))}
            </Section>
          )}

          {failures.length > 0 && (
            <Section
              title={t("dash_mobile.failed_title")}
              count={failures.length}
              tone="red"
              icon={<AlertTriangle className="h-[17px] w-[17px]" strokeWidth={2} />}
              cta={t("dash_mobile.failed_cta")}
              href="/agent/my-queue"
            >
              {failures.map((j) => (
                <div key={j.id} className="flex items-center gap-2.5 border-b border-slate-50 px-3.5 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                      {j.name || j.policy_name || t("dash_mobile.upload")}
                    </span>
                    <span className="truncate text-[13px] text-slate-500">{j.error_message || t("dash_mobile.analysis_failed")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenQueue}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-[#0D9488] px-3.5 text-[13px] font-bold text-white"
                  >
                    <RefreshCw className="h-[15px] w-[15px]" strokeWidth={2.2} />
                    {t("dash_mobile.retry")}
                  </button>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
