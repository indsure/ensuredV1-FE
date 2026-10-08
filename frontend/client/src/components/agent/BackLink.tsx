import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { previousLocation } from "@/lib/navHistory";

/**
 * The one Back link every portal detail page uses, so they all look and behave
 * the same: arrow, label, a 44px tap target.
 *
 * - Came from the list: back to it as it was left (its filters live in the URL).
 * - Came from elsewhere in the portal (dashboard, a customer, the queue): back
 *   there, labelled plain "Back", because "Back to policies" would be a lie.
 * - Opened directly (shared link, new tab, refresh): the list.
 */
export function BackLink({ to, label }: { to: string; label: string }) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const prev = previousLocation();
  const fromList = prev !== null && prev.split("?")[0] === to;
  const text = prev === null || fromList ? label : t("common.back");

  return (
    <Button
      variant="ghost"
      className="min-h-[44px] gap-2 text-slate-600"
      onClick={() => setLocation(prev ?? to)}
    >
      <ArrowLeft className="h-4 w-4" />
      {text}
    </Button>
  );
}
