import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { getApiBase } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { ConnectAgentDialog } from "@/components/app/ConnectAgentDialog";
import {
  Upload, FileText, ShieldCheck, LogOut, AlertCircle, Loader2, Lock, Pencil,
  Download, Bell, CalendarClock, PhoneCall, Sparkles, Check, Plus, ArrowRight,
} from "lucide-react";

// The four consumer lines of business. `type` is the value the backend meters
// and analyzes by ("Vehicle" is stored as motor to match the OCR lane).
const LOBS = [
  { type: "health", label: "Health", nudge: "Your family's biggest financial risk — everyone needs it." },
  { type: "term", label: "Term", nudge: "No term cover yet — the cheapest way to protect your family's income." },
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
  renewal_date: string | null;
  sum_insured: string | null;
  flaws: string[] | null;
  has_pdf: boolean;
  created_at: string;
};

type Portfolio = {
  plan: string;
  trialEndsAt: string;
  fullName: string | null;
  phone: string | null;
  renewalRemindersEnabled: boolean;
  hasOpenAgentRequest: boolean;
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

// Days until a YYYY-MM-DD date (negative = past). null when unset/unparseable.
const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  const t = new Date(d + "T00:00:00").getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400_000);
};
const fmtDate = (d: string | null) => {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

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

  // Renewal date editing + advisor dialog.
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectTopic, setConnectTopic] = useState<string>("review");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  async function saveRenewalDate(id: string) {
    const date = dateDraft; // "" clears it
    setEditingDateId(null);
    setData((d) =>
      d ? { ...d, policies: d.policies.map((p) => (p.id === id ? { ...p, renewal_date: date || null } : p)) } : d
    ); // optimistic
    try {
      await apiFetch(`/api/me/policy/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renewal_date: date }),
      });
    } catch { load(); }
  }

  async function toggleReminders(next: boolean) {
    setData((d) => (d ? { ...d, renewalRemindersEnabled: next } : d)); // optimistic
    try {
      await apiFetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renewal_reminders_enabled: next }),
      });
    } catch { load(); }
  }

  // Download the original stored file. The endpoint is auth-gated, so we fetch
  // the blob with the bearer token and trigger a client-side save.
  async function downloadPolicy(p: Policy) {
    setDownloadingId(p.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${getApiBase()}/api/me/policy/${p.id}/download`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Could not download this file.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = p.filename || "policy.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setUploadMsg(e.message || "Could not download this file.");
    } finally {
      setDownloadingId(null);
    }
  }

  function openConnect(topic: string) {
    setConnectTopic(topic);
    setConnectOpen(true);
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
  const firstName = data?.fullName?.trim().split(/\s+/)[0] ?? null;

  // Policies renewing within 30 days (needs a confirmed renewal_date).
  const expiringSoon = (data?.policies ?? [])
    .map((p) => ({ p, d: daysUntil(p.renewal_date) }))
    .filter((x) => x.d != null && (x.d as number) >= 0 && (x.d as number) <= 30)
    .sort((a, b) => (a.d as number) - (b.d as number));

  // Recommendations: which of the 4 lines are missing (nudge to add them).
  const presentTypes = new Set((data?.policies ?? []).filter((p) => p.status !== "error").map((p) => p.insurance_type));
  const missingLobs = LOBS.filter((l) => !presentTypes.has(l.type));
  // Top fixes: flaws aggregated across scored policies (health lane).
  const topFixes: { policy: string; flaw: string }[] = [];
  for (const p of data?.policies ?? []) {
    const label = p.nickname || p.insurer || labelFor(p.insurance_type);
    for (const f of (Array.isArray(p.flaws) ? p.flaws : [])) {
      if (typeof f === "string" && f.trim()) topFixes.push({ policy: label, flaw: f.trim() });
    }
  }
  const weakPolicies = (data?.policies ?? []).filter((p) => p.score != null && (p.score as number) < 50);
  const hasRecommendations = !isEmpty && (missingLobs.length > 0 || topFixes.length > 0 || weakPolicies.length > 0);

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
          <div className="flex items-center gap-4">
            <button
              onClick={() => openConnect("review")}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-teal-600)] hover:text-[var(--color-teal-400)] transition-colors"
            >
              <PhoneCall className="w-4 h-4" /> Talk to an advisor
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)] transition-colors"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
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

        {/* Expiring-soon banner */}
        {expiringSoon.length > 0 && (
          <section className="bg-amber-50 rounded-2xl border border-amber-200 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <CalendarClock className="w-5 h-5 text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-lg font-bold text-amber-900">
                  {expiringSoon.length === 1 ? "1 policy renews soon" : `${expiringSoon.length} policies renew soon`}
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {expiringSoon.map(({ p, d }) => (
                    <li key={p.id} className="text-sm text-amber-800 flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold">{p.nickname || p.insurer || labelFor(p.insurance_type)}</span>
                      <span>·</span>
                      <span>{(d as number) === 0 ? "renews today" : `renews in ${d} day${(d as number) === 1 ? "" : "s"}`} ({fmtDate(p.renewal_date)})</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => openConnect("renew")}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors"
                >
                  <PhoneCall className="w-4 h-4" /> Get help renewing
                </button>
              </div>
            </div>
          </section>
        )}

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
                {expiringSoon[0] && (
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Next renewal</span>
                    <p className="text-lg font-semibold text-[var(--color-navy-900)] mt-2">{fmtDate(expiringSoon[0].p.renewal_date)}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Renewal reminders toggle */}
        {data && !isEmpty && (
          <section className="bg-white rounded-2xl border border-[var(--color-border-light)] shadow-sm p-5 sm:p-6 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-[var(--color-teal-600)]/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-[var(--color-teal-600)]" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[var(--color-navy-900)]">Renewal reminders</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  We'll email you 30 days before a policy renews, so your cover never lapses.
                </p>
              </div>
            </div>
            <Switch
              checked={data.renewalRemindersEnabled}
              onCheckedChange={toggleReminders}
              aria-label="Toggle renewal reminders"
            />
          </section>
        )}

        {/* Recommendations — "Your next steps" */}
        {hasRecommendations && (
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[var(--color-navy-900)] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--color-teal-600)]" /> Your next steps
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Coverage checklist */}
              <div className="bg-white rounded-2xl border border-[var(--color-border-light)] shadow-sm p-5 sm:p-6">
                <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Coverage check</p>
                <div className="mt-3 space-y-2.5">
                  {LOBS.map((l) => {
                    const have = presentTypes.has(l.type);
                    return (
                      <div key={l.type} className="flex items-start gap-2.5">
                        <span className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${have ? "bg-[var(--color-teal-600)]/15 text-[var(--color-teal-600)]" : "bg-[var(--color-cream-dark)] text-[var(--color-text-muted)] border border-[var(--color-border-light)]"}`}>
                          {have ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0">
                          <span className={`text-sm font-semibold ${have ? "text-[var(--color-navy-900)]" : "text-[var(--color-text-secondary)]"}`}>
                            {l.label} cover {have && <span className="text-[var(--color-teal-600)] font-normal">· added</span>}
                          </span>
                          {!have && "nudge" in l && (l as any).nudge && (
                            <p className="text-xs text-[var(--color-text-muted)] leading-snug">
                              {(l as any).nudge}{" "}
                              <button
                                onClick={() => { setSelectedType(l.type); document.getElementById("add-policy")?.scrollIntoView({ behavior: "smooth" }); }}
                                className="font-semibold text-[var(--color-teal-600)] hover:underline"
                              >
                                Add it
                              </button>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top fixes + weak-cover nudge */}
              <div className="bg-white rounded-2xl border border-[var(--color-border-light)] shadow-sm p-5 sm:p-6">
                <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Worth fixing</p>
                {topFixes.length > 0 ? (
                  <ul className="mt-3 space-y-2.5">
                    {topFixes.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-gold-500)]" />
                        <span className="text-[var(--color-text-secondary)] leading-snug">
                          <span className="font-semibold text-[var(--color-navy-900)]">{f.policy}:</span> {f.flaw}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                    Nothing major flagged yet. Add more policies to get a fuller picture of your cover.
                  </p>
                )}
                {(weakPolicies.length > 0 || topFixes.length > 0) && (
                  <button
                    onClick={() => openConnect("review")}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-teal-600)] hover:underline"
                  >
                    Get a second opinion from an advisor <ArrowRight className="w-4 h-4" />
                  </button>
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

        {/* Upload your policies */}
        <section id="add-policy" className="space-y-4 scroll-mt-24">
          <div>
            <h2 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">Upload your policies here</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              Pick the type, then drop the policy PDF — we'll read it and audit it for you.
            </p>
          </div>

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
              const editingNick = editingNickId === p.id;
              const editingDate = editingDateId === p.id;
              const title = p.nickname || p.insurer || p.policy_name || p.filename || "Policy";
              const subtitle = p.nickname
                ? [p.insurer, p.policy_name].filter(Boolean).join(" · ")
                : (p.policy_name && p.insurer ? p.policy_name : null);
              return (
                <div
                  key={p.id}
                  className={`group bg-white rounded-2xl border border-[var(--color-border-light)] p-5 flex gap-4 shadow-sm transition-all ${
                    clickable && !editingNick && !editingDate ? "hover:border-[var(--color-teal-600)]/50 hover:shadow-md" : ""
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

                    {editingNick ? (
                      <input
                        autoFocus
                        value={nickDraft}
                        onChange={(e) => setNickDraft(e.target.value)}
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
                        <button
                          onClick={() => clickable && setLocation(`/app/policy/${p.id}`)}
                          className={`font-semibold text-[var(--color-navy-900)] truncate text-left ${clickable ? "hover:text-[var(--color-teal-600)] cursor-pointer" : "cursor-default"}`}
                          disabled={!clickable}
                        >
                          {title}
                        </button>
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

                    {!editingNick && subtitle && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{subtitle}</p>
                    )}

                    {/* Renewal date row (editable) */}
                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] pt-0.5">
                      <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                      {editingDate ? (
                        <input
                          autoFocus
                          type="date"
                          value={dateDraft}
                          onChange={(e) => setDateDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveRenewalDate(p.id); if (e.key === "Escape") setEditingDateId(null); }}
                          onBlur={() => saveRenewalDate(p.id)}
                          className="h-7 px-2 rounded-lg border border-[var(--color-border-medium)] bg-white text-xs font-medium focus:border-[var(--color-teal-600)] outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => { setDateDraft(p.renewal_date ?? ""); setEditingDateId(p.id); }}
                          className="hover:text-[var(--color-teal-600)] hover:underline"
                        >
                          {p.renewal_date ? `Renews ${fmtDate(p.renewal_date)}` : "Set renewal date"}
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1.5">
                      {p.has_pdf && (
                        <button
                          onClick={() => downloadPolicy(p)}
                          disabled={downloadingId === p.id}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-teal-600)] transition-colors disabled:opacity-50"
                        >
                          {downloadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          Download
                        </button>
                      )}
                      {clickable && (
                        <button
                          onClick={() => setLocation(`/app/policy/${p.id}`)}
                          className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal-600)] hover:underline"
                        >
                          View report <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {p.status === "error" && <span className="ml-auto text-xs text-red-500">Couldn't read this PDF</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </section>
        )}

        {/* Talk-to-advisor footer CTA */}
        {data && (
          <section className="bg-[var(--color-navy-900)] rounded-2xl p-6 sm:p-8 text-center">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
              {data.hasOpenAgentRequest ? "An advisor will reach out to you soon" : "Want a real person to help?"}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-white-muted)] max-w-md mx-auto leading-relaxed">
              {data.hasOpenAgentRequest
                ? "We've got your request. A licensed advisor will call you on the number you shared — no obligation."
                : "Talk to a licensed advisor about renewing, buying, or fixing your cover. No pressure, no spam."}
            </p>
            {!data.hasOpenAgentRequest && (
              <button
                onClick={() => openConnect("review")}
                className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-teal-600)] text-white font-bold hover:bg-[var(--color-teal-400)] transition-colors"
              >
                <PhoneCall className="w-4 h-4" /> Connect me to an advisor
              </button>
            )}
          </section>
        )}

        <div className="flex items-center justify-center gap-2 text-[var(--color-text-muted)] text-xs font-semibold pt-2">
          <ShieldCheck className="w-4 h-4 text-[var(--color-teal-600)]" /> Private to your account. We only contact you if you ask us to.
        </div>
      </main>

      <ConnectAgentDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        defaultName={data?.fullName ?? null}
        defaultPhone={data?.phone ?? null}
        defaultTopic={connectTopic}
        onSubmitted={load}
      />
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
