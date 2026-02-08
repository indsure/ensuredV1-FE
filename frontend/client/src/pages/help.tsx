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

export default function Help() {
  const faqItems = [
    {
      question: "How does the policy analysis work?",
      answer: "Upload your health insurance policy PDF. Our AI extracts key coverage details, analyzes sufficiency against common medical costs, and generates a clear verdict with identified gaps. The entire process takes about 60 seconds."
    },
    {
      question: "Is my data stored?",
      answer: "No. We analyze your policy and delete it immediately after generating the report. We don't store your personal information, policy details, or any uploaded documents."
    },
    {
      question: "What format should my policy be in?",
      answer: "We support PDF format only. The PDF should be a clear scan or digital copy of your health insurance policy document."
    },
    {
      question: "Will I receive sales calls?",
      answer: "Never. We don't collect your phone number or email address. There's no signup required, and we don't sell insurance products."
    },
    {
      question: "How accurate is the analysis?",
      answer: "Our AI uses deterministic analysis based on IRDAI guidelines and common medical cost patterns. The analysis identifies coverage gaps and provides actionable insights, but you should always consult with your insurer for specific coverage questions."
    },
    {
      question: "Can I compare multiple policies?",
      answer: "Yes! Use our comparison tool to upload multiple policies and see side-by-side comparisons of coverage, premiums, and key features."
    },
    {
      question: "What if my policy is in Hindi or another language?",
      answer: "Currently, we support English language policies. If your policy is in another language, please contact support and we'll work on adding support for additional languages."
    },
    {
      question: "Is the service free?",
      answer: "Yes, our policy analysis service is completely free. We don't charge for analysis, and we don't sell insurance products."
    }
  ];

  const supportOptions = [
    {
      icon: Mail,
      title: "Email Support",
      description: "Get help via email",
      action: "contact@ensured.in",
      href: "mailto:contact@ensured.in"
    },
    {
      icon: MessageCircle,
      title: "FAQ",
      description: "Browse frequently asked questions",
      action: "View FAQ",
      href: "#faq"
    },
    {
      icon: FileText,
      title: "Documentation",
      description: "Learn how to use our tools",
      action: "Read Docs",
      href: "#"
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
        { label: "Home", href: "/" },
        { label: "Help & Support", href: "/help" }
      ]} />

      <main id="main-content" className="flex-1 container mx-auto px-4 sm:px-6 py-8 sm:py-12" role="main">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Help & Support
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Find answers to common questions or get in touch with our support team
          </p>
        </div>

        {/* Support Options */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
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
                      className="text-[#1A3A52] dark:text-[#4A9B9E] hover:underline font-medium"
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
              Frequently Asked Questions
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Quick answers to common questions
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
            Still need help?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Our support team is here to assist you
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="mailto:contact@ensured.in">
              <Button className="bg-[#1A3A52] hover:bg-[#2d5a7b] text-white">
                <Mail className="w-4 h-4 mr-2" />
                Email Us
              </Button>
            </a>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

