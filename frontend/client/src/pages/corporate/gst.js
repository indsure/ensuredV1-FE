// GST the broker collects (Rec) or bears (Pay) on a policy. Two separate questions, each answered or left
// alone: the GST on the premium and the GST on the brokerage. Kept on the policy year as a side ("rec", "pay"
// or "") and an amount in the policy's currency. These are the broker's own accounts: they never change gross,
// GST or net premium, the brokerage due, or the IRDAI register (which works its brokerage GST out from the %).
import { isNum, r2, brokerageOf, gstApplies } from "./lib.js";

export const GST_KINDS = [
  { kind: "premium", label: "GST on premium", side: "premGstSide", amt: "premGstAmt" },
  { kind: "brokerage", label: "GST on brokerage", side: "brokGstSide", amt: "brokGstAmt" },
];
export const GST_KEYS = GST_KINDS.flatMap((k) => [k.side, k.amt]);
const SIDES = new Set(["rec", "pay"]);
export const GST_SIDE_WORDS = { rec: "GST received", pay: "GST paid" };

/** Only the GST answers of a record, tidied for saving. An unticked pair is saved as not stated. */
export function cleanGst(vals = {}) {
  const out = {};
  for (const k of GST_KINDS) {
    const on = SIDES.has(vals[k.side]);
    out[k.side] = on ? vals[k.side] : "";
    out[k.amt] = on && isNum(vals[k.amt]) ? r2(+vals[k.amt]) : "";
  }
  return out;
}

/** { premGstAmt: "reason" } for a ticked box without a usable amount. */
export function gstErrors(vals = {}) {
  const out = {};
  for (const k of GST_KINDS) {
    if (!SIDES.has(vals[k.side])) continue;
    const v = vals[k.amt];
    if (v === "" || v == null) out[k.amt] = `${k.label}: enter how much`;
    else if (!isNum(v)) out[k.amt] = `${k.label}: enter a number`;
    else if (+v <= 0) out[k.amt] = `${k.label}: enter an amount above 0, or untick it`;
  }
  return out;
}

/** What the policy's own figures suggest, offered as a link and never filled in on its own. */
export function gstSuggestion(kind, vals = {}) {
  if (kind === "premium") return isNum(vals.gst) && +vals.gst > 0 ? r2(+vals.gst) : null;
  if (!gstApplies(vals)) return null;
  const pct = isNum(vals.brokerageGstPct) ? +vals.brokerageGstPct : 18;
  const b = brokerageOf(vals);
  return b > 0 && pct > 0 ? r2((b * pct) / 100) : null;
}

const amountOn = (v, k, side) => (v && v[k.side] === side && isNum(v[k.amt]) ? +v[k.amt] : 0);
const ROW_KEYS = { premium: { rec: "premGstRec", pay: "premGstPay" }, brokerage: { rec: "brokGstRec", pay: "brokGstPay" } };
export const GST_COLUMNS = [["premGstRec", "Premium GST received"], ["premGstPay", "Premium GST paid"], ["brokGstRec", "Brokerage GST received"], ["brokGstPay", "Brokerage GST paid"]];

/** The four report figures of one policy year, and the same in INR when the month has a rate. */
export function gstRow(v, toInr = () => null) {
  const out = {};
  for (const k of GST_KINDS) for (const side of ["rec", "pay"]) { const key = ROW_KEYS[k.kind][side]; out[key] = amountOn(v, k, side); out[`${key}Inr`] = toInr(out[key]); }
  return out;
}

/** Totals for a list of rows: per currency and in INR. Rows with no exchange rate are counted, not guessed. */
export function gstTotals(rows) {
  const t = { native: {}, inr: Object.fromEntries(GST_COLUMNS.map(([k]) => [k, 0])), noRate: 0, any: false };
  for (const r of rows) {
    if (!GST_COLUMNS.some(([k]) => r[k])) continue;
    t.any = true;
    const n = (t.native[r.currency] ||= Object.fromEntries(GST_COLUMNS.map(([k]) => [k, 0])));
    const noRate = GST_COLUMNS.some(([k]) => r[k] && r[`${k}Inr`] == null);
    if (noRate) t.noRate++;
    for (const [k] of GST_COLUMNS) { n[k] = r2(n[k] + (r[k] || 0)); if (!noRate) t.inr[k] = r2(t.inr[k] + (r[`${k}Inr`] || 0)); }
  }
  return t;
}
