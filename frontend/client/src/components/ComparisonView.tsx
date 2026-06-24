import { CheckCircle2, Crown, AlertCircle } from "lucide-react";
import { type ComparisonResult, type ComparisonRow, sideName } from "@/lib/wordingProfile";

// Agent-portal palette (matches AgentLayout / CompareSample).
export const TEAL = "#0D9488";
export const AMBER = "#D97706";

function BetterPill({ accent }: { accent: string }) {
  return (
    <span
      className="ml-1 inline-flex items-center text-[10px] font-black uppercase tracking-wider text-white px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: accent }}
    >
      ✓ Better
    </span>
  );
}

// Marks a value only available as a paid optional add-on, not inbuilt.
function OptionalTag() {
  return (
    <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
      add-on
    </span>
  );
}

function MatrixRow({ row }: { row: ComparisonRow }) {
  const aWin = row.winner === "a";
  const bWin = row.winner === "b";
  return (
    <div className="grid grid-cols-[1.1fr_1fr_1fr] border-t border-slate-100">
      <div className="px-4 py-3.5 text-sm font-semibold text-slate-700 flex items-center">{row.label}</div>
      <div
        className={`px-4 py-3.5 text-sm flex flex-col justify-center ${aWin ? "font-semibold" : "text-slate-600"}`}
        style={aWin ? { backgroundColor: "#F0FDFA", color: TEAL } : undefined}
      >
        <span className="flex items-center flex-wrap gap-x-1">
          {row.a.display}
          {row.a.optional && <OptionalTag />}
          {aWin && <BetterPill accent={TEAL} />}
        </span>
        {row.a.note && <span className="text-[11px] text-slate-400 mt-0.5 font-normal">{row.a.note}</span>}
      </div>
      <div
        className={`px-4 py-3.5 text-sm flex flex-col justify-center ${bWin ? "font-semibold" : "text-slate-600"}`}
        style={bWin ? { backgroundColor: "#FFFBEB", color: AMBER } : undefined}
      >
        <span className="flex items-center flex-wrap gap-x-1">
          {row.b.display}
          {row.b.optional && <OptionalTag />}
          {bWin && <BetterPill accent={AMBER} />}
        </span>
        {row.b.note && <span className="text-[11px] text-slate-400 mt-0.5 font-normal">{row.b.note}</span>}
      </div>
    </div>
  );
}

export default function ComparisonView({ data }: { data: ComparisonResult }) {
  const nameA = sideName(data.a, "Policy A");
  const nameB = sideName(data.b, "Policy B");
  const v = data.verdict;
  const winnerName = v.winner === "a" ? nameA : v.winner === "b" ? nameB : null;
  const winAccent = v.winner === "a" ? TEAL : AMBER;

  return (
    <div className="space-y-8">
      {/* Verdict banner */}
      <div className="rounded-2xl bg-[#0B1120] text-white p-6 md:p-8">
        <p className="text-[11px] uppercase tracking-[0.2em] font-black text-[#5eead4] mb-2">Our verdict</p>
        {v.winner === "tie" ? (
          <h2 className="text-2xl font-black mb-1">It's a close call</h2>
        ) : (
          <h2 className="text-2xl md:text-3xl font-black mb-1 flex items-center gap-2 flex-wrap">
            <Crown className="h-7 w-7" style={{ color: winAccent }} />
            <span style={{ color: winAccent === TEAL ? "#5eead4" : "#fbbf24" }}>{winnerName}</span>
            <span className="text-slate-300 text-lg font-bold">is the stronger base plan</span>
          </h2>
        )}
        <p className="text-slate-400 text-sm mb-5">
          {v.wins_a + v.wins_b} clear differences · {v.ties} evenly matched
        </p>

        <div className="space-y-3 mb-6">
          {[
            { name: nameA, score: v.score_a, color: TEAL, light: "#5eead4" },
            { name: nameB, score: v.score_b, color: AMBER, light: "#fbbf24" },
          ].map((p) => (
            <div key={p.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold truncate pr-2" style={{ color: p.light }}>{p.name}</span>
                <span className="font-black tabular-nums" style={{ color: p.light }}>{p.score}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2.5">
                <div className="h-2.5 rounded-full transition-all" style={{ width: `${p.score}%`, backgroundColor: p.color }} />
              </div>
            </div>
          ))}
        </div>

        {v.reasons.length > 0 && (
          <div className="space-y-2">
            {v.reasons.map((r) => (
              <div key={r} className="flex items-start gap-2.5 text-sm text-slate-200">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: winAccent === TEAL ? "#5eead4" : "#fbbf24" }} />
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

      {/* Matrix */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-[1.1fr_1fr_1fr] bg-[#0B1120] text-white">
          <div className="px-4 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Parameter</div>
          <div className="px-4 py-4 text-sm font-bold" style={{ color: "#5eead4" }}>{nameA}</div>
          <div className="px-4 py-4 text-sm font-bold" style={{ color: "#fbbf24" }}>{nameB}</div>
        </div>
        {data.groups.filter((g) => g.rows.length > 0).map((g) => (
          <div key={g.group}>
            <div className="px-4 py-2 bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500 border-t border-slate-100">
              {g.label}
            </div>
            {g.rows.map((row) => <MatrixRow key={row.key} row={row} />)}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Compared on each plan's inbuilt base cover. Items marked <span className="font-semibold">add-on</span> need an optional rider. Always confirm critical clauses against the official policy wording.
      </p>
    </div>
  );
}
