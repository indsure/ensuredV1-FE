import { CheckCircle2, Crown, AlertCircle, Check } from "lucide-react";
import { type ComparisonResult, type ComparisonRow, sideName } from "@/lib/wordingProfile";

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

function OptionalTag() {
  return (
    <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
      add-on
    </span>
  );
}

function MatrixRow({ row, n }: { row: ComparisonRow; n: number }) {
  return (
    <div
      className="grid border-t border-slate-100"
      style={{ gridTemplateColumns: `minmax(130px,1.2fr) repeat(${n}, minmax(120px,1fr))` }}
    >
      <div className="px-4 py-3 text-sm font-semibold text-slate-700 flex items-center bg-slate-50/40">
        {row.label}
      </div>
      {row.cells.map((c, i) => {
        const pal = SIDE_PALETTE[i % SIDE_PALETTE.length];
        return (
          <div
            key={i}
            className={`px-4 py-3 text-sm flex flex-col justify-center ${c.winner ? "font-semibold" : "text-slate-600"}`}
            style={c.winner ? { backgroundColor: pal.tint, color: pal.accent } : undefined}
          >
            <span className="flex items-center flex-wrap gap-x-1">
              {c.winner && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: pal.accent }} />}
              {c.display}
              {c.optional && <OptionalTag />}
            </span>
            {c.note && <span className="text-[11px] text-slate-400 mt-0.5 font-normal">{c.note}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function ComparisonView({ data }: { data: ComparisonResult }) {
  const n = data.sides.length;
  const v = data.verdict;
  const names = data.sides.map((s, i) => sideName(s, `Plan ${i + 1}`));

  return (
    <div className="space-y-8">
      {/* Verdict banner */}
      <div className="rounded-2xl bg-[#0B1120] text-white p-6 md:p-8">
        <p className="text-[11px] uppercase tracking-[0.2em] font-black text-[#5eead4] mb-2">Our verdict</p>
        {v.winner_index < 0 ? (
          <h2 className="text-2xl font-black mb-1">It's a close call</h2>
        ) : (
          <h2 className="text-2xl md:text-3xl font-black mb-1 flex items-center gap-2 flex-wrap">
            <Crown className="h-7 w-7" style={{ color: SIDE_PALETTE[v.winner_index % SIDE_PALETTE.length].accent }} />
            <span style={{ color: SIDE_PALETTE[v.winner_index % SIDE_PALETTE.length].light }}>{v.winner_name}</span>
            <span className="text-slate-300 text-lg font-bold">is the stronger base plan</span>
          </h2>
        )}
        <p className="text-slate-400 text-sm mb-5">{n} plans compared on inbuilt base cover</p>

        {/* Score bars */}
        <div className="space-y-3 mb-6">
          {data.sides.map((s, i) => {
            const pal = SIDE_PALETTE[i % SIDE_PALETTE.length];
            return (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold truncate pr-2" style={{ color: pal.light }}>{names[i]}</span>
                  <span className="font-black tabular-nums" style={{ color: pal.light }}>{v.scores[i]}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2.5">
                  <div className="h-2.5 rounded-full transition-all" style={{ width: `${v.scores[i]}%`, backgroundColor: pal.accent }} />
                </div>
              </div>
            );
          })}
        </div>

        {v.reasons.length > 0 && (
          <div className="space-y-2">
            {v.reasons.map((r) => (
              <div key={r} className="flex items-start gap-2.5 text-sm text-slate-200">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: v.winner_index >= 0 ? SIDE_PALETTE[v.winner_index % SIDE_PALETTE.length].light : "#5eead4" }} />
                <span>{r}</span>
              </div>
            ))}
          </div>
        )}

        {v.counterpoint && (
          <div className="mt-5 rounded-xl bg-white/5 border border-white/10 p-3.5 text-sm text-slate-300 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-400" />
            <span><span className="font-semibold text-white">But:</span> {v.counterpoint}</span>
          </div>
        )}
      </div>

      {/* Matrix (horizontally scrollable for 3–4 plans) */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <div style={{ minWidth: `${(n + 1) * 150}px` }}>
          {/* Header */}
          <div className="grid bg-[#0B1120] text-white" style={{ gridTemplateColumns: `minmax(130px,1.2fr) repeat(${n}, minmax(120px,1fr))` }}>
            <div className="px-4 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Parameter</div>
            {names.map((nm, i) => (
              <div key={i} className="px-4 py-4 text-sm font-bold leading-tight" style={{ color: SIDE_PALETTE[i % SIDE_PALETTE.length].light }}>
                {nm}
                <span className="block text-[10px] font-medium text-slate-400 mt-0.5">{data.sides[i].insurer}</span>
              </div>
            ))}
          </div>

          {data.groups.filter((g) => g.rows.length > 0).map((g) => (
            <div key={g.group}>
              <div className="px-4 py-2 bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500 border-t border-slate-100">
                {g.label}
              </div>
              {g.rows.map((row) => <MatrixRow key={row.key} row={row} n={n} />)}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Compared on each plan's inbuilt base cover. Items marked <span className="font-semibold">add-on</span> need an optional rider. Always confirm critical clauses against the official policy wording.
      </p>
    </div>
  );
}
