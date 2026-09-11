/**
 * Motor add-on detection. Deterministic, zero AI, zero network.
 *
 * Reads the plain text of a motor policy schedule and reports which add-on
 * covers it actually carries, with the line from the document as proof of each
 * one. Runs on the same text the data-entry extraction already has in hand, so
 * it costs nothing per policy.
 *
 * Built against two real policies on 2026-09-08 (see
 * docs/plans/2026-09-08-motor-addon-checklist.md). Everything unusual in here
 * exists because one of those two documents required it. In particular:
 *
 *  - Royal Sundaram declares "DepreciationWaiverPremium" as one CamelCase token
 *    and prices it as "Depreciation Waiver". ICICI Lombard declares nothing at
 *    all. The string "zero dep" appears in NEITHER document, so the obvious
 *    alias would have reported "no zero depreciation" on a car carrying
 *    UNLIMITED zero-dep worth Rs 4,394.
 *  - Neither channel below is present in both documents, which is why there are
 *    three of them and why none may be dropped as redundant.
 */

/**
 * Where the scan is stored inside `clients.extracted_data`. Not an entry in
 * EXTRACTION_FIELDS on purpose: the review form renders every field as a text
 * input, which would stringify this object and destroy it on the next save.
 * It survives an agent's edits because the save endpoint merges (see
 * mergeExtractedData in backend/server/services/extractionFields.ts).
 */
export const ADD_ON_FINDINGS_KEY = "add_on_findings";

export type VehicleClass = "car" | "bike";

export type AddOnState =
  /** Found with proof: a priced line, or the insurer's own opted list. */
  | "present"
  /** The policy has no add-on premium at all, proven by arithmetic. */
  | "absent_proven"
  /** Nothing found in this document. NOT the same as "the customer has none". */
  | "not_found"
  /** Something is there but does not prove a purchase. A human should look. */
  | "check_manually";

export interface AddOnCatalogEntry {
  id: string;
  label: string;
  /** Anchored phrases. Never a bare single word: see PROTECTED_FIELDS. */
  aliases: string[];
}

export interface PricedLine {
  name: string;
  /** IRDAI registration number printed beside the add-on, when the insurer prints one. */
  uin: string | null;
  amount: number;
}

export interface AddOnFinding {
  id: string;
  label: string;
  state: AddOnState;
  /** The exact text this finding rests on. Null only when nothing was found. */
  evidence: string | null;
  amount: number | null;
}

export interface AddOnScan {
  /** Bumped when the shape changes, so old rows in extracted_data stay readable. */
  version: 1;
  vehicleClass: VehicleClass;
  scannedAt: string;
  declaredListFound: boolean;
  pricedLines: PricedLine[];
  /** Own-damage premium arithmetic. `headroom` is what was spent on add-ons. */
  arithmetic: { basicOd: number; totalOd: number; headroom: number } | null;
  /** Whether the named lines account for the whole headroom. */
  reconciliation: { named: number; ncb: number; unexplained: number } | null;
  findings: AddOnFinding[];
  present: number;
  applicable: number;
  /** Declared tokens that matched nothing we know. Grows the catalog. */
  unrecognisedDeclared: string[];
}

/* ── Catalog ──────────────────────────────────────────────────────────────
   Deliberately NOT flagged "recommended": which add-ons deserve that word is
   a founder decision and becomes a public claim the moment an agent forwards
   a report. Until it is made, this is a list of what we can detect, and the
   card counts found over detectable. */

