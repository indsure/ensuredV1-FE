import { useEffect } from "react";
import { useLocation } from "wouter";
import { enterPlayground } from "@/lib/playground/mode";
import { installPlaygroundFetch } from "@/lib/playground/mockClient";

/**
 * Clean, shareable entry point for the demo: visiting /agent/playground turns on
 * playground mode (so the whole portal runs against the in-memory mock) and
 * forwards into the dashboard. Doing it here — rather than as a side-effect of a
 * button — means the URL itself is the switch, so it can be linked or bookmarked.
 */
export default function PlaygroundEntry() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    enterPlayground();
    installPlaygroundFetch(); // patch fetch now so /api flows simulate without a reload
    setLocation("/agent/dashboard");
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center gap-4">
      <div className="w-6 h-6 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin" />
      <p className="text-sm text-slate-500">Setting up your playground…</p>
    </div>
  );
}
