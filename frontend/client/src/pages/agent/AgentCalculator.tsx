import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Calculator, Check, Copy, ExternalLink, RefreshCw, Shield, SlidersHorizontal, User as UserIcon,
} from "lucide-react";

import CoverCalculator, { type CoverCalculatorCompletion } from "@/components/calculator/CoverCalculator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { fetchCustomer, fetchCustomers, type Customer } from "@/lib/customers";
import { resolvePartnerCompanies } from "@/lib/data/insurer-aliases";
import { getAllStates, getCitiesForState } from "@/lib/data/indian-cities-data";
import type { UserInputs } from "@/lib/health-engine-logic";
import { supabase } from "@/lib/supabase";

/** Find the state for a known city name (case-insensitive), if any. */
function findStateForCity(city: string): { state: string; city: string } | null {
  const needle = city.trim().toLowerCase();
  if (!needle) return null;
  for (const state of getAllStates()) {
    const match = getCitiesForState(state).find((c) => c.toLowerCase() === needle);
    if (match) return { state, city: match };
  }
  return null;
}

function ageFromDob(dob: string | null): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return undefined;
  const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return age >= 18 && age <= 100 ? age : undefined;
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function AgentCalculator() {
  const { agent } = useAgent();
  const [, setLocation] = useLocation();

  const customerIdParam = useMemo(
    () => new URLSearchParams(window.location.search).get("customer"),
    []
  );

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [partnerCompanies, setPartnerCompanies] = useState<string[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomer, setLoadingCustomer] = useState(!!customerIdParam);
  const [done, setDone] = useState<CoverCalculatorCompletion | null>(null);
  const [attachedTo, setAttachedTo] = useState<Customer | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [runKey, setRunKey] = useState(0);
  // When re-opening a completed run to tweak answers, the wizard restarts at
  // its review step seeded with the prior inputs (lossless via city/state).
  const [seed, setSeed] = useState<{ inputs: Partial<UserInputs>; state?: string; city?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthToken(session?.access_token ?? null);
    });
  }, []);

  useEffect(() => {
    if (!agent?.agentId) return;
    // The agent's partnered insurers drive the rider bias (canonical names only).
    supabase
      .from("agents")
      .select("partnered_companies")
      .eq("id", agent.agentId)
      .maybeSingle()
      .then(({ data }) => setPartnerCompanies(resolvePartnerCompanies(data?.partnered_companies)));
    fetchCustomers(agent.agentId).then(setCustomers).catch(() => setCustomers([]));
    if (customerIdParam) {
      fetchCustomer(agent.agentId, customerIdParam)
        .then((c) => {
          setCustomer(c);
          setAttachedTo(c);
        })
        .catch(() => setCustomer(null))
        .finally(() => setLoadingCustomer(false));
    }
  }, [agent?.agentId, customerIdParam]);

  const prefill = useMemo(() => {
    if (!customer) return {};
    const initialInputs: Partial<UserInputs> = {};
    const age = ageFromDob(customer.dob);
    if (age) initialInputs.exactAge = age;
    const loc = customer.city ? findStateForCity(customer.city) : null;
    return {
      initialInputs,
      initialState: loc?.state,
      initialCity: loc?.city,
    };
  }, [customer]);

  const shareUrl = done?.uuid ? `${window.location.origin}/calculator/report/${done.uuid}` : null;

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ variant: "success", title: "Link copied", description: "Send it to your client — no login needed." });
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Clipboard access was blocked." });
    }
  }

  function whatsAppShare() {
    if (!done) return;
    const name = attachedTo?.name?.split(" ")[0];
    const msg =
      `Hi${name ? " " + name : ""}, I ran a health-cover needs analysis for you on IndSure. ` +
      `Recommended protection: ${done.result.totalProtection} ` +
      `(${done.result.baseCover} base + ${done.result.superTopUp} super top-up).` +
      (shareUrl ? ` Full report: ${shareUrl}` : "");
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  }

  async function attachToCustomer(customerId: string) {
    if (!done?.uuid) return;
    setAssigning(true);
    try {
      const { error } = await supabase
        .from("calculator_reports")
        .update({ customer_id: customerId })
        .eq("id", done.uuid);
      if (error) throw new Error(error.message);
      const c = customers.find((x) => x.id === customerId) ?? null;
      setAttachedTo(c);
      toast({ variant: "success", title: "Saved to customer", description: c ? `Linked to ${c.name}'s portfolio.` : undefined });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not save", description: e instanceof Error ? e.message : undefined });
    } finally {
      setAssigning(false);
    }
  }

  function resetRun() {
    setDone(null);
    setCopied(false);
    setSeed(null);
    if (!customerIdParam) setAttachedTo(null);
    setRunKey((k) => k + 1);
  }

  function adjustInputs() {
    if (!done) return;
    setSeed({ inputs: done.inputs, state: done.inputs.state, city: done.inputs.city });
    setDone(null);
    setCopied(false);
    setRunKey((k) => k + 1);
  }

  const r = done?.result;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">Cover Calculator</h1>
          <p className="text-sm text-slate-500 mt-1">
            Calculate how much health cover a client actually needs — free, no checks used.
          </p>
        </div>
        {done && (
          <Button variant="outline" className="border-slate-200 bg-white" onClick={resetRun}>
            <RefreshCw className="mr-2 h-4 w-4" />
            New Calculation
          </Button>
        )}
      </div>

      {customer && (
        <div className="inline-flex items-center gap-2 rounded-full bg-[#0D9488]/10 border border-[#0D9488]/20 px-4 py-1.5 text-sm font-semibold text-[#0D9488]">
          <UserIcon className="h-3.5 w-3.5" />
          Calculating for {customer.name}
          {customer.city ? <span className="text-[#0D9488]/60 font-medium">· {customer.city}</span> : null}
        </div>
      )}

      {!done && !loadingCustomer && (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-6 md:p-10">
            <CoverCalculator
              key={runKey}
              embedded
              authToken={authToken}
              customerId={customer?.id ?? null}
              partnerCompanies={partnerCompanies}
              initialInputs={seed?.inputs ?? prefill.initialInputs}
              initialState={seed?.state ?? prefill.initialState}
              initialCity={seed?.city ?? prefill.initialCity}
              initialStepId={seed ? "review" : undefined}
              onComplete={setDone}
            />
          </CardContent>
        </Card>
      )}

      {loadingCustomer && (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-10 text-center text-slate-400">Loading customer…</CardContent>
        </Card>
      )}

      {done && r && (
        <>
          {/* RESULT */}
          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#0D9488] to-teal-600 px-6 md:px-8 py-6 text-white">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-teal-100">
                <Shield className="h-4 w-4" /> Recommended Protection
              </div>
              <div className="mt-2 text-4xl md:text-5xl font-black">{r.totalProtection}</div>
              <div className="mt-1 text-sm text-teal-50">
                {r.baseCover} base cover + {r.superTopUp} super top-up
              </div>
            </div>
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Base Cover</div>
                  <div className="mt-1 text-xl font-extrabold text-slate-800">{r.baseCover}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Super Top-up</div>
                  <div className="mt-1 text-xl font-extrabold text-slate-800">{r.superTopUp}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Est. Annual Premium</div>
                  <div className="mt-1 text-xl font-extrabold text-slate-800">
                    {formatINR(r.premiumEstimate.annual.min)}–{formatINR(r.premiumEstimate.annual.max)}
                  </div>
                </div>
              </div>

              {r.riders.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Recommended Riders</div>
                    {partnerCompanies.length > 0 && (
                      <div className="text-[11px] font-semibold text-[#0D9488]">Tuned to your partners</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {r.riders.map((rider, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                        <span
                          className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] sm:text-[10px] font-black uppercase tracking-wider ${
                            rider.priority === "High"
                              ? "bg-red-50 text-red-600 border border-red-100"
                              : rider.priority === "Medium"
                              ? "bg-amber-50 text-amber-600 border border-amber-100"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {rider.priority}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">{rider.name}</span>
                            {rider.isPartner && (
                              <span className="inline-flex items-center rounded-full bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 text-[11px] sm:text-[10px] font-bold">
                                {rider.provider}{rider.planHint ? ` · ${rider.planHint}` : ""}
                              </span>
                            )}
                            {rider.isGap && (
                              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 text-[11px] sm:text-[10px] font-bold">
                                Gap — not in your lineup
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{rider.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.reasoning.length > 0 && (
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Why this number</div>
                  <ul className="space-y-1.5">
                    {r.reasoning.slice(0, 4).map((line, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-600">
                        <span className="text-[#0D9488] shrink-0 mt-0.5">•</span>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ACTIONS */}
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
                <Button className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={copyShareLink} disabled={!shareUrl}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Copied!" : "Copy Share Link"}
                </Button>
                <Button
                  variant="outline"
                  className="border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                  onClick={whatsAppShare}
                >
                  WhatsApp It
                </Button>
                {shareUrl && (
                  <Button
                    variant="outline"
                    className="border-slate-200 bg-white"
                    onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Full Report
                  </Button>
                )}
                {!shareUrl && (
                  <span className="text-xs text-slate-400 italic">
                    Report wasn't saved — sharing unavailable for this run.
                  </span>
                )}
                <Button
                  variant="outline"
                  className="border-slate-200 bg-white text-slate-600 ml-auto"
                  onClick={adjustInputs}
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Adjust Inputs
                </Button>
              </div>

              {/* SAVE TO CUSTOMER */}
              {done.uuid && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <Calculator className="h-4 w-4 text-slate-400" />
                  {attachedTo ? (
                    <div className="text-sm text-slate-600">
                      Saved to{" "}
                      <button
                        className="font-bold text-[#0D9488] hover:underline"
                        onClick={() => setLocation(`/agent/customers/${attachedTo.id}`)}
                      >
                        {attachedTo.name}
                      </button>
                      's portfolio
                    </div>
                  ) : customers.length > 0 ? (
                    <>
                      <span className="text-sm text-slate-600">Save to customer:</span>
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                        defaultValue=""
                        disabled={assigning}
                        onChange={(e) => e.target.value && attachToCustomer(e.target.value)}
                      >
                        <option value="" disabled>
                          {assigning ? "Saving…" : "Choose customer"}
                        </option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span className="text-sm text-slate-500 italic">
                      Create a customer to attach calculations to their portfolio.
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
