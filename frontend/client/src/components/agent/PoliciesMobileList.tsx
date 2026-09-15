import { ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { TYPE_META, typeLabel, getNextPremiumDate, type InsuranceType } from "@/lib/insuranceTypes"

/**
 * The phone view of the policy book.
 *
 * The desktop table carries eight columns; restacking it into cards produced a
 * 457px block per policy, which is worse than the table it replaced. This is a
 * purpose-built row instead: the four things an agent scans for — who, how bad,
 * with whom, when it renews — in about 90px, with the rest on the detail screen.
 *
 * Presentational only. Filtering, sorting and data loading stay in the page, so
 * both views read from exactly the same state.
 */

type Row = {
  id: string
  name: string | null
  policyholder_name: string | null
  insurer: string | null
  score: number | null
  expiry_date: string | null
  insurance_type: string | null
  extracted_data: any | null
}

function scoreBand(score: number) {
  // The 80 / 60 thresholds the portal already grades on.
  if (score >= 80) return "bg-green-100 text-green-700 border-green-200"
  if (score >= 60) return "bg-amber-100 text-amber-700 border-amber-200"
  return "bg-red-100 text-red-700 border-red-200"
}

function renewalChip(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  if (days < 0) return { text: "Overdue", cls: "bg-red-50 text-red-600" }
  if (days <= 7) return { text: `Renews in ${days} days`, cls: "bg-red-50 text-red-600" }
  if (days <= 30) return { text: `Renews in ${days} days`, cls: "bg-amber-50 text-amber-700" }
  return { text: `Renews ${format(d, "d MMM yyyy")}`, cls: "bg-slate-100 text-slate-600" }
}

export function PoliciesMobileList({
  rows,
  loading,
  emptyText,
  onOpen,
}: {
  rows: Row[]
  loading: boolean
  emptyText: string
  onOpen: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col gap-2 p-4">
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-5 w-28 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm italic text-slate-400">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {rows.map((p) => {
        const type = (p.insurance_type || "health") as InsuranceType
        const isHealth = type === "health"
        const chip = renewalChip(getNextPremiumDate(p.expiry_date, p.extracted_data))

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(p.id)}
            className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left last:border-b-0 active:bg-slate-50"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-base font-bold tracking-tight text-slate-900">
                  {p.policyholder_name || p.name || "—"}
                </span>
                {isHealth && p.score !== null && (
                  <span
                    className={`inline-flex min-h-6 min-w-[34px] shrink-0 items-center justify-center rounded-md border text-[13px] font-extrabold ${scoreBand(p.score)}`}
                  >
                    {p.score}
                  </span>
                )}
              </div>

              <span className="truncate text-[13px] text-slate-500">{p.insurer || "—"}</span>

              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex min-h-[23px] items-center rounded-md bg-slate-100 px-2 text-xs font-bold text-slate-600">
                  {TYPE_META[type]?.emoji} {typeLabel(p.insurance_type)}
                </span>
                {chip && (
                  <span className={`inline-flex min-h-[23px] items-center rounded-md px-2 text-xs font-bold ${chip.cls}`}>
                    {chip.text}
                  </span>
                )}
              </div>
            </div>

            <ChevronRight className="h-[19px] w-[19px] shrink-0 text-slate-300" />
          </button>
        )
      })}
    </div>
  )
}
