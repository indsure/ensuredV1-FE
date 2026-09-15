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

function whenExactly(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  })
}

export default function TeamAccessLog() {
  const { team } = useAgent()
  const [reads, setReads] = useState<AccessLogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const show = !!team && !team.isOwner

  useEffect(() => {
    if (!show) return
    let cancelled = false
    fetchMyAccessLog()
      .then((r) => { if (!cancelled) { setReads(r.reads); setError(null) } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this.") })
    return () => { cancelled = true }
  }, [show])

  if (!show) return null

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">
          Who opened your book
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <p className="text-sm text-slate-600 leading-relaxed">
          You are on <span className="font-semibold text-slate-900">{team!.name}</span>. The team owner
          can read the customers, policies, leads and claims you add — not change them, and never the
          documents on a claim or the original file on a policy. Every time they look, it is listed here.
        </p>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {reads && reads.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            Nobody has opened your book yet.
          </p>
        )}

        {reads && reads.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100">
            {reads.map((r) => (
              <li key={r.id} className="py-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-slate-900">{r.owner_name}</span>
                <span className="text-sm text-slate-600">{describeSurface(r.surface)}</span>
                <span className="text-sm text-slate-500 ml-auto">{whenExactly(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
