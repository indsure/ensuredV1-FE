// Enterprise signup requests — the admin side of "are you an individual or an
// agency?" on agent signup.
//
// This screen is the ONLY way a team gets created. That is deliberate: the
// Agency tier has a five-seat minimum and no self-serve billing, so a signup
// form must not be able to mint paid seats. Someone here decides, and the seat
// count they type is the number that bills — `seats_wanted` beside it is only
// what the advisor asked for.

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  createTeamForAgent, declineTeamRequest, fetchEligibleAgents, fetchTeamRequests, provisionTeam,
  type AdminTeamRequest, type EligibleAgent,
} from "@/lib/team";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function statusChip(status: AdminTeamRequest["status"]): string {
  if (status === "pending") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "provisioned") return "bg-green-50 text-green-700 border-green-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export default function AdminTeamRequests() {
  const [requests, setRequests] = useState<AdminTeamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Seat count per row, so two open rows cannot share one input's value.
  const [seats, setSeats] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetchTeamRequests();
      setRequests(r.requests);
      // Pre-fill with what they asked for, but never below the five-seat
      // minimum the Agency plan is sold at.
      setSeats(
        Object.fromEntries(
          r.requests.map((x) => [x.id, String(Math.max(Number(x.seats_wanted) || 0, 5))])
        )
      );
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load enterprise requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function onProvision(req: AdminTeamRequest) {
    const n = Number(seats[req.id]);
    if (!Number.isInteger(n) || n < 1) {
      toast({ variant: "destructive", title: "Set the seats first", description: "How many seats has this agency paid for?" });
      return;
    }
    setBusyId(req.id);
    try {
      const r = await provisionTeam(req.id, n);
      toast({ variant: "success", title: "Team created", description: r.message });
      await load();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not create the team", description: e instanceof Error ? e.message : undefined });
    } finally { setBusyId(null); setConfirmId(null); }
  }

  async function onDecline(req: AdminTeamRequest) {
    setBusyId(req.id);
    try {
      const r = await declineTeamRequest(req.id);
      toast({ variant: "success", title: "Request declined", description: r.message });
      await load();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not update", description: e instanceof Error ? e.message : undefined });
    } finally { setBusyId(null); }
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading enterprise requests…</div>;
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;

  const pending = requests.filter((r) => r.status === "pending");
  const handled = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Enterprise requests</h2>
        <p className="mt-1 text-sm text-slate-600 leading-relaxed max-w-2xl">
          Advisors who picked "Agency / Enterprise" at signup. Creating the team here makes them the
          team owner, puts them on the agency plan and lets them invite advisors. The seats you set
          are the seats that bill — what they asked for is only a note.
        </p>
      </div>

      {/* Existing accounts never answered the signup question, so they will
          never appear in the list below. Without this they would have no route
          to an agency account at all short of hand-written SQL. */}
      <PromoteExistingAdvisor onDone={() => void load()} />

      {requests.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
          Nobody has asked for an agency team at signup yet. Existing advisors can still be given a
          team above.
        </div>
      )}

      {pending.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Waiting</span>
            <span className="inline-flex items-center min-h-[20px] px-2 rounded-full bg-amber-100 text-amber-700 text-sm font-bold">
              {pending.length}
            </span>
          </div>
          <ul>
            {pending.map((r) => (
              <li key={r.id} className="p-5 border-b border-slate-100 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base font-bold text-slate-900">{r.agency_name}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {r.agent_name || "—"} · {r.agent_email}
                      {r.agent_city ? ` · ${r.agent_city}` : ""}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Asked {fmtDate(r.created_at)} ·{" "}
                      {r.seats_wanted ? `wants about ${r.seats_wanted} advisors` : "did not say how many"}
                      {r.contact_phone ? " · " : ""}
                      {r.contact_phone && (
                        <a href={`tel:${r.contact_phone}`} className="text-teal-700 font-medium">{r.contact_phone}</a>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label htmlFor={`seats-${r.id}`} className="block text-sm font-semibold text-slate-700 mb-1">
                        Seats paid for
                      </label>
                      <Input
                        id={`seats-${r.id}`}
                        type="number"
                        min={1}
                        value={seats[r.id] ?? ""}
                        onChange={(e) => setSeats((s) => ({ ...s, [r.id]: e.target.value }))}
                        className="w-28 min-h-[44px]"
                      />
                    </div>
                    <Button
                      className="min-h-[44px]"
                      disabled={busyId === r.id}
                      onClick={() => setConfirmId(r.id)}
                    >
                      Create team
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[44px] text-slate-600"
                      disabled={busyId === r.id}
                      onClick={() => void onDecline(r)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>

                {/* Creating a team starts a bill and changes someone's plan, so
                    it confirms — and the confirmation states the number. */}
                {confirmId === r.id && (
                  <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <p className="text-sm text-slate-800 leading-relaxed">
                      Create <span className="font-semibold">{r.agency_name}</span> with{" "}
                      <span className="font-semibold">{seats[r.id]} seats</span>, owned by{" "}
                      {r.agent_name || r.agent_email}? They move onto the agency plan and can invite
                      advisors immediately.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button className="min-h-[44px]" disabled={busyId === r.id} onClick={() => void onProvision(r)}>
                        {busyId === r.id ? "Creating…" : `Create with ${seats[r.id]} seats`}
                      </Button>
                      <Button variant="outline" className="min-h-[44px]" onClick={() => setConfirmId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {handled.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-sm font-bold uppercase tracking-wider text-slate-500">
            Handled
          </div>
          <ul>
            {handled.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{r.agency_name}</div>
                  <div className="text-sm text-slate-500">{r.agent_email}</div>
                </div>
                <span className={`inline-flex items-center min-h-[24px] px-2.5 rounded-full border text-sm font-semibold ${statusChip(r.status)}`}>
                  {r.status}
                </span>
                <span className="text-sm text-slate-500">{fmtDate(r.handled_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Promote an advisor who already had an account ────────────────────────── */

// The Individual/Agency question on signup only catches people signing up from
// now on. Everybody who already has an account — which on beta is everybody —
// answered nothing, so they need a door of their own. Same server-side rules as
// provisioning a request: one team per owner, seat count set here, credits
// seeded not overwritten.
function PromoteExistingAdvisor({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<EligibleAgent[] | null>(null);
  const [agentId, setAgentId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [seats, setSeats] = useState("5");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || agents !== null) return;
    fetchEligibleAgents()
      .then((r) => { setAgents(r.agents); setLoadError(null); })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Could not load advisors."));
  }, [open, agents]);

  async function submit() {
    setBusy(true);
    try {
      const r = await createTeamForAgent(agentId, teamName.trim(), Number(seats));
      toast({ variant: "success", title: "Team created", description: r.message });
      setOpen(false); setAgentId(""); setTeamName(""); setSeats("5"); setAgents(null);
      onDone();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not create the team", description: e instanceof Error ? e.message : undefined });
    } finally { setBusy(false); }
  }

  const chosen = agents?.find((a) => a.id === agentId);

  if (!open) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900">Give an existing advisor a team</div>
          <div className="mt-0.5 text-sm text-slate-600">
            For accounts created before the signup question, or anyone who picked Individual and has
            since grown into an agency.
          </div>
        </div>
        <Button className="min-h-[44px]" onClick={() => setOpen(true)}>Create a team</Button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-teal-200 ring-2 ring-teal-500/10 rounded-xl p-5 space-y-4">
      <div className="text-sm font-bold text-slate-900">Give an existing advisor a team</div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="promote-agent" className="block text-sm font-semibold text-slate-700 mb-1">
            Advisor
          </label>
          <select
            id="promote-agent"
            className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 bg-white text-base"
            value={agentId}
            onChange={(e) => {
              setAgentId(e.target.value);
              // Seed the agency name from whoever was picked, but never
              // overwrite something already typed.
              const a = agents?.find((x) => x.id === e.target.value);
              if (a && !teamName.trim()) setTeamName(a.name ? `${a.name}'s agency` : "");
            }}
          >
            <option value="">
              {agents === null ? "Loading advisors…" : `Pick one of ${agents.length} advisors`}
            </option>
            {(agents ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || "(no name)"} — {a.email}{a.city ? ` · ${a.city}` : ""}
              </option>
            ))}
          </select>
          {agents !== null && agents.length === 0 && (
            <p className="mt-1 text-sm text-slate-500">
              Every advisor is already on a team.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="promote-seats" className="block text-sm font-semibold text-slate-700 mb-1">
            Seats paid for
          </label>
          <Input
            id="promote-seats"
            type="number"
            min={1}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            className="min-h-[44px]"
          />
        </div>
      </div>

      <div>
        <label htmlFor="promote-name" className="block text-sm font-semibold text-slate-700 mb-1">
          Agency name
        </label>
        <Input
          id="promote-name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Shreyas Insurance Services"
          className="min-h-[44px]"
        />
      </div>

      {chosen && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-800 leading-relaxed">
          <span className="font-semibold">{chosen.name || chosen.email}</span> becomes the owner of{" "}
          <span className="font-semibold">{teamName.trim() || "this agency"}</span> with{" "}
          <span className="font-semibold">{seats} seats</span>, moves from the{" "}
          <span className="font-semibold">{chosen.plan}</span> plan onto agency, and can invite
          advisors immediately. Their own customers and policies are untouched.
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          className="min-h-[44px]"
          disabled={busy || !agentId || !teamName.trim() || !(Number(seats) >= 1)}
          onClick={() => void submit()}
        >
          {busy ? "Creating…" : "Create the team"}
        </Button>
        <Button variant="outline" className="min-h-[44px]" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
