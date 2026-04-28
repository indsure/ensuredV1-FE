import { Link } from "wouter";
import { 
  Shield, 
  IndianRupee,
  MessageCircle,
  FileText, 
  Users, 
  TrendingUp,
  CheckCircle2,
  Phone,
  Calendar
} from "lucide-react";
import { useEffect } from "react";

export default function AgentLanding() {
  // Load Calendly script
  useEffect(() => {
    // Add Calendly CSS
    const link = document.createElement('link');
    link.href = 'https://assets.calendly.com/assets/external/widget.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Add Calendly JS
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  const openCalendly = (e: React.MouseEvent) => {
    e.preventDefault();
    // @ts-ignore - Calendly is loaded via external script
    if (window.Calendly) {
      // @ts-ignore
      window.Calendly.initPopupWidget({
        url: 'https://calendly.com/indsure/demo'
      });
    }
    return false;
  };
  // Prioritized features for Indian advisors
  const topFeatures = [
    {
      icon: Shield,
      title: "IRDAI Compliance & Reporting",
      description: "Automated regulatory compliance checks, instant IRDAI report generation, and built-in audit trails. Stay compliant without the paperwork hassle.",
      highlight: true
    },
    {
      icon: IndianRupee,
      title: "Commission Tracking",
      description: "Real-time commission calculations, payment tracking across multiple insurers, and detailed earning reports. Know exactly what you've earned.",
      highlight: true
    },
    {
      icon: MessageCircle,
      title: "WhatsApp & SMS Client Communication",
      description: "Send policy updates, renewal reminders, and claim status directly via WhatsApp. Automated SMS notifications keep your clients informed.",
      highlight: true
    }
  ];

  const additionalFeatures = [
    {
      icon: FileText,
      title: "Multi-Insurer Policy Management",
      description: "Manage policies from LIC, HDFC Life, SBI Life, and 15+ insurers in one dashboard."
    },
    {
      icon: Users,
      title: "Client Relationship Management",
      description: "Track client interactions, family members, and policy portfolios in one place."
    },
    {
      icon: TrendingUp,
      title: "Performance Analytics",
      description: "Monitor your monthly targets, conversion rates, and business growth metrics."
    }
  ];

  const testimonials = [
    {
      name: "Rajesh Kumar",
      city: "Indore, MP",
      photo: "👨‍💼",
      quote: "Closed 47 policies last month using IndSure. The WhatsApp integration alone saved me 3 hours daily.",
      policies: "47 policies/month"
    },
    {
      name: "Priya Sharma",
      city: "Pune, Maharashtra",
      photo: "👩‍💼",
      quote: "IRDAI compliance reports that used to take 2 days now take 5 minutes. Game changer for my business.",
      policies: "₹12L commission tracked"
    },
    {
      name: "Amit Patel",
      city: "Ahmedabad, Gujarat",
      photo: "👨‍💼",
      quote: "Managing policies from 8 different insurers was chaos. IndSure brought everything under one roof.",
      policies: "320+ active clients"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-6 py-12 lg:py-20">
        <div className="text-center">
          <div className="mb-3 inline-block rounded-full bg-[var(--color-green-primary)]/10 px-4 py-1.5 text-sm font-medium text-[var(--color-green-primary)]">
            For Insurance Advisors • IRDAI Compliant
          </div>
          <h1 className="mb-5 text-4xl font-bold tracking-tight text-slate-900 lg:text-5xl" style={{ letterSpacing: '-0.02em' }}>
            Manage 10x more policies.
            <span className="block text-[var(--color-green-primary)]">Without 10x the paperwork.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-600">
            The complete platform for Indian insurance advisors. IRDAI compliance, commission tracking, 
            WhatsApp client communication, and multi-insurer policy management — all in one place.
          </p>
          
          {/* Primary CTA */}
          <div className="flex flex-col items-center justify-center gap-4">
            <Link href="/agent/login">
              <button className="w-full sm:w-auto px-10 py-4 text-lg font-semibold bg-[var(--color-green-primary)] text-white rounded-xl hover:bg-[var(--color-teal-400)] transition-all shadow-lg shadow-teal-900/20 hover:shadow-xl">
                Login to Your Account
              </button>
            </Link>
            
            {/* Secondary Options */}
            <div className="flex flex-col items-center gap-3">
              {/* Sign Up Link - Plain text with bold action */}
              <Link href="/agent/signup/step1">
                <p className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                  Don't have an account? <span className="font-bold text-slate-900">Sign up free →</span>
                </p>
              </Link>
              
              {/* Divider */}
              <div className="flex items-center gap-3 w-full max-w-xs">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-xs text-slate-400 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>
              
              {/* Book a Call - Outlined pill button with icon */}
              <button 
                onClick={openCalendly}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-2 border-[var(--color-green-primary)] text-[var(--color-green-primary)] rounded-full hover:bg-[var(--color-green-primary)] hover:text-white transition-all"
              >
                <Calendar className="h-4 w-4" />
                Want a walkthrough first? Book a 15-min demo →
              </button>
            </div>
          </div>
          
          {/* Trust Strip */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[var(--color-green-primary)]" />
              <span className="font-medium">IRDAI Compliant</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-slate-300"></div>
            <div className="flex items-center gap-2">
              <span>🇮🇳 Trusted by advisors across <strong>200+ Indian cities</strong></span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-slate-300"></div>
            <div className="flex items-center gap-2">
              <span>🔒 Bank-grade security</span>
            </div>
          </div>

          {/* Insurer Logos */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-4">Integrates with leading insurers</p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-slate-400 text-sm font-medium">
              <span>LIC</span>
              <span>HDFC Life</span>
              <span>SBI Life</span>
              <span>ICICI Prudential</span>
              <span>Max Life</span>
              <span>+15 more</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Features - Larger Cards */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-3xl font-bold text-slate-900">
            Built for Indian Insurance Advisors
          </h2>
          <p className="text-lg text-slate-600">
            The features that actually matter for your business
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {topFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index} 
                className="rounded-xl border-2 border-[var(--color-green-primary)]/20 bg-white p-8 transition-all hover:shadow-xl hover:border-[var(--color-green-primary)]/50 hover:-translate-y-1"
              >
                <div className="mb-4 inline-flex rounded-lg bg-[var(--color-green-primary)]/10 p-4">
                  <Icon className="h-7 w-7 text-[var(--color-green-primary)]" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Additional Features - Smaller Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {additionalFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index} 
                className="rounded-lg border border-slate-200 bg-white p-5 transition-all hover:shadow-md hover:border-slate-300"
              >
                <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-2.5">
                  <Icon className="h-5 w-5 text-slate-600" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mid-Page CTA Band - Book a Call */}
      <div className="bg-gradient-to-r from-[var(--color-green-primary)]/5 via-[var(--color-green-primary)]/10 to-[var(--color-green-primary)]/5 py-12">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">
            Not sure if IndSure fits your workflow?
          </h2>
          <p className="mb-8 text-lg text-slate-600">
            Book a free 15-minute call. No sales pitch — just honest answers about the platform.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button 
              onClick={openCalendly}
              className="w-full sm:w-auto px-8 py-4 text-lg font-semibold bg-[var(--color-green-primary)] text-white rounded-xl hover:bg-[var(--color-teal-400)] transition-all shadow-lg shadow-teal-900/20 hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Calendar className="h-5 w-5" />
              Book a Demo Call
            </button>
            <a 
              href="https://wa.me/91XXXXXXXXXX?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20IndSure"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <button className="w-full px-8 py-4 text-lg font-semibold bg-[#25D366] text-white rounded-xl hover:bg-[#20BA5A] transition-colors shadow-lg flex items-center justify-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Chat on WhatsApp
              </button>
            </a>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-3xl font-bold text-slate-900">
              Trusted by Advisors Across India
            </h2>
            <p className="text-lg text-slate-600">
              Real advisors, real results
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index} 
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex items-start gap-3">
                  <div className="text-4xl">{testimonial.photo}</div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{testimonial.name}</h4>
                    <p className="text-sm text-slate-500">{testimonial.city}</p>
                    <p className="mt-1 text-xs font-medium text-[var(--color-green-primary)]">
                      {testimonial.policies}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA - Three Options */}
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h2 className="mb-3 text-3xl font-bold text-slate-900">
          Ready to Transform Your Advisory Business?
        </h2>
        <p className="mb-10 text-lg text-slate-600">
          Choose what works best for you
        </p>
        
        {/* Three CTA Options */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {/* Option 1: Login */}
          <div className="flex flex-col items-center">
            <Link href="/agent/login" className="w-full">
              <button className="w-full px-6 py-4 text-lg font-semibold bg-[var(--color-green-primary)] text-white rounded-xl hover:bg-[var(--color-teal-400)] transition-all shadow-lg shadow-teal-900/20 hover:shadow-xl">
                Login
              </button>
            </Link>
            <p className="mt-3 text-sm text-slate-500">
              For returning users
            </p>
          </div>

          {/* Option 2: Sign Up */}
          <div className="flex flex-col items-center">
            <Link href="/agent/signup/step1" className="w-full">
              <button className="w-full px-6 py-4 text-lg font-semibold border-2 border-[var(--color-green-primary)] text-[var(--color-green-primary)] rounded-xl hover:bg-[var(--color-green-primary)] hover:text-white transition-all">
                Sign Up Free
              </button>
            </Link>
            <p className="mt-3 text-sm text-slate-500">
              Ready to try it out
            </p>
          </div>

          {/* Option 3: Book a Call */}
          <div className="flex flex-col items-center">
            <button 
              onClick={openCalendly}
              className="w-full px-6 py-4 text-lg font-semibold border-2 border-slate-300 text-slate-700 rounded-xl hover:border-[var(--color-green-primary)] hover:text-[var(--color-green-primary)] transition-all flex items-center justify-center gap-2"
            >
              <Calendar className="h-5 w-5" />
              Book a Call
            </button>
            <p className="mt-3 text-sm text-slate-500">
              Want to talk first
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-6">
          Free for first 30 days • No credit card required • Cancel anytime
        </p>
        
        {/* Alternative Contact */}
        <div className="pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-600 mb-3">Have questions? Let's chat.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="https://wa.me/91XXXXXXXXXX?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20IndSure"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#25D366] font-semibold hover:underline"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp: +91 XXXX XXXXXX
            </a>
            <span className="hidden sm:inline text-slate-300">|</span>
            <a href="tel:+91XXXXXXXXXX" className="inline-flex items-center gap-2 text-[var(--color-green-primary)] font-semibold hover:underline">
              <Phone className="h-4 w-4" />
              Call: +91 XXXX XXXXXX
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Demo available in Hindi & English • Response within 2 hours
          </p>
        </div>
      </div>
    </div>
  );
}