const SHARED: AddOnCatalogEntry[] = [
  {
    id: "zero_depreciation",
    label: "Zero depreciation",
    aliases: [
      "zero depreciation", "nil depreciation", "depreciation waiver",
      "depreciation reimbursement", "bumper to bumper", "parts depreciation",
      "zero dep cover", "depreciation cover",
    ],
  },
  { id: "consumables", label: "Consumables", aliases: ["consumable"] },
  {
    id: "roadside_assistance",
    label: "Roadside assistance",
    aliases: ["roadside assistance", "road side assistance", "emergency assistance", "breakdown assistance"],
  },
  {
    id: "return_to_invoice",
    label: "Return to invoice",
    aliases: ["return to invoice", "invoice price cover", "invoice protection", "return to invoice cover"],
  },
  {
    id: "ncb_protect",
    label: "NCB protect",
    aliases: ["no claim bonus protect", "ncb protect", "ncb protection", "ncb secure", "bonus protect", "no claim bonus protection"],
  },
  {
    id: "engine_protect",
    label: "Engine protection",
    aliases: [
      "engine protect", "engine protection", "engine secure", "engine guard",
      // The perils these covers are sold against, as insurers word them.
      // "hydrostatic" alone would be a bare word; the phrase is not.
      "hydrostatic lock", "water ingression", "engine and gear box", "engine gearbox",
    ],
  },
];

export const ADD_ON_CATALOG: Record<VehicleClass, AddOnCatalogEntry[]> = {
  car: [
    ...SHARED,
    { id: "key_replacement", label: "Key replacement", aliases: ["key replacement", "key loss", "lost key", "key protect"] },
    { id: "tyre_protect", label: "Tyre protection", aliases: ["tyre protect", "tyre secure", "tyre damage", "tyre cover"] },
    { id: "personal_belongings", label: "Loss of personal belongings", aliases: ["personal belongings", "loss of baggage"] },
  ],
  bike: [
    ...SHARED,
    { id: "pillion_cover", label: "Pillion rider cover", aliases: ["pillion rider cover", "pillion cover", "cover for pillion rider", "unnamed pillion"] },
    { id: "helmet_cover", label: "Helmet cover", aliases: ["helmet cover", "helmet protect"] },
    { id: "accessories_cover", label: "Accessories cover", aliases: ["accessories cover", "cover for accessories"] },
  ],
};

/* ── Normalisation ────────────────────────────────────────────────────────
   Squashing every non-alphanumeric character makes "DepreciationWaiverPremium",
   "Depreciation Waiver" and "depreciation-waiver" the same string, so a single
   alias covers a declared list, a premium table and a wording, across insurers
   that each write it differently. */
const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const toNumber = (s: string): number => Number(String(s).replace(/[^0-9.-]/g, ""));

/* Regions that describe the VEHICLE rather than its cover. Masked before any
   matching runs, because every one of these produced a false tick on a real
   document:
     "Engine No. REVTRN05..."                 -> Engine protection
     "GST Invoice No. VPC17908..."            -> Return to invoice
     "ACTIVA 125 DISC OBD2B Solo With Pillion" -> Pillion rider cover
     "Additional Accessories (Rs) 0.00"        -> Accessories cover  */
const PROTECTED_FIELDS: RegExp[] = [
  /engine\s*(?:no|number)\.?\s*:?[^\n]{0,40}/gi,
  /chassis\s*(?:no|number)\.?\s*:?[^\n]{0,40}/gi,
  /(?:gst\s*)?invoice\s*(?:no|number|date)\.?\s*:?[^\n]{0,40}/gi,
  /(?:vehicle\s*)?(?:make|model)(?:\s*(?:of the vehicle|description|\/\s*model))?\s*:?[^\n]{0,90}/gi,
  /(?:additional|electrical|electronic|non\s*electrical)[\s/]*(?:\/[\s/]*electronic)?\s*accessories[^\n]{0,25}/gi,
];

function maskVehicleFields(text: string): string {
  let out = text;
  for (const re of PROTECTED_FIELDS) out = out.replace(re, (m) => " ".repeat(m.length));
  return out;
}

/** Two-wheeler unless the document says otherwise. */
export function detectVehicleClass(text: string): VehicleClass {
  return /two[\s-]?wheeler|motor\s?cycle|scooter|moped/i.test(text) ? "bike" : "car";
}

/* ── Premium-table phrasings ──────────────────────────────────────────────
   Royal Sundaram writes "Basic premium on Vehicle", ICICI Lombard writes
   "Basic OD Premium". One regex would have read only one of the two. */
