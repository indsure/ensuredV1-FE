import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { AI_CONFIG, RAG_CONFIG } from "../config";

export type EmbeddingTaskType = TaskType.RETRIEVAL_DOCUMENT | TaskType.RETRIEVAL_QUERY;

export { TaskType };

export class EmbeddingService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Embed a single text. Uses asymmetric task types:
   * - RETRIEVAL_DOCUMENT for ingestion/indexing
   * - RETRIEVAL_QUERY for search queries
   */
  async embedText(
    text: string,
    taskType: EmbeddingTaskType = TaskType.RETRIEVAL_DOCUMENT
  ): Promise<number[]> {
    return this.embedWithRetry(text, taskType, RAG_CONFIG.embedding.maxRetries);
  }

  /**
   * Batch embedding — handles rate limiting internally.
   * Gemini supports up to 100 texts per batch call.
   */
  async embedBatch(
    texts: string[],
    taskType: EmbeddingTaskType = TaskType.RETRIEVAL_DOCUMENT,
    batchSize: number = RAG_CONFIG.embedding.batchSize
  ): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);

      console.log(
        `[Embedding] Processing batch ${batchNum}/${totalBatches} (${batch.length} texts)`
      );

      const batchResults = await this.embedBatchInternal(batch, taskType);
      results.push(...batchResults);

      // Rate limit delay between batches
      if (i + batchSize < texts.length) {
        await sleep(RAG_CONFIG.embedding.rateLimitDelayMs);
      }
    }

    return results;
  }

  private async embedBatchInternal(
    texts: string[],
    taskType: EmbeddingTaskType
  ): Promise<number[][]> {
    const model = this.genAI.getGenerativeModel({
      model: AI_CONFIG.embedding_model,
    });

    try {
      const result = await model.batchEmbedContents({
        requests: texts.map((text) => ({
          content: { role: "user", parts: [{ text }] },
          taskType,
        })),
      });

      return result.embeddings.map((e) => e.values);
    } catch (error: any) {
      // If batch fails, fall back to individual calls
      console.warn(
        `[Embedding] Batch call failed, falling back to individual: ${error.message}`
      );
      const results: number[][] = [];
      for (const text of texts) {
        const embedding = await this.embedWithRetry(text, taskType);
        results.push(embedding);
        await sleep(50);
      }
      return results;
    }
  }

  private async embedWithRetry(
    text: string,
    taskType: EmbeddingTaskType,
    retries: number = RAG_CONFIG.embedding.maxRetries
  ): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({
      model: AI_CONFIG.embedding_model,
    });

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await model.embedContent({
          content: { role: "user", parts: [{ text }] },
          taskType,
        });
        return result.embedding.values;
      } catch (error: any) {
        if (attempt === retries) {
          throw new Error(
            `Embedding failed after ${retries + 1} attempts: ${error.message}`
          );
        }
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(
          `[Embedding] Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${error.message}`
        );
        await sleep(delay);
      }
    }

    throw new Error("Unreachable");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Singleton instance
let _instance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!_instance) {
    _instance = new EmbeddingService();
  }
  return _instance;
}
