// Plain-text letters a person checks, copies into email and sends themselves. Nothing here is sent.
import { fmtDate, fmtMoney } from "./lib.js";
import { TODAY, LIVE } from "./data.js";

const BROKER = LIVE ? "IndSure Commercial" : "IndSure Commercial (demo broker)";
const inr = (n) => fmtMoney(Math.round(n));

// Why a declaration was held back or needs action, quoting the condition each finding comes from.
export function declarationNote({ decl, verdict, policyNo, insurer, insured }) {
  const L = [];
  L.push(`DECLARATION ${decl.no}: ${verdict.headline.toUpperCase()}`, "");
  L.push(`Open policy       ${insurer}, ${policyNo}`);
  L.push(`Insured           ${insured}`);
  L.push(`Goods             ${decl.interest || "not stated"}`);
  L.push(`Voyage            ${decl.originPlace || "?"} to ${decl.destinationPlace || "?"}${decl.routing?.length ? ` via ${decl.routing.join(", ")}` : ""}`);
  if (decl.vessel) L.push(`Vessel            ${decl.vessel}`);
  if (decl.sailingDate) L.push(`Sails             ${fmtDate(decl.sailingDate)}`);
  L.push(`Insured value     ${inr(verdict.insured)}`);
  L.push(`Cover             ${verdict.regime.label}: ${verdict.regime.clauses.join(", ")}`, "");
  if (verdict.status === "void") {
    L.push("WHY THIS HAS NOT BEEN DECLARED", "", "The policy says a declaration outside its terms is void from the start. Declaring this", "shipment would produce a certificate that does not respond, and the premium would buy nothing.", "");
  } else if (verdict.actions.length) {
    L.push("WHAT HAS TO HAPPEN BEFORE THE CARGO LEAVES", "");
    verdict.actions.forEach((a) => { L.push(`- ${a.label}`, `  Amount: ${inr(a.amt)}`, `  Deadline: ${a.deadline}`, `  ${a.why}`, ""); });
  } else L.push("POINTS THE CLIENT SHOULD KNOW", "");
  L.push("FINDINGS", "");
  verdict.gates.filter((g) => g.status !== "pass").forEach((g) => {
    L.push(`[${{ fail: "BLOCKS", warn: "NOTE", unknown: "NOT CHECKED" }[g.status]}] ${g.label}`);
    if (g.detail) L.push(`  ${g.detail}`);
    if (g.wording) L.push(`  Policy condition: ${g.wording}`);
    L.push("");
  });
  if (verdict.endsAt) L.push(`Cover on this shipment ends at ${verdict.endsAt}. The rest of the journey is not insured.`, "");
  L.push("---", `Prepared ${fmtDate(TODAY)} by ${BROKER}. ${LIVE ? "Draft: check against the policy schedule before sending." : "Demo document, fictional policy conditions."}`);
  return { title: `Declaration ${decl.no}: reason note`, filename: `declaration-${decl.no}-reason-note.txt`, body: L.join("\n"), note: "Forward to the client, and to the underwriter where terms must be agreed before shipment." };
}

// Notice of claim holding the carrier liable. Must go within three days of delivery when damage was hidden.
export function carrierNotice({ decl, insured, carrier, deliveredOn, discoveredOn, damage, lossInr }) {
  const body = `${fmtDate(TODAY)}

To
${carrier}

BY EMAIL AND BY REGISTERED POST WITH ACKNOWLEDGEMENT DUE

Dear Sirs

NOTICE OF CLAIM AND NOTICE HOLDING YOU LIABLE
Bill of lading ${decl.blNo || "(number)"}, vessel ${decl.vessel || "(vessel)"}
${decl.originPlace || "?"} to ${decl.destinationPlace || "?"}
Our reference ${decl.no}

We write for ${insured}, the owner of the consignment carried under the above contract of carriage.

The consignment, ${decl.packages || "the packages declared"}, was delivered on ${fmtDate(deliveredOn)}. On ${fmtDate(discoveredOn)}, on opening the packages, ${damage} was found. The damage was not apparent when delivery was taken.

We give you formal notice of claim and hold you, your servants, agents and sub-contractors liable for the loss and damage, with all costs that follow. Our early estimate of the loss is ${inr(lossInr)}, which we may revise after survey.

Please attend, or send a representative to, a joint survey of the consignment, and confirm by return. If we do not hear from you we will proceed with the survey and hold you liable for its findings.

All rights of our principals and their insurers, including rights of subrogation, are reserved. Nothing in this notice waives any term of the contract of carriage or any time bar, which we do not admit.

Please acknowledge receipt.

Yours faithfully

For and on behalf of ${insured}
${BROKER}

Copy: insurer
Copy: appointed surveyor`;
  return { title: "Notice of claim on the carrier", filename: `${decl.no}-carrier-notice.txt`, body, note: "Send by email and by registered post with acknowledgement due, and keep the AD card. It is part of the claim papers." };
}

// One email per insurer covering every short-paid or unpaid brokerage line.
export function brokerageQuery({ insurer, lines }) {
  const byCur = {};
  lines.forEach((l) => { byCur[l.currency] = (byCur[l.currency] || 0) + (l.expected - l.received); });
  const total = Object.entries(byCur).map(([c, v]) => fmtMoney(v, c)).join(" and ");
  const body = `${fmtDate(TODAY)}

To
${insurer}
Brokerage accounts

Dear Sirs

BROKERAGE QUERY: ${lines.length} POLIC${lines.length === 1 ? "Y" : "IES"}

On reconciling your brokerage payments against our records, the ${lines.length === 1 ? "policy below has" : `${lines.length} policies below have`} not been paid in full. The total outstanding is ${total}.

${lines.map((l, i) => `${i + 1}. ${l.policyNo} (${l.insured}, ${l.type})
   Net premium       ${fmtMoney(l.net, l.currency)} at ${l.pct}%
   Brokerage due     ${fmtMoney(l.expected, l.currency)}
   Received          ${fmtMoney(l.received, l.currency)}${l.refs ? ` (${l.refs})` : ""}
   Outstanding       ${fmtMoney(l.expected - l.received, l.currency)}`).join("\n\n")}

Please confirm the correction, or the basis on which the amounts were worked out. Where the rate you applied differs from the agreed rate, please send the schedule you are using so we can match our records to yours.

Yours faithfully

${BROKER}`;
  return { title: `Brokerage query: ${insurer}`, filename: `brokerage-query-${insurer.replace(/[^A-Za-z0-9]+/g, "-")}.txt`, body, note: "One email for all lines. Separate queries about one insurer tend to be answered separately, or not at all." };
}
