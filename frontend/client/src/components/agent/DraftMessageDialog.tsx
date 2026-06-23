/**
 * Reusable WhatsApp message drafter (local templates, no AI, no cost).
 *
 * Drop it onto any lead or client surface: pass a `target` (type + id + name +
 * phone + any context), the agent picks an intent and language, a template
 * fills in live, they tweak it, then tap "Send on WhatsApp" — which opens
 * wa.me on their own device with the text pre-filled (the one tap WhatsApp
 * always requires without the Business API).
 *
 * House style: hand-rolled teal modal, big buttons, plain language — built for
 * the 40+ agent.
 */

import { useEffect, useMemo, useState } from "react";
import { Copy, MessageCircle, X } from "lucide-react";

import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { waHref } from "@/lib/leads";
import {
  buildMessage,
  DRAFT_KIND_META,
  DRAFT_LANGUAGES,
  type DraftKind,
  type DraftLanguage,
  type DraftTarget,
} from "@/lib/draftMessage";

const ACCENT = "#0D9488";

export function DraftMessageDialog({
  target,
  open,
  onClose,
}: {
  target: DraftTarget | null;
  open: boolean;
  onClose: () => void;
}) {
  const { agent } = useAgent();
  const [kind, setKind] = useState<DraftKind>("follow_up");
  const [language, setLanguage] = useState<DraftLanguage>("english");
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);

  const intents = useMemo(() => {
    const isClient = target?.type === "client";
    return (Object.keys(DRAFT_KIND_META) as DraftKind[]).filter(
      (k) => isClient || !DRAFT_KIND_META[k].clientOnly
    );
  }, [target?.type]);

  // Reset to a sensible starting intent when the dialog opens for a target.
  useEffect(() => {
    if (open) {
      setKind(target?.type === "client" ? "upgrade_weak" : "follow_up");
      setLanguage("english");
      setEdited(false);
    }
  }, [open, target?.id]);

  // Rebuild the template whenever the intent / language changes, unless the
  // agent has manually edited the text (we don't clobber their edits).
  useEffect(() => {
    if (!open || !target || edited) return;
    setText(buildMessage(target, kind, language, agent?.name || null));
  }, [open, target?.id, kind, language, edited, agent?.name]);

  if (!open || !target) return null;

  const wa = waHref(target.phone, text);

  function handleSend() {
    if (!wa) {
      toast({ title: "No phone number", description: "Add a mobile number for this person first.", variant: "destructive" });
      return;
    }
    window.open(wa, "_blank", "noopener,noreferrer");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Message copied to clipboard." });
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" style={{ color: ACCENT }} />
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">Draft a WhatsApp message</h2>
              <p className="text-xs text-slate-500">To {target.name || "this contact"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={22} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Intent picker */}
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2">What do you want to say?</p>
            <div className="flex flex-wrap gap-2">
              {intents.map((k) => {
                const active = kind === k;
                return (
                  <button
                    key={k}
                    onClick={() => { setKind(k); setEdited(false); }}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold border transition-colors",
                      active ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                    style={active ? { backgroundColor: ACCENT } : undefined}
                  >
                    <span>{DRAFT_KIND_META[k].emoji}</span>
                    {DRAFT_KIND_META[k].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language */}
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2">Language</p>
            <div className="flex gap-2">
              {DRAFT_LANGUAGES.map((l) => {
                const active = language === l.value;
                return (
                  <button
                    key={l.value}
                    onClick={() => { setLanguage(l.value); setEdited(false); }}
                    className={[
                      "flex-1 rounded-lg px-3 py-2 text-sm font-semibold border transition-colors",
                      active ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                    style={active ? { backgroundColor: ACCENT } : undefined}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Draft area */}
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2">Your message (edit if you like)</p>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setEdited(true); }}
              rows={8}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-base leading-relaxed focus:outline-none focus:ring-2 resize-none"
              style={{ ['--tw-ring-color' as any]: `${ACCENT}55` }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: "#25D366" }}
            >
              <MessageCircle size={20} /> Send on WhatsApp
            </button>
            <button
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Copy size={16} /> Copy
            </button>
          </div>
          {!target.phone && (
            <p className="text-[11px] text-amber-600 text-center">No mobile number on file. Add one to send, or use Copy.</p>
          )}
          <p className="text-[11px] text-slate-400 text-center">
            WhatsApp opens with this text ready. You tap send.
          </p>
        </div>
      </div>
    </div>
  );
}
