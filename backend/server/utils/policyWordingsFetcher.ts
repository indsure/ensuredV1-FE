import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import insurerMap from '../data/insurer_normalization.json';
import planAliases from '../data/plan_aliases.json';

// --- Types ---

export type WordingSource = 'internal_kb' | 'insurer_site' | 'irdai' | 'fallback';

export interface Provenance {
  source: WordingSource;
  source_url: string;
  retrieved_at: string; // ISO Date
  checksum: string; // SHA-256
  confidence: number; // 0.0 - 1.0
}

export interface PolicyWordingsResult {
  wording_text: string;
  wording_metadata: Provenance;
  resolved_insurer: string;
  resolved_plan: string;
  resolved_wording_year: number;
  confidence: number;
  fallback_used: boolean;
}

export enum WordingFailureCode {
  INSURER_NOT_FOUND = "INSURER_NOT_FOUND",
  PLAN_NOT_FOUND = "PLAN_NOT_FOUND",
  WORDING_VERSION_UNRESOLVABLE = "WORDING_VERSION_UNRESOLVABLE",
  SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE",
  CHECKSUM_MISMATCH = "CHECKSUM_MISMATCH"
}

// --- Fetcher Class ---

export class PolicyWordingsFetcher {
  private static readonly KB_PATH = path.join(process.cwd(), 'server', 'knowledge_base');

  /**
   * Main Entry Point: Deterministic Fetch
   */
  public async getPolicyWordings(
    insurer_raw: string,
    plan_raw: string,
    policy_issue_date: string,
    language: "en" | "hi" = "en",
    force_refresh: boolean = false
  ): Promise<PolicyWordingsResult> {

    // 1. Normalization
    const insurer = this.normalizeInsurer(insurer_raw);
    if (!insurer) throw this.createError(WordingFailureCode.INSURER_NOT_FOUND, `Unknown insurer: ${insurer_raw}`);

    const plan = this.normalizePlan(plan_raw);
    if (!plan) throw this.createError(WordingFailureCode.PLAN_NOT_FOUND, `Unknown plan: ${plan_raw}`);

    const versionYear = this.resolveWordingYear(policy_issue_date);
    if (!versionYear) throw this.createError(WordingFailureCode.WORDING_VERSION_UNRESOLVABLE, `Invalid date: ${policy_issue_date}`);

    console.log(`[Fetcher] Looking for: ${insurer} | ${plan} | ${versionYear}`);

    // 2. Strict Lookup Order

    // Attempt 1: Internal Knowledge Base
    const kbResult = await this.fetchFromInternalKB(insurer, plan, versionYear);
    if (kbResult) return kbResult;

    // Attempt 2: Insurer Website (Mocked for now as external call)
    // In a real system, this would trigger a scraper or API call
    // const insurerSiteResult = await this.fetchFromInsurerSite(insurer, plan, versionYear);
    // if (insurerSiteResult) return insurerSiteResult;

    // Attempt 3: IRDAI Repository (Mocked)
    // const irdaiResult = await this.fetchFromIRDAI(insurer, plan, versionYear);
    // if (irdaiResult) return irdaiResult;

    // Attempt 4: Fallback (Strict Flagging)
    return this.generateFallback(insurer, plan, versionYear);
  }

  // --- Normalization Logic ---

  private normalizeInsurer(raw: string): string | null {
    const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '_');
    // Direct match
    if ((insurerMap as any)[key]) return (insurerMap as any)[key];

