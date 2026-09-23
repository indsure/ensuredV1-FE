import en from "./locales/en.json";
import hi from "./locales/hi.json";
import { hi as hiDates } from "date-fns/locale/hi";
import type { Locale as DateLocale } from "date-fns";

export type Locale = "en" | "hi";

export const SUPPORTED_LANGUAGES: { code: Locale; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिंदी" },
];

const translations: Record<Locale, Record<string, any>> = { en, hi };

export type TranslateVars = Record<string, string | number>;

// `{{name}}` placeholders are filled from `vars`, so a sentence with a number or
// a name in it is translated as a whole sentence. Hindi word order differs from
// English, so gluing translated fragments around a number reads wrong.
function fill(text: string, vars?: TranslateVars): string {
  if (!vars) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

export function getTranslator(locale: Locale) {
  return function t(key: string, vars?: TranslateVars): string {
    const parts = key.split(".");
    let val: any = translations[locale];
    for (const part of parts) {
      val = val?.[part];
    }
    // fallback to english
    if (val === undefined) {
      let fallback: any = translations["en"];
      for (const part of parts) fallback = fallback?.[part];
      return fill(fallback ?? key, vars);
    }
    return fill(val, vars);
  };
}

export function getSavedLocale(): Locale {
  // Storage can throw (blocked site data, some private modes). English is the
  // safe answer; the page must still render.
  try {
    return (localStorage.getItem("indsure_lang") === "hi" ? "hi" : "en") as Locale;
  } catch {
    return "en";
  }
}

// date-fns locale for the UI language, so "Monday, 3 March" becomes
// "सोमवार, 3 मार्च" in Hindi. Pass as `format(date, pattern, { locale: dateLocale(locale) })`.
export function dateLocale(locale: Locale): DateLocale | undefined {
  return locale === "hi" ? hiDates : undefined;
}

// Locale tag for Intl / toLocaleDateString, so dates and numbers follow the UI
// language: "03 Mar 2026" in English, "03 मार्च 2026" in Hindi.
export function intlLocale(locale: Locale): string {
  return locale === "hi" ? "hi-IN" : "en-IN";
}

// For keys built from data (a status, a type). `t` echoes an unknown key back,
// so a value we have no string for would render as "common.status_xyz". This
// shows the fallback instead.
export function tOr(t: (key: string) => string, key: string, fallback: string): string {
  const value = t(key);
  return !value || value === key ? fallback : value;
}
