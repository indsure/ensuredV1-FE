/**
 * Base URL for API requests.
 * - In development with Vite proxy: leave unset so /api goes to proxy (localhost:5000).
 * - On Vercel: set VITE_API_URL in project env to your backend URL (e.g. https://api.yourdomain.com).
 */
export function getApiBase(): string {
  return import.meta.env.VITE_API_URL ?? "";
}
