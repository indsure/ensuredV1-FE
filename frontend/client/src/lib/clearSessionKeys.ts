/**
 * On sign-out, drop what this tab kept for the person who was signed in: a report
 * being looked at, calculator answers, a pending upload, the Sach chat. On a shared
 * phone or family computer the next person would otherwise find them. Language and
 * theme (localStorage) are device preferences and stay.
 */
const PREFIXES = ["indsure_", "IndSure_", "calculator_", "sach_ai_"];

export function clearSessionKeys(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && PREFIXES.some((p) => k.startsWith(p))) doomed.push(k);
    }
    doomed.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    /* storage blocked: nothing was kept either */
  }
}
