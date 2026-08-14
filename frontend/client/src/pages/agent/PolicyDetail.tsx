import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Copy, ExternalLink, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

import { InlineErrorState } from "@/components/agent/InlineErrorState";
import CustomerTagCard from "@/components/agent/CustomerTagCard";
import ExtractedDataForm from "@/components/agent/ExtractedDataForm";
import { PolicyAuditReport } from "@/components/PolicyAuditReport";
import { isDataEntryType, typeLabel } from "@/lib/insuranceTypes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { rerunPolicy } from "@/lib/rerun";
import { supabase } from "@/lib/supabase";
import { validateForensicAuditReport, type ForensicAuditReport } from "@/lib/policy-types";

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
type FileRow = {
  file_path: string | null;
  uploaded_at: string | null;
};
type ClientMeta = { email: string; phone: string };

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

async function copyText(text: string, title: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ variant: "success", title, description: "Link copied to clipboard." });
  } catch {
    toast({ variant: "destructive", title: "Copy failed", description: "Clipboard access was blocked." });
  }
}

export default function PolicyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { agent } = useAgent();
  const [policy, setPolicy] = useState<PolicyRow | null>(null);
  const [reportData, setReportData] = useState<ForensicAuditReport | null>(null);
  const [insuranceType, setInsuranceType] = useState<string>("health");
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
  const scoreMeta = scoreTone(score);
  const expiry = expiryMeta(policy?.policy_end_date ?? null);
  const isDataEntry = isDataEntryType(insuranceType);

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
          insurance_type, extracted_data, customer_id
        `)
        .eq("id", id)
        .eq("agent_id", agent.agentId)
        .maybeSingle();

      if (policyRes.error) throw new Error(policyRes.error.message);

      const clientData = policyRes.data;
      if (!clientData) throw new Error("Policy not found.");

      // Map clients data to policy structure
      const nextPolicy: PolicyRow = {
        id: clientData.id,
        client_name: clientData.policyholder_name || clientData.name,
        client_identifier: clientData.policy_identifier,
        insurer_name: clientData.insurer,
        product_name: clientData.policy_name,
        policy_number: clientData.policy_name,
        status: clientData.status,
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
      setError(loadError instanceof Error ? loadError.message : "Could not load policy detail.");
    } finally {
      setLoading(false);
    }
  }

  const statusRef = useRef<string | null>(null);
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
      toast({ variant: "success", title: "Client details updated" });
    } catch (saveError) {
      toast({ variant: "destructive", title: "Update failed", description: saveError instanceof Error ? saveError.message : "Could not update client details." });
    } finally {
      setBusy(null);
    }
  }

  async function shareReport() {
    if (!policy?.id || !agent?.agentId) return;
    setBusy("share");
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Toggle share to enabled
      const res = await fetch(`/api/agent/clients/${policy.id}/share/toggle`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ enabled: true })
      });

      if (!res.ok) {
        throw new Error("Failed to generate share link");
      }

      const { shareUrl, shareToken: newToken } = await res.json();
      setShareToken(newToken);

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      
      toast({
        variant: "success",
        title: "Link copied",
        description: "Share link copied to clipboard"
      });
    } catch (shareError) {
      toast({
        variant: "destructive",
        title: "Share failed",
        description: shareError instanceof Error ? shareError.message : "Could not create share link"
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
        title: "Re-analyzing",
        description: "Processing from the stored document — this page updates automatically.",
      });

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
      const update = await supabase
        .from("clients")
        .delete()
        .eq("id", policy.id);
      if (update.error) throw new Error(update.error.message);

      toast({ variant: "success", title: "Policy deleted" });
      setLocation("/agent/policies");
    } catch (deleteError) {
      toast({ variant: "destructive", title: "Delete failed", description: deleteError instanceof Error ? deleteError.message : "Could not delete policy." });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <InlineErrorState onRetry={loadDetail} />;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="text-slate-600" onClick={() => setLocation("/agent/policies")}>
          Back to policies
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={loadDetail} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {!isDataEntry && (
            <Button size="sm" className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={shareReport} disabled={!reportData || busy === "share"}>
              Share Report
            </Button>
          )}
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
                    <span className="inline-flex rounded-full bg-[#0D9488]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0D9488]">
                      {typeLabel(insuranceType)}
                    </span>
                  </div>
                  <div>
                    <h1 className="font-['Playfair_Display'] text-4xl font-bold text-slate-900">{policy.client_name || "Pending policyholder"}</h1>
                    <p className="mt-2 text-sm text-slate-500">
                      {policy.insurer_name || "Pending insurer"} · {policy.product_name || "Pending plan"} · {policy.policy_number || policy.id}
                    </p>
                  </div>
                </div>

                {!isDataEntry && (
                  <div className="min-w-[280px] rounded-3xl border border-slate-100 bg-slate-50 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Score</div>
                    <div className={`mt-2 text-4xl font-black ${scoreMeta.color}`}>{score == null ? "-" : score}</div>
                    <div className="text-sm font-medium text-slate-500">{scoreMeta.label}</div>
                    <Progress value={scoreMeta.bar} className="mt-4 h-2 bg-white" />
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3 items-center w-full">
                {!isDataEntry && (
                  <Button variant="outline" className="border-slate-200 bg-white shrink-0" onClick={shareReport} disabled={!reportData || busy === "share"}>
                    <Copy className="mr-2 h-4 w-4" />
                    Share Report
                  </Button>
                )}
                <Button variant="destructive" className="shrink-0" onClick={() => setDeleteOpen(true)} disabled={busy === "delete"}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>

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

          {/* Data-entry types show an editable details form; health shows the full audit report. */}
          {isDataEntry ? (
            policy.status === "done" ? (
              <ExtractedDataForm
                clientId={policy.id}
                insuranceType={insuranceType}
                initialData={extractedData}
                onSaved={() => void loadDetail()}
              />
            ) : (
              <Card className="border-slate-100 shadow-sm">
                <CardContent className="p-8 text-center text-slate-400 text-sm italic">
                  {policy.status === "error"
                    ? "We couldn't read this document. Try deleting and re-uploading an unlocked PDF."
                    : "Reading the document… this page will update automatically."}
                </CardContent>
              </Card>
            )
          ) : reportData ? (
            // reportData is validated at runtime; the frontend policy-types and backend
            // ForensicAuditReport definitions diverge only on optional modifiers, so cast.
            <PolicyAuditReport data={reportData as unknown as React.ComponentProps<typeof PolicyAuditReport>["data"]} hideNav />
          ) : (
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-8 text-center text-slate-400 text-sm italic">
                {policy.status === "done"
                  ? "Analysis data is in an unexpected format. Try re-running analysis."
                  : "Analysis is still in progress. This page will update automatically."}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
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
              <CustomerTagCard
                clientId={policy.id}
                customerId={customerId}
                hint={{ name: policy.client_name, phone: clientMeta.phone, email: clientMeta.email }}
                onChanged={() => void loadDetail()}
              />

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
                  <Button className="w-full bg-[#0D9488] hover:bg-[#0f766e]" onClick={rerunAnalysis} disabled={busy === "rerun" || policy.status === "processing"}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${busy === "rerun" || policy.status === "processing" ? "animate-spin" : ""}`} />
                    {isDataEntry ? "Re-read Document" : "Re-run Analysis"}
                  </Button>
                  <Button variant="outline" className="w-full border-slate-200 bg-white" onClick={() => setEditOpen(true)}>Edit Client Details</Button>
                  {!isDataEntry && (
                    <Button variant="outline" className="w-full border-slate-200 bg-white" onClick={shareReport} disabled={!reportData || busy === "share"}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Share Link
                    </Button>
                  )}
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
