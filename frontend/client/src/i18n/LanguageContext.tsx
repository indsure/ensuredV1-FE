import { createContext, useContext, useState, ReactNode } from "react";
import { Locale, SUPPORTED_LANGUAGES, getTranslator, getSavedLocale } from "./index";

type LanguageContextType = {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getSavedLocale);

  function setLocale(next: Locale) {
    localStorage.setItem("indsure_lang", next);
    setLocaleState(next);
  }

  return (
    <LanguageContext.Provider value={{ locale, t: getTranslator(locale), setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export function LanguageToggle({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { locale, setLocale } = useLanguage();
  return (
    <div className={`flex items-center gap-1 rounded-full px-1 py-1 ${variant === "dark" ? "border border-white/10 bg-white/5" : "border border-slate-200 bg-white shadow-sm"}`}>
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLocale(lang.code)}
          className={`min-h-11 sm:min-h-9 px-3 sm:px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${
            locale === lang.code
              ? "bg-[#0D9488] text-white shadow"
              : variant === "dark"
              ? "text-white/50 hover:text-white"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
