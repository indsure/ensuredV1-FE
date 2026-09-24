import { useCallback, useRef, useState } from "react";
import { Link } from "wouter";
import { Upload, FileCheck, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiBase } from "@/lib/queryClient";
import { savePendingUpload, readPendingUpload, clearPendingUpload, type PendingUpload } from "@/lib/pendingUpload";
import { LOBS, lobLabel } from "@/components/app/portfolio-utils";
import { useLanguage } from "@/i18n/LanguageContext";

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

/* Derived from the canonical consumer registry rather than restated. The
   local copy this replaces had drifted: it wrote "vehicle" where every other
   part of the product (and every row in individual_policies) uses "motor",
   and it left out "life" altogether so an endowment or ULIP policy could not
   be uploaded here at all. Free slots are metered per insurance_type, so the
   wrong value also split one allowance into two. */
const TYPES = LOBS.map((l) => ({ value: l.type, label: l.label }));

export function PolicyUploadGate({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingUpload | null>(() => readPendingUpload());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("health");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > MAX_BYTES) {
        setError(t("gate.too_big"));
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
          setError(body.message || t("gate.upload_failed"));
          return;
        }
        savePendingUpload(body);
        setPending(body);
      } catch {
        setError(t("gate.no_server"));
      } finally {
        setBusy(false);
      }
    },
    [type, t]
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
            <h3 className="font-serif text-xl mb-1">{t("gate.ready")}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] break-words">
              {pending.filename}
            </p>
          </div>
        </div>

        <p className="text-[var(--color-text-main)] mb-2">
          {t("gate.create")}
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          {t("gate.not_read")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/signup">{t("gate.signup")}</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
            <Link href="/login">{t("gate.have_account")}</Link>
          </Button>
        </div>

        <button
          onClick={() => {
            // Clear the stored token too, not just the local state. Without
            // this the discarded file is still the one redeemed at signup, and
            // it burns the free slot for that line of business.
            clearPendingUpload();
            setPending(null);
            setError(null);
          }}
          className="mt-5 text-sm text-[var(--color-text-muted)] underline underline-offset-4 hover:text-[var(--color-text-secondary)]"
        >
          {t("gate.different")}
        </button>
      </div>
    );
  }

  // ── Upload ──
  return (
    <div className="card-white p-6 md:p-8">
      {!compact && (
        <h3 className="font-serif text-xl mb-2">{t("gate.check")}</h3>
      )}
      <p className="text-sm text-[var(--color-text-secondary)] mb-5">
        {t("gate.intro")}
      </p>

      <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label={t("gate.type_group")}>
        {TYPES.map((tp) => (
          <button
            key={tp.value}
            onClick={() => setType(tp.value)}
            aria-pressed={type === tp.value}
            className={`inline-flex min-h-11 items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              type === tp.value
                ? "bg-[var(--color-green-primary)] text-white border-[var(--color-green-primary)]"
                : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border-main)] hover:border-[var(--color-green-primary)]"
            }`}
          >
            {lobLabel(t, tp.value)}
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
            {t("gate.uploading")}
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
            {t("gate.choose")}
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
      {/* Set at text-sm, not text-xs: the comment above says this is stated up
          front rather than buried in terms, and 12px muted grey on a phone IS
          burying it. A retention promise the reader cannot comfortably read is
          not a promise that was made. */}
      <p className="mt-5 flex items-start gap-2 text-sm text-[var(--color-text-muted)] leading-relaxed">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          {t("gate.hold")}
        </span>
      </p>
    </div>
  );
}
