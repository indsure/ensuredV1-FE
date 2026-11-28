/**
 * Which stored files go into an account export, and what each is called.
 *
 * Kept pure (no database, no storage, no clock) so the choice of what a person
 * gets back can be tested without a live account.
 *
 * TWO SOURCES, ON PURPOSE
 * 1. The rows. They know what a file IS (Ramesh's Star Health policy, the
 *    discharge summary on a claim), so they give it a name a person recognises.
 * 2. A listing of the account's own folder in the bucket. Every upload path in
 *    the product starts with "<accountId>/", so that folder is the ground truth
 *    for "every file on my account". Anything there that no row names still
 *    goes in, under other-files/, rather than being silently left out because a
 *    new upload site forgot to tell this module about itself.
 *
 * Ownership is checked exactly as deletion checks it: right bucket, and a key
 * under the account's own prefix. A row pointing anywhere else is left out and
 * logged by the caller, never fetched.
 */

import { ownsStoragePath, parseStorageUrl } from "./accountData";

export interface ExportFile {
  /** Object key inside the bucket. */
  key: string;
  /** Path inside the zip. */
  zipName: string;
}

export interface ExportPlan {
  files: ExportFile[];
  /** Rows that point at a file we would not fetch (other bucket, other account). */
  refused: number;
}

type Row = Record<string, any>;

/** Characters Windows will not accept in a file name, plus control characters. */
const BAD_CHARS = /[<>:"/\\|?*\u0000-\u001f\u007f]+/g;

/** One path segment, safe on Windows and still readable (Hindi survives). */
export function safeSegment(raw: unknown, fallback: string): string {
  const s = String(raw ?? "")
    .replace(BAD_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 80)
    .trim();
  // Names Windows reserves for devices: a file called "con.pdf" cannot be opened.
  if (!s || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) return fallback;
  return s;
}

function extOf(key: string): string {
  const last = key.split("/").pop() || "";
  const dot = last.lastIndexOf(".");
  const ext = dot > 0 ? last.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) : "";
  return ext || "pdf";
}

/** Drop a trailing extension the caller is about to add back. */
function stripExt(name: string, ext: string): string {
  return name.toLowerCase().endsWith(`.${ext}`) ? name.slice(0, -(ext.length + 1)) : name;
}

