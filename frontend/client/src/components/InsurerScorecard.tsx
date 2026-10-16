import { ExternalLink } from "lucide-react";
import metricsJson from "@shared/data/insurerMetrics.json";
import { type ComparisonSide, sideName } from "@/lib/wordingProfile";
import {
  type InsurerMetricsDataset, type MetricKey, type MetricPoint,
  METRIC_KEYS, matchInsurer, usableMetric, notPublished, sourceLabel, formatMetric, smallBase,
} from "@/lib/insurerMetrics";
import { SIDE_PALETTE } from "@/components/ComparisonView";
import { useLanguage } from "@/i18n/LanguageContext";

// Built from IRDAI publications by a research pass and an independent second
// reader (docs/plans/2026-10-15-insurer-metrics-sources.md). No number here is
// ever typed in by hand.
const DATASET: InsurerMetricsDataset = metricsJson;

const LABEL_KEY: Record<MetricKey, string> = {
  csr: "insurer_scorecard.csr_label",
  icr: "insurer_scorecard.icr_label",
  grievances_per_10k: "insurer_scorecard.grievances_label",
};
const EXPLAIN_KEY: Record<MetricKey, string> = {
  csr: "insurer_scorecard.explain_csr",
  icr: "insurer_scorecard.explain_icr",
  grievances_per_10k: "insurer_scorecard.explain_grievances",
};
const LINE_KEY: Record<MetricKey, string> = {
  csr: "insurer_scorecard.csr_line",
  icr: "insurer_scorecard.icr_line",
  grievances_per_10k: "insurer_scorecard.grievances_line",
};

// Two plans stay side by side even on a phone; more than two wrap.
const GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

/**
 * IRDAI numbers for each insurer in a comparison, one column per plan.
 * Describes the companies only: it never ranks them or picks one.
 * Compare page only (founder decision 2026-10-15).
 */
export default function InsurerScorecard({
  sides,
  dataset = DATASET,
}: {
  sides: ComparisonSide[];
  dataset?: InsurerMetricsDataset;
}) {
  const { t } = useLanguage();
  const rows = sides.map((s) => matchInsurer(s.insurer, dataset));
  // A metric no side has a number for is left out, and a card with no numbers
  // at all is not shown: rows of "Not available" tell the advisor nothing.
  // IRDAI publishes CSR and complaints per policy only for standalone health
  // insurers, so two general insurers show ICR alone.
  const shown = METRIC_KEYS.filter((key) => rows.some((r) => usableMetric(r, key)));
  if (shown.length === 0) return null;
  const gridClass = GRID[sides.length] ?? GRID[4];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="insurer-scorecard-title">
      <h2 id="insurer-scorecard-title" className="text-xl font-black text-[#0B1120]">{t("insurer_scorecard.title")}</h2>
      <p className="mt-1 text-[15px] text-slate-600">{t("insurer_scorecard.subtitle")}</p>

      {shown.map((key) => (
        <div key={key} className="mt-5">
          <h3 className="text-base font-bold text-[#0B1120]">{t(LABEL_KEY[key])}</h3>
          <div className={`mt-2 grid gap-3 ${gridClass}`}>
            {sides.map((side, i) => (
              <MetricCell
                key={i}
                name={side.insurer || sideName(side)}
                named={!!side.insurer}
                color={SIDE_PALETTE[i % SIDE_PALETTE.length].accent}
                metricKey={key}
                metric={usableMetric(rows[i], key)}
                unpublished={notPublished(rows[i], key)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-6 rounded-xl bg-[#F8FAFC] border border-slate-200 p-4">
        <h3 className="text-base font-bold text-[#0B1120]">{t("insurer_scorecard.explain_title")}</h3>
        <ul className="mt-2 space-y-2 text-[15px] leading-relaxed text-slate-700">
          {shown.map((key) => <li key={key}>{t(EXPLAIN_KEY[key])}</li>)}
        </ul>
      </div>
    </section>
  );
}

function MetricCell({
  name, named, color, metricKey, metric, unpublished,
}: {
  name: string;
  named: boolean;
  color: string;
  metricKey: MetricKey;
  metric: MetricPoint | null;
  unpublished: boolean;
}) {
  const { t } = useLanguage();
  const unit = metricKey === "grievances_per_10k" ? "" : "%";

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-[#FAFAF8] p-3 sm:p-4">
      <p className="flex items-start gap-2 text-sm font-semibold text-slate-700 break-words">
        <span aria-hidden="true" className="mt-1 inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="min-w-0">{name}</span>
      </p>

      {metric ? (
        <>
          <p className="mt-2 text-2xl font-black text-[#0B1120]">
            {formatMetric(metric.value)}{unit}
          </p>
          <p className="text-sm text-slate-600">{t("insurer_scorecard.fy", { fy: metric.fy })}</p>
          <p className="mt-2 text-[15px] leading-snug text-slate-700">
            {t(LINE_KEY[metricKey], { n: metricKey === "grievances_per_10k" ? formatMetric(metric.value) : Math.round(metric.value) })}
          </p>
          {(() => {
            const sb = smallBase(metricKey, metric);
            if (!sb) return null;
            const text =
              sb.kind === "claims"
                ? t("insurer_scorecard.small_claims", { n: sb.n.toLocaleString("en-IN") })
                : sb.kind === "policies"
                  ? t("insurer_scorecard.small_policies", { n: sb.n.toLocaleString("en-IN") })
                  : t("insurer_scorecard.small_premium", { n: Math.round(sb.lakh).toLocaleString("en-IN") });
            return <p className="mt-2 rounded-md bg-[#FFFBEB] px-2 py-1 text-sm text-[#78350F]">{text}</p>;
          })()}
          <a
            href={metric.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[#0F766E] underline underline-offset-2 hover:text-[#115E59] break-words"
          >
            <span className="min-w-0">
              {metric.page != null && metric.page > 0
                ? t("insurer_scorecard.source_page", { doc: sourceLabel(metric.source_doc), page: metric.page })
                : t("insurer_scorecard.source", { doc: sourceLabel(metric.source_doc) })}
            </span>
            <ExternalLink aria-hidden="true" className="h-4 w-4 flex-shrink-0" />
            <span className="sr-only">{t("insurer_scorecard.new_tab")}</span>
          </a>
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px] font-semibold text-slate-700">{t(unpublished ? "insurer_scorecard.not_published" : "insurer_scorecard.not_available")}</p>
          {!named && <p className="mt-1 text-sm text-slate-600">{t("insurer_scorecard.no_insurer")}</p>}
        </>
      )}
    </div>
  );
}
