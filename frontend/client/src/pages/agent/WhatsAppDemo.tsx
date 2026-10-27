import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { ArrowLeft, CheckCheck, FileText, Paperclip, SendHorizontal } from "lucide-react"
import { useLanguage } from "@/i18n/LanguageContext"
import { getDemoSession, type PhoneMsg } from "@/features/wa-demo/demoBot"

/**
 * /agent/whatsapp-demo, playground only: the IndSure WhatsApp assistant on a phone screen.
 * The replies come from the real bot code (whatsapp-bot/src/core/bot.ts) running in this
 * page against the demo data, so a lead added here shows up on the Leads page.
 */

type Msg = PhoneMsg

const time = (at: number) => new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })

/** WhatsApp's own formatting: *bold*, _italic_, ~strike~ and bare links. */
function richLine(line: string, key: number): ReactNode {
  const parts = line.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/\S+)/g)
  return (
    <Fragment key={key}>
      {parts.map((p, i) => {
        if (/^\*[^*]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>
        if (/^_[^_]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>
        if (/^~[^~]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>
        if (/^https?:\/\//.test(p)) return <span key={i} className="text-[#027eb5] underline break-all">{p}</span>
        return <Fragment key={i}>{p}</Fragment>
      })}
    </Fragment>
  )
}

function Bubble({ m }: { m: Msg }) {
  const mine = m.from === "me"
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-2.5 pt-1.5 pb-1 text-[14.5px] leading-snug shadow-sm ${
          mine ? "bg-[#d9fdd3] rounded-tr-none" : "bg-white rounded-tl-none"
        }`}
      >
        {m.file && (
          <div className="mb-1 flex items-center gap-2 rounded-md bg-black/5 px-2 py-2 text-[13px] text-slate-700">
            <FileText className="h-5 w-5 shrink-0 text-red-500" aria-hidden /> <span className="truncate">{m.file}</span>
          </div>
        )}
        {m.text && (
          <div className="whitespace-pre-wrap break-words text-[#111b21]">
            {m.text.split("\n").map((l, i, all) => (
              <Fragment key={i}>{richLine(l, i)}{i < all.length - 1 && <br />}</Fragment>
            ))}
          </div>
        )}
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#667781]">
          {time(m.at)}
          {mine && <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" aria-hidden />}
        </div>
      </div>
    </div>
  )
}

export default function WhatsAppDemo() {
  const { t } = useLanguage()
  const chat = getDemoSession()
  const msgs = useSyncExternalStore(chat.subscribe, () => chat.msgs)
  const typing = useSyncExternalStore(chat.subscribe, () => chat.typing)
  const [draft, setDraft] = useState("")
  const [attachOpen, setAttachOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [msgs, typing])

  function send(text: string) {
    if (!text.trim()) return
    setDraft("")
    chat.send(text)
  }

  function sendPdf(fileName: string) {
    setAttachOpen(false)
    chat.sendPdf(fileName)
  }

  const tries = [
    { label: t("wa_demo.try_help"), text: "HELP" },
    { label: t("wa_demo.try_today"), text: "TODAY" },
    { label: t("wa_demo.try_renewals"), text: "RENEWALS" },
    { label: t("wa_demo.try_followups"), text: "FOLLOW UPS" },
    { label: t("wa_demo.try_add_lead"), text: "add lead Kavita Sharma 9876512345 health insurance" },
    { label: t("wa_demo.try_find"), text: "Suresh Agarwal" },
    { label: t("wa_demo.try_claims"), text: "CLAIMS" },
    { label: t("wa_demo.try_undo"), text: "UNDO" },
  ]

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <h1 className="font-serif text-2xl font-bold text-slate-900">{t("wa_demo.title")}</h1>
        <p className="max-w-prose text-base text-slate-700">{t("wa_demo.intro")}</p>
        <p className="max-w-prose text-base text-slate-700">{t("wa_demo.same_data")}</p>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">{t("wa_demo.try_these")}</h2>
          <div className="flex flex-wrap gap-2">
            {tries.map((x) => (
              <button
                key={x.text}
                type="button"
                onClick={() => send(x.text)}
                className="min-h-[44px] rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <p className="max-w-prose text-sm text-slate-600">{t("wa_demo.note")}</p>
      </div>

      {/* The phone */}
      <div className="mx-auto w-full max-w-[380px]">
        <div className="overflow-hidden rounded-[2.2rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl">
          <div className="flex h-[640px] flex-col bg-[#efeae2]">
            <div className="flex items-center gap-3 bg-[#008069] px-3 py-2.5 text-white">
              <ArrowLeft className="h-5 w-5 opacity-80" aria-hidden />
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-[#008069]">IS</div>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{t("wa_demo.contact")}</div>
                <div className="text-xs opacity-80">{typing ? t("wa_demo.typing") : t("wa_demo.online")}</div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3" aria-live="polite">
              <div className="mx-auto mb-2 max-w-[90%] rounded-lg bg-[#fff5c4] px-3 py-2 text-center text-[12.5px] text-[#54656f]">
                {t("wa_demo.banner")}
              </div>
              {msgs.map((m) => <Bubble key={m.id} m={m} />)}
              {typing && (
                <div className="flex justify-start">
                  <div className="rounded-lg rounded-tl-none bg-white px-3 py-2 text-[13px] text-[#667781] shadow-sm">{t("wa_demo.typing")}</div>
                </div>
              )}
            </div>

            {attachOpen && (
              <div className="space-y-1 border-t border-black/5 bg-white px-3 py-2">
                {[
                  ["Family_Health_Optima_policy.pdf", t("wa_demo.attach_health")],
                  ["Car_Insurance_Motor_policy.pdf", t("wa_demo.attach_motor")],
                ].map(([file, label]) => (
                  <button
                    key={file}
                    type="button"
                    onClick={() => sendPdf(file)}
                    className="flex min-h-[44px] w-full items-center gap-2 rounded-md px-2 text-left text-sm text-slate-800 hover:bg-slate-100"
                  >
                    <FileText className="h-4 w-4 text-red-500" aria-hidden /> {label}
                  </button>
                ))}
              </div>
            )}

            <form
              className="flex items-center gap-2 bg-[#f0f2f5] px-2 py-2"
              onSubmit={(e) => { e.preventDefault(); send(draft) }}
            >
              <button
                type="button"
                onClick={() => setAttachOpen((o) => !o)}
                aria-label={t("wa_demo.attach")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-black/5"
              >
                <Paperclip className="h-5 w-5" aria-hidden />
              </button>
              <input
                id="wa-demo-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("wa_demo.placeholder")}
                aria-label={t("wa_demo.placeholder")}
                autoComplete="off"
                className="h-11 min-w-0 flex-1 rounded-full border-0 bg-white px-4 text-[15px] text-[#111b21] outline-none focus:ring-2 focus:ring-[#00a884]/40"
              />
              <button
                type="submit"
                aria-label={t("wa_demo.send")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white hover:bg-[#008f72]"
              >
                <SendHorizontal className="h-5 w-5" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
