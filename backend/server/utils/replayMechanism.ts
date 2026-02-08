import crypto from 'crypto';

interface ReplayResult {
  matches: boolean;
  diffs: string[];
  original_hash: string;
  replay_hash: string;
}

export class ReplayMechanism {

  /**
   * Compares two audit outputs for bit-identical determinism.
   */
  public static verifyReplay(original: any, replay: any): ReplayResult {
    const diffs: string[] = [];

    // 1. Check Identity of Hashes (Quick Fail)
    // We expect the 'prompt_hash' and 'policy_wordings_checksum' to match EXACTLY if inputs were same.
    if (original.prompt_hash !== replay.prompt_hash) diffs.push(`Prompt Hash Mismatch: ${original.prompt_hash} vs ${replay.prompt_hash}`);
    if (original.model_version !== replay.model_version) diffs.push(`Model Version Mismatch: ${original.model_version} vs ${replay.model_version}`);

    // 2. Check Score Determinism
    if (original.audit_ledger.final_score !== replay.audit_ledger.final_score) {
      diffs.push(`Score Divergence: ${original.audit_ledger.final_score} vs ${replay.audit_ledger.final_score}`);
    }

    // 3. Deep Equality Check (excluding 'generated_at' and 'analysis_id' which naturally change)
    const cleanOriginal = this.cleanForComparison(original);
    const cleanReplay = this.cleanForComparison(replay);

    if (JSON.stringify(cleanOriginal) !== JSON.stringify(cleanReplay)) {
      // Find deeper diffs if needed, or just flag it
      diffs.push("Deep Object Divergence (Content differs)");
    }

    return {
      matches: diffs.length === 0,
      diffs,
      original_hash: this.hashObject(cleanOriginal),
      replay_hash: this.hashObject(cleanReplay)
    };
  }

  private static cleanForComparison(obj: any): any {
    const copy = JSON.parse(JSON.stringify(obj));
    // Remove fields that are allowed to change between runs
    delete copy.analysis_id;
    delete copy.generated_at;
    delete copy.job_id; // If present
    return this.sortKeys(copy);
  }

  private static hashObject(obj: any): string {
    return crypto.createHash('sha256').update(JSON.stringify(this.sortKeys(obj))).digest('hex');
  }

  private static sortKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(this.sortKeys.bind(this));
    } else if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).sort().reduce((result: any, key) => {
        result[key] = this.sortKeys(obj[key]);
        return result;
      }, {});
    }
    return obj;
  }
}
