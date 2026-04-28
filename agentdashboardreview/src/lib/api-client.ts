/**
 * API Client for Agent Dashboard
 * Centralized API communication layer
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.error || 'An error occurred',
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error', 0, error);
  }
}

// Dashboard API
export const dashboardApi = {
  getMetrics: () => fetchApi<{
    totalPolicies: number;
    activeAgents: number;
    pendingQueue: number;
    successRate: number;
  }>('/dashboard/metrics'),

  getRecentFailures: () => fetchApi<Array<{
    id: string;
    policyId: string;
    error: string;
    timestamp: string;
  }>>('/dashboard/failures'),

  getHighRiskItems: () => fetchApi<Array<{
    id: string;
    policyId: string;
    score: number;
    timestamp: string;
  }>>('/dashboard/high-risk'),
};

// Policies API
export const policiesApi = {
  getAll: (params?: { insurer?: string; status?: string }) => 
    fetchApi<{ data: Array<{
      id: string;
      insurer: string;
      assignedTo: string;
      status: string;
      createdAt: string;
    }> }>(`/policies${params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''}`),

  getById: (id: string) => fetchApi<{
    id: string;
    policyNumber: string;
    client: string;
    insurer: string;
    product: string;
    status: string;
    assignedTo: string;
    createdAt: string;
    updatedAt: string;
  }>(`/policies/${id}`),

  create: (data: Record<string, unknown>) => fetchApi('/policies', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: Record<string, unknown>) => fetchApi(`/policies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// Queue API
export const queueApi = {
  getMyQueue: () => fetchApi<{ data: Array<{
    id: string;
    policyNumber: string;
    client: string;
    status: string;
    priority: string;
    addedAt: string;
  }> }>('/queue/my-queue'),

  assignToMe: (policyId: string) => fetchApi(`/queue/assign/${policyId}`, {
    method: 'POST',
  }),
};

// Reports API
export const reportsApi = {
  getAll: () => fetchApi<{ data: Array<{
    id: string;
    policyId: string;
    status: string;
    score: number;
    createdAt: string;
  }> }>('/reports'),

  getById: (id: string) => fetchApi<{
    id: string;
    policyId: string;
    status: string;
    score: number;
    flawsCount: number;
    summary: string;
    reportMarkdown: string;
    createdAt: string;
  }>(`/reports/${id}`),
};

// Agents API
export const agentsApi = {
  getAll: () => fetchApi<{ data: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    assignedPolicies: number;
  }> }>('/agents'),

  getById: (id: string) => fetchApi<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    assignedPolicies: number;
    completedPolicies: number;
    averageScore: number;
  }>(`/agents/${id}`),

  update: (id: string, data: Record<string, unknown>) => fetchApi(`/agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// Errors API
export const errorsApi = {
  getAll: (params?: { severity?: string; status?: string }) => 
    fetchApi<{ data: Array<{
      id: string;
      policyId: string;
      errorType: string;
      severity: string;
      message: string;
      status: string;
      timestamp: string;
    }> }>(`/errors${params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''}`),

  retry: (errorId: string) => fetchApi(`/errors/${errorId}/retry`, {
    method: 'POST',
  }),

  resolve: (errorId: string) => fetchApi(`/errors/${errorId}/resolve`, {
    method: 'POST',
  }),
};

// Auth API
export const authApi = {
  login: (email: string, password: string) => fetchApi<{
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    token: string;
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  signup: (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    city: string;
    yearsExperience: number;
  }) => fetchApi<{
    success: boolean;
    message: string;
  }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  logout: () => fetchApi('/auth/logout', {
    method: 'POST',
  }),

  getCurrentUser: () => fetchApi<{
    id: string;
    email: string;
    name: string;
    role: string;
  }>('/auth/me'),
};
