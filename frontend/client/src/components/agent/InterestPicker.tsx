import { useId } from "react";
import { Check } from "lucide-react";

import { useLanguage } from "@/i18n/LanguageContext";
import { INTEREST_OPTIONS, interestLabel, joinInterest, splitInterest } from "@/lib/leadLabels";

/**
 * Tap-to-toggle chips for "Interested in". Big targets instead of a dropdown
 * with checkboxes, because the advisors using this are 40+. Deliberately not
 * wrapped in a <label>: a label forwards stray clicks to its first button,
 * which would toggle "Health" whenever someone tapped the gap between chips.
 */
export function InterestPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { t } = useLanguage();
  const labelId = useId();
  const selected = splitInterest(value);
  const isOn = (o: string) => selected.some((s) => s.toLowerCase() === o.toLowerCase());

  // Values that are not one of the standard options (free text from a landing
  // page, e.g. "Family health") stay as chips so saving never drops them.
  const extras = selected.filter((s) => !INTEREST_OPTIONS.some((o) => o.toLowerCase() === s.toLowerCase()));

  function toggle(o: string) {
    const next = isOn(o)
      ? selected.filter((s) => s.toLowerCase() !== o.toLowerCase())
      : [...selected, o];
    onChange(joinInterest(next));
  }

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
      <span id={labelId} className="text-xs font-bold text-slate-500">
        {t("leads.f_interest")} <span className="font-normal text-slate-400">({t("leads.f_interest_hint")})</span>
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {[...INTEREST_OPTIONS, ...extras].map((o) => {
          const on = isOn(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
              className={[
                "inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 py-2 text-base font-bold transition-colors",
                on ? "bg-[#0D9488] text-white border-[#0D9488]" : "bg-white text-slate-600 border-slate-200 hover:border-[#0D9488]/40",
              ].join(" ")}
            >
              {on && <Check className="h-4 w-4" />} {interestLabel(t, o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
