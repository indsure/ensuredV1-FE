import { AlertCircle } from "lucide-react";

/**
 * Shared bits for the auth forms (/signup, /login).
 *
 * Both pages previously collected everything, then reported the first problem in
 * a single banner at the bottom of the form. On a phone that means the message
 * about your mobile number can sit two thumb-scrolls below the field it is
 * talking about. These put the error against the field and mark what is
 * required, which is most of the difference for our audience — largely 40+ and
 * filling this in on a handset.
 */

export function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-[var(--color-navy-900)]">
      {children}
      {required && (
        <>
          {/* Red, but never the ONLY signal — colour alone fails anyone who
              cannot distinguish it, and the input carries aria-required too. */}
          <span aria-hidden="true" className="text-red-500 ml-0.5 font-bold">*</span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-1.5 text-[13px] font-medium text-red-600 pl-0.5"
    >
      <AlertCircle className="w-3.5 h-3.5 mt-[1px] shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

/**
 * Border/fill treatment for an input that failed validation.
 *
 * Pair this with `text-base` (16px) on the input, as both auth pages do. Under
 * 16px, iOS Safari zooms the page the instant the field takes focus — the form
 * lurches sideways mid-typing, and the person has to pinch back out. The inputs
 * were 14px. 16px also just reads better for an audience mostly over 40.
 */
export function inputStateClass(hasError?: boolean): string {
  return hasError
    ? "border-red-400 bg-red-50/40 focus:border-red-500"
    : "border-[var(--color-border-light)] bg-[var(--color-cream-main)] focus:border-[var(--color-teal-600)] focus:bg-white";
}

/** Legend for the asterisk, so the mark is explained rather than assumed. */
export function RequiredLegend() {
  return (
    <p className="text-xs text-[var(--color-text-muted)]">
      <span aria-hidden="true" className="text-red-500 font-bold">*</span> All fields are required
    </p>
  );
}
