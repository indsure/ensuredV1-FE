// The advisor's side of the team-owner read.
//
// We tell an invited advisor, on the join screen and in the invite email, that
// their owner can read their book and that they will see each time it happens.
// This component is the second half of that promise — without it, that sentence
// would be a comfort rather than a fact.
//
// It renders nothing at all for an advisor who is not on a team, and nothing
// for the owner themselves (reading your own book is not an event).

import { useEffect, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAgent } from "@/context/AgentContext"
import { describeSurface, fetchMyAccessLog, type AccessLogEntry } from "@/lib/team"
import { useLanguage } from "@/i18n/LanguageContext"
import { getSavedLocale, intlLocale, tOr } from "@/i18n"

function whenExactly(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(intlLocale(getSavedLocale()), {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  })
}

export default function TeamAccessLog() {
  const { team } = useAgent()
  const { t } = useLanguage()
  const [reads, setReads] = useState<AccessLogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const show = !!team && !team.isOwner

  useEffect(() => {
    if (!show) return
    let cancelled = false
    fetchMyAccessLog()
      .then((r) => { if (!cancelled) { setReads(r.reads); setError(null) } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : t("access_log.load_failed")) })
    return () => { cancelled = true }
  }, [show])

  if (!show) return null

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">
          {t("access_log.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <p className="text-sm text-slate-600 leading-relaxed">
          {t("access_log.desc", { team: team!.name })}
        </p>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {reads && reads.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            {t("access_log.nobody")}
          </p>
        )}

        {reads && reads.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100">
            {reads.map((r) => (
              <li key={r.id} className="py-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-slate-900">{r.owner_name}</span>
                <span className="text-sm text-slate-600">{tOr(t, `access_log.s_${r.surface}`, describeSurface(r.surface))}</span>
                <span className="text-sm text-slate-500 ml-auto">{whenExactly(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
