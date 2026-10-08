import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type ComparisonResult, type ComparisonRow, type Tone, sideName } from "@/lib/wordingProfile";
import {
  SECTIONS, KEY_ROWS, FIT, INFO_KEYS,
  allRows, insights, isBlank, isSameRow, toneOf, plainDisplay, coverRupees, hasPercentOfCover,
} from "@/lib/compareInsights";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";

// Per-side palette (up to 4). accent = strong, light = on-dark text, tint = cell bg.
export const SIDE_PALETTE = [
  { accent: "#0D9488", light: "#5eead4", tint: "#F0FDFA" }, // teal
  { accent: "#D97706", light: "#fbbf24", tint: "#FFFBEB" }, // amber
  { accent: "#4F46E5", light: "#a5b4fc", tint: "#EEF2FF" }, // indigo
  { accent: "#DB2777", light: "#f9a8d4", tint: "#FDF2F8" }, // pink
];
// Back-compat exports (used by the 2-up upload page).
export const TEAL = SIDE_PALETTE[0].accent;
export const AMBER = SIDE_PALETTE[1].accent;

// Semantic colours, kept apart from the plan palette so "red" always means "costs you money".
// Explicit hex on purpose: the shadcn colour tokens are not defined in this Tailwind theme.
const TONE_CLASS: Record<Tone | "none", string> = {
  good: "bg-[#E3F4E8] text-[#166534]",
  limit: "bg-[#FDF0D8] text-[#8A3B0C]",
  bad: "bg-[#FBE4E2] text-[#9F1D1D]",
  unknown: "bg-[#EEF0EE] text-[#3F4752]",
  none: "bg-slate-50 text-slate-700 border border-slate-200",
};
const TONE_DOT: Record<Tone, string> = { good: "#166534", limit: "#B45309", bad: "#9F1D1D", unknown: "#6B7280" };

const COVER_OPTIONS = [300000, 500000, 1000000, 1500000, 2500000, 5000000, 10000000];

type Tip = { title: string; body: string; x: number; y: number; below: boolean };

function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />;
}

/**
 * The comparison, cut to what changes the money a buyer gets back.
 *
 * Customer view (public /compare, shared links): the call-outs, the rows that differ, and
 * everything else folded away. Advisor view (agent portal): the same, with the full table
 * open by default. No scores: a number with no unit and no method is not something a buyer
 * can check, so the call-outs name the actual rows instead.
 */
