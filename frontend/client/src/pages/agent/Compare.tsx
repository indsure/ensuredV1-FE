import { useRef, useState } from "react";
import {
  Scale, FileText, CheckCircle2, X, Loader2, AlertCircle, ArrowRight,
  Share2, Copy, Check, MessageCircle, ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import ComparisonShareBar from "@/components/agent/ComparisonShareBar";
import { type CompareResponse, type ComparisonResult } from "@/lib/wordingProfile";
import ComparisonView, { TEAL, AMBER } from "@/components/ComparisonView";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useAgent } from "@/context/AgentContext";
import { isPlaygroundMode } from "@/lib/playground/mode";
import { DEMO_COMPARE_RESPONSE } from "@/lib/playground/seed";

// Must match COMPARE_COST in the /api/agent/compare route: one Gemini call per
// uploaded wording. The catalog lane spends nothing and is priced nowhere.
const COMPARE_COST = 2;

// ─── Upload slot ────────────────────────────────────────────────────────────────
function UploadSlot({
  side, label, file, onPick, onClear, disabled,
}: {
  side: "a" | "b";
  label: string;
  file: File | null;
  onPick: (f: File) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accent = side === "a" ? TEAL : AMBER;

  return (
    <div
      className={`relative rounded-2xl border-2 p-6 transition-all ${file ? "bg-white shadow-sm" : "border-dashed bg-white/60"}`}
      style={{ borderColor: file ? accent : "#CBD5E1" }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: accent }}>
          {label}
        </span>
      </div>

      {file ? (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: accent }}>
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-800 truncate">{file.name}</p>
            <p className="text-sm text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          {!disabled && (
            <button
              onClick={onClear}
              className="h-8 w-8 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-400 flex items-center justify-center flex-shrink-0 transition-colors"
              aria-label="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="w-full flex flex-col items-center justify-center gap-3 py-6 text-slate-400 hover:text-slate-600 disabled:opacity-50"
        >
          <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
            <FileText className="h-7 w-7" />
          </div>
          <span className="font-semibold text-slate-600">Choose policy wording PDF</span>
          <span className="text-sm">Tap to browse</span>
        </button>
      )}
    </div>
  );
}

// ─── Save / share bar ─────────────────────────────────────────────────────────────
// ─── Page ────────────────────────────────────────────────────────────────────────
export default function Compare() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<CompareResponse | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmSpend, setConfirmSpend] = useState(false);

  // The balance is read once at login. It arrives a beat after first paint, so
  // "0 left" is not trusted until loading is done - otherwise the button locks
  // itself for a moment on every visit. The server checks it again regardless.
  const { creditsRemaining, loading: agentLoading, refresh: refreshAgent } = useAgent();
  const balanceKnown = !agentLoading;
  const shortOfChecks = balanceKnown && creditsRemaining < COMPARE_COST;

  const canCompare = !!fileA && !!fileB && !loading && !shortOfChecks;

  async function handleCompare() {
    if (!fileA || !fileB) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("wording_a", fileA);
      fd.append("wording_b", fileB);
      const res = await apiFetch("/api/agent/compare", { method: "POST", body: fd });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: "Comparison failed" }));
        // The balance gate speaks for itself; anything else keeps its own text.
        throw new Error(e.message || e.error || "Comparison failed");
      }
      setResponse(await res.json());
      // Two checks just left the balance the header and dashboard show.
      refreshAgent();
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // The comparison lives in component state only. Clearing it throws away a
  // 20-40 second run that cost a paid call, so ask first rather than losing it
  // to a mis-tap on a small link.
  function reset() {
    if (response && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    setResponse(null);
    setFileA(null);
    setFileB(null);
    setError(null);
  }

  if (response) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Head-to-Head</h1>
          {confirmDiscard ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-sm text-slate-700">Discard this comparison?</span>
              <button onClick={reset} className="text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded">
                Discard
              </button>
              <button onClick={() => setConfirmDiscard(false)} className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-2">
                Keep
              </button>
            </span>
          ) : (
            <button onClick={reset} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
              ← Compare again
            </button>
          )}
        </div>
        {confirmDiscard && (
          <p className="text-sm text-slate-600">
            Save or share it first if you need it — it is not stored anywhere yet.
          </p>
        )}
        <ComparisonShareBar data={response.result} profiles={response.profiles} />
        <ComparisonView data={response.result} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/agent/compare"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the catalog (free)
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="h-11 w-11 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center">
          <Scale className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Compare Quotes</h1>
          <p className="text-slate-500">
            For a plan the catalog does not carry. Upload both wordings and we read every clause.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <UploadSlot side="a" label="Policy A" file={fileA} onPick={setFileA} onClear={() => setFileA(null)} disabled={loading} />
        <UploadSlot side="b" label="Policy B" file={fileB} onPick={setFileB} onClear={() => setFileB(null)} disabled={loading} />
      </div>

      {shortOfChecks ? (
        <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <p className="font-bold">
            You need {COMPARE_COST} policy checks to compare uploads. You have {creditsRemaining}.
          </p>
          <p className="mt-1">
            <Link href="/agent/compare" className="underline font-semibold">Comparing from the catalog</Link>{" "}
            is free and instant, or ask your admin to top up.
          </p>
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-500">
          Uses <span className="font-bold text-slate-700">{COMPARE_COST} policy checks</span>, one for each wording we read.
          {balanceKnown && <> You have {creditsRemaining} left.</>}
        </p>
      )}

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={() => setConfirmSpend(true)}
        disabled={!canCompare}
        className="mt-6 w-full h-14 rounded-2xl bg-[#0B1120] hover:bg-[#1e293b] text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Reading both wordings…</>
        ) : (
          <>Compare side by side <ArrowRight className="h-5 w-5" /></>
        )}
      </button>

      {loading && (
        <p className="mt-3 text-center text-sm text-slate-400">
          This takes about 20–40 seconds. We read every clause so you don't have to.
        </p>
      )}

      {/* Playground: skip the upload and show a worked example instantly. */}
      {isPlaygroundMode() && !loading && (
        <button
          onClick={() => setResponse(DEMO_COMPARE_RESPONSE as unknown as CompareResponse)}
          className="mt-3 w-full h-12 rounded-2xl border-2 border-[#0D9488] text-[#0D9488] font-bold flex items-center justify-center gap-2 hover:bg-[#0D9488] hover:text-white transition-colors"
        >
          See a sample comparison — no upload needed
        </button>
      )}

      {/* Last stop before the spend. The price is on the card that got them
          here and on the line above the button; this is where they agree to it. */}
      <ConfirmationDialog
        open={confirmSpend}
        onOpenChange={setConfirmSpend}
        onConfirm={handleCompare}
        title={`Use ${COMPARE_COST} policy checks?`}
        description={
          `Reading both uploaded wordings uses ${COMPARE_COST} of your policy checks` +
          (balanceKnown ? `, leaving you ${Math.max(creditsRemaining - COMPARE_COST, 0)}. ` : ". ") +
          "Comparing plans from the catalog stays free."
        }
        confirmText={`Use ${COMPARE_COST} checks`}
        cancelText="Not now"
      />
    </div>
  );
}
