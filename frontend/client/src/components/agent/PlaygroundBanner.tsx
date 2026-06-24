import { Sparkles, X } from "lucide-react";
import { isPlaygroundMode, exitPlayground } from "@/lib/playground/mode";

/**
 * Persistent banner shown across the agent portal while in demo playground
 * mode, so a visitor always knows the data is sample data and nothing is saved.
 * The exit button drops the flag and returns to the agent landing page.
 */
export default function PlaygroundBanner() {
  if (!isPlaygroundMode()) return null;

  function exit() {
    exitPlayground();
    window.location.href = "/agent";
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-[#0D9488] text-white px-4 md:px-6 lg:px-8 py-2 text-sm">
      <span className="inline-flex items-center gap-2 font-semibold">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>
          Playground — demo data, nothing is saved.{" "}
          <span className="font-normal opacity-90">यह डेमो है — कुछ भी सेव नहीं होगा।</span>
        </span>
      </span>
      <button
        onClick={exit}
        className="inline-flex items-center gap-1 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1 font-semibold transition-colors whitespace-nowrap"
      >
        <X className="h-4 w-4" />
        Exit demo
      </button>
    </div>
  );
}
