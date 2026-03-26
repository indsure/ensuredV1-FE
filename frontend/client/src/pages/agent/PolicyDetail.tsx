import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { AlertTriangle, Copy, ExternalLink, FileText, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type PolicyRow = {
  id: string;
  client_name: string | null;
  client_identifier: string | null;
  insurer_name: string | null;
  product_name: string | null;
  policy_number: string | null;
  status: string | null;
  score: number | null;
  created_at: string;
  updated_at: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  last_analyzed_at: string | null;
};
type ReportRow = {
  id: string;
  policy_id: string;
  score: number | null;
  summary: string | null;
  status: string | null;
  report_json: Record<string, unknown> | null;
  report_markdown: string | null;
  created_at: string;
  updated_at: string | null;
};
type FileRow = {
  file_path: string | null;
  uploaded_at: string | null;
};
type ClientMeta = { email: string; phone: string };

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function scoreTone(score: number | null) {
  if (score == null) return { label: "Pending", bar: 0, color: "text-slate-500" };
  if (score >= 75) return { label: "Strong fit", bar: score, color: "text-emerald-600" };
  if (score >= 60) return { label: "Watch", bar: score, color: "text-amber-600" };
  return { label: "Needs action", bar: score, color: "text-red-600" };
}

function expiryMeta(value: string | null) {
  if (!value) return { label: "No expiry data", className: "bg-slate-100 text-slate-600" };
  const end = new Date(value);
  const today = new Date();
  const days = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "Expired", className: "bg-red-50 text-red-700" };
  if (days < 30) return { label: `${days} days left`, className: "bg-red-50 text-red-700" };
  if (days <= 60) return { label: `${days} days left`, className: "bg-amber-50 text-amber-700" };
  return { label: `${days} days left`, className: "bg-emerald-50 text-emerald-700" };
}

function extractBenefits(report: ReportRow | null) {
  if (!report?.report_json) return [];
  const found = new Set<string>();
  const json = report.report_json as Record<string, any>;
  const benefitEvaluation = json.benefit_evaluation;
  if (Array.isArray(benefitEvaluation?.what_actually_works)) {
    benefitEvaluation.what_actually_works.forEach((item: any) => {
      if (item?.benefit) found.add(String(item.benefit));
    });
  }
  const supplementary = json.supplementary_coverage;
  if (supplementary?.opd?.covered) found.add("OPD coverage");
  if (supplementary?.annual_health_checkup?.covered || supplementary?.health_checkup?.covered) found.add("Annual health checkup");
  if (supplementary?.wellness?.covered) found.add("Wellness benefits");
  return Array.from(found);
}

function jsonList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    : [];
}

async function copyText(text: string, title: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ variant: "success", title, description: "Link copied to clipboard." });
  } catch {
    toast({ variant: "destructive", title: "Copy failed", description: "Clipboard access was blocked." });
  }
}

async function ensureShare(reportId: string, agentId: string) {
  const existing = await supabase
    .from("report_shares")
    .select("token")
    .eq("report_id", reportId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!existing.error && existing.data?.token) return existing.data.token;

  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const created = await supabase.from("report_shares").insert({ report_id: reportId, token, created_by_agent_id: agentId });
  if (created.error) throw new Error(created.error.message);
  return token;
}

