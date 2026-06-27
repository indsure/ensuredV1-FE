import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Loader2, Scale, Zap, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api";
import ComparisonView, { TEAL, AMBER } from "@/components/ComparisonView";
import { type ComparisonResult } from "@/lib/wordingProfile";

interface CatalogItem {
  uin: string;
  insurer: string;
  plan_name: string;
  product_type: string;
  sum_insured_options: string | null;
  confidence: string | null;
  status: string | null;
}

// Native grouped <select> — fine for a catalog this size; swap to a searchable
// combobox once it grows past a few dozen.
function PlanPicker({
  label, accent, grouped, value, onChange, exclude,
}: {
  label: string;
  accent: string;
  grouped: Record<string, CatalogItem[]>;
  value: string;
  onChange: (uin: string) => void;
  exclude?: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: accent }}>
          {label}
        </span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-3 rounded-xl border-2 bg-white text-slate-800 font-medium outline-none focus:ring-2"
        style={{ borderColor: value ? accent : "#CBD5E1" }}
      >
        <option value="">Choose a plan…</option>
        {Object.entries(grouped).map(([insurer, items]) => (
          <optgroup key={insurer} label={insurer}>
            {items.map((it) => (
              <option key={it.uin} value={it.uin} disabled={it.uin === exclude}>
                {it.plan_name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export default function CatalogCompare() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [uinA, setUinA] = useState("");
  const [uinB, setUinB] = useState("");
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

  useEffect(() => {
    if (!uinA || !uinB || uinA === uinB) { setResult(null); return; }
    let alive = true;
    setComparing(true);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch("/api/compare/from-catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uin_a: uinA, uin_b: uinB }),
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
  }, [uinA, uinB]);

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
              <Zap className="h-3.5 w-3.5 text-[#0D9488]" /> Instant — pick any two pre-analysed plans.
            </p>
          </div>
        </div>
        <Link
          href="/agent/compare"
          className="hidden sm:flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 whitespace-nowrap mt-1"
        >
          <Upload className="h-4 w-4" /> Upload instead
        </Link>
      </div>

      {loadingCatalog ? (
        <div className="flex flex-col items-center py-24 text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin mb-2" /> Loading catalog…
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-2 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <PlanPicker label="Plan A" accent={TEAL} grouped={grouped} value={uinA} onChange={setUinA} exclude={uinB} />
              <div className="hidden sm:flex h-12 items-center text-slate-300 font-black">VS</div>
              <PlanPicker label="Plan B" accent={AMBER} grouped={grouped} value={uinB} onChange={setUinB} exclude={uinA} />
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">
              {catalog.length} plans across {Object.keys(grouped).length} insurers in the catalog
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
          )}

          {comparing && (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Comparing…
            </div>
          )}

          {!comparing && result && (
            <div className="mt-6">
              <ComparisonView data={result} />
            </div>
          )}

          {!comparing && !result && !error && (
            <div className="text-center py-20 text-slate-400">
              <Scale className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Choose a plan on each side to see the head-to-head.
            </div>
          )}
        </>
      )}
    </div>
  );
}
