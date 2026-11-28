// Policy type names as Indian insurers print them, taken from the naming research of 16 November 2026
// (E:\Policiestotest\indsure-policy-type-naming-29e463da.md.txt). Phrases are compared with flattened text:
// lower case, "&" as "and", other punctuation as spaces.
//
// How a type is chosen (guessType):
// 1. The title area (first 80 lines) wins. Lines that only mention a cover are skipped first: a section,
//    clause, add-on, extension, endorsement, exclusion or warranty, an Act citation, "cover for", "as per",
//    "entered in", "for and on behalf of". The earliest title line with a name decides; within that line
//    the longest name wins, so "Group Health Insurance Policy" beats "Health Insurance Policy".
// 2. Else a short form printed in capitals in the title area (SFSP, GMC, D&O), marked "check".
// 3. Else a name the research marked as a guess, marked "check".
// Anything found only deep in the wording is left to the older rules and marked "check" there.

export const flatText = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const T = {
  // Fire
  "Standard Fire and Special Perils": ["standard fire and special perils", "standard fire and allied perils", "fire and allied perils insurance", "bharat griha raksha", "bharat flexi griha raksha", "bharat sookshma udyam suraksha", "bharat laghu udyam suraksha", "fire secure policy", "kotak fire secure", "fire insurance policy", "fire policy"],
  "Fire Loss of Profit": ["consequential loss fire", "consequential loss of profit", "fire loss of profit", "business interruption fire", "fire lop"],
  "Industrial All Risks Insurance": ["industrial all risks", "industrial all risk", "mega risk policy", "comprehensive mega risk", "property all risks"],
  // Engineering
  "Contractor All Risk Insurance": ["contractors all risks", "contractors all risk", "contractor s all risk", "contractor all risk", "annual contractors all risk", "welcar", "offshore construction project"],
  "Erection All Risk Insurance": ["erection all risks", "erection all risk", "annual erection all risk"],
  "Contractors Plant and Machinery Insurance": ["contractors plant and machinery", "contractor s plant and machinery", "contractors plant and mach", "contractor s plant and machine", "contractors plant and equipment"],
  "Machinery Breakdown Insurance": ["machinery breakdown insurance", "machinery breakdown policy"],
  "Boiler and Pressure Plant Insurance": ["boiler and pressure plant", "boiler pressure plant", "boiler and pressure vessel"],
  "Electronic Equipments Insurance": ["electronic equipment insurance", "electronic equipments insurance", "electronic equipment retail"],
  "Machinery Loss of Profit": ["machinery loss of profit", "machinery lop"],
  "Advance Loss of Profit Insurance": ["advance loss of profit", "advance loss of profits", "advanced loss of profit", "delay in start up engineering"],
  // Agriculture
  "Weather Insurance Policy": ["weather insurance policy", "weather protect policy", "weather based crop insurance", "weather index based insurance", "weather index insurance", "weather insurance index", "rainfall index insurance", "rainfall insurance"],
  // Marine
  "Marine Cargo - Open Policy": ["marine cargo insurance open policy", "marine cargo open policy", "marine cargo open insurance", "marine open policy", "marine open cover", "sales turnover policy"],
  "Marine Cargo - Specific Policy": ["marine cargo insurance specific policy", "marine cargo specific", "single transit policy", "single transit insurance", "specific transit policy", "special transit policy", "marine cargo policy", "marine cargo insurance"],
  "Marine Transit Policy": ["marine cargo inland transit", "inland transit policy"],
  "Marine Hull & Machinery": ["marine hull and machinery", "hull and machinery insurance", "marine hull insurance", "marine hull policy", "hull all risk insurance", "builders risk"],
  "Protection & Indemnity": ["hull liability insurance p and i"],
  "Loss of Hire": ["loss of earnings hire insurance", "loss of hire insurance"],
  "Marine Legal Liability": ["wharfingers liability", "stevedores liability", "freight forwarders liability", "freight services liability", "marine legal liability"],
  "Multi Model Transport Operator": ["through transport and related liability", "transport operators comprehensive liability", "transport operator comprehensive liability", "multimodal transport operator"],
  "Delay in start up": ["marine delay in start up", "delay in start up marine", "delay in start up insurance linked to marine", "marine delay in startup", "marine dsu", "marine advanced loss of profit", "marine advance loss of profit"],
  // Liability
  "Workmens Compensation Policy": ["employees compensation insurance", "employees compensation policy", "employee s compensation", "workmen s compensation policy", "workmen s compensation insurance", "workmens compensation policy", "workmen compensation policy", "employer s liability workmen s compensation"],
  "Directors and Officers Liability Insurance": ["directors and officers liability", "directors and officers insurance", "directors and officers"],
  "Professional Indemnity Insurance": ["professional indemnity insurance", "professional indemnity policy", "professional indemnity", "medical indemnity", "doctors indemnity", "medical malpractice"],
  "Errors and Ommissions Insurance": ["errors and omissions", "errors and ommissions", "e professional indemnity technology", "multimedia professional indemnity"],
  "Commercial General Liability Insurance": ["commercial general liability", "comprehensive general liability"],
  "Public Liability Insurance - Act": ["public liability insurance act", "public liability act"],
  "Product Liability Insurance": ["product liability insurance", "product liability policy", "product liability", "product recall guarantee"],
  "Cyber Security Insurance": ["cyber security insurance", "cyber liability insurance", "cyber risks insurance", "cyber secure", "cyber edge", "cyber defense insurance", "cyber safe", "cyber protection plan", "cyber care policy", "commercial cyber insurance", "cyber protect"],
  "Bankers Indemnity Insurance": ["bankers indemnity", "banker s indemnity", "bankers blanket bond"],
  "Carrier Legal Liability": ["carriers legal liability", "carrier legal liability", "carrier s legal liability", "transporters legal liability"],
  // Miscellaneous
  "Burglary Insurance": ["burglary and housebreaking", "burglary and house breaking", "burglary insurance", "burglary standard policy", "burglary protect", "burglary secure"],
  "Money Insurance": ["money insurance", "fidelity money and securities"],
  "Fidelity Guarantee Insurance": ["fidelity guarantee", "fidelity guard"],
  "Jewellers Block Insurance": ["jewellers block", "jewellers comprehensive protection", "jeweller secure"],
  "Plate Glass Insurance": ["plate glass insurance", "plate glass policy"],
  "Neon Sign insurance": ["neon sign", "neon glow sign", "glow sign or hoarding", "neon insurance"],
  "Baggage Insurance": ["baggage insurance", "baggage group insurance"],
  "Cattle Insurance": ["cattle insurance", "cattle and livestock", "cattle livestock"],
  "Cellular Network Insurance": ["cellular network"],
  "Port Package Policy": ["port package"],
  "Shopkeeper Package Policy": ["shopkeepers package", "shopkeeper s package", "shopkeeper s policy", "shopkeeper s insurance"],
  "Office Package Policy": ["office package policy", "office package insurance", "office package"],
  "Home Package Policy": ["householders package", "householder s package", "householders insurance policy", "householder s policy", "householder s umbrella", "home package policy", "total home protect", "home secure", "homesecure", "home protector", "complete home protect", "homeowners insurance"],
  "Hotel and Restaurant Package Policy": ["hotel and restaurant package", "hotel shield"],
  "Commercial Package policy": ["commercial package policy", "commercial package insurance", "commercial package"],
  "Event Cancellation Insurance": ["event cancellation", "event shield", "comprehensive event insurance", "comprehensive event protect"],
  "Film Insurance": ["film insurance"],
  "Fine Arts": ["fine arts insurance", "fine art policy", "fine arts and private collectors"],
  "Kidnap Ransom and Extortion Insurance": ["kidnap and ransom", "kidnap ransom and extortion"],
  "Credit Insurance": ["trade credit insurance", "credit insurance policy", "credit insurance"],
  "Customs duty package": ["customs duty package"],
  // Health
  "Group Mediclaim Policy": ["group mediclaim", "group health insurance", "group health floater insurance", "group health assure", "group health care"],
  "Individual Mediclaim Policy": ["individual health insurance", "health insurance policy", "mediclaim policy", "mediclaim insurance policy", "arogya sanjeevani", "arogya shield", "arogya supreme", "atmanirbhar health"],
  "Health Family Floater Policy": ["family floater"],
  "TOP UP MEDICLAIM": ["super top up", "super topup", "top up mediclaim", "top up health insurance", "topup health insurance", "top up policy", "advantage top up"],
  "Critical illness": ["critical illness policy", "critical illness insurance"],
  "Hospital Cash": ["hospital daily cash", "hospital cash policy", "hospital cash insurance"],
  "Individual Personal Accident Policy": ["individual personal accident", "personal accident policy", "personal accident insurance", "saral suraksha bima", "janata personal accident", "gramin personal accident"],
  "Group Personal Accident Policy": ["group personal accident", "aviation personal accident crew members group"],
  "Travel Insurance": ["overseas travel insurance", "travel insurance policy", "overseas travel protection", "comprehensive travel insurance", "international travel insurance", "domestic travel insurance", "inland travel care", "inland travel insurance", "student travel"],
  "Group Travel Insurance": ["group travel insurance", "group overseas travel", "group domestic travel", "corporate travel insurance", "group travel health"],
  // Motor
  "Motor Private Car Package Policy": ["private car package policy", "private car package insurance", "motor private car package", "private car package", "private car policy bundled", "bundled private car", "bundled motor private car", "bundled motor policy for private cars", "motor private car bundled", "bundled auto secure private car", "private car policy", "motor private car", "package policy private car"],
  "Motor Two Wheeler Policy": ["two wheeler package policy", "two wheeler package", "two wheeler policy bundled", "bundled two wheeler", "bundled motor 2 wheeler", "bundled motor policy for two wheelers", "bundled auto secure two wheeler", "two wheeler multiyear policy", "long term two wheeler", "motor package policy for two wheeler", "two wheelers package policy"],
  "PVT Car OD only": ["standalone own damage private car", "stand alone own damage private car", "standalone own damage cover for private car", "private car policy own damage", "own damage policy private car"],
  "Two wheeler OD only": ["standalone own damage two wheeler", "stand alone own damage two wheeler"],
  "Motor Third Party Liability Policy": ["private car liability only policy", "private car liability policy", "two wheeler liability only policy", "two wheeler liability policy", "motor 2 wheeler liability only policy", "liability only policy", "third party liability only policy", "act only policy", "act liability insurance", "private car act policy", "standalone third party", "stand alone third party"],
  "Motor Commercial Vehicle Policy": ["commercial vehicle package policy", "goods carrying vehicle", "passenger carrying vehicle", "commercial vehicle policy"],
  "Motor Miscellaneous Policy": ["motor trade road transit", "motor trade internal risks", "miscellaneous and special type of vehicles", "miscellaneous and special types of vehicles"],
  "CPA Pvt Car": ["compulsory personal accident owner driver motor insurance", "standalone compulsory personal accident", "compulsory personal accident policy"],
  "CPA two wheeler": ["compulsory personal accident owner driver two wheeler"],
};

