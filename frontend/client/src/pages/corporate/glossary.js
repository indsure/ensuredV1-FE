// Plain explanations of the words used in the portal. The (i) next to a label shows these, and the How to
// guide lists them. `also` holds other names people use, so searching an old word still finds it.
export const GLOSSARY = [
  { word: "Insured", also: "assured customer client proposer policyholder", text: "The person or company the policy protects. Policies also say assured, proposer or policyholder. In this portal, the insured is your customer." },
  { word: "CSC", also: "customer service coordinator cse", text: "Customer service coordinator: the person in your team who looks after this customer day to day. Renewal reminders go to them." },
  { word: "RM", also: "relationship manager", text: "Relationship manager: the person who brought in or owns the customer relationship. Optional." },
  { word: "Insurer", also: "insurance company underwriter", text: "The insurance company that issued the policy and pays claims." },
  { word: "Insurer branch", also: "issuing office branch office do", text: "The insurer's office that issued the policy. It is printed on the policy, often as Issuing Office." },
  { word: "Department", also: "line of business lob class", text: "The broad class of insurance, such as Fire, Marine or Health. Choosing it narrows the list of policy types." },
  { word: "Policy type", also: "product", text: "The exact product, such as Standard Fire and Special Perils. Reports can be grouped by it." },
  { word: "Customer type", also: "vertical corporate retail", text: "Corporate for companies and firms, Retail for individuals." },
  { word: "Policy number", also: "policy no", text: "The number the insurer gives the policy. Each renewal usually has a new one." },
  { word: "Plan name", text: "The insurer's name for the product, if the policy states one." },
  { word: "UIN", also: "unique identification number irdai", text: "Unique Identification Number: the code the regulator, IRDAI, gives an insurance product. Printed on most policies." },
  { word: "Proposal date", text: "The date the customer signed the proposal form asking for cover." },
  { word: "Policy issue date", also: "date of issue", text: "The date the insurer issued the policy. A policy being issued does not mean cover has started: see Risk start date." },
  { word: "Risk start date", also: "period from inception cover start", text: "The date cover begins. Claims before this date are not covered." },
  { word: "Risk end (expiry) date", also: "period to expiry", text: "The last day of cover. Renewal reminders count down to this date." },
  { word: "Business booked date", also: "booking date", text: "The date this business counts in your reports. It starts as the issue date. Change it only if it belongs to another date." },
  { word: "Currency", text: "The currency the policy is written in. Reports convert other currencies to rupees using the rate for that month." },
  { word: "Sum insured / limit", also: "si tsi sum assured limit of liability aoa aoy any one accident any one year", text: "The most the insurer will pay. Liability policies call it a limit, often AOA (any one accident) and AOY (any one year)." },
  { word: "Premium rate (%)", also: "rate", text: "The rate the premium was worked out at, if the policy states it." },
  { word: "Gross premium", also: "basic premium before gst taxable value", text: "The premium before GST. Brokerage is normally worked out on this. Policies may print it as Net Premium or just Premium, so go by the figure: it is the amount before GST." },
  { word: "GST (%)", text: "The GST rate, usually 18%. CGST and SGST together, or IGST." },
  { word: "GST amount", also: "cgst sgst igst tax", text: "The GST charged in rupees. Where the policy shows CGST and SGST, this is the two added together." },
  { word: "Stamp duty", text: "A small government charge on the policy. Some policies add it into the total, some do not. When instalments are used it usually falls on the first one." },
  { word: "Net premium", also: "total premium final amount payable", text: "The final amount the customer pays: gross premium + GST, plus stamp duty if the policy's total includes it." },
  { word: "Policy excess", also: "deductible franchise", text: "The part of each claim the customer bears before the insurer pays. Also called a deductible." },
  { word: "Location / Jurisdiction", also: "risk location situation premises territory territorial limits", text: "Where the cover applies. An address for fire policies. An area for liability and marine, such as Worldwide. The review screen tells you which word the policy uses." },
  { word: "Our share (%)", also: "share", text: "If the business is shared with other intermediaries, the part you handle." },
  { word: "Co-broker share (%)", also: "co broker", text: "If another broker shares this business, the part they handle." },
  { word: "Is renewable", text: "Whether this policy comes up for renewal. A one-off, such as a single voyage, does not. A person always answers this; it is never read from the policy." },
  { word: "Brokerage (%)", also: "commission", text: "Your earning as a percentage of the premium, on gross by default. Tick Brokerage on net premium for a policy charged on net." },
  { word: "Brokerage rates", also: "brokerage presets preset", text: "Your saved rate per insurer and policy type, filled in for you on new policies. Each policy keeps the rate it was made with, even if the rate changes later." },
  { word: "Endorsement", also: "amendment change midterm", text: "The insurer's written change to a policy during its period, such as a higher sum insured. The old values are kept." },
  { word: "Renewal", text: "A new policy period that continues an expiring one. It is linked to the year before, which stays unchanged." },
  { word: "Policy year", also: "term", text: "One period of a policy, usually twelve months. A renewal adds another policy year to the same policy." },
  { word: "Draft", also: "bulk upload approve pending", text: "A policy waiting for someone to check it. Drafts do not count in reports. Open one and confirm it when ready." },
  { word: "Confirmed", text: "A record someone has checked. It counts in reports, and after this its values change only through an endorsement." },
  { word: "Debit note", text: "The document asking the customer to pay the premium. It is kept for reference and changes no figures." },
  { word: "Instalment", also: "emi part payment installment", text: "One part of a premium paid in parts. Each has its own due date, so the portal can show what is overdue." },
  { word: "Receipts", also: "payment received", text: "Money received from the customer. Being issued does not mean being paid, so payments are tracked separately." },
  { word: "UTR", also: "unique transaction reference neft rtgs", text: "Unique Transaction Reference: the number your bank gives a NEFT or RTGS transfer. Use it to trace the payment." },
  { word: "Remitted to insurer on", also: "remittance", text: "The date the premium was passed on to the insurer." },
  { word: "Control no.", also: "control number", text: "The portal's own reference for a policy. It stays the same across renewals, even when the policy number changes." },
  { word: "Open policy", also: "open cover marine cargo", text: "A marine cargo policy with one large sum insured. Each shipment is declared and uses up part of it." },
  { word: "Declaration", also: "cargo shipment", text: "Your notice to the insurer of one shipment under an open policy. It reduces the sum insured left." },
  { word: "Sum insured left", also: "balanced si balance", text: "On an open policy, the sum insured minus all declarations so far." },
  { word: "GRT", also: "gross registered tonnage tonnage", text: "Gross registered tonnage: the internal size of a vessel. Printed on vessel papers and policies." },
  { word: "IMO number", also: "imo", text: "The ship's permanent identity number. It stays the same even if the ship is renamed." },
  { word: "Date used", also: "date basis basis date", text: "Which date a report goes by, such as booked date or risk start. The same policy can fall in different months depending on this." },
  { word: "Which date to use", also: "date basis", text: "Which date a report goes by, such as booked date or risk start. The same policy can fall in different months depending on this." },
  { word: "Locked reports", also: "finalized finalize snapshot", text: "A copy of a report saved exactly as it stood, so a month-end figure stays the same even if records change later." },
  { word: "Exchange rates", also: "fx foreign currency usd", text: "The rupee rate for each foreign currency for each month. Reports use it to show foreign policies in rupees." },
  { word: "Lists and team", also: "masters master", text: "The lists the whole portal uses: insurers and their branches, policy types, and your team." },
  { word: "Record", also: "complete incomplete", text: "Whether this record has everything it needs. Draft means not yet checked; Complete means confirmed with nothing missing." },
  { word: "Cover", also: "active expired scheduled", text: "Whether the policy protects the customer today, worked out from the risk dates. Scheduled, Active or Expired." },
  { word: "Payment", also: "paid unpaid part paid", text: "Whether the money has come in: Unpaid, Part paid or Paid." },
  { word: "Renewal outcome", also: "open renewed lost", text: "What happened at renewal: Open means it is still to come. Then Renewed or Lost." },
  { word: "Other details", also: "extensions special conditions exclusions warranties clauses", text: "What the policy says that has no box of its own, such as extensions, sub limits and special conditions." },
];

