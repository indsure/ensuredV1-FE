"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, CardContent } from "@/components/ui";
import { Phone, MessageCircle, Mail, UserCheck } from "lucide-react";

type Agent = { id: string; full_name: string | null; email: string; city: string | null };

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  topic: string | null;
  message: string | null;
  consent: boolean;
  status: string;
  created_at: string;
  assigned_agent_id: string | null;
  assigned_at: string | null;
  assigned_agent_name: string | null;
  assigned_agent_email: string | null;
};

const TOPIC_LABELS: Record<string, string> = {
  renew: "Renew a policy",
  "new-cover": "Buy new cover",
  review: "Review cover",
  claim: "Help with a claim",
  other: "Something else",
};

const STATUS_VARIANT: Record<string, "blue" | "yellow" | "default"> = {
  new: "blue",
  contacted: "yellow",
  closed: "default",
};

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  // Assume Indian numbers; prefix 91 when a bare 10-digit mobile is stored.
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function LeadsClient({ leads, agents }: { leads: Lead[]; agents: Agent[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "closed">("all");

  const counts = useMemo(() => {
    const c = { all: leads.length, new: 0, contacted: 0, closed: 0 };
    for (const l of leads) {
      if (l.status === "new") c.new++;
      else if (l.status === "contacted") c.contacted++;
      else if (l.status === "closed") c.closed++;
    }
    return c;
  }, [leads]);

  const visible = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Advisor Leads</h1>
        <p className="text-sm text-slate-500 mt-1">
          Consumers who asked to talk to an advisor. Assigning one to an agent puts it straight into that agent&apos;s
          leads at <span className="font-mono text-slate-600">/agent/leads</span>. Un-assign to pull it back.
        </p>
      </div>

      <div className="flex gap-2">
        {(["all", "new", "contacted", "closed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
              filter === f ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f} · {counts[f]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <UserCheck className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>No {filter === "all" ? "" : filter} leads.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((l) => (
            <Card key={l.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Consumer + what they want */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-semibold text-slate-900">{l.name}</span>
                      <Badge variant={STATUS_VARIANT[l.status] ?? "default"} className="capitalize">
                        {l.status}
                      </Badge>
                      {l.topic && <Badge variant="default">{TOPIC_LABELS[l.topic] ?? l.topic}</Badge>}
                      <span className="text-xs text-slate-400">{fmtDate(l.created_at)}</span>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-sm">
                      <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
                        <Phone className="h-3.5 w-3.5" /> {l.phone}
                      </a>
                      <a
                        href={waLink(l.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 font-medium"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                      {l.email && (
                        <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800">
                          <Mail className="h-3.5 w-3.5" /> {l.email}
                        </a>
                      )}
                    </div>

                    {l.message && (
                      <p className="mt-2.5 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border">{l.message}</p>
                    )}
                  </div>

                  {/* Allocation + status controls */}
                  <div className="flex flex-col items-stretch gap-2 w-full sm:w-64">
                    <label className="text-xs font-medium text-slate-500">Give to agent</label>
                    <select
                      value={l.assigned_agent_id ?? ""}
                      disabled={busyId === l.id}
                      onChange={(e) => patch(l.id, { assigned_agent_id: e.target.value || null })}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
                    >
                      <option value="">— Unassigned —</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {(a.full_name || a.email) + (a.city ? ` · ${a.city}` : "")}
                        </option>
                      ))}
                    </select>

                    {l.assigned_agent_name && (
                      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
                        ✓ In <span className="font-semibold">{l.assigned_agent_name}</span>&apos;s leads
                        {l.assigned_agent_email && (
                          <a href={`mailto:${l.assigned_agent_email}`} className="block text-emerald-600 hover:text-emerald-800 truncate mt-0.5">
                            {l.assigned_agent_email}
                          </a>
                        )}
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      {(["new", "contacted", "closed"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => patch(l.id, { status: s })}
                          disabled={busyId === l.id || l.status === s}
                          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition-colors disabled:pointer-events-none ${
                            l.status === s
                              ? "bg-slate-900 text-white"
                              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
