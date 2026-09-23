import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Upload, FileText, AlertCircle, AlertTriangle, CheckCircle2, Loader2, ShieldAlert, Layers } from "lucide-react";
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
import { tOr } from "@/i18n";

type UploadStatus = {
  filename: string;
  status: "pending" | "uploading" | "analyzing" | "completed" | "error";
  clientId?: string;
  jobId?: string;
  error?: string;
  progress?: number;
};

/**
 * Other health cover the same person already holds. These ride along with the
 * base health policy in the SAME policy check, so the audit judges their real
 * total protection instead of the base policy in isolation.
 */
const COMPANION_SLOTS = [
  {
    key: "superTopup",
    field: "companion_super_topup",
    label: "uploads.comp_topup",
    hint: "uploads.comp_topup_hint",
  },
  {
    key: "corporate",
    field: "companion_corporate",
    label: "uploads.comp_corporate",
    hint: "uploads.comp_corporate_hint",
  },
] as const;

/** One optional companion-document slot: attach, show, remove. */
function CompanionSlot({
  label,
  hint,
  file,
  onPick,
  disabled,
}: {
  label: string;
  hint: string;
  file: File | null;
  onPick: (file: File | null) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700">{t(label)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t(hint)}</p>
        </div>
        {file ? (
          <button
            type="button"
            onClick={() => onPick(null)}
            disabled={disabled}
            className="flex-shrink-0 text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
          >
            {t("uploads.remove")}
          </button>
        ) : (
          <label
            className={`flex-shrink-0 cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0D9488] hover:bg-slate-50 ${
              disabled ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {t("uploads.attach")}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              disabled={disabled}
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>
      {file && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-600 break-all">
          <FileText className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
          {file.name}
        </p>
      )}
    </div>
  );
}

export default function AgentUploads() {
  const [, setLocation] = useLocation();
  const { agent, ocrRemaining } = useAgent();
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
  // Files chosen but NOT yet sent. Nothing is analysed until the agent presses
  // "Analyze" — they need time to attach the other cover first.
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  // Other health cover the same person holds — health lane only.
  const [superTopupFile, setSuperTopupFile] = useState<File | null>(null);
  const [corporateFile, setCorporateFile] = useState<File | null>(null);
  const [ayushmanFile, setAyushmanFile] = useState<File | null>(null);
  const [hasAyushman, setHasAyushman] = useState(false);

  const companionFiles: Record<string, File | null> = {
    companion_super_topup: superTopupFile,
    companion_corporate: corporateFile,
    companion_ayushman: ayushmanFile,
  };
  const companionCount =
    [superTopupFile, corporateFile, ayushmanFile].filter(Boolean).length + (hasAyushman && !ayushmanFile ? 1 : 0);

  function clearCompanions() {
    setSuperTopupFile(null);
    setCorporateFile(null);
    setAyushmanFile(null);
    setHasAyushman(false);
  }

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

  // Staged files whose name matches a policy already in this agent's account.
  const duplicateNames = useMemo(
    () => stagedFiles.filter((f) => existingNames.has(normalizeName(f.name))).map((f) => f.name),
    [stagedFiles, existingNames]
  );

  const processFiles = async (acceptedFiles: File[]) => {
    if (!agent?.agentId) {
      toast({ variant: "destructive", title: t("uploads.error"), description: t("uploads.not_signed_in") });
      return;
    }

    if (acceptedFiles.length === 0) return;

    // Validate file sizes — companion documents go through the same 25MB cap.
    const maxSize = 25 * 1024 * 1024; // 25MB
    const invalidFiles = [...acceptedFiles, ...Object.values(companionFiles).filter(Boolean) as File[]]
      .filter(f => f.size > maxSize);
    if (invalidFiles.length > 0) {
      toast({
        variant: "destructive",
        title: t("uploads.too_large"),
        description: t("uploads.too_large_desc", { name: invalidFiles[0].name })
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
              title: t("uploads.session_expired"),
              description: t("uploads.log_in_again")
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

        // Other cover the same person holds. Read in the same audit call, so
        // the report reflects the whole stack and still costs 1 policy check.
        if (insuranceType === "health") {
          for (const [field, companion] of Object.entries(companionFiles)) {
            if (companion) formData.append(field, companion);
          }
          // Ayushman Bharat is usually a card, not a document — a tick alone is
          // enough for the audit to account for it.
          if (hasAyushman) formData.append("has_ayushman", "true");
        }

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
            // The token prefix used to be logged here too. A slice of a live
            // access token has no business in the browser console.
            console.error('[Upload] 401 Unauthorized error:', errorData);
            toast({
              variant: "destructive",
              title: t("uploads.auth_failed"),
              description: t("uploads.auth_failed_desc")
            });
            setLocation("/agent/login");
            return;
          }

          // Plan limits: out of policy checks (health) or data-entry allowance.
          if (uploadRes.status === 403 && (errorData.error === "NO_OCR_CREDITS" || errorData.error === "NO_CREDITS")) {
            toast({
              variant: "destructive",
              title: errorData.error === "NO_OCR_CREDITS" ? t("uploads.no_ocr") : t("uploads.no_checks"),
              description: errorData.message,
            });
            throw new Error(errorData.message || errorData.error);
          }

          throw new Error(errorData.error || t("uploads.upload_failed"));
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
              throw new Error(t("uploads.status_failed"));
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
                idx === i ? { ...u, status: "error", error: t("uploads.timeout"), progress: 0 } : u
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

    // The attached covers belong to the policy just sent — clear them so the
    // next upload can't silently carry someone else's documents along.
    clearCompanions();
    setIsProcessing(false);
  };

  // Choosing files only stages them. Analysis starts from the Analyze button,
  // so there is time to attach the other cover (or add more files to a batch).
  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const maxSize = 25 * 1024 * 1024; // 25MB
    const tooBig = acceptedFiles.find((f) => f.size > maxSize);
    if (tooBig) {
      toast({
        variant: "destructive",
        title: t("uploads.too_large"),
        description: t("uploads.too_large_desc", { name: tooBig.name }),
      });
      return;
    }

    setStagedFiles((current) => {
      // Skip files already staged, so dropping the same PDF twice is harmless.
      const seen = new Set(current.map((f) => `${f.name}:${f.size}`));
      const fresh = acceptedFiles.filter((f) => !seen.has(`${f.name}:${f.size}`));
      let next = [...current, ...fresh];

      // Health runs a full audit and uses a policy check each, so it stays
      // one-at-a-time. Every other (data-entry) type can be sent as a batch.
      if (insuranceType === "health" && next.length > 1) {
        next = [next[0]];
        toast({
          title: t("uploads.one_health"),
          description: t("uploads.one_health_desc", { name: next[0].name }),
        });
      }
      return next;
    });
  };

  const removeStagedFile = (index: number) =>
    setStagedFiles((current) => current.filter((_, i) => i !== index));

  // Opens the consent step. Nothing has been sent at this point.
  function startAnalysis() {
    if (stagedFiles.length === 0) return;
    setConsentChecked(false);
    setShowConsentModal(true);
  }

  function handleConsentConfirm() {
    setShowConsentModal(false);
    void processFiles(stagedFiles);
    setStagedFiles([]);
  }

  // Backing out of consent must not throw away what they queued up.
  function handleConsentCancel() {
    setShowConsentModal(false);
    setConsentChecked(false);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    /* Photos of paper policies, not just PDFs. The server has always read images:
       an image/* upload is routed through a Gemini OCR pass (see the file-type
       switch in routes.ts), and claims, leads and the advisor page already
       accept them. This screen alone refused, which meant the most natural
       thing a phone-carrying advisor does with a paper policy was impossible
       rather than politely declined. HEIC is included because that is what an
       iPhone produces by default. */
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],
    },
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

            {insuranceType === "health" && companionCount > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-700">{t("uploads.also_sent")}</p>
                <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                  {superTopupFile && <li className="break-all">{t("uploads.sent_topup", { name: superTopupFile.name })}</li>}
                  {corporateFile && <li className="break-all">{t("uploads.sent_corporate", { name: corporateFile.name })}</li>}
                  {ayushmanFile && <li className="break-all">{t("uploads.sent_ayushman", { name: ayushmanFile.name })}</li>}
                  {hasAyushman && !ayushmanFile && <li>{t("uploads.sent_ayushman_declared")}</li>}
                </ul>
                <p className="mt-1.5 text-xs text-slate-500">
                  {t("uploads.consent_covers")}
                </p>
              </div>
            )}

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
                onClick={() => {
                  setInsuranceType(tkey);
                  // Companion covers are a health-lane concept — don't let them
                  // linger invisibly after switching to another type.
                  if (tkey !== "health") clearCompanions();
                }}
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
                {tOr(t, `common.type_${tkey}`, meta.label)}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {insuranceType === "health"
            ? t("uploads.health_desc")
            : t("uploads.other_desc", { type: tOr(t, `common.type_${insuranceType}`, TYPE_META[insuranceType].label) })}
        </p>
        {insuranceType !== "health" && (
          <p className={`mt-1 text-xs font-medium ${ocrRemaining <= 0 ? "text-red-600" : ocrRemaining <= 5 ? "text-amber-600" : "text-slate-500"}`}>
            {ocrRemaining <= 0
              ? t("uploads.ocr_none")
              : t(ocrRemaining === 1 ? "uploads.ocr_left_one" : "uploads.ocr_left_many", { count: ocrRemaining })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
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
                  {t("uploads.batch_tip")}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-400">
                {t("uploads.nothing_until")}
              </p>
            </div>

            {/* Staged files — chosen, not yet sent. */}
            {stagedFiles.length > 0 && (
              <div className="rounded-xl border border-[#0D9488]/30 bg-[#0D9488]/5 p-4">
                <h4 className="text-sm font-bold text-slate-900">
                  {t(stagedFiles.length === 1 ? "uploads.ready_one" : "uploads.ready_many", { count: stagedFiles.length })}
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {stagedFiles.map((f, idx) => (
                    <li
                      key={`${f.name}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        <span className="truncate text-sm font-medium text-slate-700">{f.name}</span>
                        <span className="flex-shrink-0 text-xs text-slate-400">
                          {(f.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeStagedFile(idx)}
                        disabled={isProcessing}
                        className="flex-shrink-0 text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
                      >
                        {t("uploads.remove")}
                      </button>
                    </li>
                  ))}
                </ul>

                {duplicateNames.length > 0 && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span className="break-all">
                      {t(insuranceType === "health" ? "uploads.already_health" : "uploads.already_other", { names: duplicateNames.join(", ") })}
                    </span>
                  </p>
                )}

                {insuranceType === "health" && (
                  <p className="mt-2 text-xs text-slate-500">
                    {t("uploads.attach_first")}
                  </p>
                )}
              </div>
            )}

            {/* Other health cover the same person holds. Read together with the
                base policy in the same policy check. */}
            {insuranceType === "health" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-start gap-3">
                  <Layers className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#0D9488]" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{t("uploads.other_cover")}</h4>
                    <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                      {t("uploads.other_cover_desc")}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-2.5">
                  <CompanionSlot
                    label={COMPANION_SLOTS[0].label}
                    hint={COMPANION_SLOTS[0].hint}
                    file={superTopupFile}
                    onPick={setSuperTopupFile}
                    disabled={isProcessing}
                  />
                  <CompanionSlot
                    label={COMPANION_SLOTS[1].label}
                    hint={COMPANION_SLOTS[1].hint}
                    file={corporateFile}
                    onPick={setCorporateFile}
                    disabled={isProcessing}
                  />

                  {/* Ayushman Bharat is usually a card, not a policy document —
                      a tick is enough, the document is optional. */}
                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex min-w-0 cursor-pointer select-none items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={hasAyushman}
                          onChange={(e) => {
                            setHasAyushman(e.target.checked);
                            if (!e.target.checked) setAyushmanFile(null);
                          }}
                          disabled={isProcessing}
                          className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded accent-[#0D9488]"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-700">
                            {t("uploads.ayushman")}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {t("uploads.ayushman_desc")}
                          </span>
                        </span>
                      </label>
                      {hasAyushman && !ayushmanFile && (
                        <label
                          className={`flex-shrink-0 cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0D9488] hover:bg-white ${
                            isProcessing ? "pointer-events-none opacity-50" : ""
                          }`}
                        >
                          {t("uploads.attach")}
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            disabled={isProcessing}
                            onChange={(e) => setAyushmanFile(e.target.files?.[0] ?? null)}
                          />
                        </label>
                      )}
                      {ayushmanFile && (
                        <button
                          type="button"
                          onClick={() => setAyushmanFile(null)}
                          disabled={isProcessing}
                          className="flex-shrink-0 text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
                        >
                          {t("uploads.remove")}
                        </button>
                      )}
                    </div>
                    {ayushmanFile && (
                      <p className="mt-2 flex items-center gap-1.5 break-all text-xs font-medium text-slate-600">
                        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                        {ayushmanFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* The only control that actually sends anything. Sits last, after
                the companion slots, so nothing runs before they're attached. */}
            {stagedFiles.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                <Button
                  onClick={startAnalysis}
                  disabled={isProcessing}
                  size="lg"
                  className="bg-[#0D9488] hover:bg-[#0f766e]"
                >
                  {isProcessing
                    ? t("uploads.working")
                    : insuranceType === "health"
                    ? (companionCount > 0 ? t("uploads.check_with_other", { count: companionCount }) : t("uploads.check_btn"))
                    : t(stagedFiles.length === 1 ? "uploads.check_n_one" : "uploads.check_n_many", { count: stagedFiles.length })}
                </Button>
                <button
                  type="button"
                  onClick={() => setStagedFiles([])}
                  disabled={isProcessing}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50"
                >
                  {t("uploads.clear_all")}
                </button>
                <span className="text-xs text-slate-500">
                  {insuranceType === "health"
                    ? t("uploads.uses_one_check")
                    : t(stagedFiles.length === 1 ? "uploads.uses_entries_one" : "uploads.uses_entries_many", { count: stagedFiles.length })}
                </span>
              </div>
            )}

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
                        <span className="text-red-600">{t("uploads.error_prefix", { message: upload.error ?? "" })}</span>
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
