import { useCallback, useRef, useState } from "react";
import { Link } from "wouter";
import { Upload, FileCheck, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiBase } from "@/lib/queryClient";
import { savePendingUpload, readPendingUpload, type PendingUpload } from "@/lib/pendingUpload";

// Upload first, sign up second.
//
// The old funnel asked a stranger to create an account before showing them
// anything, which is a lot to ask of someone who arrived from a reel ten
// seconds ago. Here they choose a file, we park it, and the account is the
// thing standing between them and a result they have already invested in.
//
// Nothing is read at this point — no analysis, no spend. That happens after
// signup, in the metered path.
//
// This does NOT use apiFetch: that helper attaches the consumer session, and
// there is deliberately no session here.

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt";

const TYPES = [
  { value: "health", label: "Health" },
  { value: "term", label: "Term life" },
  { value: "vehicle", label: "Vehicle" },
];

export function PolicyUploadGate({ compact = false }: { compact?: boolean }) {
  const [pending, setPending] = useState<PendingUpload | null>(() => readPendingUpload());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("health");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > MAX_BYTES) {
        setError("That file is larger than 10 MB. Try a smaller PDF.");
        return;
      }
      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("type", type);
        const res = await fetch(`${getApiBase()}/api/upload/pending`, { method: "POST", body: form });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.message || "We could not upload that file. Please try again.");
          return;
        }
        savePendingUpload(body);
        setPending(body);
      } catch {
        setError("We could not reach the server. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [type]
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void upload(f);
    e.target.value = "";
  };

  // ── Gate: file is parked, account is the only thing left ──
  if (pending) {
    return (
      <div className="card-white p-6 md:p-8">
        <div className="flex items-start gap-3 mb-5">
          <FileCheck className="w-6 h-6 text-[var(--color-green-primary)] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="font-serif text-xl mb-1">Your policy is ready to check</h3>
            <p className="text-sm text-[var(--color-text-secondary)] break-words">
              {pending.filename}
            </p>
          </div>
        </div>

        <p className="text-[var(--color-text-main)] mb-2">
          Create your free account to see what it actually covers.
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          We have not read it yet — the check starts the moment you sign in. Free
          for one policy of each type, and no card is needed.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/signup">Sign up to view results</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>

        <button
          onClick={() => {
            setPending(null);
            setError(null);
          }}
          className="mt-5 text-sm text-[var(--color-text-muted)] underline underline-offset-4 hover:text-[var(--color-text-secondary)]"
        >
          Upload a different file
        </button>
      </div>
    );
  }

  // ── Upload ──
  return (
    <div className="card-white p-6 md:p-8">
      {!compact && (
        <h3 className="font-serif text-xl mb-2">Check your policy</h3>
      )}
      <p className="text-sm text-[var(--color-text-secondary)] mb-5">
        Upload the PDF your insurer sent you. We will tell you what it covers in
        plain language.
      </p>

      <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Policy type">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            aria-pressed={type === t.value}
            className={`inline-flex min-h-11 items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              type === t.value
                ? "bg-[var(--color-green-primary)] text-white border-[var(--color-green-primary)]"
                : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border-main)] hover:border-[var(--color-green-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={onPick}
        className="sr-only"
        id="policy-upload-input"
      />

      <Button
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
            Choose your policy PDF
          </>
        )}
      </Button>

      {error && (
        <p className="mt-3 flex items-start gap-2 text-sm text-[var(--color-error)]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* The consent line. These are health documents from people without an
          account, so the holding period is stated before a file is chosen —
          not buried in terms. Keep this in step with PENDING_UPLOAD_TTL_HOURS. */}
      <p className="mt-5 flex items-start gap-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          We hold your file for 24 hours so you can see your results after signing
          up, then delete it automatically if you do not. Maximum 10 MB. We never
          sell your data and earn no commission from insurers.
        </span>
      </p>
    </div>
  );
}