// Names the research could not tie to a printed wording: a suggestion to check, never decided outright.
const GUESS = {
  "Contractor All Risk Insurance": ["contract works insurance", "construction all risk"],
  "Erection All Risk Insurance": ["storage cum erection", "marine cum erection", "marine cum storage cum erection"],
  "Contractors Plant and Machinery Insurance": ["plant all risks", "equipment all risks"],
  "Machinery Loss of Profit": ["consequential loss machinery", "machinery business interruption"],
  "Marine Cargo - Open Policy": ["annual marine policy", "annual transit policy"],
  "Marine Transit Policy": ["inland transit", "goods in transit", "transit insurance"],
  "Charterers Liability": ["charterers legal liability", "charterers liability insurance"],
  "Freight, Demurrage and Defence": ["freight demurrage and defence", "freight demurrage and defense"],
  "Marine Legal Liability": ["terminal operators liability", "ports and terminals liability"],
  "Public Liability Insurance - Industrial": ["public liability insurance industrial", "public liability industrial"],
  "Public Liability Insurance - Non Industrial": ["public liability insurance non industrial", "public liability non industrial", "third party liability premises"],
  "Product Liability Insurance": ["products liability"],
  "Agency Liability": ["agency liability", "agents liability", "tour operators liability"],
  "Ship Brokers Liability": ["ship brokers liability", "ship agents liability"],
  "Media Liability Insurance": ["media liability", "multimedia liability"],
  "FMC BOND": ["fmc bond", "forward markets commission bond"],
  "Signage Insurance": ["signage insurance", "hoarding insurance"],
  "Portable Equipment Insurance": ["portable equipment insurance", "all risks portable equipment"],
  "ATM Safe Insurance": ["atm safe insurance"],
  "Lift Irrigation Insurance": ["lift irrigation"],
  "Traders Package Policy": ["traders package", "traders combined"],
  "Commercial Package policy": ["commercial combined", "sme package", "business package"],
  "Special contingency": ["special contingency", "special contingencies"],
  "Fidelity Guarantee Insurance": ["commercial crime", "crime insurance"],
  "Hospital Cash": ["hospicash"],
  "Motor Commercial Vehicle Policy": ["goods vehicle package", "truck insurance", "taxi insurance"],
  "Motor Miscellaneous Policy": ["tractor insurance"],
};

