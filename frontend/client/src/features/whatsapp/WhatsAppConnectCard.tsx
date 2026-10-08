import { useCallback, useEffect, useState, type ReactNode } from "react"
import { BookOpen, Check, Lock, MessageCircle, ShieldCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { apiFetch, apiJson, apiOk } from "@/lib/api"
import { teamWaLink } from "@/components/app/portfolio-utils"
import { useLanguage } from "@/i18n/LanguageContext"
import { STRINGS, type WaStringKey } from "./strings"

/* Connect WhatsApp (beta). Part of the WhatsApp plug-in: this folder is removable as a
   unit, see whatsapp-bot/UNPLUG.md. Plan: docs/plans/2026-09-25-whatsapp-bot-beta.md
   Renders NOTHING unless the server says this account is on the beta allow-list, so
   advisors outside the beta never see a feature they cannot use. A failed status load also
   renders nothing: until the backend is deployed every advisor would otherwise see an error
   for a card that is not meant for them.
   Three steps, each opening only after the one before: save our contact, connect the number,
   send a first policy. A guide on the right says what to type once connected; the full
   version is /docs/whatsapp-assistant.
   Free-plan advisors who were not invited get `needsUpgrade` from the server and see a
   reminder to upgrade in place of the steps. There is no checkout in the product, so the
   reminder opens a WhatsApp chat with the team, plus a link to the plans page. */

type Status = {
  eligible: boolean
  /** Free plan and not invited: show the upgrade reminder, not the steps. */
  needsUpgrade?: boolean
  botNumber?: string | null
  status?: "none" | "pending" | "active"
  number?: string | null
  codeExpiresAt?: string | null
}

type StepState = "active" | "done" | "locked"

/** The name the advisor sees for us. The bot sends the same name as a contact card after LINK. */
const BOT_NAME = "IndSure AI Assistant"

/** We cannot see whether the phone actually saved the contact, so pressing the button (or
 *  "I've already saved it") is what opens step 2. Remembered per browser: a convenience only,
 *  holds no personal data, and losing it just shows step 1 again. */
const SAVED_KEY = "indsure-wa-contact-saved"
const readSaved = () => {
  try { return localStorage.getItem(SAVED_KEY) === "1" } catch { return false }
}
const writeSaved = () => {
  try { localStorage.setItem(SAVED_KEY, "1") } catch { /* private window: step 2 still opens for this visit */ }
}

/** A contact file for our number. Opening it on a phone shows "Add contact" with the name
 *  filled in, so the chat shows a name instead of a number once saved. */
const contactHref = (digits: string) =>
  "data:text/vcard;charset=utf-8," +
  encodeURIComponent(
    ["BEGIN:VCARD", "VERSION:3.0", `FN:${BOT_NAME}`, "ORG:IndSure;", `TEL;type=CELL;waid=${digits}:+${digits}`, "END:VCARD", ""].join("\r\n")
  )

const pretty = (n?: string | null) => {
  const d = String(n || "").replace(/\D/g, "")
  return d.length === 12 && d.startsWith("91") ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : n || ""
}

const WA_BTN =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-base font-bold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"

function Step({ n, state, title, stepLabel, doneLabel, last, children }: {
  n: number
  state: StepState
  title: string
  stepLabel: string
  doneLabel: string
  last?: boolean
  children: ReactNode
}) {
  const dot =
    state === "done"
      ? "bg-emerald-600 text-white"
      : state === "active"
        ? "bg-white text-emerald-700 ring-2 ring-emerald-600"
        : "bg-slate-100 text-slate-400"
  return (
    <li className="relative flex gap-4" aria-current={state === "active" ? "step" : undefined}>
      <div className="flex flex-col items-center">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-black ${dot}`}>
          {state === "done" ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden /> : state === "locked" ? <Lock className="h-4 w-4" aria-hidden /> : n}
        </span>
        {!last && <span className={`mt-1 w-0.5 flex-1 ${state === "done" ? "bg-emerald-600" : "bg-slate-200"}`} aria-hidden />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? "" : "pb-7"}`}>
        <p className="flex flex-wrap items-center gap-2 pt-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{stepLabel} {n}</span>
          {state === "done" && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{doneLabel}</span>
          )}
        </p>
        <h3 className={`mt-0.5 font-sans text-lg font-bold ${state === "locked" ? "text-slate-400" : "text-slate-900"}`}>{title}</h3>
        <div className="mt-2 space-y-3">{children}</div>
      </div>
    </li>
  )
}

function Cmd({ children }: { children: ReactNode }) {
  return (
    <code className="inline-block rounded-md border border-emerald-200 bg-white px-2 py-0.5 font-mono text-sm font-bold text-emerald-800">
      {children}
    </code>
  )
}

