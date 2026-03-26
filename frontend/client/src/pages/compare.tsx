import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload, CheckCircle2, MapPin, Plus, Loader2, AlertCircle, X, FileText, ChevronDown,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Header } from "@/components/Header";
import { getAllStates, getCitiesForState } from "@/lib/data/indian-cities-data";
import { getCityTier, getTierDescription, type CityTier } from "@/lib/city-tier-util";
import { Footer } from "@/components/Footer";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
// ARCHIVED: import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PolicyReport {
  policy_id: string;
  extracted_data: {
    policy_metadata?: { insurer_normalized?: string; plan_name_normalized?: string };
    coverage_structure?: {
      base_sum_insured?: number;
      total_effective_coverage?: number;
      restoration?: { exists?: boolean; type?: string | null };
    };
    claim_risk_analysis?: {
      room_rent?: { limit_type?: string; limit_value?: string | null; risk_level?: string };
      co_payment?: { exists?: boolean; percentage?: number | null; risk_level?: string };
      sub_limits?: { exists?: boolean; risk_level?: string; remarks?: string | null };
      deductibles?: { base_deductible?: number };
    };
    waiting_period_analysis?: {
      pre_existing_disease?: { duration_months?: number };
      initial_waiting_period?: { duration_days?: number };
      policy_fully_active?: boolean;
    };
    audit_ledger?: { final_score?: number };
    final_verdict?: { label?: string; summary?: string; key_failure_points?: string[] };
    benefit_evaluation?: {
      no_claim_bonus?: { exists?: boolean; percentage?: number | null; remarks?: string | null };
    };
  };
  extraction_metadata?: {
    confidence?: number;
    missing_fields?: string[];
    needs_verification?: boolean;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null, suffix = ""): string {
  if (n == null) return "—";
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L${suffix}`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K${suffix}`;
  return `₹${n}${suffix}`;
}

function roomRentLabel(rr: any): { value: string; sub: string; status: "good" | "bad" | "neutral" } {
  if (!rr) return { value: "—", sub: "Unknown", status: "neutral" };
  if (rr.limit_type === "none") return { value: "No Cap", sub: "Any room type", status: "good" };
  if (rr.limit_type === "room_category") return { value: rr.limit_value || "Capped", sub: "Room category limit", status: "bad" };
  if (rr.limit_type === "specific_amount") return { value: rr.limit_value || "Capped", sub: "Per day limit", status: "bad" };
  if (rr.limit_type === "percentage_of_si") return { value: rr.limit_value || "% of SI", sub: "% of sum insured", status: "neutral" };
  return { value: rr.limit_value || "—", sub: rr.limit_type || "Unknown", status: "neutral" };
}

function coPayLabel(cp: any): { value: string; sub: string; status: "good" | "bad" | "neutral" } {
  if (!cp) return { value: "—", sub: "Unknown", status: "neutral" };
  if (!cp.exists || cp.percentage === 0) return { value: "None", sub: "Full claim paid", status: "good" };
  return { value: `${cp.percentage}%`, sub: "You pay this share", status: "bad" };
}

function waitLabel(wp: any): { value: string; sub: string; status: "good" | "bad" | "neutral" } {
  const months = wp?.pre_existing_disease?.duration_months;
  if (months == null) return { value: "—", sub: "Unknown", status: "neutral" };
  const status: "good" | "bad" | "neutral" = months <= 12 ? "good" : months <= 24 ? "neutral" : "bad";
  return { value: `${months} months`, sub: months <= 12 ? "Excellent" : months <= 24 ? "Average" : "Long wait", status };
}

function ncbLabel(be: any): { value: string; sub: string; status: "good" | "bad" | "neutral" } {
  const ncb = be?.no_claim_bonus;
  if (!ncb?.exists) return { value: "None", sub: "No NCB benefit", status: "bad" };
  const pct = ncb.percentage ? `${ncb.percentage}%` : "Yes";
  return { value: pct, sub: ncb.remarks || "Per year", status: "good" };
}