// Short forms, only when printed in capitals as their own word in the title area. Risky ones that are
// ordinary words or other things (CAR, PI, EC, WC, OD, TP, PC, MB, EL, BI, TW) are left out on purpose.
const SHORT = [
  [/(^|[^A-Z])SFSPP?([^A-Z]|$)/, "Standard Fire and Special Perils"], [/(^|[^A-Z])IAR([^A-Z]|$)/, "Industrial All Risks Insurance"],
  [/(^|[^A-Z])FLOP([^A-Z]|$)/, "Fire Loss of Profit"], [/(^|[^A-Z])EAR([^A-Z]|$)/, "Erection All Risk Insurance"],
  [/(^|[^A-Z])CPM([^A-Z]|$)/, "Contractors Plant and Machinery Insurance"], [/(^|[^A-Z])BPP([^A-Z]|$)/, "Boiler and Pressure Plant Insurance"],
  [/(^|[^A-Z])EEI([^A-Z]|$)/, "Electronic Equipments Insurance"], [/(^|[^A-Z])MLOP([^A-Z]|$)/, "Machinery Loss of Profit"],
  [/(^|[^A-Z])ALOP([^A-Z]|$)/, "Advance Loss of Profit Insurance"], [/(^|[^A-Z])MBD([^A-Z]|$)/, "Machinery Breakdown Insurance"],
  [/(^|[^A-Z])(GMC|GHI)([^A-Z]|$)/, "Group Mediclaim Policy"], [/(^|[^A-Z])GPA([^A-Z]|$)/, "Group Personal Accident Policy"],
  [/(^|[^A-Z])CGL([^A-Z]|$)/, "Commercial General Liability Insurance"], [/(^|[^A-Z])D\s?&\s?O([^A-Z]|$)/, "Directors and Officers Liability Insurance"],
  [/(^|[^A-Z])E\s?&\s?O([^A-Z]|$)/, "Errors and Ommissions Insurance"], [/(^|[^A-Z])H\s?&\s?M([^A-Z]|$)/, "Marine Hull & Machinery"],
  [/(^|[^A-Z])MTO([^A-Z]|$)/, "Multi Model Transport Operator"], [/(^|[^A-Z])(GCV|PCV)([^A-Z]|$)/, "Motor Commercial Vehicle Policy"],
  [/(^|[^A-Z])BBB([^A-Z]|$)/, "Bankers Indemnity Insurance"], [/(^|[^A-Z])(K\s?&\s?R|KRE)([^A-Z]|$)/, "Kidnap Ransom and Extortion Insurance"],
];

