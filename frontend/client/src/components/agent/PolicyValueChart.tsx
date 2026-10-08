/**
 * The value card on a life or term policy.
 *
 * Shows what the customer can get, each figure with what it is based on, and
 * where the advisor records what they know (payments, loan, insurer figures,
 * a check against the document, a factor table). Built on lib/policyValue.
 *
 * Kept as the default export under the old name so PolicyDetail is unchanged.
 */

import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { readEvidence } from "@/lib/policyEvidence";
import { valuePolicy } from "@/lib/policyValue";
import { ValueSummary } from "./policyValue/ValueSummary";
import { EvidencePanel } from "./policyValue/EvidencePanel";
import { RulesEditor } from "./policyValue/RulesEditor";
import { useEvidenceSave } from "./policyValue/useEvidenceSave";
import { docResults, useDocumentRules } from "./policyValue/useDocumentRules";

interface Props {
  clientId: string;
  insuranceType: string;
  data: Record<string, any> | null | undefined;
  onSaved?: () => void;
}

export default function PolicyValueChart({ clientId, insuranceType, data, onSaved }: Props) {
  const { t } = useLanguage();
  // The server's reply after a save, used until the page reloads its copy.
  const [fresh, setFresh] = useState<Record<string, any> | null>(null);
  const [open, setOpen] = useState<"evidence" | "rules" | null>(null);

  const effective = useMemo(() => fresh ?? data ?? {}, [fresh, data]);
  const v = useMemo(() => valuePolicy(insuranceType, effective), [insuranceType, effective]);
  const evidence = useMemo(() => readEvidence(effective.value_evidence).evidence, [effective]);
  const { save, saving } = useEvidenceSave(clientId, effective, (next) => {
    setFresh(next);
    onSaved?.();
  });

  // Terms read from the policy document and confirmed by the advisor, if any.
  const { rules } = useDocumentRules(clientId);
  const doc = useMemo(() => {
    if (!rules?.parse || rules.parse.status !== "supported") return null;
    // Factor-table plans: the Policy summary card carries the GSV; this card adds only the maturity note.
    if (rules.fields.some((f) => f.field_key === "surrender.gsv_factor_table" || f.field_key === "illustration.rows")) return { gsv: null, termsPending: false, noMaturity: false };
    const r = docResults(rules, effective.value_evidence);
    const maturity = rules.fields.find((f) => f.field_key === "benefits.maturity");
    return {
      gsv: r?.gsv.amount ?? null,
      // Terms or answers still outstanding (as opposed to, say, payment records).
      termsPending: !r || r.gsv.missing.some((m) => m.startsWith("fact_not_confirmed") || m.startsWith("flag_")),
      noMaturity: maturity?.document_field?.state === "not_applicable" && maturity.state !== "rejected" && maturity.state !== "corrected",
    };
  }, [rules, effective]);

  const toggle = (k: "evidence" | "rules") => setOpen((o) => (o === k ? null : k));

  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="border-b border-slate-50 pb-4">
        <CardTitle>{t("pvc.title")}</CardTitle>
        <p className="mt-1 text-sm text-slate-600">{t("pvc.intro")}</p>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <ValueSummary v={v} doc={doc} />

        <div className="rounded-xl border border-slate-200">
          <button type="button" onClick={() => toggle("evidence")} aria-expanded={open === "evidence"}
            className="flex min-h-11 w-full items-center justify-between p-4 text-left">
            <span className="text-base font-bold text-slate-900">{t("pvc.ev_title")}</span>
            <span className="text-sm text-slate-600">{open === "evidence" ? "▲" : "▼"}</span>
          </button>
          {open === "evidence" && (
            <div className="border-t border-slate-100 p-4">
              <EvidencePanel data={effective} evidence={evidence} v={v} saving={saving} save={save} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200">
          <button type="button" onClick={() => toggle("rules")} aria-expanded={open === "rules"}
            className="flex min-h-11 w-full items-center justify-between p-4 text-left">
            <span className="text-base font-bold text-slate-900">{t("pvc.rules_title")}</span>
            <span className="text-sm text-slate-600">{open === "rules" ? "▲" : "▼"}</span>
          </button>
          {open === "rules" && (
            <div className="border-t border-slate-100 p-4">
              <RulesEditor data={effective} evidence={evidence} v={v} saving={saving} save={save} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