const norm = (s) => String(s || "").toLowerCase().replace(/\s*\*$/, "").trim();
const INDEX = new Map(GLOSSARY.map((g) => [norm(g.word), g]));
// Other names shown on screens that mean the same thing.
const SAME = { "insured (customer)": "insured", "insured name": "insured", "insured": "insured", "insured name (customer)": "insured", "brokerage %": "brokerage (%)", "brokerage": "brokerage (%)", "sum insured": "sum insured / limit", "policy no.": "policy number", "gst": "gst amount", "tax %": "gst (%)", "tax": "gst amount", "branch": "insurer branch", "renewable": "is renewable", "reference / utr": "utr", "cheque / dd / transaction no. or utr": "utr", "remitted to insurer": "remitted to insurer on", "debit notes": "debit note", "instalment schedule": "instalment", "endorsements": "endorsement", "policy year": "policy year", "policy years": "policy year", "customer type": "customer type", "open policy balance": "open policy", "declarations": "declaration", "imo": "imo number", "gt": "grt", "gross tonnage": "grt", "outcome": "renewal outcome", "date used": "date used", "finalize": "locked reports", "lock this report": "locked reports" };
export function tipFor(label) {
  if (typeof label !== "string") return null;
  const k = norm(label);
  const hit = INDEX.get(k) || INDEX.get(SAME[k]);
  return hit ? hit.text : null;
}
