/**
 * Saves advisor evidence for one policy.
 *
 * Sends only the evidence key, with the revision the card was loaded at. The
 * server merges records one by one and refuses a save made against an older
 * revision (409), so a second tab or a stale card can never wipe out a
 * payment someone else recorded. On a conflict the card reloads and says so.
 *
 * In the playground the same request goes to the demo mock, which keeps the
 * change for the session and moves the revision on the same way.
 */

import { useState } from "react";

import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { EVIDENCE_KEY, type ValueEvidence } from "@/lib/policyEvidence";

export function useEvidenceSave(clientId: string, data: Record<string, any>, onSaved: (next: Record<string, any> | null) => void) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);

  async function save(evidence: ValueEvidence): Promise<boolean> {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch(`${getApiBase()}/api/agent/clients/${clientId}/extracted-data`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          expected_rev: Number.isInteger(data._rev) ? data._rev : 0,
          extracted_data: { [EVIDENCE_KEY]: evidence },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast({ variant: "destructive", title: t("pvc.stale") });
        onSaved(null);
        return false;
      }
      if (!res.ok) {
        toast({ variant: "destructive", title: t("pvc.save_failed"), description: body?.message || body?.error || "" });
        return false;
      }
      toast({ variant: "success", title: t("pvc.saved") });
      onSaved(body?.extracted_data ?? null);
      return true;
    } catch {
      toast({ variant: "destructive", title: t("pvc.save_failed") });
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { save, saving };
}
