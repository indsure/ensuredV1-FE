import { useEffect, useState } from "react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/queryClient";
import { PolicyAuditReport } from "@/components/PolicyAuditReport";
import { ConnectAgentDialog } from "@/components/app/ConnectAgentDialog";
import { validateForensicAuditReport } from "@/lib/policy-types";
import { ArrowLeft, AlertCircle, Loader2, ShieldCheck, Download, PhoneCall } from "lucide-react";

type PolicyRow = {
  id: string;
  insurance_type: string;
  status: string;
  insurer: string | null;
  policy_name: string | null;
  nickname: string | null;
  filename: string | null;
  pdf_url: string | null;
  report_data: any | null;
  error_message: string | null;
};

// Consumer report view. Reuses the full PolicyAuditReport renderer, but with
// hideNav (no marketing chrome inside the app) and hideLeadCTA (signed-in
// consumers are never lead-captured — that's the promise).
export default function PolicyDetail({ id }: { id: string }) {
  const [row, setRow] = useState<PolicyRow | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "notfound">("loading");
  const [downloading, setDownloading] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  async function downloadFile() {
    if (!row) return;
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${getApiBase()}/api/me/policy/${row.id}/download`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = row.filename || "policy.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { /* best-effort */ } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    document.title = "Policy report — IndSure";
    let cancelled = false;
    apiFetch(`/api/me/policy/${id}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) { setState("notfound"); return; }
        if (!res.ok) { setState("error"); return; }
        const data = await res.json();
        setRow(data);
        setState("ready");
      })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [id]);

  const report = row?.report_data;
  const hasValidReport = report && validateForensicAuditReport(report);

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)]">
      {/* App chrome — light bar matching the portfolio shell */}
      <header className="border-b border-[var(--color-border-light)] bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/app">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-navy-900)] transition-colors cursor-pointer">
              <ArrowLeft className="w-4 h-4" /> Back to portfolio
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {row?.pdf_url && (
              <button
                onClick={downloadFile}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-teal-600)] transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="hidden sm:inline">Download</span>
              </button>
            )}
            <button
              onClick={() => setConnectOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-teal-600)] hover:text-[var(--color-teal-400)] transition-colors"
            >
              <PhoneCall className="w-4 h-4" /> <span className="hidden sm:inline">Talk to an advisor</span>
            </button>
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-teal-600)]" /> Private to your account
            </span>
          </div>
        </div>
      </header>

      <ConnectAgentDialog open={connectOpen} onOpenChange={setConnectOpen} defaultTopic="review" />

      {state === "loading" && (
        <div className="max-w-5xl mx-auto px-6 py-14 sm:py-20 lg:py-24 flex flex-col items-center text-center">
          <Loader2 className="w-8 h-8 text-[var(--color-teal-600)] animate-spin" />
          <p className="mt-4 text-sm text-slate-500">Loading your report…</p>
        </div>
      )}

      {state === "ready" && hasValidReport && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {row?.nickname && (
            <span className="inline-block ml-2 mb-2 py-1 px-3 rounded-full text-[11px] font-mono uppercase tracking-widest text-[var(--color-teal-600)] bg-[var(--color-teal-600)]/10">
              {row.nickname}
            </span>
          )}
          <PolicyAuditReport data={report as any} hideNav hideLeadCTA />
        </div>
      )}

      {((state === "ready" && !hasValidReport) || state === "error" || state === "notfound") && (
        <div className="max-w-2xl mx-auto px-6 py-12 sm:py-16 lg:py-20 text-center">
          <div className="inline-flex p-4 bg-amber-50 rounded-full mb-6 text-amber-600 border border-amber-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-slate-900 mb-3">
            {state === "notfound" ? "Policy not found" : "Report unavailable"}
          </h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            {state === "notfound"
              ? "This policy isn't in your portfolio."
              : row?.status === "error"
                ? (row.error_message || "We couldn't read this policy document.")
                : row?.status === "processing" || row?.status === "pending"
                  ? "This policy is still being analyzed. Check back in a moment."
                  : "The stored report for this policy is missing or in an old format."}
          </p>
          <Link href="/app">
            <span className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl bg-[var(--color-teal-600)] text-white font-bold hover:bg-[var(--color-teal-400)] transition-colors cursor-pointer">
              <ArrowLeft className="w-4 h-4" /> Back to portfolio
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
