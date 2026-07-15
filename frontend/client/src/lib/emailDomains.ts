// Consumer signup is restricted to PERSONAL email providers — no business /
// Google-Workspace / custom company domains (those belong on the agent portal).
// You can't distinguish a Workspace domain from any other custom domain by the
// address alone, so we allow-list the known consumer providers and reject
// everything else.
//
// KEEP IN SYNC with backend/server/lib/personalEmail.ts

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

/** Normalise and pull the domain part of an email. */
export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] || "";
}

/** True only for known personal/consumer providers. Custom/company domains → false. */
export function isPersonalEmail(email: string): boolean {
  const domain = emailDomain(email);
  return domain.length > 0 && PERSONAL_EMAIL_DOMAINS.has(domain);
}