function buildRows(policies: PolicyReport[]) {
  const d = (p: PolicyReport) => p.extracted_data;
  return [
    {
      feature: "Audit Score",
      values: policies.map(p => {
        const score = d(p).audit_ledger?.final_score;
        const status: "good" | "bad" | "neutral" = score == null ? "neutral" : score >= 75 ? "good" : score >= 50 ? "neutral" : "bad";
        return { value: score != null ? `${score}/100` : "—", sub: "Sach AI score", status };
      }),
    },
    {
      feature: "Sum Insured",
      values: policies.map(p => {
        const si = d(p).coverage_structure?.base_sum_insured;
        const total = d(p).coverage_structure?.total_effective_coverage;
        return { value: fmt(si), sub: total && total !== si ? `Total: ${fmt(total)}` : "Base cover", status: "neutral" as const };
      }),
    },
    {
      feature: "Room Rent",
      values: policies.map(p => roomRentLabel(d(p).claim_risk_analysis?.room_rent)),
    },
    {
      feature: "Co-Payment",
      values: policies.map(p => coPayLabel(d(p).claim_risk_analysis?.co_payment)),
    },
    {
      feature: "Pre-Existing Wait",
      values: policies.map(p => waitLabel(d(p).waiting_period_analysis)),
    },
    {
      feature: "No-Claim Bonus",
      values: policies.map(p => ncbLabel(d(p).benefit_evaluation)),
    },
    {
      feature: "Sub-Limits",
      values: policies.map(p => {
        const sl = d(p).claim_risk_analysis?.sub_limits;
        if (!sl) return { value: "—", sub: "Unknown", status: "neutral" as const };
        if (!sl.exists) return { value: "None", sub: "No sub-limits", status: "good" as const };
        const status: "good" | "bad" | "neutral" = sl.risk_level === "high" || sl.risk_level === "critical" ? "bad" : "neutral";
        return { value: sl.risk_level?.toUpperCase() || "Exists", sub: sl.remarks || "Sub-limits apply", status };
      }),
    },
    {
      feature: "Verdict",
      values: policies.map(p => {
        const v = d(p).final_verdict;
        const label = v?.label || "—";
        const status: "good" | "bad" | "neutral" = label === "SAFE" ? "good" : label === "RISKY" ? "bad" : "neutral";
        return { value: label, sub: v?.summary?.slice(0, 60) + (v?.summary && v.summary.length > 60 ? "…" : "") || "—", status };
      }),
    },
  ];
}

