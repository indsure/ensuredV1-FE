export interface DataSource {
  source: "user_upload" | "knowledge_base" | "hospital_db" | "ai_model";
  confidence: number;
  record_count?: number;
}

export interface ApiMetadata {
  request_id: string;
  timestamp: string;
  processing_time_ms?: number;
  data_sources?: DataSource[];
  model_used?: string;
  rag_chunks_used?: number;
  cache_hit?: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  metadata: ApiMetadata;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: "VALIDATION_ERROR" | "AI_ERROR" | "NOT_FOUND" | "INTERNAL";
    message: string;
    details?: any;
    retry_after_ms?: number;
  };
  metadata: Pick<ApiMetadata, "request_id" | "timestamp">;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