    // Fuzzy/Partial match logic can go here (omitted for strictness)
    // For now, iterate keys to find substring match if needed, or strict reject
    for (const [k, v] of Object.entries(insurerMap)) {
      if (key.includes(k) || k.includes(key)) return v as string;
    }
    return null;
  }

  private normalizePlan(raw: string): string | null {
    const key = raw.toLowerCase();
    for (const [groupKey, data] of Object.entries(planAliases)) {
      // Check canonical
      if (data.canonical.toLowerCase() === key) return data.canonical;
      // Check aliases
      if (data.aliases.some(alias => key.includes(alias))) return data.canonical;
    }
    return null;
  }

  private resolveWordingYear(issueDate: string): number | null {
    try {
      const date = new Date(issueDate);
      if (isNaN(date.getTime())) return null;
      // Logic: If policy issued in 2024, use 2024 wordings. 
      // Refined logic: If issued before April 1st, might use previous fiscal year, 
      // but usually wording revisions are specific dates.
      // For this spec, we return the calendar year.
      return date.getFullYear();
    } catch {
      return null;
    }
  }

  // --- Fetch Implementation ---

  private async fetchFromInternalKB(insurer: string, plan: string, year: number): Promise<PolicyWordingsResult | null> {
    // Filename convention: Insurer_Plan_Year.txt (sanitized)
    const safeInsurer = insurer.replace(/[^a-zA-Z0-9]/g, '');
    const safePlan = plan.replace(/[^a-zA-Z0-9]/g, '');
    const filename = `${safeInsurer}_${safePlan}_${year}.txt`;
    const filePath = path.join(PolicyWordingsFetcher.KB_PATH, filename);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const checksum = this.calculateChecksum(content);

      return {
        wording_text: content,
        wording_metadata: {
          source: 'internal_kb',
          source_url: `file://${filename}`,
          retrieved_at: new Date().toISOString(),
          checksum: checksum,
          confidence: 1.0 // High confidence for internal verified KB
        },
        resolved_insurer: insurer,
        resolved_plan: plan,
        resolved_wording_year: year,
        confidence: 1.0,
        fallback_used: false
      };
    }
    return null;
  }

  private generateFallback(insurer: string, plan: string, year: number): PolicyWordingsResult {
    // Explicit Fallback Logic
    // We might return a generic wording or fail depending on strictness.
    // The prompt requires explicit fallback flag.

    const fallbackText = "OFFICIAL POLICY WORDINGS NOT FOUND. ANALYSIS BASED SOLELY ON USER EVIDENCE AND GENERIC INSURANCE PRINCIPLES.";
    const checksum = this.calculateChecksum(fallbackText);

    return {
      wording_text: fallbackText,
      wording_metadata: {
        source: 'fallback',
        source_url: 'none',
        retrieved_at: new Date().toISOString(),
        checksum: checksum,
        confidence: 0.1
      },
      resolved_insurer: insurer,
      resolved_plan: plan,
      resolved_wording_year: year,
      confidence: 0.1, // Degraded confidence
      fallback_used: true
    };
  }

  // --- Helpers ---

  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private createError(code: WordingFailureCode, message: string): Error {
    const error = new Error(message);
    (error as any).code = code;
    return error;
  }
}

// Singleton export
export const policyFetcher = new PolicyWordingsFetcher();

// --- Named Exports for Routes (Bridge) ---

export async function extractPolicyMetadata(text: string): Promise<{ insurer: string | null, product: string | null, plan: string | null, year: string | number | null }> {
  // Simple regex-based extraction for deterministic metadata
  const textLower = text.toLowerCase();

  // 1. Extract Insurer
  let insurer = null;
  for (const [key, val] of Object.entries(insurerMap)) {
    if (textLower.includes(key.replace(/_/g, ' ')) || textLower.includes(val.toLowerCase())) {
      insurer = val;
      break;
    }
  }

  // 2. Extract Plan
  let plan = null;
  for (const [key, val] of Object.entries(planAliases)) {
    if (val.aliases.some(alias => textLower.includes(alias))) {
      plan = val.canonical;
      break;
    }
  }

  // 3. Extract Year (heuristics for policy period)
  // Look for 4 digits around "Period" or "Date"
  const yearMatch = text.match(/(?:202[0-9])/); // Simple 2020-2029 filter for now
  const year = yearMatch ? yearMatch[0] : new Date().getFullYear();

  return {
    insurer,
    product: plan, // Mapping plan to product for route compatibility
    plan,
    year
  };
}

export async function fetchPolicyWordings(insurer: string, product: string, plan: string, year: string | number): Promise<string | null> {
  // Adapter: resolving arguments to match getPolicyWordings
  // product/plan might be redundant, taking plan as primary
  try {
    const result = await policyFetcher.getPolicyWordings(
      insurer || "",
      plan || product || "",
      String(year),
      "en",
      false
    );
    return result.wording_text;
  } catch (e) {
    console.warn("Wordings fetch failed:", e);
    return null; // Route expects null on failure to proceed with just uploaded text
  }
}

export function mergePolicyTexts(uploadedText: string, wordingsText: string | null): string {
  if (!wordingsText) return uploadedText;
  return `${uploadedText}\n\n--- OFFICIAL POLICY WORDINGS ---\n\n${wordingsText}`;
}
