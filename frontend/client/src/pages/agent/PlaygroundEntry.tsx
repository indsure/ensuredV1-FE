import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { enterPlayground } from "@/lib/playground/mode";
import { installPlaygroundFetch } from "@/lib/playground/mockClient";
import { setTourState } from "@/lib/playground/tour";
import { DEMO_ROUTES } from "@/lib/advisorGuide";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSEO } from "@/hooks/use-seo";
import { seoFor } from "@/data/seo-pages";

/**
 * Clean, shareable entry point for the demo: visiting /agent/playground turns on
 * playground mode (so the whole portal runs against the in-memory mock) and
 * forwards into the dashboard. Doing it here — rather than as a side-effect of a
 * button — means the URL itself is the switch, so it can be linked or bookmarked.
 *
 * ?tour=1 starts the guided tour at step 1. ?go=<route> opens one screen, for
 * the "See it in the demo" links on /advisors/features; it is only honoured for
 * routes in DEMO_ROUTES, so it cannot send anyone off-site. With neither, the
 * visitor lands on the dashboard and is offered the tour.
 */
export default function PlaygroundEntry() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { t } = useLanguage();
  // A demo dashboard ("Good evening, Rajesh") is not a page anyone should land on from search.
  useSEO(seoFor("/agent/playground"));

  useEffect(() => {
    const params = new URLSearchParams(search);
    const go = params.get("go");
    const target = go && DEMO_ROUTES.has(go) ? go : "/agent/dashboard";

    enterPlayground();
    installPlaygroundFetch(); // patch fetch now so /api flows simulate without a reload
    if (params.get("tour") === "1") setTourState(0);
    else if (!go) setTourState("welcome");
    else setTourState(null);
    setLocation(params.get("tour") === "1" ? "/agent/dashboard" : target, { replace: true });
  }, [search, setLocation]);

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center gap-4">
      <div className="w-6 h-6 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin" />
      <p className="text-sm text-slate-500">{t("playground.setting_up")}</p>
    </div>
  );
}
