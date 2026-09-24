import { Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { useLanguage } from "@/i18n/LanguageContext";

// The catch-all route. It used to ship developer scaffolding ("Did you forget to
// add the page to the router?") with no header, footer or way back. A visitor who
// lands here followed a broken or mistyped link, so give them the site's own
// navigation plus the three places most people were actually trying to reach.
export default function NotFound() {
  const { t } = useLanguage();
  // The server already answers unknown paths with a 404 status (vercel.json);
  // this covers in-app navigation to a dead link.
  useSEO({
    title: "Page not found | IndSure",
    description: "This page does not exist on IndSure.",
    noindex: true,
  });
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg text-center">
          <p className="text-base font-semibold text-[var(--color-teal-600)]">{t("nf.eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("nf.h")}</h1>
          <p className="mt-4 text-lg text-slate-600">
            {t("nf.sub")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center min-h-[44px] px-6 rounded-full bg-[var(--color-teal-600)] text-white text-base font-semibold hover:opacity-90"
            >
              {t("nf.home")}
            </Link>
            <Link
              href="/agent"
              className="inline-flex items-center justify-center min-h-[44px] px-6 rounded-full border border-slate-300 text-slate-800 text-base font-semibold hover:bg-slate-50"
            >
              {t("nf.advisors")}
            </Link>
            <Link
              href="/help"
              className="inline-flex items-center justify-center min-h-[44px] px-6 rounded-full border border-slate-300 text-slate-800 text-base font-semibold hover:bg-slate-50"
            >
              {t("nf.help")}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
