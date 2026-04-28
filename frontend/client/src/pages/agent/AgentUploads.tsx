import { useState } from "react";
import { useLocation } from "wouter";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { getValidSession } from "@/lib/auth-helper";

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
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [policyIdentifier, setPolicyIdentifier] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = async (acceptedFiles: File[]) => {
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
        formData.append("type", "health");
        if (clientName) formData.append("policyholder_name", clientName);
        if (clientEmail) formData.append("client_email", clientEmail);
        if (clientPhone) formData.append("client_phone", clientPhone);
        if (policyIdentifier) formData.append("policy_identifier", policyIdentifier);

        // Upload and start analysis
        const uploadRes = await fetch("/api/agent/analyze", {
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
            const statusRes = await fetch(`/api/agent/analyze/status/${jobId}`, {
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
      setLocation("/agent/reports");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">Upload Policies</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Upload Area */}
        <Card className="border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle>Policy Documents</CardTitle>
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
                {isDragActive ? "Drop files here" : "Drop PDF files or click to browse"}
              </h3>
              <p className="text-sm text-slate-500">
                Supports multiple files • Max 25MB per file
              </p>
            </div>

            {/* Upload Progress */}
            {uploads.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Upload Progress</h4>
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
                      {upload.status === "pending" && "Waiting..."}
                      {upload.status === "uploading" && "Uploading file..."}
                      {upload.status === "analyzing" && "Analyzing policy..."}
                      {upload.status === "completed" && "Analysis complete"}
                      {upload.status === "error" && (
                        <span className="text-red-600">Error: {upload.error}</span>
                      )}
                    </div>
                  </div>
                ))}

                {allDone && (
                  <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                    <div className="text-sm text-slate-600">
                      {completedCount} completed • {errorCount} failed
                    </div>
                    <Button
                      onClick={handleViewResults}
                      className="bg-[#0D9488] hover:bg-[#0f766e]"
                    >
                      View Results
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
            <CardTitle>Client Details (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                Client Full Name
              </label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g., Rajesh Kumar"
                disabled={isProcessing}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                Email
              </label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                disabled={isProcessing}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                Phone
              </label>
              <Input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+91 98765 43210"
                disabled={isProcessing}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                Policy Identifier
              </label>
              <Input
                value={policyIdentifier}
                onChange={(e) => setPolicyIdentifier(e.target.value)}
                placeholder="Policy number or reference"
                disabled={isProcessing}
              />
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 leading-relaxed">
                These details help you organize and identify policies later. All fields are optional.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
