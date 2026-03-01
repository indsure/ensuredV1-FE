import type { ApiMetadata, DataSource } from "../types/api-response";

let requestCounter = 0;

export function generateRequestId(): string {
  return `req-${Date.now()}-${(++requestCounter).toString(36)}`;
}

export function wrapSuccess<T>(
  data: T,
  options?: {
    requestId?: string;
    dataSources?: DataSource[];
    modelUsed?: string;
    ragChunksUsed?: number;
    processingTimeMs?: number;
  }
) {
  const metadata: ApiMetadata = {
    request_id: options?.requestId || generateRequestId(),
    timestamp: new Date().toISOString(),
    processing_time_ms: options?.processingTimeMs,
    data_sources: options?.dataSources,
    model_used: options?.modelUsed,
    rag_chunks_used: options?.ragChunksUsed,
    cache_hit: false,
  };

  return {
    success: true as const,
    data,
    metadata,
  };
}

export function wrapError(
  code: "VALIDATION_ERROR" | "AI_ERROR" | "NOT_FOUND" | "INTERNAL",
  message: string,
  details?: any,
  requestId?: string
) {
  return {
    success: false as const,
    error: {
      code,
      message,
      details,
    },
    metadata: {
      request_id: requestId || generateRequestId(),
      timestamp: new Date().toISOString(),
    },
  };
}
