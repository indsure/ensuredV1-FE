
import { useState } from "react";
import {
    Shield, CheckCircle2, AlertCircle,
    ChevronDown, ChevronUp, FileText, Printer,
    Clock, Zap, Search, AlertTriangle, Activity,
    Hospital, Baby, Pill, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ForensicAuditReport, getVerdictColor, formatINR, calculateEffectiveCoverage } from "@/types/master_audit_schema";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { CoverageDiagnostic } from "./CoverageDiagnostic";

interface PolicyAuditReportProps {
    data: ForensicAuditReport;
}

export function PolicyAuditReport({ data }: PolicyAuditReportProps) {
    const [isEvidenceOpen, setIsEvidenceOpen] = useState(true);

    // --- HELPER LOGIC ---
    const verdict = data.final_verdict?.label || "RISKY";
    const verdictColor = getVerdictColor(verdict);

    // Deductions flattening
    const deductions = data.audit_score?.deductions || [];

    // --- REAL-TIME POLICY AGE CALCULATION (KILL THE CACHE) ---
    const calculatePolicyAgeDays = (): number => {
        if (!data.policy_timeline?.policy_inception_date) return 0;
        const start = new Date(data.policy_timeline.policy_inception_date);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - start.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const realTimePolicyAgeDays = calculatePolicyAgeDays();
    const effectiveCoverage = calculateEffectiveCoverage(data);

    // --- ACTION ELIGIBILITY FILTERING ---
    // Hard Rule: If policy is > 30 days old, DO NOT show "Wait out 30-day period"
    const filteredCriticalActions = data.recommendations?.critical_actions?.filter(act => {
        const isInitialWaitAction = act.action.toLowerCase().includes("30-day") || act.action.toLowerCase().includes("waiting period");
        if (isInitialWaitAction && realTimePolicyAgeDays > 30) {
            return false; // Suppress
        }
        return true; // Keep others
    }) || [];

    // --- COMPONENT SECTIONS ---

    return (
        <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-navy-900)] pb-20">
            <Header />

            <main className="max-w-5xl mx-auto pt-32 px-6 print:pt-10 print:px-8">

                {/* --- TOP BAR (ACTIONS) --- */}
                <div className="flex justify-between items-center mb-8 print:hidden">
                    <div className="text-sm text-[var(--color-text-secondary)] font-mono">
                        AUDIT ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => window.print()} className="hover:bg-[var(--color-cream-dark)]">
                        <Printer className="w-4 h-4 mr-2" /> Print Forensic Report
                    </Button>
                </div>

                {/* --- 1. VERDICT HEADER --- */}
                <div className="mb-12 border-b border-[var(--color-border-light)] pb-12">
                    <span className={cn(
                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border",
                        verdict === 'SAFE' ? "bg-green-50 text-green-700 border-green-200" :
                            verdict === 'BORDERLINE' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-red-50 text-red-700 border-red-200"
                    )}>
                        {verdict === 'SAFE' && <CheckCircle2 className="w-4 h-4" />}
                        {verdict === 'BORDERLINE' && <AlertTriangle className="w-4 h-4" />}
                        {verdict === 'RISKY' && <AlertCircle className="w-4 h-4" />}
                        Veridct: {verdict} Policy
                    </span>

                    {/* Dynamic Concise Header */}
                    {/* Dynamic Header (AI Generated - Level 0 + 4) */}
                    <div className="mb-8 max-w-4xl">
                        <h1 className="text-3xl md:text-4xl font-serif text-[var(--color-navy-900)] mb-4 leading-tight">
                            {data.final_verdict?.summary}
                        </h1>
                        <p className="text-lg text-[var(--color-text-secondary)] font-medium flex items-center gap-2">
                            Analysis based on strict policy wordings.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
                        <div>
                            <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Insured</div>
                            <div className="font-semibold text-lg">{data.identity?.insured_names?.join(", ")}</div>
                        </div>
                        <div>
                            <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Effective Cover</div>
                            <div className="font-semibold text-lg font-mono text-[var(--color-green-primary)]">
                                {formatINR(effectiveCoverage)}
                            </div>
                            <CoverageDiagnostic report={data} effectiveCoverage={effectiveCoverage || 0} />
                        </div>
                        <div>
                            <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Policy Age</div>
                            <div className="font-semibold text-lg">{realTimePolicyAgeDays > 365 ? `${(realTimePolicyAgeDays / 365).toFixed(1)} Years` : `${realTimePolicyAgeDays} Days`}</div>
                        </div>
                        <div>
                            <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Zone</div>
                            <div className="font-semibold text-lg">Zone {data.identity?.assumed_zone}</div>
                        </div>
                    </div>
                </div>

                {/* --- 2. FORENSIC SCORECARD (V2) --- */}
                <div className="grid md:grid-cols-12 gap-8 mb-16">
                    {/* LEFT: BIG NUMBER */}
                    <div className="md:col-span-4 bg-white border border-[var(--color-border-light)] rounded-xl p-8 flex flex-col justify-center items-center text-center shadow-sm relative overflow-hidden">
                        <div className={cn(
                            "absolute inset-0 opacity-5",
                            verdict === 'SAFE' ? "bg-green-500" : verdict === 'RISKY' ? "bg-red-500" : "bg-amber-500"
                        )} />

                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Forensic Health Score</span>
                        <div className={cn(
                            "text-8xl font-serif leading-none mb-4",
                            verdict === 'SAFE' ? "text-[var(--color-green-primary)]" : verdict === 'RISKY' ? "text-red-600" : "text-amber-600"
                        )}>
                            {data.audit_score?.score}
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] max-w-[200px] leading-relaxed">
                            This score reflects structural cleanliness, not outcome adequacy for every medical event.
                        </p>
                    </div>

                    {/* RIGHT: BREAKDOWN BARS */}
                    <div className="md:col-span-8 bg-white border border-[var(--color-border-light)] rounded-xl p-8 shadow-sm">
                        <h3 className="font-serif text-lg text-[var(--color-navy-900)] mb-6">Risk Composition Analysis</h3>
                        <div className="space-y-6">

                            {/* 1. Claim Rejection Risk */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-medium">Claim Rejection Probability</span>
                                    <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                                        {data.audit_score?.breakdown?.claim_rejection_risk}/30 Risk Pts
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-red-500 transition-all rounded-full"
                                        style={{ width: `${(data.audit_score?.breakdown?.claim_rejection_risk / 30) * 100}%` }}
                                    />
                                </div>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">Measures exposure to rule-based claim denials.</p>
                            </div>

                            {/* 2. OOP Exposure */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-medium">Out-of-Pocket Exposure</span>
                                    <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                                        {data.audit_score?.breakdown?.oop_exposure}/30 Risk Pts
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-500 transition-all rounded-full"
                                        style={{ width: `${(data.audit_score?.breakdown?.oop_exposure / 30) * 100}%` }}
                                    />
                                </div>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">Measures likely personal expense despite claim approval.</p>
                            </div>

                            {/* 3. Coverage Quality */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-medium">Coverage Quality Gap</span>
                                    <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                                        {20 - (data.audit_score?.breakdown?.coverage_adequacy || 0)}/20 Gap Pts
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all rounded-full"
                                        style={{ width: `${((20 - (data.audit_score?.breakdown?.coverage_adequacy || 0)) / 20) * 100}%` }}
                                    />
                                </div>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">Measures structural exclusions and caps.</p>
                            </div>
                        </div>
                    </div>
                </div>


                {/* --- 3. CRITICAL EVIDENCE (The 3 Boxes) --- */}
                <section className="mb-16 grid md:grid-cols-3 gap-6">
                    {/* Good Stuff */}
                    <div className="border border-[var(--color-border-light)] bg-white p-6 rounded-lg">
                        <div className="flex items-center gap-2 mb-4 text-[var(--color-green-primary)] font-bold text-sm uppercase tracking-wider">
                            <CheckCircle2 className="w-5 h-5" /> Strong Points
                        </div>
                        <ul className="space-y-3">
                            {data.benefit_evaluation?.what_actually_works?.map((item, i) => (
                                <li key={i} className="text-sm border-l-2 border-[var(--color-green-primary)] pl-3">
                                    <span className="font-medium block text-[var(--color-navy-900)]">{item.benefit}</span>
                                    <span className="text-xs text-[var(--color-text-secondary)]">{item.why_it_matters_in_claim}</span>
                                    {item.quantified_value && (
                                        <div className="mt-1 text-xs font-mono text-[var(--color-green-primary)] font-bold bg-green-50 inline-block px-1.5 rounded">
                                            Value: {item.quantified_value}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Bad Stuff */}
                    <div className="border border-red-100 bg-red-50/30 p-6 rounded-lg">
                        <div className="flex items-center gap-2 mb-4 text-red-600 font-bold text-sm uppercase tracking-wider">
                            <AlertCircle className="w-5 h-5" /> Known Coverage Shortfalls
                        </div>
                        <ul className="space-y-3">
                            {data.benefit_evaluation?.where_policy_fails?.map((item, i) => (
                                <li key={i} className="text-sm border-l-2 border-red-400 pl-3">
                                    <span className="font-medium block text-[var(--color-navy-900)]">{item.issue}</span>
                                    <span className="text-xs text-[var(--color-text-secondary)]">{item.real_world_claim_impact}</span>
                                    {item.quantified_oop_risk && (
                                        <div className="mt-1 text-xs font-mono text-red-600 font-bold bg-red-50 inline-block px-1.5 rounded border border-red-100">
                                            Risk: {item.quantified_oop_risk}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Waiting Periods - RENDER ONLY IF ACTIVE */}
                    {!data.waiting_period_analysis?.policy_fully_active && (
                        <div className="border border-blue-100 bg-blue-50/30 p-6 rounded-lg">
                            <div className="flex items-center gap-2 mb-4 text-blue-600 font-bold text-sm uppercase tracking-wider">
                                <Clock className="w-5 h-5" /> Time-Bound Coverage Conditions
                            </div>
                            <ul className="space-y-3">
                                {/* Initial Wait */}
                                {data.waiting_period_analysis?.initial_waiting_period?.is_active_today && (
                                    <li className="flex justify-between items-center text-sm border-b border-blue-100 pb-2">
                                        <div>
                                            <span className="block font-medium">Initial Waiting Period</span>
                                            <div className="text-xs text-[var(--color-text-secondary)]">Wait: 30 Days</div>
                                        </div>
                                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded">LOCKED</span>
                                    </li>
                                )}
                                {/* PED */}
                                <li className="flex justify-between items-center text-sm border-b border-blue-100 pb-2">
                                    <div>
                                        <span className="block font-medium">Pre-Existing Diseases</span>
                                        <div className="text-xs text-[var(--color-text-secondary)]">Wait: {data.waiting_period_analysis?.pre_existing_disease?.duration_months} Months</div>
                                    </div>
                                    {data.waiting_period_analysis?.pre_existing_disease?.is_active_today ? (
                                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded">LOCKED</span>
                                    ) : (
                                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded">COVERED</span>
                                    )}
                                </li>
                                {/* Maternity */}
                                {data.supplementary_coverage?.maternity?.covered && (
                                    <li className="flex justify-between items-center text-sm border-b border-blue-100 pb-2">
                                        <div>
                                            <span className="block font-medium">Maternity</span>
                                            <div className="text-xs text-[var(--color-text-secondary)]">Wait: {data.waiting_period_analysis?.maternity?.duration_months} Months</div>
                                        </div>
                                        {data.waiting_period_analysis?.maternity?.is_active_today ? (
                                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded">LOCKED</span>
                                        ) : (
                                            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded">COVERED</span>
                                        )}
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </section>


                {/* --- 4. DETAILED FORENSIC ANALYSIS (TABS/DRAWER) --- */}
                <section className="mb-16">
                    <div className="flex items-center gap-3 mb-6">
                        <Activity className="w-6 h-6 text-[var(--color-teal-600)]" />
                        <h3 className="font-serif text-2xl text-[var(--color-navy-900)]">Detailed Forensic Analysis</h3>
                    </div>

                    <div className="space-y-4">
                        {/* A. FINANCIAL LIMITS */}
                        <div className="bg-white border border-[var(--color-border-light)] rounded-lg overflow-hidden">
                            <div className="p-4 bg-[var(--color-cream-light)] border-b border-[var(--color-border-light)] flex justify-between items-center">
                                <span className="font-bold text-sm uppercase tracking-wider text-[var(--color-navy-900)]">Financial Limits & Caps</span>
                                <Shield className="w-4 h-4 text-[var(--color-text-muted)]" />
                            </div>
                            <div className="p-6 grid md:grid-cols-2 gap-8">
                                {/* Room Rent */}
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium">Room Rent Limit</span>
                                        <span className={cn(
                                            "text-xs font-bold uppercase",
                                            data.claim_risk_analysis?.room_rent?.risk_level === 'low' ? "text-green-600" : "text-red-600"
                                        )}>{data.claim_risk_analysis?.room_rent?.limit_value || "No Limit"}</span>
                                    </div>
                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                        {data.claim_risk_analysis?.room_rent?.explanation}
                                    </p>
                                </div>
                                {/* Co-Pay */}
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium">Co-Payment</span>
                                        <span className={cn(
                                            "text-xs font-bold uppercase",
                                            data.claim_risk_analysis?.co_payment?.risk_level === 'low' ? "text-green-600" : "text-red-600"
                                        )}>{data.claim_risk_analysis?.co_payment?.exists ? `${data.claim_risk_analysis.co_payment.percentage}%` : "0%"}</span>
                                    </div>
                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                        {data.claim_risk_analysis?.co_payment?.conditions || "No co-payment implies full claim settlement."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* B. SUPPLEMENTARY BENEFITS */}
                        <div className="bg-white border border-[var(--color-border-light)] rounded-lg overflow-hidden">
                            <div className="p-4 bg-[var(--color-cream-light)] border-b border-[var(--color-border-light)] flex justify-between items-center">
                                <span className="font-bold text-sm uppercase tracking-wider text-[var(--color-navy-900)]">Supplementary Benefits</span>
                                <Pill className="w-4 h-4 text-[var(--color-text-muted)]" />
                            </div>
                            <div className="p-6 grid md:grid-cols-3 gap-6">
                                {/* OPD */}
                                <div className="p-3 bg-slate-50 rounded text-center">
                                    <div className="text-xs uppercase text-[var(--color-text-muted)] mb-1">OPD Cover</div>
                                    <div className={cn("font-bold", data.supplementary_coverage?.opd?.covered ? "text-green-600" : "text-slate-400")}>
                                        {data.supplementary_coverage?.opd?.covered ? "Covered" : "Not Covered"}
                                    </div>
                                </div>
                                {/* Modern Treatments */}
                                <div className="p-3 bg-slate-50 rounded text-center">
                                    <div className="text-xs uppercase text-[var(--color-text-muted)] mb-1">Modern Treatments</div>
                                    <div className={cn("font-bold", data.supplementary_coverage?.modern_treatments?.covered ? "text-green-600" : "text-slate-400")}>
                                        {data.supplementary_coverage?.modern_treatments?.covered ? "Covered" : "Not Covered"}
                                    </div>
                                </div>
                                {/* Consumables */}
                                <div className="p-3 bg-slate-50 rounded text-center">
                                    <div className="text-xs uppercase text-[var(--color-text-muted)] mb-1">Consumables</div>
                                    <div className={cn("font-bold", data.supplementary_coverage?.consumables?.covered ? "text-green-600" : "text-slate-400")}>
                                        {data.supplementary_coverage?.consumables?.coverage_type === 'full' ? "Fully Covered" : "Partial/None"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* C. NETWORK */}
                        <div className="bg-white border border-[var(--color-border-light)] rounded-lg overflow-hidden">
                            <div className="p-4 bg-[var(--color-cream-light)] border-b border-[var(--color-border-light)] flex justify-between items-center">
                                <span className="font-bold text-sm uppercase tracking-wider text-[var(--color-navy-900)]">Network & Access</span>
                                <Hospital className="w-4 h-4 text-[var(--color-text-muted)]" />
                            </div>
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-medium">Hospitals in Zone {data.identity?.assumed_zone}</span>
                                    <span className="text-lg font-bold text-[var(--color-navy-900)]">{data.network_limitations?.hospital_count_in_zone || "Unknown"}</span>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {data.network_limitations?.major_hospitals_included?.map((h, i) => (
                                        <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">
                                            {h}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- 5. POLICY STATE SECTION (Dynamic: Failure vs Affirmation) --- */}
                <section className={cn(
                    "border rounded-xl p-8 md:p-12 mb-20 shadow-lg relative overflow-hidden transition-colors",
                    filteredCriticalActions.length > 0
                        ? "bg-white border-slate-200" // Failure Mode
                        : "bg-[#F0FDF4] border-green-100" // Affirmation Mode
                )}>
                    {/* Background Icon */}
                    <div className="absolute top-0 right-0 p-12 opacity-5">
                        {filteredCriticalActions.length > 0 ? (
                            <Zap className="w-64 h-64 text-slate-900" />
                        ) : (
                            <Shield className="w-64 h-64 text-green-600" />
                        )}
                    </div>

                    <div className="relative z-10">
                        {filteredCriticalActions.length > 0 ? (
                            /* FAILURE MODE */
                            <div>
                                <h3 className="font-serif text-2xl mb-8 flex items-center gap-2 text-slate-900">
                                    <Clock className="w-6 h-6 text-teal-600" />
                                    Policy Limitations & Required Actions
                                </h3>
                                <div className="mb-8">
                                    <div className="text-[10px] font-mono uppercase tracking-widest text-red-300 mb-4 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        Critical Attention Required
                                    </div>
                                    <div className="grid gap-4">
                                        {filteredCriticalActions.map((act, i) => (
                                            <div key={i} className="bg-slate-50 p-4 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="font-bold text-lg text-slate-900">{act.action}</div>
                                                    {act.estimated_cost && (
                                                        <span className="text-xs font-mono bg-white px-2 py-1 rounded text-teal-700 border border-teal-100">
                                                            Est. Cost: {act.estimated_cost}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-600 mb-3 leading-relaxed">{act.reason}</p>

                                                {act.oop_risk_if_ignored && (
                                                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 bg-red-100 border border-red-200 px-3 py-1.5 rounded-full mt-2">
                                                        <AlertTriangle className="w-3.5 h-3.5 fill-red-700 text-white" />
                                                        If ignored: Risk of {act.oop_risk_if_ignored} loss
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* AFFIRMATION MODE (Policy Status) */
                            <div>
                                <h3 className="font-serif text-2xl mb-2 flex items-center gap-2 text-green-900">
                                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                                    Policy Status: No Immediate Risks
                                </h3>
                                <p className="text-sm text-green-800 font-medium mb-8">
                                    All time-bound conditions are satisfied. No action is required at this stage.
                                </p>

                                {/* Affirmation Cards */}
                                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                                    {data.positive_state_assertions?.map((item, i) => (
                                        <div key={i} className="bg-white/60 border border-green-200 p-4 rounded-lg hover:bg-white transition-colors">
                                            <div className="text-xs font-bold uppercase tracking-wider text-green-700 mb-1">
                                                {item.label}
                                            </div>
                                            <div className="text-sm text-green-900 font-medium leading-snug">
                                                {item.status}
                                            </div>
                                        </div>
                                    ))}
                                    {/* Fallback if no assertions generated */}
                                    {(!data.positive_state_assertions || data.positive_state_assertions.length === 0) && (
                                        <div className="col-span-full text-xs text-green-600 italic">
                                            Forensic verification complete. No active limitations found.
                                        </div>
                                    )}
                                </div>

                                {/* FORWARD TRUTHS (WHAT MATTERS NEXT) - Rendered INSIDE Affirmation Mode */}
                                {data.forward_planning_truths && data.forward_planning_truths.length > 0 && (
                                    <div className="border-t border-green-200/50 pt-8 mt-8">
                                        <h3 className="font-serif text-xl text-slate-900 mb-6 flex items-center gap-2">
                                            What Matters Next
                                        </h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            {data.forward_planning_truths.map((truth, i) => (
                                                <div key={i} className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm">
                                                    <h4 className="font-bold text-slate-800 text-base mb-2">{truth.title}</h4>
                                                    <p className="text-sm font-medium text-slate-900 mb-2 leading-relaxed">
                                                        {truth.statement}
                                                    </p>
                                                    <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
                                                        {truth.implication}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Portability Check */}
                        {data.recommendations?.should_port_to_better_policy?.recommendation !== 'no' && (
                            <div className="mt-8 pt-8 border-t border-slate-200">
                                <div className="text-xs font-mono uppercase tracking-widest text-teal-700 mb-2">Switching Advice</div>
                                <h4 className="text-xl font-serif text-slate-900 mb-2">
                                    Should you switch policies?
                                    <span className={cn("ml-2 font-sans font-bold",
                                        data.recommendations?.should_port_to_better_policy?.recommendation === 'yes' ? "text-green-400" : "text-amber-400"
                                    )}>
                                        {data.recommendations?.should_port_to_better_policy?.recommendation?.toUpperCase()}
                                    </span>
                                </h4>
                                <p className="text-sm text-slate-600 max-w-2xl mb-4">
                                    {data.recommendations?.should_port_to_better_policy?.reason}
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                    <span className="text-xs text-slate-500">Look for:</span>
                                    {data.recommendations?.should_port_to_better_policy?.what_to_look_for?.map((tag, i) => (
                                        <span key={i} className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* --- 6. FUTURE PLANNING CONSIDERATIONS (Contextual Risk Layer) --- */}
                {data.future_planning_considerations?.length > 0 && (
                    <section className="mb-20">
                        <h3 className="font-serif text-lg text-slate-400 mb-6 uppercase tracking-widest text-xs font-bold">
                            Future Planning Considerations
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            {data.future_planning_considerations.map((item, i) => (
                                <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg p-6">
                                    <h4 className="font-serif text-slate-700 text-lg mb-3">{item.title}</h4>
                                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                                        {item.body}
                                    </p>
                                    <div className="text-xs text-slate-400 border-t border-slate-200 pt-3 mt-3">
                                        <p className="mb-2 w-full"><span className="font-semibold text-slate-500">Context:</span> {item.disclosure}</p>
                                        <p className="italic text-slate-400">{item.neutral_context}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

            </main>
            <div className="text-center pb-20 pt-8 border-t border-[var(--color-border-light)] max-w-2xl mx-auto">
                <p className="font-serif text-lg text-slate-400 italic mb-2">
                    "Decisions change outcomes. The policy does not."
                </p>
                <p className="text-xs text-slate-300 uppercase tracking-widest font-bold">
                    This audit shows how the policy behaves, not what you should do.
                </p>
            </div>

            <Footer />
        </div>
    );
}
