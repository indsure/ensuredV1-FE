import postgres from "postgres";
import { RAG_CONFIG, AI_CONFIG } from "../config";
import { getEmbeddingService, TaskType } from "./embedding.service";
import type { UserProfile } from "../types/userProfile";

// --- Types ---

export interface RetrievedChunk {
  id: number;
  chunkText: string;
  sectionTitle: string | null;
  charCount: number;
  score: number;
  sourceType: string;
  sourceFile: string;
}

export interface RetrievedHospitalContext {
  mode: "structured" | "semantic" | "combined";
  hospitalCount: number;
  topHospitals: string[];
  coverageDensity: string;
  summaryText?: string;
  score?: number;
  pincodes: string[];
}

export interface RAGProvenance {
  chunkId: number;
  sourceType: "user_upload" | "kb_manual" | "kb_user_upload" | "fallback";
  score: number;
  sectionTitle: string | null;
  confidence: number;
  conflictDetected: boolean;
}

export interface AssembledRAGContext {
  contextText: string;
  provenance: RAGProvenance[];
  hospitalContext: RetrievedHospitalContext | null;
  profileContext: string | null;
  kbCoverage: "high" | "low" | "none";
  chunksUsed: number;
}

// --- Service ---

export class RAGService {
  private sql: ReturnType<typeof postgres> | null = null;

