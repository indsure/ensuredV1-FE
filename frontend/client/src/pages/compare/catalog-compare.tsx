import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Loader2, Scale, Zap, Search, Plus, X, ArrowRight, Lock, FileText, ChevronRight, ChevronLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { MpEvent, track } from "@/lib/mixpanel";
import ComparisonView, { SIDE_PALETTE } from "@/components/ComparisonView";
import { type ComparisonResult } from "@/lib/wordingProfile";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useSEO } from "@/hooks/use-seo";
import { seoFor } from "@/data/seo-pages";
import { Eyebrow } from "@/components/marketing";
import { DiffRows } from "@/components/marketing/showcase";
import { LifeInsuranceComparer } from "@/components/LifeInsuranceComparer";
import { TermInsuranceComparer } from "@/components/TermInsuranceComparer";
import { VehicleInsuranceComparer } from "@/components/VehicleInsuranceComparer";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * PUBLIC catalog compare — the consumer version of the agent's
 * /agent/compare/catalog. Pick 2–4 real health plans from the pre-analysed
 * wording catalog and get a deterministic head-to-head. Free, anonymous,
 * ZERO AI cost (the backend compares stored wording profiles — no Gemini).
 * This page is a lead-gen funnel: it ends in the signup CTA.
 */

const MAX_PLANS = 4;

/**
 * A plan's identity. plan_key is uin for a product with no variants and uin:variant for one
 * that has them, so Classic and Elite are separate selectable rows.
 *
 * Falls back to uin because the frontend deploys independently of the API: a build that has
 * this change can be served against a backend that does not return plan_key yet, and must keep
 * working rather than keying everything on undefined.
 */
const keyOf = (i: { plan_key?: string; uin: string }) => i.plan_key || i.uin;