const BASIC_OD = /basic\s*(?:od\s*)?premium(?:\s*on\s*vehicle)?[^0-9-]{0,25}([\d,]+\.?\d*)/i;
const TOTAL_OD = /total\s*(?:own\s*damage|od)\s*premium\s*\(?\s*a?\s*\)?[^0-9-]{0,25}([\d,]+\.?\d*)/i;
/* Anchored on the deduction, not the first mention: "No Claim Bonus" also
   appears in boilerplate, and the loose form matched that instead. */
const NCB_DEDUCT = /no\s*claim\s*bonus\s*(?:deduct|deduction|discount)[^0-9-]{0,15}(-?[\d,]+\.?\d*)/i;

const OD_BLOCK_START = /a\s*-\s*own\s*damage|own\s*damage\s*\(\s*a\s*\)|own\s*damage\(a\)/i;
const OD_BLOCK_END = /total\s*(?:own\s*damage|od)\s*premium/i;
const UIN = /\(?\s*(IRDAN[A-Z0-9/]+)[^)]*\)/g;

export function detectMotorAddOns(policyText: string): AddOnScan | null {
  if (!policyText || policyText.trim().length < 200) return null;

  const vehicleClass = detectVehicleClass(policyText);
  const catalog = ADD_ON_CATALOG[vehicleClass];
  const normalised = catalog.map((c) => ({ entry: c, keys: c.aliases.map(squash) }));
  const matchEntry = (s: string): AddOnCatalogEntry | null => {
    const q = squash(s);
    if (!q) return null;
    return normalised.find((n) => n.keys.some((k) => q.includes(k)))?.entry ?? null;
  };

  const masked = maskVehicleFields(policyText);

  /* Channel 1: the insurer's own "Add-on Covers Opted" list.
     The PDF text stream flattens the table, so the value runs on into whatever
     label follows it. No terminator is needed: only tokens matching a catalog
     alias count, and the rest are reported for review. */
  const declared = new Map<string, string>();
  const unrecognisedDeclared: string[] = [];
  /* Insurers head this list differently, and matching only one spelling was
     silently costing us whole policies. Royal Sundaram writes "Add-on Covers
     Opted"; Acko writes "Addons Selected" and follows it with prose instead of
     a comma list. An Acko policy that genuinely holds Consumables therefore
     reported every add-on as not found, and the scorer then published 100 out
     of 100 off the one word it could read. */
  const label =
    /add[\s-]?ons?\s+(?:covers?\s+)?(?:opted|selected|chosen|availed|included)/i.exec(masked);
  if (label) {
    const from = label.index + label[0].length;
    /* Stop at the next section instead of reading a fixed span into whatever
       follows. Acko puts "What's not covered" directly after the add-on list,
       and without a terminator every exclusion in it arrives as an
       unrecognised add-on. Splitting on runs of whitespace as well as commas is
       what reads a column layout once the PDF is flattened. */
    const rest = masked.slice(from, from + 600);
    const stop = /what'?s\s+not\s+covered|exclusions?\b|premium\s+break|total\s+premium/i.exec(rest);
    const window = rest.slice(0, stop ? stop.index : 300);
    for (const token of window.split(/[,\n]|\s{3,}/)) {
      const t = token.trim();
      if (!t) continue;
      const hit = matchEntry(t);
      if (hit) declared.set(hit.id, t.slice(0, 70));
      else unrecognisedDeclared.push(t.slice(0, 50));
    }
  }

  /* Channel 2: priced lines. Scoped to the own-damage block, or the product's
     own UIN in the page footer masquerades as an add-on line. */
  const start = OD_BLOCK_START.exec(masked);
  const pricedLines: PricedLine[] = [];
  if (start) {
    const endRe = new RegExp(OD_BLOCK_END.source, "i");
    const after = masked.slice(start.index);
    const endHit = endRe.exec(after.slice(1));
    const block = after.slice(0, endHit ? endHit.index + 1 : 1200);

    UIN.lastIndex = 0;
    let m: RegExpExecArray | null;
    // Parked just past the previous line's amount, so a name lookback cannot
    // swallow it and read "128.7 Roadside Assistance Cover".
    let cursor = 0;
    while ((m = UIN.exec(block)) !== null) {
      const name = block
        .slice(Math.max(cursor, m.index - 70), m.index)
        // [\s\S] rather than the `s` flag: this module is compiled by the
        // frontend too, and its target predates dotAll.
        .replace(/^[\s\S]*?ADD:/, "")
        .replace(/^[\s\d.,)-]+/, "")
        .replace(/[(\s]+$/, "")
        .trim();
      const afterUin = m.index + m[0].length;
      const rest = block.slice(afterUin, afterUin + 60);
      const skip = /^\s*(?:\([^)]*\)\s*)*/.exec(rest)?.[0].length ?? 0;
      const amount = /^\s*(-?[\d,]+(?:\.\d+)?)/.exec(rest.slice(skip));
      cursor = amount ? afterUin + skip + amount[0].length : afterUin;
      if (amount && name) {
        pricedLines.push({ name, uin: m[1], amount: toNumber(amount[1]) });
      }
    }
  }

  /* Channel 3: arithmetic. Total own-damage premium minus basic own-damage
     premium is what was spent on add-ons. Zero is a PROOF that none exist,
     which is a different and much stronger statement than "not found". */
  const basicM = BASIC_OD.exec(masked);
  const totalM = TOTAL_OD.exec(masked);
  const round = (n: number) => Math.round(n * 100) / 100;
  const arithmetic =
    basicM && totalM
      ? {
          basicOd: toNumber(basicM[1]),
          totalOd: toNumber(totalM[1]),
          headroom: round(toNumber(totalM[1]) - toNumber(basicM[1])),
        }
      : null;

  /* Completeness. If the named lines plus the no-claim-bonus deduction do not
     account for the headroom, the catalog has a hole, and the card can say so
     instead of quietly showing a short list. */
  let reconciliation: AddOnScan["reconciliation"] = null;
  if (arithmetic && arithmetic.headroom !== 0) {
    const named = round(pricedLines.reduce((t, p) => t + p.amount, 0));
    const ncbM = NCB_DEDUCT.exec(policyText);
    const ncb = ncbM ? -Math.abs(toNumber(ncbM[1])) : 0;
    reconciliation = { named, ncb, unexplained: round(arithmetic.headroom - named - ncb) };
  }

  const provenEmpty = arithmetic !== null && arithmetic.headroom === 0;

  const findings: AddOnFinding[] = catalog.map((entry) => {
    const declaredAs = declared.get(entry.id) ?? null;
    const priced = pricedLines.find((p) => matchEntry(p.name)?.id === entry.id) ?? null;

    // A cover priced at or below zero was not bought at that price: it is a
    // bundled freebie or a discount scheme, never a paid tick on its own.
    if (priced && priced.amount > 0) {
      return {
        id: entry.id,
        label: entry.label,
        state: "present",
        evidence: priced.uin ? `${priced.name} (${priced.uin})` : priced.name,
        amount: priced.amount,
      };
    }
    if (declaredAs) {
      return {
        id: entry.id,
        label: entry.label,
        state: "present",
        evidence: `Listed by the insurer as opted: "${declaredAs}"`,
        amount: priced?.amount ?? null,
      };
    }
    if (priced) {
      return {
        id: entry.id,
        label: entry.label,
        state: "check_manually",
        evidence: `${priced.name} appears at ${priced.amount}, which does not show it was bought`,
        amount: priced.amount,
      };
    }
    // Only a zero headroom proves absence. A fully reconciled non-zero headroom
    // does NOT, because an add-on bundled at zero rupees leaves no trace in the
    // arithmetic (this document carries one: "Smart Use ... 0").
    return {
      id: entry.id,
      label: entry.label,
      state: provenEmpty ? "absent_proven" : "not_found",
      evidence: provenEmpty && arithmetic
        ? `Own damage premium is ${arithmetic.totalOd} against a basic of ${arithmetic.basicOd}, so no add-on premium was paid`
        : null,
      amount: null,
    };
  });

  return {
    version: 1,
    vehicleClass,
    scannedAt: new Date().toISOString().slice(0, 10),
    declaredListFound: !!label,
    pricedLines,
    arithmetic,
    reconciliation,
    findings,
    present: findings.filter((f) => f.state === "present").length,
    applicable: catalog.length,
    unrecognisedDeclared,
  };
}
