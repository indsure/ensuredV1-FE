
import { useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Info,
    ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ForensicAuditReport, formatINR } from "@/types/master_audit_schema";

// --- STRICT EXTERNAL BENCHMARKS (PROMPT 3) ---
const STRESS_TEST_SCENARIOS = [
    { name: "Accidental Injury", cost: 100000 },
    { name: "Knee Surgery", cost: 500000 },
    { name: "Diabetes (complications)", cost: 700000 },
    { name: "Chronic Kidney Disease", cost: 1000000 },
    { name: "Hypertension (complications)", cost: 1300000 },
    { name: "Liver Disease", cost: 1500000 },
    { name: "Tuberculosis", cost: 2000000 },
    { name: "COVID / Severe Respiratory", cost: 2500000 },
    { name: "Heart Disease", cost: 4000000 },
    { name: "Cancer", cost: 5000000 }
];

interface CoverageDiagnosticProps {
    report: ForensicAuditReport;
    effectiveCoverage: number;
}

export function CoverageDiagnostic({ report, effectiveCoverage }: CoverageDiagnosticProps) {

    // Helper to determine status
    const getStatus = (ratio: number) => {
        if (ratio >= 1.0) return { label: "Sufficient", color: "text-green-700 bg-green-50 border-green-200", barColor: "bg-green-500" };
        if (ratio >= 0.70) return { label: "Borderline", color: "text-amber-700 bg-amber-50 border-amber-200", barColor: "bg-amber-500" };
        if (ratio >= 0.40) return { label: "Insufficient", color: "text-orange-700 bg-orange-50 border-orange-200", barColor: "bg-orange-500" };
        return { label: "Severe Gap", color: "text-red-700 bg-red-50 border-red-200", barColor: "bg-red-600" };
    };

    // --- SUMMARY STATS ---
    const failedScenarios = STRESS_TEST_SCENARIOS.filter(s => effectiveCoverage < s.cost);
    const failCount = failedScenarios.length;
    // Highest uncovered risk = Most expensive scenario that isn't covered
    const highestRisk = failedScenarios.length > 0
        ? failedScenarios.reduce((prev, current) => (current.cost > prev.cost ? current : prev))
        : null;

    return (
        <div className="print:hidden mt-1">
            <Sheet>
                <SheetTrigger asChild>
                    <button className="text-[13px] text-slate-500 hover:text-slate-800 transition-colors font-normal text-left leading-tight group">
                        Is this amount actually sufficient?<br />
                        <span className="underline decoration-slate-300 underline-offset-2 group-hover:decoration-slate-500">Check coverage stress</span> <span className="font-light inline-block ml-0.5 transition-transform group-hover:translate-x-0.5">&rarr;</span>
                    </button>
                </SheetTrigger>
                <SheetContent side="right" className="flex flex-col h-full overflow-hidden w-full sm:w-[450px] sm:max-w-md p-0 border-l border-[var(--color-border-medium)] shadow-xl">

                    {/* DRAWER HEADER */}
                    <div className="flex-none p-6 bg-[var(--color-cream-main)] border-b border-[var(--color-border-medium)] z-10">
                        <SheetTitle className="font-serif text-2xl text-[var(--color-navy-900)] mb-1">
                            Medical Cost Coverage Analysis
                        </SheetTitle>
                        <SheetDescription className="text-sm text-[var(--color-text-secondary)] mb-4">
                            Based on real hospital costs. Not insurer promises.
                        </SheetDescription>

                        <div className="bg-white px-3 py-2 rounded border border-[var(--color-border-light)] text-sm font-semibold text-[var(--color-navy-900)] inline-flex items-center gap-2 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-green-primary)]" />
                            Selected Cover: {formatINR(effectiveCoverage)}
                        </div>
                    </div>

                    {/* SCROLLABLE LIST */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        <div className="space-y-6">
                            {STRESS_TEST_SCENARIOS.map((scenario) => {
                                const coverageRatio = effectiveCoverage / scenario.cost;
                                const status = getStatus(coverageRatio);
                                const percentage = Math.min(100, Math.round(coverageRatio * 100)); // Cap at 100% for display
                                const gapAmount = Math.max(0, scenario.cost - effectiveCoverage);

                                return (
                                    <div key={scenario.name} className="relative">
                                        {/* Name & Cost */}
                                        <div className="flex justify-between items-end mb-2">
                                            <div>
                                                <div className="font-bold text-sm text-[var(--color-navy-900)]">{scenario.name}</div>
                                                <div className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">Expected Cost</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono font-bold text-sm">{formatINR(scenario.cost)}</div>
                                            </div>
                                        </div>

                                        {/* Visualization Bar */}
                                        <div className="h-4 w-full bg-slate-100 rounded-sm overflow-hidden mb-2 relative border border-slate-200">
                                            {/* Covered Portion */}
                                            <div
                                                className={cn("h-full transition-all duration-500 ease-out", status.barColor)}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>

                                        {/* Footer Stats */}
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", status.color)}>
                                                    {status.label}
                                                </span>
                                                <span className="text-xs font-mono font-medium text-[var(--color-text-secondary)]">
                                                    {percentage}% Covered
                                                </span>
                                            </div>

                                            {/* Optional Inline Detail: Primary Limitation */}
                                            {gapAmount > 0 ? (
                                                <div className="text-[10px] text-red-600 font-medium flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Sum Insured Ceiling
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-green-700 font-medium flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Fully Covered
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-4 bg-[var(--color-cream-light)] rounded border border-[var(--color-border-light)] text-[10px] text-[var(--color-text-muted)] leading-relaxed text-center">
                            Benchmark costs derived from metro city corporate hospital rates. <br />
                            Inflation adjusted.
                        </div>
                    </div>

                    {/* GLOBAL SUMMARY (KILL SHOT) */}
                    <div className="flex-none p-6 bg-[var(--color-navy-900)] text-white border-t border-[var(--color-navy-800)] z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
                        {highestRisk ? (
                            <>
                                <div className="font-serif text-lg mb-2 leading-tight">
                                    This cover fails to fully handle <span className="text-red-400 font-bold text-2xl mx-1">{failCount}</span> out of 10 common medical events.
                                </div>
                                <div className="text-sm text-[var(--color-white-muted)] flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                    Highest uncovered risk: <span className="font-bold text-white">{highestRisk.name}</span>
                                    <span className={cn("ml-1 font-mono font-bold", effectiveCoverage / highestRisk.cost < 0.4 ? "text-red-400" : "text-amber-400")}>
                                        ({Math.round((effectiveCoverage / highestRisk.cost) * 100)}% coverage)
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-8 h-8 text-green-400" />
                                <div>
                                    <div className="font-bold text-lg text-white">Comprehensive Protection</div>
                                    <div className="text-sm text-green-400">This cover fully handles all 10 benchmark scenarios.</div>
                                </div>
                            </div>
                        )}
                    </div>

                </SheetContent>
            </Sheet>
        </div>
    );
}
