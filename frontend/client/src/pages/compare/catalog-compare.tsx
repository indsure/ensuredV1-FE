import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Loader2, Scale, Zap, Search, Plus, X, ArrowRight, Lock, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { MpEvent, track } from "@/lib/mixpanel";
import ComparisonView, { SIDE_PALETTE } from "@/components/ComparisonView";
import { type ComparisonResult } from "@/lib/wordingProfile";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useSEO } from "@/hooks/use-seo";
import { LifeInsuranceComparer } from "@/components/LifeInsuranceComparer";
import { TermInsuranceComparer } from "@/components/TermInsuranceComparer";
import { VehicleInsuranceComparer } from "@/components/VehicleInsuranceComparer";

/**
 * PUBLIC catalog compare — the consumer version of the agent's
 * /agent/compare/catalog. Pick 2–4 real health plans from the pre-analysed
 * wording catalog and get a deterministic head-to-head. Free, anonymous,
 * ZERO AI cost (the backend compares stored wording profiles — no Gemini).
 * This page is a lead-gen funnel: it ends in the signup CTA.
 */

const MAX_PLANS = 4;

interface CatalogItem {
  uin: string;
  insurer: string;
  plan_name: string;
  product_type: string;
  sum_insured_options: string | null;
  confidence: string | null;
  status: string | null;
}

