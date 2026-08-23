import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Loader2, Scale, Zap, Upload, Search, Plus, X } from "lucide-react";
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

// ─── Add-a-plan searchable picker ─────────────────────────────────────────────────
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
        className="h-12 w-full sm:w-auto px-5 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 font-semibold flex items-center justify-center gap-2 hover:border-[#0D9488] hover:text-[#0D9488] hover:bg-[#0D9488]/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus className="h-5 w-5" /> Add a plan
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[min(92vw,360px)] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search insurer or plan…"
                className="w-full h-10 pl-8 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:border-slate-300 placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">No more plans found.</div>
            ) : (
              filtered.map(([insurer, items]) => (
                <div key={insurer}>
                  <div className="px-3 pt-2 pb-1 text-[11px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">{insurer}</div>
                  {items.map((it) => (
                    <button
                      key={it.uin}
                      type="button"
                      onClick={() => add(it.uin)}
                      className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 truncate">{it.plan_name}</span>
                        {it.sum_insured_options && it.sum_insured_options !== "Not specified" && (
                          <span className="block text-[11px] text-slate-400 truncate">{it.sum_insured_options}</span>
                        )}
                      </span>
                      <Plus className="h-4 w-4 text-slate-300 flex-shrink-0" />
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

// ─── Selected plan card ────────────────────────────────────────────────────────────
function PlanCard({ item, index, onRemove }: { item: CatalogItem; index: number; onRemove: () => void }) {
  const pal = SIDE_PALETTE[index % SIDE_PALETTE.length];
  return (
    <div className="relative rounded-xl border-2 bg-white p-3.5 pr-9 w-full sm:w-56 flex-shrink-0" style={{ borderColor: pal.accent }}>
      <span className="inline-block text-[11px] sm:text-[10px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded-full mb-1.5" style={{ backgroundColor: pal.accent }}>
        {String.fromCharCode(65 + index)}
      </span>
      <p className="font-bold text-slate-800 leading-tight truncate">{item.plan_name}</p>
      <p className="text-xs text-slate-400 truncate">{item.insurer}</p>
      {item.sum_insured_options && item.sum_insured_options !== "Not specified" && (
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.sum_insured_options}</p>
      )}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-400 flex items-center justify-center transition-colors"
        aria-label="Remove plan"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────────
export default function CatalogCompare() {
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
        setError("Could not load the catalog.");
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

  // Auto-compare whenever 2+ plans are selected.
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
        if (alive) setError(e.message || "Compare failed");
      } finally {
        if (alive) setComparing(false);
      }
    })();
    return () => { alive = false; };
  }, [selected]);

  const excludeSet = useMemo(() => new Set(selected), [selected]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">Compare from Catalog</h1>
            <p className="text-slate-500 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-[#0D9488]" /> Instant — add up to 4 pre-analysed plans.
            </p>
          </div>
        </div>
        <Link href="/agent/compare" className="hidden sm:flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 whitespace-nowrap mt-1">
          <Upload className="h-4 w-4" /> Upload instead
        </Link>
      </div>

      {loadingCatalog ? (
        <div className="flex flex-col items-center py-14 sm:py-20 lg:py-24 text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin mb-2" /> Loading catalog…
        </div>
      ) : (
        <>
          {/* Builder */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-2 shadow-sm">
            <div className="flex flex-wrap gap-3 items-stretch">
              {selected.map((uin, i) =>
                byUin[uin] ? <PlanCard key={uin} item={byUin[uin]} index={i} onRemove={() => removePlan(uin)} /> : null
              )}
              {selected.length < MAX_PLANS && (
                <AddPlanPicker grouped={grouped} exclude={excludeSet} onAdd={addPlan} />
              )}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              {selected.length}/{MAX_PLANS} selected · {catalog.length} plans across {Object.keys(grouped).length} insurers ·{" "}
              {selected.length < 2 ? "add at least 2 to compare" : "comparing…"}
            </p>
          </div>

          {error && <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>}

          {comparing && (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Comparing…
            </div>
          )}

          {!comparing && result && <div className="mt-6"><ComparisonView data={result} /></div>}

          {!comparing && !result && !error && (
            <div className="text-center py-12 sm:py-16 lg:py-20 text-slate-400">
              <Scale className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Add two or more plans to see the head-to-head.
            </div>
          )}
        </>
      )}
    </div>
  );
}
