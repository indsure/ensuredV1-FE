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
  retrieved_at: string;
  checksum: string;
  confidence: number;
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
  private static readonly KB_PATH = path.join(process.cwd(), 'src', 'knowledge_base');

  public async getPolicyWordings(
    insurer_raw: string,
    plan_raw: string,
    policy_issue_date: string,
    language: "en" | "hi" = "en",
    force_refresh: boolean = false
  ): Promise<PolicyWordingsResult> {

    const insurer = this.normalizeInsurer(insurer_raw);
    if (!insurer) throw this.createError(WordingFailureCode.INSURER_NOT_FOUND, `Unknown insurer: ${insurer_raw}`);

    const plan = this.normalizePlan(plan_raw);
    if (!plan) throw this.createError(WordingFailureCode.PLAN_NOT_FOUND, `Unknown plan: ${plan_raw}`);

    const versionYear = this.resolveWordingYear(policy_issue_date);
    if (!versionYear) throw this.createError(WordingFailureCode.WORDING_VERSION_UNRESOLVABLE, `Invalid date: ${policy_issue_date}`);

    console.log(`[Fetcher] Looking for: ${insurer} | ${plan} | ${versionYear}`);

    const kbResult = await this.fetchFromInternalKB(insurer, plan, versionYear);
    if (kbResult) return kbResult;

    return this.generateFallback(insurer, plan, versionYear);
  }

  private normalizeInsurer(raw: string): string | null {
    const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if ((insurerMap as any)[key]) return (insurerMap as any)[key];

    for (const [k, v] of Object.entries(insurerMap)) {
      if (key.includes(k) || k.includes(key)) return v as string;
    }
    return null;
  }

  private normalizePlan(raw: string): string | null {
    const key = raw.toLowerCase();
    for (const [groupKey, data] of Object.entries(planAliases)) {
      if (data.canonical.toLowerCase() === key) return data.canonical;
      if (data.aliases.some(alias => key.includes(alias))) return data.canonical;
    }
    return null;
  }

  private resolveWordingYear(issueDate: string): number | null {
    try {
      const date = new Date(issueDate);
      if (isNaN(date.getTime())) return null;
      return date.getFullYear();
    } catch {
      return null;
    }
  }

  private async fetchFromInternalKB(insurer: string, plan: string, year: number): Promise<PolicyWordingsResult | null> {
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
          confidence: 1.0
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
      confidence: 0.1,
      fallback_used: true
    };
  }

  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private createError(code: WordingFailureCode, message: string): Error {
    const error = new Error(message);
    (error as any).code = code;
    return error;
  }
}

export const policyFetcher = new PolicyWordingsFetcher();

// --- Named Exports for Routes (Bridge) ---

export async function extractPolicyMetadata(text: string): Promise<{ insurer: string | null, product: string | null, plan: string | null, year: string | number | null }> {
  const textLower = text.toLowerCase();

  let insurer = null;
  for (const [key, val] of Object.entries(insurerMap)) {
    if (textLower.includes(key.replace(/_/g, ' ')) || textLower.includes(val.toLowerCase())) {
      insurer = val;
      break;
    }
  }

  let plan = null;
  for (const [key, val] of Object.entries(planAliases)) {
    if (val.aliases.some(alias => textLower.includes(alias))) {
      plan = val.canonical;
      break;
    }
  }

  const yearMatch = text.match(/(?:202[0-9])/);
  const year = yearMatch ? yearMatch[0] : new Date().getFullYear();

  return {
    insurer,
    product: plan,
    plan,
    year
  };
}

export async function fetchPolicyWordings(insurer: string, product: string, plan: string, year: string | number): Promise<string | null> {
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
    return null;
  }
}

export function mergePolicyTexts(uploadedText: string, wordingsText: string | null): string {
  if (!wordingsText) return uploadedText;
  return `${uploadedText}\n\n--- OFFICIAL POLICY WORDINGS ---\n\n${wordingsText}`;
}
