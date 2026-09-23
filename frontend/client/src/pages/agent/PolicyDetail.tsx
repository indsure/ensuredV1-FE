import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Copy, ExternalLink, FileText, RefreshCw, Trash2 } from "lucide-react";

import { InlineErrorState } from "@/components/agent/InlineErrorState";
import CustomerTagCard from "@/components/agent/CustomerTagCard";
import ExtractedDataForm from "@/components/agent/ExtractedDataForm";
import PolicyValueChart from "@/components/agent/PolicyValueChart";
import AddOnChecklist from "@/components/agent/AddOnChecklist";
import { PolicyAuditReport } from "@/components/PolicyAuditReport";
import { isDataEntryType, typeLabel } from "@/lib/insuranceTypes";
import { ADD_ON_FINDINGS_KEY } from "@shared/motorAddOns";
import {
  scoreMotorPolicy, motorScoreCaption, motorScoreVerdict, motorScoreTone,
} from "@shared/motorScore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { intlLocale, tOr } from "@/i18n";
import { apiFetch, apiJson } from "@/lib/api";
import { PlanNameField } from "@/components/agent/PlanNameField";
import { rerunPolicy } from "@/lib/rerun";
import { supabase } from "@/lib/supabase";
import { validateForensicAuditReport, type ForensicAuditReport } from "@shared/policy";
import { hasShareableContent } from "@shared/dataEntryShare";

type PolicyRow = {
  id: string;
  client_name: string | null;
  client_identifier: string | null;
  insurer_name: string | null;
  product_name: string | null;
  /** Best guess when the plan name could not be read from the document. Agent
   *  facing only: it is a suggestion until accepted, never the policy's name. */
  product_name_suggested: string | null;
  policy_number: string | null;
  status: string | null;
  /** Why the last run failed, straight off the row. Only meaningful while
   *  status is "error". */
  error_message: string | null;
  score: number | null;
  created_at: string;
  updated_at: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  last_analyzed_at: string | null;
};
type FileRow = {
  file_path: string | null;
  uploaded_at: string | null;
};
type ClientMeta = { email: string; phone: string };

type T = (key: string, vars?: Record<string, string | number>) => string;

function scoreTone(score: number | null, t: T) {
  if (score == null) return { label: t("policy_detail.tone_pending"), bar: 0, color: "text-slate-500" };
  if (score >= 75) return { label: t("policy_detail.tone_strong"), bar: score, color: "text-emerald-600" };
  if (score >= 60) return { label: t("policy_detail.tone_watch"), bar: score, color: "text-amber-600" };
  return { label: t("policy_detail.tone_action"), bar: score, color: "text-red-600" };
}

/**
 * Motor's own colours for the score tile.
 *
 * Health's bands are not reused. See motorScoreTone: red here means the
 * vehicle itself is not covered, not a low number.
 */
const MOTOR_TONE_CLASS = {
  strong: "text-emerald-600",
  core: "text-amber-600",
  basic: "text-slate-700",
  third_party: "text-red-600",
  unscored: "text-slate-500",
} as const;

/**
 * The meter is drawn here rather than with <Progress>.
 *
 * That component fills with `bg-primary`, and this app's Tailwind v4 theme
 * never defines `primary`, so the fill computes to transparent and the bar
 * paints nothing at all. Verified in the browser, not assumed. The health tile
 * above has the same invisible bar and is left alone: it is one shared
 * component and fixing it belongs in its own change.
 */
const MOTOR_BAR_CLASS = {
  strong: "bg-emerald-500",
  core: "bg-amber-500",
  basic: "bg-slate-400",
  third_party: "bg-red-500",
  unscored: "bg-slate-300",
} as const;

function expiryMeta(value: string | null, t: T) {
  if (!value) return { label: t("policy_detail.no_expiry"), className: "bg-slate-100 text-slate-600" };
  const end = new Date(value);
  const today = new Date();
  const days = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: t("policy_detail.expired"), className: "bg-red-50 text-red-700" };
  if (days < 30) return { label: t("policy_detail.days_left", { days }), className: "bg-red-50 text-red-700" };
  if (days <= 60) return { label: t("policy_detail.days_left", { days }), className: "bg-amber-50 text-amber-700" };
  return { label: t("policy_detail.days_left", { days }), className: "bg-emerald-50 text-emerald-700" };
}

