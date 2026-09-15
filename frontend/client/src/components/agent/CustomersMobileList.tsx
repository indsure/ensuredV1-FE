import { ChevronRight, Users } from "lucide-react"
import { format } from "date-fns"

/**
 * The phone view of the customer book.
 *
 * The desktop table carries six columns; on a phone the useful scan is who,
 * how much cover they hold with you, and what is due next. Contact details and
 * the per-type breakdown live on the detail screen.
 *
 * Presentational only — the page owns loading, search and the data.
 */

type Customer = {
  id: string
  name: string
  city: string | null
  phone: string | null
  email: string | null
}

type Stats = {
  policyCount: number
  totalSumInsured: number | null
  nextPremium: { date: string } | null
}

export function CustomersMobileList({
  customers,
  statsFor,
  formatAmount,
  loading,
  emptyText,
  onOpen,
}: {
  customers: Customer[]
  statsFor: (id: string) => Stats | undefined
  formatAmount: (n: number | null) => string
  loading: boolean
  emptyText: string
  onOpen: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-2 p-4">
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <Users className="mx-auto mb-3 h-8 w-8 text-slate-200" />
        <p className="text-sm italic text-slate-400">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {customers.map((c) => {
        const s = statsFor(c.id)
        const due = s?.nextPremium ? new Date(s.nextPremium.date) : null
        const dueValid = due && !isNaN(due.getTime())

        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left last:border-b-0 active:bg-slate-50"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-base font-bold tracking-tight text-slate-900">
                  {c.name}
                </span>
                {s && s.policyCount > 0 && (
                  <span className="inline-flex min-h-6 shrink-0 items-center rounded-md bg-slate-100 px-2 text-xs font-bold text-slate-600">
                    {s.policyCount} {s.policyCount === 1 ? "policy" : "policies"}
                  </span>
                )}
              </div>

              <span className="truncate text-[13px] text-slate-500">
                {c.phone || c.city || "No contact saved"}
              </span>

              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {s && s.totalSumInsured ? (
                  <span className="inline-flex min-h-[23px] items-center rounded-md bg-teal-50 px-2 text-xs font-bold text-teal-700">
                    {formatAmount(s.totalSumInsured)} cover
                  </span>
                ) : (
                  <span className="inline-flex min-h-[23px] items-center rounded-md bg-slate-100 px-2 text-xs font-bold text-slate-500">
                    No policies tagged
                  </span>
                )}
                {dueValid && (
                  <span className="inline-flex min-h-[23px] items-center rounded-md bg-amber-50 px-2 text-xs font-bold text-amber-700">
                    Due {format(due!, "d MMM")}
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
