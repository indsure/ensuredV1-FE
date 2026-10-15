import { ExternalLink } from "lucide-react";
import metricsJson from "@shared/data/insurerMetrics.json";
import { type ComparisonSide, sideName } from "@/lib/wordingProfile";
import {
  type InsurerMetricsDataset, type MetricKey, type MetricPoint,
  METRIC_KEYS, matchInsurer, usableMetric, sourceLabel, formatMetric,
} from "@/lib/insurerMetrics";
import { SIDE_PALETTE } from "@/components/ComparisonView";
import { useLanguage } from "@/i18n/LanguageContext";

// Until the IRDAI dataset lands this file holds "insurers": [], so every row
// reads "Not available yet". No number here is ever typed in by hand.
const DATASET: InsurerMetricsDataset = metricsJson;

const LABEL_KEY: Record<MetricKey, string> = {
  csr: "insurer_scorecard.csr_label",
  icr: "insurer_scorecard.icr_label",
  grievances_per_10k: "insurer_scorecard.grievances_label",
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
  const gridClass = GRID[sides.length] ?? GRID[4];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="insurer-scorecard-title">
      <h2 id="insurer-scorecard-title" className="text-xl font-black text-[#0B1120]">{t("insurer_scorecard.title")}</h2>
      <p className="mt-1 text-[15px] text-slate-600">{t("insurer_scorecard.subtitle")}</p>

      {METRIC_KEYS.map((key) => (
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
              />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-6 rounded-xl bg-[#F8FAFC] border border-slate-200 p-4">
        <h3 className="text-base font-bold text-[#0B1120]">{t("insurer_scorecard.explain_title")}</h3>
        <ul className="mt-2 space-y-2 text-[15px] leading-relaxed text-slate-700">
          <li>{t("insurer_scorecard.explain_csr")}</li>
          <li>{t("insurer_scorecard.explain_icr")}</li>
          <li>{t("insurer_scorecard.explain_grievances")}</li>
        </ul>
      </div>
    </section>
  );
}

function MetricCell({
  name, named, color, metricKey, metric,
}: {
  name: string;
  named: boolean;
  color: string;
  metricKey: MetricKey;
  metric: MetricPoint | null;
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
          <a
            href={metric.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[#0F766E] underline underline-offset-2 hover:text-[#115E59] break-words"
          >
            <span className="min-w-0">
              {metric.page > 0
                ? t("insurer_scorecard.source_page", { doc: sourceLabel(metric.source_doc), page: metric.page })
                : t("insurer_scorecard.source", { doc: sourceLabel(metric.source_doc) })}
            </span>
            <ExternalLink aria-hidden="true" className="h-4 w-4 flex-shrink-0" />
            <span className="sr-only">{t("insurer_scorecard.new_tab")}</span>
          </a>
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px] font-semibold text-slate-700">{t("insurer_scorecard.not_available")}</p>
          {!named && <p className="mt-1 text-sm text-slate-600">{t("insurer_scorecard.no_insurer")}</p>}
        </>
      )}
    </div>
  );
}