export default function PolicyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { agent } = useAgent();
  const [policy, setPolicy] = useState<PolicyRow | null>(null);
  const [report, setReport] = useState<ReportRow | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<FileRow | null>(null);
  const [notes, setNotes] = useState("");
  const [clientMeta, setClientMeta] = useState<ClientMeta>({ email: "", phone: "" });
  const [draftClientMeta, setDraftClientMeta] = useState<ClientMeta>({ email: "", phone: "" });
  const [draftName, setDraftName] = useState("");
  const [draftIdentifier, setDraftIdentifier] = useState("");
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const origin = useMemo(() => (typeof window === "undefined" ? "" : window.location.origin), []);
  const shareLink = shareToken ? `${origin}/report/${shareToken}` : "";
  const benefits = useMemo(() => extractBenefits(report), [report]);
  const score = report?.score ?? policy?.score ?? null;
  const scoreMeta = scoreTone(score);
  const expiry = expiryMeta(policy?.policy_end_date ?? null);
  const flawList = jsonList(report?.report_json?.flaws);
  const recommendationList = jsonList(report?.report_json?.recommendations);

  async function loadDetail() {
    if (!id || !agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      const [policyRes, reportRes, fileRes, auditRes] = await Promise.all([
        supabase
          .from("policies")
          .select("id, client_name, client_identifier, insurer_name, product_name, policy_number, status, score, created_at, updated_at, policy_start_date, policy_end_date, last_analyzed_at")
          .eq("id", id)
          .or(`created_by_agent_id.eq.${agent.agentId},assigned_agent_id.eq.${agent.agentId}`)
          .maybeSingle(),
        supabase
          .from("reports")
          .select("id, policy_id, score, summary, status, report_json, report_markdown, created_at, updated_at")
          .eq("policy_id", id)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("policy_files").select("file_path, uploaded_at").eq("policy_id", id).order("uploaded_at", { ascending: false }).limit(1),
        supabase
          .from("audit_logs")
          .select("event_type, metadata, created_at")
          .eq("entity_id", id)
          .in("event_type", ["agent_note_saved", "policy_client_details"])
          .order("created_at", { ascending: false }),
      ]);

      if (policyRes.error) throw new Error(policyRes.error.message);

      const nextPolicy = (policyRes.data as PolicyRow | null) ?? null;
      if (!nextPolicy) throw new Error("Policy not found.");
      const nextReport = (((reportRes.data as ReportRow[] | null) ?? [])[0] ?? null) as ReportRow | null;
      const nextFile = ((((fileRes.data as FileRow[] | null) ?? [])[0] ?? null)) as FileRow | null;

      const logs = (((auditRes.data as { event_type: string; metadata: any }[] | null) ?? []));
      const latestNotes = logs.find((log) => log.event_type === "agent_note_saved")?.metadata?.notes ?? "";
      const latestClient = logs.find((log) => log.event_type === "policy_client_details")?.metadata ?? {};

      setPolicy(nextPolicy);
      setReport(nextReport);
      setFileMeta(nextFile);
      setNotes(latestNotes);
      setClientMeta({
        email: latestClient.email ?? "",
        phone: latestClient.phone ?? "",
      });
      setDraftClientMeta({
        email: latestClient.email ?? "",
        phone: latestClient.phone ?? "",
      });
      setDraftName(nextPolicy.client_name ?? "");
      setDraftIdentifier(nextPolicy.client_identifier ?? "");

      if (nextReport?.id) {
        setShareToken(await ensureShare(nextReport.id, agent.agentId).catch(() => null));
      } else {
        setShareToken(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load policy detail.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [id, agent?.agentId]);

  async function saveNotes() {
    if (!id || !agent?.agentId) return;
    setBusy("notes");
    try {
      const res = await supabase.from("audit_logs").insert({
        event_type: "agent_note_saved",
        actor_agent_id: agent.agentId,
        entity_type: "policy",
        entity_id: id,
        metadata: { notes },
      });
      if (res.error) throw new Error(res.error.message);
      toast({ variant: "success", title: "Notes saved" });
    } catch (saveError) {
      toast({ variant: "destructive", title: "Save failed", description: saveError instanceof Error ? saveError.message : "Could not save notes." });
    } finally {
      setBusy(null);
    }
  }

  async function saveClientDetails() {
    if (!policy || !agent?.agentId) return;
    setBusy("client");
    try {
      const updatePolicy = await supabase
        .from("policies")
        .update({ client_name: draftName, client_identifier: draftIdentifier, updated_at: new Date().toISOString() })
        .eq("id", policy.id);
      if (updatePolicy.error) throw new Error(updatePolicy.error.message);

      const logRes = await supabase.from("audit_logs").insert({
        event_type: "policy_client_details",
        actor_agent_id: agent.agentId,
        entity_type: "policy",
        entity_id: policy.id,
        metadata: { email: draftClientMeta.email, phone: draftClientMeta.phone },
      });
      if (logRes.error) throw new Error(logRes.error.message);

      setEditOpen(false);
      await loadDetail();
      toast({ variant: "success", title: "Client details updated" });
    } catch (saveError) {
      toast({ variant: "destructive", title: "Update failed", description: saveError instanceof Error ? saveError.message : "Could not update client details." });
    } finally {
      setBusy(null);
    }
  }

  async function shareReport() {
    if (!report?.id || !agent?.agentId) return;
    setBusy("share");
    try {
      const token = shareToken || (await ensureShare(report.id, agent.agentId));
      setShareToken(token);
      await copyText(`${origin}/report/${token}`, "Report link copied");
    } catch (shareError) {
      toast({ variant: "destructive", title: "Share failed", description: shareError instanceof Error ? shareError.message : "Could not create a share link." });
    } finally {
      setBusy(null);
    }
  }

  async function rerunAnalysis() {
    if (!policy?.id || !agent?.agentId) return;
    setBusy("rerun");
    try {
      await supabase
        .from("policies")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", policy.id);

      // Best-effort: if this insert fails (e.g., schema/RLS mismatch), we still try the API endpoints below.
      try {
        await supabase.from("analysis_jobs").insert({
          policy_id: policy.id,
          triggered_by_agent_id: agent.agentId,
          status: "queued",
          pipeline_version: "agent-dashboard",
          model_name: "gemini",
        });
      } catch {
        // ignore
      }

      const filePath = fileMeta?.file_path || "";
      const targets = [
        "/api/agent/analyze-policy",
        "/api/agent/analyze",
        `/api/policies/${policy.id}/analyze`,
        "/api/analyses",
      ];
      for (const target of targets) {
        try {
          const res = await apiFetch(target, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              policyId: policy.id,
              agentId: agent.agentId,
              filePath,
            }),
          });
          if (res.ok) break;
        } catch {
          // try next target
        }
      }

      toast({
        title: "Analysis re-queued",
        description: "We will refresh the page once the latest report is available.",
      });
      for (let attempt = 0; attempt < 15; attempt += 1) {
        await delay(3000);
        const latest = await supabase
          .from("reports")
          .select("id")
          .eq("policy_id", policy.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (
          !latest.error &&
          (((latest.data as { id: string }[] | null) ?? [])[0]?.id ?? null) !== report?.id
        )
          break;
      }

      await loadDetail();
    } catch (rerunError) {
      toast({
        variant: "destructive",
        title: "Re-run failed",
        description:
          rerunError instanceof Error
            ? rerunError.message
            : "Could not re-run analysis.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function archivePolicy() {
    if (!policy?.id || !agent?.agentId) return;
    setBusy("delete");
    try {
      await supabase.from("report_shares").update({ revoked_at: new Date().toISOString() }).eq("report_id", report?.id ?? "");
      const update = await supabase
        .from("policies")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", policy.id);
      if (update.error) throw new Error(update.error.message);
      try {
        await supabase.from("audit_logs").insert({
        event_type: "policy_archived",
        actor_agent_id: agent.agentId,
        entity_type: "policy",
        entity_id: policy.id,
        metadata: { archived_from: "agent_detail" },
        });
      } catch {
        // best-effort audit log
      }

      toast({ variant: "success", title: "Policy archived" });
      setLocation("/agent/uploads");
    } catch (deleteError) {
      toast({ variant: "destructive", title: "Delete failed", description: deleteError instanceof Error ? deleteError.message : "Could not archive policy." });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <InlineErrorState onRetry={loadDetail} />;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="text-slate-600" onClick={() => setLocation("/agent/uploads")}>
          Back to uploads
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={loadDetail} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={shareReport} disabled={!report || busy === "share"}>
            Share Report
          </Button>
        </div>
      </div>

      {loading && <Card className="border-slate-100 shadow-sm"><CardContent className="p-10 text-center text-slate-400">Loading policy detail...</CardContent></Card>}

      {!loading && policy && (
        <>
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${expiry.className}`}>{expiry.label}</span>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">
                      {policy.status?.replaceAll("_", " ") || "pending"}
                    </span>
                  </div>
                  <div>
                    <h1 className="font-['Playfair_Display'] text-4xl font-bold text-slate-900">{policy.client_name || "Pending policyholder"}</h1>
                    <p className="mt-2 text-sm text-slate-500">
                      {policy.insurer_name || "Pending insurer"} · {policy.product_name || "Pending plan"} · {policy.policy_number || policy.id}
                    </p>
                  </div>
                </div>

                <div className="min-w-[280px] rounded-3xl border border-slate-100 bg-slate-50 p-5">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Score</div>
                  <div className={`mt-2 text-4xl font-black ${scoreMeta.color}`}>{score == null ? "-" : score}</div>
                  <div className="text-sm font-medium text-slate-500">{scoreMeta.label}</div>
                  <Progress value={scoreMeta.bar} className="mt-4 h-2 bg-white" />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  className={score != null && score < 75 ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}
                  onClick={() =>
                    toast({
                      title: score != null && score < 75 ? "Switch Plan recommended" : "Maintain recommended",
                      description: score != null && score < 75 ? "This policy is scoring below the maintain threshold." : "This policy is currently scoring strong enough to maintain.",
                    })
                  }
                >
                  {score != null && score < 75 ? "Switch Plan" : "Maintain"}
                </Button>
                {benefits.length > 0 && (
                  <Button variant="outline" className="border-slate-200 bg-white" onClick={() => setBenefitsOpen((value) => !value)}>
                    Avail Benefits
                  </Button>
                )}
                <Button variant="outline" className="border-slate-200 bg-white" onClick={shareReport} disabled={!report || busy === "share"}>
                  <Copy className="mr-2 h-4 w-4" />
                  Share Report
                </Button>
                <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={busy === "delete"}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>

              {benefitsOpen && benefits.length > 0 && (
                <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Detected benefits</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {benefits.map((benefit) => (
                      <span key={benefit} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-700">
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {shareToken && (
                <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#0D9488]/10 bg-slate-50 p-4">
                  <div className="min-w-0 flex-1 truncate text-sm text-slate-700">{shareLink}</div>
                  <Button size="sm" className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={() => void copyText(shareLink, "Report link copied")}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <Card className="border-slate-100 shadow-sm">
                <CardHeader><CardTitle>Full analysis report</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  {report?.summary && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{report.summary}</div>}
                  {flawList.length > 0 && (
                    <div>
                      <div className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Detected flaws</div>
                      <div className="space-y-2">{flawList.map((item, index) => <div key={index} className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-700">{item}</div>)}</div>
                    </div>
                  )}
                  {recommendationList.length > 0 && (
                    <div>
                      <div className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Recommendations</div>
                      <div className="space-y-2">{recommendationList.map((item, index) => <div key={index} className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-700">{item}</div>)}</div>
                    </div>
                  )}
                  {report?.report_markdown ? (
                    <pre className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-white p-5 text-sm leading-7 text-slate-700">{report.report_markdown}</pre>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">The full narrative report has not landed yet. You can still re-run analysis from the action bar.</div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-100 shadow-sm">
                <CardHeader><CardTitle>Client details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {!editOpen ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Full name</div><div className="mt-1 text-sm font-semibold text-slate-900">{policy.client_name || "-"}</div></div>
                        <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Policy identifier</div><div className="mt-1 text-sm font-semibold text-slate-900">{policy.client_identifier || "-"}</div></div>
                        <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Email</div><div className="mt-1 text-sm font-semibold text-slate-900">{clientMeta.email || "-"}</div></div>
                        <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Phone</div><div className="mt-1 text-sm font-semibold text-slate-900">{clientMeta.phone || "-"}</div></div>
                      </div>
                      <Button variant="outline" className="border-slate-200 bg-white" onClick={() => setEditOpen(true)}>Edit Client Details</Button>
                    </>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Client name" />
                      <Input value={draftIdentifier} onChange={(event) => setDraftIdentifier(event.target.value)} placeholder="Identifier / relationship / reference" />
                      <Input value={draftClientMeta.email} onChange={(event) => setDraftClientMeta((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
                      <Input value={draftClientMeta.phone} onChange={(event) => setDraftClientMeta((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" />
                      <div className="md:col-span-2 flex gap-3">
                        <Button className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={saveClientDetails} disabled={busy === "client"}>Save details</Button>
                        <Button variant="outline" className="border-slate-200 bg-white" onClick={() => setEditOpen(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-100 shadow-sm">
                <CardHeader><CardTitle>Agent notes</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={7} placeholder="Add private notes for this policy..." />
                  <Button className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={saveNotes} disabled={busy === "notes"}>Save Notes</Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-slate-100 shadow-sm">
                <CardHeader><CardTitle>Upload metadata</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Filename</div><div className="mt-1 text-sm font-semibold text-slate-900">{fileMeta?.file_path?.split("/").pop() || "Unavailable"}</div></div>
                  <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Upload date</div><div className="mt-1 text-sm font-semibold text-slate-900">{fileMeta?.uploaded_at ? new Date(fileMeta.uploaded_at).toLocaleString("en-IN") : "Unavailable"}</div></div>
                  <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">File size</div><div className="mt-1 text-sm font-semibold text-slate-900">Unavailable</div></div>
                  <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Current status</div><div className="mt-1 text-sm font-semibold text-slate-900">{policy.status?.replaceAll("_", " ") || "pending"}</div></div>
                  <div><div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Last analyzed</div><div className="mt-1 text-sm font-semibold text-slate-900">{policy.last_analyzed_at ? new Date(policy.last_analyzed_at).toLocaleString("en-IN") : "Not recorded"}</div></div>
                </CardContent>
              </Card>

              <Card className="border-slate-100 shadow-sm">
                <CardHeader><CardTitle>Action bar</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full bg-[#0D9488] hover:bg-[#0f766e]" onClick={rerunAnalysis} disabled={busy === "rerun"}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${busy === "rerun" ? "animate-spin" : ""}`} />
                    Re-run Analysis
                  </Button>
                  <Button variant="outline" className="w-full border-slate-200 bg-white" onClick={() => setEditOpen(true)}>Edit Client Details</Button>
                  <Button variant="outline" className="w-full border-slate-200 bg-white" onClick={shareReport} disabled={!report || busy === "share"}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Share Link
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={() => setDeleteOpen(true)} disabled={busy === "delete"}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-slate-100 shadow-sm">
                <CardContent className="flex items-start gap-3 p-5">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-[#0D9488]" />
                  <div className="text-sm text-slate-600">
                    Internal detail pages show the unabridged report and agent-only notes. Client shares still go through the public `/report/[token]` route.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void archivePolicy()}
        title="Delete this policy?"
        description="This action archives the policy, revokes active share links, and removes it from the active upload flow."
        confirmText={busy === "delete" ? "Deleting..." : "Delete policy"}
        variant="destructive"
      />
    </div>
  );
}
