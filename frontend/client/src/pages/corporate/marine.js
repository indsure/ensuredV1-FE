// Marine cargo declaration checks for an open policy. Deterministic: arithmetic, dates and string
// matching only, so the same declaration always gets the same verdict and every line can be explained.
// The engine knows nothing about any insurer: each open policy carries its own cover profile (data).
// An unknown fact is never read as a pass.

const norm = (s) => String(s ?? "").toLowerCase().trim();
const inr = (n) => (Number.isFinite(n) ? "₹" + Math.round(n).toLocaleString("en-IN") : "--");

// A fictional cover profile, shaped like a real cargo open policy. Every condition here is demo wording.
export function demoCargoProfile(sumInsured) {
  return {
    interestLabel: "Agricultural produce and processed foods",
    interestMatches: ["rice", "onion", "grape", "sesame", "spice", "pulse", "lentil", "food", "fruit", "vegetable", "seed", "flour", "tea", "coffee", "agro"],
    initialSumInsuredInr: sumInsured,
    perSendingLimitInr: 35000000,
    excess: { pct: 0.5, minimumInr: 25000 },
    sanctioned: ["afghanistan", "cuba", "iran", "iraq", "north korea", "somalia", "sudan", "syria", "yemen"],
    excludedForms: ["bulk", "break-bulk", "break bulk", "road tanker", "barge"],
    odc: { l: 12, w: 2.5, h: 3.1 },
    owcMT: 55,
    containerWarranty: true,
    regimes: {
      allRisk: { id: "allRisk", label: "All risks", because: "New goods on the standard terms of the policy.", clauses: ["Institute Cargo Clauses (A)", "Institute War Clauses (Cargo)", "Institute Strikes Clauses (Cargo)"], valuation: { kind: "invoice_plus", upliftPct: 10, duty: true } },
      tailEnd: { id: "tailEnd", label: "Tail-end import (inland leg only)", because: "The supplier insured the overseas leg, so only the inland leg in India attaches here, on narrower terms.", clauses: ["Inland Transit Clause (B)", "Strikes, riots and civil commotion", "Non-delivery of the carrying conveyance"], valuation: { kind: "invoice_plus", upliftPct: 10, duty: true } },
      used: { id: "used", label: "Returned, used or scrap goods", because: "Returned, used, second-hand, scrap or rejected goods are covered on narrower terms and valued at depreciated market value.", clauses: ["Institute Cargo Clauses (B)", "Institute War Clauses (Cargo)", "Institute Strikes Clauses (Cargo)"], valuation: { kind: "depreciated" } },
    },
    warZones: [
      { id: "notified", label: "Gulf of Aden and Southern Red Sea notified areas", matches: ["gulf of aden", "aden", "red sea", "suez", "bab el mandeb", "djibouti"], buyBackPct: 0.1, deadline: "before the voyage starts", wording: "War and strikes cover in the notified areas returns only if an extra 0.10% of the insured value is paid before the voyage starts." },
      { id: "gcc", label: "Gulf Cooperation Council ports", matches: ["bahrain", "kuwait", "oman", "qatar", "saudi", "united arab emirates", "uae", "jebel ali", "dubai", "abu dhabi"], buyBackPct: 0.025, deadline: "before transit starts", wording: "War and strikes cover to or from GCC ports returns only if an extra 0.025% of the shipment value is paid before transit starts." },
      { id: "levant", label: "Israel, Palestine and Lebanon", matches: ["israel", "palestine", "lebanon"], buyBackPct: null, wording: "War, strikes, riots and civil commotion are excluded for shipments to, from or through these places. There is no buy-back." },
      { id: "blacksea", label: "Ukraine, Black Sea and Sea of Azov", matches: ["ukraine", "black sea", "azov", "novorossiysk", "russia", "belarus"], buyBackPct: null, wording: "War and strikes cover is excluded for transits to, from or within this area. There is no buy-back." },
    ],
    terminations: [
      { id: "nepal_bd", countries: ["nepal", "bangladesh"], at: "the transhipment point at the Indian border", wording: "For Nepal and Bangladesh, cover ends when the cargo reaches the transhipment point at the Indian border." },
      { id: "africa", countries: ["myanmar", "nigeria", "kenya", "tanzania", "south africa", "ghana", "egypt", "morocco", "ethiopia", "africa"], at: "the port or airport of discharge, with no inland leg", wording: "For Myanmar and African countries, cover ends at the port or airport of discharge unless agreed otherwise." },
    ],
    wording: {
      interest: "The policy insures only the interest named in the schedule.",
      sanctions: "Shipments to or through sanctioned countries, and countries the Government of India prohibits, are excluded.",
      forms: "Bulk, break-bulk, road tanker and barge movements are outside the policy.",
      odc: "Any item, with its packing, longer than 12 m, wider than 2.5 m or taller than 3.1 m is excluded.",
      owc: "Any item, with its packing, weighing 55 tonnes or more is excluded.",
      container: "Cargo must be containerised for the sea voyage.",
      onDeck: "Non-containerised cargo carried on deck under an on-deck bill of lading is covered only on Institute Cargo Clauses (C).",
      sending: "No more than the per sending limit may travel on one conveyance.",
      balance: "No cover attaches without premium. The sum insured must cover every declaration.",
      voidRule: "A declaration that does not fall within the policy terms is void from the start.",
    },
  };
}

