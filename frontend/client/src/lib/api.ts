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


/**
 * apiFetch resolves for 4xx and 5xx exactly like fetch does: it only rejects on
 * a network failure. So `try { await apiFetch(...) } catch { ... }` is a trap.
 * The catch cannot fire for a server error, and the code after it runs as though
 * the request succeeded. That shipped in seven places, including a rename that
 * reported success while saving nothing and a share link that came out as
 * /report/undefined.
 *
 * Use these instead of reading `.ok` by hand at each call site, so the check
 * cannot be forgotten:
 *
 *   await apiOk(apiFetch(path, init))            // when you only need success
 *   const data = await apiJson<T>(apiFetch(...)) // when you need the body
 *
 * Both throw an Error carrying the server's own message where it sent one,
 * which is what a toast should show the user.
 */
async function errorFrom(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null as any);
  const msg = body?.message || body?.error;
  return new Error(msg || `Request failed (${res.status})`);
}

export async function apiOk(p: Promise<Response> | Response): Promise<Response> {
  const res = await p;
  if (!res.ok) throw await errorFrom(res);
  return res;
}

export async function apiJson<T>(p: Promise<Response> | Response): Promise<T> {
  const res = await p;
  // Read the body once: a Response body cannot be consumed twice, so the error
  // path has to parse from the same read.
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) throw new Error(body?.message || body?.error || `Request failed (${res.status})`);
  return body as T;
}
