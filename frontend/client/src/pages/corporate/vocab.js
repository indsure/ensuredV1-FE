// The different words insurers print for the same thing. Each field lists labels seen on Indian and
// London-market schedules. To teach the reader a new wording, add one phrase here; no rule needs changing.
// Spaces in a phrase match any spacing (so "policy holder" also finds "Policyholder"), and an apostrophe is
// optional ("insured's name" also finds "Insureds Name").
export const VOCAB = {
  insured: [
    "name of the insured", "name of insured", "insured name", "insured's name", "insured",
    "name of the assured", "name of assured", "assured name", "assured's name", "assured",
    "name of the proposer", "name of proposer", "proposer name", "proposer's name", "proposer",
    "name of the policyholder", "name of policyholder", "policyholder name", "policyholder's name", "policyholder", "master policyholder",
    "customer name", "name of the customer", "client name", "name of the client", "original insured", "named insured",
    "name of the employer", "employer name", "name of the principal", "name of principal", "name of the member", "member name",
    "name of the company", "company name", "name of the firm", "legal name of business", "legal name", "trade name",
  ],
  policyNo: [
    "policy no", "policy number", "policy num", "policy reference", "master policy no", "master policy number",
    "certificate no", "certificate number", "certificate reference", "certificate ref", "certificate of entry no",
    "cover note no", "cover note number", "reference no", "reference number", "entry no", "contract no", "contract number",
    "UMR", "unique market reference",
  ],
  uin: ["UIN", "UIN no", "product UIN", "IRDAI UIN"],
  planName: [
    "product name", "plan name", "name of the product", "name of product", "policy name", "name of the policy",
    "scheme name", "type of insurance", "class of insurance",
  ],
  proposalDate: ["proposal date", "date of proposal", "proposal signed on", "proposal received on", "proposal form dated"],
  issueDate: [
    "date of issue", "date of issuance", "issue date", "issuance date", "issued on", "date issued", "policy issued on",
    "policy issue date", "date of policy",
  ],
  riskStart: [
    "start date", "policy start date", "risk start date", "risk start", "risk inception", "inception date", "date of inception",
    "commencement date", "date of commencement", "risk commencement", "effective from", "effective date", "valid from",
    "cover from", "period from", "attachment date", "w.e.f", "with effect from",
  ],
  riskEnd: [
    "end date", "policy end date", "risk end date", "risk end", "expiry date", "date of expiry", "expiry", "expires on",
    "valid till", "valid upto", "valid up to", "valid to", "cover till", "cover to", "period to", "termination date", "date of termination",
  ],
  sumInsured: [
    "sum insured", "total sum insured", "TSI", "SI", "sum assured", "insured value", "value insured", "amount insured",
    "total amount insured", "insured declared value", "IDV", "agreed value", "capital sum insured", "CSI", "total CSI",
    "limit of liability", "limits of liability", "limit of indemnity", "indemnity limit", "aggregate limit", "total limit",
    "any one accident", "AOA", "cover amount", "coverage amount",
  ],
  netPremium: [
    "net premium", "basic premium", "base premium", "own premium", "taxable value", "taxable premium", "taxable amount",
    "premium before tax", "premium before gst", "premium excluding tax", "premium excluding gst", "premium excl tax",
  ],
  grossPremium: [
    "gross premium", "total premium", "total premium payable", "premium payable", "total amount payable", "total payable",
    "amount payable", "final premium", "total amount", "total premium including gst", "premium including taxes",
    "premium inclusive of taxes", "total invoice value",
  ],
  gst: ["GST", "IGST", "GST amount", "IGST amount", "goods and services tax", "service tax", "total tax", "tax amount"],
  stampDuty: ["stamp duty", "stamp fee", "stamp fees", "stamp charges"],
  excess: [
    "excess", "deductible", "deductibles", "compulsory deductible", "compulsory excess", "policy excess", "standard excess",
    "retention", "self retention", "franchise",
  ],
  location: [
    "risk location", "location of risk", "insured location", "risk address", "address of risk", "situation of risk", "risk situation",
    "situation", "premises", "insured premises", "address of the premises", "premises address", "location address", "place of risk", "situated at",
  ],
  premiumRate: ["rate", "premium rate", "rate per mille", "rate per cent"],
  // The insurer's office that issued or services the policy.
  branchName: ["office name", "branch name", "issuing office name", "branch office", "servicing branch", "issued at", "area code", "branch"],
  branchCode: ["office code", "branch code", "issuing office code"],
  branchAddress: ["office address", "issuing office address", "issuing office details", "issuing office", "policy servicing office", "servicing office", "policy issuing office"],
};

// Cities insurers' offices print, and Mumbai localities that mean Mumbai ("Vile Parle D.O - I").
export const CITIES = [
  "Navi Mumbai", "Mumbai", "Thane", "Pune", "Nashik", "Nagpur", "Aurangabad", "Kolhapur", "New Delhi", "Delhi", "Gurugram", "Gurgaon",
  "Noida", "Ghaziabad", "Faridabad", "Chennai", "Coimbatore", "Madurai", "Bengaluru", "Bangalore", "Mysuru", "Mangaluru", "Hyderabad",
  "Secunderabad", "Visakhapatnam", "Vijayawada", "Kolkata", "Howrah", "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhidham", "Vapi",
  "Jaipur", "Udaipur", "Lucknow", "Kanpur", "Indore", "Bhopal", "Chandigarh", "Ludhiana", "Amritsar", "Kochi", "Cochin",
  "Thiruvananthapuram", "Kozhikode", "Panaji", "Goa", "Bhubaneswar", "Patna", "Ranchi", "Raipur", "Guwahati", "Dehradun", "Jamshedpur",
];
export const MUMBAI_AREAS = [
  "vile parle", "santacruz", "andheri", "goregaon", "bandra", "bkc", "fort", "nariman point", "prabhadevi", "lower parel", "parel",
  "worli", "malad", "borivali", "kandivali", "dadar", "tardeo", "sakinaka", "powai", "chembur", "ghatkopar", "mulund", "vikhroli",
  "kurla", "colaba", "churchgate", "byculla", "jogeshwari", "juhu", "khar", "mahim", "matunga", "sion", "wadala", "bhandup",
];

// One case-insensitive pattern that matches any phrase of a field, as whole words.
export function phraseRe(phrases) {
  const parts = phrases
    .slice().sort((a, b) => b.length - a.length) // longest first, so "total sum insured" wins over "sum insured"
    .map((p) => p.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]?").replace(/\s+/g, "\\s*"));
  return new RegExp("\\b(?:" + parts.join("|") + ")(?![A-Za-z])", "i");
}
