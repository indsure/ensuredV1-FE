"use client";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardContent, Input, Modal } from "@/components/ui";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  ShieldCheck,
  Users,
  FileText,
  CalendarClock,
  UserPlus,
} from "lucide-react";

type Policy = {
  id: string;
  title: string;
  insurance_type: string;
  status: string;
  insurer: string | null;
  score: number | null;
  renewal_date: string | null;
  created_at: string;
};

type Consumer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  plan: string;
  marketing_consent: boolean;
  renewal_reminders_enabled: boolean;
  created_at: string;
  trial_started_at: string;
  trialEndsAt: string;
  trialDaysLeft: number;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  auth_missing: boolean;
  policies_count: number;
  policies_done: number;
  policies_error: number;
  by_type: Record<string, number>;
  connect_requests: number;
  last_activity_at: string | null;
  policies: Policy[];
};

type Filter = "all" | "paid" | "trial" | "expired" | "empty";

const TYPE_LABELS: Record<string, string> = {
  health: "Health",
  motor: "Motor",
  life: "Life",
  term: "Term",
  travel: "Travel",
  property: "Property",
};

const STATUS_VARIANT: Record<string, "green" | "blue" | "yellow" | "red" | "default"> = {
  done: "green",
  processing: "blue",
  pending: "yellow",
  error: "red",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtRelative(s: string | null) {
  if (!s) return "never";
  const days = Math.floor((Date.now() - new Date(s).getTime()) / 86400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return fmtDate(s);
}

export default function ConsumersClient({
  consumers,
  orphanCount,
  trialDays,
}: {
  consumers: Consumer[];
  orphanCount: number;
  trialDays: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Plan / trial editing
  const [editTarget, setEditTarget] = useState<Consumer | null>(null);
  const [plan, setPlan] = useState<"free" | "paid">("free");
  const [restartTrial, setRestartTrial] = useState(false);
  const [saving, setSaving] = useState(false);

  function openEdit(u: Consumer) {
    setEditTarget(u);
    setPlan(u.plan === "paid" ? "paid" : "free");
    setRestartTrial(false);
  }

  async function saveEdit() {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/consumers/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, restart_trial: restartTrial }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to update");
      setEditTarget(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const c = { all: consumers.length, paid: 0, trial: 0, expired: 0, empty: 0 };
    for (const u of consumers) {
      if (u.plan === "paid") c.paid++;
      else if (u.trialDaysLeft > 0) c.trial++;
      else c.expired++;
      if (u.policies_count === 0) c.empty++;
    }
    return c;
  }, [consumers]);

  const stats = useMemo(() => {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const newThisMonth = consumers.filter((u) => new Date(u.created_at).getTime() >= startOfMonth).length;
    const activated = consumers.filter((u) => u.policies_count > 0).length;
    const totalPolicies = consumers.reduce((s, u) => s + u.policies_count, 0);
    const advisorAsks = consumers.reduce((s, u) => s + u.connect_requests, 0);
    return {
      newThisMonth,
      activated,
      activationRate: consumers.length === 0 ? 0 : Math.round((activated / consumers.length) * 100),
      totalPolicies,
      advisorAsks,
    };
  }, [consumers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return consumers.filter((u) => {
      if (filter === "paid" && u.plan !== "paid") return false;
      if (filter === "trial" && !(u.plan !== "paid" && u.trialDaysLeft > 0)) return false;
      if (filter === "expired" && !(u.plan !== "paid" && u.trialDaysLeft <= 0)) return false;
      if (filter === "empty" && u.policies_count !== 0) return false;
      if (!q) return true;
      return (
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [consumers, filter, search]);

  const statCards = [
    { label: "Consumers", value: consumers.length, sub: `+${stats.newThisMonth} this month`, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Policies Added", value: stats.totalPolicies, sub: `${stats.activated} have ≥1`, icon: FileText, color: "text-green-600", bg: "bg-green-50" },
    { label: "Activation", value: `${stats.activationRate}%`, sub: `${stats.activated} of ${consumers.length}`, icon: ShieldCheck, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Asked for an Advisor", value: stats.advisorAsks, sub: "consented requests", icon: UserPlus, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consumers</h1>
          <p className="text-sm text-slate-500 mt-1">
            People who sign in at <span className="font-mono text-slate-600">indsure.in/login</span> and keep a personal
            portfolio at <span className="font-mono text-slate-600">/app</span>. Stored in Supabase Auth +{" "}
            <span className="font-mono text-slate-600">individual_profiles</span>.
          </p>
        </div>
        <button
          onClick={() => router.refresh()}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-500">{s.label}</span>
                  <div className={`p-1.5 rounded-lg ${s.bg}`}>
                    <Icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                </div>
                <div className="text-3xl font-bold text-slate-900">{s.value}</div>
                <div className="mt-1 text-xs text-slate-400">{s.sub}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {orphanCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {orphanCount} Supabase Auth {orphanCount === 1 ? "account has" : "accounts have"} no agent and no consumer
          profile — signed up but never completed bootstrap. They are listed under Agents → Incomplete Signups.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-2">
          {(["all", "paid", "trial", "expired", "empty"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f === "empty" ? "no policies" : f} · {counts[f]}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y">
                <tr className="text-left">
                  <th className="px-5 py-3 font-medium text-slate-500 w-8" />
                  <th className="px-5 py-3 font-medium text-slate-500">Consumer</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Phone</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Policies</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Plan / Trial</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Consents</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Last sign-in</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Joined</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => {
                  const open = expanded === u.id;
                  const onTrial = u.plan !== "paid" && u.trialDaysLeft > 0;
                  return (
                    <Fragment key={u.id}>
                      <tr
                        onClick={() => setExpanded(open ? null : u.id)}
                        className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-5 py-4 text-slate-400">
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900 flex items-center gap-2">
                            {u.full_name || "—"}
                            {!u.email_confirmed && !u.auth_missing && (
                              <span className="text-[10px] uppercase tracking-wide text-amber-600">unverified</span>
                            )}
                            {u.auth_missing && (
                              <span className="text-[10px] uppercase tracking-wide text-red-500">no auth user</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {u.email ? (
                              <a
                                href={`mailto:${u.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 hover:text-slate-700"
                              >
                                <Mail className="h-3 w-3" />
                                {u.email}
                              </a>
                            ) : (
                              "—"
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {u.phone ? (
                            <a
                              href={`tel:${u.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 hover:text-slate-900"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {u.phone}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant={u.policies_count > 0 ? "blue" : "default"}>{u.policies_count}</Badge>
                            {Object.entries(u.by_type).map(([t, n]) => (
                              <span key={t} className="text-[10px] text-slate-400">
                                {TYPE_LABELS[t] ?? t} {n}
                              </span>
                            ))}
                            {u.policies_error > 0 && (
                              <span className="text-[10px] text-red-500">{u.policies_error} failed</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {u.plan === "paid" ? (
                            <Badge variant="green">Paid</Badge>
                          ) : onTrial ? (
                            <div className="flex flex-col gap-0.5">
                              <Badge variant="yellow">Trial</Badge>
                              <span className="text-[10px] text-slate-400">{u.trialDaysLeft}d left</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <Badge variant="red">Trial over</Badge>
                              <span className="text-[10px] text-slate-400">ended {fmtDate(u.trialEndsAt)}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            <span className={u.marketing_consent ? "text-emerald-600" : "text-slate-400"}>
                              {u.marketing_consent ? "✓ marketing" : "✗ marketing"}
                            </span>
                            <span className={u.renewal_reminders_enabled ? "text-emerald-600" : "text-slate-400"}>
                              {u.renewal_reminders_enabled ? "✓ reminders" : "✗ reminders"}
                            </span>
                            {u.connect_requests > 0 && (
                              <span className="text-orange-600">{u.connect_requests} advisor ask</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{fmtRelative(u.last_sign_in_at)}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                        <td className="px-5 py-4">
                          <Button
                            variant="outline"
                            className="h-7 text-xs px-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(u);
                            }}
                          >
                            Plan
                          </Button>
                        </td>
                      </tr>

                      {open && (
                        <tr className="border-b bg-slate-50/60">
                          <td />
                          <td colSpan={8} className="px-5 py-4">
                            <div className="text-xs text-slate-400 mb-2 font-mono">
                              auth user id: {u.id} · trial {fmtDate(u.trial_started_at)} → {fmtDate(u.trialEndsAt)} (
                              {trialDays}d)
                            </div>
                            {u.policies.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                No policies added yet — signed up but never uploaded.
                              </p>
                            ) : (
                              <table className="w-full text-xs bg-white rounded-lg border">
                                <thead className="border-b text-slate-500">
                                  <tr className="text-left">
                                    <th className="px-3 py-2 font-medium">Policy</th>
                                    <th className="px-3 py-2 font-medium">Type</th>
                                    <th className="px-3 py-2 font-medium">Insurer</th>
                                    <th className="px-3 py-2 font-medium">Status</th>
                                    <th className="px-3 py-2 font-medium">Score</th>
                                    <th className="px-3 py-2 font-medium">Renewal</th>
                                    <th className="px-3 py-2 font-medium">Added</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {u.policies.map((p) => (
                                    <tr key={p.id} className="border-b last:border-0">
                                      <td className="px-3 py-2 font-medium text-slate-800">{p.title}</td>
                                      <td className="px-3 py-2 text-slate-500">
                                        {TYPE_LABELS[p.insurance_type] ?? p.insurance_type}
                                      </td>
                                      <td className="px-3 py-2 text-slate-500">{p.insurer || "—"}</td>
                                      <td className="px-3 py-2">
                                        <Badge variant={STATUS_VARIANT[p.status] ?? "default"} className="capitalize">
                                          {p.status}
                                        </Badge>
                                      </td>
                                      <td className="px-3 py-2 text-slate-500">{p.score ?? "—"}</td>
                                      <td className="px-3 py-2 text-slate-500">
                                        {p.renewal_date ? (
                                          <span className="inline-flex items-center gap-1">
                                            <CalendarClock className="h-3 w-3" />
                                            {fmtDate(p.renewal_date)}
                                          </span>
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-slate-400">{fmtDate(p.created_at)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-slate-400">
                      No consumers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Plan — ${editTarget?.full_name || editTarget?.email || "consumer"}`}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as "free" | "paid")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            >
              <option value="free">Free — 30-day trial, 1 policy per type</option>
              <option value="paid">Paid — unlimited, no trial clock</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Setting <span className="font-semibold">Paid</span> is the real unlock: it clears both the
              &ldquo;trial is over&rdquo; error and the 1-policy-per-type cap.
            </p>
          </div>

          <label className="flex items-start gap-2.5 rounded-md border border-slate-200 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={restartTrial}
              onChange={(e) => setRestartTrial(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-slate-700">
              Restart the {trialDays}-day trial
              <span className="block text-xs text-slate-500 mt-0.5">
                Gives another {trialDays} days from today. The 1-policy-per-type cap still applies, so this only
                helps someone who has not used their free slot yet
                {editTarget && editTarget.policies_count > 0
                  ? ` — this person already has ${editTarget.policies_count} ${
                      editTarget.policies_count === 1 ? "policy" : "policies"
                    }.`
                  : "."}
              </span>
            </span>
          </label>

          {editTarget && (
            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Now: <span className="font-semibold capitalize">{editTarget.plan}</span> · trial{" "}
              {fmtDate(editTarget.trial_started_at)} → {fmtDate(editTarget.trialEndsAt)} (
              {editTarget.trialDaysLeft > 0 ? `${editTarget.trialDaysLeft}d left` : "over"})
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