// ─── Add-a-plan searchable picker (transplanted from agent CatalogCompare) ──
function AddPlanPicker({
  grouped, exclude, onAdd, disabled,
}: {
  grouped: Record<string, CatalogItem[]>;
  exclude: Set<string>;
  onAdd: (uin: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: [string, CatalogItem[]][] = [];
    for (const [insurer, items] of Object.entries(grouped)) {
      const fi = items.filter(
        (i) => !exclude.has(i.uin) && (!q || i.plan_name.toLowerCase().includes(q) || insurer.toLowerCase().includes(q))
      );
      if (fi.length) out.push([insurer, fi]);
    }
    return out;
  }, [grouped, exclude, query]);

  const add = (uin: string) => { onAdd(uin); setOpen(false); setQuery(""); };

  return (
    <div className="relative w-full sm:w-auto" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="h-12 w-full sm:w-auto px-5 rounded-xl border-2 border-dashed border-[var(--color-border-medium)] text-[var(--color-text-secondary)] font-semibold flex items-center justify-center gap-2 hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)] hover:bg-[var(--color-teal-600)]/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <Plus className="h-5 w-5" /> Add a plan
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[min(92vw,360px)] bg-white border border-[var(--color-border-light)] rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border-light)]">
            <div className="relative">
              <Search className="h-4 w-4 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search insurer or plan…"
                className="w-full h-10 pl-8 pr-3 text-sm rounded-lg border border-[var(--color-border-light)] bg-[var(--color-cream-main)] outline-none focus:bg-white focus:border-[var(--color-border-medium)] placeholder:text-[var(--color-text-muted)]"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">No more plans found.</div>
            ) : (
              filtered.map(([insurer, items]) => (
                <div key={insurer}>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{insurer}</div>
                  {items.map((it) => (
                    <button
                      key={it.uin}
                      type="button"
                      onClick={() => add(it.uin)}
                      className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-[var(--color-cream-main)] cursor-pointer transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--color-navy-900)] truncate">{it.plan_name}</span>
                        {it.sum_insured_options && it.sum_insured_options !== "Not specified" && (
                          <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{it.sum_insured_options}</span>
                        )}
                      </span>
                      <Plus className="h-4 w-4 text-[var(--color-border-medium)] flex-shrink-0" />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Selected plan card ─────────────────────────────────────────────────────
function PlanCard({ item, index, onRemove }: { item: CatalogItem; index: number; onRemove: () => void }) {
  const pal = SIDE_PALETTE[index % SIDE_PALETTE.length];
  return (
    <div className="relative rounded-xl border-2 bg-white p-3.5 pr-9 w-full sm:w-56 flex-shrink-0" style={{ borderColor: pal.accent }}>
      <span className="inline-block text-[10px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded-full mb-1.5" style={{ backgroundColor: pal.accent }}>
        {String.fromCharCode(65 + index)}
      </span>
      <p className="font-bold text-[var(--color-navy-900)] leading-tight truncate">{item.plan_name}</p>
      <p className="text-xs text-[var(--color-text-muted)] truncate">{item.insurer}</p>
      {item.sum_insured_options && item.sum_insured_options !== "Not specified" && (
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">{item.sum_insured_options}</p>
      )}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-[var(--color-cream-dark)] hover:bg-red-50 hover:text-red-500 text-[var(--color-text-muted)] flex items-center justify-center transition-colors cursor-pointer"
        aria-label="Remove plan"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function PublicCatalogCompare() {
  // ?type=life|term|vehicle keep their dedicated comparers (they render their
  // own full page chrome) — identical behavior to the old /compare.
  const compareType = new URLSearchParams(window.location.search).get("type");
  if (compareType === "life") return <LifeInsuranceComparer />;
  if (compareType === "term") return <TermInsuranceComparer />;
  if (compareType === "vehicle") return <VehicleInsuranceComparer />;

  return <HealthCatalogCompare />;
}

function HealthCatalogCompare() {
  useSEO({
    title: "Compare Health Insurance Policies Side-by-Side | IndSure",
    description: "Compare real health insurance policy wordings side by side — room limits, waiting periods, co-pays, exclusions. Up to 4 plans, instant, free, no signup.",
    keywords: "compare health insurance, insurance comparison tool, compare insurance policies, health insurance comparison India, side-by-side insurance comparison",
    canonical: "/compare",
  });

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/compare/catalog");
        if (!res.ok) throw new Error("catalog");
        const json = await res.json();
        setCatalog(json.policies ?? []);
      } catch {
        setError("Could not load the catalog. Please try again in a minute.");
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, CatalogItem[]> = {};
    for (const it of catalog) (g[it.insurer] ??= []).push(it);
    return g;
  }, [catalog]);

  const byUin = useMemo(() => {
    const m: Record<string, CatalogItem> = {};
    for (const it of catalog) m[it.uin] = it;
    return m;
  }, [catalog]);

  const addPlan = (uin: string) => setSelected((s) => (s.includes(uin) || s.length >= MAX_PLANS ? s : [...s, uin]));
  const removePlan = (uin: string) => setSelected((s) => s.filter((u) => u !== uin));

  // Auto-compare whenever 2+ plans are selected. Deterministic backend — no AI.
  useEffect(() => {
    if (selected.length < 2) { setResult(null); return; }
    let alive = true;
    setComparing(true);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch("/api/compare/from-catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uins: selected }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Compare failed");
        const json = await res.json();
        if (alive) {
          setResult(json.result);
          // Plan UINs are public IRDAI identifiers, not user data — safe to
          // send, and knowing which plans get compared is the whole point.
          track(MpEvent.CompareRun, {
            surface: "public-catalog",
            plan_count: selected.length,
            uins: selected,
          });
        }
      } catch (e: any) {
        if (alive) setError(e.message || "Compare failed");
      } finally {
        if (alive) setComparing(false);
      }
    })();
    return () => { alive = false; };
  }, [selected]);

  const excludeSet = useMemo(() => new Set(selected), [selected]);

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] flex flex-col font-sans text-[var(--color-navy-900)]">
      <Header />

      <main className="flex-grow pt-24 pb-20 px-4 sm:px-6 max-w-5xl mx-auto w-full">
        <Breadcrumbs items={[{ label: "Compare" }]} />

        {/* Hero */}
        <div className="mt-6 mb-10 max-w-2xl">
          <span className="inline-block py-1 px-3 border border-[var(--color-teal-600)]/25 bg-[var(--color-teal-600)]/10 rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-teal-600)]">
            Compare Tool
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-serif font-bold leading-[1.1]">
            The fine print, <span className="italic text-[var(--color-teal-600)]">compared.</span>
          </h1>
          <p className="mt-4 text-lg text-[var(--color-text-secondary)] leading-relaxed">
            Pick up to {MAX_PLANS} real health plans and we'll compare the actual policy
            wordings — room limits, waiting periods, co-pays, exclusions. Instant, free, no signup.
          </p>
          <p className="mt-2 text-xs text-[var(--color-text-muted)] font-mono flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-[var(--color-teal-600)]" />
            {catalog.length > 0 ? `${catalog.length} pre-analysed plans across ${Object.keys(grouped).length} insurers` : "Pre-analysed policy wordings, decoded"}
          </p>
        </div>

        {loadingCatalog ? (
          <div className="flex flex-col items-center py-24 text-[var(--color-text-muted)]">
            <Loader2 className="h-7 w-7 animate-spin mb-2" /> Loading catalog…
          </div>
        ) : (
          <>
            {/* Builder */}
            <div className="bg-white rounded-2xl border border-[var(--color-border-light)] p-5 shadow-sm">
              <div className="flex flex-wrap gap-3 items-stretch">
                {selected.map((uin, i) =>
                  byUin[uin] ? <PlanCard key={uin} item={byUin[uin]} index={i} onRemove={() => removePlan(uin)} /> : null
                )}
                {selected.length < MAX_PLANS && (
                  <AddPlanPicker grouped={grouped} exclude={excludeSet} onAdd={addPlan} />
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-3">
                {selected.length}/{MAX_PLANS} selected ·{" "}
                {selected.length < 2 ? "add at least 2 to compare" : comparing ? "comparing…" : "instant result below"}
              </p>
            </div>

            {error && <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>}

            {comparing && (
              <div className="flex items-center justify-center gap-2 py-16 text-[var(--color-text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin" /> Comparing…
              </div>
            )}

            {!comparing && result && (
              <div className="mt-6 bg-white rounded-2xl border border-[var(--color-border-light)] p-4 sm:p-6 shadow-sm">
                <ComparisonView data={result} />
              </div>
            )}

            {!comparing && !result && !error && (
              <div className="text-center py-16 text-[var(--color-text-muted)]">
                <Scale className="h-10 w-10 mx-auto mb-3 opacity-40" />
                Add two or more plans to see the head-to-head.
              </div>
            )}

            {/* Funnel close — the whole reason this page is free */}
            {!comparing && result && (
              <div className="mt-10 bg-[var(--color-navy-900)] rounded-2xl p-8 sm:p-10 text-center text-white">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                  That's the market. Now — how does <span className="italic text-[var(--color-teal-400)]">your</span> policy score?
                </h2>
                <p className="mt-3 text-white/70 max-w-lg mx-auto">
                  Upload the policy you actually own and get an unbiased 50-point audit
                  in about a minute, saved to your private portfolio.
                </p>
                <Link href="/signup">
                  <button className="mt-6 inline-flex items-center gap-2 bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors cursor-pointer">
                    Analyze my policy — free <ArrowRight className="w-5 h-5" />
                  </button>
                </Link>
                <p className="mt-4 text-xs text-white/50 flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> No spam. No cold calls. An advisor reaches out only if you ask.
                </p>
              </div>
            )}

            {/* Sample link for browsers */}
            <div className="mt-8 text-center">
              <Link href="/report?sample=health">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">
                  <FileText className="w-4 h-4" /> See what a full policy audit looks like
                </span>
              </Link>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
