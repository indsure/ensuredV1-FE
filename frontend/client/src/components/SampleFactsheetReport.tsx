import { Link } from "wouter";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import PolicyFactsheet from "@/components/app/PolicyFactsheet";
import { useLanguage } from "@/i18n/LanguageContext";
import { ADD_ON_FINDINGS_KEY, type AddOnScan } from "@shared/motorAddOns";
import {
  scoreMotorPolicy, motorScoreCaption, motorScoreVerdict, motorScoreTone,
} from "@shared/motorScore";
import { SAMPLE_FACTSHEETS, type SampleType } from "@/lib/sampleFactsheets";

/**
 * The public sample for a life, term or vehicle policy: the same summary table
 * (and, for motor, the same cover score and add-on checklist) that a real
 * upload produces, on made-up details.
 *
 * Life and term have no score, and the page says so in words rather than
 * leaving a reader to wonder where it went. The motor score is computed by the
 * real scorer from the sample's add-on scan, never typed in.
 */

const MOTOR_TONE_CLASS = {
  strong: "text-emerald-600",
  core: "text-amber-600",
  basic: "text-slate-700",
  third_party: "text-red-600",
  unscored: "text-slate-500",
} as const;

const MOTOR_BAR_CLASS = {
  strong: "bg-emerald-500",
  core: "bg-amber-500",
  basic: "bg-slate-400",
  third_party: "bg-red-500",
  unscored: "bg-slate-300",
} as const;

const BACK_HREF: Record<SampleType, string> = { life: "/life", term: "/term", motor: "/vehicle" };

export function SampleFactsheetReport({ type }: { type: SampleType }) {
  const { t, locale } = useLanguage();
  const data = SAMPLE_FACTSHEETS[type];
  const motor =
    type === "motor"
      ? scoreMotorPolicy((data[ADD_ON_FINDINGS_KEY] ?? null) as AddOnScan | null, data.coverage_type as string)
      : null;

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)]">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-32 sm:px-6 sm:pt-36 md:pt-40">
        <Link href={BACK_HREF[type]}>
          <span className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-navy-900)]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("sfs.back")}
          </span>
        </Link>

        <div
          role="note"
          className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-base">{t("sfs.banner")}</p>
        </div>

        <h1 className="mt-8 font-serif text-3xl text-[var(--color-navy-900)] sm:text-4xl">{t(`sfs.h_${type}`)}</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-text-secondary)]">
          {t(`sfs.sub_${type}`)}
        </p>

        <div className="mt-8 space-y-6">
          {motor && (
            <section className="rounded-2xl border border-[var(--color-border-light)] bg-white p-6">
              <div className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
                {t("policy_detail.cover_score")}
              </div>
              <div className={`mt-2 text-4xl font-black ${MOTOR_TONE_CLASS[motorScoreTone(motor)]}`}>
                {motor.score == null ? "-" : motor.score}
                {motor.score != null && <span className="text-xl font-extrabold text-slate-500">/100</span>}
              </div>
              <div className="text-base font-medium text-slate-700">{motorScoreVerdict(motor)}</div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${MOTOR_BAR_CLASS[motorScoreTone(motor)]}`}
                  style={{ width: `${motor.score ?? 0}%` }}
                />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">{motorScoreCaption(motor)}</p>
              {locale === "hi" && <p className="mt-1 text-sm text-slate-500">{t("pf.c_motor_english")}</p>}
            </section>
          )}

          <PolicyFactsheet insuranceType={type} data={data} />
        </div>

        <div className="mt-10 rounded-2xl border border-[var(--color-border-light)] bg-white p-6 text-center">
          <p className="text-base text-[var(--color-text-secondary)]">{t("sfs.cta_b")}</p>
          <Link href="/signup">
            <Button size="lg" className="mt-4 min-h-12 bg-[var(--color-navy-900)] text-white hover:bg-[var(--color-navy-800)]">
              {t("sfs.cta")}
            </Button>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
