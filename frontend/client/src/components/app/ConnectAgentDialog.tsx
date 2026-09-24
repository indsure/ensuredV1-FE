import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, PhoneCall } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

// value is what the server stores and stays English; label is a translation key.
const TOPICS = [
  { value: "renew", label: "connect.t_renew" },
  { value: "new-cover", label: "connect.t_new" },
  { value: "review", label: "connect.t_review" },
  { value: "claim", label: "connect.t_claim" },
  { value: "other", label: "connect.t_other" },
];

// Consumer-initiated, consented request to be contacted by a licensed advisor.
// The ONLY place a signed-in consumer is lead-captured — always behind an
// explicit consent checkbox they tick themselves.
export function ConnectAgentDialog({
  open,
  onOpenChange,
  defaultName,
  defaultPhone,
  defaultTopic,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultName?: string | null;
  defaultPhone?: string | null;
  defaultTopic?: string;
  onSubmitted?: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState<string>("review");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Reset each time the dialog opens, prefilling from the profile.
  useEffect(() => {
    if (open) {
      setName(defaultName ?? "");
      setPhone(defaultPhone ?? "");
      setTopic(defaultTopic ?? "review");
      setMessage("");
      setConsent(false);
      setError(null);
      setDone(false);
      setSubmitting(false);
    }
  }, [open, defaultName, defaultPhone, defaultTopic]);

  async function submit() {
    if (!name.trim()) { setError(t("connect.err_name")); return; }
    if (phone.replace(/\D/g, "").length < 7) { setError(t("connect.err_phone")); return; }
    if (!consent) { setError(t("connect.err_consent")); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/me/connect-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, topic, message, consent }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t("connect.err_submit"));
      }
      setDone(true);
      onSubmitted?.();
    } catch (e: any) {
      setError(e.message || t("connect.err_submit"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <div className="py-4 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--color-teal-600)]/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[var(--color-teal-600)]" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">{t("connect.done_h")}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {name.trim()
                  ? t("connect.done_named", { name: name.trim().split(/\s+/)[0] })
                  : t("connect.done_plain")}
              </p>
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full h-11 bg-[var(--color-cta)] hover:bg-[var(--color-cta-hover)] text-white rounded-xl font-bold"
            >
              {t("connect.done")}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl font-bold text-[var(--color-navy-900)] flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-[var(--color-teal-600)]" /> {t("connect.title")}
              </DialogTitle>
              <DialogDescription className="text-sm text-[var(--color-text-secondary)]">
                {t("connect.desc")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label htmlFor="ca-name" className="text-sm font-semibold text-[var(--color-navy-900)]">{t("connect.your_name")}</label>
                <Input
                  id="ca-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-xl bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white"
                  placeholder={t("connect.full_name")}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ca-phone" className="text-sm font-semibold text-[var(--color-navy-900)]">{t("connect.phone")}</label>
                <Input
                  id="ca-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 rounded-xl bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white"
                  placeholder={t("connect.phone_ph")}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[var(--color-navy-900)]">{t("connect.need")}</label>
                <div className="flex flex-wrap gap-2">
                  {TOPICS.map((tp) => (
                    <button
                      key={tp.value}
                      type="button"
                      onClick={() => setTopic(tp.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        topic === tp.value
                          ? "bg-[var(--color-cta)] text-white border-[var(--color-teal-600)]"
                          : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-teal-600)]"
                      }`}
                    >
                      {t(tp.label)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ca-msg" className="text-sm font-semibold text-[var(--color-navy-900)]">
                  {t("connect.specific")} <span className="font-normal text-[var(--color-text-muted)]">{t("connect.optional")}</span>
                </label>
                <Textarea
                  id="ca-msg"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="rounded-xl bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white resize-none"
                  placeholder={t("connect.msg_ph")}
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {t("connect.consent")}
                </span>
              </label>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-sm font-medium">
                  {error}
                </div>
              )}

              <Button
                onClick={submit}
                disabled={submitting}
                className="w-full h-11 bg-[var(--color-cta)] hover:bg-[var(--color-cta-hover)] text-white rounded-xl font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("connect.sending")}</> : t("connect.request")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
