// One advisor, as their team owner sees them.
//
// Two rules this screen exists to keep visible:
//   • It is READ-ONLY. There is no edit, no delete, no re-run, no download on
//     anything here. The backend would refuse anyway — nothing in teamRoutes.ts
//     writes to a member's rows — but the screen must not offer what it cannot do.
//   • The advisor is told. The banner is not decoration: every tab below fetches
//     through an endpoint that writes a team_access_log row, and the advisor
//     reads those rows in their own Settings.
//
// The two absences are deliberate and load-bearing: no link to the original
// uploaded PDF, and no way to open the documents on a claim.

import { useEffect, useState } from "react"
import { Link, useRoute } from "wouter"
import { ArrowLeft, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TableRowSkeleton } from "@/components/ui/skeleton"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import {
  fetchMember, fetchMemberClaims, fetchMemberCustomers, fetchMemberLeads, fetchMemberPolicies,
  type MemberDetail,
} from "@/lib/team"

type Tab = "policies" | "customers" | "leads" | "claims"

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function fmtMoney(n: number | string | null): string {
  if (n === null || n === undefined || n === "") return "—"
  const v = Number(n)
  return Number.isFinite(v) ? `₹${v.toLocaleString("en-IN")}` : "—"
}

function scoreChip(score: number | null): string {
  if (score === null || score === undefined) return "bg-slate-100 text-slate-600 border-slate-200"
  if (score >= 80) return "bg-green-50 text-green-700 border-green-200"
  if (score >= 60) return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-red-50 text-red-700 border-red-200"
}

