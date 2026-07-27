import { useRef, useState } from "react";
import {
  Scale, FileText, CheckCircle2, X, Loader2, AlertCircle, ArrowRight,
  Share2, Copy, Check, MessageCircle, Zap,
} from "lucide-react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { type CompareResponse, type ComparisonResult } from "@/lib/wordingProfile";
import ComparisonView, { TEAL, AMBER } from "@/components/ComparisonView";
import { isPlaygroundMode } from "@/lib/playground/mode";
import { DEMO_COMPARE_RESPONSE } from "@/lib/playground/seed";

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
function ShareBar({ data, profiles }: { data: ComparisonResult; profiles?: unknown }) {
  const [saving, setSaving] = useState(false);
  const [uuid, setUuid] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = uuid ? `${window.location.origin}/compare/report/${uuid}` : null;

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/compare/save-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: data, profiles }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not save");
      const json = await res.json();
      setUuid(json.uuid);
    } catch (e: any) {
      setErr(e.message || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  const waText = encodeURIComponent(
    `Namaste 🙏 Maine aapke liye 2 health insurance policies ka poora comparison taiyaar kiya hai. Yahan side-by-side dekhiye:\n${shareUrl ?? ""}`
  );

  if (!uuid) {
    return (
      <div>
        <button
          onClick={save}
          disabled={saving}
          className="w-full md:w-auto h-12 px-6 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
          {saving ? "Saving…" : "Save & share with customer"}
        </button>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#0D9488]/30 bg-[#F0FDFA] p-4 md:p-5">
      <p className="text-sm font-bold text-[#0f766e] mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" /> Saved — send this to your customer
      </p>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-12">
          <span className="text-sm text-slate-500 truncate flex-1">{shareUrl}</span>
          <button onClick={copy} className="text-slate-400 hover:text-[#0D9488] flex-shrink-0" aria-label="Copy link">
            {copied ? <Check className="h-5 w-5 text-[#0D9488]" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-12 px-5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-white font-bold flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <MessageCircle className="h-5 w-5" /> WhatsApp
        </a>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────────
export default function Compare() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<CompareResponse | null>(null);

  const canCompare = !!fileA && !!fileB && !loading;

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
        throw new Error(e.error || "Comparison failed");
      }
      setResponse(await res.json());
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
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
          <button onClick={reset} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
            ← Compare again
          </button>
        </div>
        <ShareBar data={response.result} profiles={response.profiles} />
        <ComparisonView data={response.result} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-11 w-11 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center">
          <Scale className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Compare Policies</h1>
          <p className="text-slate-500">Upload two policy wordings — we'll break them down side by side.</p>
        </div>
      </div>

      {/* Catalog shortcut — instant, no upload, no AI cost */}
      <Link
        href="/agent/compare/catalog"
        className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-[#0D9488]/30 bg-[#0D9488]/5 hover:bg-[#0D9488]/10 p-4 transition-colors group"
      >
        <div className="h-11 w-11 rounded-xl bg-[#0D9488] text-white flex items-center justify-center flex-shrink-0">
          <Zap className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800">Compare from the catalog — instant, no upload</p>
          <p className="text-sm text-slate-500">Pick any two pre-analysed plans. No PDF, no waiting.</p>
        </div>
        <ArrowRight className="h-5 w-5 text-[#0D9488] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
      </Link>

      <div className="relative my-6 text-center">
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
        <span className="relative bg-[#FAFAF8] px-3 text-xs font-bold uppercase tracking-widest text-slate-400">
          or upload wordings
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <UploadSlot side="a" label="Policy A" file={fileA} onPick={setFileA} onClear={() => setFileA(null)} disabled={loading} />
        <UploadSlot side="b" label="Policy B" file={fileB} onPick={setFileB} onClear={() => setFileB(null)} disabled={loading} />
      </div>

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleCompare}
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
    </div>
  );
}
