import { Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion } from "@/components/ui/accordion";
import { 
  Mail, 
  MessageCircle, 
  FileText, 
  Search,
  ArrowLeft,
  HelpCircle,
  BookOpen,
  Video,
  Phone
} from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Help() {
  const { t } = useLanguage();
  const faqItems = [
    {
      question: t("help.q1"),
      answer: t("help.a1")
    },
    {
      question: t("help.q2"),
      // Policies persist in individual_policies and are removed only by their
      // owner. That handler deletes the storage object FIRST and refuses to
      // drop the row if the file delete fails, which is what the "we leave the
      // record alone" sentence describes. The 90 days is RETENTION_GRACE_DAYS.
      // claim-source: backend/server/routes.ts:4565, :4584-4596;
      // pages/app/portfolio.tsx:157; backend/server/index.ts:80.
      answer: t("help.a2")
    },
    {
      question: t("help.q3"),
      answer: t("help.a3")
    },
    {
      question: t("help.q4"),
      answer: t("help.a4")
    },
    {
      question: t("help.q5"),
      answer: t("help.a5")
    },
    {
      question: t("help.q6"),
      answer: t("help.a6")
    },
    {
      question: t("help.q7"),
      answer: t("help.a7")
    },
    {
      question: t("help.q8"),
      // Plan contents and the ₹999 price mirror the live /pricing table. "No
      // expiry" is enforced server-side: the 30-day trial gate was removed and
      // Free is now capped by slots, not by time.
      // claim-source: pricing.tsx; backend/server/routes.ts:771, :784-789.
      answer: t("help.a8")
    }
  ];

  const supportOptions = [
    {
      icon: Mail,
      title: t("help.email_t"),
      description: t("help.email_d"),
      action: "nikhil@indsure.in",
      href: "mailto:nikhil@indsure.in"
    },
    {
      icon: MessageCircle,
      title: t("help.faq_t"),
      description: t("help.faq_d"),
      action: t("help.faq_a"),
      href: "#faq"
    },
    {
      icon: FileText,
      title: t("help.docs_t"),
      description: t("help.docs_d"),
      action: t("help.docs_a"),
      href: "/blog"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F0FFFE] dark:bg-[#0F1419] relative">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-400/30 dark:bg-blue-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-40 w-96 h-96 bg-cyan-400/30 dark:bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-400/25 dark:bg-teal-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>
      <Header />
      
      <Breadcrumbs items={[
        { label: t("help.home"), href: "/" },
        { label: t("help.crumb"), href: "/help" }
      ]} />

      <main id="main-content" className="flex-1 container mx-auto px-4 sm:px-6 pt-32 sm:pt-36 md:pt-40 pb-8 sm:pb-12" role="main">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t("help.h")}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t("help.sub")}
          </p>
        </div>

        {/* Support Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {supportOptions.map((option, index) => {
            const Icon = option.icon;
            return (
              <Card key={index} clickable className="text-center">
                <CardHeader>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gradient-to-br from-[#1A3A52] to-[#4A9B9E] flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{option.title}</CardTitle>
                  <CardDescription>{option.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {option.href.startsWith("mailto:") ? (
                    <a
                      href={option.href}
                      className="inline-flex min-h-11 items-center text-[#1A3A52] dark:text-[#4A9B9E] hover:underline font-medium break-all"
                    >
                      {option.action}
                    </a>
                  ) : (
                    <Link href={option.href}>
                      <Button variant="outline" className="w-full">
                        {option.action}
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <section id="faq" className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {t("help.faq_h")}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {t("help.faq_sub")}
            </p>
          </div>
          <div className="max-w-3xl mx-auto">
            <Accordion items={faqItems} />
          </div>
        </section>

        {/* Contact Section */}
        <section className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <HelpCircle className="w-12 h-12 mx-auto mb-4 text-[#1A3A52] dark:text-[#4A9B9E]" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t("help.still")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t("help.here")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="mailto:nikhil@indsure.in">
              <Button className="bg-[#1A3A52] hover:bg-[#2d5a7b] text-white">
                <Mail className="w-4 h-4 mr-2" />
                {t("help.email_us")}
              </Button>
            </a>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("help.back_home")}
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

