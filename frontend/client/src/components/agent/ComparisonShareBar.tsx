import { useState } from "react";
import { Check, CheckCircle2, Copy, Loader2, MessageCircle, Share2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { type ComparisonResult } from "@/lib/wordingProfile";

/**
 * Save a comparison and hand the advisor a link to send.
 *
 * Lifted out of the uploaded-wordings compare screen, where it had lived
 * privately. The catalogue compare produces the same ComparisonResult and had
 * no way to share at all, so an advisor comparing two catalogue plans could
 * only screenshot the table. A tester asked for a shareable link on exactly
 * that screen and reported the feature missing, which it was there and had
 * been present on the other one all along.
 *
 * One implementation now serves both. The link is public by design: this is
 * the surface an advisor sends to a customer, and it was already travelling to
 * customers as screenshots. Nothing personal is in a comparison, which is what
 * makes that safe: it is two policy wordings set against each other, with no
 * policyholder, no policy number and no document attached.
 */

interface Props {
  data: ComparisonResult;
  /** Extracted wording profiles, when the comparison came from uploads. The
   *  catalogue flow has none and passes nothing. */
  profiles?: unknown;
}

export default function ComparisonShareBar({ data, profiles }: Props) {
  const [saving, setSaving] = useState(false);
  const [uuid, setUuid] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = uuid ? `${window.location.origin}/compare/report/${uuid}` : null;

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/compare/save-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: data, profiles }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not save");
      const json = await res.json();
      setUuid(json.uuid);
    } catch (e: any) {
      setErr(e.message || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  const waText = encodeURIComponent(
    `Namaste 🙏 Maine aapke liye 2 health insurance policies ka poora comparison taiyaar kiya hai. Yahan side-by-side dekhiye:\n${shareUrl ?? ""}`
  );

  if (!uuid) {
    return (
      <div>
        <button
          onClick={save}
          disabled={saving}
          className="w-full md:w-auto h-12 px-6 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
          {saving ? "Saving…" : "Save & share with customer"}
        </button>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#0D9488]/30 bg-[#F0FDFA] p-4 md:p-5">
      <p className="text-sm font-bold text-[#0f766e] mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" /> Saved — send this to your customer
      </p>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-12">
          <span className="text-sm text-slate-500 truncate flex-1">{shareUrl}</span>
          <button onClick={copy} className="text-slate-400 hover:text-[#0D9488] flex-shrink-0" aria-label="Copy link">
            {copied ? <Check className="h-5 w-5 text-[#0D9488]" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-12 px-5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-white font-bold flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <MessageCircle className="h-5 w-5" /> WhatsApp
        </a>
      </div>
    </div>
  );
}
