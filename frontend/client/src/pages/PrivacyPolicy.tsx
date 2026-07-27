// frontend/client/src/pages/PrivacyPolicy.tsx
// Drop this file into your pages directory and add a Wouter route:
// <Route path="/privacy-policy" component={PrivacyPolicy} />
// Update the Footer.tsx links from href="#" to href="/privacy-policy"

import { useEffect } from "react";

const LAST_UPDATED = "25 March 2025";
const EFFECTIVE_DATE = "25 March 2025";

const sections = [
  {
    id: "who-we-are",
    title: "1. Who we are",
    content: `IndSure (referred to as "IndSure", "we", "our", or "us") is an AI-powered insurance analysis platform operated from India. We help individuals and insurance agents understand, compare, and evaluate insurance policies — including health, life, vehicle, and term insurance.

Our registered contact email is tech@indsure.in. For all data-related queries, please see Section 11 (Grievance & Contact) below.`,
  },
  {
    id: "what-we-collect",
    title: "2. What personal data we collect",
    content: null,
    subsections: [
      {
        title: "2.1 Insurance documents you upload",
        body: `When you use our policy analysis tools (health, life, vehicle, or term), you may upload PDF files or images of your insurance policies. These documents may contain your name, policy number, coverage details, nominee information, and other policy-specific data. We treat all uploaded documents as sensitive personal data.

Uploaded files are automatically deleted from our servers within 24 hours. We process your document to generate your report and recommendations, and we do not store the analysis content as a permanent record.`,
      },
      {
        title: "2.2 Health and personal information",
        body: `Our health insurance calculator and policy comparison tool collect demographic and health information you provide voluntarily, including: age, gender, city/state, annual household income, family structure, spouse details, children's ages, and any pre-existing conditions you choose to disclose (such as diabetes, hypertension, cardiac conditions, or cancer).

You are never required to provide health information to use IndSure. If you choose to provide it, we use it solely to generate personalised insurance recommendations.`,
      },
      {
        title: "2.3 Agent account data",
        body: `If you register as an insurance agent on IndSure, we collect: full name, email address, mobile number, city, years of experience, invite code, firm name, and the names of insurers you are empanelled with. This data is used to create and manage your agent profile.`,
      },
      {
        title: "2.4 Chat messages (Sach AI)",
        body: `When you interact with our Sach AI chat assistant, your messages and your current analysis report context are processed to generate a response. Chat messages are not stored permanently and are not used to train any AI model.`,
      },
      {
        title: "2.5 Location data (calculator)",
        body: `Our calculators collect the state and city you enter to calibrate insurance recommendations for your geography. We do not collect precise GPS location without your explicit permission.`,
      },
      {
        title: "2.6 Automatically collected data",
        body: `We do not use third-party analytics, advertising pixels, or tracking scripts. Our servers log standard API request metadata (request path, response time) for performance monitoring. These logs do not include personal identifiers and are not shared with third parties.

We set one first-party cookie named sidebar_state (max age 7 days) to remember your dashboard sidebar preference. See our Cookie Policy for details.`,
      },
    ],
  },
  {
    id: "how-we-use",
    title: "3. How and why we use your data",
    content: null,
    table: [
      { purpose: "Analyse your insurance policy", data: "Uploaded document", basis: "Performance of service (you requested analysis)" },
      { purpose: "Generate personalised insurance recommendations", data: "Age, health info, income, location", basis: "Consent (you voluntarily provide this)" },
      { purpose: "Power Sach AI chat responses", data: "Chat messages, current report", basis: "Performance of service" },
      { purpose: "Create and manage your agent account", data: "Name, email, phone, city, firm, empanelments", basis: "Performance of contract (agent agreement)" },
      { purpose: "Improve our analysis accuracy", data: "Anonymised, aggregated report data", basis: "Legitimate interest — data is de-identified before use" },
      { purpose: "Respond to grievances and support queries", data: "Email, query details", basis: "Legal obligation under DPDP Act 2023" },
    ],
  },
  {
    id: "third-parties",
    title: "4. Third parties who process your data",
    content: `We share your data only as described below. We do not sell your personal data.`,
    subsections: [
      {
        title: "4.1 Google Gemini AI (data processor)",
        body: `Your uploaded insurance documents and chat messages are processed by Google's Gemini AI API to extract policy information and generate analysis. Google processes this data as our data processor under a data processing agreement. Google does not use your data to train its models. For details, see Google's API data usage policy at ai.google.dev/terms.`,
      },
      {
        title: "4.2 Supabase (infrastructure & auth)",
        body: `Agent account authentication and profile data are stored and managed by Supabase, which provides database and authentication infrastructure. Data is stored in servers within the region configured by IndSure.`,
      },
      {
        title: "4.3 Google Fonts",
        body: `Our website loads fonts from fonts.googleapis.com. Your browser will make a request to Google's servers to download fonts, which may involve your IP address being sent to Google. You may block this in your browser settings without affecting core functionality.`,
      },
      {
        title: "4.4 Legal or regulatory disclosure",
        body: `We may disclose your data to law enforcement, courts, or regulators where required by applicable Indian law, including the DPDP Act 2023, provided we have received a lawful request and — where permitted — have notified you.`,
      },
    ],
  },
  {
    id: "retention",
    title: "5. How long we keep your data",
    content: null,
    table: [
      { type: "Uploaded policy files", period: "Deleted within 24 hours of upload", notes: "Automatic deletion from file system" },
      { type: "Policy analysis reports", period: "Not retained in our database; provided for your session only", notes: "Analysis is processed and discarded in accordance with our DPDP practices" },
      { type: "Health calculator reports", period: "Not retained in our database; provided for your session only", notes: "Calculator outputs are generated on demand" },
      { type: "Agent account data", period: "For the duration of your account + 2 years after closure", notes: "Required for regulatory compliance" },
      { type: "Chat messages (Sach AI)", period: "Not stored beyond the current session", notes: "Cleared on session end" },
      { type: "API server logs", period: "30 days", notes: "Anonymised; used for performance monitoring only" },
    ],
  },
  {
    id: "your-rights",
    title: "6. Your rights under the DPDP Act 2023",
    content: `Under the Digital Personal Data Protection Act 2023 (India), you have the following rights as a Data Principal:`,
    rights: [
      { right: "Right to access", desc: "Request a summary of the personal data we hold about you and how it is being used." },
      { right: "Right to correction", desc: "Ask us to correct inaccurate or misleading personal data." },
      { right: "Right to erasure", desc: "Request deletion of your personal data when it is no longer needed for the purpose for which it was collected." },
      { right: "Right to grievance redressal", desc: "Lodge a complaint with our Grievance Officer if you believe your data has been mishandled. You may escalate to the Data Protection Board of India if the grievance is not resolved." },
      { right: "Right to withdraw consent", desc: "Where processing is based on your consent, you may withdraw consent at any time. Withdrawal does not affect the lawfulness of prior processing." },
      { right: "Right to nominate", desc: "Nominate another person to exercise your rights on your behalf in the event of your death or incapacity." },
    ],
    footer: `To exercise any of these rights, contact us at tech@indsure.in with the subject line "Data Rights Request". We will respond within 30 days as required by law.`,
  },
  {
    id: "children",
    title: "7. Children's data",
    content: `IndSure does not apply a minimum age gate. The platform is intended for general use.

Some of our tools (such as the life or health calculator) allow users to input information about their minor dependants (e.g., child ages) solely to calculate appropriate family coverage. Where minors' details are provided, it is done by an adult user and only where necessary.

In accordance with Section 9 of the DPDP Act 2023, we do not process children's data for behavioural tracking, targeted advertising, or profiling.`,
  },
  {
    id: "security",
    title: "8. How we protect your data",
    content: `We implement appropriate technical and organisational measures to protect your personal data, including:

• Encrypted transmission of data between your browser and our servers (HTTPS/TLS).
• Automatic deletion of uploaded files within 24 hours.
• Access controls restricting database access to authorised personnel only.
• Supabase-managed authentication with industry-standard password hashing.
• Calculator inputs you enter may be stored in your browser localStorage to help you continue where you left off; this data stays on your device unless you submit it for analysis.

We will notify you and the Data Protection Board of India in the event of a personal data breach that is likely to affect your rights, as required under the DPDP Act 2023.`,
  },
  {
    id: "cookies",
    title: "9. Cookies and local storage",
    content: `We use minimal browser storage. Full details are available in our Cookie Policy. In summary:

• One first-party cookie (sidebar_state) to remember your dashboard layout preference.
• Browser localStorage is used to save your calculator form progress (ea-theme, IndSure_vehicle_calculator_form, etc.) so you don't lose your inputs if you navigate away.
• Browser sessionStorage is used temporarily during document uploads and analysis — contents are cleared when you close your browser tab.

We do not use advertising cookies or cross-site tracking cookies.`,
  },
  {
    id: "changes",
    title: "10. Changes to this policy",
    content: `We may update this Privacy Policy from time to time. When we make material changes, we will update the "Last updated" date at the top of this page. We encourage you to review this page periodically. Continued use of IndSure after an update constitutes your acceptance of the revised policy.`,
  },
  {
    id: "contact",
    title: "11. Grievance Officer & contact",
    content: `For any questions, concerns, or requests related to this Privacy Policy or your personal data, contact our Grievance Officer:

Grievance Officer: Nikhil Mhaskar
Designation: Director
Email: nikhil@indsure.in
Address: Nashik, Maharashtra, India
Response time: Within 7 working days of receipt of grievance

You may also submit a data rights request or grievance through our Grievance page at ensured.in/grievance.

If you are not satisfied with our response, you may escalate your complaint to the Data Protection Board of India once the Board is constituted and operational under the DPDP Act 2023.`,
  },
];

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Privacy Policy — IndSure";
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
          <h1 className="text-4xl font-semibold text-gray-900 mb-4 leading-tight">Privacy Policy</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Effective date: {EFFECTIVE_DATE}. This policy describes how IndSure collects, uses, stores, and protects
            your personal data in accordance with the{" "}
            <strong className="font-medium text-gray-700">Digital Personal Data Protection Act, 2023 (India)</strong>.
          </p>
        </div>

        {/* DPDP callout */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-6 py-5 mb-12">
          <p className="text-sm font-medium text-blue-800 mb-1">Your rights under DPDP Act 2023</p>
          <p className="text-sm text-blue-700 leading-relaxed">
            As an Indian resident, you have the right to access, correct, and request deletion of your personal data.
            You may also withdraw consent and raise a grievance. See{" "}
            <a href="#your-rights" className="underline">
              Section 6
            </a>{" "}
            for details or visit our{" "}
            <a href="/grievance" className="underline">
              Grievance page
            </a>
            .
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {sections.map((section) => (
            <div key={section.id} id={section.id}>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{section.title}</h2>

              {section.content && (
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line mb-4">{section.content}</p>
              )}

              {"subsections" in section &&
                section.subsections?.map((sub: any, i: number) => (
                  <div key={i} className="mb-5">
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">{sub.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{sub.body}</p>
                  </div>
                ))}

              {("table" in section && section.table && section.id === "how-we-use") && (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Purpose</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data used</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Legal basis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.map((row: any, i: number) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                          <td className="px-4 py-3 text-gray-800 align-top">{row.purpose}</td>
                          <td className="px-4 py-3 text-gray-600 align-top">{row.data}</td>
                          <td className="px-4 py-3 text-gray-600 align-top">{row.basis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {("table" in section && section.table && section.id === "retention") && (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Retention period</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.map((row: any, i: number) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                          <td className="px-4 py-3 text-gray-800 align-top font-medium">{row.type}</td>
                          <td className="px-4 py-3 text-gray-600 align-top">{row.period}</td>
                          <td className="px-4 py-3 text-gray-500 align-top text-xs">{row.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {"rights" in section && section.rights && (
                <div className="space-y-3 mb-4">
                  {section.rights.map((r: any, i: number) => (
                    <div key={i} className="flex gap-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 text-xs font-bold">{i + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-0.5">{r.right}</p>
                        <p className="text-sm text-gray-600">{r.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {"footer" in section && section.footer && (
                <p className="text-sm text-gray-600 mt-4 leading-relaxed">{section.footer}</p>
              )}
            </div>
          ))}
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
          <a href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
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

