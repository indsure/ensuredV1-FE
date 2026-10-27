// frontend/client/src/pages/CookiePolicy.tsx
// Drop this file into your pages directory and add a Wouter route:
// <Route path="/cookie-policy" component={CookiePolicy} />

import { LegalHindiNote } from "@/components/LegalHindiNote";
import { useEffect } from "react";
import { useSEO } from "@/hooks/use-seo";
import { seoFor } from "@/data/seo-pages";

const LAST_UPDATED = "27 October 2026";

// Checked against the code on 27 Oct 2026: every key below is one the site reads
// or writes, and nothing the site stores is missing. Add a row when you add a key.
const localStorageItems = [
  { key: "sb-…-auth-token", purpose: "Keeps you signed in. Set by Supabase, our login provider.", duration: "Until you sign out" },
  { key: "indsure_lang", purpose: "Remembers whether you chose English or Hindi.", duration: "Persistent until cleared" },
  { key: "ea-theme", purpose: "Stores your light/dark theme preference.", duration: "Persistent until cleared" },
  {
    key: "indsure-wa-contact-saved",
    purpose: "Remembers that an advisor has saved the IndSure WhatsApp number, so the setup step is not shown again.",
    duration: "Persistent until cleared",
  },
];

const sessionStorageItems = [
  {
    key: "IndSure_current_job",
    purpose: "Tracks the ID of your current policy check so we can show you progress.",
    duration: "Current browser session (cleared when you close the tab)",
  },
  {
    key: "IndSure_report",
    purpose: "Temporarily holds the report you are looking at, for display.",
    duration: "Current browser session",
    sensitive: true,
  },
  {
    key: "indsure_pending_upload",
    purpose: "Remembers a policy you uploaded before creating an account, so it is waiting for you after signup.",
    duration: "Current browser session",
  },
  {
    key: "calculator_inputs, calculator_result, calculator_saved_at, calculator_progress, calculator_saved_timestamp",
    purpose: "Keeps your cover calculator answers and result while you move between steps.",
    duration: "Current browser session",
    sensitive: true,
  },
  {
    key: "indsure_signup_draft, indsure_signup_checkboxes",
    purpose: "Keeps what you typed on the advisor signup form if you leave the page and come back.",
    duration: "Current browser session",
  },
  {
    key: "indsure_claim_attempted",
    purpose: "Makes sure a waiting upload is looked for only once after you sign in.",
    duration: "Current browser session",
  },
  {
    key: "sach_ai_session_id, sach_ai_message_count",
    purpose: "Keeps your Sach assistant chat together and counts the messages in it.",
    duration: "Current browser session",
  },
  {
    key: "indsure_playground, indsure_playground_tour",
    purpose: "Marks that you are in the advisor demo, and where you are in its guided tour.",
    duration: "Current browser session",
  },
  {
    key: "indsure_chunk_reloaded",
    purpose: "Stops the page reloading itself more than once after we release an update.",
    duration: "Current browser session",
  },
];

export default function CookiePolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useSEO(seoFor("/cookie-policy"));

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="inline-flex min-h-11 items-center text-sm text-gray-500 hover:text-gray-800 transition-colors">
            ← Back to IndSure
          </a>
          <span className="text-xs text-gray-400">Last updated: {LAST_UPDATED}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">
        {/* Title */}
        <div className="mb-12">
          <p className="text-xs font-medium tracking-widest text-gray-400 uppercase mb-3">Legal</p>
          <LegalHindiNote />
          <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-4 leading-tight">Cookie Policy</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            This policy explains what cookies and browser storage IndSure uses, what data they contain,
            and how you can control them.
          </p>
        </div>

        <div className="space-y-12 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Cookies we set</h2>
            <p>
              IndSure does not set any cookies. What the site needs to remember is kept in your
              browser's storage instead, listed below. Our backend signs you in with a token sent
              with each request, not with a cookie.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Browser storage</h2>
            <p className="mb-4">
              localStorage keeps a few preferences and your sign-in. sessionStorage holds things only for the
              tab you are using, and is cleared when you close it. Clearing your browser's site data removes all of it.
            </p>

            <div className="rounded-xl border border-gray-100 overflow-hidden mb-8">
              <table className="table-cards w-full text-sm">
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
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 align-top" data-label="Key" data-cell="title">{item.key}</td>
                      <td className="px-4 py-3 text-gray-600 align-top" data-label="Purpose">{item.purpose}</td>
                      <td className="px-4 py-3 text-gray-500 align-top text-xs" data-label="Duration">{item.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="table-cards w-full text-sm">
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
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 align-top" data-label="Key" data-cell="title">{item.key}</td>
                      <td className="px-4 py-3 text-gray-600 align-top" data-label="Purpose">
                        {item.purpose}
                        {item.sensitive && (
                          <span className="ml-2 inline-block bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded">
                            Sensitive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 align-top text-xs" data-label="Duration">{item.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Third parties</h2>
            <p>
              Our fonts are served from our own site, so no font provider sees your visit. Sign-in
              (Supabase) stores the key marked above. Payments open Cashfree's own checkout, which follows
              Cashfree's cookie policy.
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
        <div className="mt-16 pt-8 border-t border-gray-100 flex flex-wrap gap-x-4 text-sm [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
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

