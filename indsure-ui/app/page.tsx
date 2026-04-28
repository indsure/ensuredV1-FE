/**
 * IndSure Landing Page
 * Consumer-facing homepage with hero, features, and CTA
 */

import Link from 'next/link';
import { ArrowRight, Shield, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-cream to-teal-50/30 pt-20 pb-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            {/* Headline */}
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold text-ink mb-6 leading-tight">
              Find Your Best-Fit
              <br />
              <span className="text-teal-primary">Health Policy</span>
            </h1>
            
            {/* Pain Point */}
            <p className="text-xl sm:text-2xl text-slate mb-8 max-w-2xl mx-auto">
              Comparing 4 policies by hand = 2 hours of spreadsheet hell.
              <br />
              <span className="text-ink font-medium">Let AI do it in 2 minutes.</span>
            </p>
            
            {/* Primary CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <Link
                href="/compare"
                className="inline-flex items-center gap-2 bg-teal-primary hover:bg-teal-dark text-white font-semibold px-8 py-4 rounded-full shadow-md hover:shadow-lg transition-all duration-300 text-lg"
              >
                Compare My Policies
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            
            {/* Advisor Link */}
            <p className="text-slate-light text-sm">
              Are you an advisor?{' '}
              <Link href="/advisor/login" className="text-teal-primary hover:text-teal-dark font-medium underline">
                Login →
              </Link>
            </p>
            
            {/* Trust Strip */}
            <div className="mt-12 inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-sm border border-teal-100">
              <Shield className="w-5 h-5 text-teal-primary" />
              <span className="text-sm text-slate">
                🔒 Processed securely. Deleted after analysis. DPDP-compliant.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Key Dimensions Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-serif text-4xl font-bold text-ink text-center mb-4">
              What We Compare
            </h2>
            <p className="text-xl text-slate text-center mb-12 max-w-2xl mx-auto">
              10 critical dimensions, weighted by what matters to you
            </p>
            
            {/* 4 Cards - Teal Gradient */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1 */}
              <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 p-8 rounded-2xl border border-teal-200/50 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-teal-primary/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-teal-primary" />
                </div>
                <h3 className="font-serif text-xl font-bold text-ink mb-2">
                  Coverage Adequacy
                </h3>
                <p className="text-slate text-sm">
                  Sum insured, restoration benefits, and coverage breadth
                </p>
              </div>

              {/* Card 2 */}
              <div className="bg-gradient-to-br from-teal-100/50 to-teal-200/30 p-8 rounded-2xl border border-teal-200/50 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-teal-primary/10 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-teal-primary" />
                </div>
                <h3 className="font-serif text-xl font-bold text-ink mb-2">
                  Cost & Value
                </h3>
                <p className="text-slate text-sm">
                  Premium per lakh, co-pay penalties, and hidden costs
                </p>
              </div>

              {/* Card 3 */}
              <div className="bg-gradient-to-br from-teal-200/30 to-teal-300/20 p-8 rounded-2xl border border-teal-200/50 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-teal-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-teal-primary" />
                </div>
                <h3 className="font-serif text-xl font-bold text-ink mb-2">
                  Waiting Periods
                </h3>
                <p className="text-slate text-sm">
                  PED, specific illness, and maternity waiting times
                </p>
              </div>

              {/* Card 4 */}
              <div className="bg-gradient-to-br from-teal-300/20 to-teal-400/10 p-8 rounded-2xl border border-teal-200/50 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-teal-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-teal-primary" />
                </div>
                <h3 className="font-serif text-xl font-bold text-ink mb-2">
                  Insurer Track Record
                </h3>
                <p className="text-slate text-sm">
                  Claim settlement ratio, complaints, and financial health
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Example Comparison Section */}
      <section className="py-20 bg-cream">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-serif text-4xl font-bold text-ink text-center mb-4">
              See the Difference
            </h2>
            <p className="text-xl text-slate text-center mb-12">
              Example: 3 popular policies compared
            </p>
            
            {/* Example Table */}
            <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-teal-50 border-b border-teal-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-ink">
                        Feature
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-ink">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 bg-success text-white text-xs font-bold px-3 py-1 rounded-full">
                            🥇 BEST OVERALL
                          </span>
                          <span>Star Health</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-ink">
                        HDFC Ergo
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-ink">
                        Care Health
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-6 py-4 text-sm text-slate">Sum Insured</td>
                      <td className="px-6 py-4 text-center text-sm font-medium bg-success/5">
                        ₹10L ✓
                      </td>
                      <td className="px-6 py-4 text-center text-sm">₹5L</td>
                      <td className="px-6 py-4 text-center text-sm">₹7L</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm text-slate">Annual Premium</td>
                      <td className="px-6 py-4 text-center text-sm">₹18,000</td>
                      <td className="px-6 py-4 text-center text-sm font-medium bg-success/5">
                        ₹12,000 ✓
                      </td>
                      <td className="px-6 py-4 text-center text-sm">₹15,000</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm text-slate">PED Waiting</td>
                      <td className="px-6 py-4 text-center text-sm font-medium bg-success/5">
                        24 months ✓
                      </td>
                      <td className="px-6 py-4 text-center text-sm bg-danger/5">
                        48 months 🚩
                      </td>
                      <td className="px-6 py-4 text-center text-sm">36 months</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm text-slate">Claim Settlement Ratio</td>
                      <td className="px-6 py-4 text-center text-sm font-medium bg-success/5">
                        96.5% ✓
                      </td>
                      <td className="px-6 py-4 text-center text-sm">95.2%</td>
                      <td className="px-6 py-4 text-center text-sm">94.8%</td>
                    </tr>
                    <tr className="bg-teal-50 font-semibold">
                      <td className="px-6 py-4 text-sm text-ink">Overall Score</td>
                      <td className="px-6 py-4 text-center text-lg text-success">
                        84/100 🏆
                      </td>
                      <td className="px-6 py-4 text-center text-lg text-teal-primary">
                        78/100
                      </td>
                      <td className="px-6 py-4 text-center text-lg text-teal-primary">
                        76/100
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* CTA Below Table */}
            <div className="text-center mt-8">
              <Link
                href="/compare"
                className="inline-flex items-center gap-2 bg-teal-primary hover:bg-teal-dark text-white font-semibold px-8 py-4 rounded-full shadow-md hover:shadow-lg transition-all duration-300"
              >
                Compare Your Policies Now
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink text-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-slate-light text-sm mb-4">
              DPDP Act 2023 compliant • Insurer data from IRDAI Annual Report FY 2023-24
            </p>
            <div className="flex items-center justify-center gap-6 text-sm">
              <Link href="/glossary" className="text-slate-light hover:text-white transition-colors">
                Glossary
              </Link>
              <Link href="/insurers" className="text-slate-light hover:text-white transition-colors">
                Insurer Spotlight
              </Link>
              <Link href="/advisor/login" className="text-slate-light hover:text-white transition-colors">
                For Advisors
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
