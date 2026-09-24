import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
    Check, Shield, AlertTriangle, Activity, RefreshCcw, Info, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { EngineResult, UserInputs } from "@/lib/health-engine-logic";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { pdf } from "@react-pdf/renderer";
import { CalculatorPDFDocument } from "@/components/CalculatorPDFDocument";
import { registerPdfFonts } from "@/components/PolicyPDFDocument";
import { showError } from "@/lib/calculator-notifications";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";

// Answer values are stored in English ("Couple + kids"); this shows them in the
// reader's language using the calculator's own option labels.
const optLabel = (t: (k: string) => string, v?: string) =>
    v ? tOr(t, `calc.opt_${v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`, v) : "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLakhs(n: number): string {
    if (n >= 10000000) {
        const cr = n / 10000000;
        return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)} Cr`;
    }
    const lakhs = n / 100000;
    const rounded = Math.round(lakhs * 2) / 2;
    return `₹${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} Lakhs`;
}


import { formatINRFull as formatINR } from "@/lib/format";

// ─── Sub-components ───────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    const { t } = useLanguage();
    return (
        <span className="relative inline-flex items-center">
            {children}
            <button
                className="ml-1 text-[var(--color-text-muted)] hover:text-[var(--color-teal-600)] transition-colors focus:outline-none"
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onFocus={() => setVisible(true)}
                onBlur={() => setVisible(false)}
                aria-label={t("crep.more_info")}
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

/** One row of headline tiles. Shared by both cover options and by reports
 *  stored before the split existed, so the two paths cannot drift apart. */
function CoverageTiles({
    baseLabel, baseNote, topUpLabel, topUpNote, totalLabel, totalNote, premium,
}: {
    baseLabel: string;
    baseNote: string;
    topUpLabel: string | null;
    topUpNote: string;
    totalLabel: string;
    totalNote: string;
    premium?: EngineResult["premiumEstimate"];
}) {
    const { t } = useLanguage();
    return (
        <div
            className={cn(
                "grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200",
                topUpLabel ? "md:grid-cols-4" : "md:grid-cols-3",
            )}
        >
            <div className="bg-white p-6 rounded-xl border border-[var(--color-border-light)] shadow-sm col-span-1">
                <div className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                    {t("crep.base")}
                </div>
                <div className="text-3xl font-serif text-[var(--color-navy-900)]">{baseLabel}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-2">{baseNote}</div>
            </div>

            {topUpLabel && (
                <div className="bg-[var(--color-cta)] text-white p-6 rounded-xl shadow-md col-span-1 md:transform md:-translate-y-3">
                    <div className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2 flex items-center">
                        <Tooltip text={t("crep.topup_tip")}>
                            <span>{t("crep.topup")}</span>
                        </Tooltip>
                    </div>
                    <div className="text-3xl font-serif">{topUpLabel}</div>
                    <div className="text-xs text-white/80 mt-2">{topUpNote}</div>
                </div>
            )}

            <div className="bg-white p-6 rounded-xl border border-[var(--color-border-light)] shadow-sm col-span-1">
                <div className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                    {t("crep.total")}
                </div>
                <div className="text-3xl font-serif text-[var(--color-navy-900)]">{totalLabel}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-2">{totalNote}</div>
            </div>

            {premium && (
                <div className="bg-white p-6 rounded-xl border border-[var(--color-border-light)] shadow-sm col-span-1">
                    <div className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                        {t("crep.monthly")}
                    </div>
                    <div className="text-2xl font-serif text-[var(--color-navy-900)] leading-tight">
                        {formatINR(premium.monthly.min)}
                        {" – "}
                        {formatINR(premium.monthly.max)}
                        <span className="text-base font-sans font-normal text-[var(--color-text-muted)]">{t("crep.per_mo")}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-2">
                        {t("crep.annual", { min: formatINR(premium.annual.min), max: formatINR(premium.annual.max) })}
                    </div>
                </div>
            )}
        </div>
    );
}

/** The same cover, offered two ways. Reports stored before the engine emitted
 *  `plans` have no second option, so they render exactly as they were computed
 *  instead of being given an invented split. */
function CoverageOptions({ result, cityTier }: { result: EngineResult; cityTier?: string }) {
    const plans = result.plans;
    const [view, setView] = useState<"optimal" | "efficient">("optimal");
    const { t } = useLanguage();

    const costNote = t("crep.cost_note", { tier: cityTier ?? t("crep.your_city") });

    if (!plans) {
        return (
            <CoverageTiles
                baseLabel={result.baseCover}
                baseNote={t("crep.primary")}
                topUpLabel={result.superTopUp !== "None" ? result.superTopUp : null}
                topUpNote={t("crep.pays_after")}
                totalLabel={result.totalProtection}
                totalNote={costNote}
                premium={result.premiumEstimate}
            />
        );
    }

    const active = plans[view];
    const saving = plans.efficientSavingPct;

    return (
        <div className="space-y-5">
            {plans.hasSplit && (
                <>
                    <div className="flex justify-center">
                        <div role="tablist" aria-label={t("crep.structure_aria")} className="inline-flex p-1 bg-slate-100 rounded-full">
                            {(["optimal", "efficient"] as const).map((key) => (
                                <button
                                    key={key}
                                    role="tab"
                                    type="button"
                                    aria-selected={view === key}
                                    onClick={() => setView(key)}
                                    className={cn(
                                        "px-5 py-2 rounded-full text-sm font-bold transition-colors",
                                        view === key
                                            ? "bg-white text-[var(--color-navy-900)] shadow-sm"
                                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-navy-900)]",
                                    )}
                                >
                                    {key === "optimal" ? t("crep.optimal") : t("crep.efficient")}
                                    {key === "efficient" && saving > 0 && (
                                        <span className="ml-2 text-[var(--color-teal-600)]">{t("crep.save", { n: saving })}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <p className="text-center text-sm text-[var(--color-text-secondary)] max-w-2xl mx-auto">
                        {view === "optimal"
                            ? t("crep.opt_desc", { base: formatLakhs(active.baseSI) })
                            : t("crep.eff_desc", { total: formatLakhs(active.totalSI), base: formatLakhs(active.baseSI), topup: formatLakhs(active.topUpSI), n: saving })}
                    </p>
                </>
            )}

            {result.coverCap?.applied && (
                <p className="text-center text-sm text-[var(--color-text-secondary)] max-w-2xl mx-auto">
                    {t(result.coverCap.global ? "crep.capped_abroad" : "crep.capped_india", { limit: formatLakhs(result.coverCap.limit), uncapped: formatINR(result.coverCap.uncapped) })}
                </p>
            )}

            <CoverageTiles
                baseLabel={formatLakhs(active.baseSI)}
                baseNote={
                    active.topUpSI > 0
                        ? t("crep.primary")
                        : t("crep.single")
                }
                topUpLabel={active.topUpSI > 0 ? formatLakhs(active.topUpSI) : null}
                topUpNote={
                    saving > 0
                        ? t("crep.carries", { n: saving })
                        : t("crep.pays_after")
                }
                totalLabel={formatLakhs(active.totalSI)}
                totalNote={costNote}
                premium={active.premiumEstimate}
            />
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalculatorReportPage() {
    const setLocation = (path: string) => {
        window.location.pathname = path;
    };

    const pathname = window.location.pathname;
    const pathParts = pathname.split("/");
    const lastSegment = pathParts[pathParts.length - 1];
    const isUuidRoute = pathname.includes("/calculator/report/") && lastSegment !== "report";
    const matchUuid = isUuidRoute ? lastSegment : null;

    const { t, locale } = useLanguage();
    const [result, setResult] = useState<EngineResult | null>(null);
    const [inputs, setInputs] = useState<UserInputs | null>(null);
    const [loading, setLoading] = useState(isUuidRoute);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        if (downloading || !result || !inputs) return;
        setDownloading(true);
        try {
            // The faces are ~1.9MB and self-hosted, so they are registered lazily:
            // nothing is fetched until someone actually asks for the document.
            registerPdfFonts();
            const blob = await pdf(
                <CalculatorPDFDocument result={result} inputs={inputs} />,
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const slug = [inputs.city, inputs.exactAge ? String(inputs.exactAge) : inputs.ageBand]
                .filter(Boolean)
                .join("_")
                .replace(/\s+/g, "_")
                .toLowerCase();
            a.href = url;
            a.download = `indsure_cover_calculation${slug ? `_${slug}` : ""}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            // Give the browser a tick to start the download before revoking.
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.error("Cover calculation download failed:", err);
            showError(
                t("crep.pdf_failed"),
                t("crep.pdf_failed_d"),
            );
        } finally {
            setDownloading(false);
        }
    };
    const [showSavedBanner, setShowSavedBanner] = useState(false);

    useEffect(() => {
        const loadReport = async () => {
            if (matchUuid) {
                try {
                    const res = await apiFetch(`/api/calculator/report/${matchUuid}`);
                    if (!res.ok) throw new Error("Report not found");
                    const data = await res.json();
                    setInputs(typeof data.inputs === "string" ? JSON.parse(data.inputs) : data.inputs);
                    setResult(typeof data.result_data === "string" ? JSON.parse(data.result_data) : data.result_data);
                    
                    // Check if this is a fresh save (within last 5 seconds)
                    const savedTimestamp = sessionStorage.getItem("calculator_saved_timestamp");
                    if (savedTimestamp) {
                        const timeDiff = Date.now() - parseInt(savedTimestamp);
                        if (timeDiff < 5000) {
                            setShowSavedBanner(true);
                            // Auto-hide after 5 seconds
                            setTimeout(() => setShowSavedBanner(false), 5000);
                        }
                        sessionStorage.removeItem("calculator_saved_timestamp");
                    }
                } catch (err: any) {
                    setError(t("crep.invalid"));
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
    }, [matchUuid]);

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
                <h1 className="text-3xl font-serif text-[var(--color-navy-900)] mb-2">{t("crep.not_found")}</h1>
                <p className="text-[var(--color-text-secondary)] text-center max-w-md mb-8">{error}</p>
                <Button onClick={() => setLocation("/calculator")} className="bg-[var(--color-cta)] text-white px-8">
                    {t("crep.create_new")}
                </Button>
            </div>
        );
    }

    if (!result || !inputs) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-[var(--color-cream-main)] p-6 text-center">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mb-5" />
                <h1 className="text-3xl font-serif text-[var(--color-navy-900)] mb-2">{t("crep.missing")}</h1>
                <p className="text-[var(--color-text-secondary)] max-w-md mb-8">
                    {t("crep.missing_d")}
                </p>
                <Button onClick={() => setLocation("/calculator")} className="bg-[var(--color-cta)] text-white px-8">
                    {t("crep.back_calc")}
                </Button>
            </div>
        );
    }

    const hasPremium = !!result.premiumEstimate;
    const hasBreakdown = !!result.coverageBreakdown;
    const hasProjection = result.fiveYearProjection && result.fiveYearProjection.length > 0;

    // Reports stored before the engine emitted a full ledger only carry the three
    // legacy figures, which never summed to the total they sat under. Show those
    // as they were computed; new reports get every step.
    const ledger =
        result.coverageBreakdown?.ledger ??
        [
            {
                label: `Worst-case medical scenario${inputs?.exactAge ? ` (age ${inputs.exactAge})` : ""}`,
                amount: result.coverageBreakdown?.worstCase ?? 0,
            },
            { label: "Medical inflation buffer", amount: result.coverageBreakdown?.inflationBuffer ?? 0 },
            { label: "Multi-incident buffer", amount: result.coverageBreakdown?.multiIncidentBuffer ?? 0 },
        ].filter((r) => r.amount !== 0);
    const hasCorporateGap =
        !!result.corporateGap && result.corporateGap.personalNeeded > 0;

    const minSI = result.coverageBreakdown?.finalOptimal
        ? Math.round(result.coverageBreakdown.finalOptimal / 100000)
        : 0;

    return (
        <div className="min-h-screen bg-[var(--color-cream-main)] font-sans flex flex-col">
            <Header />
            <main className="flex-grow pt-24 pb-12 sm:pb-16 lg:pb-20 px-6">
                <div className="max-w-4xl mx-auto space-y-12">

                    {/* ── Regulatory Disclaimer ─────────────────────────────────────── */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                        <strong>{t("crep.disc_b")}</strong> {t("crep.disc")}
                    </div>

                    {locale === "hi" && (
                        <p className="text-sm text-[var(--color-text-secondary)]">{t("crep.english_note")}</p>
                    )}

                    {/* ── Success Banner (only shows after fresh save) ─────────────── */}
                    {showSavedBanner && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="bg-[var(--color-teal-50)] border-2 border-[var(--color-teal-200)] rounded-xl p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--color-teal-600)] flex items-center justify-center shrink-0">
                                    <Check className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-[var(--color-teal-900)]">{t("crep.saved")}</p>
                                    <p className="text-sm text-[var(--color-teal-700)]">
                                        {t("crep.saved_d")}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowSavedBanner(false)}
                                    className="text-[var(--color-teal-600)] hover:text-[var(--color-teal-800)] transition-colors"
                                    aria-label={t("crep.close")}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Header ───────────────────────────────────────────────────── */}
                    <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-teal-50)] text-[var(--color-teal-700)] rounded-full text-sm font-bold tracking-wide">
                            <Check className="w-4 h-4" /> {t("crep.complete")}
                        </div>
                        <h1 className="text-4xl md:text-5xl font-serif text-[var(--color-navy-900)]">
                            {t("crep.h")}
                        </h1>
                        <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto text-lg">
                            {t("crep.designed", {
                                tier: inputs.cityTier ?? "",
                                family: optLabel(t, inputs.familyStructure),
                                posture: locale === "hi" ? optLabel(t, inputs.riskPosture) : (inputs.riskPosture?.toLowerCase() ?? ""),
                            })}
                        </p>
                    </div>

                    {/* ── Coverage options ──────────────────────────────────────────── */}
                    <CoverageOptions result={result} cityTier={inputs.cityTier} />

                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            onClick={handleDownload}
                            disabled={downloading}
                            className="border-[var(--color-border-medium)] text-[var(--color-navy-900)] hover:bg-[var(--color-cream-dark)]"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {downloading ? t("crep.preparing") : t("crep.download")}
                        </Button>
                    </div>

                    {/* ── Corporate Gap banner ─────────────────────────────────────── */}
                    {hasCorporateGap && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                            <div className="flex items-start gap-3 bg-[var(--color-teal-50)] border border-[var(--color-teal-200)] rounded-2xl px-6 py-4">
                                <Shield className="w-5 h-5 text-[var(--color-teal-600)] shrink-0 mt-0.5" />
                                <p className="text-sm text-[var(--color-teal-900)] leading-relaxed">
                                    <span className="font-bold">{t("crep.emp_b")}</span>{" "}
                                    {t("crep.emp", {
                                        corp: formatLakhs(result.corporateGap!.corporateSI),
                                        personal: formatLakhs(result.corporateGap!.personalNeeded),
                                    })}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Coverage Breakdown ───────────────────────────────────────── */}
                    {hasBreakdown && (
                        <div className="bg-white rounded-2xl p-8 border border-[var(--color-border-light)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                            <h3 className="font-serif text-2xl text-[var(--color-navy-900)] mb-6 flex items-center gap-3">
                                <Activity className="text-[var(--color-teal-600)]" /> {t("crep.how")}
                            </h3>
                            <div className="space-y-0 divide-y divide-[var(--color-border-light)]">
                                {ledger.map((row, i) => (
                                    <div key={i} className="flex justify-between items-baseline gap-6 py-3">
                                        <span className="text-sm text-[var(--color-text-secondary)]">{row.label}</span>
                                        <span
                                            className={cn(
                                                "font-mono text-sm whitespace-nowrap",
                                                i === 0
                                                    ? "text-[var(--color-text-main)]"
                                                    : row.amount < 0
                                                        ? "text-[var(--color-text-muted)]"
                                                        : "text-[var(--color-teal-700)]",
                                            )}
                                        >
                                            {i === 0 ? "" : row.amount < 0 ? "\u2212 " : "+ "}
                                            {formatINR(Math.abs(row.amount))}
                                        </span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center py-4 bg-[var(--color-cream-dark)] -mx-8 px-8 rounded-b-2xl">
                                    <span className="font-bold text-[var(--color-navy-900)]">{t("crep.need")}</span>
                                    {/* Full rupees, like the PDF. Rounded to lakhs, this column
                                        visibly summed to half a lakh less than its own total. */}
                                    <span className="font-bold font-mono text-lg text-[var(--color-navy-900)]">
                                        = {formatINR(result.coverageBreakdown!.finalOptimal)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Reasoning ────────────────────────────────────────────────── */}
                    <div className="bg-white rounded-2xl p-8 border border-[var(--color-border-light)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                        <h3 className="font-serif text-2xl text-[var(--color-navy-900)] mb-6 flex items-center gap-3">
                            <Activity className="text-[var(--color-teal-600)]" /> {t("crep.why")}
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

                    {/* ── Riders ───────────────────────────────────────────────────── */}
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
                        <h3 className="font-serif text-2xl text-[var(--color-navy-900)] mb-6 flex items-center gap-3 ml-2">
                            <Shield className="text-[var(--color-teal-600)]" /> {t("crep.riders")}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                                {t("crep.must")}
                                            </span>
                                        )}
                                        {rider.priority === "Medium" && (
                                            <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded font-bold uppercase shrink-0 ml-2">
                                                {t("crep.recommended")}
                                            </span>
                                        )}
                                        {rider.priority === "Optional" && (
                                            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded font-bold uppercase shrink-0 ml-2">
                                                {t("crep.optional")}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-[var(--color-text-secondary)]">{rider.reason}</p>
                                </div>
                            ))}
                            {result.riders.length === 0 && (
                                <div className="col-span-2 p-6 bg-[var(--color-cream-dark)] rounded-xl text-center text-[var(--color-text-muted)] italic">
                                    {t("crep.no_riders")}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── 5-Year Premium Projection ────────────────────────────────── */}
                    {hasProjection && (
                        <div className="bg-white rounded-2xl p-8 border border-[var(--color-border-light)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-600">
                            <h3 className="font-serif text-2xl text-[var(--color-navy-900)] mb-6">
                                {t("crep.five")}
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--color-border-light)]">
                                            <th className="text-left pb-3 text-[var(--color-text-muted)] font-semibold uppercase tracking-wider text-xs">
                                                {t("crep.year")}
                                            </th>
                                            <th className="text-right pb-3 text-[var(--color-text-muted)] font-semibold uppercase tracking-wider text-xs">
                                                {t("crep.annual_premium")}
                                            </th>
                                            <th className="text-right pb-3 text-[var(--color-text-muted)] font-semibold uppercase tracking-wider text-xs">
                                                {t("crep.cumulative")}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border-light)]">
                                        {result.fiveYearProjection!.map((row) => (
                                            <tr key={row.year} className="hover:bg-[var(--color-cream-dark)] transition-colors">
                                                <td className="py-3 text-[var(--color-text-main)] font-medium">
                                                    {t("crep.year_n", { n: row.year })}
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
                                {t("crep.assumes")}
                            </p>
                        </div>
                    )}

                    {/* ── Education & Mistakes ──────────────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-700">
                        <div className="bg-red-50 p-8 rounded-2xl border border-red-100">
                            <h3 className="font-serif text-xl text-red-800 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" /> {t("crep.wrong")}
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
                                <RefreshCcw className="w-5 h-5" /> {t("crep.sensitivity")}
                            </h3>
                            <p className="text-sm text-[var(--color-teal-900)] mb-3 opacity-80">
                                {t("crep.changes_if")}
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

                    {/* ── CTA block ─────────────────────────────────────────────────── */}
                    <div className="animate-in fade-in duration-1000 delay-1000 pt-4">
                        <div className="bg-white rounded-2xl border border-[var(--color-border-light)] shadow-sm p-8 space-y-4">
                            <h3 className="font-serif text-xl text-[var(--color-navy-900)] text-center mb-6">
                                {t("crep.next")}
                            </h3>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button
                                    size="lg"
                                    className="bg-[var(--color-cta)] hover:bg-[var(--color-teal-700)] text-white shadow-md px-8 py-5 text-base"
                                    onClick={() =>
                                        setLocation(minSI > 0 ? `/compare?minSI=${minSI}` : "/compare")
                                    }
                                >
                                    {t("crep.compare")}
                                </Button>

                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="border-[var(--color-border-medium)] text-[var(--color-navy-900)] hover:bg-[var(--color-cream-dark)] px-8 py-5 text-base"
                                    onClick={() => setLocation("/analyze")}
                                >
                                    {t("crep.analyse")}
                                </Button>

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
                                    {t("crep.start_new")}
                                </Button>
                            </div>

                            <p className="text-center text-xs text-[var(--color-text-muted)] pt-4 border-t border-[var(--color-border-light)]">
                                {t("crep.no_sell")}
                            </p>
                        </div>
                    </div>

                </div>
            </main>
            <Footer />
        </div>
    );
}