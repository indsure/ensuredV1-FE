import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, apiJson } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";

interface PlanNameFieldProps {
  clientId: string;
  /** Read from the policy document. Null means we could not read one. */
  name: string | null;
  /** Best guess, when the name could not be read. Never shown to a customer. */
  suggestion: string | null;
  onSaved: () => void | Promise<void>;
}

/**
 * The plan name, and an honest account of where it came from.
 *
 * A Tata AIG policy used to display "Optima Restore" — a rival insurer's
 * product — because the extractor matched the word "restore" against an alias
 * list and stored the guess exactly like a reading. Nothing on screen could
 * have told the advisor, and the same name went onto the customer's report.
 *
 * So: a name that was read from the document is shown plainly. A name that was
 * not is not shown at all. In its place is a blank the advisor can fill, plus
 * the guess offered as a question they answer rather than an answer they have
 * to notice is wrong.
 */
export function PlanNameField({ clientId, name, suggestion, onSaved }: PlanNameFieldProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? "");
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  async function save(value: string) {
    setSaving(true);
    try {
      await apiJson(
        apiFetch(`/api/agent/clients/${clientId}/plan-name`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policy_name: value }),
        }),
      );
      setEditing(false);
      await onSaved();
      toast({ variant: "success", title: t("plan_name.saved") });
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("plan_name.save_failed"),
        description: err instanceof Error ? err.message : t("common.try_again_later"),
      });
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={draft}
          autoFocus
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save(draft);
            if (event.key === "Escape") setEditing(false);
          }}
          placeholder={t("plan_name.placeholder")}
          className="min-h-11 w-full max-w-sm"
        />
        <Button
          className="min-h-11 bg-[#0D9488] hover:bg-[#0f766e]"
          disabled={saving}
          onClick={() => void save(draft)}
        >
          {saving ? t("plan_name.saving") : t("plan_name.save")}
        </Button>
        <Button
          variant="outline"
          className="min-h-11 border-slate-200 bg-white"
          disabled={saving}
          onClick={() => { setDraft(name ?? ""); setEditing(false); }}
        >
          {t("common.cancel")}
        </Button>
      </div>
    );
  }

  // Read from the document. Editable, but presented as settled.
  if (name) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(name); setEditing(true); }}
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#0D9488]"
      >
        {name}
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-900">
        {t("plan_name.not_found")}
      </p>
      <p className="mt-1 text-sm text-amber-800">
        {t("plan_name.not_found_desc")}
      </p>

      {suggestion && !dismissed && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
          {/* A question, not an answer. Nothing is stored until they say yes,
              which is the whole point: the old behaviour stored this silently
              and printed it to the customer. */}
          <p className="text-sm text-slate-700">
            {t("plan_name.did_you_mean")} <span className="font-bold text-slate-900">{suggestion}</span>?
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {t("plan_name.match_note")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              className="min-h-11 bg-[#0D9488] hover:bg-[#0f766e]"
              disabled={saving}
              onClick={() => void save(suggestion)}
            >
              <Check className="mr-1.5 h-4 w-4" />
              {t("plan_name.yes_use")}
            </Button>
            <Button
              variant="outline"
              className="min-h-11 border-slate-200 bg-white"
              disabled={saving}
              onClick={() => setDismissed(true)}
            >
              <X className="mr-1.5 h-4 w-4" />
              {t("plan_name.no")}
            </Button>
          </div>
        </div>
      )}

      <Button
        variant="outline"
        className="mt-3 min-h-11 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
        onClick={() => { setDraft(""); setEditing(true); }}
      >
        <Pencil className="mr-1.5 h-4 w-4" />
        {t("plan_name.add")}
      </Button>
    </div>
  );
}
