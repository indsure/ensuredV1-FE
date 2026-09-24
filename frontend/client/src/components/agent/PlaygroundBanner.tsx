import { PlayCircle, Sparkles, X } from "lucide-react";
import { isPlaygroundMode, exitPlayground } from "@/lib/playground/mode";
import { endTour, startTour } from "@/lib/playground/tour";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Persistent banner shown across the agent portal while in demo playground
 * mode, so a visitor always knows the data is sample data and nothing is saved.
 * The exit button drops the flag and returns to the agent landing page.
 */
export default function PlaygroundBanner() {
  const { t } = useLanguage();
  if (!isPlaygroundMode()) return null;

  function exit() {
    endTour();
    exitPlayground();
    window.location.href = "/agent";
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-[#0D9488] text-white px-4 md:px-6 lg:px-8 py-2 text-sm">
      <span className="inline-flex items-center gap-2 font-semibold">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>{t("playground.banner")}</span>
      </span>
      <div className="flex items-center gap-2">
      {/* Icon only on a phone: two worded buttons beside the notice wrapped
          the banner onto three lines at 375px. */}
      <button
        onClick={startTour}
        aria-label={t("tour.take_tour")}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg bg-white text-[#0F766E] hover:bg-white/90 px-2 sm:px-3 py-1 font-semibold transition-colors whitespace-nowrap"
      >
        <PlayCircle className="h-4 w-4" />
        <span className="hidden sm:inline">{t("tour.take_tour")}</span>
      </button>
      <button
        onClick={exit}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1 font-semibold transition-colors whitespace-nowrap"
      >
        <X className="h-4 w-4" />
        {t("playground.exit")}
      </button>
      </div>
    </div>
  );
}