const placesOf = (s) => [s.originCountry, s.originPlace, s.destinationCountry, s.destinationPlace, ...(s.routing || [])].map(norm).filter(Boolean);
const firstMatch = (hay, needles) => { for (const n of needles) { const nn = norm(n); if (nn && hay.some((h) => h.includes(nn))) return n; } return null; };

export function resolveRegime(s, p) {
  if (s.condition === "used") return p.regimes.used;
  if (s.supplierInsuredOverseas) return p.regimes.tailEnd;
  return p.regimes.allRisk;
}

export function valuation(s, regime) {
  const base = +s.inrValue || 0;
  if (regime.valuation.kind === "depreciated") return { lines: [{ label: "Depreciated market value", note: "returned or used goods are not valued at invoice plus 10%", amt: base }], total: base };
  const duty = regime.valuation.duty ? +s.dutyInr || 0 : 0;
  const uplift = Math.round((base + duty) * regime.valuation.upliftPct / 100);
  return {
    lines: [
      { label: "Invoice value", note: s.currency && s.currency !== "INR" && s.fxRate ? `${s.currency} ${(+s.invoiceValue || 0).toLocaleString("en-US")} at ₹${s.fxRate}` : "", amt: base },
      { label: "Duty at actuals", note: s.dutyInr === "" || s.dutyInr == null ? "not supplied, taken as nil" : "", amt: duty },
      { label: `Plus ${regime.valuation.upliftPct}%`, note: "", amt: uplift },
    ],
    total: base + duty + uplift,
  };
}

