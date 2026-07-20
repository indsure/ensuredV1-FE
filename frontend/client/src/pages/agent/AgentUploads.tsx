import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Upload, FileText, AlertCircle, AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { getValidSession } from "@/lib/auth-helper";
import { useLanguage } from "@/i18n/LanguageContext";
import { getApiBase } from "@/lib/queryClient";
import { TYPE_META, type InsuranceType } from "@/lib/insuranceTypes";
import { supabase } from "@/lib/supabase";

type UploadStatus = {
  filename: string;
  status: "pending" | "uploading" | "analyzing" | "completed" | "error";
  clientId?: string;
  jobId?: string;
  error?: string;
  progress?: number;
};

export default function AgentUploads() {
  const [, setLocation] = useLocation();
  const { agent } = useAgent();
  const { t } = useLanguage();
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [insuranceType, setInsuranceType] = useState<InsuranceType>("health");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [policyIdentifier, setPolicyIdentifier] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Names of policies this agent has already uploaded, so we can warn that a
  // re-upload will run a fresh analysis (and spend another credit on health).
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());

  // ".pdf" is stripped so an uploaded "Optima Secure.pdf" still matches a
  // stored policy_name of "Optima Secure".
  const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\.pdf$/, "");

  useEffect(() => {
    if (!agent?.agentId) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("policy_name, filename")
        .eq("agent_id", agent.agentId);
      if (!active) return;
      const names = new Set<string>();
      for (const row of data ?? []) {
        if (row.policy_name) names.add(normalizeName(String(row.policy_name)));
        if (row.filename) names.add(normalizeName(String(row.filename)));
      }
      setExistingNames(names);
    })();
    return () => { active = false; };
  }, [agent?.agentId]);

  // Pending files whose name matches a policy already in this agent's account.
  const duplicateNames = useMemo(
    () => pendingFiles.filter((f) => existingNames.has(normalizeName(f.name))).map((f) => f.name),
    [pendingFiles, existingNames]
  );

  const processFiles = async (acceptedFiles: File[]) => {
    if (!agent?.agentId) {
      toast({ variant: "destructive", title: "Error", description: "Agent not authenticated" });
      return;
    }

    if (acceptedFiles.length === 0) return;

    // Validate file sizes
    const maxSize = 25 * 1024 * 1024; // 25MB
    const invalidFiles = acceptedFiles.filter(f => f.size > maxSize);
    if (invalidFiles.length > 0) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: `${invalidFiles[0].name} exceeds 25MB limit`
      });
      return;
    }

    setIsProcessing(true);

    // Initialize upload statuses
    const initialStatuses: UploadStatus[] = acceptedFiles.map(file => ({
      filename: file.name,
      status: "pending",
      progress: 0
    }));
    setUploads(initialStatuses);

    // Process files sequentially
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      
      try {
        // Update status to uploading
        setUploads(prev => prev.map((u, idx) =>
          idx === i ? { ...u, status: "uploading", progress: 10 } : u
        ));

        // Get auth token with automatic refresh
        let session;
        try {
          session = await getValidSession();
        } catch (authError: any) {
          if (authError.message.includes('Not authenticated') || authError.message.includes('Session expired')) {
            toast({
              variant: "destructive",
              title: "Session expired",
              description: "Please log in again"
            });
            setLocation("/agent/login");
            return;
          }
          throw authError;
        }

        // Build FormData
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", insuranceType);
        if (clientName) formData.append("policyholder_name", clientName);
        if (clientEmail) formData.append("client_email", clientEmail);
        if (clientPhone) formData.append("client_phone", clientPhone);
        if (policyIdentifier) formData.append("policy_identifier", policyIdentifier);

        // Upload and start analysis
        const uploadRes = await fetch(`${getApiBase()}/api/agent/analyze`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          },
          body: formData
        });

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json();
          
          // Handle auth errors specifically
          if (uploadRes.status === 401) {
            console.error('[Upload] 401 Unauthorized error:', errorData);
            console.error('[Upload] Session token:', session.access_token?.substring(0, 20) + '...');
            console.error('[Upload] Session expires at:', new Date((session.expires_at || 0) * 1000).toISOString());
            toast({
              variant: "destructive",
              title: "Authentication failed",
              description: "Your session has expired. Please log in again."
            });
            setLocation("/agent/login");
            return;
          }
          
          throw new Error(errorData.error || "Upload failed");
        }

        const { clientId, jobId } = await uploadRes.json();

        // Update status to analyzing
        setUploads(prev => prev.map((u, idx) =>
          idx === i ? { ...u, status: "analyzing", clientId, jobId, progress: 30 } : u
        ));

        // Poll for completion
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes max (5s intervals)
        
        const pollInterval = setInterval(async () => {
          attempts++;
          
          try {
            const statusRes = await fetch(`${getApiBase()}/api/agent/analyze/status/${jobId}`, {
              headers: {
                "Authorization": `Bearer ${session.access_token}`
              }
            });

            if (!statusRes.ok) {
              throw new Error("Status check failed");
            }

            const statusData = await statusRes.json();

            if (statusData.status === "completed") {
              clearInterval(pollInterval);
              setUploads(prev => prev.map((u, idx) =>
                idx === i ? { ...u, status: "completed", progress: 100 } : u
              ));
            } else if (statusData.status === "error") {
              clearInterval(pollInterval);
              setUploads(prev => prev.map((u, idx) =>
                idx === i ? { ...u, status: "error", error: statusData.error, progress: 0 } : u
              ));
            } else {
              // Still processing - update progress
              const progress = Math.min(30 + (attempts * 2), 90);
              setUploads(prev => prev.map((u, idx) =>
                idx === i ? { ...u, progress } : u
              ));
            }

            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setUploads(prev => prev.map((u, idx) =>
                idx === i ? { ...u, status: "error", error: "Analysis timeout", progress: 0 } : u
              ));
            }
          } catch (pollError: any) {
            clearInterval(pollInterval);
            setUploads(prev => prev.map((u, idx) =>
              idx === i ? { ...u, status: "error", error: pollError.message, progress: 0 } : u
            ));
          }
        }, 5000); // Poll every 5 seconds

      } catch (error: any) {
        setUploads(prev => prev.map((u, idx) =>
          idx === i ? { ...u, status: "error", error: error.message, progress: 0 } : u
        ));
      }
    }

    setIsProcessing(false);
  };

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    let files = acceptedFiles;
    // Health runs a full audit and uses a credit per policy, so it stays one-at-a-time.
    // Every other (data-entry) type can be uploaded in a batch.
    if (insuranceType === "health" && files.length > 1) {
      files = [files[0]];
      toast({
        title: "One health policy at a time",
        description: `Only "${files[0].name}" will be analysed — health policies run a full audit and use 1 policy check each. Upload the rest individually.`,
      });
    }

    setPendingFiles(files);
    setConsentChecked(false);
    setShowConsentModal(true);
  };

  function handleConsentConfirm() {
    setShowConsentModal(false);
    void processFiles(pendingFiles);
    setPendingFiles([]);
  }

  function handleConsentCancel() {
    setShowConsentModal(false);
    setPendingFiles([]);
    setConsentChecked(false);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
    disabled: isProcessing,
  });

  const completedCount = uploads.filter(u => u.status === "completed").length;
  const errorCount = uploads.filter(u => u.status === "error").length;
  const allDone = uploads.length > 0 && uploads.every(u => u.status === "completed" || u.status === "error");

  const handleViewResults = () => {
    if (completedCount === 1) {
      const completed = uploads.find(u => u.status === "completed");
      if (completed?.clientId) {
        setLocation(`/agent/policies/${completed.clientId}`);
      }
    } else {
      setLocation("/agent/policies");
    }
  };

  return (
    <>
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 flex-shrink-0">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{t("uploads.consent_title")}</h2>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">{t("uploads.consent_body")}</p>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{t("uploads.consent_ilovepdf")}</p>
                <a
                  href="https://www.ilovepdf.com/unlock_pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D9488] hover:underline"
                >
                  {t("uploads.consent_link")}
                </a>
                <p className="mt-3 text-sm text-slate-600">{t("uploads.consent_after")}</p>
              </div>
            </div>

            {duplicateNames.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-bold">{t("uploads.reupload_title")}</p>
                  <p className="mt-1 font-medium break-words">{duplicateNames.map((n) => `"${n}"`).join(", ")}</p>
                  <p className="mt-1">
                    {insuranceType === "health"
                      ? t("uploads.reupload_body_credit")
                      : t("uploads.reupload_body_free")}
                  </p>
                </div>
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-[#0D9488] cursor-pointer flex-shrink-0"
              />
              <span className="text-sm font-medium text-slate-700">{t("uploads.consent_checkbox")}</span>
            </label>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" className="border-slate-200" onClick={handleConsentCancel}>{t("uploads.consent_cancel")}</Button>
              <Button className="bg-[#0D9488] hover:bg-[#0f766e]" disabled={!consentChecked} onClick={handleConsentConfirm}>
                {t("uploads.consent_confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("uploads.title")}</h1>
      </div>

      {/* Insurance-type selector */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(TYPE_META) as InsuranceType[]).map((tkey) => {
            const meta = TYPE_META[tkey];
            const active = insuranceType === tkey;
            return (
              <button
                key={tkey}
                type="button"
                onClick={() => setInsuranceType(tkey)}
                disabled={isProcessing}
                className={[
                  "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
                  active
                    ? "border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488] shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                  isProcessing ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <span>{meta.emoji}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {insuranceType === "health"
            ? "Full risk analysis — generates a score and audit report. Uploaded one at a time; each one uses 1 policy check."
            : `${TYPE_META[insuranceType].label} — drop as many policies as you like and we'll read each one and fill in the details (data entry only). No risk score, no check used.`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Upload Area */}
        <Card className="border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle>{t("uploads.policy_documents")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                ${isDragActive
                  ? "border-[#0D9488] bg-[#0D9488]/5"
                  : "border-slate-200 hover:border-[#0D9488] hover:bg-slate-50"
                }
                ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <input {...getInputProps()} />
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? "text-[#0D9488]" : "text-slate-400"}`} />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {isDragActive ? t("uploads.drop_active") : t("uploads.drop_prompt")}
              </h3>
              <p className="text-sm text-slate-500">{t("uploads.drop_hint")}</p>
              {insuranceType !== "health" && (
                <p className="mt-1 text-xs font-medium text-[#0D9488]">
                  Tip: select multiple files to upload a batch at once.
                </p>
              )}
            </div>

            {/* Upload Progress */}
            {uploads.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">{t("uploads.upload_progress")}</h4>
                {uploads.map((upload, idx) => (
                  <div key={idx} className="border border-slate-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">{upload.filename}</span>
                      </div>
                      {upload.status === "completed" && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                      {upload.status === "error" && <AlertCircle className="w-5 h-5 text-red-600" />}
                      {(upload.status === "uploading" || upload.status === "analyzing") && (
                        <Loader2 className="w-5 h-5 text-[#0D9488] animate-spin" />
                      )}
                    </div>
                    
                    {/* Progress Bar */}
                    {upload.status !== "error" && upload.status !== "completed" && (
                      <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                        <div
                          className="bg-[#0D9488] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${upload.progress || 0}%` }}
                        />
                      </div>
                    )}
                    
                    <div className="text-xs text-slate-500">
                      {upload.status === "pending" && t("uploads.status_waiting")}
                      {upload.status === "uploading" && t("uploads.status_uploading")}
                      {upload.status === "analyzing" && t("uploads.status_analyzing")}
                      {upload.status === "completed" && t("uploads.status_done")}
                      {upload.status === "error" && (
                        <span className="text-red-600">Error: {upload.error}</span>
                      )}
                    </div>
                  </div>
                ))}

                {allDone && (
                  <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                    <div className="text-sm text-slate-600">
                      {completedCount} {t("uploads.completed_count")} • {errorCount} {t("uploads.failed_count")}
                    </div>
                    <Button
                      onClick={handleViewResults}
                      className="bg-[#0D9488] hover:bg-[#0f766e]"
                    >
                      {t("uploads.view_results")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Details (Optional) */}
        <Card className="border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle>{t("uploads.client_details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                {t("uploads.client_name")}
              </label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={t("uploads.client_name_placeholder")}
                disabled={isProcessing}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                {t("uploads.email")}
              </label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder={t("uploads.email_placeholder")}
                disabled={isProcessing}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                {t("uploads.phone")}
              </label>
              <Input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder={t("uploads.phone_placeholder")}
                disabled={isProcessing}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                {t("uploads.policy_id")}
              </label>
              <Input
                value={policyIdentifier}
                onChange={(e) => setPolicyIdentifier(e.target.value)}
                placeholder={t("uploads.policy_id_placeholder")}
                disabled={isProcessing}
              />
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("uploads.client_details_hint")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
