import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { apiFetch, apiJson, apiOk } from "@/lib/api"
import { useLanguage } from "@/i18n/LanguageContext"
import { STRINGS, type WaStringKey } from "./strings"

/* Connect WhatsApp (beta). Part of the WhatsApp plug-in: this folder is removable as a
   unit, see whatsapp-bot/UNPLUG.md. Plan: docs/plans/2026-09-25-whatsapp-bot-beta.md
   Renders NOTHING unless the server says this account is on the beta allow-list, so
   advisors outside the beta never see a feature they cannot use. A failed status load also
   renders nothing: until the backend is deployed every advisor would otherwise see an error
   for a card that is not meant for them. */

type Status = {
  eligible: boolean
  botNumber?: string | null
  status?: "none" | "pending" | "active"
  number?: string | null
  codeExpiresAt?: string | null
}

const pretty = (n?: string | null) => {
  const d = String(n || "").replace(/\D/g, "")
  return d.length === 12 && d.startsWith("91") ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : n || ""
}

export default function WhatsAppConnectCard() {
  const { locale } = useLanguage()
  const t = (key: string) => (STRINGS[locale === "hi" ? "hi" : "en"] as Record<string, string>)[key.replace("whatsapp_connect.", "") as WaStringKey] ?? key
  const [status, setStatus] = useState<Status | null>(null)
  const [number, setNumber] = useState("")
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState<"" | "code" | "disconnect" | "refresh">("")

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

  const botDigits = String(status.botNumber || "").replace(/\D/g, "")
  const linkMessage = code ? `LINK ${code}` : ""
  const openHref = botDigits && code ? `https://wa.me/${botDigits}?text=${encodeURIComponent(linkMessage)}` : ""

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">
          {t("whatsapp_connect.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <p className="text-base text-slate-700 max-w-prose">{t("whatsapp_connect.intro")}</p>

        {status.status === "active" ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-base text-slate-900">
              {t("whatsapp_connect.connected_as")} <span className="font-bold">{pretty(status.number)}</span>
            </p>
            <Button variant="outline" className="min-h-[44px] font-bold" onClick={disconnect} disabled={busy !== ""}>
              {busy === "disconnect" ? t("whatsapp_connect.disconnecting") : t("whatsapp_connect.disconnect")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 max-w-sm">
              <label htmlFor="wa-number" className="text-sm font-bold text-slate-900">
                {t("whatsapp_connect.number_label")}
              </label>
              <div className="flex gap-2">
                <Input
                  id="wa-number"
                  inputMode="tel"
                  autoComplete="tel"
                  className="min-h-[44px] text-base"
                  placeholder={t("whatsapp_connect.number_placeholder")}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
                <Button className="min-h-[44px] font-bold" onClick={getCode} disabled={busy !== "" || number.replace(/\D/g, "").length < 10}>
                  {busy === "code" ? t("whatsapp_connect.getting_code") : t("whatsapp_connect.get_code")}
                </Button>
              </div>
            </div>

            {code && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-base text-slate-700">
                  {t("whatsapp_connect.send_this")}{" "}
                  <span className="font-bold text-slate-900">{botDigits ? pretty(botDigits) : t("whatsapp_connect.the_bot")}</span>
                </p>
                <p className="text-2xl font-black tracking-widest text-slate-900 select-all">{linkMessage}</p>
                <p className="text-sm text-slate-600">{t("whatsapp_connect.code_expires")}</p>
                <div className="flex flex-wrap gap-2">
                  {openHref && (
                    <a
                      href={openHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center rounded-md bg-emerald-600 px-4 text-base font-bold text-white hover:bg-emerald-700"
                    >
                      {t("whatsapp_connect.open_whatsapp")}
                    </a>
                  )}
                  <Button variant="outline" className="min-h-[44px] font-bold" onClick={refresh} disabled={busy !== ""}>
                    {t("whatsapp_connect.check_again")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-slate-600 max-w-prose">{t("whatsapp_connect.never_sends")}</p>
        <p className="text-sm text-slate-600 max-w-prose">{t("whatsapp_connect.beta_note")}</p>
      </CardContent>
    </Card>
  )
}
