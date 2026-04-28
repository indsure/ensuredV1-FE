import { getApiBase } from "./queryClient";
import { supabase } from "./supabase";

export async function apiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const base = getApiBase();
  const url = `${base}${path}`;
  
  // Get the current session token
  const { data: { session } } = await supabase.auth.getSession();
  
  // Merge headers with authentication token
  const headers = new Headers(options?.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

