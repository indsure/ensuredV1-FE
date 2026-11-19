// Checks that test the values against each other before anything counts as right. A value can be read
// clearly and still be the wrong figure (a premium taken as the sum insured, half the GST). Each failed check
// names the fields it involves and says why in plain words. Pure functions only.
const num = (v) => (v === "" || v == null || !Number.isFinite(+v) ? null : +v);
const day = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) ? Date.parse(iso + "T00:00:00Z") / 864e5 : null);
const money = (v) => Math.round(v).toLocaleString("en-IN");
const STD_GST = [0, 5, 12, 18, 28];

// vals: the record's values (as on the review screen). info: what the reader noticed (wordsTotal, ...).
// Returns { fieldKey: "reason" } for every field a failed check touches.
export function crossChecks(vals = {}, info = {}) {
  const out = {};
  const flag = (keys, why) => { for (const k of keys) if (!out[k]) out[k] = why; };
  const g = num(vals.grossPremium), t = num(vals.gst), n = num(vals.netPremium), st = num(vals.stampDuty) || 0, pct = num(vals.gstPct);
  const si = num(vals.sumInsured);
  const inr = !vals.currency || vals.currency === "INR";
  // 1. Gross premium + GST (+ stamp duty when the total includes it) = net premium.
  if (g != null && t != null && n != null) {
    const a = g + t, b = g + t + st;
    if (Math.abs(a - n) > 1.01 && Math.abs(b - n) > 1.01) flag(["grossPremium", "gst", "netPremium"], `Gross ${money(g)} + GST ${money(t)} = ${money(a)}, but net premium is ${money(n)}. One of the three is misread.`);
  }
  if (g != null && n != null && g > n) flag(["grossPremium", "netPremium"], "Gross premium is larger than net premium. Gross is before GST, net is the total paid.");
  // 2. GST should be the GST rate of the gross premium.
  if (inr && g != null && t != null && g > 0) {
    const r = (100 * t) / g;
    // On a standard rate the figures agree with each other, so it is the printed % that is off.
    if (pct != null && Math.abs(r - pct) > 0.6) flag(STD_GST.some((x) => Math.abs(r - x) <= 0.06) ? ["gstPct"] : ["gst", "gstPct"], `GST ${money(t)} is ${r.toFixed(1)}% of the gross premium, not ${pct}%.`);
    else if (pct == null && t > 0 && !STD_GST.some((x) => Math.abs(r - x) <= 0.6)) flag(["gst"], `GST ${money(t)} is ${r.toFixed(1)}% of the gross premium, which is not a GST rate.`);
  }
  if (pct != null && !STD_GST.includes(pct)) flag(["gstPct"], `${pct}% is not a GST rate (0, 5, 12, 18 or 28).`);
  // (A foreign-currency limit with an INR premium and GST is normal, for example overseas travel, so no check on that.)
  // 3. The figure in words is the total paid.
  const w = num(info.wordsTotal);
  if (w != null && n != null && Math.abs(w - n) > 1.01 && !(g != null && Math.abs(w - g) <= 1.01)) flag(["netPremium"], `The amount in words on the policy is ${money(w)}, not ${money(n)}.`);
  // 4. Stamp duty is a few rupees, never a share of the premium.
  if (st > 0 && n != null && n > 0 && st > Math.max(1000, 0.05 * n)) flag(["stampDuty"], `Stamp duty of ${money(st)} is too large for a premium of ${money(n)}. Check it is not another figure.`);
  // 5. The sum insured is never a premium figure.
  if (si != null && si > 0) {
    for (const [k, v] of [["netPremium", n], ["grossPremium", g], ["gst", t]]) if (v != null && Math.abs(si - v) < 0.5) { flag(["sumInsured"], `The sum insured equals the ${k === "gst" ? "GST" : k === "netPremium" ? "net premium" : "gross premium"} (${money(v)}). It is probably a premium figure.`); break; }
    if (!out.sumInsured && inr && n != null && n > 0 && si < n) flag(["sumInsured"], `The sum insured (${money(si)}) is smaller than the premium (${money(n)}). Check it.`);
  }
  // 6. Dates: start before end, a sensible length, issue date near the start.
  const s = day(vals.riskStart), e = day(vals.riskEnd), iss = day(vals.issueDate);
  if (s != null && e != null) {
    if (e <= s) flag(["riskStart", "riskEnd"], "The risk end date is not after the start date.");
    else if (e - s > 366 * 5 + 2) flag(["riskEnd"], `The policy runs ${((e - s) / 365.25).toFixed(1)} years. Check the end date.`);
  }
  if (iss != null && s != null && (iss > s + 120 || iss < s - 400)) flag(["issueDate"], `The issue date is ${iss > s ? Math.round(iss - s) + " days after" : Math.round(s - iss) + " days before"} the risk start. Check it.`);
  return out;
}
