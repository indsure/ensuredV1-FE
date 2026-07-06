import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";

// Attach the Supabase bearer token the same way apiFetch (lib/api.ts) does.
// The backend authenticates via Authorization: Bearer <token>, not cookies.
async function withAuthHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return headers;
}

// Production backend origin. Used as a fallback so a missing VITE_API_URL on
// the host can't silently route /api/* to the static SPA (which returns HTML/405
// and breaks signup). Override per-environment with VITE_API_URL when needed.
const DEFAULT_PROD_API_BASE = "https://api.indsure.in";

export function getApiBase(): string {
  const explicit = import.meta.env.VITE_API_URL;
  if (explicit) return explicit;
  // Dev relies on Vite's /api proxy (see vite.config.ts) → keep the base empty.
  // Production has no proxy, so fall back to the real backend instead of "".
  return import.meta.env.PROD ? DEFAULT_PROD_API_BASE : "";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers = await withAuthHeaders(
    data ? { "Content-Type": "application/json" } : undefined,
  );

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = await withAuthHeaders();
    const res = await fetch(queryKey.join("/") as string, {
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
