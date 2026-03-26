import { getApiBase } from "./queryClient";

export async function apiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const base = getApiBase();
  const url = `${base}${path}`;
  return fetch(url, options);
}

