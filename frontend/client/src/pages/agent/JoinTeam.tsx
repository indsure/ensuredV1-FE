// What the invited advisor sees when they tap the link in their email.
//
// This page is the moment consent is actually given, so it says the awkward
// part out loud BEFORE the account exists: the team owner will be able to read
// the customers, policies, leads and claims added here. Someone finding that
// out afterwards would be right to feel misled.
//
// It is reachable signed-out (the usual case — a new advisor) and signed-in (an
// existing IndSure advisor joining an agency), and both paths end at the same
// explicit Accept.

import { useEffect, useState } from "react"
import { Link, useLocation, useRoute } from "wouter"
import { Check, Clock, FileText, Lock, Mail, ShieldCheck, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import { acceptInvite, previewInvite, type InvitePreview } from "@/lib/team"

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

export default function JoinTeam() {
  const [, params] = useRoute("/agent/join/:token")
  const [, setLocation] = useLocation()
  const token = params?.token ?? ""

  const [invite, setInvite] = useState<InvitePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [preview, session] = await Promise.all([
          previewInvite(token),
          supabase.auth.getUser(),
        ])
        if (cancelled) return
        setInvite(preview)
        setSignedInEmail(session.data.user?.email ?? null)
        setError(null)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "This invite link is not valid.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [token])

  async function onAccept() {
    setAccepting(true)
    try {
      const r = await acceptInvite(token)
      toast({ variant: "success", title: `You are on ${r.teamName}`, description: r.message })
      setLocation("/agent/dashboard")
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not join the team", description: e instanceof Error ? e.message : undefined })
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] grid place-items-center p-6">
        <div className="w-full max-w-md space-y-4">
          <div className="h-7 w-2/3 bg-slate-100 rounded" />
          <div className="h-40 bg-white border border-slate-200 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !invite) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">This invite link is not valid</h1>
        <p className="mt-3 text-base text-slate-600 leading-relaxed">
          {error ?? "We could not find this invite."} If someone is expecting you on their team, ask them to send it again.
        </p>
        <Link href="/agent/login" className="mt-6 inline-flex items-center min-h-[48px] px-5 rounded-xl bg-teal-600 text-white font-semibold">
          Go to sign in
        </Link>
      </Shell>
    )
  }

  // Spent, withdrawn or timed out. Each gets its own sentence — "invalid" for
  // all three teaches the person nothing about what to do next.
  if (invite.state !== "pending") {
    const copy = {
      accepted: {
        title: "This invite has already been used",
        body: `The invite to ${invite.email} was accepted. If that was you, just sign in.`,
      },
      revoked: {
        title: "This invite was withdrawn",
        body: `${invite.ownerName} cancelled this invite. Ask them for a new one if you still need it.`,
      },
      expired: {
        title: "This invite has expired",
        body: `Invites last 7 days. Ask ${invite.ownerName} to send a fresh one — it takes them a moment.`,
      },
    }[invite.state]

    return (
      <Shell>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{copy.title}</h1>
        <p className="mt-3 text-base text-slate-600 leading-relaxed">{copy.body}</p>
        <Link href="/agent/login" className="mt-6 inline-flex items-center min-h-[48px] px-5 rounded-xl bg-teal-600 text-white font-semibold">
          Go to sign in
        </Link>
      </Shell>
    )
  }

  const emailMatches = signedInEmail !== null &&
    signedInEmail.toLowerCase() === invite.email.toLowerCase()

  return (
    <Shell>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 flex-none rounded-full bg-teal-600 grid place-items-center text-white text-base font-bold">
          {invite.ownerName.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm text-slate-600">{invite.ownerName} has invited you</div>
        </div>
      </div>

      <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
        Join {invite.teamName} on IndSure
      </h1>
      <p className="mt-3 text-base text-slate-600 leading-relaxed">
        You get your own advisor account inside the agency team — your leads, your customers,
        your policy checks.
      </p>

      {/* What the seat carries. Every figure here is what the server will
          actually give them on joining, not a brochure number. */}
      <div className="mt-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-bold uppercase tracking-wider text-slate-500">
          Your seat, every month
        </div>
        <ul>
          <li className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 min-h-[56px]">
            <ShieldCheck className="h-5 w-5 flex-none text-teal-600" />
            <span className="flex-1 text-base text-slate-800">Policy checks</span>
            <span className="text-base font-bold text-slate-900">{invite.checksPerSeat}</span>
          </li>
          <li className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 min-h-[56px]">
            <FileText className="h-5 w-5 flex-none text-teal-600" />
            <span className="flex-1 text-base text-slate-800">Data-entry policies</span>
            <span className="text-base font-bold text-slate-900">50</span>
          </li>
          <li className="flex items-center gap-3 px-4 py-3.5 min-h-[56px]">
            <TrendingUp className="h-5 w-5 flex-none text-teal-600" />
            <span className="flex-1 text-base text-slate-800">Leads, renewals, calculator</span>
            <span className="text-base font-bold text-slate-900">Included</span>
          </li>
        </ul>
      </div>

      {/* The consent block. This is the reason the page exists. */}
      <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 flex-none mt-0.5 text-amber-600" />
          <p className="text-base text-slate-800 leading-relaxed">
            As team owner, <span className="font-semibold">{invite.ownerName} can read the customers,
            policies, leads and claims you add here</span> — not change them. You will see every time
            they open your book.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 flex-none mt-0.5 text-teal-600" />
          <p className="text-base text-slate-800 leading-relaxed">
            They cannot open the documents on a claim, or the original file on a policy you upload.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 flex-none mt-0.5 text-teal-600" />
          <p className="text-base text-slate-800 leading-relaxed">
            This invite works only for <span className="font-semibold">{invite.email}</span>, one time.
          </p>
        </div>
      </div>

      {/* Three states, three different asks. */}
      <div className="mt-6 space-y-3">
        {emailMatches && (
          <Button className="w-full min-h-[52px] text-base" disabled={accepting} onClick={() => void onAccept()}>
            {accepting ? "Joining…" : `Join ${invite.teamName}`}
          </Button>
        )}

        {signedInEmail && !emailMatches && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-base text-amber-800 leading-relaxed">
              You are signed in as <span className="font-semibold">{signedInEmail}</span>, but this
              invite is for <span className="font-semibold">{invite.email}</span>. Sign out and sign in
              with that address to accept it.
            </p>
            <button
              type="button"
              onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
              className="mt-3 inline-flex items-center min-h-[44px] font-semibold text-amber-900 underline"
            >
              Sign out
            </button>
          </div>
        )}

        {!signedInEmail && (
          <>
            <Link
              // /agent/signup/step1, not /agent/signup: the bare path does not
              // match the route and bounces to the login screen, taking the
              // prefilled email and code with it.
              href={`/agent/signup/step1?email=${encodeURIComponent(invite.email)}${invite.signupCode ? `&code=${encodeURIComponent(invite.signupCode)}` : ""}`}
              className="w-full min-h-[52px] inline-flex items-center justify-center rounded-xl bg-teal-600 text-white text-base font-bold"
            >
              Create my account
            </Link>
            {/* Told plainly rather than discovered: signup ends in a
                confirmation email, so the last step happens back here. */}
            <p className="text-sm text-slate-600 leading-relaxed text-center">
              Set up your account with {invite.email}, then open this link from your invite email
              again to finish joining.
            </p>
            <Link
              href="/agent/login"
              className="w-full min-h-[48px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-700"
            >
              Already on IndSure? Sign in to join
            </Link>
          </>
        )}

        <div className="flex items-center justify-center gap-2 min-h-[44px]">
          <Clock className="h-4 w-4 text-amber-700" />
          <span className="text-sm font-semibold text-amber-700">
            This invite expires in {daysLeft(invite.expiresAt)} day{daysLeft(invite.expiresAt) === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500 leading-relaxed text-center">
        Not expecting this? Ignore the email — nothing is created until you accept.
      </p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="h-[60px] flex items-center gap-2.5 px-5 bg-white border-b border-slate-200">
        <div className="h-[30px] w-[30px] rounded-lg bg-teal-600 grid place-items-center">
          <Check className="h-4 w-4 text-white" strokeWidth={3} />
        </div>
        <span className="text-[17px] font-bold tracking-tight text-slate-900">IndSure</span>
      </div>
      <div className="mx-auto max-w-lg px-5 py-8 sm:py-12">{children}</div>
    </div>
  )
}
