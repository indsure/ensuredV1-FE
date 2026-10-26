import { AppShell } from "@/components/AppShell";
import { supabaseAdmin } from "@/lib/supabase";
import PaymentsClient, { type PayingUser, type PaymentRow } from "./PaymentsClient";

// Paying users and every Cashfree payment. Read-only.
// Source of truth: payment_orders (migration 028, written only by backend/server/services/payments.ts)
// plus the plan columns it maintains: agents.plan / plan_expires_at and
// individual_profiles.plan / paid_until. Service-role reads, so RLS does not hide anything.
// Amounts are stored in paise. Refunds happen in the Cashfree dashboard; the webhook marks
// the order "refunded" but does not take the plan back (that is done by hand).

export const dynamic = "force-dynamic";

const GRACE_DAYS = 3; // keep in sync with services/payments.ts
const SKU_LABEL: Record<string, string> = {
  agent_monthly: "Agent, 1 month",
  agent_yearly: "Agent, 1 year",
  topup_5: "5 policy checks",
  topup_15: "15 policy checks",
  personal_monthly: "Personal, 1 month",
  personal_yearly: "Personal, 1 year",
};

type OrderRow = {
  order_ref: string;
  account_kind: "agent" | "individual";
  account_id: string | null;
  sku: string;
  amount_paise: number;
  status: string;
  cf_payment_id: string | null;
  payment_method: string | null;
  period_end: string | null;
  checks_granted: number;
  paid_at: string | null;
  refunded_at: string | null;
  notes: string | null;
  created_at: string;
};

async function getOrders(): Promise<{ rows: OrderRow[]; missing: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("payment_orders")
    .select(
      "order_ref, account_kind, account_id, sku, amount_paise, status, cf_payment_id, payment_method, period_end, checks_granted, paid_at, refunded_at, notes, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(5000);
  // Before migration 028 the table does not exist; show that plainly instead of crashing.
  if (error) return { rows: [], missing: true };
  return { rows: (data ?? []) as OrderRow[], missing: false };
}

function statusFor(plan: string, expiresAt: string | null, everPaid: boolean, now: number): PayingUser["status"] {
  if (plan === "free") return everPaid ? "lapsed" : "free";
  if (!expiresAt) return "by_hand";
  const end = new Date(expiresAt).getTime();
  if (end > now + 7 * 86400_000) return "active";
  if (end > now) return "ending";
  if (end + GRACE_DAYS * 86400_000 > now) return "grace";
  return "lapsed";
}

export default async function PaymentsPage() {
  const { rows: orders, missing } = await getOrders();
  const now = Date.now();

  const agentIdsFromOrders = [...new Set(orders.filter((o) => o.account_kind === "agent" && o.account_id).map((o) => o.account_id!))];
  const indIdsFromOrders = [...new Set(orders.filter((o) => o.account_kind === "individual" && o.account_id).map((o) => o.account_id!))];

  // plan_expires_at / paid_until only exist after migration 028; fall back to the older columns.
  const agentCols = missing ? "id, full_name, name, email, phone, plan, billing_cycle" : "id, full_name, name, email, phone, plan, billing_cycle, plan_expires_at";
  const indCols = missing ? "id, full_name, email, phone, plan" : "id, full_name, email, phone, plan, paid_until, paid_billing";

  const [paidAgents, orderAgents, paidInds, orderInds, credits] = await Promise.all([
    supabaseAdmin.from("agents").select(agentCols).neq("plan", "free").limit(5000),
    agentIdsFromOrders.length ? supabaseAdmin.from("agents").select(agentCols).in("id", agentIdsFromOrders) : Promise.resolve({ data: [] }),
    supabaseAdmin.from("individual_profiles").select(indCols).eq("plan", "paid").limit(5000),
    indIdsFromOrders.length ? supabaseAdmin.from("individual_profiles").select(indCols).in("id", indIdsFromOrders) : Promise.resolve({ data: [] }),
    supabaseAdmin.from("agent_credits").select("agent_id, balance").limit(10000),
  ]);

  const balance = new Map<string, number>(((credits.data ?? []) as { agent_id: string; balance: number }[]).map((c) => [c.agent_id, c.balance]));

  const ordersBy = new Map<string, OrderRow[]>();
  for (const o of orders) if (o.account_id) (ordersBy.get(o.account_id) ?? ordersBy.set(o.account_id, []).get(o.account_id)!).push(o);

  const users = new Map<string, PayingUser>();
  for (const a of [...((paidAgents.data ?? []) as any[]), ...((orderAgents.data ?? []) as any[])]) {
    if (users.has(a.id)) continue;
    const mine = (ordersBy.get(a.id) ?? []).filter((o) => o.status === "paid" || o.status === "refunded");
    const plan = String(a.plan || "free").toLowerCase();
    users.set(a.id, {
      id: a.id,
      kind: "advisor",
      name: a.full_name || a.name || null,
      email: a.email ?? null,
      phone: a.phone ?? null,
      plan,
      billing: a.billing_cycle ?? null,
      activeUntil: a.plan_expires_at ?? null,
      status: statusFor(plan, a.plan_expires_at ?? null, mine.some((o) => o.status === "paid"), now),
      totalPaid: mine.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount_paise, 0) / 100,
      lastPaidAt: mine.find((o) => o.paid_at)?.paid_at ?? null,
      payments: mine.length,
      checksLeft: balance.get(a.id) ?? 0,
    });
  }
  for (const p of [...((paidInds.data ?? []) as any[]), ...((orderInds.data ?? []) as any[])]) {
    if (users.has(p.id)) continue;
    const mine = (ordersBy.get(p.id) ?? []).filter((o) => o.status === "paid" || o.status === "refunded");
    const plan = String(p.plan || "free").toLowerCase() === "paid" ? "personal" : "free";
    users.set(p.id, {
      id: p.id,
      kind: "consumer",
      name: p.full_name ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      plan,
      billing: p.paid_billing ?? null,
      activeUntil: p.paid_until ?? null,
      status: statusFor(plan, p.paid_until ?? null, mine.some((o) => o.status === "paid"), now),
      totalPaid: mine.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount_paise, 0) / 100,
      lastPaidAt: mine.find((o) => o.paid_at)?.paid_at ?? null,
      payments: mine.length,
      checksLeft: null,
    });
  }

  const payments: PaymentRow[] = orders.map((o) => {
    const u = o.account_id ? users.get(o.account_id) : undefined;
    return {
      orderRef: o.order_ref,
      kind: o.account_kind === "agent" ? "advisor" : "consumer",
      name: u?.name ?? null,
      email: u?.email ?? null,
      item: SKU_LABEL[o.sku] ?? o.sku,
      amount: o.amount_paise / 100,
      status: o.status,
      method: o.payment_method,
      cfPaymentId: o.cf_payment_id,
      at: o.paid_at ?? o.created_at,
      periodEnd: o.period_end,
      checks: o.checks_granted,
      notes: o.notes,
    };
  });

  return (
    <AppShell>
      <PaymentsClient
        users={[...users.values()].filter((u) => u.status !== "free")}
        payments={payments}
        tableMissing={missing}
      />
    </AppShell>
  );
}
