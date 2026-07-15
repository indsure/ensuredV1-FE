import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import {
  Upload, FileText, ShieldCheck, LogOut, AlertCircle, Loader2, Lock, Pencil,
} from "lucide-react";

// The four consumer lines of business. `type` is the value the backend meters
// and analyzes by ("Vehicle" is stored as motor to match the OCR lane).
const LOBS = [
  { type: "health", label: "Health", scoring: true },
  { type: "term", label: "Term" },
  { type: "life", label: "Life" },
  { type: "motor", label: "Vehicle" },
] as const;

type Policy = {
  id: string;
  insurance_type: string;
  status: string;
  filename: string | null;
  insurer: string | null;
  policy_name: string | null;
  nickname: string | null;
  score: number | null;
  expiry_date: string | null;
  sum_insured: string | null;
  created_at: string;
};

type Portfolio = {
  plan: string;
  trialEndsAt: string;
  fullName: string | null;
  freeSlotsPerType: number;
  slotsUsedByType: Record<string, number>;
  policies: Policy[];
};

const labelFor = (t: string) => LOBS.find((l) => l.type === t)?.label ?? t;

// Score bands, in the site's light palette: teal / gold / red.
const scoreClasses = (s: number) =>
  s >= 75
    ? { text: "text-[var(--color-teal-600)]", tile: "bg-[var(--color-teal-600)]/10 border-[var(--color-teal-600)]/20" }
    : s >= 50
      ? { text: "text-[var(--color-gold-500)]", tile: "bg-[var(--color-gold-500)]/10 border-[var(--color-gold-500)]/20" }
      : { text: "text-red-600", tile: "bg-red-50 border-red-200" };
const scoreVerdict = (s: number) => (s >= 75 ? "Strong cover" : s >= 50 ? "Decent, has gaps" : "Needs attention");

