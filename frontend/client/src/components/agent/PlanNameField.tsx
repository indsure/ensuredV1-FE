import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, apiJson } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

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
      toast({ variant: "success", title: "Plan name saved" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not save",
        description: err instanceof Error ? err.message : "Please try again.",
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
          placeholder="Plan name as printed on the policy"
          className="min-h-11 w-full max-w-sm"
        />
        <Button
          className="min-h-11 bg-[#0D9488] hover:bg-[#0f766e]"
          disabled={saving}
          onClick={() => void save(draft)}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="outline"
          className="min-h-11 border-slate-200 bg-white"
          disabled={saving}
          onClick={() => { setDraft(name ?? ""); setEditing(false); }}
        >
          Cancel
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
        We could not find the plan name in this document
      </p>
      <p className="mt-1 text-sm text-amber-800">
        Rather than guess, we have left it blank. Add it and it will appear on
        the customer's report.
      </p>

      {suggestion && !dismissed && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
          {/* A question, not an answer. Nothing is stored until they say yes,
              which is the whole point: the old behaviour stored this silently
              and printed it to the customer. */}
          <p className="text-sm text-slate-700">
            Did you mean <span className="font-bold text-slate-900">{suggestion}</span>?
          </p>
          <p className="mt-1 text-sm text-slate-500">
            We matched this from wording in the document, so it may be wrong.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              className="min-h-11 bg-[#0D9488] hover:bg-[#0f766e]"
              disabled={saving}
              onClick={() => void save(suggestion)}
            >
              <Check className="mr-1.5 h-4 w-4" />
              Yes, use this
            </Button>
            <Button
              variant="outline"
              className="min-h-11 border-slate-200 bg-white"
              disabled={saving}
              onClick={() => setDismissed(true)}
            >
              <X className="mr-1.5 h-4 w-4" />
              No
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
        Add plan name
      </Button>
    </div>
  );
}