// A line that only mentions a cover: section headings, add-ons, Acts and the like. Never a title.
// "Act Only Policy", "Act Liability" and "Public Liability Act" are real motor and liability titles, so they stay.
const TRAP_LINE = /^\s*((section|part|clause|add[\s-]?on|extension|endorsement|exclusion|warranty|warranted|condition|note|schedule\s+of\s+add)\w*\b|[ivx]{1,4}[.)]\s|\d{1,2}[.)]\s)|\bcover\s+for\b|\bas\s+per\b|\bentered\s+(in|with)\b|\bfor\s+and\s+on\s+behalf\b|\breinsur|\bexclu|\bwarrant|\badd[\s-]?on\b|\bextension\b|\bclause\b|\bact\b(?!\s*(only|liability|policy|insurance\s+policy))/i;

// Broad names that a more specific name on the same line overrides: "Group Health Insurance Policy" is group,
// "Super Top Up Mediclaim Policy" is a top-up, "3 Years Motor Private Car (Liability Only Policy)" is liability only.
const GENERIC = new Set(["Individual Mediclaim Policy", "Travel Insurance", "Motor Private Car Package Policy", "Marine Cargo - Specific Policy", "Standard Fire and Special Perils", "Individual Personal Accident Policy", "Professional Indemnity Insurance"]);
const rank = (x) => (GENERIC.has(x.type) ? 0 : 1000) + x.p.length;
const compile = (table) => Object.entries(table).flatMap(([type, list]) => list.map((p) => ({ type, p: " " + flatText(p) + " " })));
const NAMES = compile(T), GUESSES = compile(GUESS);

