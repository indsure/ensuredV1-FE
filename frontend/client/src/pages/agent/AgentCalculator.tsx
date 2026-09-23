import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Calculator, Check, Copy, Download, ExternalLink, RefreshCw, Shield, SlidersHorizontal,
  User as UserIcon,
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
import { pdf } from "@react-pdf/renderer";
import { CalculatorPDFDocument } from "@/components/CalculatorPDFDocument";
import { registerPdfFonts } from "@/components/PolicyPDFDocument";
import { supabase } from "@/lib/supabase";
import { clearAgentCalcDraft, readAgentCalcDraft, saveAgentCalcDraft, type AgentCalcDraft } from "@/lib/agentCalcDraft";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";

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


import { formatINRFull as formatINR, formatLakhs } from "@/lib/format";

export default function AgentCalculator() {
  const { agent } = useAgent();
  const { t, locale } = useLanguage();
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
  // A run the advisor left mid-way (by opening another portal page) comes back
  // here. Checked once, when the advisor is known, so the wizard mounts with it.
  const [restored, setRestored] = useState<AgentCalcDraft | null>(null);
  const [restoreChecked, setRestoreChecked] = useState(false);

  useEffect(() => {
    if (!agent?.agentId || restoreChecked) return;
    setRestored(readAgentCalcDraft(agent.agentId, customerIdParam ?? null));
    setRestoreChecked(true);
  }, [agent?.agentId, customerIdParam, restoreChecked]);

  function rememberProgress(p: { stepId: string; inputs: Partial<UserInputs>; state: string; city: string }) {
    if (!agent?.agentId) return;
    saveAgentCalcDraft({
      agentId: agent.agentId,
      customerId: customerIdParam ?? null,
      stepId: p.stepId,
      inputs: p.inputs,
      state: p.state || undefined,
      city: p.city || undefined,
    });
  }

  function finishRun(result: CoverCalculatorCompletion) {
    clearAgentCalcDraft();
    setRestored(null);
    setDone(result);
  }

  function startOver() {
    clearAgentCalcDraft();
    setRestored(null);
    setSeed(null);
    setRunKey((k) => k + 1);
  }

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
      toast({ variant: "success", title: t("agent_calc.link_copied"), description: t("agent_calc.link_copied_desc") });
    } catch {
      toast({ variant: "destructive", title: t("agent_calc.copy_failed"), description: t("agent_calc.clipboard_blocked") });
    }
  }

  function whatsAppShare() {
    if (!done) return;
    const name = attachedTo?.name?.split(" ")[0];
    const plans = done.result.plans;
    const saving = plans?.efficientSavingPct ?? 0;
    const structure = plans?.hasSplit
      ? `You can take it as one ${done.result.totalProtection} policy, or as ` +
        `${done.result.baseCover} base plus ${done.result.superTopUp} super top-up` +
        (saving > 0 ? `, which is about ${saving}% less premium for the same cover.` : ".")
      : `A single ${done.result.totalProtection} policy covers it.`;
    const msg =
      `Hi${name ? " " + name : ""}, I ran a health-cover needs analysis for you on IndSure. ` +
      `Recommended protection: ${done.result.totalProtection}. ${structure}` +
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
      toast({ variant: "success", title: t("agent_calc.saved_to_customer"), description: c ? t("agent_calc.linked_to", { name: c.name }) : undefined });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("agent_calc.save_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setAssigning(false);
    }
  }

  function resetRun() {
    clearAgentCalcDraft();
    setRestored(null);
    setDone(null);
    setCopied(false);
    setSeed(null);
    if (!customerIdParam) setAttachedTo(null);
    setRunKey((k) => k + 1);
  }

  function adjustInputs() {
    if (!done) return;
    clearAgentCalcDraft();
    setRestored(null);
    setSeed({ inputs: done.inputs, state: done.inputs.state, city: done.inputs.city });
    setDone(null);
    setCopied(false);
    setRunKey((k) => k + 1);
  }

  const r = done?.result;
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    if (downloading || !done?.result || !done?.inputs) return;
    setDownloading(true);
    try {
      // ~1.9MB of self-hosted faces, fetched only when an agent actually asks.
      registerPdfFonts();
      const blob = await pdf(
        <CalculatorPDFDocument result={done.result} inputs={done.inputs} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const who = (attachedTo?.name ?? customer?.name ?? done.inputs.city ?? "client")
        .replace(/\s+/g, "_")
        .toLowerCase();
      a.href = url;
      a.download = `indsure_cover_calculation_${who}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Cover calculation download failed:", err);
      toast({
        variant: "destructive",
        title: t("agent_calc.pdf_failed"),
        description: t("agent_calc.pdf_failed_desc"),
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("agent_calc.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("agent_calc.subtitle")}
          </p>
        </div>
        {done && (
          <Button variant="outline" className="border-slate-200 bg-white" onClick={resetRun}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("agent_calc.new_calc")}
          </Button>
        )}
      </div>

      {customer && (
        <div className="inline-flex items-center gap-2 rounded-full bg-[#0D9488]/10 border border-[#0D9488]/20 px-4 py-1.5 text-sm font-semibold text-[#0D9488]">
          <UserIcon className="h-3.5 w-3.5" />
          {t("agent_calc.calculating_for", { name: customer.name })}
          {customer.city ? <span className="text-[#0D9488]/60 font-medium">· {customer.city}</span> : null}
        </div>
      )}

      {!done && !loadingCustomer && restoreChecked && (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-6 md:p-10">
            {restored && !seed && (
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#0D9488]/20 bg-[#0D9488]/5 px-4 py-3">
                <p className="text-base text-slate-800">{t("agent_calc.kept_answers")}</p>
                <Button variant="outline" className="min-h-[44px] text-base" onClick={startOver}>
                  {t("agent_calc.start_over")}
                </Button>
              </div>
            )}
            <CoverCalculator
              key={runKey}
              embedded
              authToken={authToken}
              customerId={customer?.id ?? null}
              partnerCompanies={partnerCompanies}
              initialInputs={seed?.inputs ?? restored?.inputs ?? prefill.initialInputs}
              initialState={seed?.state ?? restored?.state ?? prefill.initialState}
              initialCity={seed?.city ?? restored?.city ?? prefill.initialCity}
              initialStepId={seed ? "review" : restored?.stepId}
              onComplete={finishRun}
              onProgress={rememberProgress}
            />
          </CardContent>
        </Card>
      )}

      {loadingCustomer && (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-10 text-center text-slate-400">{t("agent_calc.loading_customer")}</CardContent>
        </Card>
      )}

      {done && r && (
        <>
          {/* RESULT */}
          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#0D9488] to-teal-600 px-6 md:px-8 py-6 text-white">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-teal-100">
                <Shield className="h-4 w-4" /> {t("agent_calc.recommended")}
              </div>
              <div className="mt-2 text-4xl md:text-5xl font-black">{r.totalProtection}</div>
              <div className="mt-1 text-sm text-teal-50">
                {r.plans?.hasSplit
                  ? t("agent_calc.two_ways")
                  : t("agent_calc.single_policy", { amount: r.baseCover })}
              </div>
            </div>
            <CardContent className="p-6 md:p-8 space-y-6">
              {/* Both structures, side by side. An agent is comparing them WITH a
                  client, so tabs would hide half the conversation. */}
              {r.plans ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">{t("agent_calc.optimal")}</div>
                    <div className="mt-1 text-xl font-extrabold text-slate-800">
                      {formatLakhs(r.plans.optimal.baseSI)}
                    </div>
                    <div className="mt-0.5 text-sm text-slate-600">{t("agent_calc.optimal_desc")}</div>
                    <div className="mt-3 text-sm font-bold text-slate-700">
                      {formatINR(r.plans.optimal.premiumEstimate.annual.min)}–
                      {formatINR(r.plans.optimal.premiumEstimate.annual.max)}
                      <span className="ml-1 text-sm font-medium text-slate-500">{t("agent_calc.a_year")}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-black uppercase tracking-[0.2em] text-[#0D9488]">
                        {t("agent_calc.efficient")}
                      </div>
                      {r.plans.hasSplit && r.plans.efficientSavingPct > 0 && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-sm font-black text-[#0D9488] border border-teal-100">
                          {t("agent_calc.save_pct", { pct: r.plans.efficientSavingPct })}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xl font-extrabold text-slate-800">
                      {r.plans.hasSplit
                        ? `${formatLakhs(r.plans.efficient.baseSI)} + ${formatLakhs(r.plans.efficient.topUpSI)}`
                        : formatLakhs(r.plans.efficient.baseSI)}
                    </div>
                    <div className="mt-0.5 text-sm text-slate-600">
                      {r.plans.hasSplit
                        ? t("agent_calc.efficient_split")
                        : t("agent_calc.efficient_no_split")}
                    </div>
                    <div className="mt-3 text-sm font-bold text-slate-700">
                      {formatINR(r.plans.efficient.premiumEstimate.annual.min)}–
                      {formatINR(r.plans.efficient.premiumEstimate.annual.max)}
                      <span className="ml-1 text-sm font-medium text-slate-500">{t("agent_calc.a_year")}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("agent_calc.base_cover")}</div>
                    <div className="mt-1 text-xl font-extrabold text-slate-800">{r.baseCover}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("agent_calc.super_topup")}</div>
                    <div className="mt-1 text-xl font-extrabold text-slate-800">{r.superTopUp}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("agent_calc.est_premium")}</div>
                    <div className="mt-1 text-xl font-extrabold text-slate-800">
                      {formatINR(r.premiumEstimate.annual.min)}–{formatINR(r.premiumEstimate.annual.max)}
                    </div>
                  </div>
                </div>
              )}

              {r.coverCap?.applied && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {t(r.coverCap.global ? "agent_calc.capped_abroad" : "agent_calc.capped_india", { limit: formatLakhs(r.coverCap.limit), uncapped: formatINR(r.coverCap.uncapped) })}
                </div>
              )}

              {/* The ledger an agent needs when a client asks where the number
                  came from. Every line is a stage, and they sum to the total. */}
              {r.coverageBreakdown?.ledger?.length ? (
                <div>
                  <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 mb-3">
                    {t("agent_calc.how_built")}
                  </div>
                  <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100">
                    {r.coverageBreakdown.ledger.map((row, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                        <span className="text-sm text-slate-600">{row.label}</span>
                        <span
                          className={`shrink-0 font-mono text-sm font-semibold ${
                            i === 0 ? "text-slate-800" : row.amount < 0 ? "text-slate-500" : "text-[#0D9488]"
                          }`}
                        >
                          {i === 0 ? "" : row.amount < 0 ? "\u2212 " : "+ "}
                          {formatINR(Math.abs(row.amount))}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-4 bg-slate-50 px-4 py-3">
                      <span className="text-sm font-black text-slate-800">{t("agent_calc.what_they_need")}</span>
                      <span className="shrink-0 font-mono text-base font-black text-slate-900">
                        {formatINR(r.coverageBreakdown.finalOptimal)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {r.riders.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("agent_calc.riders")}</div>
                    {partnerCompanies.length > 0 && (
                      <div className="text-[11px] font-semibold text-[#0D9488]">{t("agent_calc.tuned")}</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {r.riders.map((rider, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                        <span
                          className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-black uppercase tracking-wider ${
                            rider.priority === "High"
                              ? "bg-red-50 text-red-600 border border-red-100"
                              : rider.priority === "Medium"
                              ? "bg-amber-50 text-amber-600 border border-amber-100"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {tOr(t, `agent_calc.priority_${String(rider.priority).toLowerCase()}`, rider.priority)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">{rider.name}</span>
                            {rider.isPartner && (
                              <span className="inline-flex items-center rounded-full bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 text-xs font-bold">
                                {rider.provider}{rider.planHint ? ` · ${rider.planHint}` : ""}
                              </span>
                            )}
                            {rider.isGap && (
                              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 text-xs font-bold">
                                {t("agent_calc.gap")}
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
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">{t("agent_calc.why")}</div>
                  {locale === "hi" && <p className="text-sm text-slate-500 mb-2">{t("agent_calc.engine_english")}</p>}
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
                  {copied ? t("agent_calc.copied") : t("agent_calc.copy_share")}
                </Button>
                <Button
                  variant="outline"
                  className="border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                  onClick={whatsAppShare}
                >
                  {t("agent_calc.whatsapp_it")}
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-200 bg-white"
                  onClick={downloadPdf}
                  disabled={downloading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {downloading ? t("agent_calc.preparing") : t("agent_calc.download_pdf")}
                </Button>
                {shareUrl && (
                  <Button
                    variant="outline"
                    className="border-slate-200 bg-white"
                    onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("agent_calc.open_report")}
                  </Button>
                )}
                {!shareUrl && (
                  <span className="text-xs text-slate-400 italic">
                    {t("agent_calc.not_saved")}
                  </span>
                )}
                <Button
                  variant="outline"
                  className="border-slate-200 bg-white text-slate-600 ml-auto"
                  onClick={adjustInputs}
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  {t("agent_calc.adjust")}
                </Button>
              </div>

              {/* SAVE TO CUSTOMER */}
              {done.uuid && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <Calculator className="h-4 w-4 text-slate-400" />
                  {attachedTo ? (
                    <div className="text-sm text-slate-600">
                      <button
                        className="font-bold text-[#0D9488] hover:underline"
                        onClick={() => setLocation(`/agent/customers/${attachedTo.id}`)}
                      >
                        {t("agent_calc.saved_to", { name: attachedTo.name })}
                      </button>
                    </div>
                  ) : customers.length > 0 ? (
                    <>
                      <span className="text-sm text-slate-600">{t("agent_calc.save_to_customer")}</span>
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                        defaultValue=""
                        disabled={assigning}
                        onChange={(e) => e.target.value && attachToCustomer(e.target.value)}
                      >
                        <option value="" disabled>
                          {assigning ? t("agent_calc.saving") : t("agent_calc.choose_customer")}
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
                      {t("agent_calc.create_customer_hint")}
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