interface CatalogItem {
  // plan_key is the identity, not uin. Variants of one product share a UIN, so keying on uin
  // would make Classic and Elite the same row. plan_key is uin, or uin:variant where there
  // are variants, and it is what /api/compare/from-catalog expects back.
  plan_key?: string;
  uin: string;
  variant?: string;
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
  // Two-level browse: the catalogue is ~100 plans, so the closed state lists insurers and you
  // drill into one. Typing bypasses both levels and searches every plan at once.
  const [openInsurer, setOpenInsurer] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setOpen(false); setQuery(""); setOpenInsurer(null); };
  const { t } = useLanguage();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) reset();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: [string, CatalogItem[]][] = [];
    for (const [insurer, items] of Object.entries(grouped)) {
      const fi = items.filter(
        (i) => !exclude.has(keyOf(i)) && (!q || i.plan_name.toLowerCase().includes(q) || insurer.toLowerCase().includes(q))
      );
      if (fi.length) out.push([insurer, fi]);
    }
    return out;
  }, [grouped, exclude, query]);

  // Insurers that still have at least one unselected plan, alphabetical.
  const insurers = useMemo(
    () =>
      Object.entries(grouped)
        .map(([insurer, items]) => [insurer, items.filter((i) => !exclude.has(keyOf(i)))] as [string, CatalogItem[]])
        .filter(([, items]) => items.length > 0)
        .sort((a, b) => a[0].localeCompare(b[0])),
    [grouped, exclude],
  );

  const searching = query.trim().length > 0;
  const drilledPlans = openInsurer ? insurers.find(([n]) => n === openInsurer)?.[1] ?? [] : [];

  const add = (uin: string) => { onAdd(uin); reset(); };

  const planRow = (it: CatalogItem) => (
    <button
      key={keyOf(it)}
      type="button"
      onClick={() => add(keyOf(it))}
      className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-[var(--color-cream-main)] cursor-pointer transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--color-navy-900)] truncate">{it.plan_name}{it.variant ? ` (${it.variant})` : ""}</span>
        {it.sum_insured_options && it.sum_insured_options !== "Not specified" && (
          <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{it.sum_insured_options}</span>
        )}
      </span>
      <Plus className="h-4 w-4 text-[var(--color-border-medium)] flex-shrink-0" />
    </button>
  );

  return (
    <div className="relative w-full sm:w-auto" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="h-12 w-full sm:w-auto px-5 rounded-xl border-2 border-dashed border-[var(--color-border-medium)] text-[var(--color-text-secondary)] font-semibold flex items-center justify-center gap-2 hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)] hover:bg-[var(--color-teal-600)]/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <Plus className="h-5 w-5" /> {t("ccmp.add")}
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
                placeholder={t("ccmp.search")}
                className="w-full h-10 pl-8 pr-3 text-sm rounded-lg border border-[var(--color-border-light)] bg-[var(--color-cream-main)] outline-none focus:bg-white focus:border-[var(--color-border-medium)] placeholder:text-[var(--color-text-muted)]"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {searching ? (
              /* Typing searches every plan at once, across all insurers. */
              filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">{t("ccmp.no_match")}</div>
              ) : (
                filtered.map(([insurer, items]) => (
                  <div key={insurer}>
                    <div className="sticky top-0 z-10 bg-white px-3 pt-2 pb-1 text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">{insurer}</div>
                    {items.map(planRow)}
                  </div>
                ))
              )
            ) : openInsurer ? (
              /* Level 2: the plans of one insurer. */
              <>
                <button
                  type="button"
                  onClick={() => setOpenInsurer(null)}
                  className="w-full text-left px-3 py-2 flex items-center gap-1.5 text-sm font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-teal-600)] border-b border-[var(--color-border-light)] cursor-pointer transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> {t("ccmp.all_insurers")}
                </button>
                <div className="sticky top-0 z-10 bg-white px-3 pt-2 pb-1 text-sm font-bold text-[var(--color-text-secondary)]">{openInsurer}</div>
                {drilledPlans.map(planRow)}
              </>
            ) : insurers.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">{t("ccmp.no_more")}</div>
            ) : (
              /* Level 1: the insurers. */
              insurers.map(([insurer, items]) => (
                <button
                  key={insurer}
                  type="button"
                  onClick={() => setOpenInsurer(insurer)}
                  className="w-full text-left px-3 py-3 flex items-center justify-between gap-2 hover:bg-[var(--color-cream-main)] cursor-pointer transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--color-navy-900)] truncate">{insurer}</span>
                    <span className="block text-sm text-[var(--color-text-secondary)]">
                      {items.length === 1 ? t("ccmp.n_plans_one") : t("ccmp.n_plans", { n: items.length })}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-[var(--color-border-medium)] flex-shrink-0" />
                </button>
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
  const { t } = useLanguage();
  return (
    <div className="relative rounded-xl border-2 bg-white p-3.5 pr-9 w-full sm:w-56 flex-shrink-0" style={{ borderColor: pal.accent }}>
      <span className="inline-block text-xs font-black uppercase tracking-widest text-white px-2 py-0.5 rounded-full mb-1.5" style={{ backgroundColor: pal.accent }}>
        {String.fromCharCode(65 + index)}
      </span>
      <p className="font-bold text-[var(--color-navy-900)] leading-tight truncate">{item.plan_name}{item.variant ? ` (${item.variant})` : ""}</p>
      <p className="text-xs text-[var(--color-text-muted)] truncate">{item.insurer}</p>
      {item.sum_insured_options && item.sum_insured_options !== "Not specified" && (
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">{item.sum_insured_options}</p>
      )}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-[var(--color-cream-dark)] hover:bg-red-50 hover:text-red-500 text-[var(--color-text-muted)] flex items-center justify-center transition-colors cursor-pointer"
        aria-label={t("ccmp.remove")}
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
  useSEO(seoFor("/compare"));

  const { t } = useLanguage();
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
        setError(t("ccmp.load_failed"));
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

  const byKey = useMemo(() => {
    const m: Record<string, CatalogItem> = {};
    for (const it of catalog) m[keyOf(it)] = it;
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
        if (alive) setError(e.message || t("ccmp.failed"));
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

      <main className="flex-grow pt-24 pb-12 sm:pb-16 lg:pb-20 px-4 sm:px-6 max-w-5xl mx-auto w-full">
        <Breadcrumbs items={[{ label: t("ccmp.crumb") }]} />

        {/* Hero */}
        <div className="mt-6 mb-10 max-w-2xl">
          <Eyebrow icon={Scale}>{t("ccmp.eyebrow")}</Eyebrow>
          <h1 className="mt-4 text-4xl md:text-5xl font-serif font-bold leading-[1.1]">
            {t("ccmp.h_a")} <span className="italic text-[var(--color-teal-600)]">{t("ccmp.h_b")}</span>
          </h1>
          <p className="mt-4 text-lg text-[var(--color-text-secondary)] leading-relaxed">
            {t("ccmp.sub", { n: MAX_PLANS })}
          </p>
          <p className="mt-3 text-[15px] text-[var(--color-text-secondary)] flex items-center gap-1.5">
            <Zap className="h-4 w-4 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
            {catalog.length > 0 ? t("ccmp.count", { plans: catalog.length, insurers: Object.keys(grouped).length }) : t("ccmp.decoded")}
          </p>
        </div>

        {loadingCatalog ? (
          <div className="flex flex-col items-center py-14 sm:py-20 lg:py-24 text-[var(--color-text-muted)]">
            <Loader2 className="h-7 w-7 animate-spin mb-2" /> {t("ccmp.loading")}
          </div>
        ) : (
          <>
            {/* Builder */}
            <div className="bg-white rounded-2xl border border-[var(--color-border-light)] p-5 shadow-sm">
              <div className="flex flex-wrap gap-3 items-stretch">
                {selected.map((uin, i) =>
                  byKey[uin] ? <PlanCard key={uin} item={byKey[uin]} index={i} onRemove={() => removePlan(uin)} /> : null
                )}
                {selected.length < MAX_PLANS && (
                  <AddPlanPicker grouped={grouped} exclude={excludeSet} onAdd={addPlan} />
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-3">
                {t("ccmp.selected", { n: selected.length, max: MAX_PLANS })} ·{" "}
                {selected.length < 2 ? t("ccmp.add_two") : comparing ? t("ccmp.comparing_l") : t("ccmp.instant")}
              </p>
            </div>

            {error && <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>}

            {comparing && (
              <div className="flex items-center justify-center gap-2 py-16 text-[var(--color-text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin" /> {t("ccmp.comparing")}
              </div>
            )}

            {!comparing && result && (
              <div className="mt-6 bg-white rounded-2xl border border-[var(--color-border-light)] p-4 sm:p-6 shadow-sm">
                <ComparisonView data={result} />
              </div>
            )}

            {/* An empty comparison tool is a page that explains nothing. Rather
                than a grey icon and one line, the empty state shows a worked
                example so a first-time visitor can see the output before
                deciding whether to build one.

                Deliberately NOT gated on `!error`: when the catalog fails to
                load, the error sits above this and the page would otherwise be
                a dead end. That is exactly when a visitor most needs to see
                what they came for. */}
            {!comparing && !result && (
              <div className="mt-10 flex flex-col gap-5">
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                    {t("ccmp.example_h")}
                  </span>
                  <p className="max-w-xl text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                    {t("ccmp.example_d")}
                  </p>
                </div>

                <DiffRows
                  left={t("ccmp.plan_a")}
                  right={t("ccmp.plan_b")}
                  rows={[
                    { label: t("ccmp.r_room"), a: t("ccmp.v_nocap"), b: t("ccmp.v_perday"), better: "a" },
                    { label: t("ccmp.r_copay"), a: t("ccmp.v_none"), b: t("ccmp.v_after60"), better: "a" },
                    { label: t("ccmp.r_knee"), a: t("ccmp.v_2y"), b: t("ccmp.v_4y"), better: "a" },
                    { label: t("ccmp.r_restore"), a: t("ccmp.v_same"), b: t("ccmp.v_diff"), better: "a" },
                    { label: t("ccmp.r_premium"), a: "₹42,000", b: "₹38,700", better: "b" },
                  ]}
                />

                <p className="text-center text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                  {t("ccmp.trade")}
                </p>
              </div>
            )}

            {/* Funnel close — the whole reason this page is free */}
            {!comparing && result && (
              <div className="mt-10 bg-[var(--color-navy-900)] rounded-2xl p-8 sm:p-10 text-center text-white">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                  {t("ccmp.market_a")} <span className="italic text-[var(--color-teal-400)]">{t("ccmp.market_b")}</span> {t("ccmp.market_c")}
                </h2>
                <p className="mt-3 text-white/70 max-w-lg mx-auto">
                  {t("ccmp.upload_own")}
                </p>
                <Link href="/signup">
                  <button className="mt-6 inline-flex items-center gap-2 bg-[var(--color-cta)] hover:bg-[var(--color-cta-hover)] text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors cursor-pointer">
                    {t("ccmp.analyze_free")} <ArrowRight className="w-5 h-5" />
                  </button>
                </Link>
                <p className="mt-4 text-xs text-white/50 flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> {t("ccmp.no_spam")}
                </p>
              </div>
            )}

            {/* Sample link for browsers */}
            <div className="mt-8 text-center">
              <Link href="/report?sample=health">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">
                  <FileText className="w-4 h-4" /> {t("ccmp.see_full")}
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
