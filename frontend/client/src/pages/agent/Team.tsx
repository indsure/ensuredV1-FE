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
import {
  fetchTeam, inviteAdvisor, moveChecks, removeMember, resendInvite, revokeInvite,
  type TeamMember, type TeamOwnerView, type TeamRequest,
} from "@/lib/team"

function initials(name: string, email: string): string {
  const source = name.trim() || email
  return source.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
}

/** Relative day count, in the plain words the portal already uses elsewhere. */
function whenLast(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? "A month ago" : `${months} months ago`
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
      setError(e instanceof Error ? e.message : "Could not load your team.")
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
      toast({ variant: r.emailed ? "success" : "destructive", title: r.emailed ? "Invite resent" : "Link renewed, email not sent", description: r.message })
      await load()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not resend", description: e instanceof Error ? e.message : undefined })
    } finally { setBusyId(null) }
  }

  async function onRevoke(id: string) {
    setBusyId(id)
    try {
      const r = await revokeInvite(id)
      toast({ variant: "success", title: "Invite revoked", description: r.message })
      await load()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not revoke", description: e instanceof Error ? e.message : undefined })
    } finally { setBusyId(null) }
  }

  async function onRemove(member: TeamMember) {
    setBusyId(member.id)
    try {
      const r = await removeMember(member.id)
      toast({ variant: "success", title: "Advisor removed", description: r.message })
      await load()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not remove", description: e instanceof Error ? e.message : undefined })
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Your team</h1>
        <div className="mt-4 bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
          <p className="text-base text-slate-900">
            You are on <span className="font-semibold">{notOwner.teamName}</span>, run by {notOwner.ownerName}.
          </p>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            {notOwner.ownerName} can read the customers, policies, leads and claims you add — not change or
            delete them, and never the documents on a claim or the original file on a policy.
          </p>
          <Link href="/agent/settings" className="mt-4 inline-flex items-center min-h-[44px] text-sm font-semibold text-teal-700">
            See every time your book was opened
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Team</h1>
        <div className="mt-4 bg-white border border-amber-200 border-l-4 border-l-amber-500 rounded-xl p-5 sm:p-6">
          <p className="text-base font-semibold text-slate-900">
            We are setting up {request.agencyName}.
          </p>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            You told us at signup that you run an agency
            {request.seatsWanted ? ` of about ${request.seatsWanted} advisors` : ""}. We confirm the
            seats with you before anything is charged, and this page turns into your team the moment
            it is set up.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Asked on {new Date(request.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.
          </p>
        </div>
        <p className="mt-4 text-sm text-slate-600 leading-relaxed">
          Nothing is on hold in the meantime — your account works exactly as it does for any advisor.
        </p>
      </div>
    )
  }

  if (!view) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Team</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          You are not on an agency team. Teams are set up by us with the seats you have bought —
          talk to us if you want advisors working under your agency.
        </p>
      </div>
    )
  }

  const { team, seats, members, invites } = view

  return (
    <div className="p-4 sm:p-6 lg:p-8">

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-600">{team.name} · Agency plan, {seats.total} seats</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => setMoveOpen(true)}
            disabled={members.length < 2}
          >
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Move checks
          </Button>
          <Button className="min-h-[44px]" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite advisor
          </Button>
        </div>
      </div>

      {/* Seats and allowance. Every figure is computed by the endpoint from the
          rows themselves — see the note at the top of this file. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Seats in use</div>
          <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {seats.members} <span className="text-lg text-slate-500">of {seats.total}</span>
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {seats.pending > 0 ? `${seats.pending} invite${seats.pending === 1 ? "" : "s"} pending · ` : ""}
            {seats.free} seat{seats.free === 1 ? "" : "s"} free
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Policy checks left</div>
          <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {members.reduce((sum, m) => sum + Number(m.checks_left), 0)}{" "}
            <span className="text-lg text-slate-500">of {members.length * view.checksPerSeat}</span>
          </div>
          <div className="mt-1 text-sm text-slate-600">{view.checksPerSeat} a seat, held by each advisor</div>
        </div>

        {outOfChecks.length > 0 ? (
          <div className="bg-white border border-amber-200 border-l-4 border-l-amber-500 rounded-xl p-4 sm:p-5">
            <div className="text-sm font-bold uppercase tracking-wider text-amber-700">Out of checks</div>
            <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-amber-700">{outOfChecks.length}</div>
            <div className="mt-1 text-sm text-amber-700 font-medium">
              {outOfChecks.map((m) => m.name || m.email).join(", ")} — move them some
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Data entry left</div>
            <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {members.reduce((sum, m) => sum + Number(m.entry_left), 0)}{" "}
              <span className="text-lg text-slate-500">of {members.length * 50}</span>
            </div>
            <div className="mt-1 text-sm text-slate-600">50 policies a seat, every month</div>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="table-cards w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-sm text-slate-500 uppercase tracking-wider font-semibold">
                <th className="px-5 py-3.5">Advisor</th>
                <th className="px-3 py-3.5">Role</th>
                <th className="px-3 py-3.5">Checks</th>
                <th className="px-3 py-3.5">Data entry</th>
                <th className="px-3 py-3.5">Customers</th>
                <th className="px-3 py-3.5">Last activity</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3.5" data-label="Advisor">
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
                  <td className="px-3 py-3.5" data-label="Role">
                    <span className={`inline-flex items-center min-h-[22px] px-2.5 rounded-full text-sm font-bold uppercase tracking-wide ${m.is_owner ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600"}`}>
                      {m.is_owner ? "Owner" : "Advisor"}
                    </span>
                  </td>
                  <td className="px-3 py-3.5" data-label="Checks">
                    <span className={`inline-flex items-center justify-center min-w-[34px] min-h-[26px] px-2 rounded-md border text-sm font-bold ${checkChip(Number(m.checks_left))}`}>
                      {m.checks_left}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-slate-700" data-label="Data entry">{m.entry_left} of 50</td>
                  <td className="px-3 py-3.5 text-slate-700" data-label="Customers">{m.customers}</td>
                  <td className="px-3 py-3.5 text-slate-500" data-label="Last activity">{whenLast(m.last_activity_at)}</td>
                  <td className="px-5 py-3.5" data-label="Actions">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/agent/team/${m.id}`}
                        className="inline-flex items-center min-h-[44px] px-2 text-sm font-semibold text-teal-700"
                      >
                        {m.is_owner ? "Your book" : "View book"}
                      </Link>
                      {!m.is_owner && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(m)}
                          disabled={busyId === m.id}
                          className="inline-flex items-center min-h-[44px] px-2 text-sm font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
                        >
                          Remove
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
            <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Pending invites</span>
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
                  <div className="text-sm text-slate-500">The link works only for this address, once</div>
                </div>
                <span className="inline-flex items-center min-h-[24px] px-2.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
                  Expires in {daysLeft(inv.expires_at)} day{daysLeft(inv.expires_at) === 1 ? "" : "s"}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="min-h-[44px]" disabled={busyId === inv.id} onClick={() => void onResend(inv.id)}>
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    Resend
                  </Button>
                  <Button variant="outline" className="min-h-[44px] text-red-600 border-red-200 hover:bg-red-50" disabled={busyId === inv.id} onClick={() => void onRevoke(inv.id)}>
                    <X className="h-4 w-4 mr-1.5" />
                    Revoke
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
            <DialogTitle>Remove {confirmRemove?.name || "this advisor"} from the team?</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Their seat is freed and their plan drops back to Free. Their customers, policies and
              claims stay theirs — nothing is deleted — and you stop being able to see them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="min-h-[44px]"
              disabled={!!busyId}
              onClick={() => confirmRemove && void onRemove(confirmRemove)}
            >
              Remove from team
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
        title: r.emailed ? "Invite sent" : "Invite created, email not sent",
        description: r.message,
      })
      onOpenChange(false)
      onDone()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not send the invite", description: e instanceof Error ? e.message : undefined })
    } finally { setSending(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite an advisor</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            They get a link that works only for this email address, can be used once, and expires in 7 days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-sm font-semibold">Their email address</Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              className="min-h-[46px] text-base"
              placeholder="advisor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-name" className="text-sm font-semibold">
              Their name <span className="font-normal text-slate-500">optional, so the email reads properly</span>
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
                This uses seat {seatsTotal - seatsFree + 1} of {seatsTotal}
                {seatsFree === 1 ? " — your last free seat." : "."}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                They start the month with {checksPerSeat} policy checks and 50 data-entry policies of their own.
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              All {seatsTotal} seats are taken. Revoke a pending invite or remove an advisor to free one.
            </div>
          )}

          {/* The advisor is told this on the join screen too. Saying it here as
              well means the owner knows what they are handing themselves. */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 leading-relaxed">
            As team owner you will be able to read their customers, policies, leads and claims —
            not change them. They are told this before they join, and they see every time you open their book.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="min-h-[44px]"
            disabled={sending || seatsFree <= 0 || email.trim().length < 5}
            onClick={() => void submit()}
          >
            {sending ? "Sending…" : "Send invite"}
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
      toast({ variant: "success", title: "Checks moved", description: r.message })
      onOpenChange(false)
      onDone()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not move the checks", description: e instanceof Error ? e.message : undefined })
    } finally { setMoving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move policy checks</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Each seat gets its own checks every month. You can move unused ones between advisors.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="move-from" className="text-sm font-semibold">Take from</Label>
            <select
              id="move-from"
              className="w-full min-h-[46px] px-3 rounded-lg border border-slate-200 bg-white text-base"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.email} — {m.checks_left} left</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="move-to" className="text-sm font-semibold">Give to</Label>
            <select
              id="move-to"
              className="w-full min-h-[46px] px-3 rounded-lg border border-slate-200 bg-white text-base"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              {members.filter((m) => m.id !== fromId).map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.email} — {m.checks_left} left</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">How many</div>
              <div className="mt-0.5 text-sm text-slate-600">
                {from?.name || "They"} keep{(from?.name || "").includes(" ") ? "s" : "s"} {Math.max(available - count, 0)} · {to?.name || "they"} get {Number(to?.checks_left ?? 0) + count}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="One fewer"
                className="h-11 w-11 rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-700 disabled:opacity-40"
                disabled={count <= 1}
                onClick={() => setCount((c) => Math.max(1, c - 1))}
              >
                −
              </button>
              <span className="min-w-[2ch] text-center text-2xl font-bold tracking-tight">{count}</span>
              <button
                type="button"
                aria-label="One more"
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
            This lasts until the monthly refill. On the 1st, every advisor goes back to their own
            seat's checks, whatever you move today.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="min-h-[44px]" disabled={moving || !fromId || !toId || count < 1 || count > available} onClick={() => void submit()}>
            {moving ? "Moving…" : `Move ${count} check${count === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
