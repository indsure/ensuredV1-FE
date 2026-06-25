import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
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
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
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