export default function TeamMember() {
  const [, params] = useRoute("/agent/team/:id")
  const memberId = params?.id ?? ""

  const [member, setMember] = useState<MemberDetail | null>(null)
  const [checksPerSeat, setChecksPerSeat] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>("policies")
  const [rows, setRows] = useState<Record<Tab, any[] | null>>({
    policies: null, customers: null, leads: null, claims: null,
  })
  const [tabLoading, setTabLoading] = useState(false)
  const [tabError, setTabError] = useState<string | null>(null)

  useEffect(() => {
    if (!memberId) return
    let cancelled = false
    setLoading(true)
    fetchMember(memberId)
      .then((r) => {
        if (cancelled) return
        setMember(r.member); setChecksPerSeat(r.checksPerSeat); setError(null)
      })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this advisor.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [memberId])

  // Each tab loads once, on first open. That keeps the audit log honest about
  // what was actually looked at rather than logging four reads for one visit.
  useEffect(() => {
    if (!memberId || rows[tab] !== null) return
    let cancelled = false
    setTabLoading(true); setTabError(null)

    const load = tab === "policies" ? fetchMemberPolicies(memberId).then((r) => r.policies)
      : tab === "customers" ? fetchMemberCustomers(memberId).then((r) => r.customers)
      : tab === "leads" ? fetchMemberLeads(memberId).then((r) => r.leads)
      : fetchMemberClaims(memberId).then((r) => r.claims)

    load
      .then((data) => { if (!cancelled) setRows((prev) => ({ ...prev, [tab]: data })) })
      .catch((e: unknown) => { if (!cancelled) setTabError(e instanceof Error ? e.message : "Could not load that.") })
      .finally(() => { if (!cancelled) setTabLoading(false) })

    return () => { cancelled = true }
  }, [tab, memberId, rows])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="h-8 w-56 bg-slate-100 rounded mb-6" />
        <TableRowSkeleton />
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <InlineErrorState message={error ?? "Advisor not found."} onRetry={() => window.location.reload()} />
        <Link href="/agent/team" className="mt-4 inline-flex items-center min-h-[44px] text-sm font-semibold text-teal-700">
          Back to Team
        </Link>
      </div>
    )
  }

  const current = rows[tab]

  return (
    <div>
      {/* Standing banner. It stays on screen for as long as the owner is in
          someone else's book — this is not a one-time notice. */}
      <div className="bg-[#082F2A] text-white px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <Eye className="h-5 w-5 flex-none text-teal-300" />
          <p className="text-sm font-medium leading-relaxed flex-1 min-w-[16rem]">
            You are reading {member.name || "this advisor"}'s book as team owner.{" "}
            {(member.name || "They").split(" ")[0]} can see that you opened it, and nothing here can be
            changed or deleted from your side.
          </p>
          <Link
            href="/agent/team"
            className="inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-lg border border-white/25 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Team
          </Link>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="h-12 w-12 flex-none rounded-full bg-slate-100 grid place-items-center text-base font-bold text-slate-600">
            {(member.name || member.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">{member.name || member.email}</h1>
            <p className="mt-0.5 text-sm text-slate-600">
              Advisor · joined {fmtDate(member.created_at)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className={`bg-white rounded-xl p-4 border ${Number(member.checks_left) === 0 ? "border-red-200 border-l-4 border-l-red-400" : "border-slate-200"}`}>
            <div className={`text-sm font-bold uppercase tracking-wider ${Number(member.checks_left) === 0 ? "text-red-600" : "text-slate-500"}`}>Checks left</div>
            <div className={`mt-1 text-2xl font-bold tracking-tight ${Number(member.checks_left) === 0 ? "text-red-600" : "text-slate-900"}`}>
              {member.checks_left} <span className="text-base text-slate-500">of {checksPerSeat}</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Data entry left</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {member.entry_left} <span className="text-base text-slate-500">of 50</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Customers</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{member.customers}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Policies</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{member.policies}</div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="policies" className="min-h-[44px]">Policies</TabsTrigger>
            <TabsTrigger value="customers" className="min-h-[44px]">Customers</TabsTrigger>
            <TabsTrigger value="leads" className="min-h-[44px]">Leads</TabsTrigger>
            <TabsTrigger value="claims" className="min-h-[44px]">Claims</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {tabLoading && <TableRowSkeleton />}
            {tabError && <InlineErrorState message={tabError} onRetry={() => setRows((prev) => ({ ...prev, [tab]: null }))} />}

            {!tabLoading && !tabError && current && current.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <p className="text-sm text-slate-600">
                  {(member.name || "This advisor").split(" ")[0]} has not added any {tab} yet.
                </p>
              </div>
            )}

            {!tabLoading && !tabError && current && current.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  {tab === "policies" && <PoliciesTable rows={current} />}
                  {tab === "customers" && <CustomersTable rows={current} />}
                  {tab === "leads" && <LeadsTable rows={current} />}
                  {tab === "claims" && <ClaimsTable rows={current} />}
                </div>
              </div>
            )}

            {/* The honest footnote about what this view does NOT carry. It sits
                under the data rather than in a tooltip, because an owner who
                cannot find a document should learn why here. */}
            {!tabLoading && !tabError && current && current.length > 0 && (
              <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                {tab === "claims"
                  ? "Claim documents — bills, discharge summaries, ID proof — are not shown. They are held for the advisor who collected them and are deleted on the schedule the customer was told about."
                  : tab === "policies"
                  ? "The original policy PDF is not shown. You are reading the analysis, not the customer's document."
                  : "Read-only. Nothing on this page can be changed or deleted from your side."}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

/* ── Tables ───────────────────────────────────────────────────────────────── */

function PoliciesTable({ rows }: { rows: any[] }) {
  return (
    <table className="table-cards w-full text-sm">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr className="text-left text-sm text-slate-500 uppercase tracking-wider font-semibold">
          <th className="px-5 py-3.5">Customer</th>
          <th className="px-3 py-3.5">Type</th>
          <th className="px-3 py-3.5">Insured with</th>
          <th className="px-3 py-3.5">Expires</th>
          <th className="px-3 py-3.5">Score</th>
          <th className="px-5 py-3.5">Added</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id} className="border-b border-slate-100 last:border-0">
            <td className="px-5 py-3.5 font-semibold text-slate-900" data-label="Customer">{p.policyholder_name || p.name || "—"}</td>
            <td className="px-3 py-3.5" data-label="Type">
              <span className="inline-flex items-center min-h-[22px] px-2.5 rounded-full bg-slate-100 text-slate-600 text-sm font-bold uppercase tracking-wide">
                {p.insurance_type || "—"}
              </span>
            </td>
            <td className="px-3 py-3.5 text-slate-600" data-label="Insured with">{p.insurer || "—"}</td>
            <td className="px-3 py-3.5 text-slate-700" data-label="Expires">{fmtDate(p.expiry_date)}</td>
            <td className="px-3 py-3.5" data-label="Score">
              <span className={`inline-flex items-center justify-center min-w-[34px] min-h-[26px] px-2 rounded-md border text-sm font-bold ${scoreChip(p.score)}`}>
                {p.score ?? "—"}
              </span>
            </td>
            <td className="px-5 py-3.5 text-slate-500" data-label="Added">{fmtDate(p.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CustomersTable({ rows }: { rows: any[] }) {
  return (
    <table className="table-cards w-full text-sm">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr className="text-left text-sm text-slate-500 uppercase tracking-wider font-semibold">
          <th className="px-5 py-3.5">Name</th>
          <th className="px-3 py-3.5">Phone</th>
          <th className="px-3 py-3.5">City</th>
          <th className="px-3 py-3.5">Policies</th>
          <th className="px-5 py-3.5">Added</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} className="border-b border-slate-100 last:border-0">
            <td className="px-5 py-3.5 font-semibold text-slate-900" data-label="Name">{c.name || "—"}</td>
            {/* Tap-to-call: this audience works from a phone, and a number that
                is not dialable is a number nobody uses. */}
            <td className="px-3 py-3.5" data-label="Phone">
              {c.phone
                ? <a href={`tel:${c.phone}`} className="inline-flex items-center min-h-[44px] text-teal-700 font-medium">{c.phone}</a>
                : <span className="text-slate-500">—</span>}
            </td>
            <td className="px-3 py-3.5 text-slate-600" data-label="City">{c.city || "—"}</td>
            <td className="px-3 py-3.5 text-slate-700" data-label="Policies">{c.policies}</td>
            <td className="px-5 py-3.5 text-slate-500" data-label="Added">{fmtDate(c.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LeadsTable({ rows }: { rows: any[] }) {
  return (
    <table className="table-cards w-full text-sm">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr className="text-left text-sm text-slate-500 uppercase tracking-wider font-semibold">
          <th className="px-5 py-3.5">Name</th>
          <th className="px-3 py-3.5">Phone</th>
          <th className="px-3 py-3.5">Interested in</th>
          <th className="px-3 py-3.5">Status</th>
          <th className="px-3 py-3.5">Follow up</th>
          <th className="px-5 py-3.5">Added</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((l) => (
          <tr key={l.id} className="border-b border-slate-100 last:border-0">
            <td className="px-5 py-3.5 font-semibold text-slate-900" data-label="Name">{l.name || "—"}</td>
            <td className="px-3 py-3.5" data-label="Phone">
              {l.phone
                ? <a href={`tel:${l.phone}`} className="inline-flex items-center min-h-[44px] text-teal-700 font-medium">{l.phone}</a>
                : <span className="text-slate-500">—</span>}
            </td>
            <td className="px-3 py-3.5 text-slate-600" data-label="Interested in">{l.insurance_interest || "—"}</td>
            <td className="px-3 py-3.5" data-label="Status">
              <span className="inline-flex items-center min-h-[22px] px-2.5 rounded-full bg-slate-100 text-slate-600 text-sm font-bold uppercase tracking-wide">
                {l.status || "—"}
              </span>
            </td>
            <td className="px-3 py-3.5 text-slate-700" data-label="Follow up">{fmtDate(l.next_follow_up)}</td>
            <td className="px-5 py-3.5 text-slate-500" data-label="Added">{fmtDate(l.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ClaimsTable({ rows }: { rows: any[] }) {
  return (
    <table className="table-cards w-full text-sm">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr className="text-left text-sm text-slate-500 uppercase tracking-wider font-semibold">
          <th className="px-5 py-3.5">Customer</th>
          <th className="px-3 py-3.5">Insurer</th>
          <th className="px-3 py-3.5">Hospital</th>
          <th className="px-3 py-3.5">Claimed</th>
          <th className="px-3 py-3.5">Settled</th>
          <th className="px-5 py-3.5">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} className="border-b border-slate-100 last:border-0">
            <td className="px-5 py-3.5 font-semibold text-slate-900" data-label="Customer">{c.customer_name || "Customer removed"}</td>
            <td className="px-3 py-3.5 text-slate-600" data-label="Insurer">{c.insurer || "—"}</td>
            <td className="px-3 py-3.5 text-slate-600" data-label="Hospital">{c.hospital || "—"}</td>
            <td className="px-3 py-3.5 text-slate-700" data-label="Claimed">{fmtMoney(c.claimed_amount)}</td>
            <td className="px-3 py-3.5 text-slate-700" data-label="Settled">{fmtMoney(c.settled_amount)}</td>
            <td className="px-5 py-3.5" data-label="Status">
              <span className="inline-flex items-center min-h-[22px] px-2.5 rounded-full bg-slate-100 text-slate-600 text-sm font-bold uppercase tracking-wide">
                {String(c.status || "").replace(/_/g, " ") || "—"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
