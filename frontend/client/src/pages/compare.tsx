import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Scale, Zap, Search, Plus, X, Sparkles, ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { apiFetch } from "@/lib/api";
import ComparisonView, { SIDE_PALETTE } from "@/components/ComparisonView";
import { type ComparisonResult } from "@/lib/wordingProfile";

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

// ─── Add-a-plan searchable picker ──────────────────────────────────────────────
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
        className="h-14 w-full sm:w-auto px-6 rounded-xl border-2 border-dashed border-[var(--color-border-medium)] text-[var(--color-text-secondary)] font-semibold flex items-center justify-center gap-2 hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)] hover:bg-[var(--color-teal-600)]/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus className="h-5 w-5" /> Add a plan
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[min(92vw,380px)] bg-white border border-[var(--color-border-light)] rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border-light)]">
            <div className="relative">
              <Search className="h-4 w-4 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search insurer or plan…"
                className="w-full h-10 pl-8 pr-3 text-sm rounded-lg border border-[var(--color-border-light)] bg-[var(--color-cream-main)] outline-none focus:bg-white focus:border-[var(--color-teal-600)] placeholder:text-[var(--color-text-muted)]"
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
                        <span className="block text-sm font-semibold text-[var(--color-text-main)] truncate">{it.plan_name}</span>
                        {it.sum_insured_options && it.sum_insured_options !== "Not specified" && (
                          <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{it.sum_insured_options}</span>
                        )}
                      </span>
                      <Plus className="h-4 w-4 text-[var(--color-text-muted)] flex-shrink-0" />
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

// ─── Selected plan card ─────────────────────────────────────────────────────────
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
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-[var(--color-cream-main)] hover:bg-red-50 hover:text-red-500 text-[var(--color-text-muted)] flex items-center justify-center transition-colors"
        aria-label="Remove plan"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function ComparePage() {
  const [, navigate] = useLocation();
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
        setError("Could not load the plan catalog. Please try again.");
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

  // Auto-compare whenever 2+ plans are selected. Deterministic, no AI cost.
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
        if (alive) setResult(json.result);
      } catch (e: any) {
        if (alive) setError(e.message || "Compare failed. Please try again.");
      } finally {
        if (alive) setComparing(false);
      }
    })();
    return () => { alive = false; };
  }, [selected]);

  const excludeSet = useMemo(() => new Set(selected), [selected]);

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-32 pb-20 px-6 w-full">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-1.5 py-1 px-3 border border-[var(--color-teal-400)] rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-teal-600)] mb-6 bg-white">
              <Zap className="w-3.5 h-3.5" /> Instant · Free · No sign-up
            </span>
            <h1 className="text-4xl md:text-6xl font-serif mb-5 tracking-tight text-[var(--color-navy-900)]">
              Compare Health Policies
            </h1>
            <p className="text-lg md:text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto font-light leading-relaxed">
              Pick up to 4 plans from our analysed catalog and see a real, clause-level
              head-to-head — room rent, co-pay, waiting periods, sub-limits. No fluff, no bias.
            </p>
          </div>

          {loadingCatalog ? (
            <div className="flex flex-col items-center py-24 text-[var(--color-text-muted)]">
              <Loader2 className="h-7 w-7 animate-spin mb-2" /> Loading plan catalog…
            </div>
          ) : (
            <>
              {/* Builder */}
              <div className="card-white bg-white rounded-2xl border border-[var(--color-border-light)] p-5 md:p-6 shadow-lg">
                <div className="flex flex-wrap gap-3 items-stretch">
                  {selected.map((uin, i) =>
                    byUin[uin] ? <PlanCard key={uin} item={byUin[uin]} index={i} onRemove={() => removePlan(uin)} /> : null
                  )}
                  {selected.length < MAX_PLANS && (
                    <AddPlanPicker grouped={grouped} exclude={excludeSet} onAdd={addPlan} />
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-3">
                  {selected.length}/{MAX_PLANS} selected · {catalog.length} plans across {Object.keys(grouped).length} insurers ·{" "}
                  {selected.length < 2 ? "add at least 2 to compare" : "comparing…"}
                </p>
              </div>

              {error && (
                <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
              )}

              {comparing && (
                <div className="flex items-center justify-center gap-2 py-16 text-[var(--color-text-muted)]">
                  <Loader2 className="h-5 w-5 animate-spin" /> Comparing…
                </div>
              )}

              {!comparing && result && <div className="mt-8"><ComparisonView data={result} /></div>}

              {!comparing && !result && !error && (
                <div className="text-center py-16 text-[var(--color-text-muted)]">
                  <Scale className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  Add two or more plans above to see the head-to-head.
                </div>
              )}

              {/* Own-policy CTA — full AI audit is an account feature (lead capture) */}
              <div className="mt-12 rounded-2xl border border-[var(--color-teal-400)]/40 bg-white p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center gap-5">
                <div className="flex-1">
                  <h3 className="font-serif text-xl md:text-2xl text-[var(--color-navy-900)] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[var(--color-gold-500)]" />
                    Have your own policy?
                  </h3>
                  <p className="text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">
                    Get a full AI audit of your <em>own</em> policy document — a 100-point score,
                    hidden-clause flags, and a plain-language verdict. Create a free account to start.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/signup")}
                  className="shrink-0 inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-navy-900)] hover:bg-[var(--color-navy-800)] text-white font-semibold transition-colors"
                >
                  Analyse my policy <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
