import { useState, useEffect, useRef } from "react";
import { getApiBase } from "@/lib/queryClient";
import {
    Shield, CheckCircle2, AlertCircle,
    ChevronDown, ChevronUp, FileText, Printer,
    Clock, Zap, Search, AlertTriangle, Activity,
    Hospital, Baby, Pill, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
    ForensicAuditReport,
    getVerdictColor,
    formatINR,
    calculateEffectiveCoverage,
    getNCARLabel,
    getWaitingPeriodStatus,
    RiskLevel,
    computeUnlockDate
} from "../../../../backend/server/types/policy";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { CoverageDiagnostic } from "./CoverageDiagnostic";
import { Tooltip } from "@/components/ui/tooltip";
import { getZoneForCity } from "@/lib/data/zones";
import { pdf } from '@react-pdf/renderer';
import { PolicyPDFDocument } from './PolicyPDFDocument';

interface PolicyAuditReportProps {
    data: ForensicAuditReport;
}

// ─── Risk Helpers ─────────────────────────────────────────────────────────────

function getRiskColor(level: "low" | "medium" | "high") {
    switch (level) {
        case "low": return "text-green-600 bg-green-50 border-green-200";
        case "medium": return "text-amber-600 bg-amber-50 border-amber-200";
        case "high": return "text-red-600 bg-red-50 border-red-200";
    }
}

function getRiskBarWidth(level: "low" | "medium" | "high") {
    switch (level) {
        case "low": return "25%";
        case "medium": return "60%";
        case "high": return "90%";
    }
}

function getRiskBarColor(level: "low" | "medium" | "high") {
    switch (level) {
        case "low": return "bg-green-500";
        case "medium": return "bg-amber-500";
        case "high": return "bg-red-500";
    }
}

function getPortingColor(rec: "yes" | "no" | "consider") {
    switch (rec) {
        case "no": return "text-green-700 bg-green-50 border-green-200";
        case "consider": return "text-amber-700 bg-amber-50 border-amber-200";
        case "yes": return "text-red-700 bg-red-50 border-red-200";
    }
}