// The words of the name as printed on the line ("Private Car Package Policy", not the table figures after it).
function printedPart(text, phrase) {
  const esc = (w) => (w === "and" ? "(?:and|&)" : w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(phrase.split(" ").map(esc).join("[^A-Za-z0-9&]*"), "i");
  const m = String(text).match(re);
  return (m ? m[0] : String(text)).replace(/\s{2,}/g, " ").trim().slice(0, 80);
}

// "Base policy product / title", "Issued policy product:", "Product name", "Name of the policy", "Policy type", "Plan name".
// "Product code" is not one of them.
const PRODUCT_LABEL = /^\s*(?:base\s+policy\s+product(?:\s*\/\s*title)?|issued\s+policy\s+product|policy\s+product(?:\s+name)?|product\s+(?:name|title)|name\s+of\s+(?:the\s+)?(?:product|policy|plan)|policy\s+(?:type|name|title)|type\s+of\s+(?:policy|cover)|plan\s+name)\s*[:\-|]?\s+(.{4,})$/i;

/** The policy type from the title area, with the phrase and line it came from, or null. */
export function guessType(lines) {
  // Lines come as plain strings from the reader ("[Page 2]" marks a page) or as { text, marker } objects.
  const real = (lines || []).map((l, i) => { const text = typeof l === "string" ? l : (l && l.text) || ""; return { text, i, marker: (l && l.marker) || /^\s*\[Page \d+\]\s*$/.test(text) }; }).filter((l) => !l.marker).slice(0, 80);
  const title = real.filter((l) => l.text.trim() && !TRAP_LINE.test(l.text));
  const byLine = (list, conf, why) => {
    for (const l of title) {
      const f = " " + flatText(l.text) + " ";
      const hits = list.filter((x) => f.includes(x.p)).sort((a, b) => rank(b) - rank(a));
      if (hits.length) return { type: hits[0].type, phrase: hits[0].p.trim(), printed: printedPart(l.text, hits[0].p.trim()), line: l.i + 1, conf, why };
    }
    return null;
  };
  // A line that labels the product beats any heading: an endorsement printed ahead of the schedule
  // ("CARRIER LEGAL LIABILITY - ROAD LEG", then "Base policy product / title: ... (MTO)"), or a section heading
  // above "Issued policy product: Bankers Blanket Bond". Numbered lines ("2. Policy Type: Burglary") count too.
  for (const l of real) {
    const m = l.text.replace(/^\s*(\d{1,2}|[a-z]|[ivx]{1,4})[.)]\s+/i, "").match(PRODUCT_LABEL);
    if (!m) continue;
    const f = " " + flatText(m[1]) + " ";
    const hits = NAMES.filter((x) => f.includes(x.p)).sort((a, b) => rank(b) - rank(a));
    if (hits.length) return { type: hits[0].type, phrase: hits[0].p.trim(), printed: printedPart(m[1], hits[0].p.trim()), line: l.i + 1, conf: "high", why: "product label" };
  }
  const named = byLine(NAMES, "high", "title");
  // A generic cargo title next to "Open Policy" or "Open Cover" is an open policy.
  if (named && named.type === "Marine Cargo - Specific Policy" && /^(marine cargo policy|marine cargo insurance)$/.test(named.phrase) && title.some((l) => /\bopen\s+(policy|cover)\b/i.test(l.text))) return { ...named, type: "Marine Cargo - Open Policy" };
  if (named) return named;
  for (const l of title) { const s = SHORT.find(([re]) => re.test(l.text)); if (s) return { type: s[1], phrase: l.text.trim().slice(0, 60), line: l.i + 1, conf: "low", why: "short form" }; }
  return byLine(GUESSES, "low", "guess");
}
