import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText, ChevronDown, Shield, CheckCircle2, Info } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { seoFor } from "@/data/seo-pages";
import { PAGE_FAQS } from "@/data/page-faqs";
import { useLanguage } from "@/i18n/LanguageContext";

/*
 * Term policies are read into a summary table and do not get a score. This
 * page used to promise a sum-assured verdict, rider analysis, a calculator for
 * term cover (the link opened the health calculator) and a comparer that
 * "recommends the best unbiased winner" among named insurers. None of that
 * exists, so the page now says only what an upload actually gives, and no
 * longer links to /compare?type=term (that route now shows "coming soon";
 * see docs/plans/2026-10-15-life-mock-prompt.md).
 */

// Analysis requires a free account (D2C hard wall). Dropping a file funnels
// to signup rather than the retired anonymous analyze path.
function TermUpload() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      if (acceptedFiles.length) setLocation("/signup");
    },
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    multiple: false,
  } as any);

  return (
    <div className="max-w-[600px] mx-auto">
      <div
        {...getRootProps()}
        className={`relative cursor-pointer rounded-xl border-2 transition-all ${
          isDragActive
            ? "border-[#00B4D8] bg-[#F0FFFE] ring-4 ring-[#00B4D8]/20 dark:bg-[#00B4D8]/10"
            : "border-[#00B4D8] bg-[#F0FFFE] hover:bg-[#E0F7FA] dark:bg-[#00B4D8]/5 dark:hover:bg-[#00B4D8]/10"
        }`}
      >
        <input {...getInputProps()} />
        <div className="p-10 min-h-[150px] flex flex-col items-center justify-center gap-4 text-center">
          <FileText className="w-12 h-12 text-[#00B4D8]" aria-hidden="true" />
          <div>
            <p className="text-lg font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2">{t("termp.drop")}</p>
            <p className="text-sm text-[#4B5563] dark:text-[#9CA3AF]">{t("lobp.formats")}</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLocation("/report?sample=term"); }}
            className="mt-2 min-h-11 text-base font-semibold text-[#0E7490] hover:underline inline-flex items-center gap-2 dark:text-[#00B4D8]"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            {t("termp.sample")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TermPage() {
  const [, setLocation] = useLocation();

  useSEO(seoFor("/term"));

  // Same keys as the FAQPage JSON-LD the prerender writes (data/page-faqs.ts).
  const { t } = useLanguage();
  const faqList = (PAGE_FAQS["/term"] ?? []).map(([q, a]) => ({ question: t(q), answer: t(a) }));

  const points = [
    { icon: CheckCircle2, text: t("termp.get1") },
    { icon: Info, text: t("termp.get2") },
    { icon: Shield, text: t("termp.get3") },
  ];

  return (
    <div className="min-h-screen bg-[#F0FFFE] dark:bg-[#0F1419] flex flex-col">
      <Header />

      {/* Hero */}
      <section
        className="py-20 md:py-24 px-6 md:px-14 text-center text-white"
        style={{ background: "linear-gradient(15deg, #0F1419 0%, #0E7490 100%)" }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-full text-sm font-medium text-white mb-4">
            <Shield className="w-4 h-4" aria-hidden="true" />
            {t("termp.badge")}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold leading-tight mb-6 text-white">{t("termp.h")}</h1>
          <p className="text-base md:text-lg text-white leading-relaxed mb-8 max-w-2xl mx-auto">{t("termp.sub")}</p>
          <Button
            onClick={() => {
              const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
              if (fileInput) fileInput.click();
            }}
            className="bg-white hover:bg-[#E0F7FA] text-[#0F1419] h-12 px-8 text-base font-semibold mb-4"
          >
            {t("termp.upload_btn")}
          </Button>
          <p className="text-sm text-white">{t("termp.note")}</p>
        </div>
      </section>

      {/* Upload */}
      <section className="bg-white dark:bg-[#0F1419] py-16 md:py-20 px-6 md:px-14">
        <TermUpload />
      </section>

      {/* What you get */}
      <section className="bg-[#EFF6FF] dark:bg-[#1E3A5F]/30 py-12 px-6 md:px-14 border-l-4 border-[#00B4D8] my-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-6">{t("termp.get_h")}</h2>
          <ul className="space-y-4 text-base text-[#0F1419] dark:text-[#FAFBFC] leading-relaxed">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <Icon className="w-5 h-5 mt-1 shrink-0 text-[#0E7490] dark:text-[#00B4D8]" aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white dark:bg-[#0F1419] py-12 px-6 md:px-14 border-y border-[#E5E7EB] dark:border-gray-700">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold text-center text-[#0F1419] dark:text-[#FAFBFC] mb-8">
            {t("termp.faq_h")}
          </h2>
          <div className="space-y-3">
            {faqList.map((faq, index) => (
              <details key={index} className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <summary className="flex min-h-11 items-center justify-between gap-3 cursor-pointer list-none">
                  <span className="text-base font-semibold text-[#0F1419] dark:text-[#FAFBFC] pr-4">{faq.question}</span>
                  <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                </summary>
                <p className="mt-3 text-base text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed whitespace-pre-line">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-6 md:px-14 my-16 rounded-2xl max-w-[600px] mx-4 sm:mx-auto text-center text-white bg-gradient-to-br from-[#0E7490] to-[#0F1419]">
        <h2 className="text-3xl font-semibold mb-4 text-white">{t("termp.cta_h")}</h2>
        <p className="text-base text-white mb-6 leading-relaxed">{t("termp.cta_b")}</p>
        <Button
          onClick={() => setLocation("/signup")}
          className="bg-[#0F1419] hover:bg-[#1A3A52] text-white h-12 px-8 text-base font-semibold"
        >
          {t("sfs.cta")}
        </Button>
      </section>

      <Footer />
    </div>
  );
}
