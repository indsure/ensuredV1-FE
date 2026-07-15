import { useEffect, useState } from "react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { PolicyAuditReport } from "@/components/PolicyAuditReport";
import { validateForensicAuditReport } from "@/lib/policy-types";
import { ArrowLeft, AlertCircle, Loader2, ShieldCheck } from "lucide-react";

type PolicyRow = {
  id: string;
  insurance_type: string;
  status: string;
  insurer: string | null;
  policy_name: string | null;
  nickname: string | null;
  report_data: any | null;
  error_message: string | null;
};

// Consumer report view. Reuses the full PolicyAuditReport renderer, but with
// hideNav (no marketing chrome inside the app) and hideLeadCTA (signed-in
// consumers are never lead-captured — that's the promise).
export default function PolicyDetail({ id }: { id: string }) {
  const [row, setRow] = useState<PolicyRow | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "notfound">("loading");

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
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-teal-600)]" /> Private to your account
          </span>
        </div>
      </header>

      {state === "loading" && (
        <div className="max-w-5xl mx-auto px-6 py-24 flex flex-col items-center text-center">
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
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
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
