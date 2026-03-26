// frontend/client/src/pages/TermsOfService.tsx
// Drop this file into your pages directory and add a Wouter route:
// <Route path="/terms" component={TermsOfService} />
// Update the Footer.tsx links from href="#" to href="/terms"

import { useEffect } from "react";

const LAST_UPDATED = "25 March 2025";
const EFFECTIVE_DATE = "25 March 2025";

export default function TermsOfService() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Terms of Service — IndSure";
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            ← Back to IndSure
          </a>
          <span className="text-xs text-gray-400">Last updated: {LAST_UPDATED}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">
        {/* Title block */}
        <div className="mb-12">
          <p className="text-xs font-medium tracking-widest text-gray-400 uppercase mb-3">Legal</p>
          <h1 className="text-4xl font-semibold text-gray-900 mb-4 leading-tight">Terms of Service</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Effective date: {EFFECTIVE_DATE}. Please read these Terms carefully before using IndSure. By accessing
            or using our platform, you agree to be bound by these Terms.
          </p>
        </div>

        {/* Important disclaimer callout */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-6 py-5 mb-12">
          <p className="text-sm font-semibold text-amber-800 mb-1">Important — not insurance advice</p>
          <p className="text-sm text-amber-700 leading-relaxed">
            IndSure is an AI-powered information and analysis tool. Nothing on this platform constitutes
            insurance advice, financial advice, or a recommendation to purchase any insurance product.
            All analysis is for informational purposes only. Always consult a licensed insurance advisor
            before making insurance decisions.
          </p>
        </div>

        <div className="space-y-10 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. About IndSure</h2>
            <p>
              IndSure ("we", "our", "us") is an AI-powered insurance analysis platform that helps users
              understand their existing insurance policies and evaluate insurance options. Our services include
              policy document analysis, insurance calculators, policy comparison tools, and the Sach AI chat
              assistant.
            </p>
            <p className="mt-3">
              These Terms govern your access to and use of ensured.in and all related services. Our{" "}
              <a href="/privacy-policy" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>{" "}
              is incorporated into these Terms by reference.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Eligibility and age requirements</h2>
            <p>
              There is no minimum age gate. You must have legal capacity to use the platform. If you provide
              information about minor dependants (such as child ages) in our calculators, you confirm you have
              the right to provide that information and that it is provided only where necessary.
            </p>
            <p className="mt-3">
              Our calculators and tools allow users to input information about minor dependants (such as
              children's ages) for the purpose of calculating family insurance coverage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Description of services</h2>
            <p>IndSure provides the following services:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>
                <strong className="font-medium text-gray-800">Policy analysis:</strong> Upload your health, life,
                vehicle, or term insurance policy document and receive an AI-generated analysis highlighting key
                coverage, exclusions, and limitations.
              </li>
              <li>
                <strong className="font-medium text-gray-800">Insurance calculators:</strong> Input your personal
                and financial details to receive an indicative insurance coverage recommendation.
              </li>
              <li>
                <strong className="font-medium text-gray-800">Policy comparison:</strong> Compare multiple
                insurance policies side by side (where available).
              </li>
              <li>
                <strong className="font-medium text-gray-800">Sach AI chat assistant:</strong> Ask questions
                about your insurance policy or analysis results.
              </li>
              <li>
                <strong className="font-medium text-gray-800">Hospital network finder:</strong> Search for
                hospitals in an insurer's network by state, city, or pincode.
              </li>
              <li>
                <strong className="font-medium text-gray-800">Agent portal:</strong> Registered insurance agents
                may access additional tools to manage clients and generate reports.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. AI-generated content — important limitations</h2>
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 space-y-3">
              <p>
                All analysis, recommendations, and summaries generated by IndSure are produced by artificial
                intelligence (Google's Gemini AI). AI-generated output may contain errors, omissions, or
                inaccuracies. You should:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Always verify information against your original policy document.</li>
                <li>Not rely solely on IndSure's analysis for any financial, medical, or legal decision.</li>
                <li>Consult a licensed insurance advisor, financial planner, or legal professional before making any insurance decision.</li>
              </ul>
              <p className="text-gray-700 font-medium">
                IndSure does not guarantee the accuracy, completeness, or suitability of any analysis or
                recommendation for your specific circumstances.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Your account (agent portal)</h2>
            <p>
              To access the agent portal, you must register with a valid invite code. You are responsible for:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>Maintaining the confidentiality of your login credentials.</li>
              <li>All activity that occurs under your account.</li>
              <li>Notifying us immediately at tech@indsure.in if you suspect unauthorised access.</li>
              <li>Providing accurate and current information during registration.</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these Terms, are used
              fraudulently, or where we believe there is a risk of harm.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>Upload documents that do not belong to you or that you are not authorised to share.</li>
              <li>Use the platform to process personal data of third parties without their consent.</li>
              <li>Attempt to reverse-engineer, scrape, or extract data from IndSure's systems.</li>
              <li>Use the platform for any unlawful purpose or in violation of any applicable Indian law.</li>
              <li>Submit false, misleading, or fraudulent information.</li>
              <li>Interfere with or disrupt the integrity or performance of the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Contact us</h2>
            <p>For any queries regarding these Terms, please contact:</p>
            <div className="mt-3 bg-gray-50 rounded-xl p-5 border border-gray-100 space-y-1 text-sm">
              <p>
                <span className="font-medium text-gray-700">Company:</span> IndSure
              </p>
              <p>
                <span className="font-medium text-gray-700">Email:</span>{" "}
                <a href="mailto:tech@indsure.in" className="text-blue-600 hover:underline">
                  tech@indsure.in
                </a>
              </p>
              <p>
                <span className="font-medium text-gray-700">Grievance Officer:</span>{" "}
                <a href="/grievance" className="text-blue-600 hover:underline">
                  See Grievance page
                </a>
              </p>
            </div>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
          <a href="/privacy-policy" className="text-blue-600 hover:underline">
            Privacy Policy
          </a>
          <a href="/cookie-policy" className="text-blue-600 hover:underline">
            Cookie Policy
          </a>
          <a href="/grievance" className="text-blue-600 hover:underline">
            Grievance Officer
          </a>
        </div>
      </div>
    </div>
  );
}

