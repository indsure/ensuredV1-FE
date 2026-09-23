import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Plus, Sparkles, UserRound, X } from "lucide-react";

import { useAgent } from "@/context/AgentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  createCustomer,
  fetchCustomers,
  suggestCustomers,
  tagPolicyToCustomer,
  type Customer,
} from "@/lib/customers";

/**
 * Sidebar card on PolicyDetail: shows which customer this policy belongs to,
 * or lets the agent tag one — with auto-suggestions from the policyholder's
 * name/phone/email, a search box, and one-click "create & tag".
 */
export default function CustomerTagCard({
  clientId,
  customerId,
  hint,
  onChanged,
}: {
  clientId: string;
  customerId: string | null;
  hint: { name?: string | null; phone?: string | null; email?: string | null };
  onChanged: () => void;
}) {
  const { agent } = useAgent();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  // suggestCustomers() returns English reasons; show them in the UI language.
  const REASON_KEY: Record<string, string> = {
    "Same phone number": "tag_card.reason_phone",
    "Same email": "tag_card.reason_email",
    "Name matches": "tag_card.reason_name",
    "Similar name": "tag_card.reason_similar",
  };
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!agent?.agentId) return;
    setLoading(true);
    try {
      setCustomers(await fetchCustomers(agent.agentId));
    } catch {
      // non-fatal — the card degrades to "create new" only
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId]);

  useEffect(() => { void load(); }, [load]);

  const current = useMemo(
    () => (customerId ? customers.find(c => c.id === customerId) ?? null : null),
    [customers, customerId]
  );

  const suggestions = useMemo(
    () => (customerId ? [] : suggestCustomers(customers, hint, 3)),
    [customers, customerId, hint]
  );

  const searchResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    const suggestedIds = new Set(suggestions.map(s => s.customer.id));
    return customers
      .filter(c => !suggestedIds.has(c.id))
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [customers, search, suggestions]);

  async function tag(targetCustomerId: string | null) {
    setBusy(true);
    try {
      await tagPolicyToCustomer(clientId, targetCustomerId);
      toast({ variant: "success", title: targetCustomerId ? t("customer_detail.tagged") : t("customer_detail.untagged") });
      setSearch("");
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("tag_card.could_not_update"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function createAndTag() {
    if (!agent?.agentId) return;
    const name = (hint.name ?? "").trim();
    if (!name) {
      toast({ variant: "destructive", title: t("tag_card.no_holder"), description: t("tag_card.no_holder_desc") });
      return;
    }
    setBusy(true);
    try {
      const created = await createCustomer(agent.agentId, {
        name,
        phone: hint.phone ?? null,
        email: hint.email ?? null,
      });
      await tagPolicyToCustomer(clientId, created.id);
      toast({ variant: "success", title: t("tag_card.created"), description: t("tag_card.created_desc", { name }) });
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("tag_card.create_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader><CardTitle>{t("tag_card.title")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="text-sm text-slate-400">{t("tag_card.loading")}</div>}

        {!loading && current && (
          <>
            <div className="flex items-start gap-3 rounded-xl border border-[#0D9488]/15 bg-[#0D9488]/5 p-4">
              <UserRound className="mt-0.5 h-5 w-5 text-[#0D9488] shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">{current.name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {[current.phone, current.city].filter(Boolean).join(" · ") || t("tag_card.no_contact")}
                </div>
              </div>
            </div>
            <Button
              className="w-full bg-[#0D9488] hover:bg-[#0f766e]"
              onClick={() => setLocation(`/agent/customers/${current.id}`)}
            >
              {t("tag_card.view_portfolio")}
            </Button>
            <Button
              variant="outline"
              className="w-full border-slate-200 bg-white text-slate-500"
              onClick={() => void tag(null)}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
              {t("tag_card.untag")}
            </Button>
          </>
        )}

        {/* Tagged, but the customer record is gone or still loading its list */}
        {!loading && customerId && !current && (
          <Button variant="outline" className="w-full border-slate-200 bg-white" onClick={() => void tag(null)} disabled={busy}>
            {t("tag_card.untag_missing")}
          </Button>
        )}

        {!loading && !customerId && (
          <>
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-400" /> {t("tag_card.suggested")}
                </p>
                {suggestions.map(({ customer, reason }) => (
                  <button
                    key={customer.id}
                    onClick={() => void tag(customer.id)}
                    disabled={busy}
                    className="w-full rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-left hover:border-amber-300 hover:bg-amber-50 transition-colors disabled:opacity-50"
                  >
                    <div className="font-semibold text-slate-800 text-sm">{customer.name}</div>
                    <div className="text-[11px] text-amber-600 font-medium">{t("tag_card.click_to_tag", { reason: REASON_KEY[reason] ? t(REASON_KEY[reason]) : reason })}</div>
                  </button>
                ))}
              </div>
            )}

            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={customers.length > 0 ? t("tag_card.search") : t("tag_card.none_yet")}
              disabled={customers.length === 0}
            />
            {searchResults.map(c => (
              <button
                key={c.id}
                onClick={() => void tag(c.id)}
                disabled={busy}
                className="w-full rounded-lg border border-slate-100 p-2.5 text-left hover:border-[#0D9488]/30 hover:bg-teal-50/40 transition-colors disabled:opacity-50"
              >
                <span className="text-sm font-semibold text-slate-700">{c.name}</span>
                {c.phone && <span className="ml-2 text-xs text-slate-400">{c.phone}</span>}
              </button>
            ))}
            {search && searchResults.length === 0 && (
              <p className="text-xs text-slate-400 italic px-1">{t("tag_card.no_match", { query: search })}</p>
            )}

            <Button
              variant="outline"
              className="w-full border-slate-200 bg-white"
              onClick={createAndTag}
              disabled={busy || !(hint.name ?? "").trim()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {t("tag_card.create_and_tag", { name: (hint.name ?? "").trim() || t("tag_card.customer_word") })}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
