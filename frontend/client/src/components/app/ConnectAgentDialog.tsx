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

const TOPICS = [
  { value: "renew", label: "Renew a policy" },
  { value: "new-cover", label: "Buy new cover" },
  { value: "review", label: "Review my cover" },
  { value: "claim", label: "Help with a claim" },
  { value: "other", label: "Something else" },
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
    if (!name.trim()) { setError("Please share your name."); return; }
    if (phone.replace(/\D/g, "").length < 7) { setError("Please share a valid phone number."); return; }
    if (!consent) { setError("Please tick the box so we can have an advisor contact you."); return; }
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
        throw new Error(body.error || "Could not submit. Please try again.");
      }
      setDone(true);
      onSubmitted?.();
    } catch (e: any) {
      setError(e.message || "Could not submit. Please try again.");
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
              <h3 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">An advisor will reach out soon</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Thanks{name ? `, ${name.trim().split(/\s+/)[0]}` : ""}. A licensed advisor will call you on the
                number you shared. No obligation — they're here to help.
              </p>
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full h-11 bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white rounded-xl font-bold"
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl font-bold text-[var(--color-navy-900)] flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-[var(--color-teal-600)]" /> Talk to an advisor
              </DialogTitle>
              <DialogDescription className="text-sm text-[var(--color-text-secondary)]">
                Have a real person help you understand or fix your cover. Share your details and we'll have a
                licensed advisor reach out.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label htmlFor="ca-name" className="text-sm font-semibold text-[var(--color-navy-900)]">Your name</label>
                <Input
                  id="ca-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-xl bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white"
                  placeholder="Full name"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ca-phone" className="text-sm font-semibold text-[var(--color-navy-900)]">Phone number</label>
                <Input
                  id="ca-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 rounded-xl bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white"
                  placeholder="10-digit mobile"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[var(--color-navy-900)]">What do you need help with?</label>
                <div className="flex flex-wrap gap-2">
                  {TOPICS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTopic(t.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        topic === t.value
                          ? "bg-[var(--color-teal-600)] text-white border-[var(--color-teal-600)]"
                          : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-teal-600)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ca-msg" className="text-sm font-semibold text-[var(--color-navy-900)]">
                  Anything specific? <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <Textarea
                  id="ca-msg"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="rounded-xl bg-[var(--color-cream-main)] border-[var(--color-border-light)] focus:border-[var(--color-teal-600)] focus:bg-white resize-none"
                  placeholder="e.g. My health policy renews next month and I want to check if it's still right for my family."
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  I agree IndSure may share these details with a licensed advisor who will contact me,
                  and may record this request. I can opt out any time.
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
                className="w-full h-11 bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white rounded-xl font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : "Request a callback"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