// ─── SearchableSelect ─────────────────────────────────────────────────────────

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  disabled = false,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = (item: string) => {
    onChange(item);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger / search input */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen(!open);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        className="flex items-center justify-between w-full h-11 px-4 rounded-lg border border-[var(--color-border-medium)] bg-[var(--color-cream-main)] text-sm text-left hover:border-[var(--color-teal-600)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={value ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]"}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[200] bg-white border border-[var(--color-border-light)] rounded-lg shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-[var(--color-border-light)]">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="w-full h-9 px-3 text-sm rounded-md border border-[var(--color-border-light)] bg-[var(--color-cream-main)] outline-none focus:border-[var(--color-teal-600)] transition-colors placeholder:text-[var(--color-text-muted)]"
            />
          </div>
          {/* Options list */}
          <div className="max-h-[240px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">
                No results found.
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer hover:bg-[var(--color-cream-main)] ${item === value
                    ? "text-[var(--color-teal-600)] font-semibold bg-[var(--color-teal-600)]/5"
                    : "text-[var(--color-text-main)]"
                    }`}
                >
                  {item}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Cell({ data }: { data: { value: string; sub: string; status: string } }) {
  const color =
    data.status === "good" ? "text-[var(--color-teal-600)] font-semibold" :
      data.status === "bad" ? "text-red-500 font-semibold" :
        "text-[var(--color-text-main)]";
  return (
    <td className="p-5 border-l border-[var(--color-border-light)] align-top">
      <div className={`text-base mb-1 ${color}`}>{data.value}</div>
      <div className="text-xs text-[var(--color-text-muted)] leading-snug">{data.sub}</div>
    </td>
  );
}

function PolicySlot({
  index, file, onRemove,
}: { index: number; file: File | null; onRemove: () => void }) {
  return (
    <div className={`relative flex items-center gap-3 rounded-xl border p-4 transition-all ${file
      ? "border-[var(--color-teal-600)] bg-[var(--color-teal-600)]/5"
      : "border-dashed border-[var(--color-border-medium)] bg-[var(--color-cream-main)]"
      }`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${file ? "bg-[var(--color-teal-600)] text-white" : "bg-white border border-[var(--color-border-medium)] text-[var(--color-text-muted)]"
        }`}>
        {file ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
      </div>
      <div className="flex-grow min-w-0">
        {file ? (
          <>
            <p className="text-sm font-medium text-[var(--color-navy-900)] truncate">{file.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{(file.size / 1024).toFixed(0)} KB</p>
          </>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Policy {index + 1} — drop or click to add</p>
        )}
      </div>
      {file && (
        <button onClick={onRemove} className="w-6 h-6 rounded-full bg-white border border-[var(--color-border-medium)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-500 hover:border-red-300 transition-colors flex-shrink-0">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const user: any = null; // ARCHIVED: const { user } = useAuth();
  const [, navigate] = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [cityTier, setCityTier] = useState<CityTier | null>(null);

  // Up to 3 policy slots
  const [slots, setSlots] = useState<(File | null)[]>([null, null, null]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Results
  const [policies, setPolicies] = useState<PolicyReport[] | null>(null);

  const allStates = useMemo(() => getAllStates(), []);
  const cities = useMemo(() => (selectedState ? getCitiesForState(selectedState) : []), [selectedState]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSlots(prev => {
      const next = [...prev];
      for (const f of acceptedFiles) {
        const emptyIdx = next.findIndex(s => s === null);
        if (emptyIdx === -1) break;
        next[emptyIdx] = f;
      }
      return next;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 3,
    disabled: isExtracting,
    noClick: true,
  } as any);

  const handleSlotClick = (idx: number) => {
    if (slots[idx]) return; // already filled
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = (e: any) => {
      const file: File = e.target.files?.[0];
      if (!file) return;
      setSlots(prev => {
        const next = [...prev];
        next[idx] = file;
        return next;
      });
    };
    input.click();
  };

  const removeSlot = (idx: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  };

  const handleStateChange = (val: string) => {
    setSelectedState(val);
    setSelectedCity("");
    setCityTier(null);
  };

  const handleCityChange = (val: string) => {
    setSelectedCity(val);
    setCityTier(getCityTier(val));
  };

  const filledSlots = slots.filter(Boolean) as File[];
  const canCompare = filledSlots.length >= 2;

  const handleCompare = async () => {
    if (!canCompare) return;

    // Auth gate — show modal if not logged in
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setPolicies(null);

    try {
      const results = await Promise.all(
        filledSlots.map(async (file) => {
          const formData = new FormData();
          formData.append("policy_pdf", file);
          const res = await apiFetch("/api/extract-policy", { method: "POST", body: formData, credentials: "include" });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(err.error || `Failed to extract "${file.name}"`);
          }
          return res.json() as Promise<PolicyReport>;
        })
      );
      setPolicies(results);
    } catch (err: any) {
      setExtractionError(err.message || "Extraction failed. Please try again.");
      toast.error("Policy extraction failed.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleReset = () => {
    setPolicies(null);
    setSlots([null, null, null]);
    setExtractionError(null);
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-32 pb-20 px-6 w-full">
        <AnimatePresence mode="wait">

          {/* ── INPUT VIEW ── */}
          {!policies && (
            <motion.div key="input" initial="hidden" animate="visible" exit={{ opacity: 0, y: -20 }} variants={fadeInUp}>

              {/* Hero */}
              <div className="text-center mb-16">
                <span className="inline-block py-1 px-3 border border-[var(--color-teal-400)] rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-teal-600)] mb-6 bg-white">
                  Policy Comparison
                </span>
                <h1 className="text-5xl md:text-6xl font-serif mb-6 tracking-tight text-[var(--color-navy-900)]">
                  Compare Your Policies
                </h1>
                <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto font-light leading-relaxed">
                  Upload up to 3 policy PDFs. We'll extract every clause and give you a side-by-side audit — no fluff, no bias.
                </p>
              </div>

              <div className="max-w-2xl mx-auto space-y-8">

                {/* Context */}
                <div className="card-white p-8 shadow-lg border-t-4 border-[var(--color-teal-600)] relative z-20">
                  <h2 className="font-serif text-xl text-[var(--color-navy-900)] mb-5 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[var(--color-teal-600)]" />
                    Your Location <span className="text-sm font-sans font-normal text-[var(--color-text-muted)] ml-1">(optional — improves analysis)</span>
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* State */}
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-widest text-[var(--color-navy-900)] font-semibold">State</label>
                      <SearchableSelect
                        options={allStates}
                        value={selectedState}
                        onChange={handleStateChange}
                        placeholder="Search state…"
                      />
                    </div>

                    {/* City */}
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-widest text-[var(--color-navy-900)] font-semibold">City</label>
                      <SearchableSelect
                        options={cities}
                        value={selectedCity}
                        onChange={handleCityChange}
                        placeholder={selectedState ? "Search city…" : "—"}
                        disabled={!selectedState}
                      />
                    </div>
                  </div>
                  {cityTier && (
                    <p className="mt-3 text-sm text-[var(--color-teal-600)] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Calibrated for <strong>{getTierDescription(cityTier)}</strong>
                    </p>
                  )}
                </div>

                {/* Upload */}
                <div
                  {...getRootProps()}
                  className={`card-white p-8 shadow-lg border-2 transition-all relative z-10 ${isDragActive
                    ? "border-[var(--color-teal-600)] bg-[var(--color-teal-600)]/5"
                    : "border-[var(--color-border-light)]"
                    }`}
                >
                  <input {...getInputProps()} />
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-serif text-xl text-[var(--color-navy-900)] flex items-center gap-2">
                      <Upload className="w-5 h-5 text-[var(--color-gold-500)]" />
                      Upload Policies
                    </h2>
                    <span className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-widest">
                      {filledSlots.length}/3 added
                    </span>
                  </div>

                  {isDragActive && (
                    <div className="text-center py-6 text-[var(--color-teal-600)] font-medium">
                      Drop your PDFs here…
                    </div>
                  )}

                  <div className="space-y-3">
                    {slots.map((file, i) => (
                      <div key={i} onClick={() => handleSlotClick(i)} className={!file ? "cursor-pointer" : ""}>
                        <PolicySlot index={i} file={file} onRemove={() => removeSlot(i)} />
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-xs text-center text-[var(--color-text-muted)]">
                    Drag & drop PDFs anywhere on this card, or click an empty slot to browse
                  </p>
                </div>

                {/* Error */}
                {extractionError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{extractionError}</span>
                  </div>
                )}

                {/* CTA */}
                <Button
                  onClick={handleCompare}
                  disabled={!canCompare || isExtracting}
                  className="w-full h-14 text-base font-semibold bg-[var(--color-navy-900)] hover:bg-[var(--color-navy-800)] text-white rounded-xl disabled:opacity-40"
                >
                  {isExtracting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Extracting {filledSlots.length} {filledSlots.length === 1 ? "policy" : "policies"}…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Compare {filledSlots.length >= 2 ? filledSlots.length : ""} Policies
                    </span>
                  )}
                </Button>

                {!canCompare && (
                  <div className="mt-12">
                    <p className="text-center text-sm font-medium text-[var(--color-text-muted)] mb-8 uppercase tracking-widest">
                      Why compare with IndSure?
                    </p>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="text-center space-y-2 p-4">
                        <div className="w-10 h-10 mx-auto bg-[var(--color-teal-50)] text-[var(--color-teal-600)] rounded-full flex items-center justify-center mb-3">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <h4 className="font-serif text-lg text-[var(--color-navy-900)]">Spot Hidden Limits</h4>
                        <p className="text-sm text-[var(--color-text-secondary)]">We fetch the actual policy wordings to expose room rent caps and sub-limits that marketing covers up.</p>
                      </div>
                      <div className="text-center space-y-2 p-4 border-t md:border-t-0 md:border-l border-[var(--color-border-light)]">
                        <div className="w-10 h-10 mx-auto bg-[var(--color-teal-50)] text-[var(--color-teal-600)] rounded-full flex items-center justify-center mb-3">
                          <FileText className="w-5 h-5" />
                        </div>
                        <h4 className="font-serif text-lg text-[var(--color-navy-900)]">Mathematical Grading</h4>
                        <p className="text-sm text-[var(--color-text-secondary)]">Our deterministic engine scores policies on a 100-point scale based on financial risk and coverage reality.</p>
                      </div>
                      <div className="text-center space-y-2 p-4 border-t md:border-t-0 md:border-l border-[var(--color-border-light)]">
                        <div className="w-10 h-10 mx-auto bg-[var(--color-teal-50)] text-[var(--color-teal-600)] rounded-full flex items-center justify-center mb-3">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <h4 className="font-serif text-lg text-[var(--color-navy-900)]">City-Tier Adjusted</h4>
                        <p className="text-sm text-[var(--color-text-secondary)]">We simulate actual historical claim data from your city to ensure the sum insured isn't an illusion.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── MATRIX VIEW ── */}
          {policies && (
            <motion.div key="matrix" initial="hidden" animate="visible" variants={fadeInUp}>
              <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex justify-between items-end mb-8 border-b border-[var(--color-border-light)] pb-6">
                  <div>
                    <span className="inline-block py-1 px-3 border border-[var(--color-teal-400)] rounded-full text-[10px] font-mono uppercase tracking-widest text-[var(--color-teal-600)] mb-4 bg-white">
                      Analysis Complete
                    </span>
                    <h2 className="text-4xl font-serif text-[var(--color-navy-900)]">Head-to-Head</h2>
                    <p className="text-[var(--color-text-secondary)] mt-1">{policies.length} policies compared</p>
                  </div>
                  <Button variant="ghost" onClick={handleReset} className="text-[var(--color-text-secondary)] hover:text-[var(--color-teal-600)]">
                    ← Compare Again
                  </Button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-[var(--color-border-light)] rounded-xl bg-white shadow-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-border-light)]">
                        <th className="p-5 bg-[var(--color-cream-dark)] sticky left-0 z-10 w-40"></th>
                        {policies.map((p, i) => {
                          const name = p.extracted_data?.policy_metadata?.plan_name_normalized
                            || p.extracted_data?.policy_metadata?.insurer_normalized
                            || `Policy ${i + 1}`;
                          const insurer = p.extracted_data?.policy_metadata?.insurer_normalized;
                          return (
                            <th key={i} className="p-5 font-serif text-lg text-[var(--color-navy-900)] bg-[var(--color-cream-dark)] border-l border-[var(--color-border-light)] align-bottom pb-6">
                              <div>{name}</div>
                              {insurer && name !== insurer && (
                                <div className="text-xs font-sans font-normal text-[var(--color-text-muted)] mt-1">{insurer}</div>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-light)]">
                      {buildRows(policies).map((row, i) => (
                        <tr key={i} className="group hover:bg-[var(--color-cream-main)] transition-colors">
                          <td className="p-5 font-mono text-xs uppercase tracking-widest text-[var(--color-text-secondary)] bg-[var(--color-cream-dark)]/30 sticky left-0 border-r border-[var(--color-border-light)] group-hover:bg-[var(--color-cream-dark)]">
                            {row.feature}
                          </td>
                          {row.values.map((v, j) => <Cell key={j} data={v} />)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Verdict cards */}
                <div className="mt-10 grid gap-4" style={{ gridTemplateColumns: `repeat(${policies.length}, 1fr)` }}>
                  {policies.map((p, i) => {
                    const v = p.extracted_data?.final_verdict;
                    const name = p.extracted_data?.policy_metadata?.plan_name_normalized || `Policy ${i + 1}`;
                    const label = v?.label || "—";
                    const borderColor = label === "SAFE" ? "border-[var(--color-teal-600)]" : label === "RISKY" ? "border-red-400" : "border-[var(--color-gold-500)]";
                    const labelColor = label === "SAFE" ? "text-[var(--color-teal-600)]" : label === "RISKY" ? "text-red-500" : "text-[var(--color-gold-500)]";
                    return (
                      <div key={i} className={`p-6 border-l-4 bg-white shadow-md rounded-r-lg ${borderColor}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-mono uppercase tracking-widest font-bold ${labelColor}`}>{label}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">· {name}</span>
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{v?.summary || "No verdict available."}</p>
                        {v?.key_failure_points && v.key_failure_points.length > 0 && (
                          <ul className="mt-3 space-y-1">
                            {v.key_failure_points.slice(0, 3).map((pt, k) => (
                              <li key={k} className="text-xs text-red-600 flex items-start gap-1.5">
                                <span className="mt-0.5 flex-shrink-0">⚠</span> {pt}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Auth gate modal */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-[var(--color-navy-900)]">Log in to Compare</DialogTitle>
            <DialogDescription>
              You need an account to use the policy comparison tool. Log in or create a free account to get started.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => { setShowAuthModal(false); navigate("/signup"); }}
              className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[var(--color-border-medium)] text-[var(--color-text-main)] hover:bg-[var(--color-cream-main)] transition-colors"
            >
              Sign Up
            </button>
            <button
              onClick={() => { setShowAuthModal(false); navigate("/login"); }}
              className="px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--color-teal-600)] text-white hover:bg-[var(--color-teal-700)] transition-colors"
            >
              Log In
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
