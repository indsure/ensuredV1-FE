/**
 * /agent/my-page — the advisor's own public page: editor, publish switch, and
 * the share kit.
 *
 * Two ideas do most of the work here:
 *
 * 1. The advisor never types free-form copy. Everything on the public page is
 *    fixed, translated template text; this screen only collects identity —
 *    photo, city, spoken languages, lines handled, WhatsApp number. That is why
 *    there is no "about me" box: a text area on a page carrying IndSure's
 *    domain is where an unbacked claim would eventually get typed.
 *
 * 2. The advisor never handles a raw URL. Every link in the share kit is
 *    already tagged for the channel it is meant for, because a bare link makes
 *    every lead land as "direct" and the view/lead numbers unattributable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Check, Copy, Download, ExternalLink, Eye, Globe, Loader2, Share2, Target, Upload, UserCircle2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { supabase } from "@/lib/supabase";
import {
  LINES_OF_BUSINESS, LOB_META, SPOKEN_LANGUAGES, SHARE_CHANNELS,
  displayNameProblem, fetchMyPage, fetchPageViews, pageUrl, updateMyPage, uploadPhoto,
  summariseByApp, summariseByDevice,
  type AdvisorPage, type LineOfBusiness, type PageLocale, type ShareChannel, type ViewStat,
} from "@/lib/advisorPage";

export default function MyPage() {
  const { agent } = useAgent();
  const agentId = agent?.agentId;

  const [page, setPage] = useState<AdvisorPage | null>(null);
  const [views, setViews] = useState<ViewStat[]>([]);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft fields
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [lines, setLines] = useState<LineOfBusiness[]>([]);
  const [primaryLocale, setPrimaryLocale] = useState<PageLocale>("en");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const p = await fetchMyPage(agentId);
      setPage(p);
      if (p) {
        setDisplayName(p.display_name ?? "");
        setCity(p.city ?? "");
        setWhatsapp(p.whatsapp_number ?? "");
        setLanguages(p.languages ?? []);
        setLines(p.lines_of_business ?? []);
        setPrimaryLocale(p.primary_locale ?? "en");
        setPhotoUrl(p.photo_url);

        const [v, leads] = await Promise.all([
          fetchPageViews(p.id).catch(() => [] as ViewStat[]),
          supabase
            .from("agent_leads")
            .select("id", { count: "exact", head: true })
            .eq("agent_id", agentId)
            .eq("landing_slug", p.slug),
        ]);
        setViews(v);
        setLeadCount(leads.count ?? 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your page.");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalViews = useMemo(() => views.reduce((n, v) => n + v.views, 0), [views]);

  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of views) m.set(v.utm_source, (m.get(v.utm_source) ?? 0) + v.views);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [views]);

  // Recovered from the browser itself, so these stay meaningful even when the
  // advisor shares a plain link with no campaign tag on it.
  const byApp = useMemo(() => summariseByApp(views), [views]);
  const byDevice = useMemo(() => summariseByDevice(views), [views]);

  async function save(extra: Partial<{ published: boolean }> = {}) {
    if (!page) return;
    const problem = displayNameProblem(displayName);
    if (problem) {
      toast({ variant: "destructive", title: "Check your name", description: problem });
      return;
    }
    setSaving(true);
    try {
      await updateMyPage(page.id, {
        display_name: displayName.trim(),
        city: city.trim() || null,
        whatsapp_number: whatsapp.replace(/\D/g, "").slice(-10) || null,
        languages,
        lines_of_business: lines,
        primary_locale: primaryLocale,
        photo_url: photoUrl,
        ...extra,
      });
      toast({ variant: "success", title: "Saved" });
      await load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onPhoto(file: File) {
    if (!agentId) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadPhoto(agentId, file);
      setPhotoUrl(url);
      toast({ variant: "success", title: "Photo updated", description: "Remember to save." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not upload that photo",
        description: e instanceof Error ? e.message : "Please try a different image.",
      });
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0D9488]" />
      </div>
    );
  }

  if (error) return <InlineErrorState message={error} onRetry={load} />;

  // No row, or we haven't switched it on yet. Advisor pages are opened up a
  // handful at a time rather than to every signup, because each one is a
  // permanent public URL on the main domain.
  if (!page || !page.enabled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-[#0D9488]" />
              Your advisor page
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              An advisor page is your own public page — your photo, your city, the languages you
              speak — that you can share on WhatsApp, put in your Instagram bio, or print as a QR
              code on your visiting card. Anyone who fills it in lands straight in your Leads.
            </p>
            <p>
              We're opening these up to a few advisors at a time. Write to us and we'll set yours
              up with your own link.
            </p>
            <a href="mailto:hello@indsure.in?subject=Advisor%20page%20request">
              <Button className="bg-[#0D9488] hover:bg-[#0F766E]">Request my page</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const liveUrl = pageUrl(page.slug);
  const canPublish = displayName.trim().length > 1 && lines.length > 0 && !!whatsapp.replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* ── Header + publish ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-900">My page</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your public page at{" "}
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#0D9488] underline"
            >
              indsure.in/a/{page.slug}
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={liveUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" /> Preview
            </Button>
          </a>
          <Button
            onClick={() => save({ published: !page.published })}
            disabled={saving || (!page.published && !canPublish)}
            className={page.published ? "bg-slate-700 hover:bg-slate-800" : "bg-[#0D9488] hover:bg-[#0F766E]"}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {page.published ? "Take page offline" : "Publish my page"}
          </Button>
        </div>
      </div>

      {!page.published && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your page is not live yet. Fill in your details below, then press{" "}
          <strong>Publish my page</strong>.
          {!canPublish && " (Add your name, your WhatsApp number, and at least one type of insurance.)"}
        </div>
      )}

      {/* ── Numbers ──────────────────────────────────────────────────── */}
      {page.published && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={<Eye className="h-4 w-4" />} label="Page views (30 days)" value={totalViews} />
          <StatCard icon={<Target className="h-4 w-4" />} label="Leads from this page" value={leadCount ?? 0} />
          <StatCard
            icon={<Share2 className="h-4 w-4" />}
            label="Best channel"
            value={bySource.length ? bySource[0][0] : "—"}
          />
        </div>
      )}

      {/* ── Where visitors come from ─────────────────────────────────── */}
      {page.published && totalViews > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where your visitors come from</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <BreakdownList title="App" rows={byApp} total={totalViews} />
            <BreakdownList title="Device" rows={byDevice} total={totalViews} />
          </CardContent>
        </Card>
      )}

      {/* ── Details ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Photo */}
          <div className="flex items-center gap-5">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-100" />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-full bg-slate-100">
                <UserCircle2 className="h-9 w-9 text-slate-400" />
              </div>
            )}
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
                {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {photoUrl ? "Change photo" : "Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingPhoto}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPhoto(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="mt-2 text-xs text-slate-500">
                A clear photo of your face. Please don't use a company or insurer logo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Your name" hint="This is what people see on the page.">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
            </Field>
            <Field label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
            </Field>
            <Field label="WhatsApp number" hint="Where enquiries reach you. Can differ from your login number.">
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                inputMode="numeric"
                placeholder="98XXXXXXXX"
              />
            </Field>
            <Field label="Page opens in" hint="The language your customers are most comfortable in.">
              <div className="flex gap-2">
                {(["en", "hi"] as PageLocale[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setPrimaryLocale(l)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      primaryLocale === l
                        ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]"
                        : "border-slate-300 bg-white text-slate-600"
                    }`}
                  >
                    {l === "en" ? "English" : "हिंदी"}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Insurance you handle" hint="Only these show on your page.">
            <div className="flex flex-wrap gap-2">
              {LINES_OF_BUSINESS.map((l) => {
                const on = lines.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLines(on ? lines.filter((x) => x !== l) : [...lines, l])}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      on
                        ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]"
                        : "border-slate-300 bg-white text-slate-600"
                    }`}
                  >
                    <span aria-hidden="true">{LOB_META[l].emoji}</span> {LOB_META[l].en}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Languages you speak" hint="Shown on your page as a trust signal.">
            <div className="flex flex-wrap gap-2">
              {SPOKEN_LANGUAGES.map((lang) => {
                const on = languages.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() =>
                      setLanguages(
                        on ? languages.filter((x) => x !== lang.code) : [...languages, lang.code],
                      )
                    }
                    className={`rounded-lg border px-3.5 py-2 text-sm font-medium ${
                      on
                        ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]"
                        : "border-slate-300 bg-white text-slate-600"
                    }`}
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button onClick={() => save()} disabled={saving} className="bg-[#0D9488] hover:bg-[#0F766E]">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Share kit ────────────────────────────────────────────────── */}
      {page.published && <ShareKit slug={page.slug} name={displayName || page.display_name} />}
    </div>
  );
}

/* ── Share kit ───────────────────────────────────────────────────────────── */

function ShareKit({ slug, name }: { slug: string; name: string }) {
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState<ShareChannel | null>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  // The QR encodes the print-tagged URL, so a scan from a visiting card or a
  // society standee is distinguishable from a WhatsApp tap in the numbers.
  const qrUrl = pageUrl(slug, "qr", campaign);

  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    if (!qrRef.current) return;
    setQrError(false);
    QRCode.toCanvas(qrRef.current, qrUrl, {
      width: 220,
      margin: 2,
      color: { dark: "#0F172A", light: "#FFFFFF" },
    }).catch((err) => {
      // Previously this was fire-and-forget, so a failed render just left a
      // blank square and the advisor had no idea why.
      console.error("QR render failed:", err);
      setQrError(true);
    });
  }, [qrUrl]);

  async function copy(channel: ShareChannel) {
    const url = pageUrl(slug, channel, campaign);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(channel);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      toast({ variant: "destructive", title: "Could not copy", description: url });
    }
  }

  function downloadQr() {
    const canvas = qrRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `indsure-${slug}-qr.png`;
    a.click();
  }

  const waText = `Namaste, I'm ${name}. If you'd like me to look at your insurance policy, or you have any question about cover, here is my page: ${pageUrl(slug, "whatsapp", campaign)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="h-4 w-4 text-[#0D9488]" /> Share your page
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-slate-600">
          Use the link made for the place you're posting it. Each one is already tagged, so your
          page views tell you which channel is actually bringing you enquiries.
        </p>

        <Field
          label="Campaign name (optional)"
          hint="Naming a campaign — say diwali-offer — lets you tell two pushes apart."
        >
          <Input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value.replace(/[^\w-]/g, "-").toLowerCase())}
            placeholder="diwali-2026"
            maxLength={40}
          />
        </Field>

        <div className="grid grid-cols-1 gap-2">
          {SHARE_CHANNELS.map((c) => (
            <div
              key={c.key}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3"
            >
              <span className="sm:w-28 sm:shrink-0 text-sm font-medium text-slate-700">{c.label}</span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-xs text-slate-500">
                  {pageUrl(slug, c.key, campaign)}
                </code>
                <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => copy(c.key)}>
                  {copied === c.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === c.key ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto,1fr] sm:items-start">
          <div className="text-center">
            <canvas
              ref={qrRef}
              className={`rounded-lg border border-slate-200 bg-white ${qrError ? "hidden" : ""}`}
            />
            {qrError && (
              <div className="grid h-[220px] w-[220px] place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-xs text-slate-500">
                Could not draw the QR code. Please reload the page.
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full gap-2"
              onClick={downloadQr}
              disabled={qrError}
            >
              <Download className="h-4 w-4" /> Download QR
            </Button>
            <p className="mt-2 text-[11px] text-slate-400 break-all">{qrUrl}</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Ready-made WhatsApp message</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-sm leading-relaxed text-slate-600">
              {waText}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(waText);
                  toast({ variant: "success", title: "Message copied" });
                } catch {
                  toast({ variant: "destructive", title: "Could not copy" });
                }
              }}
            >
              <Copy className="h-4 w-4" /> Copy message
            </Button>
            <p className="text-xs text-slate-500">
              Print the QR on your visiting card or a standee. Anyone who scans it lands on your
              page.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Small bits ──────────────────────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Simple share-of-total bars. No chart library for three rows of data. */
function BreakdownList({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { key: string; label: string; views: number }[];
  total: number;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r) => {
          const pct = total > 0 ? Math.round((r.views / total) * 100) : 0;
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-700">{r.label}</span>
                <span className="tabular-nums text-slate-500">
                  {r.views} <span className="text-slate-400">({pct}%)</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#0D9488]" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
