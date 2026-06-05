import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, Copy, ExternalLink, FileText, Loader2, RefreshCw, ShieldAlert, UploadCloud } from "lucide-react";
import { PDFDocument } from "pdf-lib";

import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type SessionState = "uploading" | "processing" | "ready" | "failed";
type UploadSession = {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: SessionState;
  policyId?: string;
  reportMarkdown?: string | null;
  summary?: string | null;
  shareToken?: string | null;
  error?: string;
};
type PolicyRow = {
  id: string;
  client_name: string | null;
  insurer_name: string | null;
  product_name: string | null;
  status: string | null;
  score: number | null;
  created_at: string;
};
type ReportRow = {
  id: string;
  policy_id: string;
  score: number | null;
  summary: string | null;
  report_markdown: string | null;
  created_at: string;
};
type HistoryRow = {
  id: string;
  policyholderName: string;
  insurerName: string;
  planName: string;
  uploadDate: string;
  status: "Processing" | "Ready" | "Failed";
  score: number | null;
  shareToken: string | null;
  fileName: string | null;
};

const WAIT_MS = 3000;
const ATTEMPTS = 20;

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const slug = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "-");
const baseName = (value: string) => value.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim();
const makeId = () => {
  // Always use crypto.randomUUID() for proper UUID format
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback: generate a valid UUID v4 format
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
const bytes = (value: number) => (value > 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`);
const shareUrl = (origin: string, token: string | null) => (token ? `${origin}/report/${token}` : "");

async function copy(text: string, title: string) {
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

async function getSnapshot(policyId: string, agentId: string) {
  const [policyRes, reportRes] = await Promise.all([
    supabase
      .from("policies")
      .select("id, client_name, insurer_name, product_name, status, score, created_at")
      .eq("id", policyId)
      .or(`created_by_agent_id.eq.${agentId},assigned_agent_id.eq.${agentId}`)
      .maybeSingle(),
    supabase
      .from("reports")
      .select("id, policy_id, score, summary, report_markdown, created_at")
      .eq("policy_id", policyId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const policy = (policyRes.data as PolicyRow | null) ?? null;
  const report = (((reportRes.data as ReportRow[] | null) ?? [])[0] ?? null) as ReportRow | null;
  const token = report?.id ? await ensureShare(report.id, agentId).catch(() => null) : null;
  return { policy, report, token };
}

export default function AgentUploads() {
  const { agent, creditsRemaining } = useAgent();
  const hasCredits = creditsRemaining > 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [sessions, setSessions] = useState<UploadSession[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const origin = useMemo(() => (typeof window === "undefined" ? "" : window.location.origin), []);

  async function tryUnlockPdf(file: File): Promise<File> {
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      // If the doc is encrypted with a user password we can't proceed — pdf-lib throws above
      // Strip owner-level permissions by saving a fresh copy
      const cleanBuffer = await pdf.save();
      return new File([cleanBuffer], file.name, { type: "application/pdf" });
    } catch {
      // Truly encrypted (user password) — return original and let the backend handle/fail gracefully
      return file;
    }
  }

  function patchSession(id: string, updates: Partial<UploadSession>) {
    setSessions((current) => current.map((session) => (session.id === id ? { ...session, ...updates } : session)));
  }

  async function loadHistory() {
    if (!agent?.agentId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const policiesRes = await supabase
        .from("policies")
        .select("id, client_name, insurer_name, product_name, status, score, created_at")
        .or(`created_by_agent_id.eq.${agent.agentId},assigned_agent_id.eq.${agent.agentId}`)
        .order("created_at", { ascending: false });
      if (policiesRes.error) throw new Error(policiesRes.error.message);

      const policies = (policiesRes.data as PolicyRow[] | null) ?? [];
      const ids = policies.map((policy) => policy.id);
      if (ids.length === 0) {
        setHistory([]);
        return;
      }

      const [filesRes, reportsRes] = await Promise.all([
        supabase.from("policy_files").select("policy_id, file_path, uploaded_at").in("policy_id", ids).order("uploaded_at", { ascending: false }),
        supabase.from("reports").select("id, policy_id, score, summary, report_markdown, created_at").in("policy_id", ids).order("created_at", { ascending: false }),
      ]);
      if (filesRes.error) throw new Error(filesRes.error.message);
      if (reportsRes.error) throw new Error(reportsRes.error.message);

      const reportMap = new Map<string, ReportRow>();
      (((reportsRes.data as ReportRow[] | null) ?? [])).forEach((row) => {
        if (!reportMap.has(row.policy_id)) reportMap.set(row.policy_id, row);
      });
      const fileMap = new Map<string, { file_path: string | null; uploaded_at: string | null }>();
      ((((filesRes.data as { policy_id: string; file_path: string | null; uploaded_at: string | null }[] | null) ?? []))).forEach((row) => {
        if (!fileMap.has(row.policy_id)) fileMap.set(row.policy_id, row);
      });

      const reportIds = Array.from(reportMap.values()).map((report) => report.id);
      const sharesRes =
        reportIds.length === 0
          ? { data: [] as { report_id: string; token: string }[], error: null }
          : await supabase.from("report_shares").select("report_id, token").in("report_id", reportIds).is("revoked_at", null).order("created_at", { ascending: false });
      if (sharesRes.error) throw new Error(sharesRes.error.message);

      const shareMap = new Map<string, string>();
      ((((sharesRes.data as { report_id: string; token: string }[] | null) ?? []))).forEach((row) => {
        if (!shareMap.has(row.report_id)) shareMap.set(row.report_id, row.token);
      });

      setHistory(
        policies.map((policy) => {
          const report = reportMap.get(policy.id) ?? null;
          const file = fileMap.get(policy.id) ?? null;
          return {
            id: policy.id,
            policyholderName: policy.client_name || "Pending extraction",
            insurerName: policy.insurer_name || "Pending analysis",
            planName: policy.product_name || "Uploaded policy PDF",
            uploadDate: file?.uploaded_at || policy.created_at,
            status: report || policy.status === "done" ? "Ready" : policy.status === "failed" ? "Failed" : "Processing",
            score: report?.score ?? policy.score ?? null,
            shareToken: report ? shareMap.get(report.id) ?? null : null,
            fileName: file?.file_path ? file.file_path.split("/").pop() ?? null : null,
          };
        })
      );
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Could not load upload history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, [agent?.agentId]);

  async function triggerAnalysis(policyId: string, filePath: string, fileName: string) {
    const payload = { policyId, agentId: agent?.agentId, filePath, fileName };
    // Note: /api/agent/analyze expects file upload, not JSON, so we skip it
    const targets = ["/api/agent/analyze-policy", `/api/policies/${policyId}/analyze`, "/api/analyses"];

    for (const target of targets) {
      try {
        const res = await apiFetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) return true;
      } catch {
        // try next endpoint
      }
    }

    try {
      await supabase.from("analysis_jobs").insert({
        policy_id: policyId,
        triggered_by_agent_id: agent?.agentId,
        status: "queued",
        pipeline_version: "agent-dashboard",
        model_name: "gemini",
      });
    } catch {
      // best-effort; do not block UX if insert fails
    }
    return false;
  }

  async function watchResult(sessionId: string, policyId: string) {
    if (!agent?.agentId) return;
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      await sleep(WAIT_MS);
      const { policy, report, token } = await getSnapshot(policyId, agent.agentId);
      if (report) {
        patchSession(sessionId, {
          status: "ready",
          progress: 100,
          reportMarkdown: report.report_markdown,
          summary: report.summary,
          shareToken: token,
        });
        void loadHistory();
        return;
      }
      if (policy?.status === "failed") {
        patchSession(sessionId, { status: "failed", progress: 100, error: "Analysis failed. Re-run it from the policy detail page." });
        void loadHistory();
        return;
      }
    }
    patchSession(sessionId, { status: "processing", progress: 100 });
    void loadHistory();
  }

  async function uploadFile(rawFile: File) {
    if (!agent?.agentId) return;
    const file = await tryUnlockPdf(rawFile);
    const sessionId = makeId();
    const policyId = makeId();
    const filePath = `${agent.agentId}/${policyId}/${slug(file.name)}`;
    setSessions((current) => [{ id: sessionId, fileName: file.name, fileSize: file.size, progress: 10, status: "uploading", policyId }, ...current]);
    setExpandedId(sessionId);

    try {
      const policyRes = await supabase.from("policies").insert({
        id: policyId,
        client_name: baseName(file.name),
        insurer_name: "Pending analysis",
        product_name: "Uploaded policy PDF",
        policy_number: `POL-${Date.now().toString(36).toUpperCase()}`,
        status: "processing",
        created_by_agent_id: agent.agentId,
        assigned_agent_id: agent.agentId,
      });
      if (policyRes.error) throw new Error(policyRes.error.message);
      patchSession(sessionId, { progress: 35 });

      const storageRes = await supabase.storage.from("policy-pdfs").upload(filePath, file, { contentType: "application/pdf", upsert: false });
      if (storageRes.error) throw new Error(storageRes.error.message);
      patchSession(sessionId, { progress: 60, status: "processing" });

      try {
        await supabase.from("policy_files").insert({
          policy_id: policyId,
          file_path: filePath,
          file_type: "policy_pdf",
          uploaded_by_agent_id: agent.agentId,
        });
      } catch {
        // best-effort; do not block UX if insert fails
      }

      const triggered = await triggerAnalysis(policyId, filePath, file.name);
      patchSession(sessionId, { progress: triggered ? 80 : 70, status: "processing" });
      if (!triggered) {
        toast({ title: "Upload stored", description: "Analysis is queued. If the analyzer is offline, re-run from the policy detail page." });
      }
      void watchResult(sessionId, policyId);
      void loadHistory();
    } catch (error) {
      patchSession(sessionId, {
        status: "failed",
        progress: 100,
        error: error instanceof Error ? error.message : "Upload failed.",
      });
      toast({ variant: "destructive", title: "Upload failed", description: error instanceof Error ? error.message : "The PDF could not be uploaded." });
    }
  }

  function handleFiles(input: FileList | File[]) {
    const files = Array.from(input).filter((file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name));
    if (files.length === 0) {
      toast({ variant: "destructive", title: "PDF files only", description: "Please choose policy PDFs." });
      return;
    }
    setPendingFiles(files);
    setConsentChecked(false);
    setShowConsentModal(true);
  }

  function handleConsentConfirm() {
    setShowConsentModal(false);
    pendingFiles.forEach((file) => void uploadFile(file));
    setPendingFiles([]);
  }

  function handleConsentCancel() {
    setShowConsentModal(false);
    setPendingFiles([]);
    setConsentChecked(false);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) handleFiles(event.target.files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) handleFiles(event.dataTransfer.files);
  }

  return (
    <>
      {/* Consent modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 flex-shrink-0">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">PDF Unlock Notice</h2>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  Some policy PDFs have restrictions (print-lock, copy-lock) that block text extraction. IndSure will automatically attempt to strip these restrictions before analysis.
                </p>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  <span className="font-semibold text-slate-800">This works for low-level permission locks.</span> If your PDF requires an open-to-view password, the unlock will fail and analysis may not complete.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-[#0D9488] cursor-pointer flex-shrink-0"
              />
              <span className="text-sm font-medium text-slate-700">
                I understand and consent to IndSure attempting to unlock my PDF{pendingFiles.length > 1 ? "s" : ""} for analysis
              </span>
            </label>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" className="border-slate-200" onClick={handleConsentCancel}>Cancel</Button>
              <Button className="bg-[#0D9488] hover:bg-[#0f766e]" disabled={!consentChecked} onClick={handleConsentConfirm}>
                Continue with upload
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-['Playfair_Display'] text-3xl font-bold text-slate-900">Analyze Policies</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Upload one or more policy PDFs, track each file while analysis runs, and jump straight into the internal policy detail once the report is ready.
          </p>
        </div>
        {hasCredits && (
          <Button variant="outline" className="border-slate-200 bg-white text-slate-600" onClick={() => inputRef.current?.click()}>
            <UploadCloud className="mr-2 h-4 w-4" />
            Select PDFs
          </Button>
        )}
      </div>

      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-0">
          {hasCredits ? (
            <div
              className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${dragging ? "border-[#0D9488] bg-[#0D9488]/5" : "border-[#0D9488]/20 bg-[#0D9488]/[0.04]"}`}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
              onDrop={onDrop}
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#0D9488]/10 text-[#0D9488]">
                <UploadCloud className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-slate-900">Drop policy PDFs here</h2>
              <p className="mt-2 text-sm text-slate-500">PDF only, multiple files supported, and each file gets its own live processing status.</p>
              <div className="mt-6">
                <Button className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={() => inputRef.current?.click()}>Choose Files</Button>
              </div>
              <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={onInputChange} />
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <UploadCloud className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-slate-700">Analysis unavailable</h2>
              <p className="mt-2 text-sm text-slate-500">You have no credits remaining. Contact your admin to top up.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {sessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Current uploads</h2>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{sessions.length} active</span>
          </div>
          {sessions.map((session) => {
            const url = shareUrl(origin, session.shareToken ?? null);
            const expanded = expandedId === session.id;
            return (
              <Card key={session.id} className="border-slate-100 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><FileText className="h-5 w-5" /></div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{session.fileName}</div>
                          <div className="text-xs text-slate-500">{bytes(session.fileSize)}</div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${session.status === "ready" ? "bg-emerald-50 text-emerald-700" : session.status === "failed" ? "bg-red-50 text-red-700" : session.status === "processing" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                          {session.status === "failed" ? <AlertTriangle className="h-3.5 w-3.5" /> : <Loader2 className={`h-3.5 w-3.5 ${session.status === "ready" ? "" : "animate-spin"}`} />}
                          {session.status}
                        </span>
                        {session.policyId && <Link to={`/agent/policies/${session.policyId}`} className="text-sm font-semibold text-[#0D9488] hover:underline">Open policy</Link>}
                        {session.shareToken && <button type="button" className="text-sm font-semibold text-slate-600 hover:text-slate-900" onClick={() => void copy(url, "Report link copied")}>Copy link</button>}
                      </div>
                      <div className="mt-4">
                        <Progress value={session.progress} className="h-2 bg-slate-100" />
                        <div className="mt-2 text-xs text-slate-500">{session.error || (session.status === "ready" ? "Analysis completed and linked." : "Uploading and waiting for the report to land.")}</div>
                      </div>
                    </div>
                    {session.reportMarkdown && <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={() => setExpandedId(expanded ? null : session.id)}>{expanded ? "Hide report" : "View report"}</Button>}
                  </div>
                  {expanded && session.reportMarkdown && (
                    <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                      {session.summary && <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{session.summary}</div>}
                      <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{session.reportMarkdown}</pre>
                      {session.shareToken && (
                        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#0D9488]/10 bg-white p-4">
                          <div className="min-w-0 flex-1 truncate text-sm text-slate-700">{url}</div>
                          <Button size="sm" className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={() => void copy(url, "Report link copied")}><Copy className="mr-2 h-4 w-4" />Copy</Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Upload history</h2>
          <Button variant="outline" size="sm" className="border-slate-200 bg-white text-slate-600" onClick={() => void loadHistory()} disabled={historyLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${historyLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {historyError ? (
          <InlineErrorState onRetry={loadHistory} />
        ) : (
          <Card className="overflow-hidden border-slate-100 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-white">
              <CardTitle className="text-base font-semibold text-slate-900">All past uploads for this agent</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Policyholder</th>
                      <th className="px-6 py-4">Company / Plan</th>
                      <th className="px-6 py-4">Upload date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Score</th>
                      <th className="px-6 py-4">Shareable link</th>
                      <th className="px-6 py-4 text-right">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyLoading && <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading upload history...</td></tr>}
                    {!historyLoading && history.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">No uploaded policies yet.</td></tr>}
                    {!historyLoading && history.map((item) => {
                      const url = shareUrl(origin, item.shareToken ?? null);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="px-6 py-4"><div className="font-semibold text-slate-900">{item.policyholderName}</div><div className="text-xs text-slate-500">{item.fileName || "Uploaded PDF"}</div></td>
                          <td className="px-6 py-4"><div className="font-medium text-slate-800">{item.insurerName}</div><div className="text-xs text-slate-500">{item.planName}</div></td>
                          <td className="px-6 py-4 text-slate-600">{new Date(item.uploadDate).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                          <td className="px-6 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${item.status === "Ready" ? "bg-emerald-50 text-emerald-700" : item.status === "Failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{item.status}</span></td>
                          <td className="px-6 py-4 font-semibold text-slate-900">{item.score == null ? "-" : item.score}</td>
                          <td className="px-6 py-4">{url ? <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D9488] hover:underline" onClick={() => void copy(url, "Share link copied")}><Copy className="h-4 w-4" />Copy link</button> : <span className="text-xs text-slate-400">Unavailable</span>}</td>
                          <td className="px-6 py-4 text-right"><Link to={`/agent/policies/${item.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D9488] hover:underline">View policy<ExternalLink className="h-3.5 w-3.5" /></Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </>
  );
}
