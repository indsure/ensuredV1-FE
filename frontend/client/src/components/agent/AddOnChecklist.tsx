import { Check, Minus, Info, ShieldCheck, HelpCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatINRFull } from "@/lib/format";
import { ADD_ON_FINDINGS_KEY, type AddOnScan, type AddOnFinding } from "@shared/motorAddOns";

/**
 * Add-on cover found on a motor policy, read from the document in code.
 *
 * Every tick shows the line it came from, because an agent forwards this to a
 * customer and a claim with no source is not one we make. Nothing here is
 * labelled "recommended": which add-ons deserve that word is still a founder
 * decision, so the card counts what was found against what we can detect.
 *
 * Type floor is 14px throughout and muted text stops at slate-500, for the
 * 40-plus agents this portal is built for.
 */

interface Props {
  data: Record<string, any> | null | undefined;
}

function isScan(v: any): v is AddOnScan {
  return !!v && typeof v === "object" && Array.isArray(v.findings) && v.version === 1;
}

const CLASS_LABEL = { car: "car", bike: "two-wheeler" } as const;

function Row({ f }: { f: AddOnFinding }) {
  const found = f.state === "present";
  const check = f.state === "check_manually";
  return (
    <div
      className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-4 border-b border-slate-50 px-6 py-4 last:border-b-0 ${
        found ? "bg-emerald-50/40" : ""
      }`}
    >
      <span
        className={`mt-0.5 grid h-6 w-6 place-items-center rounded-lg border ${
          found
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : check
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-slate-50 text-slate-500"
        }`}
      >
        {found ? (
          <Check className="h-3.5 w-3.5" strokeWidth={3.2} />
        ) : check ? (
          <HelpCircle className="h-3.5 w-3.5" strokeWidth={2.5} />
        ) : (
          <Minus className="h-3.5 w-3.5" strokeWidth={3.2} />
        )}
      </span>

      <span className="min-w-0">
        <span className={`text-base ${found ? "font-semibold text-slate-800" : "font-medium text-slate-600"}`}>
          {f.label}
        </span>
        {/* On a proven-empty policy every row carries the same arithmetic
            sentence, which is nine copies of one fact. The footer states it
            once. The evidence stays in the data either way. */}
        {f.evidence && f.state !== "absent_proven" && (
          <div className="mt-1.5 overflow-x-auto whitespace-nowrap pb-0.5 font-mono text-sm leading-relaxed text-slate-500">
            {f.evidence}
          </div>
        )}
      </span>

      {found && typeof f.amount === "number" ? (
        <span className="whitespace-nowrap text-base font-bold tabular-nums text-slate-800">
          {formatINRFull(f.amount)}
        </span>
      ) : (
        <span
          className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-sm font-semibold ${
            found
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : check
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          {/* `found` first. Not every insurer prices its add-ons: Acko declares
              them in prose with no rupee figure, so a ticked row fell through to
              the else and printed "Not found in this document" beside its own
              green tick and its own quoted evidence. */}
          {found
            ? "On this policy"
            : f.state === "absent_proven"
            ? "Not on this policy"
            : check
            ? "Needs a look"
            : "Not found in this document"}
        </span>
      )}
    </div>
  );
}

export default function AddOnChecklist({ data }: Props) {
  const scan = data?.[ADD_ON_FINDINGS_KEY];
  // No scan means the document predates this feature, was a scan we could not
  // read, or was not a motor policy. Showing "0 of 9" for any of those would be
  // a lie, so the card simply does not appear.
  if (!isScan(scan)) return null;

  const provenEmpty = scan.arithmetic?.headroom === 0;
  const found = scan.findings.filter((f) => f.state === "present");
  // Priced lines we did not put in the checklist, so the card never looks like
  // it is hiding something an agent can see in the PDF.
  const uncounted = scan.pricedLines.filter(
    (p) => !found.some((f) => f.evidence?.includes(p.name))
  );
  const unexplained = scan.reconciliation ? Math.abs(scan.reconciliation.unexplained) : 0;

  return (
    <Card className="border-slate-100 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Add-on cover on this policy</h3>
          <p className="mt-1 max-w-[52ch] text-sm text-slate-500">
            {provenEmpty
              ? "This policy has no add-on cover. The premium table proves it, line by line."
              : "Read from the policy schedule. Every tick shows the line it came from."}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {provenEmpty ? (
            <div className="text-2xl font-black leading-none text-slate-500">None</div>
          ) : (
            <div className="text-4xl font-black leading-none tabular-nums text-[#0D9488]">
              {scan.present}
              <span className="text-xl font-extrabold text-slate-500"> / {scan.applicable}</span>
            </div>
          )}
          <div className="mt-2 text-sm font-bold uppercase tracking-wider text-slate-500">
            Add-ons found
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        {scan.findings.map((f) => (
          <Row key={f.id} f={f} />
        ))}
      </div>

      {scan.arithmetic && (
        <div className="rounded-b-xl border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-sm text-slate-600">
            {/* The seal is only earned when the arithmetic actually closes. */}
            {(provenEmpty || (scan.reconciliation && unexplained < 1)) && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-bold text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                {provenEmpty ? "Proven, not guessed" : "Every rupee accounted for"}
              </span>
            )}
            <span>
              Own damage premium{" "}
              <b className="font-bold tabular-nums text-slate-800">
                {formatINRFull(scan.arithmetic.basicOd)}
              </b>{" "}
              basic,{" "}
              <b className="font-bold tabular-nums text-slate-800">
                {formatINRFull(scan.arithmetic.totalOd)}
              </b>{" "}
              total.
            </span>
            {scan.reconciliation && (
              <span>
                Add-ons{" "}
                <b className="font-bold tabular-nums text-slate-800">
                  {formatINRFull(scan.reconciliation.named)}
                </b>
                {scan.reconciliation.ncb !== 0 && (
                  <>
                    , less a no-claim bonus of{" "}
                    {/* Math.abs: formatINRFull renders a negative as "₹-1,240",
                        which reads as a typo rather than as a deduction. */}
                    <b className="font-bold tabular-nums text-slate-800">
                      {formatINRFull(Math.abs(scan.reconciliation.ncb))}
                    </b>
                  </>
                )}
                .{" "}
                {unexplained < 1 ? (
                  "Nothing unaccounted for."
                ) : (
                  <>
                    <b className="font-bold tabular-nums text-slate-800">
                      {formatINRFull(scan.reconciliation.unexplained)}
                    </b>{" "}
                    of add-on premium could not be named, so check the schedule.
                  </>
                )}
              </span>
            )}
            {provenEmpty && <span>Nothing was added on top, so there is no add-on cover to find.</span>}
          </div>
        </div>
      )}

      {uncounted.length > 0 && (
        <div className="flex gap-3 border-t border-amber-100 bg-amber-50 px-6 py-4 text-sm leading-relaxed text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            {uncounted.length === 1 ? "One line in" : `${uncounted.length} lines in`} the premium
            table {uncounted.length === 1 ? "is" : "are"} not in the checklist:{" "}
            {uncounted.map((p, i) => (
              <span key={p.name + i}>
                {i > 0 && ", "}
                <b className="font-semibold">{p.name}</b> at {formatINRFull(p.amount)}
              </span>
            ))}
            . A cover priced at or below zero was not bought at that price, so it is not counted.
          </span>
        </div>
      )}

      <CardContent className="border-t border-slate-100 py-3">
        <p className="text-sm text-slate-500">
          Checked against the {CLASS_LABEL[scan.vehicleClass]} list of {scan.applicable} add-ons on{" "}
          {scan.scannedAt}. Read from this document only, so cover added by a separate endorsement
          will not appear here.
        </p>
      </CardContent>
    </Card>
  );
}