export default function ComparisonView({ data, audience = "customer" }: { data: ComparisonResult; audience?: "customer" | "advisor" }) {
  const { t, locale } = useLanguage();
  const n = data.sides.length;
  const names = data.sides.map((s, i) => sideName(s, t("compare_view.plan_n", { n: i + 1 })));
  const color = (i: number) => SIDE_PALETTE[i % SIDE_PALETTE.length].accent;

  const [showAll, setShowAll] = useState(audience === "advisor");
  const [cover, setCover] = useState(1000000);
  const [fit, setFit] = useState<Set<keyof typeof FIT>>(new Set());
  const [tip, setTip] = useState<Tip | null>(null);
  const pinned = useRef<HTMLElement | null>(null);

  // A row no plan has any data for tells the buyer nothing.
  const rows = useMemo(() => allRows(data).filter((r) => !r.cells.every((c) => isBlank(c.display))), [data]);
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const cards = useMemo(() => insights(data), [data]);
  const showCover = useMemo(() => hasPercentOfCover(data), [data]);

  const label = (key: string, fallback: string) => tOr(t, `compare_view.row.${key}`, fallback);
  const help = (key: string) => tOr(t, `compare_view.help.${key}`, "");

  const shown = (key: string, display: string, tone?: Tone) => {
    if (isBlank(display)) return t("compare_view.not_read");
    // The raw "As per Schedule" moves into the tooltip; the chip says where to look.
    if (tone === "unknown") return t("compare_view.in_papers");
    const plain = plainDisplay(display);
    const rs = key === "room_rent" || key === "icu" ? coverRupees(display, cover) : null;
    return rs ? `${plain} · ${rs}` : plain;
  };

  // Table layout: key rows that differ, by section; then everything else when opened.
  const same = rows.filter((r) => !INFO_KEYS.has(r.key) && isSameRow(r));
  const sameKeys = new Set(same.map((r) => r.key));
  const sections = SECTIONS.map((s) => ({
    id: s.id,
    rows: s.keys.map((k) => byKey.get(k)).filter((r): r is ComparisonRow => !!r && (showAll || !sameKeys.has(r.key))),
  })).filter((s) => s.rows.length > 0);
  const moreRows = rows.filter((r) => !KEY_ROWS.has(r.key));
  const hiddenCount =
    moreRows.length + rows.filter((r) => KEY_ROWS.has(r.key) && sameKeys.has(r.key)).length;
  const keyDiffs = rows.filter((r) => KEY_ROWS.has(r.key) && !sameKeys.has(r.key)).length;
  const blocks = [
    ...sections.map((s) => ({ id: `sec_${s.id}`, rows: s.rows })),
    ...(showAll && moreRows.length > 0 ? [{ id: "sec_more", rows: moreRows }] : []),
  ];

  // ── Tooltip: hover on a mouse, tap on a phone, focus on a keyboard ──
  function openTip(el: HTMLElement, title: string, body: string) {
    const r = el.getBoundingClientRect();
    const below = r.top < 140;
    // The bubble is centred on x, so keep half its width clear of both screen edges.
    const half = Math.min(150, (window.innerWidth - 24) / 2);
    const x = Math.min(Math.max(12 + half, r.left + r.width / 2), window.innerWidth - 12 - half);
    setTip({ title, body, x, y: below ? r.bottom + 8 : r.top - 8, below });
  }
  function closeTip() {
    pinned.current = null;
    setTip(null);
  }
  useEffect(() => {
    const onDown = (e: Event) => {
      if (pinned.current && !pinned.current.contains(e.target as Node)) closeTip();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeTip();
    const onScroll = () => closeTip();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  const hoverable = typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches;
  const tipProps = (title: string, body: string) => ({
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if (pinned.current === e.currentTarget) return closeTip();
      pinned.current = e.currentTarget;
      openTip(e.currentTarget, title, body);
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => openTip(e.currentTarget, title, body),
    onBlur: () => !pinned.current && setTip(null),
    onMouseEnter: hoverable ? (e: React.MouseEvent<HTMLElement>) => openTip(e.currentTarget, title, body) : undefined,
    onMouseLeave: hoverable ? () => !pinned.current && setTip(null) : undefined,
  });

  function cellTip(row: ComparisonRow, i: number) {
    const c = row.cells[i];
    const tone = toneOf(row.key, c);
    const parts: string[] = [];
    if (isBlank(c.display) || tone === "unknown") parts.push(t("compare_view.unknown_tip"));
    if (tone === "unknown" && !isBlank(c.display)) parts.push(`"${c.display}"`);
    if (c.note) parts.push(c.note);
    if (c.optional) parts.push(t("compare_view.optional_tip"));
    if (!parts.length) parts.push(plainDisplay(c.display));
    return { title: `${names[i]}: ${label(row.key, row.label)}`, body: parts.join(" ") };
  }

  function chip(row: ComparisonRow, i: number) {
    const c = row.cells[i];
    const tone = toneOf(row.key, c);
    const tp = cellTip(row, i);
    return (
      <button
        type="button"
        {...tipProps(tp.title, tp.body)}
        className={`min-h-[44px] w-full text-left inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[15px] leading-snug font-semibold cursor-help focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0D9488] ${TONE_CLASS[tone ?? "none"]}`}
      >
        {tone && <Dot color={TONE_DOT[tone]} />}
        <span className="min-w-0 break-words">{shown(row.key, c.display, tone)}</span>
        {c.optional && (
          <span className="ml-auto text-xs font-bold uppercase tracking-wide bg-white/70 border border-current/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            {t("compare_view.add_on")}
          </span>
        )}
      </button>
    );
  }

  function rowLabel(row: ComparisonRow) {
    const h = help(row.key);
    const text = label(row.key, row.label);
    if (!h) return <span className="font-semibold text-slate-800">{text}</span>;
    return (
      <button
        type="button"
        {...tipProps(text, h)}
        className="min-h-[44px] text-left inline-flex items-center gap-1.5 font-semibold text-slate-800 cursor-help rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0D9488]"
      >
        {text}
        <span aria-hidden="true" className="inline-grid place-items-center h-[18px] w-[18px] rounded-full border-[1.5px] border-slate-400 text-slate-500 text-[11px] font-bold">i</span>
      </button>
    );
  }

  const cardLine = (keys: string[], i: number) =>
    keys.slice(0, 3).map((k) => {
      const row = byKey.get(k)!;
      return `${label(k, row.label)}: ${shown(k, row.cells[i].display)}`;
    }).join(" · ");

  const colTemplate = `minmax(150px,1.1fr) repeat(${n}, minmax(150px,1fr))`;

  return (
    <div className="space-y-6 text-slate-800">
      {/* ── Which one to pick ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0B1120]">{t("compare_view.pick_h")}</h2>
            <p className="text-sm text-slate-600 mt-0.5">{t("compare_view.n_side_by_side", { count: n })}</p>
          </div>
          {showCover && (
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              {t("compare_view.cover_amount")}
              <select
                value={cover}
                onChange={(e) => setCover(Number(e.target.value))}
                className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-[15px] font-semibold text-slate-800"
              >
                {COVER_OPTIONS.map((v) => (
                  <option key={v} value={v}>{v >= 10000000 ? `₹${v / 10000000} ${t("compare_view.crore")}` : `₹${v / 100000} ${t("compare_view.lakh")}`}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {cards.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((c, idx) => {
              const tone: Tone = c.kind === "strongest" || c.kind === "only" ? "good" : c.kind === "watch" ? "bad" : "unknown";
              const title =
                c.kind === "strongest" ? t("compare_view.card_strongest")
                : c.kind === "only" ? t("compare_view.card_only", { label: label(c.rowKey, byKey.get(c.rowKey)!.label) })
                : c.kind === "watch" ? t("compare_view.card_watch")
                : t("compare_view.card_papers");
              const body =
                c.kind === "strongest" || c.kind === "watch" ? cardLine(c.rowKeys, c.side)
                : c.kind === "only" ? shown(c.rowKey, byKey.get(c.rowKey)!.cells[c.side].display)
                : t("compare_view.card_papers_body", { count: c.count });
              return (
                <div key={idx} className="rounded-xl border border-slate-200 bg-[#FAFAF8] p-4 flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: TONE_DOT[tone] }}>{title}</span>
                  <span className="text-[17px] font-bold text-[#0B1120] flex items-center gap-2"><Dot color={color(c.side)} />{names[c.side]}</span>
                  <p className="text-[15px] text-slate-600 leading-relaxed">{body}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[15px] text-slate-600">{t("compare_view.no_cards")}</p>
        )}

        {/* ── Which fits you ── */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("compare_view.fit_h")}>
            <span className="font-semibold mr-1">{t("compare_view.fit_h")}</span>
            {(Object.keys(FIT) as (keyof typeof FIT)[]).filter((k) => FIT[k].some((rk) => byKey.has(rk))).map((k) => {
              const on = fit.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFit((prev) => { const s = new Set(prev); on ? s.delete(k) : s.add(k); return s; })}
                  className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors ${on ? "border-[#0D9488] bg-[#E6F4F2] text-[#0F766E]" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}
                >
                  {t(`compare_view.fit_${k}`)}
                </button>
              );
            })}
          </div>
          {fit.size > 0 && (
            <div className="space-y-3">
              {Array.from(new Set(Array.from(fit).flatMap((k) => FIT[k]))).map((rk) => {
                const row = byKey.get(rk);
                if (!row) return null;
                return (
                  <div key={rk} className="space-y-2">
                    <p className="text-[15px]"><span className="font-semibold">{label(rk, row.label)}.</span> <span className="text-slate-600">{help(rk)}</span></p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {row.cells.map((_, i) => (
                        <div key={i} className="flex flex-col gap-1 min-w-0">
                          <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5"><Dot color={color(i)} />{names[i]}</span>
                          {chip(row, i)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Colour key ── */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600" aria-label={t("compare_view.legend")}>
        {(["good", "limit", "bad", "unknown"] as Tone[]).map((tn) => (
          <span key={tn} className="inline-flex items-center gap-2"><Dot color={TONE_DOT[tn]} />{t(`compare_view.legend_${tn}`)}</span>
        ))}
        <span className="text-slate-500">{t("compare_view.tap_hint")}</span>
      </div>
      {locale === "hi" && <p className="text-sm text-slate-500 -mt-3">{t("compare_view.engine_english")}</p>}

      {/* ── The rows: a table from tablet up; on a phone, each row shows every plan in a grid,
          because a sideways-scrolling table shows one plan at a time and hides the comparison. ── */}
      {keyDiffs === 0 && !showAll && <p className="text-[15px] text-slate-600">{t("compare_view.no_diff")}</p>}

      <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white overflow-x-auto" onScroll={() => tip && closeTip()}>
        <div style={{ minWidth: `${(n + 1) * 160}px` }}>
          <div className="grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: colTemplate }}>
            <div className="sticky left-0 bg-white" />
            {names.map((nm, i) => (
              <div key={i} className="px-3 py-4 min-w-0">
                <span className="text-[15px] font-bold leading-tight flex items-center gap-2 text-[#0B1120]"><Dot color={color(i)} />{nm}</span>
                {data.sides[i].insurer && <span className="block text-sm text-slate-500 mt-0.5 pl-5">{data.sides[i].insurer}</span>}
              </div>
            ))}
          </div>
          {blocks.map((b) => (
            <div key={b.id}>
              <div className="px-4 py-2.5 bg-[#FAFAF8] text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                {t(`compare_view.${b.id}`)}
              </div>
              {b.rows.map((row) => tableRow(row))}
            </div>
          ))}
        </div>
      </div>

      <div className="sm:hidden space-y-5">
        {blocks.map((b) => (
          <section key={b.id} className="space-y-3">
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-2">{t(`compare_view.${b.id}`)}</h3>
            {b.rows.map((row) => (
              <div key={row.key} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                {rowLabel(row)}
                <div className="grid grid-cols-2 gap-2">
                  {row.cells.map((_, i) => (
                    <div key={i} className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5 min-w-0"><Dot color={color(i)} /><span className="truncate">{names[i]}</span></span>
                      {chip(row, i)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => { setShowAll((v) => !v); closeTip(); }}
          aria-expanded={showAll}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-[15px] font-semibold text-slate-800 hover:border-slate-400"
        >
          {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showAll ? t("compare_view.show_less") : t("compare_view.show_more", { count: hiddenCount })}
        </button>
      )}

      {/* ── Same everywhere ── */}
      {same.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-[#0B1120]">{t("compare_view.same_h", { count: n })}</h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {same.map((r) => (
              <li key={r.key} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px]">
                <span className="block text-sm font-semibold text-[#0F766E]">{label(r.key, r.label)}</span>
                {plainDisplay(r.cells[0].display)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-slate-500 text-center">
        {t("compare_view.footer_1")} <span className="font-semibold">{t("compare_view.add_on")}</span> {t("compare_view.footer_2")}
      </p>

      {tip && (
        <div
          role="tooltip"
          className="fixed z-50 max-w-[300px] rounded-xl bg-[#0B1120] text-white px-3.5 py-3 text-sm leading-relaxed shadow-xl pointer-events-none"
          style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.below ? "0" : "-100%"})`, maxWidth: "min(300px, calc(100vw - 24px))" }}
        >
          <span className="block font-bold mb-0.5">{tip.title}</span>
          {tip.body}
        </div>
      )}
    </div>
  );

  function tableRow(row: ComparisonRow) {
    return (
      <div key={row.key} className="grid border-b border-slate-100 last:border-b-0" style={{ gridTemplateColumns: colTemplate }}>
        <div className="sticky left-0 z-[1] bg-white px-4 py-2 flex items-center">
          {rowLabel(row)}
        </div>
        {row.cells.map((_, i) => (
          <div key={i} className="px-2 py-2 flex items-center min-w-0">
            {chip(row, i)}
          </div>
        ))}
      </div>
    );
  }
}