export default function WhatsAppConnectCard() {
  const { locale } = useLanguage()
  const t = (key: string) => (STRINGS[locale === "hi" ? "hi" : "en"] as Record<string, string>)[key.replace("whatsapp_connect.", "") as WaStringKey] ?? key
  const [status, setStatus] = useState<Status | null>(null)
  const [number, setNumber] = useState("")
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState<"" | "code" | "disconnect" | "refresh">("")
  const [saved, setSaved] = useState(readSaved)

  const load = useCallback(async () => {
    try {
      setStatus(await apiJson<Status>(apiFetch("/api/agent/whatsapp")))
    } catch {
      setStatus({ eligible: false })
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (!status?.eligible) return null

  const getCode = async () => {
    setBusy("code")
    try {
      const r = await apiJson<{ code: string; number: string }>(
        apiFetch("/api/agent/whatsapp/link-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number }),
        })
      )
      setCode(r.code)
      await load()
    } catch (e: any) {
      toast({ title: e?.message || t("whatsapp_connect.load_failed"), variant: "destructive" })
    } finally {
      setBusy("")
    }
  }

  const disconnect = async () => {
    setBusy("disconnect")
    try {
      await apiOk(apiFetch("/api/agent/whatsapp/disconnect", { method: "POST" }))
      setCode(null)
      toast({ title: t("whatsapp_connect.disconnected") })
      await load()
    } catch (e: any) {
      toast({ title: e?.message || t("whatsapp_connect.load_failed"), variant: "destructive" })
    } finally {
      setBusy("")
    }
  }

  const refresh = async () => {
    setBusy("refresh")
    await load()
    setBusy("")
  }

  const markSaved = () => {
    writeSaved()
    setSaved(true)
  }

  const botDigits = String(status.botNumber || "").replace(/\D/g, "")
  const linkMessage = code ? `LINK ${code}` : ""
  const openHref = botDigits && code ? `https://wa.me/${botDigits}?text=${encodeURIComponent(linkMessage)}` : ""
  const connected = status.status === "active"
  // No bot number means no contact to save, so there is no step 1 to wait for.
  const hasSaveStep = !!botDigits
  const saveDone = saved || connected
  const connectState: StepState = connected ? "done" : !hasSaveStep || saveDone ? "active" : "locked"
  const firstState: StepState = connected ? "active" : "locked"
  const stepProps = { stepLabel: t("whatsapp_connect.step"), doneLabel: t("whatsapp_connect.done") }
  let n = 0

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
      <div className="flex items-center gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-6 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
          <MessageCircle className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="font-sans text-lg font-black text-slate-900">{t("whatsapp_connect.title")}</h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-800">
          {t("whatsapp_connect.beta")}
        </span>
      </div>

      <CardContent className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <p className="text-base text-slate-700 max-w-prose">{t("whatsapp_connect.intro")}</p>

          {status.needsUpgrade ? (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Sparkles className="h-5 w-5" aria-hidden />
                </span>
                <div className="space-y-1">
                  <h3 className="font-sans text-lg font-bold text-slate-900">{t("whatsapp_connect.upgrade_title")}</h3>
                  <p className="text-base text-slate-700 max-w-prose">{t("whatsapp_connect.upgrade_body")}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:pl-[52px]">
                <a href={teamWaLink(t("whatsapp_connect.upgrade_wa_text"))} target="_blank" rel="noopener noreferrer" className={WA_BTN}>
                  <MessageCircle className="h-5 w-5" aria-hidden />
                  {t("whatsapp_connect.upgrade_cta")}
                </a>
                <a href="/advisors/pricing" target="_blank" rel="noopener noreferrer" className="min-h-[44px] inline-flex items-center text-base font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-900">
                  {t("whatsapp_connect.upgrade_plans")}
                </a>
              </div>
            </div>
          ) : (
          <ol className="list-none">
            {hasSaveStep && (
              <Step n={++n} state={saveDone ? "done" : "active"} title={t("whatsapp_connect.save_title")} {...stepProps}>
                {saveDone ? (
                  <p className="text-base text-slate-700">
                    {t("whatsapp_connect.saved_body")}{" "}
                    <a href={contactHref(botDigits)} download="IndSure-AI-Assistant.vcf" className="font-bold text-emerald-700 underline underline-offset-4">
                      {t("whatsapp_connect.save_again")}
                    </a>
                  </p>
                ) : (
                  <>
                    <p className="text-base text-slate-700 max-w-prose">{t("whatsapp_connect.save_body")}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <a href={contactHref(botDigits)} download="IndSure-AI-Assistant.vcf" onClick={markSaved} className={WA_BTN}>
                        {t("whatsapp_connect.save_contact")}
                      </a>
                      <button type="button" onClick={markSaved} className="min-h-[44px] text-base font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900">
                        {t("whatsapp_connect.save_skip")}
                      </button>
                    </div>
                  </>
                )}
              </Step>
            )}

            <Step n={++n} state={connectState} title={t("whatsapp_connect.connect_title")} {...stepProps}>
              {connectState === "locked" ? (
                <p className="text-base text-slate-500">{t("whatsapp_connect.connect_locked")}</p>
              ) : connected ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-base text-slate-900">
                    {t("whatsapp_connect.connected_as")} <span className="font-bold">{pretty(status.number)}</span>
                  </p>
                  <Button variant="outline" className="min-h-[44px] font-bold" onClick={disconnect} disabled={busy !== ""}>
                    {busy === "disconnect" ? t("whatsapp_connect.disconnecting") : t("whatsapp_connect.disconnect")}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-w-md">
                    <label htmlFor="wa-number" className="text-sm font-bold text-slate-900">
                      {t("whatsapp_connect.number_label")}
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="wa-number"
                        inputMode="tel"
                        autoComplete="tel"
                        className="min-h-[44px] text-base"
                        placeholder={t("whatsapp_connect.number_placeholder")}
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                      />
                      <Button className="min-h-[44px] shrink-0 whitespace-nowrap font-bold" onClick={getCode} disabled={busy !== "" || number.replace(/\D/g, "").length < 10}>
                        {busy === "code" ? t("whatsapp_connect.getting_code") : t("whatsapp_connect.get_code")}
                      </Button>
                    </div>
                  </div>

                  {code && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                      <p className="text-base text-slate-700">
                        {t("whatsapp_connect.send_this")}{" "}
                        <span className="font-bold text-slate-900">{BOT_NAME}</span>
                      </p>
                      <p className="inline-block rounded-lg bg-white px-4 py-2 text-2xl font-black tracking-widest text-slate-900 shadow-sm select-all">{linkMessage}</p>
                      <p className="text-sm text-slate-600">{t("whatsapp_connect.code_expires")}</p>
                      <div className="flex flex-wrap gap-2">
                        {openHref && (
                          <a href={openHref} target="_blank" rel="noopener noreferrer" className={WA_BTN}>
                            {t("whatsapp_connect.open_whatsapp")}
                          </a>
                        )}
                        <Button variant="outline" className="min-h-[44px] font-bold" onClick={refresh} disabled={busy !== ""}>
                          {t("whatsapp_connect.check_again")}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Step>

            <Step n={++n} state={firstState} title={t("whatsapp_connect.first_title")} last {...stepProps}>
              {firstState === "locked" ? (
                <p className="text-base text-slate-500">{t("whatsapp_connect.first_locked")}</p>
              ) : (
                <>
                  <p className="text-base text-slate-700 max-w-prose">{t("whatsapp_connect.first_body")}</p>
                  {botDigits && (
                    <a href={`https://wa.me/${botDigits}`} target="_blank" rel="noopener noreferrer" className={WA_BTN}>
                      <MessageCircle className="h-5 w-5" aria-hidden />
                      {t("whatsapp_connect.open_chat")}
                    </a>
                  )}
                </>
              )}
            </Step>
          </ol>
          )}

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="flex gap-2 text-sm text-slate-600 max-w-prose">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              {t("whatsapp_connect.never_sends")}
            </p>
            <p className="text-sm text-slate-500 max-w-prose pl-6">{t("whatsapp_connect.beta_note")}</p>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 lg:sticky lg:top-4" aria-labelledby="wa-guide-title">
          <h3 id="wa-guide-title" className="font-sans text-base font-black text-slate-900">{t("whatsapp_connect.guide_title")}</h3>
          <ul className="mt-4 space-y-4">
            <li>
              <p className="text-sm font-bold text-slate-900">{t("whatsapp_connect.guide_pdf_title")}</p>
              <p className="text-sm text-slate-600">{t("whatsapp_connect.guide_pdf_body")}</p>
            </li>
            <li>
              <p className="text-sm font-bold text-slate-900">{t("whatsapp_connect.guide_ask_title")}</p>
              <p className="text-sm text-slate-600">{t("whatsapp_connect.guide_ask_body")} <Cmd>{t("whatsapp_connect.guide_ask_example")}</Cmd></p>
            </li>
            <li>
              <p className="text-sm font-bold text-slate-900">{t("whatsapp_connect.guide_share_title")}</p>
              <p className="text-sm text-slate-600">{t("whatsapp_connect.guide_share_body")} <Cmd>SHARE</Cmd></p>
            </li>
            <li>
              <p className="text-sm font-bold text-slate-900">{t("whatsapp_connect.guide_calls_title")}</p>
              <p className="text-sm text-slate-600">{t("whatsapp_connect.guide_calls_body")}</p>
              <p className="mt-1 flex flex-wrap gap-1.5"><Cmd>RENEWALS</Cmd><Cmd>FOLLOW UPS</Cmd></p>
            </li>
            <li>
              <p className="text-sm font-bold text-slate-900">{t("whatsapp_connect.guide_help_title")}</p>
              <p className="text-sm text-slate-600">{t("whatsapp_connect.guide_help_body")} <Cmd>HELP</Cmd></p>
            </li>
          </ul>
          <a
            href="/docs/whatsapp-assistant"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-emerald-700 underline underline-offset-4 hover:text-emerald-800"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            {t("whatsapp_connect.guide_read_more")}
          </a>
        </aside>
      </CardContent>
    </Card>
  )
}
