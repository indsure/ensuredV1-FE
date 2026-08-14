import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { getApiBase } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConnectAgentDialog } from "@/components/app/ConnectAgentDialog";
import { ScoreRing, Meter } from "@/components/app/ScoreRing";
import { PolicyCard } from "@/components/app/PolicyCard";
import type { Policy, Portfolio } from "@/components/app/portfolio-types";
import {
  LOBS, advisorTel, advisorWa, daysUntil, fmtDate, formatINRShort, labelFor, lobFor,
  parseSumInsured, renewalPhrase, scoreClasses, scoreMeaning, scoreVerdict,
} from "@/components/app/portfolio-utils";
import {
  Upload, FileText, ShieldCheck, LogOut, AlertCircle, Loader2, Lock, Pencil, Bell,
  CalendarClock, PhoneCall, Sparkles, Check, Plus, ArrowRight, MessageCircle,
  ChevronDown, Heart, Zap, TrendingUp, X,
} from "lucide-react";

type SortKey = "recent" | "score" | "renewal";

export default function PortfolioPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [data, setData] = useState<Portfolio | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Upload lane
  const [selectedType, setSelectedType] = useState<string>("health");
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // View state — this is what turns the page from a document into an app.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [addOpen, setAddOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Profile name editing
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectTopic, setConnectTopic] = useState<string>("review");

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

  // Open the add panel automatically for a brand-new account — there's nothing
  // else to do on the page yet.
  useEffect(() => {
    if (data && data.policies.length === 0) setAddOpen(true);
  }, [data?.policies.length]);

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

  const saveNick = useCallback(async (id: string, nickname: string) => {
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
  }, [load]);

  const saveRenewalDate = useCallback(async (id: string, date: string) => {
    setData((d) =>
      d ? { ...d, policies: d.policies.map((p) => (p.id === id ? { ...p, renewal_date: date || null } : p)) } : d
    ); // optimistic
    try {
      await apiFetch(`/api/me/policy/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renewal_date: date }),
      });
      if (date) toast({ title: "Renewal date saved", description: "We'll remind you 30 days before.", variant: "success" });
    } catch { load(); }
  }, [load, toast]);

  async function toggleReminders(next: boolean) {
    setData((d) => (d ? { ...d, renewalRemindersEnabled: next } : d)); // optimistic
    try {
      await apiFetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renewal_reminders_enabled: next }),
      });
      toast({
        title: next ? "Reminders on" : "Reminders off",
        description: next
          ? "We'll email you 30 days before each renewal."
          : "You won't get renewal emails from us.",
        variant: next ? "success" : "default",
      });
    } catch { load(); }
  }

  // Download the original stored file. The endpoint is auth-gated, so we fetch
  // the blob with the bearer token and trigger a client-side save.
  const downloadPolicy = useCallback(async (p: Policy) => {
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
      toast({ title: "Download failed", description: e.message || "Could not download this file.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  }, [toast]);

  const openConnect = useCallback((topic: string) => {
    setConnectTopic(topic);
    setConnectOpen(true);
  }, []);

  const openAdd = useCallback((type?: string) => {
    if (type) setSelectedType(type);
    setAddOpen(true);
    // Wait a frame so the panel is in the DOM before we scroll to it.
    requestAnimationFrame(() =>
      document.getElementById("add-policy")?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  }, []);

  const pollStatus = useCallback((jobId: string) => {
    const started = Date.now();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (Date.now() - started > 300_000) {
        if (pollRef.current) clearInterval(pollRef.current);
        setUploading(false);
        setUploadStage(null);
        toast({ title: "Analysis timed out", description: "Please try uploading again.", variant: "destructive" });
        return;
      }
      try {
        const res = await apiFetch(`/api/me/analyze/status/${jobId}`);
        const s = await res.json();
        if (s.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setUploading(false);
          setUploadStage(null);
          setAddOpen(false);
          toast({ title: "Policy decoded", description: "Your audit is ready — open the card to see it.", variant: "success" });
          load();
        } else if (s.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          setUploading(false);
          setUploadStage(null);
          toast({ title: "We couldn't read that PDF", description: s.error || "Try a clearer, non-scanned copy.", variant: "destructive" });
          load();
        } else {
          // Real backend states, not a fake progress bar.
          setUploadStage(s.status === "pending" ? "In the queue…" : "Reading the fine print…");
        }
      } catch { /* transient; keep polling */ }
    }, 3000);
  }, [load, toast]);

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "File is too large", description: "Maximum size is 25MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    setUploadStage("Uploading your PDF…");
    setPaywall(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", selectedType);
      const res = await apiFetch("/api/me/analyze", { method: "POST", body: form });
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        setUploading(false);
        setUploadStage(null);
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
      setUploadStage("In the queue…");
      load(); // show the pending row immediately
      pollStatus(jobId);
    } catch (e: any) {
      setUploading(false);
      setUploadStage(null);
      toast({ title: "Upload failed", description: e.message || "Please try again.", variant: "destructive" });
    }
  }, [selectedType, load, pollStatus, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploading,
  });

  /* ── Derived portfolio state ───────────────────────────────────────── */

  const d = useMemo(() => {
    const policies = data?.policies ?? [];
    const live = policies.filter((p) => p.status !== "error");
    const scored = policies.filter((p) => p.score != null);
    const avgScore = scored.length
      ? Math.round(scored.reduce((a, p) => a + (p.score as number), 0) / scored.length)
      : null;

    const coverOf = (types: string[]) =>
      live
        .filter((p) => types.includes(p.insurance_type))
        .reduce((sum, p) => sum + (parseSumInsured(p.sum_insured) ?? 0), 0);

    const expiringSoon = policies
      .map((p) => ({ p, d: daysUntil(p.renewal_date) }))
      .filter((x) => x.d != null && (x.d as number) >= 0 && (x.d as number) <= 30)
      .sort((a, b) => (a.d as number) - (b.d as number)) as { p: Policy; d: number }[];

    const presentTypes = new Set(live.map((p) => p.insurance_type));
    const missingLobs = LOBS.filter((l) => !presentTypes.has(l.type));

    // Fixes, ranked: the weaker the policy, the higher its flaws sit.
    const fixes = policies
      .flatMap((p) =>
        (Array.isArray(p.flaws) ? p.flaws : [])
          .filter((f) => typeof f === "string" && f.trim())
          .map((f) => ({
            id: p.id,
            policy: p.nickname || p.insurer || labelFor(p.insurance_type),
            flaw: f.trim(),
            score: p.score ?? 60,
          }))
      )
      .sort((a, b) => a.score - b.score);

    const undated = live.filter((p) => !p.renewal_date).length;

    return {
      policies, live, avgScore,
      healthCover: coverOf(["health"]),
      lifeCover: coverOf(["term", "life"]),
      expiringSoon, presentTypes, missingLobs, fixes, undated,
    };
  }, [data]);

  const visiblePolicies = useMemo(() => {
    const list = d.policies.filter((p) => filter === "all" || p.insurance_type === filter);
    const byRenewal = (p: Policy) => daysUntil(p.renewal_date) ?? Number.MAX_SAFE_INTEGER;
    return [...list].sort((a, b) => {
      if (sort === "score") return (b.score ?? -1) - (a.score ?? -1);
      if (sort === "renewal") return byRenewal(a) - byRenewal(b);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [d.policies, filter, sort]);

  const trialDaysLeft = data
    ? Math.max(0, Math.ceil((new Date(data.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : 0;
  const isEmpty = !!data && data.policies.length === 0;
  const firstName = data?.fullName?.trim().split(/\s+/)[0] ?? null;

  // One primary action for the hero, chosen by what's most urgent right now.
  const heroCta = (() => {
    if (isEmpty) return { label: "Add your first policy", onClick: () => openAdd(), icon: Plus };
    if (d.expiringSoon.length) return { label: "Get help renewing", onClick: () => openConnect("renew"), icon: PhoneCall };
    if (d.fixes.length) return { label: "See what to fix", onClick: () => scrollTo("next-steps"), icon: Zap };
    if (d.missingLobs.length) return { label: `Add ${d.missingLobs[0].label.toLowerCase()} cover`, onClick: () => openAdd(d.missingLobs[0].type), icon: Plus };
    return { label: "Add another policy", onClick: () => openAdd(), icon: Plus };
  })();

  if (!data && !loadErr) return <PortfolioSkeleton />;

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] text-[var(--color-text-main)] overflow-x-clip">
      {/* App bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border-light)] bg-[var(--color-cream-main)]/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="IndSure" className="h-7 sm:h-8 w-auto" />
            <span className="hidden sm:inline text-[var(--color-border-medium)]">/</span>
            <span className="hidden sm:inline text-sm font-semibold text-[var(--color-text-secondary)]">Portfolio</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => (data?.advisor ? scrollTo("advisor-card") : openConnect("review"))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[var(--color-teal-600)] hover:bg-[var(--color-teal-600)]/10 transition-colors"
            >
              {data?.advisor ? <ShieldCheck className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
              <span className="hidden sm:inline">{data?.advisor ? "Your advisor" : "Talk to an advisor"}</span>
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-navy-900)] hover:bg-black/5 transition-colors"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-28">
        {loadErr && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {loadErr}
          </p>
        )}

        {/* ── Greeting ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  onBlur={saveName}
                  maxLength={80}
                  placeholder="Your name"
                  className="h-10 px-3 rounded-xl border border-[var(--color-border-medium)] bg-white text-base font-semibold focus:border-[var(--color-teal-600)] outline-none"
                />
                <span className="text-xs text-[var(--color-text-muted)]">Enter to save</span>
              </div>
            ) : (
              <h1 className="font-serif text-2xl sm:text-3xl font-bold leading-tight text-[var(--color-navy-900)] flex flex-wrap items-center gap-x-2">
                {firstName ? `Hey ${firstName},` : "Your cover,"}
                <span className="italic text-[var(--color-teal-600)]">
                  {firstName ? "here's your cover" : "decoded"}
                </span>
                {data && (
                  <button
                    onClick={() => { setNameDraft(data.fullName ?? ""); setEditingName(true); }}
                    aria-label={firstName ? "Edit your name" : "Add your name"}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-teal-600)] hover:bg-[var(--color-teal-600)]/10 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </h1>
            )}
          </div>
          {data && (
            <button
              onClick={() => setLocation("/pricing")}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-teal-600)]/10 px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest text-[var(--color-teal-600)] hover:bg-[var(--color-teal-600)]/20 transition-colors"
            >
              {data.plan === "paid" ? "Paid · unlimited" : `Free trial · ${trialDaysLeft} days left`}
              {data.plan !== "paid" && <ArrowRight className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* ── Hero: the one place that answers "am I covered?" ─────────── */}
        <section className="relative overflow-hidden rounded-3xl bg-[var(--color-navy-900)] p-6 sm:p-8">
          {/* Soft teal glow, purely decorative */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(45,212,191,0.22), transparent 70%)" }}
          />
          <div className="relative grid gap-7 sm:gap-9 sm:grid-cols-[auto_1fr] items-center">
            <div className="flex flex-col items-center sm:items-start gap-4">
              {d.avgScore != null ? (
                <ScoreRing score={d.avgScore} color={ringColor(d.avgScore)} label="cover score" />
              ) : (
                <div className="w-[168px] h-[168px] rounded-full border-[12px] border-white/10 flex flex-col items-center justify-center text-center px-6">
                  <span className="font-serif text-4xl font-bold text-white/40">—</span>
                  <span className="mt-1 text-[10px] font-mono uppercase tracking-widest text-[var(--color-white-muted)]">
                    no score yet
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white leading-tight">
                {d.avgScore != null ? scoreVerdict(d.avgScore) : "Let's find out where you stand"}
              </h2>
              <p className="mt-2 text-sm text-[var(--color-white-muted)] leading-relaxed max-w-lg">
                {d.avgScore != null
                  ? scoreMeaning(d.avgScore)
                  : "Add a policy PDF and we'll read the fine print for you — waiting periods, sub-limits, the clauses that decide whether a claim gets paid."}
              </p>

              {/* Completeness — honest second dimension: score says how good your
                  policies are, this says how much of life they actually cover. */}
              <div className="mt-5 max-w-md">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-mono uppercase tracking-widest text-[var(--color-white-muted)]">
                    Portfolio completeness
                  </span>
                  <span className="font-semibold text-white">{d.presentTypes.size} of 4 essentials</span>
                </div>
                <Meter value={d.presentTypes.size} max={4} color="var(--color-teal-400)" />
              </div>

              {/* Live stats */}
              <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4 max-w-lg">
                <HeroStat
                  icon={<Heart className="w-3.5 h-3.5" />}
                  label="Health cover"
                  value={d.healthCover > 0 ? formatINRShort(d.healthCover) : "—"}
                  hint={d.healthCover > 0 ? undefined : "Not added"}
                  onClick={d.healthCover > 0 ? undefined : () => openAdd("health")}
                />
                <HeroStat
                  icon={<ShieldCheck className="w-3.5 h-3.5" />}
                  label="Life cover"
                  value={d.lifeCover > 0 ? formatINRShort(d.lifeCover) : "—"}
                  hint={d.lifeCover > 0 ? undefined : "Not added"}
                  onClick={d.lifeCover > 0 ? undefined : () => openAdd("term")}
                />
                <HeroStat
                  icon={<CalendarClock className="w-3.5 h-3.5" />}
                  label="Next renewal"
                  value={d.expiringSoon[0] ? `${d.expiringSoon[0].d}d` : d.live.length ? "None due" : "—"}
                  hint={d.expiringSoon[0] ? fmtDate(d.expiringSoon[0].p.renewal_date) : undefined}
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <button
                  onClick={heroCta.onClick}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-teal-600)] text-white font-bold hover:bg-[var(--color-teal-400)] hover:text-[var(--color-navy-900)] transition-colors active:scale-[0.98]"
                >
                  <heroCta.icon className="w-4 h-4" /> {heroCta.label}
                </button>
                {!isEmpty && (
                  <button
                    onClick={() => openAdd()}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors active:scale-[0.98]"
                  >
                    <Plus className="w-4 h-4" /> Add policy
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Quick actions — scannable, one tap each ──────────────────── */}
        {!isEmpty && (
          <div className="-mx-5 sm:mx-0 px-5 sm:px-0 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <QuickChip icon={Plus} label="Add policy" onClick={() => openAdd()} />
            <QuickChip
              icon={CalendarClock}
              label="Renewals"
              count={d.expiringSoon.length}
              tone={d.expiringSoon.length ? "amber" : "plain"}
              onClick={() => scrollTo("renewals")}
            />
            <QuickChip
              icon={Zap}
              label="Fixes"
              count={d.fixes.length}
              tone={d.fixes.length ? "gold" : "plain"}
              onClick={() => scrollTo("next-steps")}
            />
            <QuickChip icon={FileText} label="Policies" count={d.policies.length} onClick={() => scrollTo("policies")} />
            <QuickChip icon={MessageCircle} label="Ask an advisor" onClick={() => openConnect("review")} />
          </div>
        )}

        {/* ── Renewals ─────────────────────────────────────────────────── */}
        {d.expiringSoon.length > 0 && (
          <section id="renewals" className="scroll-mt-20 bg-amber-50 rounded-2xl border border-amber-200 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <CalendarClock className="w-5 h-5 text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-lg font-bold text-amber-900">
                  {d.expiringSoon.length === 1 ? "1 policy renews soon" : `${d.expiringSoon.length} policies renew soon`}
                </h2>
                <p className="text-sm text-amber-800/80">Miss the date and you start fresh — waiting periods and all.</p>
                <ul className="mt-3 space-y-3">
                  {d.expiringSoon.map(({ p, d: days }) => (
                    <li key={p.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm text-amber-900">
                        <span className="font-semibold">{p.nickname || p.insurer || labelFor(p.insurance_type)}</span>
                        <span className="text-xs">{renewalPhrase(days)} · {fmtDate(p.renewal_date)}</span>
                      </div>
                      {/* Countdown: how much of the 30-day window is left. */}
                      <div className="mt-1.5">
                        <Meter value={30 - days} max={30} color="#B45309" track="rgba(180,83,9,0.15)" height={5} />
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => openConnect("renew")}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors active:scale-[0.98]"
                >
                  <PhoneCall className="w-4 h-4" /> Get help renewing
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Policies — the main object, now above the upload box ─────── */}
        {!isEmpty && (
          <section id="policies" className="scroll-mt-20 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">Your policies</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Tap any policy to see what's inside it.</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <span className="font-mono uppercase tracking-widest">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-9 pl-3 pr-8 rounded-xl border border-[var(--color-border-light)] bg-white text-sm font-semibold text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-teal-600)]"
                >
                  <option value="recent">Recently added</option>
                  <option value="score">Score</option>
                  <option value="renewal">Renewal date</option>
                </select>
              </label>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <FilterChip label="All" count={d.policies.length} active={filter === "all"} onClick={() => setFilter("all")} />
              {LOBS.map((l) => {
                const n = d.policies.filter((p) => p.insurance_type === l.type).length;
                if (!n) return null;
                return (
                  <FilterChip
                    key={l.type}
                    label={l.label}
                    count={n}
                    active={filter === l.type}
                    onClick={() => setFilter(l.type)}
                  />
                );
              })}
            </div>

            <div className="grid gap-3 sm:gap-4">
              {visiblePolicies.map((p) => (
                <PolicyCard
                  key={p.id}
                  policy={p}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId((id) => (id === p.id ? null : p.id))}
                  onRename={saveNick}
                  onSetRenewal={saveRenewalDate}
                  onDownload={downloadPolicy}
                  onOpenReport={(id) => setLocation(`/app/policy/${id}`)}
                  onAskAdvisor={openConnect}
                  downloading={downloadingId === p.id}
                />
              ))}

              <button
                onClick={() => openAdd()}
                className="rounded-2xl border-2 border-dashed border-[var(--color-border-medium)] p-5 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)] hover:bg-white transition-colors"
              >
                <Plus className="w-4 h-4" /> Add another policy
              </button>
            </div>
          </section>
        )}

        {/* ── Next steps ───────────────────────────────────────────────── */}
        {!isEmpty && (
          <section id="next-steps" className="scroll-mt-20 space-y-4">
            <h2 className="font-serif text-xl font-bold text-[var(--color-navy-900)] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--color-teal-600)]" /> Your next steps
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {/* What you're missing */}
              <div className="bg-white rounded-2xl border border-[var(--color-border-light)] shadow-sm p-5 sm:p-6">
                <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                  Cover checklist
                </p>
                <div className="mt-3 space-y-3">
                  {LOBS.map((l) => {
                    const have = d.presentTypes.has(l.type);
                    return (
                      <div key={l.type} className="flex items-start gap-2.5">
                        <span
                          className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
                            have
                              ? "bg-[var(--color-teal-600)]/15 text-[var(--color-teal-600)]"
                              : "bg-[var(--color-cream-dark)] text-[var(--color-text-muted)] border border-[var(--color-border-light)]"
                          }`}
                        >
                          {have ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0">
                          <span
                            className={`text-sm font-semibold ${have ? "text-[var(--color-navy-900)]" : "text-[var(--color-text-secondary)]"}`}
                          >
                            {l.label} cover
                            {have && <span className="text-[var(--color-teal-600)] font-normal"> · added</span>}
                          </span>
                          {!have && (
                            <p className="text-xs text-[var(--color-text-muted)] leading-snug">
                              {l.blurb}{" "}
                              <button
                                onClick={() => openAdd(l.type)}
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
                {d.missingLobs.length > 0 && (
                  <p className="mt-4 pt-3 border-t border-[var(--color-border-light)] text-xs text-[var(--color-text-muted)]">
                    Don't have one yet?{" "}
                    <button onClick={() => openConnect("new-cover")} className="font-semibold text-[var(--color-teal-600)] hover:underline">
                      Ask an advisor what it'd cost you
                    </button>
                  </p>
                )}
              </div>

              {/* What to fix, worst policy first */}
              <div className="bg-white rounded-2xl border border-[var(--color-border-light)] shadow-sm p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                    Worth fixing
                  </p>
                  {d.fixes.length > 4 && (
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">{d.fixes.length} found</span>
                  )}
                </div>
                {d.fixes.length > 0 ? (
                  <ul className="mt-3 space-y-3">
                    {d.fixes.slice(0, 4).map((f, i) => (
                      <li key={i}>
                        <button
                          onClick={() => { setExpandedId(f.id); scrollTo("policies"); }}
                          className="w-full text-left flex items-start gap-2.5 text-sm group"
                        >
                          <span className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${scoreClasses(f.score).dot}`} />
                          <span className="text-[var(--color-text-secondary)] leading-snug">
                            <span className="font-semibold text-[var(--color-navy-900)] group-hover:text-[var(--color-teal-600)]">
                              {f.policy}:
                            </span>{" "}
                            {f.flaw}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                    Nothing major flagged yet. Add more policies to get a fuller picture of your cover.
                  </p>
                )}

                {d.undated > 0 && (
                  <p className="mt-4 pt-3 border-t border-[var(--color-border-light)] text-xs text-[var(--color-text-muted)]">
                    {d.undated} {d.undated === 1 ? "policy has" : "policies have"} no renewal date set — we can't remind
                    you about {d.undated === 1 ? "it" : "them"}.{" "}
                    <button onClick={() => scrollTo("policies")} className="font-semibold text-[var(--color-teal-600)] hover:underline">
                      Set {d.undated === 1 ? "it" : "them"}
                    </button>
                  </p>
                )}

                {d.fixes.length > 0 && (
                  <button
                    onClick={() => openConnect("review")}
                    className="mt-3 -mx-2 px-2 py-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-teal-600)] hover:underline"
                  >
                    Get a second opinion from an advisor <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Add a policy — collapsible once you have some ─────────────── */}
        <section id="add-policy" className="scroll-mt-20">
          {isEmpty && (
            <div className="mb-4 text-center">
              <h2 className="font-serif text-2xl font-bold text-[var(--color-navy-900)]">
                Let's decode your first policy
              </h2>
              <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
                Pick a type, drop the PDF, and get an unbiased audit in about a minute. One free policy each for
                Health, Term, Life &amp; Vehicle.
              </p>
              <p className="mt-3 text-xs text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-teal-600)]" /> No calls, no spam — your policies
                stay private to you.
              </p>
            </div>
          )}

          <div
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
              addOpen ? "border-[var(--color-teal-600)]/40" : "border-[var(--color-border-light)]"
            }`}
          >
            {!isEmpty && (
              <button
                onClick={() => setAddOpen((o) => !o)}
                aria-expanded={addOpen}
                className="w-full px-5 sm:px-6 py-4 flex items-center gap-3 text-left"
              >
                <span className="shrink-0 w-10 h-10 rounded-xl bg-[var(--color-teal-600)]/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-[var(--color-teal-600)]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[var(--color-navy-900)]">Add a policy</span>
                  <span className="block text-sm text-[var(--color-text-muted)]">
                    Drop a PDF — we'll read it and audit it for you.
                  </span>
                </span>
                <ChevronDown
                  className={`shrink-0 w-5 h-5 text-[var(--color-text-muted)] transition-transform ${addOpen ? "rotate-180" : ""}`}
                />
              </button>
            )}

            {addOpen && (
              <div className={`px-5 sm:px-6 pb-6 space-y-4 ${isEmpty ? "pt-6" : ""}`}>
                {/* Type picker with slot state */}
                <div className="flex flex-wrap gap-2">
                  {LOBS.map((l) => {
                    const used = data?.slotsUsedByType?.[l.type] ?? 0;
                    const full = data?.plan !== "paid" && used >= (data?.freeSlotsPerType ?? 1);
                    const active = selectedType === l.type;
                    return (
                      <button
                        key={l.type}
                        onClick={() => setSelectedType(l.type)}
                        aria-pressed={active}
                        className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all active:scale-[0.98] flex items-center gap-1.5 ${
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

                {/* Why this line matters — plain language, changes with the tab */}
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {lobFor(selectedType)?.why}
                </p>

                <div
                  {...getRootProps()}
                  className={`rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? "border-[var(--color-teal-600)] bg-[var(--color-teal-600)]/5 scale-[1.01]"
                      : "border-[var(--color-border-medium)] bg-[var(--color-cream-main)] hover:border-[var(--color-teal-600)] hover:bg-[var(--color-teal-600)]/5"
                  } ${uploading ? "opacity-70 pointer-events-none" : ""}`}
                >
                  <input {...getInputProps()} />
                  {uploading ? (
                    <>
                      <Loader2 className="w-8 h-8 mx-auto text-[var(--color-teal-600)] animate-spin" />
                      <p className="mt-4 font-serif text-lg font-bold text-[var(--color-navy-900)]">
                        {uploadStage ?? "Working on it…"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        Usually about a minute. You can keep browsing — we'll update the page.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 mx-auto rounded-full bg-white border border-[var(--color-border-light)] flex items-center justify-center">
                        <Upload className="w-5 h-5 text-[var(--color-teal-600)]" />
                      </div>
                      <p className="mt-4 font-serif text-lg font-bold text-[var(--color-navy-900)]">
                        Drop your <span className="text-[var(--color-teal-600)]">{labelFor(selectedType)}</span> policy
                        PDF here
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-widest">
                        or tap to browse · max 25MB
                      </p>
                    </>
                  )}
                </div>

                {paywall && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 font-medium flex flex-wrap items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" /> {paywall}
                    <button
                      onClick={() => setLocation("/pricing")}
                      className="ml-auto inline-flex items-center gap-1 font-bold text-amber-900 hover:underline"
                    >
                      See plans <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setPaywall(null)} aria-label="Dismiss" className="p-1 text-amber-700">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Advisor ──────────────────────────────────────────────────── */}
        {data && (
          data.advisor ? (
            <section id="advisor-card" className="scroll-mt-20 bg-[var(--color-navy-900)] rounded-2xl p-6 sm:p-8 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--color-teal-600)]/20 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-[var(--color-teal-400)]" />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-teal-400)]">
                Your advisor
              </p>
              <h2 className="mt-1 font-serif text-xl sm:text-2xl font-bold text-white">{data.advisor.name}</h2>
              {data.advisor.city && <p className="mt-1 text-sm text-[var(--color-white-muted)]">{data.advisor.city}</p>}
              <p className="mt-2 text-sm text-[var(--color-white-muted)] max-w-md mx-auto leading-relaxed">
                A licensed advisor is looking after your cover. Reach out any time — no obligation.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
                {advisorWa(data.advisor.phone) && (
                  <a
                    href={advisorWa(data.advisor.phone)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-teal-600)] text-white font-bold hover:bg-[var(--color-teal-400)] hover:text-[var(--color-navy-900)] transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </a>
                )}
                {advisorTel(data.advisor.phone) && (
                  <a
                    href={advisorTel(data.advisor.phone)!}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
                  >
                    <PhoneCall className="w-4 h-4" /> Call
                  </a>
                )}
              </div>
            </section>
          ) : (
            <section id="advisor-card" className="scroll-mt-20 bg-[var(--color-navy-900)] rounded-2xl p-6 sm:p-8 text-center">
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
                  className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-teal-600)] text-white font-bold hover:bg-[var(--color-teal-400)] hover:text-[var(--color-navy-900)] transition-colors active:scale-[0.98]"
                >
                  <PhoneCall className="w-4 h-4" /> Connect me to an advisor
                </button>
              )}
            </section>
          )
        )}

        {/* ── Settings strip — demoted from its old hero-sized card ─────── */}
        {data && (
          <section className="bg-white rounded-2xl border border-[var(--color-border-light)] shadow-sm divide-y divide-[var(--color-border-light)]">
            <div className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 w-9 h-9 rounded-xl bg-[var(--color-teal-600)]/10 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-[var(--color-teal-600)]" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[var(--color-navy-900)]">Renewal reminders</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    An email 30 days before a policy renews, so your cover never lapses.
                  </p>
                </div>
              </div>
              {/* Real switch, not a button that says "Off". */}
              <button
                role="switch"
                aria-checked={data.renewalRemindersEnabled}
                aria-label="Renewal reminders"
                onClick={() => toggleReminders(!data.renewalRemindersEnabled)}
                className={`shrink-0 relative w-14 h-8 rounded-full transition-colors ${
                  data.renewalRemindersEnabled ? "bg-[var(--color-teal-600)]" : "bg-[var(--color-border-medium)]"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    data.renewalRemindersEnabled ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>

            <div className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 w-9 h-9 rounded-xl bg-[var(--color-gold-500)]/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[var(--color-gold-500)]" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[var(--color-navy-900)]">
                    {data.plan === "paid" ? "Paid plan" : "Free trial"}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {data.plan === "paid"
                      ? "Unlimited policy audits."
                      : `${trialDaysLeft} days left · one free policy per type.`}
                  </p>
                </div>
              </div>
              {data.plan !== "paid" && (
                <button
                  onClick={() => setLocation("/pricing")}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--color-border-medium)] text-sm font-bold text-[var(--color-text-secondary)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)] transition-colors"
                >
                  See plans <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </section>
        )}

        <p className="flex items-center justify-center gap-2 text-[var(--color-text-muted)] text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-[var(--color-teal-600)]" /> Private to your account. We only contact you
          if you ask us to.
        </p>
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

/* ── Small pieces ───────────────────────────────────────────────────── */

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

const ringColor = (s: number) => (s >= 75 ? "var(--color-teal-400)" : s >= 50 ? "#FBBF24" : "#F87171");

function HeroStat({
  icon, label, value, hint, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--color-white-muted)]">
        {icon} <span className="truncate">{label}</span>
      </span>
      <span className="block mt-1.5 font-serif text-xl sm:text-2xl font-bold text-white leading-none">{value}</span>
      {hint && <span className="block mt-1 text-[11px] text-[var(--color-white-muted)] truncate">{hint}</span>}
    </>
  );
  const base = "text-left rounded-xl bg-white/[0.06] border border-white/10 px-3 py-3 min-w-0";
  return onClick ? (
    <button onClick={onClick} className={`${base} hover:bg-white/[0.12] transition-colors`}>
      {inner}
    </button>
  ) : (
    <div className={base}>{inner}</div>
  );
}

function QuickChip({
  icon: Icon, label, count, tone = "plain", onClick,
}: {
  icon: React.ElementType;
  label: string;
  count?: number;
  tone?: "plain" | "amber" | "gold";
  onClick: () => void;
}) {
  const tones = {
    plain: "bg-white border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)]",
    amber: "bg-amber-50 border-amber-200 text-amber-800 hover:border-amber-400",
    gold: "bg-[var(--color-gold-500)]/10 border-[var(--color-gold-500)]/25 text-[var(--color-gold-500)] hover:border-[var(--color-gold-500)]/60",
  };
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold shadow-sm transition-colors active:scale-[0.98] ${tones[tone]}`}
    >
      <Icon className="w-4 h-4" /> {label}
      {count != null && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-black/[0.07] text-xs font-bold">
          {count}
        </span>
      )}
    </button>
  );
}

function FilterChip({
  label, count, active, onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all active:scale-[0.98] ${
        active
          ? "bg-[var(--color-navy-900)] text-white border-[var(--color-navy-900)]"
          : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-navy-900)]"
      }`}
    >
      {label} <span className={active ? "text-white/60" : "text-[var(--color-text-muted)]"}>{count}</span>
    </button>
  );
}

/** Shown while the first portfolio fetch is in flight — no more blank page. */
function PortfolioSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] animate-pulse">
      <div className="h-16 border-b border-[var(--color-border-light)] bg-white/70" />
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-8 space-y-6">
        <div className="h-9 w-64 rounded-lg bg-[var(--color-cream-dark)]" />
        <div className="h-72 rounded-3xl bg-[var(--color-cream-dark)]" />
        <div className="flex gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-11 w-32 rounded-xl bg-[var(--color-cream-dark)]" />
          ))}
        </div>
        <div className="grid gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-[var(--color-cream-dark)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
