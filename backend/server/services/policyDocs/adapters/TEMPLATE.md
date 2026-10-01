# Adapter template

Copy into `adapters/<insurer>-<product>-<UIN>.ts`, fill in, register in `../index.ts`.
See `hdfcClick2AchieveV02.ts` for a complete example.

```ts
import type { ParsedFields, ReviewFlag } from "../../../../../shared/policyDocTypes";
import { findLines, norm, sourceOf, valuesRightOf, clauseText, tableRows } from "../docQuery";
import type { Identification, PolicyAdapter } from "../registry";
import type { DocumentText } from "../textLayer";

const ID = "<insurer>-<product>-<UIN>-<option>-<benefit>";
const VERSION = "1.0.0";          // bump on ANY parsing change; approvals never carry across
const UIN = "<full UIN with version, e.g. 512N123V04>";

const TITLE_RE = /<the policy document title as printed>/i;
const UIN_RE = /Unique Identification Number:\s*([0-9]{3}[A-Z][0-9]{3}V[0-9]{2})\b/;
const FINGERPRINT: [string, RegExp][] = [
  // clause headings this edition must have, e.g. ["Part D", /^Part D$/]
];

function identify(doc: DocumentText): Identification {
  if (!findLines(doc, TITLE_RE).length) return { result: "no_match", reason: "<not this product>" };
  const uins = new Set(findLines(doc, UIN_RE).map((h) => h.match[1]));
  if (uins.size === 0) return { result: "no_match", reason: "<product, but no readable UIN>" };
  if (uins.size > 1) return { result: "conflict", reason: "<more than one UIN>" };
  if ([...uins][0] !== UIN) return { result: "no_match", reason: "<another version>" };
  // option and benefit variant checks, schedule count check, FINGERPRINT check
  return { result: "match" };
}

function parse(doc: DocumentText): { fields: ParsedFields; flags: ReviewFlag[] } {
  const fields: ParsedFields = {};
  const flags: ReviewFlag[] = [];
  // For each field: found / not_applicable / missing / unsupported / conflicting, with sourceOf(...).
  return { fields, flags };
}

export const myAdapter: PolicyAdapter = {
  id: ID, version: VERSION, insurer: "<insurer>", product: "<product>", uin: UIN,
  supports: "<exactly what this supports, in plain words>",
  identify, parse,
};
```

Rules: no model calls, no `eval`, no defaults, no nearest-product fallback, no silent OCR fixes.
