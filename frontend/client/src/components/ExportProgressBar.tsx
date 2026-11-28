import { useLanguage } from "@/i18n/LanguageContext";
import { exportPercent, megabytes, type ExportProgress } from "@/lib/exportDownload";

/**
 * The live bar under "Download my data". Three honest states: the server is
 * still gathering files (no bytes yet, so the bar moves without a number), the
 * zip is arriving (real percent and megabytes), and the file is being saved.
 */
export function ExportProgressBar({ progress }: { progress: ExportProgress | null }) {
  const { t } = useLanguage();
  if (!progress) return null;
  const pct = exportPercent(progress);

  let label: string;
  if (progress.phase === "preparing") label = t("export_progress.preparing");
  else if (progress.phase === "saving") label = t("export_progress.saving");
  else if (progress.total) {
    label = t("export_progress.downloading", {
      done: megabytes(progress.received),
      total: megabytes(progress.total),
    });
    if (progress.secondsLeft != null && progress.received > 0) {
      label += " · " + (progress.secondsLeft < 5
        ? t("export_progress.almost")
        : t("export_progress.seconds_left", { seconds: String(progress.secondsLeft) }));
    }
  } else {
    label = t("export_progress.downloading_unknown", { done: megabytes(progress.received) });
  }

  return (
    <div className="w-full max-w-md space-y-2" aria-live="polite">
      <div
        role="progressbar"
        aria-label={t("export_progress.aria")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-valuetext={label}
        className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200"
      >
        {pct == null ? (
          <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-teal-600 motion-safe:animate-[exportSlide_1.4s_ease-in-out_infinite]" />
        ) : (
          <div className="h-full rounded-full bg-teal-600 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        )}
      </div>
      <p className="flex justify-between gap-3 text-sm text-slate-700">
        <span>{label}</span>
        {pct != null && <span className="font-semibold tabular-nums">{pct}%</span>}
      </p>
      <style>{`@keyframes exportSlide { 0% { left: -33%; } 100% { left: 100%; } }`}</style>
    </div>
  );
}
