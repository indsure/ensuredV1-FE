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
  declineTeamRequest, fetchTeamRequests, provisionTeam, type AdminTeamRequest,
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

      {requests.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
          Nobody has asked for an agency team yet.
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
