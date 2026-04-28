/**
 * API Client for IndSure Backend
 */

import type {
  UploadResponse,
  CompareResponse,
  UserProfile,
  GlossaryTerm,
  EducationalFact,
  Insurer,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new APIError(
        error.error || error.message || 'API request failed',
        response.status,
        error.details
      );
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(
      error instanceof Error ? error.message : 'Network error',
      0
    );
  }
}

// Upload PDFs
export async function uploadPolicies(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  
  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new APIError(
      error.error || 'Upload failed',
      response.status,
      error.details
    );
  }
  
  return response.json();
}

// Compare policies
export async function comparePolicies(
  sessionId: string,
  userProfile: UserProfile
): Promise<CompareResponse> {
  return fetchAPI<CompareResponse>('/api/compare', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      user_profile: userProfile,
      scoring_profile_id: userProfile.scoring_profile_id,
    }),
  });
}

// Rescore with custom weights
export async function rescorePolicies(
  sessionId: string,
  userProfile: UserProfile,
  customWeights: Record<string, number>
): Promise<CompareResponse> {
  return fetchAPI<CompareResponse>('/api/rescore', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      user_profile: userProfile,
      custom_weights: customWeights,
    }),
  });
}

// Delete session
export async function deleteSession(sessionId: string): Promise<void> {
  await fetchAPI(`/api/session/${sessionId}`, {
    method: 'DELETE',
  });
}

// Get insurer details
export async function getInsurer(insurerId: string): Promise<{
  insurer: Insurer;
  metrics: any[];
}> {
  return fetchAPI(`/api/insurer/${insurerId}`);
}

// Get glossary
export async function getGlossary(): Promise<{ terms: GlossaryTerm[] }> {
  return fetchAPI('/api/glossary');
}

// Get educational facts
export async function getFacts(): Promise<{ facts: EducationalFact[] }> {
  return fetchAPI('/api/facts');
}

// Get data freshness
export async function getDataFreshness(): Promise<any> {
  return fetchAPI('/api/data-freshness');
}

export { APIError };