async function copyText(text: string, title: string, t: T) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ variant: "success", title, description: t("policy_detail.link_copied_desc") });
  } catch {
    toast({ variant: "destructive", title: t("policy_detail.copy_failed"), description: t("policy_detail.clipboard_blocked") });
  }
}

/** Extra health cover the agent attached at upload time. Stored alongside the
 *  report (report_data.__companions), so there is no separate table to read. */
type CompanionRecord = {
  kind: "super_topup" | "corporate" | "ayushman";
  filename: string | null;
  declaredOnly: boolean;
  read: boolean;
};

const COMPANION_KEY: Record<CompanionRecord["kind"], string> = {
  super_topup: "policy_detail.comp_super_topup",
  corporate: "policy_detail.comp_corporate",
  ayushman: "policy_detail.comp_ayushman",
};

export default function PolicyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { agent } = useAgent();
  const { t, locale } = useLanguage();
  const [policy, setPolicy] = useState<PolicyRow | null>(null);
  const [reportData, setReportData] = useState<ForensicAuditReport | null>(null);
  const [insuranceType, setInsuranceType] = useState<string>("health");
  // Other cover uploaded alongside this policy and read in the same audit.
  const [companions, setCompanions] = useState<CompanionRecord[]>([]);
  const [extractedData, setExtractedData] = useState<Record<string, any> | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<FileRow | null>(null);
  const [notes, setNotes] = useState("");
  const [clientMeta, setClientMeta] = useState<ClientMeta>({ email: "", phone: "" });
  const [draftClientMeta, setDraftClientMeta] = useState<ClientMeta>({ email: "", phone: "" });
  const [draftName, setDraftName] = useState("");
  const [draftIdentifier, setDraftIdentifier] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const origin = useMemo(() => (typeof window === "undefined" ? "" : window.location.origin), []);
  const shareLink = shareToken ? `${origin}/shared/report/${shareToken}` : "";
  const score = policy?.score ?? null;
  const scoreMeta = scoreTone(score, t);
  /* Motor is scored from the add-on scan, which is stored on the row, so the
     tile is computed from that scan rather than read from the `score` column.
     The two can disagree: a row written before the scorer shipped holds null
     while its scan scores perfectly well, and a row written before a detector
     fix holds a number the current rules would refuse. Computing it here means
     the number, the verdict and the caption are always the same reading. */
  const motor = useMemo(
    () =>
      insuranceType === "motor"
        ? scoreMotorPolicy(
            (extractedData?.[ADD_ON_FINDINGS_KEY] ?? null) as any,
            typeof extractedData?.coverage_type === "string" ? extractedData.coverage_type : null,
          )
        : null,
    [insuranceType, extractedData],
  );
  const expiry = expiryMeta(policy?.policy_end_date ?? null, t);
  const isDataEntry = isDataEntryType(insuranceType);
  /* A policy may be shared once there is something at the other end of the
     link. Health needs its audit; a data-entry policy needs at least one
     publishable field. This mirrors the readiness test the server applies in
     /api/shared/report/:token, so the button and the link agree with it. */
  const canShare = Boolean(reportData) || hasShareableContent(insuranceType, extractedData);

  async function loadDetail() {
    if (!id || !agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      // Query the clients table with all new columns
      const policyRes = await supabase
        .from("clients")
        .select(`
          id, name, insurer, policy_name, status, score, created_at, error_message,
          expiry_date, sum_insured, flaws, report_data, policyholder_name,
          share_token, share_enabled, filename, file_size,
          client_email, client_phone, policy_identifier, agent_notes,
          insurance_type, extracted_data, customer_id,
          policy_name_suggested
        `)
        .eq("id", id)
        .eq("agent_id", agent.agentId)
        .maybeSingle();

      if (policyRes.error) throw new Error(policyRes.error.message);

      const clientData = policyRes.data;
      if (!clientData) throw new Error(t("policy_detail.not_found"));

      // Map clients data to policy structure
      const nextPolicy: PolicyRow = {
        id: clientData.id,
        client_name: clientData.policyholder_name || clientData.name,
        client_identifier: clientData.policy_identifier,
        insurer_name: clientData.insurer,
        product_name: clientData.policy_name,
        product_name_suggested: clientData.policy_name_suggested ?? null,
        policy_number: clientData.policy_name,
        status: clientData.status,
        error_message: clientData.error_message ?? null,
        score: clientData.score,
        created_at: clientData.created_at,
        updated_at: clientData.created_at,
        policy_start_date: null,
        policy_end_date: clientData.expiry_date,
        last_analyzed_at: clientData.status === 'done' ? clientData.created_at : null,
      };

      setPolicy(nextPolicy);
      setInsuranceType((clientData as any).insurance_type || "health");
      setExtractedData((clientData as any).extracted_data ?? null);
      setCustomerId((clientData as any).customer_id ?? null);
      setReportData(
        clientData.report_data && validateForensicAuditReport(clientData.report_data)
          ? clientData.report_data
          : null
      );
      const rawCompanions = (clientData.report_data as any)?.__companions;
      setCompanions(Array.isArray(rawCompanions) ? rawCompanions : []);
      
      // Set file metadata
      setFileMeta({
        file_path: clientData.filename,
        uploaded_at: clientData.created_at
      });
      
      // Set share token
      setShareToken(clientData.share_token);
      
      setNotes((clientData as any).agent_notes || "");
      setClientMeta({
        email: clientData.client_email || "",
        phone: clientData.client_phone || ""
      });
      setDraftClientMeta({
        email: clientData.client_email || "",
        phone: clientData.client_phone || ""
      });
      setDraftName(clientData.policyholder_name || clientData.name || "");
      setDraftIdentifier(clientData.policy_identifier || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("policy_detail.load_failed"));
    } finally {
      setLoading(false);
    }
  }

  const statusRef = useRef<string | null>(null);
  const clientCardRef = useRef<HTMLDivElement | null>(null);

  // The Client details card sits at the top of the left column; the Action bar
  // button that opens it is in the right rail, ~750px below the fold on a
  // laptop. Flipping the state alone opened the editor somewhere the agent
  // could not see, so the button read as broken. Bring the editor to them.
  function openClientEditor() {
    setEditOpen(true);
    clientCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  useEffect(() => {
    statusRef.current = policy?.status ?? null;
  }, [policy?.status]);

  useEffect(() => {
    void loadDetail();

    // Poll for status transitions (processing → done/error, re-runs, etc.)
    // and reload the page data whenever the status changes.
    const pollInterval = setInterval(async () => {
      if (!id || !agent?.agentId) return;
      try {
        const { data } = await supabase
          .from("clients")
          .select("status")
          .eq("id", id)
          .eq("agent_id", agent.agentId)
          .maybeSingle();
        if (data?.status && statusRef.current && data.status !== statusRef.current) {
          void loadDetail();
        }
      } catch {
        // ignore — next tick will retry
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [id, agent?.agentId]);

  async function saveNotes() {
    if (!id || !agent?.agentId) return;
    setBusy("notes");
    try {
      const { error: notesError } = await supabase
        .from("clients")
        .update({ agent_notes: notes })
        .eq("id", id)
        .eq("agent_id", agent.agentId);
      if (notesError) throw new Error(notesError.message);
      toast({ variant: "success", title: t("policy_detail.notes_saved") });
    } catch (saveError) {
      toast({ variant: "destructive", title: t("policy_detail.save_failed"), description: saveError instanceof Error ? saveError.message : t("policy_detail.notes_failed") });
    } finally {
      setBusy(null);
    }
  }

  async function saveClientDetails() {
    if (!policy || !agent?.agentId) return;
    setBusy("client");
    try {
      const updatePolicy = await supabase
        .from("clients")
        .update({
          policyholder_name: draftName,
          policy_identifier: draftIdentifier || null,
          client_email: draftClientMeta.email || null,
          client_phone: draftClientMeta.phone || null,
        })
        .eq("id", policy.id);
      if (updatePolicy.error) throw new Error(updatePolicy.error.message);

      setEditOpen(false);
      await loadDetail();
      toast({ variant: "success", title: t("policy_detail.client_updated") });
    } catch (saveError) {
      toast({ variant: "destructive", title: t("policy_detail.update_failed"), description: saveError instanceof Error ? saveError.message : t("policy_detail.client_update_failed") });
    } finally {
      setBusy(null);
    }
  }

  async function shareReport() {
    if (!policy?.id || !agent?.agentId) return;
    setBusy("share");
    try {
      // apiFetch, not bare fetch: the backend lives on api.indsure.in, and a
      // relative /api path resolves against the Vercel origin, where the SPA
      // fallback answers it with index.html and a 200. `res.ok` was therefore
      // true for a request that never reached the server, and sharing failed on
      // the JSON parse instead — with no clue as to why. apiFetch also carries
      // the bearer token, so the hand-rolled session read is gone with it.
      const { shareUrl, shareToken: newToken } = await apiJson<{ shareUrl: string; shareToken: string }>(
        apiFetch(`/api/agent/clients/${policy.id}/share/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true }),
        }),
      );
      setShareToken(newToken);

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      
      toast({
        variant: "success",
        title: t("policy_detail.link_copied"),
        description: t("policy_detail.share_link_copied")
      });
    } catch (shareError) {
      toast({
        variant: "destructive",
        title: t("policy_detail.share_failed"),
        description: shareError instanceof Error ? shareError.message : t("policy_detail.share_failed_desc")
      });
    } finally {
      setBusy(null);
    }
  }

  async function rerunAnalysis() {
    if (!policy?.id || !agent?.agentId) return;
    setBusy("rerun");
    try {
      await rerunPolicy(policy.id);

      toast({
        title: t("policy_detail.rerun_title"),
        description: t("policy_detail.rerun_desc"),
      });

      await loadDetail();
    } catch (rerunError) {
      toast({
        variant: "destructive",
        title: t("policy_detail.rerun_failed"),
        description:
          rerunError instanceof Error
            ? rerunError.message
            : t("policy_detail.rerun_failed_desc"),
      });
    } finally {
      setBusy(null);
    }
  }

  // Named for what it does. This is a hard delete, not an archive — there is no
  // recoverable copy. `public_reports.client_id` is ON DELETE CASCADE, so any
  // live share link for this policy stops working as a side effect.
  async function deletePolicy() {
    if (!policy?.id || !agent?.agentId) return;
    setBusy("delete");
    try {
      const update = await supabase
        .from("clients")
        .delete()
        .eq("id", policy.id)
        .eq("agent_id", agent.agentId);
      if (update.error) throw new Error(update.error.message);

      toast({ variant: "success", title: t("policy_detail.deleted") });
      setLocation("/agent/policies");
    } catch (deleteError) {
      toast({ variant: "destructive", title: t("policy_detail.delete_failed"), description: deleteError instanceof Error ? deleteError.message : t("policy_detail.delete_failed_desc") });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <InlineErrorState onRetry={loadDetail} />;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="text-slate-600" onClick={() => setLocation("/agent/policies")}>
          {t("policy_detail.back")}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={loadDetail} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
          {!isDataEntry && (
            <Button size="sm" className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={shareReport} disabled={!canShare || busy === "share"}>
              {t("policy_detail.share_report")}
            </Button>
          )}
        </div>
      </div>

      {loading && <Card className="border-slate-100 shadow-sm"><CardContent className="p-10 text-center text-slate-400">{t("policy_detail.loading")}</CardContent></Card>}

      {!loading && policy && (
        <>
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${expiry.className}`}>{expiry.label}</span>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">
                      {tOr(t, `common.status_${policy.status || "pending"}`, policy.status?.replaceAll("_", " ") || "pending")}
                    </span>
                    <span className="inline-flex rounded-full bg-[#0D9488]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0D9488]">
                      {tOr(t, `common.type_${insuranceType}`, typeLabel(insuranceType))}
                    </span>
                  </div>
                  <div>
                    <h1 className="font-['Playfair_Display'] text-3xl sm:text-4xl font-bold text-slate-900">{policy.client_name || t("policy_detail.pending_holder")}</h1>
                    <p className="mt-2 text-sm text-slate-500">
                      {policy.insurer_name || t("policy_detail.insurer_not_read")} · {policy.product_name || t("policy_detail.plan_unclear")} · {policy.id}
                    </p>
                    <PlanNameField
                      clientId={policy.id}
                      name={policy.product_name}
                      suggestion={policy.product_name_suggested}
                      onSaved={loadDetail}
                    />
                  </div>
                </div>

                {!isDataEntry && (
                  <div className="min-w-[280px] rounded-3xl border border-slate-100 bg-slate-50 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{t("policy_detail.score")}</div>
                    <div className={`mt-2 text-4xl font-black ${scoreMeta.color}`}>{score == null ? "-" : score}</div>
                    <div className="text-sm font-medium text-slate-500">{scoreMeta.label}</div>
                    <Progress value={scoreMeta.bar} className="mt-4 h-2 bg-white" />
                  </div>
                )}

                {/* Motor carries a score too, and the portal used to hide it
                    because the tile above was gated on health. The caption is
                    not decoration: this number and a health score share a scale
                    and mean different things, so the surface showing it owes
                    the reader the sentence saying which. */}
                {motor && (
                  <div className="min-w-[280px] max-w-[320px] rounded-3xl border border-slate-100 bg-slate-50 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{t("policy_detail.cover_score")}</div>
                    <div className={`mt-2 text-4xl font-black ${MOTOR_TONE_CLASS[motorScoreTone(motor)]}`}>
                      {motor.score == null ? "-" : motor.score}
                      {motor.score != null && <span className="text-xl font-extrabold text-slate-500">/100</span>}
                    </div>
                    <div className="text-sm font-medium text-slate-500">{motorScoreVerdict(motor)}</div>
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white">
                      <div
                        className={`h-full rounded-full ${MOTOR_BAR_CLASS[motorScoreTone(motor)]}`}
                        style={{ width: `${motor.score ?? 0}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">{motorScoreCaption(motor)}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3 items-center w-full">
                {!isDataEntry && (
                  <Button variant="outline" className="border-slate-200 bg-white shrink-0" onClick={shareReport} disabled={!canShare || busy === "share"}>
                    <Copy className="mr-2 h-4 w-4" />
                    {t("policy_detail.share_report")}
                  </Button>
                )}
                <Button variant="destructive" className="shrink-0" onClick={() => setDeleteOpen(true)} disabled={busy === "delete"}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("common.delete")}
                </Button>
              </div>

              {/* Gated on the report, not just the token. A policy can hold a
                  share token with no report behind it - every data-entry type
                  never produces one, and a health policy whose analysis failed
                  does not either. Showing the link anyway invited the agent to
                  copy an address that answers "report_not_ready" to their
                  customer. The Share button above has always been gated this
                  way; this block was not. */}
              {shareToken && canShare && (
                <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#0D9488]/10 bg-slate-50 p-4">
                  <div className="min-w-0 flex-1 truncate text-sm text-slate-700">{shareLink}</div>
                  <Button size="sm" className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={() => void copyText(shareLink, t("policy_detail.report_link_copied"), t)}>
                    <Copy className="mr-2 h-4 w-4" />
                    {t("policy_detail.copy")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extra cover fed into this audit, so it's clear what the report saw. */}
          {companions.length > 0 && (
            <Card className="border-slate-100 shadow-sm">
              <CardHeader><CardTitle>{t("policy_detail.also_read")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-slate-600">
                  {t("policy_detail.also_read_desc")}
                </p>
                <ul className="space-y-1.5">
                  {companions.map((c, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                      <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                      <span className="break-all">
                        <span className="font-semibold">{COMPANION_KEY[c.kind] ? t(COMPANION_KEY[c.kind]) : c.kind}</span>
                        {c.declaredOnly
                          ? t("policy_detail.declared_only")
                          : c.filename
                          ? `: ${c.filename}${c.read ? "" : t("policy_detail.could_not_read")}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Data-entry types show an editable details form; health shows the full audit report. */}
          {isDataEntry ? (
            policy.status === "done" ? (
              <div className="space-y-6">
                {/* Motor only, and it renders nothing unless the document was
                    actually read. The summary sits above the fields it was
                    read from. */}
                <AddOnChecklist data={extractedData} />
                <ExtractedDataForm
                  clientId={policy.id}
                  insuranceType={insuranceType}
                  initialData={extractedData}
                  onSaved={() => void loadDetail()}
                />
                {/* Life and term policies also get the value schedule worked out
                    from those same fields — arithmetic only, no analysis run. */}
                {(insuranceType === "life" || insuranceType === "term") && (
                  <PolicyValueChart
                    clientId={policy.id}
                    insuranceType={insuranceType}
                    data={extractedData}
                    onSaved={() => void loadDetail()}
                  />
                )}
              </div>
            ) : (
              <Card className="border-slate-100 shadow-sm">
                <CardContent className="p-8 text-center text-slate-400 text-sm italic">
                  {policy.status === "error"
                    ? t("policy_detail.doc_unreadable")
                    : t("policy_detail.doc_reading")}
                </CardContent>
              </Card>
            )
          ) : reportData ? (
            <>
            {locale === "hi" && (
              <p className="text-sm text-slate-500">{t("policy_detail.report_in_english")}</p>
            )}
            {/* reportData is validated at runtime by validateForensicAuditReport.
                The double cast this used to carry existed only because the frontend
                and backend each had their own ForensicAuditReport; there is now one. */}
            <PolicyAuditReport
              data={reportData}
              hideNav
              pdfMeta={{
                insurer: policy.insurer_name,
                // product_name only: product_name_suggested is a guess, and a guess
                // must not be printed as the policy's name in a downloadable record.
                policyName: policy.product_name,
                policyNumber: policy.policy_number,
                policyholderName: policy.client_name,
                generatedAt: policy.last_analyzed_at ?? policy.created_at,
              }}
            />
            </>
          ) : (
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-8 text-center text-slate-400 text-sm italic">
                {/* A failed run is not a running one. Without this branch the
                    card promised an update that was never coming, and the row's
                    own error_message, which My Queue has always shown, stayed
                    hidden here. The reason comes off the row when it has one;
                    the remedy is always spelled out, because the reason alone
                    never says what to do next. */}
                {policy.status === "error" ? (
                  <div className="mx-auto max-w-xl text-left not-italic">
                    <div className="text-sm font-semibold text-slate-700">{t("policy_detail.check_failed")}</div>
                    {/* Verbatim, and scrollable rather than truncated: the agent
                        lane stores the raw error on purpose so agents and admin
                        can triage from it. Some real rows hold kilobytes of
                        provider JSON, so it is boxed instead of set loose in a
                        centred card. */}
                    <div className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      {policy.error_message || t("policy_detail.no_reason")}
                    </div>
                    <div className="mt-3 text-sm text-slate-500">
                      {t("policy_detail.check_failed_hint")}
                    </div>
                  </div>
                ) : policy.status === "done" ? (
                  t("policy_detail.bad_format")
                ) : (
                  t("policy_detail.in_progress")
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <Card ref={clientCardRef} className="border-slate-100 shadow-sm">
                <CardHeader><CardTitle>{t("policy_detail.client_details")}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {!editOpen ? (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("policy_detail.full_name")}</div><div className="mt-1 text-sm font-semibold text-slate-900">{policy.client_name || "-"}</div></div>
                        <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("policy_detail.identifier")}</div><div className="mt-1 text-sm font-semibold text-slate-900">{policy.client_identifier || "-"}</div></div>
                        <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("policy_detail.email")}</div><div className="mt-1 text-sm font-semibold text-slate-900">{clientMeta.email || "-"}</div></div>
                        <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("policy_detail.phone")}</div><div className="mt-1 text-sm font-semibold text-slate-900">{clientMeta.phone || "-"}</div></div>
                      </div>
                      <Button variant="outline" className="border-slate-200 bg-white" onClick={() => setEditOpen(true)}>{t("policy_detail.edit_client")}</Button>
                    </>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder={t("policy_detail.ph_client_name")} />
                      <Input value={draftIdentifier} onChange={(event) => setDraftIdentifier(event.target.value)} placeholder={t("policy_detail.ph_identifier")} />
                      <Input value={draftClientMeta.email} onChange={(event) => setDraftClientMeta((current) => ({ ...current, email: event.target.value }))} placeholder={t("policy_detail.email")} />
                      <Input value={draftClientMeta.phone} onChange={(event) => setDraftClientMeta((current) => ({ ...current, phone: event.target.value }))} placeholder={t("policy_detail.phone")} />
                      <div className="md:col-span-2 flex gap-3">
                        <Button className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={saveClientDetails} disabled={busy === "client"}>{t("policy_detail.save_details")}</Button>
                        <Button variant="outline" className="border-slate-200 bg-white" onClick={() => setEditOpen(false)}>{t("common.cancel")}</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-100 shadow-sm">
                <CardHeader><CardTitle>{t("policy_detail.agent_notes")}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={7} placeholder={t("policy_detail.ph_notes")} />
                  <Button className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={saveNotes} disabled={busy === "notes"}>{t("policy_detail.save_notes")}</Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <CustomerTagCard
                clientId={policy.id}
                customerId={customerId}
                hint={{ name: policy.client_name, phone: clientMeta.phone, email: clientMeta.email }}
                onChanged={() => void loadDetail()}
              />

              <Card className="border-slate-100 shadow-sm">
                <CardHeader><CardTitle>{t("policy_detail.upload_meta")}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("policy_detail.filename")}</div><div className="mt-1 text-sm font-semibold text-slate-900">{fileMeta?.file_path?.split("/").pop() || t("policy_detail.unavailable")}</div></div>
                  <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("policy_detail.upload_date")}</div><div className="mt-1 text-sm font-semibold text-slate-900">{fileMeta?.uploaded_at ? new Date(fileMeta.uploaded_at).toLocaleString(intlLocale(locale)) : t("policy_detail.unavailable")}</div></div>
                  <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("policy_detail.file_size")}</div><div className="mt-1 text-sm font-semibold text-slate-900">{t("policy_detail.unavailable")}</div></div>
                  <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("policy_detail.current_status")}</div><div className="mt-1 text-sm font-semibold text-slate-900">{tOr(t, `common.status_${policy.status || "pending"}`, policy.status?.replaceAll("_", " ") || "pending")}</div></div>
                  <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("policy_detail.last_analyzed")}</div><div className="mt-1 text-sm font-semibold text-slate-900">{policy.last_analyzed_at ? new Date(policy.last_analyzed_at).toLocaleString(intlLocale(locale)) : t("policy_detail.not_recorded")}</div></div>
                </CardContent>
              </Card>

              <Card className="border-slate-100 shadow-sm">
                <CardHeader><CardTitle>{t("policy_detail.actions")}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full bg-[#0D9488] hover:bg-[#0f766e]" onClick={rerunAnalysis} disabled={busy === "rerun" || policy.status === "processing"}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${busy === "rerun" || policy.status === "processing" ? "animate-spin" : ""}`} />
                    {isDataEntry ? t("policy_detail.reread") : t("policy_detail.rerun")}
                  </Button>
                  <Button variant="outline" className="w-full border-slate-200 bg-white" onClick={openClientEditor}>{t("policy_detail.edit_client")}</Button>
                  {!isDataEntry && (
                    <Button variant="outline" className="w-full border-slate-200 bg-white" onClick={shareReport} disabled={!canShare || busy === "share"}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {t("policy_detail.share_link")}
                    </Button>
                  )}
                  <Button variant="destructive" className="w-full" onClick={() => setDeleteOpen(true)} disabled={busy === "delete"}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("common.delete")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void deletePolicy()}
        title={t("policy_detail.confirm_title")}
        description={t("policy_detail.confirm_desc")}
        confirmText={busy === "delete" ? t("policy_detail.deleting") : t("policy_detail.delete_policy")}
        variant="destructive"
      />
    </div>
  );
}