function getSimulationVerdictColor(verdict: "COVERED" | "PARTIAL" | "EXPOSED") {
    switch (verdict) {
        case "COVERED": return "text-green-600 bg-green-50 border-green-200";
        case "PARTIAL": return "text-amber-600 bg-amber-50 border-amber-200";
        case "EXPOSED": return "text-red-600 bg-red-50 border-red-200";
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PolicyAuditReport({ data }: PolicyAuditReportProps) {
    const [showDeductions, setShowDeductions] = useState(false);
    const [hospitalCount, setHospitalCount] = useState<number | null>(null);
    const [insurerHospitalCount, setInsurerHospitalCount] = useState<number | null>(null);
    const [openBreakdown, setOpenBreakdown] = useState<Record<string, boolean>>({});
    const auditId = useRef(Math.random().toString(36).substr(2, 9).toUpperCase());

    const handleDownload = async () => {
        const blob = await pdf(<PolicyPDFDocument data={data} />).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `indsure_audit_${data.identity.insured_names.join('_').replace(/\s+/g, '_').toLowerCase()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const toggleBreakdown = (category: string) => {
        setOpenBreakdown(prev => ({ ...prev, [category]: !prev[category] }));
    };

    // ─── Dynamic Risk Logic (Where It May Cost You) ───
    const getRiskItems = (auditResult: ForensicAuditReport) => {
        const items: { issue: string; real_world_claim_impact: string; quantified_oop_risk?: string; severity: "high" | "medium" | "low" }[] = [];

        try {
            const ageStr = auditResult.identity?.ages?.[0]?.toString() || "35";
            const age = parseInt(ageStr, 10) || 35;
            const gender = auditResult.identity?.genders?.[0] || "Unknown";
            const city = auditResult.identity?.city || "";
            const policyZone = auditResult.identity?.assumed_zone || "C";
            const actualZone = getZoneForCity(city) || "C";
            const flags = auditResult.identity?.health_flags || [];

            const copay = auditResult.claim_risk_analysis?.co_payment;
            const roomRent = auditResult.claim_risk_analysis?.room_rent;
            const subLimitsWrapper = auditResult.claim_risk_analysis?.sub_limits;
            const deduct = auditResult.claim_risk_analysis?.deductibles;
            const waiting = auditResult.waiting_period_analysis;
            const supp = auditResult.supplementary_coverage;
            const riders = auditResult.coverage_structure?.riders || [];

            // Geographic Formatting Context
            const isZoneA = actualZone === "A";
            const isZoneB = actualZone === "B";
            const zoneContext = isZoneA ? "metro hospitals" : (isZoneB ? "major city hospitals" : "local hospitals");
            const zoneCostContext = isZoneA ? "₹3–8 Lakhs for major surgery" : (isZoneB ? "₹1.5–4 Lakhs for major surgery" : "standard costs in your city");

            // 1. Zone Co-Payment
            if (copay?.exists) {
                const isZoneCopay = copay.conditions?.toLowerCase().includes("zone");
                const ZONE_RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };
                const isLivingInHigherZone = (ZONE_RANK[actualZone] ?? 3) < (ZONE_RANK[policyZone] ?? 3);

                if (isZoneCopay) {
                    if (isLivingInHigherZone) {
                        items.push({
                            issue: "Zone Mismatch — Extra Costs at Home",
                            real_world_claim_impact: `Your policy is registered as Zone ${policyZone}, but your city (${city || "your city"}) is Zone ${actualZone}. Every hospitalisation here triggers a ${copay.percentage || "mandatory"}% co-payment automatically.`,
                            quantified_oop_risk: `${formatINR(copay.oop_on_5L_claim || 100000)} out of pocket on a ₹5L claim.`,
                            severity: "high"
                        });
                    } else {
                        items.push({
                            issue: "Zone Upgrade Co-payment",
                            real_world_claim_impact: `Your policy is Zone ${policyZone}. You have full coverage in your city, but if you get treated in a more expensive zone (like a Zone A metro hospital), an ${copay.percentage || "mandatory"}% co-payment applies.`,
                            quantified_oop_risk: `${formatINR(copay.oop_on_5L_claim || 100000)} out of pocket on a ₹5L claim if treated outside your zone.`,
                            severity: "low"
                        });
                    }
                } else {
                    items.push({
                        issue: "Mandatory Co-payment on Every Claim",
                        real_world_claim_impact: `This policy requires you to pay ${copay.percentage || "a portion"}% of every claim bill regardless of hospital.`,
                        quantified_oop_risk: `${formatINR(copay.oop_on_5L_claim || 50000)} out of pocket on a ₹5L claim.`,
                        severity: copay.percentage && copay.percentage > 10 ? "high" : "medium"
                    });
                }
            }

            // 2. Room Rent Capping
            if (roomRent && roomRent.limit_type !== "none") {
                let impact = roomRent.explanation || "Room rent is capped, leading to proportional deductions on all hospital bills.";
                items.push({
                    issue: "Room Rent Capping Penalty",
                    real_world_claim_impact: impact,
                    quantified_oop_risk: "If your room costs more than this limit, the insurer cuts the entire bill proportionally.",
                    severity: roomRent.risk_level || "high"
                });
            }

            // 3. Sub-Limits (Age Filtered)
            if (subLimitsWrapper?.exists && subLimitsWrapper.categories) {
                subLimitsWrapper.categories.forEach(cat => {
                    const proc = cat.procedure.toLowerCase();
                    let shouldShow = true;
                    let customBody = `${formatINR(cat.limit || 0)} limit per claim/year.`;
                    let customRed = cat.gap ? `Gap: ${formatINR(cat.gap)}` : "High out of pocket expected.";

                    if (proc.includes("cataract")) {
                        if (age < 45) shouldShow = false;
                        else {
                            customBody = `${formatINR(cat.limit || 0)} limit per eye. For bilateral surgery the total cap is ${formatINR((cat.limit || 0) * 2)}. Premium IOL lenses cost ₹20,000–₹40,000 more per eye than this limit.`;
                            customRed = cat.gap ? `Gap: ${formatINR(cat.gap)} per eye for premium lenses.` : "Gap expected for premium lenses.";
                        }
                    } else if (proc.includes("joint") || proc.includes("knee")) {
                        if (age < 50) shouldShow = false;
                    } else if (proc.includes("cardiac") || proc.includes("heart")) {
                        if (age < 40) shouldShow = false;
                    }

                    if (shouldShow) {
                        items.push({
                            issue: `${cat.procedure} Sub-limit`,
                            real_world_claim_impact: customBody,
                            quantified_oop_risk: customRed,
                            severity: cat.severity || "medium"
                        });
                    }
                });
            }

            // 4. Deductible Risk
            if (deduct && deduct.base_deductible && deduct.base_deductible > 0) {
                items.push({
                    issue: "Base Deductible Applied",
                    real_world_claim_impact: `You must pay the first ${formatINR(deduct.base_deductible)} of your hospital bills every year before the insurer pays anything.`,
                    quantified_oop_risk: deduct.per_claim_impact || `Routine claims below ${formatINR(deduct.base_deductible)} won't be paid.`,
                    severity: "medium"
                });
            }

            // 5. Waiting Periods (ONLY Active)
            if (waiting) {
                if (waiting.pre_existing_disease?.is_active_today) {
                    items.push({
                        issue: "Pre-Existing Diseases Not Covered",
                        real_world_claim_impact: `${waiting.pre_existing_disease.months_remaining || "Several"} months remaining before pre-existing conditions are covered.`,
                        quantified_oop_risk: `Claims will be rejected until ${waiting.pre_existing_disease.end_date || "waiting period ends"}.`,
                        severity: "high"
                    });
                }
                if (waiting.specific_diseases?.is_active_today) {
                    const dlist = waiting.specific_diseases.diseases_covered?.join(", ") || "specific surgeries";
                    items.push({
                        issue: "Specific Surgeries Locked",
                        real_world_claim_impact: `Waiting period active for: ${dlist}.`,
                        quantified_oop_risk: `Claims for these conditions before ${waiting.specific_diseases.end_date || "waiting period ends"} will be rejected.`,
                        severity: "medium"
                    });
                }
                if (waiting.personal_waiting_periods && waiting.personal_waiting_periods.length > 0) {
                    waiting.personal_waiting_periods.forEach(pw => {
                        if (pw.is_active_today) {
                            items.push({
                                issue: `Condition Exclusion: ${pw.condition}`,
                                real_world_claim_impact: `${pw.months_remaining || "Several"} months remaining before this specific condition is covered.`,
                                quantified_oop_risk: `Claims rejected until ${pw.end_date || "waiting period ends"}.`,
                                severity: "high"
                            });
                        }
                    });
                }
            }

            // 6. Maternity Gap
            if (gender.toLowerCase() === "female" && age >= 22 && age <= 42) {
                const mat = supp?.maternity;
                if (!mat || mat.covered === false) {
                    items.push({
                        issue: "Maternity Not Covered",
                        real_world_claim_impact: "This policy does not cover delivery or pregnancy-related hospitalisation.",
                        quantified_oop_risk: `Normal delivery costs ₹50,000–₹1,50,000; C-section ₹1,00,000–₹2,50,000 in ${zoneContext}.`,
                        severity: "medium"
                    });
                } else if (waiting?.maternity?.is_active_today) {
                    items.push({
                        issue: "Maternity Waiting Period Active",
                        real_world_claim_impact: `${waiting.maternity.months_remaining || "Several"} months remaining before maternity claims are payable.`,
                        quantified_oop_risk: `Planned delivery before ${waiting.maternity.end_date || "waiting period ends"} will not be covered.`,
                        severity: "medium"
                    });
                }
            }

            // 7. Critical Illness Gap
            if (age >= 25 && age <= 55) {
                const hasCI = riders.some(r => r.name.toLowerCase().includes("critical") && r.is_material);
                if (!hasCI) {
                    let flagNote = "";
                    if (flags.some(f => f.toLowerCase().includes("triglycerides") || f.toLowerCase().includes("blood pressure")) && age >= 30) {
                        flagNote = " Your declared health profile increases cardiac risk. A CI cover is especially recommended.";
                    }
                    items.push({
                        issue: "No Critical Illness Cover",
                        real_world_claim_impact: `This policy only reimburses hospital bills. A cancer, heart attack, or stroke diagnosis triggers no lump-sum payout — leaving income loss and long-term treatment costs entirely on you. At age ${age}, this is a material gap.${flagNote}`,
                        quantified_oop_risk: `Recommended: standalone CI cover of ₹25–50 Lakhs.`,
                        severity: "medium"
                    });
                }
            }

            // 8. OPD Gap
            const opd = supp?.opd;
            if (!opd || opd.covered === false || (opd.limit_per_year && opd.limit_per_year < 5000)) {
                const limit = opd?.limit_per_year || 0;
                const visits = Math.floor(limit / 800);
                const visitLabel = visits === 1 ? "visit" : "visits";
                items.push({
                    issue: "OPD Cover Too Low to Be Useful",
                    real_world_claim_impact: limit > 0
                        ? `Annual OPD limit of ${formatINR(limit)} covers only ${visits} doctor ${visitLabel} at metro rates. Routine consultations and medicines are mostly out of pocket.`
                        : `Routine doctor consultations, diagnostics, and medicines are entirely out of pocket.`,
                    quantified_oop_risk: "Consider a top-up OPD plan or health wallet.",
                    severity: "low"
                });
            }

        } catch (e) {
            console.error("Error building risk items", e);
        }

        // De-duplicate items by issue name
        const uniqueItems = Array.from(new Map(items.map(item => [item.issue, item])).values());

        // Sort: High -> Medium -> Low, then by name
        const severityWeight = { high: 3, medium: 2, low: 1 };
        return uniqueItems.sort((a, b) => {
            if (severityWeight[a.severity] !== severityWeight[b.severity]) {
                return severityWeight[b.severity] - severityWeight[a.severity];
            }
            return a.issue.localeCompare(b.issue);
        });
    };

    const dynamicRiskItems = data ? getRiskItems(data) : [];

    const renderDeductionsList = (category: string) => {
        const deductions = data.audit_score?.deductions?.filter(d => d.category === category) || [];
        if (deductions.length === 0) {
            return <div className="text-sm italic text-slate-500">No deductions. This category is clean.</div>;
        }
        return (
            <ul className="list-disc space-y-1 ml-4 text-sm text-gray-600">
                {deductions.map((d, i) => (
                    <li key={i}>
                        {d.reason} — {Math.abs(d.points)} pts
                    </li>
                ))}
            </ul>
        );
    };

    // All values come from the prompt-computed fields now
    const verdict = data.final_verdict?.label ?? "RISKY";
    const score = data.audit_score?.score ?? 0;
    const ncar = data.audit_score?.ncar ?? 0;
    const simulations = data.claim_simulations ?? [];
    const effectiveCoverage = calculateEffectiveCoverage(data);

    // Real-time policy age
    const realTimePolicyAgeDays = (() => {
        if (!data.policy_timeline?.policy_inception_date) return 0;
        const start = new Date(data.policy_timeline.policy_inception_date);
        const diffMs = Math.abs(Date.now() - start.getTime());
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    })();

    const portingRec = data.recommendations?.should_port_to_better_policy;

    // ── Live hospital network lookup ──────────────────────────────────────────
    useEffect(() => {
        const city = data.identity?.city;
        if (!city) return;

        fetch(`${getApiBase()}/api/hospitals/filter?city=${encodeURIComponent(city)}`)
            .then(r => r.json())
            .then((result) => {
                const cityRow = result.cityLevel?.[0];
                if (!cityRow) return;
                setHospitalCount(cityRow.unique_hospital_count);

                // Try to match this policy's insurer from network_limitations remarks
                // or fall back to first insurer in the list
                const insurerHint = data.network_limitations?.remarks?.toLowerCase() ?? "";
                const matched = cityRow.insurers?.find((ins: any) => {
                    const slug = ins.insurer_slug.toLowerCase();
                    return insurerHint.includes(slug.replace(/-/g, " ").split(" ")[0]);
                });
                if (matched) {
                    setInsurerHospitalCount(matched.hospital_count);
                } else if (cityRow.insurers?.length > 0) {
                    // No match — don't show insurer-specific count, just total
                    setInsurerHospitalCount(null);
                }
            })
            .catch(() => { }); // Non-critical — fail silently
    }, [data.identity?.city]);

    return (
        <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-navy-900)] pb-20">
            <Header />

            <main className="max-w-5xl mx-auto pt-32 sm:pt-36 md:pt-40 px-4 sm:px-6 print:pt-10 print:px-8 overflow-x-hidden">

                {/* ── TOP BAR ── */}
                <div className="flex justify-between items-center mb-8 print:hidden">
                    <div className="text-sm text-[var(--color-text-secondary)] font-mono">
                        AUDIT ID: {auditId.current}
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleDownload} className="hover:bg-[var(--color-cream-dark)]">
                        <Printer className="w-4 h-4 mr-2" /> Download Report
                    </Button>
                </div>

                {/* ── 1. VERDICT HEADER ── */}
                <div className="mb-12 border-b border-[var(--color-border-light)] pb-12">
                    <span className={cn(
                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border",
                        verdict === "SAFE" ? "bg-green-50 text-green-700 border-green-200" :
                            verdict === "BORDERLINE" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-red-50 text-red-700 border-red-200"
                    )}>
                        {verdict === "SAFE" && <CheckCircle2 className="w-4 h-4" />}
                        {verdict === "BORDERLINE" && <AlertTriangle className="w-4 h-4" />}
                        {verdict === "RISKY" && <AlertCircle className="w-4 h-4" />}
                        Verdict: {
                            verdict === "SAFE" ? "Strong Structural Coverage" :
                                verdict === "BORDERLINE" ? "Good Core Coverage with Areas to Improve" :
                                    "Limited Structural Protection – Improvement Recommended"
                        }
                    </span>

                    <div className="mb-8 max-w-4xl">
                        <h1 className="text-3xl md:text-4xl font-serif text-[var(--color-navy-900)] mb-4 leading-tight">
                            {data.final_verdict?.summary}
                        </h1>
                        <p className="text-lg text-[var(--color-text-secondary)] font-medium">
                            {data.final_verdict?.will_this_policy_protect_in_real_claim}
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
                            <div className="font-semibold text-lg">
                                {realTimePolicyAgeDays > 365
                                    ? `${(realTimePolicyAgeDays / 365).toFixed(1)} Years`
                                    : `${realTimePolicyAgeDays} Days`}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Data Quality</div>
                            <div className="font-semibold text-lg capitalize">{data.data_quality?.overall ?? "N/A"}</div>
                        </div>
                    </div>
                </div>

                {/* ── 2. SCORECARD + SCORE BREAKDOWN ── */}
                <div className="grid md:grid-cols-12 gap-8 mb-16">

                    {/* LEFT: BIG NUMBER */}
                    <div className="md:col-span-4 bg-white border border-[var(--color-border-light)] rounded-xl p-8 flex flex-col justify-center items-center text-center shadow-sm relative overflow-hidden">
                        <div className={cn(
                            "absolute inset-0 opacity-5",
                            verdict === "SAFE" ? "bg-green-500" :
                                verdict === "RISKY" ? "bg-red-500" : "bg-amber-500"
                        )} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Audit Score</span>
                        <div className={cn(
                            "text-8xl font-serif leading-none mb-2",
                            verdict === "SAFE" ? "text-[var(--color-green-primary)]" :
                                verdict === "RISKY" ? "text-red-600" : "text-amber-600"
                        )}>
                            {score}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] mb-3">
                            NCAR: <span className="font-mono font-bold">{ncar.toFixed(2)}×</span>
                            {" — "}<span className="italic">{getNCARLabel(ncar)}</span>
                            <div className="text-xs text-slate-500 mt-1">
                                Your cover is {ncar.toFixed(2)}× the minimum recommended for your age and city.
                            </div>
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] max-w-[220px] leading-relaxed mx-auto space-y-1">
                            <p>Computed from {data.audit_score?.deductions?.length ?? 0} deduction {(data.audit_score?.deductions?.length ?? 0) === 1 ? 'rule' : 'rules'}.</p>
                            <p>All scores are AI-computed from your policy text.</p>
                            <p>No manual overrides.</p>
                        </div>
                    </div>

                    {/* RIGHT: SCORE BREAKDOWN */}
                    {data.audit_score?.breakdown && (
                        <div className="md:col-span-8 bg-white border border-[var(--color-border-light)] rounded-xl p-8 shadow-sm">
                            <h3 className="font-serif text-lg text-[var(--color-navy-900)] mb-6">What Could Cost You at Claim Time</h3>
                            <div className="space-y-5">

                                {/* Claim Rejection Risk */}
                                <div className="group cursor-pointer" onClick={() => toggleBreakdown('CLAIM_REJECTION')}>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="font-medium">
                                            Claim Rejection Risk
                                            <span title="Measures exposure to rule-based claim denials — room rent limits, co-payments, sub-limits, and network restrictions." className="ml-1 text-slate-400 cursor-help">ⓘ</span>
                                        </span>
                                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1 transition-colors group-hover:text-[var(--color-navy-900)]">
                                            {Math.abs(data.audit_score.breakdown.claim_rejection_risk)} / 30 pts
                                            <ChevronDown className={cn("w-4 h-4 transition-transform text-slate-400 group-hover:text-[var(--color-navy-900)]", openBreakdown['CLAIM_REJECTION'] && "rotate-180")} />
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-400 rounded-full transition-all"
                                            style={{ width: `${(data.audit_score.breakdown.claim_rejection_risk / 30) * 100}%` }}
                                        />
                                    </div>
                                    <AnimatePresence>
                                        {openBreakdown['CLAIM_REJECTION'] && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-3 bg-slate-50 pl-4 pr-3 py-3 rounded">
                                                    {renderDeductionsList('CLAIM_REJECTION')}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* OOP Exposure */}
                                <div className="group cursor-pointer" onClick={() => toggleBreakdown('OOP_EXPOSURE')}>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="font-medium">
                                            Out-of-Pocket Exposure
                                            <span title="Measures personal expenses you bear even when a claim is approved — co-pays, consumable exclusions, and sub-limits." className="ml-1 text-slate-400 cursor-help">ⓘ</span>
                                        </span>
                                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1 transition-colors group-hover:text-[var(--color-navy-900)]">
                                            {Math.abs(data.audit_score.breakdown.oop_exposure)} / 30 pts
                                            <ChevronDown className={cn("w-4 h-4 transition-transform text-slate-400 group-hover:text-[var(--color-navy-900)]", openBreakdown['OOP_EXPOSURE'] && "rotate-180")} />
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-amber-400 rounded-full transition-all"
                                            style={{ width: `${(data.audit_score.breakdown.oop_exposure / 30) * 100}%` }}
                                        />
                                    </div>
                                    <AnimatePresence>
                                        {openBreakdown['OOP_EXPOSURE'] && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-3 bg-slate-50 pl-4 pr-3 py-3 rounded">
                                                    {renderDeductionsList('OOP_EXPOSURE')}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Coverage Quality Gap */}
                                <div className="group cursor-pointer" onClick={() => toggleBreakdown('COVERAGE_GAP')}>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="font-medium">
                                            Coverage Quality Gap
                                            <span title="Measures structural exclusions — waiting periods, missing restoration, AYUSH limits, and maternity gaps." className="ml-1 text-slate-400 cursor-help">ⓘ</span>
                                        </span>
                                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1 transition-colors group-hover:text-[var(--color-navy-900)]">
                                            {Math.abs(data.audit_score.breakdown.coverage_quality_gap)} / 20 pts
                                            <ChevronDown className={cn("w-4 h-4 transition-transform text-slate-400 group-hover:text-[var(--color-navy-900)]", openBreakdown['COVERAGE_GAP'] && "rotate-180")} />
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-400 rounded-full transition-all"
                                            style={{ width: `${(data.audit_score.breakdown.coverage_quality_gap / 20) * 100}%` }}
                                        />
                                    </div>
                                    <AnimatePresence>
                                        {openBreakdown['COVERAGE_GAP'] && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-3 bg-slate-50 pl-4 pr-3 py-3 rounded">
                                                    {renderDeductionsList('COVERAGE_GAP')}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Net Cover Penalty */}
                                <div className="group cursor-pointer" onClick={() => toggleBreakdown('NET_COVER')}>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="font-medium">
                                            Net Cover Penalty
                                            <span title="Applied when your effective cover is below the minimum recommended for your age and city. This penalty is uncapped and overrides all other scores." className="ml-1 text-slate-400 cursor-help">ⓘ</span>
                                        </span>
                                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1 transition-colors group-hover:text-[var(--color-navy-900)]">
                                            {Math.abs(data.audit_score.breakdown.net_cover_penalty)} pts
                                            <ChevronDown className={cn("w-4 h-4 transition-transform text-slate-400 group-hover:text-[var(--color-navy-900)]", openBreakdown['NET_COVER'] && "rotate-180")} />
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-slate-400 rounded-full transition-all"
                                            style={{ width: `${Math.min(Math.abs(data.audit_score.breakdown.net_cover_penalty) / 20 * 100, 100)}%` }}
                                        />
                                    </div>
                                    <AnimatePresence>
                                        {openBreakdown['NET_COVER'] && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-3 bg-slate-50 pl-4 pr-3 py-3 rounded">
                                                    {renderDeductionsList('NET_COVER')}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                            </div>
                        </div>
                    )}
                </div>

                {/* ── 3. BENEFIT EVALUATION (STRENGTHS & FAILURES) ── */}
                {data.benefit_evaluation && (
                    <section className="mb-16">
                        <div className="flex items-center gap-3 mb-6">
                            <Shield className="w-6 h-6 text-[var(--color-green-primary)]" />
                            <h3 className="font-serif text-2xl text-[var(--color-navy-900)]">Coverage Overview</h3>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 items-stretch">
                            {/* What works */}
                            <div className="border border-[var(--color-border-light)] bg-white p-8 rounded-xl shadow-sm flex flex-col h-full">
                                <div className="text-sm font-bold uppercase tracking-wider text-green-700 mb-6 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" /> What Actually Works
                                </div>
                                <ul className="space-y-6 flex-1">
                                    {data.benefit_evaluation.what_actually_works.length > 0 ? (
                                        data.benefit_evaluation.what_actually_works.map((item, i) => (
                                            <li key={i} className="text-sm border-l-2 border-green-300 pl-4">
                                                <span className="font-semibold block mb-1.5">{item.benefit}</span>
                                                <span className="text-[var(--color-text-secondary)] block leading-relaxed">{item.why_it_matters_in_claim}</span>
                                                {item.quantified_value && (
                                                    <span className="text-xs text-green-600 font-mono block mt-2.5">{item.quantified_value}</span>
                                                )}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-sm text-slate-500 italic border-l-2 border-slate-200 pl-4">None detected.</li>
                                    )}
                                </ul>
                            </div>

                            {/* Where it fails */}
                            <div className="border border-[var(--color-border-light)] bg-white p-8 rounded-xl shadow-sm flex flex-col h-full">
                                <div className="text-sm font-bold uppercase tracking-wider text-amber-700 mb-6 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" /> Where It May Cost You
                                </div>
                                <ul className="space-y-6 flex-1">
                                    {dynamicRiskItems.length > 0 ? (
                                        dynamicRiskItems.map((item, i) => (
                                            <li key={i} className="text-sm border-l-2 border-amber-300 pl-4">
                                                <span className="font-semibold block mb-1.5">{item.issue}</span>
                                                <span className="text-[var(--color-text-secondary)] block leading-relaxed">{item.real_world_claim_impact}</span>
                                                {item.quantified_oop_risk && (
                                                    <span className="text-xs text-red-500 font-mono block mt-2.5">{item.quantified_oop_risk}</span>
                                                )}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-sm text-slate-500 italic border-l-2 border-slate-200 pl-4">No significant cost risks identified for your profile.</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* Red Flags */}
                        {data.benefit_evaluation.structural_red_flags?.length > 0 && (
                            <div className="mt-6 border border-red-100 bg-red-50/30 p-6 rounded-lg">
                                <div className="text-sm font-bold uppercase tracking-wider text-red-700 mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Structural Red Flags
                                </div>
                                <ul className="space-y-3">
                                    {data.benefit_evaluation.structural_red_flags.map((flag, i) => (
                                        <li key={i} className="text-sm border-l-2 border-red-300 pl-3">
                                            <span className="font-medium block">{flag.flag}</span>
                                            <span className="text-[var(--color-text-secondary)]">{flag.why_it_is_dangerous}</span>
                                            <span className={cn(
                                                "text-xs font-bold uppercase mt-1 inline-block px-2 py-0.5 rounded",
                                                getRiskColor(flag.severity)
                                            )}>{flag.severity}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                )}

                {/* ── 4. CLAIM SIMULATIONS ── */}
                {simulations.length > 0 && (
                    <section className="mb-16">
                        <div className="flex items-center gap-3 mb-6">
                            <Activity className="w-6 h-6 text-[var(--color-teal-600)]" />
                            <h3 className="font-serif text-2xl text-[var(--color-navy-900)]">Claim Simulations</h3>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {simulations.map((sim, i) => (
                                <div key={i} className="bg-white border border-[var(--color-border-light)] rounded-lg p-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                            {sim.scenario}
                                        </div>
                                        <span className={cn(
                                            "text-xs font-bold uppercase px-2 py-0.5 rounded border",
                                            getSimulationVerdictColor(sim.verdict)
                                        )}>{sim.verdict}</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm">Total Bill</span>
                                            <span className="font-mono font-bold text-slate-600">{'₹' + sim.total_bill.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm">Insurer Pays</span>
                                            <span className="font-mono font-bold text-green-600">{'₹' + sim.insurer_pays.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm">Your Contribution</span>
                                            <span className="font-mono font-bold text-amber-600">{'₹' + (sim.total_bill - sim.insurer_pays).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="h-px bg-slate-200 my-2" />
                                        <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                                            <span>OOP Ratio (Out-of-Pocket)</span>
                                            <span className="font-mono">{(sim.oop_ratio * 100).toFixed(1)}%</span>
                                        </div>
                                        {sim.explanation && (
                                            <p className="text-xs text-slate-500 mt-2 leading-relaxed border-t border-slate-100 pt-2">
                                                {sim.explanation}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── 5. KEY FAILURE POINTS ── */}
                {data.final_verdict?.key_failure_points?.length > 0 && (
                    <section className={cn(
                        "border rounded-xl p-8 md:p-12 mb-16 shadow-lg relative overflow-hidden",
                        verdict === "SAFE" ? "bg-[#F0FDF4] border-green-100" : "bg-white border-slate-200"
                    )}>
                        <div className="absolute top-0 right-0 p-12 opacity-5">
                            {verdict === "SAFE"
                                ? <Shield className="w-64 h-64 text-green-600" />
                                : <Zap className="w-64 h-64 text-slate-900" />
                            }
                        </div>
                        <div className="relative z-10">
                            <h3 className="font-serif text-xl text-[var(--color-navy-900)] mb-6">Key Failure Points</h3>
                            <div className="space-y-2">
                                {data.final_verdict.key_failure_points.map((point, i) => (
                                    <div key={i} className="text-sm text-slate-700 flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                                        <span>{point}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* ── 6. EXTRACTED POLICY DETAILS ── */}
                <section className="mb-16">
                    <div className="flex items-center gap-3 mb-6">
                        <Activity className="w-6 h-6 text-[var(--color-teal-600)]" />
                        <h3 className="font-serif text-2xl text-[var(--color-navy-900)]">Extracted Policy Details</h3>
                    </div>

                    <div className="space-y-4">

                        {/* A. FINANCIAL LIMITS */}
                        <div className="bg-white border border-[var(--color-border-light)] rounded-lg overflow-hidden">
                            <div className="p-4 bg-[var(--color-cream-light)] border-b border-[var(--color-border-light)] flex justify-between items-center">
                                <span className="font-bold text-sm uppercase tracking-wider text-[var(--color-navy-900)]">Financial Limits & Caps</span>
                                <Shield className="w-4 h-4 text-[var(--color-text-muted)]" />
                            </div>
                            <div className="p-6 grid md:grid-cols-2 gap-8">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium">Room Rent Limit</span>
                                        <span className={cn(
                                            "text-xs font-bold uppercase",
                                            data.claim_risk_analysis?.room_rent?.risk_level === "low" ? "text-green-600" : "text-red-600"
                                        )}>
                                            {data.claim_risk_analysis?.room_rent?.limit_value || "No Limit"}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                        {data.claim_risk_analysis?.room_rent?.limit_type === "none"
                                            ? "No room rent cap detected."
                                            : `Limit type: ${data.claim_risk_analysis?.room_rent?.limit_type ?? "unknown"}`}
                                    </p>
                                    {data.claim_risk_analysis?.room_rent?.explanation && (
                                        <p className="text-xs text-slate-400 mt-1 italic">
                                            {data.claim_risk_analysis.room_rent.explanation}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium">Co-Payment</span>
                                        <span className={cn(
                                            "text-xs font-bold uppercase",
                                            data.claim_risk_analysis?.co_payment?.risk_level === "low" ? "text-green-600" : "text-red-600"
                                        )}>
                                            {data.claim_risk_analysis?.co_payment?.exists
                                                ? `${data.claim_risk_analysis.co_payment.percentage ?? 0}%`
                                                : "0%"}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                        {data.claim_risk_analysis?.co_payment?.exists
                                            ? `Applies to: ${data.claim_risk_analysis?.co_payment?.applies_to ?? "unknown"}`
                                            : "No co-payment applicable."}
                                    </p>
                                    {data.claim_risk_analysis?.co_payment?.oop_on_5L_claim != null && (
                                        <p className="text-xs text-red-500 font-mono mt-1">
                                            OOP on ₹5L claim: {formatINR(data.claim_risk_analysis.co_payment.oop_on_5L_claim)}
                                        </p>
                                    )}
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
                                {[
                                    { label: "OPD Cover", covered: data.supplementary_coverage?.opd?.covered },
                                    { label: "Modern Treatments", covered: data.supplementary_coverage?.modern_treatments?.covered },
                                    { label: "Consumables", covered: data.supplementary_coverage?.consumables?.coverage_type === "full" },
                                    { label: "Ambulance", covered: data.supplementary_coverage?.ambulance?.covered },
                                    { label: "Day Care", covered: data.supplementary_coverage?.day_care_procedures?.covered },
                                    { label: "Maternity", covered: data.supplementary_coverage?.maternity?.covered },
                                ].map((item, i) => (
                                    <div key={i} className="p-3 bg-slate-50 rounded text-center">
                                        <div className="text-xs uppercase text-[var(--color-text-muted)] mb-1">{item.label}</div>
                                        <div className={cn("font-bold", item.covered ? "text-green-600" : "text-slate-400")}>
                                            {item.covered ? "Covered" : "Not Covered"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* C. WAITING PERIODS */}
                        <div className="bg-white border border-blue-100 rounded-lg overflow-hidden">
                            <div className="p-4 bg-blue-50/50 border-b border-blue-100 flex justify-between items-center">
                                <span className="font-bold text-sm uppercase tracking-wider text-[var(--color-navy-900)]">Waiting Periods</span>
                                <Clock className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="p-6">
                                <ul className="space-y-3">

                                    {/* Initial waiting */}
                                    {(() => {
                                        const wp = data.waiting_period_analysis?.initial_waiting_period;
                                        if (!wp) return null;
                                        const computedEndDate = computeUnlockDate(data.policy_timeline?.policy_inception_date, wp.duration_days);
                                        const isActiveToday = computedEndDate ? new Date() < new Date(computedEndDate) : wp.is_active_today;
                                        const { status, label } = getWaitingPeriodStatus(isActiveToday, null, computedEndDate);
                                        return (
                                            <li className="flex justify-between items-center text-sm border-b border-blue-100 pb-2">
                                                <div>
                                                    <span className="block font-medium">Initial Waiting Period</span>
                                                    <span className="text-xs text-[var(--color-text-secondary)]">{wp.duration_days} days</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-2 py-1 rounded",
                                                        status === "active" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                                    )}>{label}</span>
                                                    {status !== "active" && <span title="This waiting period is complete. You are fully covered for this condition." className="ml-1 text-slate-400 cursor-help">ⓘ</span>}
                                                </div>
                                            </li>
                                        );
                                    })()}

                                    {/* PED waiting */}
                                    {(() => {
                                        const wp = data.waiting_period_analysis?.pre_existing_disease;
                                        if (!wp) return null;
                                        const computedEndDate = computeUnlockDate(data.policy_timeline?.policy_inception_date, wp.duration_months * 30);
                                        const isActiveToday = computedEndDate ? new Date() < new Date(computedEndDate) : wp.is_active_today;
                                        const { status, label } = getWaitingPeriodStatus(isActiveToday, wp.months_remaining, computedEndDate);
                                        return (
                                            <li className="flex justify-between items-center text-sm border-b border-blue-100 pb-2">
                                                <div>
                                                    <span className="block font-medium">Pre-Existing Diseases</span>
                                                    <span className="text-xs text-[var(--color-text-secondary)]">{wp.duration_months} months</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-2 py-1 rounded",
                                                        status === "active" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                                    )}>{label}</span>
                                                    {status !== "active" && <span title="This waiting period is complete. You are fully covered for this condition." className="ml-1 text-slate-400 cursor-help">ⓘ</span>}
                                                </div>
                                            </li>
                                        );
                                    })()}

                                    {/* Specific diseases */}
                                    {(() => {
                                        const wp = data.waiting_period_analysis?.specific_diseases;
                                        if (!wp) return null;
                                        const computedEndDate = computeUnlockDate(data.policy_timeline?.policy_inception_date, wp.duration_months * 30);
                                        const isActiveToday = computedEndDate ? new Date() < new Date(computedEndDate) : wp.is_active_today;
                                        const { status, label } = getWaitingPeriodStatus(isActiveToday, null, computedEndDate);
                                        return (
                                            <li className="flex justify-between items-center text-sm border-b border-blue-100 pb-2">
                                                <div>
                                                    <span className="block font-medium">Specific Diseases</span>
                                                    <span className="text-xs text-[var(--color-text-secondary)]">
                                                        {wp.duration_months} months
                                                        {wp.diseases_covered?.length > 0 && ` — ${wp.diseases_covered.slice(0, 3).join(", ")}${wp.diseases_covered.length > 3 ? "…" : ""}`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-2 py-1 rounded",
                                                        status === "active" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                                    )}>{label}</span>
                                                    {status !== "active" && <span title="This waiting period is complete. You are fully covered for this condition." className="ml-1 text-slate-400 cursor-help">ⓘ</span>}
                                                </div>
                                            </li>
                                        );
                                    })()}

                                    {/* Personal waiting periods */}
                                    {data.waiting_period_analysis?.personal_waiting_periods?.map((wp, i) => {
                                        const computedEndDate = computeUnlockDate(data.policy_timeline?.policy_inception_date, wp.duration_months * 30);
                                        const isActiveToday = computedEndDate ? new Date() < new Date(computedEndDate) : wp.is_active_today;
                                        const { status, label } = getWaitingPeriodStatus(isActiveToday, wp.months_remaining, computedEndDate);
                                        return (
                                            <li key={i} className="flex justify-between items-center text-sm border-b border-blue-100 pb-2">
                                                <div>
                                                    <span className="block font-medium">{wp.condition}</span>
                                                    <span className="text-xs text-[var(--color-text-secondary)]">{wp.duration_months} months</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-2 py-1 rounded",
                                                        status === "active" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                                    )}>{label}</span>
                                                    {status !== "active" && <span title="This waiting period is complete. You are fully covered for this condition." className="ml-1 text-slate-400 cursor-help">ⓘ</span>}
                                                </div>
                                            </li>
                                        );
                                    })}

                                    {/* Maternity (only if relevant) */}
                                    {data.waiting_period_analysis?.maternity?.relevant && (() => {
                                        const wp = data.waiting_period_analysis.maternity;
                                        const computedEndDate = computeUnlockDate(data.policy_timeline?.policy_inception_date, (wp.duration_months ?? 0) * 30);
                                        const isActiveToday = computedEndDate ? new Date() < new Date(computedEndDate) : (wp.is_active_today ?? false);
                                        const { status, label } = getWaitingPeriodStatus(isActiveToday, wp.months_remaining, computedEndDate);
                                        return (
                                            <li className="flex justify-between items-center text-sm pb-2">
                                                <div>
                                                    <span className="block font-medium">Maternity</span>
                                                    <span className="text-xs text-[var(--color-text-secondary)]">{wp.duration_months} months</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-2 py-1 rounded",
                                                        status === "active" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                                    )}>{label}</span>
                                                    {status !== "active" && <span title="This waiting period is complete. You are fully covered for this condition." className="ml-1 text-slate-400 cursor-help">ⓘ</span>}
                                                </div>
                                            </li>
                                        );
                                    })()}
                                </ul>
                            </div>
                        </div>

                        {/* D. NETWORK — live data from filter_engine */}
                        <div className="bg-white border border-[var(--color-border-light)] rounded-lg overflow-hidden">
                            <div className="p-4 bg-[var(--color-cream-light)] border-b border-[var(--color-border-light)] flex justify-between items-center">
                                <span className="font-bold text-sm uppercase tracking-wider text-[var(--color-navy-900)]">Network & Access</span>
                                <Hospital className="w-4 h-4 text-[var(--color-text-muted)]" />
                            </div>
                            <div className="p-6">
                                <div className="grid md:grid-cols-2 gap-6 mb-4">
                                    {/* Total hospitals in city */}
                                    <div>
                                        <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                                            Cashless Hospitals in {data.identity?.city || "Your City"}
                                        </div>
                                        <div className="text-2xl font-bold text-[var(--color-navy-900)]">
                                            {hospitalCount !== null
                                                ? hospitalCount.toLocaleString("en-IN")
                                                : (data.network_limitations?.hospital_count_in_zone ?? "—")}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">unique empanelled hospitals</div>
                                    </div>

                                    {/* Insurer-specific count — only shown if matched */}
                                    {insurerHospitalCount !== null && (
                                        <div>
                                            <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                                                Your Insurer's Network
                                            </div>
                                            <div className="text-2xl font-bold text-[var(--color-green-primary)]">
                                                {insurerHospitalCount.toLocaleString("en-IN")}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-0.5">hospitals accepting your policy</div>
                                        </div>
                                    )}
                                </div>

                                {/* Major hospital chains */}
                                {data.network_limitations?.major_hospitals_included?.length > 0 && (
                                    <div className="mb-4">
                                        <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                                            Major Chains Included
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            {data.network_limitations.major_hospitals_included.map((h, i) => (
                                                <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">{h}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Badges */}
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={cn(
                                        "text-xs font-bold px-2 py-1 rounded border",
                                        data.network_limitations?.reimbursement_allowed
                                            ? "bg-green-50 text-green-700 border-green-200"
                                            : "bg-slate-50 text-slate-500 border-slate-200"
                                    )}>
                                        {data.network_limitations?.reimbursement_allowed
                                            ? "✓ Reimbursement Available"
                                            : "Cashless Only"}
                                    </span>
                                    {data.network_limitations?.claim_settlement_ratio != null && (
                                        <span className="text-xs text-slate-500 font-mono">
                                            CSR: {data.network_limitations.claim_settlement_ratio}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* ── 7. RECOMMENDATIONS ── */}
                {data.recommendations && (
                    <section className="mb-16">
                        <div className="flex items-center gap-3 mb-6">
                            <Zap className="w-6 h-6 text-amber-500" />
                            <h3 className="font-serif text-2xl text-[var(--color-navy-900)]">Recommendations</h3>
                        </div>

                        {/* Critical Actions */}
                        {data.recommendations.critical_actions?.length > 0 && (
                            <div className="border border-red-100 bg-red-50/30 p-6 rounded-lg mb-6">
                                <div className="text-sm font-bold uppercase tracking-wider text-red-700 mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Critical Actions
                                </div>
                                <ul className="space-y-4">
                                    {data.recommendations.critical_actions.map((action, i) => (
                                        <li key={i} className="border-l-2 border-red-300 pl-3">
                                            <span className="font-medium block text-sm">{action.action}</span>
                                            <span className="text-xs text-slate-600">{action.reason}</span>
                                            {action.oop_risk_if_ignored && (
                                                <span className="text-xs text-red-500 font-mono block mt-0.5">
                                                    Risk if ignored: {action.oop_risk_if_ignored}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Porting Recommendation */}
                        {portingRec && (
                            <div className={cn(
                                "border p-6 rounded-lg mb-6",
                                portingRec.recommendation === "yes" ? "bg-red-50 border-red-200" :
                                    portingRec.recommendation === "consider" ? "bg-amber-50 border-amber-200" :
                                        "bg-green-50 border-green-200"
                            )}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="text-sm font-bold uppercase tracking-wider text-[var(--color-navy-900)]">
                                        Port to Better Policy?
                                    </div>
                                    <span className={cn(
                                        "text-xs font-bold px-2 py-0.5 rounded-full",
                                        portingRec.recommendation === "yes" ? "bg-red-100 text-red-700" :
                                            portingRec.recommendation === "consider" ? "bg-amber-100 text-amber-700" :
                                                "bg-green-100 text-green-700"
                                    )}>
                                        {portingRec.recommendation === "yes" ? "⚠ ACTION REQUIRED" :
                                            portingRec.recommendation === "consider" ? "→ CONSIDER" :
                                                "✓ NO ACTION NEEDED"}
                                    </span>
                                </div>
                                <p className="text-sm">{portingRec.reason}</p>
                                {portingRec.what_to_look_for?.length > 0 && (
                                    <ul className="mt-3 space-y-1">
                                        {portingRec.what_to_look_for.map((item, i) => (
                                            <li key={i} className="text-xs flex items-start gap-2">
                                                <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {portingRec.recommendation === "consider" && (
                                    <>
                                        <div className="h-px bg-amber-200/50 my-4" />
                                        <Button
                                            variant="outline"
                                            className="w-full border-amber-400 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                            onClick={() => window.location.href = '/contact'}
                                        >
                                            Talk to an IndSure Advisor about this →
                                        </Button>
                                    </>
                                )}
                                {portingRec.recommendation === "yes" && (
                                    <>
                                        <div className="h-px bg-red-200/50 my-4" />
                                        <Button
                                            className="w-full bg-red-600 text-white hover:bg-red-700"
                                            onClick={() => window.location.href = '/contact'}
                                        >
                                            Find a Better Policy Now →
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Medium + Low Priority */}
                        {(data.recommendations.medium_priority?.length > 0 || data.recommendations.low_priority?.length > 0) && (
                            <div className="bg-white border border-[var(--color-border-light)] p-6 rounded-lg">
                                <div className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
                                    <Info className="w-4 h-4" /> Other Recommendations
                                </div>
                                <ul className="space-y-3">
                                    {[...data.recommendations.medium_priority ?? [], ...data.recommendations.low_priority ?? []].map((item, i) => (
                                        <li key={i} className="text-sm border-l-2 border-slate-300 pl-3">
                                            <span className="font-medium block">{item.action}</span>
                                            <span className="text-xs text-slate-500">{item.reason}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                )}

                {/* ── 8. SCORE DEDUCTIONS (COLLAPSIBLE) ── */}
                {data.audit_score?.deductions?.length > 0 && (
                    <section className="mb-16">
                        <button
                            onClick={() => setShowDeductions(!showDeductions)}
                            className="flex items-center gap-3 mb-4 w-full text-left group"
                        >
                            <FileText className="w-5 h-5 text-slate-400" />
                            <span className="font-serif text-lg text-slate-500 group-hover:text-[var(--color-navy-900)] transition-colors">
                                Score Deductions ({data.audit_score.deductions.length} rules triggered)
                            </span>
                            {showDeductions ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>

                        <AnimatePresence>
                            {showDeductions && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-white border border-[var(--color-border-light)] rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                                                    <th className="px-4 py-3">Category</th>
                                                    <th className="px-4 py-3">Severity</th>
                                                    <th className="px-4 py-3">Points</th>
                                                    <th className="px-4 py-3">Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.audit_score.deductions.map((entry, i) => (
                                                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                                                        <td className="px-4 py-3">
                                                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{entry.category}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={cn("text-xs font-bold uppercase px-2 py-0.5 rounded border", getRiskColor(entry.severity))}>
                                                                {entry.severity}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 font-mono font-bold text-red-600">{entry.points}</td>
                                                        <td className="px-4 py-3 text-slate-600 text-xs leading-relaxed">{entry.reason}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </section>
                )}

            </main>

            <div className="text-center pb-20 pt-8 border-t border-[var(--color-border-light)] max-w-2xl mx-auto">
                <p className="font-serif text-lg text-slate-400 italic mb-2">
                    "The policy is fixed. Your awareness of it isn't."
                </p>
                <p className="text-xs text-slate-300 uppercase tracking-widest font-bold">
                    All scoring is prompt-computed. No post-processing overrides.
                </p>
            </div>

            <Footer />
        </div>
    );
}
