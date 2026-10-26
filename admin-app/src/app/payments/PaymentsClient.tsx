"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardContent, Input } from "@/components/ui";
import { RefreshCw, IndianRupee, Users, CalendarClock, AlertTriangle, Mail, Phone } from "lucide-react";

export type PayingUser = {
  id: string;
  kind: "advisor" | "consumer";
  name: string | null;
  email: string | null;
  phone: string | null;
  plan: string;
  billing: string | null;
  activeUntil: string | null;
  status: "active" | "ending" | "grace" | "lapsed" | "by_hand" | "free";
  totalPaid: number;
  lastPaidAt: string | null;
  payments: number;
  checksLeft: number | null;
};

export type PaymentRow = {
  orderRef: string;
  kind: "advisor" | "consumer";
  name: string | null;
  email: string | null;
  item: string;
  amount: number;
  status: string;
  method: string | null;
  cfPaymentId: string | null;
  at: string;
  periodEnd: string | null;
  checks: number;
  notes: string | null;
};

const STATUS: Record<PayingUser["status"], { label: string; variant: "green" | "yellow" | "red" | "blue" | "default" }> = {
  active: { label: "Active", variant: "green" },
  ending: { label: "Ending soon", variant: "yellow" },
  grace: { label: "In grace", variant: "red" },
  lapsed: { label: "Lapsed", variant: "default" },
  by_hand: { label: "Set by hand", variant: "blue" },
  free: { label: "Free", variant: "default" },
};

const PAY_STATUS: Record<string, "green" | "yellow" | "red" | "blue" | "default"> = {
  paid: "green",
  pending: "yellow",
  created: "yellow",
  expired: "default",
  refunded: "red",
};

const PLAN_LABEL: Record<string, string> = { agent: "Agent", agency: "Agency", personal: "Personal", free: "Free" };

const rupees = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
function fmtDate(s: string | null) {
  if (!s) return "–";
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}
function fmtDateTime(s: string | null) {
  if (!s) return "–";
  return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}
// India-time month key, so "this month" matches the calendar the founder sees.
const istMonth = (s: string) => new Date(new Date(s).getTime() + 330 * 60_000).toISOString().slice(0, 7);

type UserFilter = "all" | "advisor" | "consumer" | "attention";
type PayFilter = "all" | "paid" | "pending" | "expired" | "refunded";