// ctx: { consumedInr, sameVessel: [{ no, insured }] }
export function evaluate(s, p, ctx = {}) {
  const W = p.wording;
  const regime = resolveRegime(s, p);
  const { lines, total: insured } = valuation(s, regime);
  const excess = Math.max(Math.round(insured * p.excess.pct / 100), p.excess.minimumInr);
  const gates = [];
  const g = (id, status, label, detail = "", wording = "") => gates.push({ id, status, label, detail, wording });
  const pl = placesOf(s);

  if (!norm(s.interest)) g("interest", "unknown", "Goods not described", "Describe the goods to check them against the insured interest.");
  else if (firstMatch([norm(s.interest)], p.interestMatches)) g("interest", "pass", "Goods match the insured interest", s.interest);
  else g("interest", "fail", "Goods are outside the insured interest", `The policy insures ${p.interestLabel.toLowerCase()}. This declaration is for ${s.interest}.`, W.interest);

  const sanc = firstMatch(pl, p.sanctioned);
  if (sanc) g("sanctions", "fail", "Sanctioned country on the route", `${sanc[0].toUpperCase() + sanc.slice(1)} appears in the origin, destination or route.`, W.sanctions);
  else g("sanctions", "pass", "No sanctioned country on the route");

  const form = firstMatch([norm(`${s.interest} ${s.packageType}`)], p.excludedForms);
  if (form) g("forms", "fail", "Excluded cargo form", `${form} movements are outside this policy.`, W.forms);
  else g("forms", "pass", "Cargo form allowed", "Not bulk, break-bulk, tanker or barge");

  const seaLeg = s.mode === "Sea" || s.mode === "Multimodal";
  if (!p.containerWarranty || !seaLeg) g("container", "pass", "Containerisation warranty not engaged", "No sea leg");
  else if (s.containerised === "Not known" || !s.containerised) g("container", "unknown", "Containerisation not confirmed", "Nothing confirms the cargo is containerised for the sea leg.");
  else if (s.containerised === "No") g("container", "fail", "Containerisation warranty broken", "The cargo is not containerised for the sea leg.", W.container);
  else g("container", "pass", "Containerised for the sea leg");

  const dims = [["length", +s.lengthM, p.odc.l], ["width", +s.widthM, p.odc.w], ["height", +s.heightM, p.odc.h]].filter(([, v]) => v > 0);
  const big = dims.find(([, v, lim]) => v > lim);
  if (big) g("odc", "fail", "Over-dimensional cargo", `A package is ${big[1]} m in ${big[0]}, over the ${big[2]} m limit.`, W.odc);
  else if (dims.length === 3) g("odc", "pass", "Within size limits");
  else g("odc", "unknown", "Package size not given", "Without length, width and height the size exclusion cannot be checked.");

  if (s.heaviestMT === "" || s.heaviestMT == null) g("owc", "unknown", "Heaviest item not given", "Without the heaviest item's weight the weight exclusion cannot be checked.");
  else if (+s.heaviestMT >= p.owcMT) g("owc", "fail", "Over-weight cargo", `Heaviest item ${s.heaviestMT} t, limit below ${p.owcMT} t.`, W.owc);
  else g("owc", "pass", "Within the weight limit", `${s.heaviestMT} t`);

  if (s.stowage === "On deck" && s.containerised !== "Yes") g("ondeck", "warn", "Carried on deck", "On-deck, non-containerised cargo drops to named perils only.", W.onDeck);

  if (insured > p.perSendingLimitInr) g("sending", "fail", "Over the per sending limit", `${inr(insured)} on one conveyance against ${inr(p.perSendingLimitInr)}. Over by ${inr(insured - p.perSendingLimitInr)}.`, W.sending);
  else g("sending", "pass", "Within the per sending limit", `${inr(insured)} of ${inr(p.perSendingLimitInr)}`);

  const available = p.initialSumInsuredInr - (ctx.consumedInr || 0);
  if (insured > available) g("balance", "fail", "Sum insured would run out", `${inr(available)} is left and this needs ${inr(insured)}. The shortfall would be uninsured.`, W.balance);
  else g("balance", "pass", "Enough sum insured left", `${inr(available)} left, ${inr(available - insured)} after this`);

  const actions = [];
  for (const z of p.warZones) {
    const hit = firstMatch(pl, z.matches);
    if (!hit) continue;
    if (z.buyBackPct == null) { g(`war_${z.id}`, "warn", `War and strikes excluded: ${z.label}`, `${hit} is in this area and there is no buy-back. The client carries this risk.`, z.wording); continue; }
    const amt = Math.round(insured * z.buyBackPct / 100);
    if (s.warPaid === "Yes") g(`war_${z.id}`, "pass", `War and strikes bought back: ${z.label}`, `${inr(amt)} recorded as paid ${z.deadline}.`, z.wording);
    else {
      g(`war_${z.id}`, "fail", `War and strikes not covered: ${z.label}`, s.warPaid === "No" ? `The ${z.buyBackPct}% buy-back has not been paid.` : `Nothing shows the ${z.buyBackPct}% buy-back was paid, so it is not assumed.`, z.wording);
      actions.push({ label: `Pay the war and strikes buy-back (${z.label})`, amt, deadline: `${z.deadline}${s.sailingDate ? `, sails ${s.sailingDate}` : ""}`, why: `${z.buyBackPct}% of ${inr(insured)}. It cannot be bought once the conveyance leaves.` });
    }
  }
  if (seaLeg && !(s.routing || []).length) g("route", "unknown", "Route not stated", "Whether the voyage crosses a notified area cannot be told. Confirm the route before treating war and strikes as covered.");

  let endsAt = "";
  for (const t of p.terminations) {
    const hit = firstMatch(pl, t.countries);
    if (!hit) continue;
    endsAt = t.at;
    g(`end_${t.id}`, "warn", "Cover stops short of the destination", `For ${hit}, cover ends at ${t.at}. The rest of the journey is uninsured.`, t.wording);
  }

  let accumulation = null;
  const vessel = norm(s.vessel);
  if (vessel) {
    const others = (ctx.sameVessel || []).filter((o) => norm(o.vessel) === vessel);
    const total = others.reduce((a, o) => a + o.insured, 0) + insured;
    accumulation = { vessel: s.vessel, total, limit: p.perSendingLimitInr, others: others.map((o) => o.no) };
    if (others.length) {
      if (total > p.perSendingLimitInr) g("accumulation", "fail", "Too much on one vessel", `${inr(total)} now sits on ${s.vessel} with ${others.map((o) => o.no).join(", ")}, against ${inr(p.perSendingLimitInr)}.`, W.sending);
      else if (total > p.perSendingLimitInr / 2) g("accumulation", "warn", "Value building up on one vessel", `${inr(total)} of ${inr(p.perSendingLimitInr)} on ${s.vessel}, with ${others.map((o) => o.no).join(", ")}.`);
      else g("accumulation", "pass", "Vessel accumulation within limit", `${inr(total)} of ${inr(p.perSendingLimitInr)} on ${s.vessel}`);
    }
  }

  const failed = gates.filter((x) => x.status === "fail");
  const voids = failed.filter((x) => !x.id.startsWith("war_"));
  let status, headline;
  if (voids.length) { status = "void"; headline = "Would be void: do not declare as it stands"; }
  else if (failed.length || actions.length) { status = "action"; headline = "Action needed before the cargo leaves"; }
  else if (endsAt || regime.id !== "allRisk" || gates.some((x) => x.status === "warn" || x.status === "unknown")) { status = "changed"; headline = "Can be declared, but check the cover"; }
  else { status = "cleared"; headline = "Clear to declare"; }
  return { status, headline, regime, insured, lines, excess, gates, actions, endsAt, accumulation };
}

export const VERDICT_TONE = { cleared: "good", changed: "info", action: "warn", void: "bad" };
export const VERDICT_LABEL = { cleared: "Clear to declare", changed: "Cover changed", action: "Action needed", void: "Would be void" };