export default function PortfolioPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<Portfolio | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("health");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Personal touches: inline name + per-policy nickname editing.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [editingNickId, setEditingNickId] = useState<string | null>(null);
  const [nickDraft, setNickDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/me/portfolio");
      if (!res.ok) throw new Error(`Failed to load portfolio (${res.status})`);
      setData(await res.json());
      setLoadErr(null);
    } catch (e: any) {
      setLoadErr(e.message || "Failed to load portfolio");
    }
  }, []);

  useEffect(() => {
    document.title = "My Portfolio — IndSure";
    load();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  async function signOut() {
    await supabase.auth.signOut();
    setLocation("/login");
  }

  async function saveName() {
    const name = nameDraft.trim();
    setEditingName(false);
    setData((d) => (d ? { ...d, fullName: name || null } : d)); // optimistic
    try {
      await apiFetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name }),
      });
    } catch { load(); /* re-sync on failure */ }
  }

  async function saveNick(id: string) {
    const nickname = nickDraft.trim();
    setEditingNickId(null);
    setData((d) =>
      d ? { ...d, policies: d.policies.map((p) => (p.id === id ? { ...p, nickname: nickname || null } : p)) } : d
    ); // optimistic
    try {
      await apiFetch(`/api/me/policy/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
    } catch { load(); }
  }

  const pollStatus = useCallback((jobId: string) => {
    const started = Date.now();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (Date.now() - started > 300_000) {
        if (pollRef.current) clearInterval(pollRef.current);
        setUploading(false);
        setUploadMsg("Analysis timed out. Please try again.");
        return;
      }
      try {
        const res = await apiFetch(`/api/me/analyze/status/${jobId}`);
        const s = await res.json();
        if (s.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setUploading(false);
          setUploadMsg("Analysis complete.");
          load();
        } else if (s.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          setUploading(false);
          setUploadMsg(s.error || "Analysis failed.");
        }
      } catch { /* transient; keep polling */ }
    }, 3000);
  }, [load]);

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    if (file.size > 25 * 1024 * 1024) {
      setUploadMsg("File is too large. Max 25MB.");
      return;
    }
    setUploading(true);
    setUploadMsg("Uploading & analyzing…");
    setPaywall(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", selectedType);
      const res = await apiFetch("/api/me/analyze", { method: "POST", body: form });
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        setUploading(false);
        setUploadMsg(null);
        setPaywall(
          body.reason === "trial_expired"
            ? "Your 30-day free trial has ended. Upgrade to analyze more policies."
            : `You've used your free ${labelFor(selectedType)} slot. Upgrade to add more.`
        );
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload failed (${res.status})`);
      }
      const { jobId } = await res.json();
      load(); // show the pending row immediately
      pollStatus(jobId);
    } catch (e: any) {
      setUploading(false);
      setUploadMsg(e.message || "Upload failed.");
    }
  }, [selectedType, load, pollStatus]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploading,
  });

  const trialDaysLeft = data
    ? Math.max(0, Math.ceil((new Date(data.trialEndsAt).getTime() - Date.now()) / 86400_000))
    : 0;

  const isEmpty = !!data && data.policies.length === 0;
  const scored = data?.policies.filter((p) => p.score != null) ?? [];
  const avgScore = scored.length
    ? Math.round(scored.reduce((a, p) => a + (p.score as number), 0) / scored.length)
    : null;
  const nextExpiry = data?.policies
    .filter((p) => p.expiry_date)
    .map((p) => p.expiry_date as string)
    .sort()[0] ?? null;
  const firstName = data?.fullName?.trim().split(/\s+/)[0] ?? null;

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] text-[var(--color-text-main)] overflow-x-clip">
      {/* App bar */}
      <header className="sticky top-0 z-20 border-b border-[var(--color-border-light)] bg-white/70 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="IndSure" className="h-8 w-auto" />
            <span className="hidden sm:inline text-[var(--color-border-medium)]">/</span>
            <span className="hidden sm:inline text-sm font-semibold text-[var(--color-text-secondary)]">Portfolio</span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)] transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-6 py-8 sm:py-10 space-y-8 pb-24">

        {/* Greeting + trial pill */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-tight text-[var(--color-navy-900)]">
              {firstName ? <>Hey {firstName} — your cover, <span className="italic text-[var(--color-teal-600)]">decoded.</span></>
                         : <>Your cover, <span className="italic text-[var(--color-teal-600)]">decoded.</span></>}
            </h1>
            <div className="mt-1.5 flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
              <span>Every policy audited, every gap surfaced — private to you.</span>
              {data && !editingName && (
                <button
                  onClick={() => { setNameDraft(data.fullName ?? ""); setEditingName(true); }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal-600)] hover:underline whitespace-nowrap"
                >
                  <Pencil className="w-3 h-3" />
                  {firstName ? "Edit name" : "Add your name"}
                </button>
              )}
            </div>
            {editingName && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  onBlur={saveName}
                  maxLength={80}
                  placeholder="Your name"
                  className="h-9 px-3 rounded-lg border border-[var(--color-border-medium)] bg-white text-sm font-medium focus:border-[var(--color-teal-600)] outline-none"
                />
                <span className="text-xs text-[var(--color-text-muted)]">Enter to save · Esc to cancel</span>
              </div>
            )}
          </div>
          {data && (
            <span className="inline-flex items-center rounded-full bg-[var(--color-teal-600)]/10 px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-widest text-[var(--color-teal-600)]">
              {data.plan === "paid" ? "Paid · unlimited" : `Free trial · ${trialDaysLeft} days left`}
            </span>
          )}
        </div>

        {/* Portfolio health hero */}
        {!isEmpty && avgScore != null && (
          <section className="bg-white rounded-2xl border border-[var(--color-border-light)] border-t-4 border-t-[var(--color-teal-600)] shadow-sm p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-10 items-center">
              <div className="sm:border-r sm:border-[var(--color-border-light)] sm:pr-8">
                <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Portfolio health</span>
                <div className={`text-7xl font-serif font-bold mt-2 mb-1 ${scoreClasses(avgScore).text}`}>{avgScore}</div>
                <p className={`text-sm font-medium ${scoreClasses(avgScore).text}`}>{scoreVerdict(avgScore)}</p>
              </div>
              <div className="sm:col-span-2 grid grid-cols-2 gap-6">
                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Policies</span>
                  <p className="text-3xl font-serif font-bold text-[var(--color-navy-900)] mt-1">{data!.policies.length}</p>
                </div>
                {nextExpiry && (
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Next renewal</span>
                    <p className="text-lg font-semibold text-[var(--color-navy-900)] mt-2">{nextExpiry}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* First-run welcome */}
        {isEmpty && (
          <section className="bg-white rounded-2xl border border-[var(--color-border-light)] border-t-4 border-t-[var(--color-teal-600)] shadow-sm p-8 sm:p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--color-teal-600)]/10 flex items-center justify-center">
              <FileText className="w-7 h-7 text-[var(--color-teal-600)]" />
            </div>
            <h2 className="mt-5 font-serif text-2xl font-bold text-[var(--color-navy-900)]">Let's decode your first policy</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
              Pick a type, drop the PDF, and get an unbiased audit in about a minute.
              One free policy each for Health, Term, Life &amp; Vehicle.
            </p>
            <p className="mt-3 text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-teal-600)]" /> No calls, no spam — your policies stay private to you.
            </p>
          </section>
        )}

        {/* Add a policy */}
        <section className="space-y-4">
          <h2 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">{isEmpty ? "Add your first policy" : "Add a policy"}</h2>

          <div className="flex flex-wrap gap-2">
            {LOBS.map((l) => {
              const used = data?.slotsUsedByType?.[l.type] ?? 0;
              const full = data?.plan !== "paid" && used >= (data?.freeSlotsPerType ?? 1);
              const active = selectedType === l.type;
              return (
                <button
                  key={l.type}
                  onClick={() => setSelectedType(l.type)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all flex items-center gap-1.5 ${
                    active
                      ? "bg-[var(--color-teal-600)] text-white border-[var(--color-teal-600)] shadow-sm"
                      : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)]"
                  }`}
                >
                  {l.label}
                  {full && <Lock className="w-3 h-3 opacity-60" />}
                </button>
              );
            })}
          </div>

          <div
            {...getRootProps()}
            className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all bg-white ${
              isDragActive
                ? "border-[var(--color-teal-600)] bg-[var(--color-teal-600)]/5"
                : "border-[var(--color-border-medium)] hover:border-[var(--color-teal-600)]"
            } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <Loader2 className="w-8 h-8 mx-auto text-[var(--color-teal-600)] animate-spin" />
            ) : (
              <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-cream-dark)] border border-[var(--color-border-light)] flex items-center justify-center">
                <Upload className="w-5 h-5 text-[var(--color-teal-600)]" />
              </div>
            )}
            <p className="mt-4 font-serif text-lg font-bold text-[var(--color-navy-900)]">
              Drop your <span className="text-[var(--color-teal-600)]">{labelFor(selectedType)}</span> policy PDF here
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-widest">or click to browse · max 25MB</p>
          </div>

          {uploadMsg && (
            <p className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[var(--color-teal-600)]" /> {uploadMsg}
            </p>
          )}
          {paywall && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" /> {paywall}
            </div>
          )}
        </section>

        {/* Policy list */}
        {loadErr && (
          <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {loadErr}</p>
        )}
        {data && data.policies.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">Your policies</h2>
            <div className="grid gap-4 sm:grid-cols-2">
            {data.policies.map((p) => {
              const done = p.status === "done";
              const clickable = done && p.insurance_type === "health"; // report view is the health audit
              const editing = editingNickId === p.id;
              const title = p.nickname || p.insurer || p.policy_name || p.filename || "Policy";
              const subtitle = p.nickname
                ? [p.insurer, p.policy_name].filter(Boolean).join(" · ")
                : (p.policy_name && p.insurer ? p.policy_name : null);
              return (
                <div
                  key={p.id}
                  onClick={() => clickable && !editing && setLocation(`/app/policy/${p.id}`)}
                  className={`group bg-white rounded-2xl border border-[var(--color-border-light)] p-5 flex gap-4 shadow-sm transition-all ${
                    clickable && !editing ? "cursor-pointer hover:border-[var(--color-teal-600)]/50 hover:shadow-md" : ""
                  }`}
                >
                  {/* Score tile */}
                  {p.score != null ? (
                    <div className={`shrink-0 w-16 h-16 rounded-xl border flex flex-col items-center justify-center ${scoreClasses(p.score).tile}`}>
                      <span className={`text-2xl font-serif font-bold leading-none ${scoreClasses(p.score).text}`}>{p.score}</span>
                      <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mt-0.5">score</span>
                    </div>
                  ) : (
                    <div className="shrink-0 w-16 h-16 rounded-xl bg-[var(--color-cream-dark)] border border-[var(--color-border-light)] flex items-center justify-center">
                      {p.status === "processing" || p.status === "pending"
                        ? <Loader2 className="w-5 h-5 text-[var(--color-teal-600)] animate-spin" />
                        : <FileText className="w-5 h-5 text-[var(--color-text-muted)]" />}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--color-teal-600)]">{labelFor(p.insurance_type)}</span>
                      <StatusPill status={p.status} />
                    </div>

                    {editing ? (
                      <input
                        autoFocus
                        value={nickDraft}
                        onChange={(e) => setNickDraft(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveNick(p.id);
                          if (e.key === "Escape") setEditingNickId(null);
                        }}
                        onBlur={() => saveNick(p.id)}
                        maxLength={60}
                        placeholder="Name this policy (e.g. Papa's health plan)"
                        className="w-full h-8 px-2 rounded-lg border border-[var(--color-border-medium)] bg-white text-sm font-medium focus:border-[var(--color-teal-600)] outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-semibold text-[var(--color-navy-900)] truncate">{title}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setNickDraft(p.nickname ?? ""); setEditingNickId(p.id); }}
                          className="shrink-0 p-0.5 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--color-teal-600)] transition-opacity"
                          aria-label="Rename policy"
                          title="Rename"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {!editing && subtitle && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{subtitle}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] pt-0.5">
                      {p.expiry_date && <span>Expires {p.expiry_date}</span>}
                      {clickable && !editing && (
                        <span className="ml-auto font-semibold text-[var(--color-teal-600)] group-hover:underline whitespace-nowrap">View report →</span>
                      )}
                      {p.status === "error" && <span className="ml-auto text-red-500">Couldn't read this PDF</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </section>
        )}

        <div className="flex items-center justify-center gap-2 text-[var(--color-text-muted)] text-xs font-semibold pt-6">
          <ShieldCheck className="w-4 h-4 text-[var(--color-teal-600)]" /> Private to your account. No calls, no spam, ever.
        </div>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: "bg-emerald-50 text-emerald-700 border-emerald-200",
    processing: "bg-sky-50 text-sky-700 border-sky-200",
    pending: "bg-[var(--color-cream-dark)] text-[var(--color-text-muted)] border-[var(--color-border-light)]",
    error: "bg-red-50 text-red-700 border-red-200",
  };
  const label = status === "done" ? "Ready" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? map.pending}`}>{label}</span>;
}
