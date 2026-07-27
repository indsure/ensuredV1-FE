/**
 * Single source of truth for the "does this text contain personal identifiers?"
 * guard applied before user text is sent to the model (Sach AI). We reject rather
 * than redact because mixed/partial identifiers slip through redaction and can
 * cause model prompt leakage.
 *
 * NOTE: the frontend keeps its own copy in components/SachAIChat.tsx (different
 * runtime — the two cannot literally share a module). Any change here must be
 * mirrored there, and vice-versa. The regexes below must stay identical.
 */
export function containsPersonalData(text: string): boolean {
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phone = /\b(?:\+?91[\s-]?)?\d{10}\b/;
  const aadhaar = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/; // xxxx-xxxx-xxxx
  const aadhaarPlain = /\b\d{12}\b/;
  const policyLike = /\b(?:policy|pol)\.?\s*(?:no\.?|number|#)?\s*[:\-]?\s*[A-Za-z0-9\/]{5,}\b/i;

  return (
    email.test(text) ||
    phone.test(text) ||
    aadhaar.test(text) ||
    aadhaarPlain.test(text) ||
    policyLike.test(text)
  );
}
