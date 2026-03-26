// frontend/client/src/pages/CookiePolicy.tsx
// Drop this file into your pages directory and add a Wouter route:
// <Route path="/cookie-policy" component={CookiePolicy} />

import { useEffect } from "react";

const LAST_UPDATED = "25 March 2025";

const cookies = [
  {
    name: "sidebar_state",
    type: "Functional (strictly necessary)",
    provider: "IndSure (first-party)",
    purpose:
      "Remembers whether your agent dashboard sidebar is open or collapsed so your layout preference persists across sessions.",
    duration: "7 days",
    canOptOut: false,
  },
];

const localStorageItems = [
  { key: "ea-theme", purpose: "Stores your light/dark theme preference.", duration: "Persistent until cleared" },
  {
    key: "IndSure_vehicle_calculator_form",
    purpose: "Saves your in-progress vehicle calculator inputs so you don't lose them if you navigate away.",
    duration: "Persistent until cleared or new calculation",
  },
  {
    key: "IndSure_term_calculator_form",
    purpose: "Saves your in-progress term insurance calculator inputs.",
    duration: "Persistent until cleared or new calculation",
  },
  {
    key: "IndSure_life_calculator_form",
    purpose: "Saves your in-progress life insurance calculator inputs.",
    duration: "Persistent until cleared or new calculation",
  },
];

const sessionStorageItems = [
  {
    key: "IndSure_current_job",
    purpose: "Tracks the ID of your current policy analysis job so we can show you progress updates.",
    duration: "Current browser session (cleared when you close the tab)",
  },
  {
    key: "IndSure_report",
    purpose: "Temporarily stores your current analysis report for display.",
    duration: "Current browser session",
  },
  {
    key: "IndSure_pending_file",
    purpose:
      "Temporarily holds your uploaded insurance document (as base64) during the upload and analysis process. Contains sensitive policy data.",
    duration: "Cleared immediately after analysis begins, or on session end",
    sensitive: true,
  },
  {
    key: "IndSure_comparison_policies",
    purpose: "Stores policy data for the comparison tool while you are actively using it.",
    duration: "Current browser session",
  },
  {
    key: "IndSure_comparison_profile",
    purpose: "Stores your demographic profile inputs for the policy comparison tool.",
    duration: "Current browser session",
  },
  {
    key: "calculator_result",
    purpose: "Fallback storage for calculator results if the server is temporarily unavailable.",
    duration: "Current browser session",
  },
];

export default function CookiePolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Cookie Policy — IndSure";
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
        {/* Title */}
        <div className="mb-12">
          <p className="text-xs font-medium tracking-widest text-gray-400 uppercase mb-3">Legal</p>
          <h1 className="text-4xl font-semibold text-gray-900 mb-4 leading-tight">Cookie Policy</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            This policy explains what cookies and browser storage IndSure uses, what data they contain,
            and how you can control them.
          </p>
        </div>

        <div className="space-y-12 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Cookies we set</h2>
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Purpose</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {cookies.map((c) => (
                    <tr key={c.name} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 align-top">{c.name}</td>
                      <td className="px-4 py-3 align-top">
                        <span className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">
                          {c.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 align-top">{c.purpose}</td>
                      <td className="px-4 py-3 text-gray-500 align-top whitespace-nowrap">{c.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Browser storage</h2>
            <p className="mb-4">
              localStorage saves calculator progress and theme preference. sessionStorage is used temporarily
              during active document uploads and analysis.
            </p>

            <div className="rounded-xl border border-gray-100 overflow-hidden mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">localStorage key</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Purpose</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {localStorageItems.map((item) => (
                    <tr key={item.key} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 align-top">{item.key}</td>
                      <td className="px-4 py-3 text-gray-600 align-top">{item.purpose}</td>
                      <td className="px-4 py-3 text-gray-500 align-top text-xs">{item.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">sessionStorage key</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Purpose</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionStorageItems.map((item) => (
                    <tr key={item.key} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 align-top">{item.key}</td>
                      <td className="px-4 py-3 text-gray-600 align-top">
                        {item.purpose}
                        {item.sensitive && (
                          <span className="ml-2 inline-block bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded">
                            Sensitive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 align-top text-xs">{item.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Google Fonts</h2>
            <p>
              IndSure may load fonts from <span className="font-mono text-xs">fonts.googleapis.com</span>.
              When requested, your browser will contact Google servers to download fonts. If you prefer not
              to load external fonts, you can change your consent preferences (see the cookie banner on the site).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Questions</h2>
            <p>
              For questions about this Cookie Policy, contact us at{" "}
              <a href="mailto:tech@indsure.in" className="text-blue-600 hover:underline">
                tech@indsure.in
              </a>{" "}
              or visit our{" "}
              <a href="/grievance" className="text-blue-600 hover:underline">
                Grievance page
              </a>
              .
            </p>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
          <a href="/privacy-policy" className="text-blue-600 hover:underline">
            Privacy Policy
          </a>
          <a href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </a>
          <a href="/grievance" className="text-blue-600 hover:underline">
            Grievance Officer
          </a>
        </div>
      </div>
    </div>
  );
}

