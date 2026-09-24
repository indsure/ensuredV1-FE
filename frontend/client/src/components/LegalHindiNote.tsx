import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Legal pages stay in English on purpose: the English text is the binding one,
 * and a translation nobody has reviewed must not compete with it. In Hindi mode
 * the page says so, in Hindi, above the heading. Renders nothing in English.
 */
export function LegalHindiNote() {
  const { t, locale } = useLanguage();
  if (locale !== "hi") return null;
  return (
    <p lang="hi" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-base leading-relaxed text-amber-900">
      {t("legal.hindi_note")}
    </p>
  );
}
