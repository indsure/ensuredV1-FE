/**
 * Insurer metrics (claim settlement ratio, incurred claim ratio, complaints)
 * from IRDAI publications, read from shared/data/insurerMetrics.json.
 *
 * Pure functions only, so the matcher can be tested without a browser. The
 * dataset is passed in rather than imported here: production passes the
 * shipped JSON, tests pass a fixture that never ships.
 *
 * Founder decision 2026-10-15: these numbers appear on the compare page only.
 */

export interface MetricPoint {
  value: number;
  fy: string;
  source_doc: string;
  source_url: string;
  page: number;
}

export interface InsurerMetricsRow {
  slug: string;
  name: string;
  aliases?: string[];
  csr: MetricPoint | null;
  icr: MetricPoint | null;
  grievances_per_10k: MetricPoint | null;
  grievances_raw?: MetricPoint | null;
  verified_by_second_reader?: boolean;
}

export interface InsurerMetricsDataset {
  dataset_version: string;
  definitions?: Record<string, string>;
  insurers: InsurerMetricsRow[];
}

export type MetricKey = "csr" | "icr" | "grievances_per_10k";
export const METRIC_KEYS: MetricKey[] = ["csr", "icr", "grievances_per_10k"];

/**
 * Reduce an insurer name to a comparison key: lowercase, drop anything in
 * brackets ("(formerly Max Bupa)"), drop the generic words every insurer
 * carries, then drop punctuation and spaces. "HDFC ERGO General Insurance Co.
 * Ltd." and "HDFC Ergo" both become "hdfcergo"; "ManipalCigna" and "Manipal
 * Cigna" both become "manipalcigna".
 *
 * "life" and "india" are deliberately kept: "SBI General" and "SBI Life" are
 * different companies, and "New India" must not shrink to "new".
 */
export function normalizeInsurerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[.,'’]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(the|and allied|insurance|assurance|general|health|company|co|corporation|corp|limited|ltd|pvt|private)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Map a free-text insurer name (as the compare engine reads it off a policy
 * wording) to one row of the dataset, by exact match on the normalised name or
 * any alias. Returns null on no match, on an empty key, and when the key points
 * at two different insurers: a wrong insurer's numbers are worse than none.
 */
export function matchInsurer(
  text: string | null | undefined,
  dataset: InsurerMetricsDataset,
): InsurerMetricsRow | null {
  if (!text) return null;
  const key = normalizeInsurerName(text);
  if (!key) return null;

  let found: InsurerMetricsRow | null = null;
  for (const row of dataset.insurers) {
    const names = [row.name, ...(row.aliases ?? [])];
    if (!names.some((n) => normalizeInsurerName(n) === key)) continue;
    if (found && found.slug !== row.slug) return null;
    found = row;
  }
  return found;
}

/**
 * The metric to show, or null for "Not available yet". A row that a second
 * reader has not confirmed shows nothing, and so does any value that is not a
 * real number or has no source to link.
 */
export function usableMetric(row: InsurerMetricsRow | null, key: MetricKey): MetricPoint | null {
  if (!row || row.verified_by_second_reader !== true) return null;
  const m = row[key];
  if (!m || typeof m.value !== "number" || !Number.isFinite(m.value) || m.value < 0) return null;
  if (!m.fy || !m.source_doc || !isHttpUrl(m.source_url)) return null;
  return m;
}

export function isHttpUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

/** "IRDAI Annual Report 2023-24" already names IRDAI; anything else gets it added. */
export function sourceLabel(doc: string): string {
  return /^irdai\b/i.test(doc.trim()) ? doc.trim() : `IRDAI, ${doc.trim()}`;
}

/** Up to two decimals, no trailing zeros: 98.6, 0.42, 3. */
export function formatMetric(value: number): string {
  return String(Math.round(value * 100) / 100);
}
