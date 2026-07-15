// Consumer accounts are restricted to PERSONAL email providers — no business /
// Google-Workspace / custom company domains. Backend enforcement (in
// /api/me/bootstrap) so a client-side bypass still can't get a usable account.
//
// KEEP IN SYNC with frontend/client/src/lib/emailDomains.ts

export const PERSONAL_EMAIL_DOMAINS = new Set<string>([
  // Google
  "gmail.com", "googlemail.com",
  // Microsoft
  "outlook.com", "outlook.in", "hotmail.com", "hotmail.co.uk", "live.com", "live.in", "msn.com",
  // Yahoo
  "yahoo.com", "yahoo.in", "yahoo.co.in", "ymail.com", "rocketmail.com",
  // Apple
  "icloud.com", "me.com", "mac.com",
  // Proton
  "proton.me", "protonmail.com", "pm.me",
  // India-popular + misc consumer
  "rediffmail.com", "rediff.com", "zoho.com", "zohomail.com",
  "aol.com", "gmx.com", "gmx.net", "mail.com", "yandex.com",
]);

export function emailDomain(email: string): string {
  return (email || "").trim().toLowerCase().split("@")[1] || "";
}

/** True only for known personal/consumer providers. Custom/company domains → false. */
export function isPersonalEmail(email: string): boolean {
  const domain = emailDomain(email);
  return domain.length > 0 && PERSONAL_EMAIL_DOMAINS.has(domain);
}
