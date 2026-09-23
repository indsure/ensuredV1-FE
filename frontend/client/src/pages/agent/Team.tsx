// The Team tab — what an agency owner sees.
//
// Everything on this page is derived server-side from the rows themselves
// (seats from teams.seats, usage from agent_credits, counts from the customer
// and policy tables). Nothing is a stored summary that can drift, and nothing
// here is a placeholder: if a number is on this screen, the endpoint computed it.

import { useEffect, useMemo, useState } from "react"
import { Link } from "wouter"
import { ArrowLeftRight, Mail, RefreshCw, UserPlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import { TableRowSkeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import { useLanguage } from "@/i18n/LanguageContext"
import { intlLocale } from "@/i18n"
import {
  fetchTeam, inviteAdvisor, moveChecks, removeMember, resendInvite, revokeInvite,
  type TeamMember, type TeamOwnerView, type TeamRequest,
} from "@/lib/team"

function initials(name: string, email: string): string {
  const source = name.trim() || email
  return source.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
}

/** Relative day count, in the plain words the portal already uses elsewhere. */
function whenLast(iso: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return t("team.today")
  if (days === 1) return t("team.yesterday")
  if (days < 30) return t("team.days_ago", { count: days })
  const months = Math.floor(days / 30)
  return months === 1 ? t("team.month_ago") : t("team.months_ago", { count: months })
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

/** 0 left is what the owner has to act on; 1-3 is a warning. Same bands as the
 *  score chips elsewhere in the portal, so the colours mean the same thing. */
function checkChip(n: number): string {
  if (n === 0) return "bg-red-50 text-red-700 border-red-200"
  if (n <= 3) return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

export default function Team() {
  const { t, locale } = useLanguage()
  const [view, setView] = useState<TeamOwnerView | null>(null)
  const [notOwner, setNotOwner] = useState<{ teamName: string; ownerName: string } | null>(null)
  const [request, setRequest] = useState<TeamRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await fetchTeam()
      if (!data.inTeam) {
        setView(null); setNotOwner(null); setRequest(data.request ?? null)
      } else if (data.role === "owner") {
        setView(data); setNotOwner(null); setRequest(null)
      } else {
        setView(null); setRequest(null)
        setNotOwner({ teamName: data.team.name, ownerName: data.team.ownerName })
      }
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("team.load_failed"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const outOfChecks = useMemo(
    () => (view?.members ?? []).filter((m) => Number(m.checks_left) === 0),
    [view]
  )

  async function onResend(id: string) {
    setBusyId(id)
    try {
      const r = await resendInvite(id)
      toast({ variant: r.emailed ? "success" : "destructive", title: r.emailed ? t("team.resent") : t("team.renewed_not_sent"), description: r.message })
      await load()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("team.resend_failed"), description: e instanceof Error ? e.message : undefined })
    } finally { setBusyId(null) }
  }

  async function onRevoke(id: string) {
    setBusyId(id)
    try {
      const r = await revokeInvite(id)
      toast({ variant: "success", title: t("team.revoked"), description: r.message })
      await load()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("team.revoke_failed"), description: e instanceof Error ? e.message : undefined })
    } finally { setBusyId(null) }
  }

  async function onRemove(member: TeamMember) {
    setBusyId(member.id)
    try {
      const r = await removeMember(member.id)
      toast({ variant: "success", title: t("team.removed"), description: r.message })
      await load()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("team.remove_failed"), description: e instanceof Error ? e.message : undefined })
    } finally { setBusyId(null); setConfirmRemove(null) }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="h-8 w-40 bg-slate-100 rounded mb-6" />
        <TableRowSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <InlineErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  // An advisor who is on someone's team lands here from a link or a stale tab.
  // Rather than a bare 403, tell them what their membership actually means for
  // them — including who can read their book.
  if (notOwner) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{t("team.your_team")}</h1>
        <div className="mt-4 bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
          <p className="text-base text-slate-900">
            {t("team.you_are_on", { team: notOwner.teamName, owner: notOwner.ownerName })}
          </p>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            {t("team.owner_can_read", { owner: notOwner.ownerName })}
          </p>
          <Link href="/agent/settings" className="mt-4 inline-flex items-center min-h-[44px] text-sm font-semibold text-teal-700">
            {t("team.see_every_time")}
          </Link>
        </div>
      </div>
    )
  }

  // Said "agency" at signup, not provisioned yet. Their answer was recorded and
  // this page has to prove it — telling someone who just asked for a team that
  // they have no team reads as though the question was decorative.
  if (!view && request) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{t("team.title")}</h1>
        <div className="mt-4 bg-white border border-amber-200 border-l-4 border-l-amber-500 rounded-xl p-5 sm:p-6">
          <p className="text-base font-semibold text-slate-900">
            {t("team.setting_up", { name: request.agencyName })}
          </p>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {request.seatsWanted ? t("team.told_us_seats", { count: request.seatsWanted }) : t("team.told_us")}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            {t("team.asked_on", { date: new Date(request.requestedAt).toLocaleDateString(intlLocale(locale), { day: "numeric", month: "long", year: "numeric" }) })}
          </p>
        </div>
        <p className="mt-4 text-sm text-slate-600 leading-relaxed">
          {t("team.nothing_on_hold")}
        </p>
      </div>
    )
  }

  if (!view) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{t("team.title")}</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {t("team.not_on_team")}
        </p>
      </div>
    )
  }

  const { team, seats, members, invites } = view

  return (
    <div className="p-4 sm:p-6 lg:p-8">

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{t("team.title")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("team.plan_line", { name: team.name, count: seats.total })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => setMoveOpen(true)}
            disabled={members.length < 2}
          >
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            {t("team.move_checks")}
          </Button>
          <Button className="min-h-[44px]" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t("team.invite_advisor")}
          </Button>
        </div>
      </div>

      {/* Seats and allowance. Every figure is computed by the endpoint from the
          rows themselves — see the note at the top of this file. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">{t("team.seats_in_use")}</div>
          <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {seats.members} <span className="text-lg text-slate-500">{t("team.of_total", { count: seats.total })}</span>
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {seats.pending > 0 ? t(seats.pending === 1 ? "team.pending_one" : "team.pending_many", { count: seats.pending }) : ""}
            {t(seats.free === 1 ? "team.free_one" : "team.free_many", { count: seats.free })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          {/* A balance, not a fraction. The per-seat figure is what a NEW seat is
              granted, never a ceiling: an advisor who joined with an existing
              balance keeps it, and checks can be moved between advisors. Writing
              it "109 of 20" invited exactly the reading it deserved — that the
              number is broken — when the only broken thing was the denominator. */}
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">{t("team.checks_left")}</div>
          <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {members.reduce((sum, m) => sum + Number(m.checks_left), 0)}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {t(members.length === 1 ? "team.across_checks_one" : "team.across_checks_many", { count: members.length, per: view.checksPerSeat })}
          </div>
        </div>

        {outOfChecks.length > 0 ? (
          <div className="bg-white border border-amber-200 border-l-4 border-l-amber-500 rounded-xl p-4 sm:p-5">
            <div className="text-sm font-bold uppercase tracking-wider text-amber-700">{t("team.out_of_checks")}</div>
            <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-amber-700">{outOfChecks.length}</div>
            <div className="mt-1 text-sm text-amber-700 font-medium">
              {t("team.move_them_some", { names: outOfChecks.map((m) => m.name || m.email).join(", ") })}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500">{t("team.entry_left")}</div>
            {/* Same reasoning as checks: unused data entry carries over, so a
                balance above the monthly grant is correct, not an error. */}
            <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {members.reduce((sum, m) => sum + Number(m.entry_left), 0)}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {t(members.length === 1 ? "team.across_entry_one" : "team.across_entry_many", { count: members.length })}
            </div>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="table-cards w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-sm text-slate-500 uppercase tracking-wider font-semibold">
                <th className="px-5 py-3.5">{t("team.col_advisor")}</th>
                <th className="px-3 py-3.5">{t("team.col_role")}</th>
                <th className="px-3 py-3.5">{t("team.col_checks")}</th>
                <th className="px-3 py-3.5">{t("team.col_entry")}</th>
                <th className="px-3 py-3.5">{t("team.col_customers")}</th>
                <th className="px-3 py-3.5">{t("team.col_last")}</th>
                <th className="px-5 py-3.5 text-right">{t("team.col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3.5" data-label={t("team.col_advisor")}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-9 w-9 flex-none rounded-full grid place-items-center text-sm font-bold ${m.is_owner ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                        {initials(m.name, m.email)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{m.name || "—"}</div>
                        <div className="text-sm text-slate-500 truncate">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5" data-label={t("team.col_role")}>
                    <span className={`inline-flex items-center min-h-[22px] px-2.5 rounded-full text-sm font-bold uppercase tracking-wide ${m.is_owner ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600"}`}>
                      {m.is_owner ? t("team.owner") : t("team.advisor")}
                    </span>
                  </td>
                  <td className="px-3 py-3.5" data-label={t("team.col_checks")}>
                    <span className={`inline-flex items-center justify-center min-w-[34px] min-h-[26px] px-2 rounded-md border text-sm font-bold ${checkChip(Number(m.checks_left))}`}>
                      {m.checks_left}
                    </span>
                  </td>
                  {/* "68 of 50" is not a typo the reader forgives — it is the
                      same false ceiling. Carryover means the balance can exceed
                      the monthly grant, so show the balance. */}
                  <td className="px-3 py-3.5 text-slate-700" data-label={t("team.col_entry")}>{t("team.n_left", { count: m.entry_left })}</td>
                  <td className="px-3 py-3.5 text-slate-700" data-label={t("team.col_customers")}>{m.customers}</td>
                  <td className="px-3 py-3.5 text-slate-500" data-label={t("team.col_last")}>{whenLast(m.last_activity_at, t)}</td>
                  <td className="px-5 py-3.5" data-label={t("team.col_actions")}>
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/agent/team/${m.id}`}
                        className="inline-flex items-center min-h-[44px] px-2 text-sm font-semibold text-teal-700"
                      >
                        {m.is_owner ? t("team.your_book") : t("team.view_book")}
                      </Link>
                      {!m.is_owner && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(m)}
                          disabled={busyId === m.id}
                          className="inline-flex items-center min-h-[44px] px-2 text-sm font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
                        >
                          {t("team.remove")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-500">{t("team.pending_invites")}</span>
            <span className="inline-flex items-center min-h-[20px] px-2 rounded-full bg-slate-100 text-slate-600 text-sm font-bold">
              {invites.length}
            </span>
          </div>
          <ul>
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 sm:gap-4 px-5 py-4 border-b border-slate-100 last:border-0">
                <div className="h-9 w-9 flex-none rounded-full bg-slate-100 grid place-items-center">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 truncate">{inv.email}</div>
                  <div className="text-sm text-slate-500">{t("team.link_only")}</div>
                </div>
                <span className="inline-flex items-center min-h-[24px] px-2.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
                  {t(daysLeft(inv.expires_at) === 1 ? "team.expires_one" : "team.expires_many", { count: daysLeft(inv.expires_at) })}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="min-h-[44px]" disabled={busyId === inv.id} onClick={() => void onResend(inv.id)}>
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    {t("team.resend")}
                  </Button>
                  <Button variant="outline" className="min-h-[44px] text-red-600 border-red-200 hover:bg-red-50" disabled={busyId === inv.id} onClick={() => void onRevoke(inv.id)}>
                    <X className="h-4 w-4 mr-1.5" />
                    {t("team.revoke")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        seatsFree={seats.free}
        seatsTotal={seats.total}
        checksPerSeat={view.checksPerSeat}
        onDone={() => void load()}
      />

      <MoveChecksDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        members={members}
        onDone={() => void load()}
      />

      {/* Removal is not a delete, and the copy says exactly what it is. */}
      <Dialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("team.remove_title", { name: confirmRemove?.name || t("team.this_advisor") })}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {t("team.remove_desc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setConfirmRemove(null)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              className="min-h-[44px]"
              disabled={!!busyId}
              onClick={() => confirmRemove && void onRemove(confirmRemove)}
            >
              {t("team.remove_from_team")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Invite ───────────────────────────────────────────────────────────────── */

function InviteDialog({
  open, onOpenChange, seatsFree, seatsTotal, checksPerSeat, onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  seatsFree: number
  seatsTotal: number
  checksPerSeat: number
  onDone: () => void
}) {
  const { t } = useLanguage()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [sending, setSending] = useState(false)

  // Clear the form when the dialog closes, so a second invite does not open
  // pre-filled with the last person's address.
  useEffect(() => { if (!open) { setEmail(""); setName("") } }, [open])

  async function submit() {
    setSending(true)
    try {
      const r = await inviteAdvisor(email.trim(), name.trim() || undefined)
      toast({
        variant: r.emailed ? "success" : "destructive",
        title: r.emailed ? t("team.invite_sent") : t("team.invite_not_emailed"),
        description: r.message,
      })
      onOpenChange(false)
      onDone()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("team.invite_failed"), description: e instanceof Error ? e.message : undefined })
    } finally { setSending(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("team.invite_title")}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {t("team.invite_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-sm font-semibold">{t("team.their_email")}</Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              className="min-h-[46px] text-base"
              placeholder={t("team.email_ph")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-name" className="text-sm font-semibold">
              {t("team.their_name")} <span className="font-normal text-slate-500">{t("team.name_optional")}</span>
            </Label>
            <Input
              id="invite-name"
              className="min-h-[46px] text-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {seatsFree > 0 ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">
                {t(seatsFree === 1 ? "team.uses_last_seat" : "team.uses_seat", { n: seatsTotal - seatsFree + 1, total: seatsTotal })}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {t("team.start_with", { count: checksPerSeat })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {t("team.all_taken", { count: seatsTotal })}
            </div>
          )}

          {/* The advisor is told this on the join screen too. Saying it here as
              well means the owner knows what they are handing themselves. */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 leading-relaxed">
            {t("team.owner_note")}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            className="min-h-[44px]"
            disabled={sending || seatsFree <= 0 || email.trim().length < 5}
            onClick={() => void submit()}
          >
            {sending ? t("team.sending") : t("team.send_invite")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Move checks ──────────────────────────────────────────────────────────── */

function MoveChecksDialog({
  open, onOpenChange, members, onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  members: TeamMember[]
  onDone: () => void
}) {
  // Sensible opening guess: take from whoever has most, give to whoever has least.
  const sorted = useMemo(() => [...members].sort((a, b) => Number(b.checks_left) - Number(a.checks_left)), [members])
  const { t } = useLanguage()
  const [fromId, setFromId] = useState("")
  const [toId, setToId] = useState("")
  const [count, setCount] = useState(1)
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    if (open && sorted.length >= 2) {
      setFromId(sorted[0].id)
      setToId(sorted[sorted.length - 1].id)
      setCount(Math.min(1, Number(sorted[0].checks_left)) || 1)
    }
  }, [open, sorted])

  const from = members.find((m) => m.id === fromId)
  const to = members.find((m) => m.id === toId)
  const available = Number(from?.checks_left ?? 0)

  async function submit() {
    setMoving(true)
    try {
      const r = await moveChecks(fromId, toId, count)
      toast({ variant: "success", title: t("team.moved"), description: r.message })
      onOpenChange(false)
      onDone()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("team.move_failed"), description: e instanceof Error ? e.message : undefined })
    } finally { setMoving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("team.move_title")}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {t("team.move_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="move-from" className="text-sm font-semibold">{t("team.take_from")}</Label>
            <select
              id="move-from"
              className="w-full min-h-[46px] px-3 rounded-lg border border-slate-200 bg-white text-base"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{t("team.option_left", { name: m.name || m.email, count: m.checks_left })}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="move-to" className="text-sm font-semibold">{t("team.give_to")}</Label>
            <select
              id="move-to"
              className="w-full min-h-[46px] px-3 rounded-lg border border-slate-200 bg-white text-base"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              {members.filter((m) => m.id !== fromId).map((m) => (
                <option key={m.id} value={m.id}>{t("team.option_left", { name: m.name || m.email, count: m.checks_left })}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">{t("team.how_many")}</div>
              <div className="mt-0.5 text-sm text-slate-600">
                {t("team.keep_get", { from: from?.name || t("team.they"), keep: Math.max(available - count, 0), to: to?.name || t("team.they"), get: Number(to?.checks_left ?? 0) + count })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={t("team.one_fewer")}
                className="h-11 w-11 rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-700 disabled:opacity-40"
                disabled={count <= 1}
                onClick={() => setCount((c) => Math.max(1, c - 1))}
              >
                −
              </button>
              <span className="min-w-[2ch] text-center text-2xl font-bold tracking-tight">{count}</span>
              <button
                type="button"
                aria-label={t("team.one_more")}
                className="h-11 w-11 rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-700 disabled:opacity-40"
                disabled={count >= available}
                onClick={() => setCount((c) => Math.min(available, c + 1))}
              >
                +
              </button>
            </div>
          </div>

          {/* The refill job resets balances by period, so a move is a
              this-month arrangement. Say so rather than let an owner think
              they have permanently rebalanced the team. */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 leading-relaxed">
            {t("team.refill_note")}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button className="min-h-[44px]" disabled={moving || !fromId || !toId || count < 1 || count > available} onClick={() => void submit()}>
            {moving ? t("team.moving") : t(count === 1 ? "team.move_one" : "team.move_many", { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