  private getConnection(): ReturnType<typeof postgres> {
    if (!this.sql) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("DATABASE_URL is not set");
      }
      this.sql = postgres(connectionString, { max: 5 });
    }
    return this.sql;
  }

  /**
   * Retrieve relevant policy wording chunks.
   * Strategy: metadata filter (insurer+plan) + vector similarity.
   */
  async retrievePolicyContext(params: {
    insurer: string;
    plan: string;
    year?: number;
    queryText: string;
    topK?: number;
    scoreThreshold?: number;
  }): Promise<RetrievedChunk[]> {
    const topK = params.topK ?? RAG_CONFIG.policy.topK;
    const threshold = params.scoreThreshold ?? RAG_CONFIG.policy.scoreThreshold;

    const embeddingService = getEmbeddingService();
    const queryEmbedding = await embeddingService.embedText(
      params.queryText,
      TaskType.RETRIEVAL_QUERY
    );
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    const sql = this.getConnection();

    const results = await sql`
      SELECT
        id, chunk_text, section_title, char_count, source_type, source_file,
        1 - (embedding <=> ${embeddingStr}::vector) AS score
      FROM policy_wording_chunks
      WHERE insurer = ${params.insurer}
        AND plan = ${params.plan}
        ${params.year ? sql`AND year = ${params.year}` : sql``}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `;

    return results
      .filter((r: any) => r.score >= threshold)
      .map((r: any) => ({
        id: r.id,
        chunkText: r.chunk_text,
        sectionTitle: r.section_title,
        charCount: r.char_count,
        score: parseFloat(r.score),
        sourceType: r.source_type,
        sourceFile: r.source_file,
      }));
  }

  /**
   * Retrieve ALL KB chunks for an insurer+plan (for full analysis, not query-specific).
   */
  async retrieveAllPolicyChunks(params: {
    insurer: string;
    plan: string;
    year?: number;
    maxChars?: number;
  }): Promise<RetrievedChunk[]> {
    const maxChars = params.maxChars ?? 30000;
    const sql = this.getConnection();

    const results = await sql`
      SELECT id, chunk_text, section_title, char_count, source_type, source_file
      FROM policy_wording_chunks
      WHERE insurer = ${params.insurer}
        AND plan = ${params.plan}
        ${params.year ? sql`AND year = ${params.year}` : sql``}
      ORDER BY chunk_index ASC
    `;

    // Enforce char budget
    let totalChars = 0;
    const chunks: RetrievedChunk[] = [];
    for (const r of results) {
      if (totalChars + (r.char_count as number) > maxChars) break;
      totalChars += r.char_count as number;
      chunks.push({
        id: r.id as number,
        chunkText: r.chunk_text as string,
        sectionTitle: r.section_title as string | null,
        charCount: r.char_count as number,
        score: 1.0,
        sourceType: r.source_type as string,
        sourceFile: r.source_file as string,
      });
    }

    return chunks;
  }

  /**
   * Retrieve hospital network context.
   * Mode A: structured (city/state/pincode) -> SQL on hospitals table
   * Mode B: semantic (natural language) -> vector search on embeddings
   */
  async retrieveHospitalContext(params: {
    insurer?: string;
    city?: string;
    state?: string;
    pincode?: string;
    queryText?: string;
    topK?: number;
  }): Promise<RetrievedHospitalContext | null> {
    const sql = this.getConnection();
    const topK = params.topK ?? RAG_CONFIG.hospital.topK;

    // Semantic search mode
    if (params.queryText) {
      const embeddingService = getEmbeddingService();
      const queryEmbedding = await embeddingService.embedText(
        params.queryText,
        TaskType.RETRIEVAL_QUERY
      );
      const embeddingStr = `[${queryEmbedding.join(",")}]`;

      let results;
      if (params.insurer) {
        results = await sql`
          SELECT *, 1 - (embedding <=> ${embeddingStr}::vector) AS score
          FROM hospital_network_embeddings
          WHERE insurer_slug = ${params.insurer}
          ORDER BY embedding <=> ${embeddingStr}::vector
          LIMIT ${topK}
        `;
      } else {
        results = await sql`
          SELECT *, 1 - (embedding <=> ${embeddingStr}::vector) AS score
          FROM hospital_network_embeddings
          ORDER BY embedding <=> ${embeddingStr}::vector
          LIMIT ${topK}
        `;
      }

      if (results.length === 0) return null;

      const top = results[0];
      return {
        mode: "semantic",
        hospitalCount: top.hospital_count as number,
        topHospitals: (top.top_hospitals as string[]) || [],
        coverageDensity: deriveDensity(top.hospital_count as number),
        summaryText: top.summary_text as string,
        score: parseFloat(top.score as string),
        pincodes: (top.pincodes as string[]) || [],
      };
    }

    // Structured query mode
    if (params.city || params.state || params.pincode) {
      const conditions: any[] = [];

      let query = sql`
        SELECT insurer_slug, city, state,
               COUNT(*)::int as hospital_count,
               ARRAY_AGG(hospital_name ORDER BY quality_score DESC LIMIT 5) as top_hospitals,
               ARRAY_AGG(DISTINCT pincode) FILTER (WHERE pincode IS NOT NULL) as pincodes
        FROM hospitals
        WHERE quality_score >= 0.5
      `;

      if (params.insurer) {
        query = sql`
          SELECT insurer_slug, city, state,
                 COUNT(*)::int as hospital_count,
                 ARRAY_AGG(hospital_name ORDER BY quality_score DESC) as top_hospitals,
                 ARRAY_AGG(DISTINCT pincode) FILTER (WHERE pincode IS NOT NULL) as pincodes
          FROM hospitals
          WHERE quality_score >= 0.5 AND insurer_slug = ${params.insurer}
          ${params.city ? sql`AND city ILIKE ${params.city}` : sql``}
          ${params.state ? sql`AND state ILIKE ${params.state}` : sql``}
          ${params.pincode ? sql`AND pincode = ${params.pincode}` : sql``}
          GROUP BY insurer_slug, city, state
          LIMIT 1
        `;
      } else {
        query = sql`
          SELECT insurer_slug, city, state,
                 COUNT(*)::int as hospital_count,
                 ARRAY_AGG(hospital_name ORDER BY quality_score DESC) as top_hospitals,
                 ARRAY_AGG(DISTINCT pincode) FILTER (WHERE pincode IS NOT NULL) as pincodes
          FROM hospitals
          WHERE quality_score >= 0.5
          ${params.city ? sql`AND city ILIKE ${params.city}` : sql``}
          ${params.state ? sql`AND state ILIKE ${params.state}` : sql``}
          ${params.pincode ? sql`AND pincode = ${params.pincode}` : sql``}
          GROUP BY insurer_slug, city, state
          LIMIT 1
        `;
      }

      const results = await query;
      if (results.length === 0) return null;

      const top = results[0];
      const topNames = ((top.top_hospitals as string[]) || []).slice(0, 5);

      return {
        mode: "structured",
        hospitalCount: top.hospital_count as number,
        topHospitals: topNames,
        coverageDensity: deriveDensity(top.hospital_count as number),
        pincodes: ((top.pincodes as string[]) || []).filter(Boolean),
      };
    }

    return null;
  }

  /**
   * Full context assembly for AI calls.
   * Combines retrieved chunks + user profile + manages token budget.
   */
  async assembleContext(params: {
    uploadedPolicyText: string;
    insurer: string;
    plan: string;
    year?: number;
    userProfile?: UserProfile;
    queryType: "analyze" | "chat";
    chatQuery?: string;
  }): Promise<AssembledRAGContext> {
    let chunks: RetrievedChunk[] = [];
    let kbCoverage: "high" | "low" | "none" = "none";

    try {
      if (params.queryType === "analyze") {
        // For analysis: retrieve ALL chunks for insurer+plan (document order)
        chunks = await this.retrieveAllPolicyChunks({
          insurer: params.insurer,
          plan: params.plan,
          year: params.year,
          maxChars: 30000,
        });
      } else if (params.chatQuery) {
        // For chat: retrieve query-specific chunks
        chunks = await this.retrievePolicyContext({
          insurer: params.insurer,
          plan: params.plan,
          year: params.year,
          queryText: params.chatQuery,
          topK: 5,
        });
      }
    } catch (err) {
      console.warn("[RAG] Chunk retrieval failed, using uploaded text only:", (err as Error).message);
    }

    const totalChunkChars = chunks.reduce((sum, c) => sum + c.charCount, 0);
    if (totalChunkChars >= 5000) kbCoverage = "high";
    else if (totalChunkChars > 0) kbCoverage = "low";

    // Build provenance
    const provenance: RAGProvenance[] = chunks.map((c) => ({
      chunkId: c.id,
      sourceType: c.sourceType as RAGProvenance["sourceType"],
      score: c.score,
      sectionTitle: c.sectionTitle,
      confidence: c.score >= 0.7 ? 0.9 : c.score >= 0.5 ? 0.7 : 0.5,
      conflictDetected: false,
    }));

    // Retrieve hospital context if user has location info
    let hospitalContext: RetrievedHospitalContext | null = null;
    if (params.userProfile?.city || params.userProfile?.pincode) {
      try {
        hospitalContext = await this.retrieveHospitalContext({
          city: params.userProfile.city,
          state: params.userProfile.state,
          pincode: params.userProfile.pincode,
        });
      } catch (err) {
        console.warn("[RAG] Hospital retrieval failed:", (err as Error).message);
      }
    }

    // Build profile context string
    let profileContext: string | null = null;
    if (params.userProfile) {
      // Defer to PersonalizationService if available
      try {
        const { PersonalizationService } = await import("./personalization.service");
        profileContext = PersonalizationService.generateProfileContext(params.userProfile);
      } catch {
        // Minimal fallback
        const p = params.userProfile;
        const parts = [];
        if (p.age) parts.push(`Age: ${p.age}`);
        if (p.city) parts.push(`City: ${p.city}`);
        if (p.familySize) parts.push(`Family size: ${p.familySize}`);
        if (p.preExistingConditions?.length)
          parts.push(`Pre-existing conditions: ${p.preExistingConditions.join(", ")}`);
        profileContext = parts.length > 0 ? `USER PROFILE:\n${parts.join(" | ")}` : null;
      }
    }

    // Assemble context text
    const contextParts: string[] = [];

    // User evidence (uploaded policy text) — truncated to budget
    const evidenceBudget = AI_CONFIG.token_budget.user_evidence * 4; // chars
    const truncatedEvidence =
      params.uploadedPolicyText.length > evidenceBudget
        ? params.uploadedPolicyText.slice(0, evidenceBudget) +
          "\n...[TRUNCATED_DUE_TO_TOKEN_BUDGET]..."
        : params.uploadedPolicyText;

    contextParts.push("[USER_EVIDENCE]\n" + truncatedEvidence);

    // Retrieved KB chunks
    if (chunks.length > 0) {
      const chunkTexts = chunks.map((c, i) => {
        const header = c.sectionTitle ? `[Source: ${c.sectionTitle}, Score: ${c.score.toFixed(2)}]` : `[Chunk ${i + 1}, Score: ${c.score.toFixed(2)}]`;
        return `${header}\n${c.chunkText}`;
      });

      contextParts.push(
        "[RETRIEVED_POLICY_WORDINGS]\n" + chunkTexts.join("\n\n")
      );
    } else {
      contextParts.push(
        "[RETRIEVED_POLICY_WORDINGS]\nOfficial policy wordings not available in our database. Analysis based solely on uploaded document."
      );
    }

    // User profile
    if (profileContext) {
      contextParts.push("[USER_PROFILE]\n" + profileContext);
    }

    // Hospital context
    if (hospitalContext) {
      const hospitalText = [
        `Hospital network: ${hospitalContext.hospitalCount} hospitals`,
        `Coverage density: ${hospitalContext.coverageDensity}`,
        hospitalContext.topHospitals.length > 0
          ? `Key hospitals: ${hospitalContext.topHospitals.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      contextParts.push("[HOSPITAL_CONTEXT]\n" + hospitalText);
    }

    return {
      contextText: contextParts.join("\n\n"),
      provenance,
      hospitalContext,
      profileContext,
      kbCoverage,
      chunksUsed: chunks.length,
    };
  }
}

function deriveDensity(count: number): string {
  if (count >= 50) return "Excellent coverage";
  if (count >= 20) return "Good coverage";
  if (count >= 5) return "Moderate coverage";
  return "Limited coverage";
}

// Singleton
let _instance: RAGService | null = null;

export function getRAGService(): RAGService {
  if (!_instance) {
    _instance = new RAGService();
  }
  return _instance;
}
