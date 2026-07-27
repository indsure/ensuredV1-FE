import en from "./locales/en.json";
import hi from "./locales/hi.json";

export type Locale = "en" | "hi";

export const SUPPORTED_LANGUAGES: { code: Locale; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिंदी" },
];

const translations: Record<Locale, Record<string, any>> = { en, hi };

export function getTranslator(locale: Locale) {
  return function t(key: string): string {
    const parts = key.split(".");
    let val: any = translations[locale];
    for (const part of parts) {
      val = val?.[part];
    }
    // fallback to english
    if (val === undefined) {
      let fallback: any = translations["en"];
      for (const part of parts) fallback = fallback?.[part];
      return fallback ?? key;
    }
    return val;
  };
}

export function getSavedLocale(): Locale {
  const saved = localStorage.getItem("indsure_lang");
  return (saved === "hi" ? "hi" : "en") as Locale;
}