function dateOf(v: unknown): string {
  if (!v) return "";
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function planExportFiles(input: {
  kind: "agent" | "individual";
  accountId: string;
  bucket: string;
  /** The JSON export's tables, keyed by their label (see accountData.ts). */
  data: Record<string, unknown[]>;
  /** Every object key found under "<accountId>/" in the bucket. */
  listedKeys: string[];
}): ExportPlan {
  const { kind, accountId, bucket, data } = input;
  const files: ExportFile[] = [];
  const taken = new Set<string>(); // zip names, lower-cased
  const seenKeys = new Set<string>();
  let refused = 0;

  const rows = (label: string): Row[] => (Array.isArray(data[label]) ? (data[label] as Row[]) : []);

  const uniqueName = (folder: string, base: string, ext: string) => {
    let name = `${folder}/${base}.${ext}`;
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${folder}/${base} (${i}).${ext}`;
    taken.add(name.toLowerCase());
    return name;
  };

  const add = (key: string, folder: string, base: string) => {
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    const ext = extOf(key);
    files.push({ key, zipName: uniqueName(folder, safeSegment(stripExt(base, ext), "document"), ext) });
  };

  const keyFromUrl = (url: unknown): string | null => {
    if (typeof url !== "string" || !url) return null;
    const ref = parseStorageUrl(url);
    if (!ref) return null; // predates file storage, or not one of ours
    if (ref.bucket !== bucket || !ownsStoragePath(ref.path, accountId)) { refused++; return null; }
    return ref.path;
  };

  const keyFromPath = (path: unknown): string | null => {
    if (typeof path !== "string" || !path) return null;
    if (!ownsStoragePath(path, accountId)) { refused++; return null; }
    return path;
  };

  if (kind === "agent") {
    const customers = new Map<string, string>();
    for (const c of rows("Customers")) if (c?.id) customers.set(String(c.id), String(c.name ?? ""));
    const leads = new Map<string, string>();
    for (const l of rows("Leads")) if (l?.id) leads.set(String(l.id), String(l.name ?? ""));

    for (const p of rows("Policies")) {
      const who = p.policyholder_name || customers.get(String(p.customer_id ?? "")) || "";
      const what = p.insurer || p.policy_name || "";
      const base = [who, what].filter(Boolean).join(" - ") || p.filename || "policy";
      const key = keyFromUrl(p.pdf_url);
      if (key) add(key, "policies", base);

      // Extra covers sent with the policy (a super top-up, an employer cover).
      // They live only inside report_data, so nothing else would name them.
      const companions = p.report_data?.__companions;
      if (Array.isArray(companions)) {
        for (const c of companions) {
          const ck = keyFromUrl(c?.pdf_url);
          if (ck) add(ck, "policies", `${base} - ${String(c?.kind ?? "extra").replace(/_/g, " ")}`);
        }
      }
    }

    for (const lp of rows("Lead policies")) {
      const key = keyFromUrl(lp.file_url);
      if (!key) continue;
      const lead = safeSegment(leads.get(String(lp.lead_id ?? "")), "lead");
      add(key, `leads/${lead}`, lp.file_name || lp.policy_name || lp.insurer || "policy");
    }

    const claims = new Map<string, Row>();
    for (const c of rows("Claims")) if (c?.id) claims.set(String(c.id), c);
    for (const d of rows("Claim documents")) {
      const key = keyFromPath(d.storage_path);
      if (!key) continue;
      const claim = claims.get(String(d.claim_id ?? ""));
      const who = claim ? customers.get(String(claim.customer_id ?? "")) : "";
      const folder = safeSegment([who || "claim", dateOf(claim?.created_at)].filter(Boolean).join(" "), "claim");
      add(key, `claims/${folder}`, d.filename || d.doc_type || "document");
    }
  } else {
    for (const p of rows("Policies")) {
      const key = keyFromUrl(p.pdf_url);
      if (!key) continue;
      add(key, "policies", p.nickname || p.filename || p.policy_name || "policy");
    }
  }

  // Everything else in the account's folder. Sorted so the zip is the same
  // every time for the same account.
  const prefix = `${accountId}/`;
  for (const key of [...input.listedKeys].sort()) {
    if (seenKeys.has(key) || !ownsStoragePath(key, accountId)) continue;
    const rest = key.slice(prefix.length).split("/");
    const file = rest.pop() || "file";
    const folder = ["other-files", ...rest.map((s) => safeSegment(s, "folder"))].join("/");
    add(key, folder, file);
  }

  return { files, refused };
}

/** The note that closes every export, in plain words. */
export function exportReadme(opts: {
  exportedAt: Date;
  included: number;
  missing: string[];
  tooLarge: string[];
}): string {
  const lines = [
    "Your IndSure data",
    `Downloaded on ${opts.exportedAt.toISOString().slice(0, 10)}.`,
    "",
    "data.json has every record we hold for your account.",
    `The folders hold your documents: ${opts.included} file${opts.included === 1 ? "" : "s"}.`,
    "  policies/      policy documents and any extra covers sent with them",
    "  claims/        documents on each claim",
    "  leads/         policies saved against a lead",
    "  other-files/   anything else stored on your account",
  ];
  if (opts.missing.length) {
    lines.push("", "These files are listed in your records but could not be fetched, so they are not in this download:");
    for (const m of opts.missing) lines.push(`  ${m}`);
    lines.push("Try the download again later. If they are still missing, write to us.");
  }
  if (opts.tooLarge.length) {
    lines.push("", "This download reached its size limit, so these files are not in it:");
    for (const m of opts.tooLarge) lines.push(`  ${m}`);
    lines.push("Write to us and we will send them another way.");
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * How many bytes the finished zip will be, so the page can show a real
 * progress bar. Exact for every file whose size the storage listing reported
 * (the STORE format adds fixed headers and nothing else); a file with no known
 * size is counted at the average of the others. The closing note is not built
 * until the end, so a generous allowance stands in for it. An estimate, never
 * a promise: the page holds its bar short of 100% until the download ends.
 */
export function estimateZipBytes(entries: { name: string; size: number | null | undefined }[], noteAllowance = 4096): number {
  const known = entries.filter((e) => typeof e.size === "number" && e.size >= 0);
  const avg = known.length ? known.reduce((n, e) => n + (e.size as number), 0) / known.length : 0;
  let total = 22; // end record
  for (const e of entries) {
    const n = Buffer.byteLength(e.name, "utf8");
    const size = typeof e.size === "number" && e.size >= 0 ? e.size : avg;
    total += 30 + n + size + 46 + n; // local header + data + directory entry
  }
  const noteName = Buffer.byteLength("about-this-download.txt", "utf8");
  return Math.round(total + 30 + 46 + 2 * noteName + noteAllowance);
}