export default function PaymentsClient({ users, payments, tableMissing }: { users: PayingUser[]; payments: PaymentRow[]; tableMissing: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");

  const stats = useMemo(() => {
    const thisMonth = istMonth(new Date().toISOString());
    const paid = payments.filter((p) => p.status === "paid");
    return {
      month: paid.filter((p) => istMonth(p.at) === thisMonth).reduce((s, p) => s + p.amount, 0),
      allTime: paid.reduce((s, p) => s + p.amount, 0),
      refunded: payments.filter((p) => p.status === "refunded").reduce((s, p) => s + p.amount, 0),
      paying: users.filter((u) => ["active", "ending", "grace", "by_hand"].includes(u.status)).length,
      ending: users.filter((u) => u.status === "ending").length,
      grace: users.filter((u) => u.status === "grace").length,
      flagged: payments.filter((p) => p.notes).length,
    };
  }, [users, payments]);

  const q = search.trim().toLowerCase();
  const match = (...vals: (string | null)[]) => !q || vals.some((v) => v && v.toLowerCase().includes(q));

  const visibleUsers = users
    .filter((u) =>
      userFilter === "all" ? true
      : userFilter === "attention" ? u.status === "ending" || u.status === "grace"
      : u.kind === userFilter)
    .filter((u) => match(u.name, u.email, u.phone))
    .sort((a, b) => (a.activeUntil ?? "9999").localeCompare(b.activeUntil ?? "9999"));

  const visiblePayments = payments
    .filter((p) =>
      payFilter === "all" ? p.status !== "created"
      : payFilter === "pending" ? p.status === "pending" || p.status === "created"
      : p.status === payFilter)
    .filter((p) => match(p.name, p.email, p.orderRef, p.cfPaymentId));

  const cards = [
    { label: "Collected this month", value: rupees(stats.month), sub: `${rupees(stats.allTime)} all time, ${rupees(stats.refunded)} refunded`, icon: IndianRupee },
    { label: "Paying users now", value: String(stats.paying), sub: "active, ending soon, in grace or set by hand", icon: Users },
    { label: "Ending in 7 days", value: String(stats.ending), sub: "they get a reminder email 3 days before", icon: CalendarClock },
    { label: "In grace", value: String(stats.grace), sub: "ended, drop to free 3 days after the end date", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Paying users</h1>
          <p className="text-sm text-slate-500">Cashfree payments and who is on a paid plan. Read-only: refunds are done in the Cashfree dashboard.</p>
        </div>
        <Button variant="outline" onClick={() => router.refresh()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {tableMissing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The payments table does not exist yet (migration 028 has not run). Only plans set by hand are shown.
        </div>
      )}
      {stats.flagged > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {stats.flagged} {stats.flagged === 1 ? "payment needs" : "payments need"} a look (see the Note column): a refund to
          reflect in the admin, an amount mismatch, or a payment for a deleted account.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="p-6">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">{c.label}</span>
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{c.value}</div>
                <div className="mt-1 text-xs text-slate-500">{c.sub}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Input
        placeholder="Search by name, email, phone or payment reference..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {/* PAYING USERS */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Users</h2>
          <div className="flex gap-2">
            {(["all", "advisor", "consumer", "attention"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setUserFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${
                  userFilter === f ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f === "attention" ? "ending or in grace" : f === "all" ? "all" : `${f}s`}
              </button>
            ))}
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-slate-50">
                  <tr className="text-left">
                    {["User", "Phone", "Plan", "Status", "Active until", "Total paid", "Last payment", "Checks left"].map((h) => (
                      <th key={h} className="px-5 py-3 font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500">No users match.</td></tr>
                  )}
                  {visibleUsers.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{u.name || "–"}</div>
                        <div className="text-xs text-slate-500">
                          {u.kind === "advisor" ? "Advisor" : "Consumer"}
                          {u.email && (
                            <a href={`mailto:${u.email}`} className="ml-2 inline-flex items-center gap-1 hover:text-slate-800">
                              <Mail className="h-3 w-3" />{u.email}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {u.phone ? (
                          <a href={`tel:${u.phone}`} className="inline-flex items-center gap-1 hover:text-slate-900">
                            <Phone className="h-3.5 w-3.5" />{u.phone}
                          </a>
                        ) : "–"}
                      </td>
                      <td className="px-5 py-4 text-slate-900">
                        {PLAN_LABEL[u.plan] ?? u.plan}
                        {u.billing && <span className="ml-1 text-xs text-slate-500">({u.billing === "annual" ? "yearly" : u.billing})</span>}
                      </td>
                      <td className="px-5 py-4"><Badge variant={STATUS[u.status].variant}>{STATUS[u.status].label}</Badge></td>
                      <td className="px-5 py-4 text-slate-600">{u.status === "by_hand" ? "no end date" : fmtDate(u.activeUntil)}</td>
                      <td className="px-5 py-4 font-medium text-slate-900">{u.totalPaid ? rupees(u.totalPaid) : "–"}</td>
                      <td className="px-5 py-4 text-slate-600">{fmtDate(u.lastPaidAt)}</td>
                      <td className="px-5 py-4 text-slate-600">{u.checksLeft ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* PAYMENTS */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Payments</h2>
          <div className="flex gap-2">
            {(["all", "paid", "pending", "expired", "refunded"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setPayFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${
                  payFilter === f ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-slate-50">
                  <tr className="text-left">
                    {["When", "User", "Item", "Amount", "Status", "Method", "Reference", "Note"].map((h) => (
                      <th key={h} className="px-5 py-3 font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiblePayments.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500">No payments yet.</td></tr>
                  )}
                  {visiblePayments.map((p) => (
                    <tr key={p.orderRef} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-4 whitespace-nowrap text-slate-600">{fmtDateTime(p.at)}</td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{p.name || "–"}</div>
                        <div className="text-xs text-slate-500">{p.kind === "advisor" ? "Advisor" : "Consumer"}{p.email ? `, ${p.email}` : ""}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-900">
                        {p.item}
                        {p.status === "paid" && p.periodEnd && <div className="text-xs text-slate-500">till {fmtDate(p.periodEnd)}</div>}
                        {p.status === "paid" && p.checks > 0 && <div className="text-xs text-slate-500">+{p.checks} checks</div>}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900">{rupees(p.amount)}</td>
                      <td className="px-5 py-4"><Badge variant={PAY_STATUS[p.status] ?? "default"}>{p.status}</Badge></td>
                      <td className="px-5 py-4 text-slate-600 uppercase">{p.method ?? "–"}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        <div className="font-mono">{p.orderRef}</div>
                        {p.cfPaymentId && <div className="font-mono text-slate-500">CF {p.cfPaymentId}</div>}
                      </td>
                      <td className="px-5 py-4 text-xs text-red-700">{p.notes ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
