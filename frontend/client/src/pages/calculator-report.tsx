import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
    Check, Shield, AlertTriangle, Activity, RefreshCcw, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { EngineResult, UserInputs } from "@/lib/health-engine-logic";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert raw rupees to "₹X Lakhs" / "₹X.X Lakhs" / "₹X Cr" display string */
function formatLakhs(n: number): string {
    if (n >= 10000000) {
        const cr = n / 10000000;
        return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)} Cr`;
    }
    const lakhs = n / 100000;
    const rounded = Math.round(lakhs * 2) / 2;
    return `₹${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} Lakhs`;
}

/** Format a rupee number with Indian comma grouping */
function formatINR(n: number): string {
    return "₹" + n.toLocaleString("en-IN");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Addition 6: Tooltip wrapper */
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    return (
        <span className="relative inline-flex items-center">
            {children}
            <button
                className="ml-1 text-[var(--color-text-muted)] hover:text-[var(--color-teal-600)] transition-colors focus:outline-none"
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onFocus={() => setVisible(true)}
                onBlur={() => setVisible(false)}
                aria-label="More information"
                type="button"
            >
                <Info className="w-3.5 h-3.5" />
            </button>
            {visible && (
                <span
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-lg bg-[var(--color-navy-900)] text-white text-xs leading-relaxed p-3 shadow-xl"
                    role="tooltip"
                >
                    {text}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--color-navy-900)]" />
                </span>
            )}
        </span>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalculatorReportPage() {
// Custom navigation handler that works with both routers
const setLocation = (path: string) => {
    window.location.pathname = path;
};
    
    // Check if we are mounted under React Router DOM (e.g. /report/:uuid)
    // If so, we need to extract the uuid param manually since we are using heterogeneous routers
    const pathname = window.location.pathname;
    const isReportLink = pathname.startsWith("/report/");
    const matchUuid = isReportLink ? pathname.split("/report/")[1] : null;

    const [result, setResult] = useState<EngineResult | null>(null);
    const [inputs, setInputs] = useState<UserInputs | null>(null);
    const [loading, setLoading] = useState(isReportLink);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadReport = async () => {
            if (matchUuid) {
                try {
                    const res = await fetch(`/api/calculator/report/${matchUuid}`);
                    if (!res.ok) throw new Error("Report not found");
                    const data = await res.json();
                    setInputs(typeof data.inputs === "string" ? JSON.parse(data.inputs) : data.inputs);
                    setResult(typeof data.result_data === "string" ? JSON.parse(data.result_data) : data.result_data);
                } catch (err: any) {
                    console.error("Failed to load report from server:", err);
                    setError("This report link is invalid or has expired.");
                } finally {
                    setLoading(false);
                }
            } else {
                const savedResult = sessionStorage.getItem("calculator_result");
                const savedInputs = sessionStorage.getItem("calculator_inputs");
                if (savedResult && savedInputs) {
                    setResult(JSON.parse(savedResult));
                    setInputs(JSON.parse(savedInputs));
                    setLoading(false);
                } else {
                    setLocation("/calculator");
                }
            }
        };
        
        loadReport();
    }, [matchUuid, setLocation]);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-[var(--color-cream-main)]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-teal-600)]" />
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-[var(--color-cream-main)] p-6">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
                <h1 className="text-3xl font-serif text-[var(--color-navy-900)] mb-2">Report Not Found</h1>
                <p className="text-[var(--color-text-secondary)] text-center max-w-md mb-8">{error}</p>
                <Button onClick={() => setLocation("/calculator")} className="bg-[var(--color-teal-600)] text-white px-8">
                    Create New Report
                </Button>
            </div>
        );
    }

    if (!result || !inputs) return null;

    // ── Derived values ────────────────────────────────────────────────────────
    const hasPremium = !!result.premiumEstimate;
    const hasBreakdown = !!result.coverageBreakdown;
    const hasProjection = result.fiveYearProjection && result.fiveYearProjection.length > 0;
    const hasCorporateGap =
        !!result.corporateGap && result.corporateGap.personalNeeded > 0;

    // Minimum SI for compare link
    const minSI = result.coverageBreakdown?.finalOptimal
        ? Math.round(result.coverageBreakdown.finalOptimal / 100000) // in Lakhs
        : 0;

    return (
        <div className="min-h-screen bg-[var(--color-cream-main)] font-sans flex flex-col">
            <Header />
            <main className="flex-grow pt-24 pb-20 px-6">
                <div className="max-w-4xl mx-auto space-y-12">

                    {/* ── Header ───────────────────────────────────────────────────── */}
                    <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-teal-50)] text-[var(--color-teal-700)] rounded-full text-sm font-bold tracking-wide">
                            <Check className="w-4 h-4" /> ANALYSIS COMPLETE
                        </div>
                        <h1 className="text-4xl md:text-5xl font-serif text-[var(--color-navy-900)]">
                            Your Optimised Coverage Plan
                        </h1>
                        <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto text-lg">
                            Designed for {inputs.cityTier} costs, {inputs.familyStructure} risk, and{" "}
                            {inputs.riskPosture?.toLowerCase()} posture.
                        </p>
                    </div>

                    {/* ── 1. Coverage Tiles (now 4-col, Addition 1) ────────────────── */}
                    <div
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200"
                    >
                        {/* Base Policy */}
                        <div className="bg-white p-6 rounded-xl border border-[var(--color-border-light)] shadow-sm col-span-1">
                            <div className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                                Base Policy
                            </div>
                            <div className="text-3xl font-serif text-[var(--color-navy-900)]">
                                {result.baseCover}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)] mt-2">
                                Primary layer for standard hospitalisations.
                            </div>
                        </div>

                        {/* Super Top-Up — Addition 6: tooltip */}
                        <div className="bg-[var(--color-teal-600)] text-white p-6 rounded-xl shadow-md col-span-1 md:transform md:-translate-y-3">
                            <div className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2 flex items-center">
                                <Tooltip text="A Super Top-Up policy activates after your base cover is exhausted. It provides large coverage at a fraction of the cost of a base policy.">
                                    <span>Super Top-Up</span>
                                </Tooltip>
                            </div>
                            <div className="text-3xl font-serif">{result.superTopUp}</div>
                            <div className="text-xs text-white/80 mt-2">
                                High-value protection at ~60% lower cost than base cover.
                            </div>
                        </div>

                        {/* Total Shield — Addition 7: removed hardcoded stat */}
                        <div className="bg-white p-6 rounded-xl border border-[var(--color-border-light)] shadow-sm col-span-1">
                            <div className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                                Total Shield
                            </div>
                            <div className="text-3xl font-serif text-[var(--color-navy-900)]">
                                {result.totalProtection}
                            </div>
                            {/* Addition 7: replaced hardcoded 99.5% stat */}
                            <div className="text-xs text-[var(--color-text-muted)] mt-2">
                                Covers your actuarially-derived worst-case scenario for {inputs.cityTier} costs.
                            </div>
                        </div>

                        {/* Addition 1: Premium Estimate tile */}
                        {hasPremium && (
                            <div className="bg-white p-6 rounded-xl border border-[var(--color-border-light)] shadow-sm col-span-1">
                                <div className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                                    Est. Monthly Premium
                                </div>
                                <div className="text-2xl font-serif text-[var(--color-navy-900)] leading-tight">
                                    {formatINR(result.premiumEstimate!.monthly.min)}
                                    {" – "}
                                    {formatINR(result.premiumEstimate!.monthly.max)}
                                    <span className="text-base font-sans font-normal text-[var(--color-text-muted)]">/mo</span>
                                </div>
                                <div className="text-xs text-[var(--color-text-muted)] mt-2">
                                    Annual: {formatINR(result.premiumEstimate!.annual.min)} –{" "}
                                    {formatINR(result.premiumEstimate!.annual.max)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Addition 3: Corporate Gap banner (conditional) ───────────── */}
                    {hasCorporateGap && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                            <div className="flex items-start gap-3 bg-[var(--color-teal-50)] border border-[var(--color-teal-200)] rounded-2xl px-6 py-4">
                                <Shield className="w-5 h-5 text-[var(--color-teal-600)] shrink-0 mt-0.5" />
                                <p className="text-sm text-[var(--color-teal-900)] leading-relaxed">
                                    <span className="font-bold">Employer cover noted.</span> Your employer policy
                                    covers{" "}
                                    <span className="font-bold">
                                        {formatLakhs(result.corporateGap!.corporateSI)}
                                    </span>
                                    . You need{" "}
                                    <span className="font-bold">
                                        {formatLakhs(result.corporateGap!.personalNeeded)}
                                    </span>{" "}
                                    more in personal cover — employer policies don't follow you when you change
                                    jobs or retire.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Addition 2: Coverage Breakdown ───────────────────────────── */}
                    {hasBreakdown && (
                        <div className="bg-white rounded-2xl p-8 border border-[var(--color-border-light)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                            <h3 className="font-serif text-2xl text-[var(--color-navy-900)] mb-6 flex items-center gap-3">
                                <Activity className="text-[var(--color-teal-600)]" /> How We Calculated This
                            </h3>
                            <div className="space-y-0 divide-y divide-[var(--color-border-light)]">
                                <div className="flex justify-between items-center py-3">
                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                        Worst-Case Medical Scenario (age {inputs.exactAge ?? "–"})
                                    </span>
                                    <span className="font-mono text-sm text-[var(--color-text-main)]">
                                        {formatLakhs(result.coverageBreakdown!.worstCase)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-3">
                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                        Medical Inflation Buffer{" "}
                                        <span className="text-xs text-[var(--color-text-muted)]">(14% compounded × 3 yrs)</span>
                                    </span>
                                    <span className="font-mono text-sm text-[var(--color-teal-700)]">
                                        + {formatLakhs(result.coverageBreakdown!.inflationBuffer)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-3">
                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                        Multi-Incident Buffer{" "}
                                        <span className="text-xs text-[var(--color-text-muted)]">(10% with restoration)</span>
                                    </span>
                                    <span className="font-mono text-sm text-[var(--color-teal-700)]">
                                        + {formatLakhs(result.coverageBreakdown!.multiIncidentBuffer)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-4 bg-[var(--color-cream-dark)] -mx-8 px-8 rounded-b-2xl">
                                    <span className="font-bold text-[var(--color-navy-900)]">
                                        Your Optimal Coverage
                                    </span>
                                    <span className="font-bold font-mono text-lg text-[var(--color-navy-900)]">
                                        = {formatLakhs(result.coverageBreakdown!.finalOptimal)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── 2. Reasoning ─────────────────────────────────────────────── */}
                    <div className="bg-white rounded-2xl p-8 border border-[var(--color-border-light)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                        <h3 className="font-serif text-2xl text-[var(--color-navy-900)] mb-6 flex items-center gap-3">
                            <Activity className="text-[var(--color-teal-600)]" /> Why this structure?
                        </h3>
                        <ul className="space-y-4">
                            {result.reasoning.map((r: string, i: number) => (
                                <li key={i} className="flex gap-4 items-start">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-[var(--color-cream-dark)] flex items-center justify-center text-[var(--color-navy-900)] font-bold text-xs shrink-0">
                                        {i + 1}
                                    </div>
                                    <p className="text-[var(--color-text-main)] leading-relaxed">{r}</p>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ── 3. Riders ────────────────────────────────────────────────── */}
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
                        <h3 className="font-serif text-2xl text-[var(--color-navy-900)] mb-6 flex items-center gap-3 ml-2">
                            <Shield className="text-[var(--color-teal-600)]" /> Recommended Riders
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            {result.riders.map((rider: any, i: number) => (
                                <div
                                    key={i}
                                    className="bg-white p-6 rounded-xl border border-[var(--color-border-light)] hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-lg text-[var(--color-navy-900)]">
                                            {rider.name}
                                        </h4>
                                        {rider.priority === "High" && (
                                            <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-bold uppercase shrink-0 ml-2">
                                                Must Have
                                            </span>
                                        )}
                                        {rider.priority === "Medium" && (
                                            <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded font-bold uppercase shrink-0 ml-2">
                                                Recommended
                                            </span>
                                        )}
                                        {rider.priority === "Optional" && (
                                            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded font-bold uppercase shrink-0 ml-2">
                                                Optional
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-[var(--color-text-secondary)]">{rider.reason}</p>
                                </div>
                            ))}
                            {result.riders.length === 0 && (
                                <div className="col-span-2 p-6 bg-[var(--color-cream-dark)] rounded-xl text-center text-[var(--color-text-muted)] italic">
                                    Standard comprehensive policy covers your needs. No extra riders required.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Addition 4: 5-Year Premium Projection ────────────────────── */}
                    {hasProjection && (
                        <div className="bg-white rounded-2xl p-8 border border-[var(--color-border-light)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-600">
                            <h3 className="font-serif text-2xl text-[var(--color-navy-900)] mb-6">
                                What You'll Pay Over 5 Years
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--color-border-light)]">
                                            <th className="text-left pb-3 text-[var(--color-text-muted)] font-semibold uppercase tracking-wider text-xs">
                                                Year
                                            </th>
                                            <th className="text-right pb-3 text-[var(--color-text-muted)] font-semibold uppercase tracking-wider text-xs">
                                                Annual Premium
                                            </th>
                                            <th className="text-right pb-3 text-[var(--color-text-muted)] font-semibold uppercase tracking-wider text-xs">
                                                Cumulative Spend
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border-light)]">
                                        {result.fiveYearProjection!.map((row) => (
                                            <tr key={row.year} className="hover:bg-[var(--color-cream-dark)] transition-colors">
                                                <td className="py-3 text-[var(--color-text-main)] font-medium">
                                                    Year {row.year}
                                                </td>
                                                <td className="py-3 text-right font-mono text-[var(--color-text-main)]">
                                                    {formatINR(row.premium)}
                                                </td>
                                                <td
                                                    className={cn(
                                                        "py-3 text-right font-mono",
                                                        row.year === 5
                                                            ? "font-bold text-[var(--color-navy-900)]"
                                                            : "text-[var(--color-text-secondary)]"
                                                    )}
                                                >
                                                    {formatINR(row.cumulative)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mt-4 pt-4 border-t border-[var(--color-border-light)]">
                                * Assumes 10% annual premium escalation — industry average. Actual premiums vary
                                at renewal based on your insurer and claims history.
                            </p>
                        </div>
                    )}

                    {/* ── 4. Education & Mistakes ───────────────────────────────────── */}
                    <div className="grid md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-700">
                        <div className="bg-red-50 p-8 rounded-2xl border border-red-100">
                            <h3 className="font-serif text-xl text-red-800 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" /> What Most People Get Wrong
                            </h3>
                            <ul className="space-y-4">
                                {result.commonMistakes.map((m: string, i: number) => (
                                    <li key={i} className="text-red-900/80 text-sm leading-relaxed flex gap-2">
                                        <span>•</span> {m}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-[var(--color-teal-50)] p-8 rounded-2xl border border-[var(--color-teal-100)]">
                            <h3 className="font-serif text-xl text-[var(--color-teal-800)] mb-4 flex items-center gap-2">
                                <RefreshCcw className="w-5 h-5" /> Sensitivity Check
                            </h3>
                            <p className="text-sm text-[var(--color-teal-900)] mb-3 opacity-80">
                                This recommendation changes if:
                            </p>
                            <ul className="space-y-4">
                                {result.sensitivityAnalysis.map((s: string, i: number) => (
                                    <li key={i} className="text-[var(--color-teal-900)] text-sm leading-relaxed flex gap-2">
                                        <span>•</span> {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* ── Addition 5: Personalised CTA block ───────────────────────── */}
                    <div className="animate-in fade-in duration-1000 delay-1000 pt-4">
                        <div className="bg-white rounded-2xl border border-[var(--color-border-light)] shadow-sm p-8 space-y-4">
                            <h3 className="font-serif text-xl text-[var(--color-navy-900)] text-center mb-6">
                                What do you want to do next?
                            </h3>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                {/* Primary CTA */}
                                <Button
                                    size="lg"
                                    className="bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-700)] text-white shadow-md px-8 py-5 text-base"
                                    onClick={() =>
                                        setLocation(minSI > 0 ? `/compare?minSI=${minSI}` : "/compare")
                                    }
                                >
                                    Compare Plans With This Coverage
                                </Button>

                                {/* Secondary CTA */}
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="border-[var(--color-border-medium)] text-[var(--color-navy-900)] hover:bg-[var(--color-cream-dark)] px-8 py-5 text-base"
                                    onClick={() => setLocation("/analyze")}
                                >
                                    Analyse My Existing Policy
                                </Button>

                                {/* Ghost CTA */}
                                <Button
                                    size="lg"
                                    variant="ghost"
                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)] px-8 py-5 text-base"
                                    onClick={() => {
                                        sessionStorage.removeItem("calculator_result");
                                        sessionStorage.removeItem("calculator_inputs");
                                        setLocation("/calculator");
                                    }}
                                >
                                    Start New Analysis
                                </Button>
                            </div>

                            {/* Trust line */}
                            <p className="text-center text-xs text-[var(--color-text-muted)] pt-4 border-t border-[var(--color-border-light)]">
                                IndSure does not sell insurance or earn commissions. These recommendations are
                                purely analytical.
                            </p>
                        </div>
                    </div>

                </div>
            </main>
            <Footer />
        </div>
    );
}
