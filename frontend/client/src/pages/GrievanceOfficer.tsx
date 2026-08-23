// frontend/client/src/pages/GrievanceOfficer.tsx
// Drop this file into your pages directory and add a Wouter route:
// <Route path="/grievance" component={GrievanceOfficer} />
//
// BEFORE GOING LIVE — fill in the following placeholders:
// 1. GRIEVANCE_OFFICER_NAME — full name of your designated Grievance Officer
// 2. GRIEVANCE_OFFICER_DESIGNATION — their job title
// 3. REGISTERED_ADDRESS — IndSure's registered business address
// 4. GRIEVANCE_EMAIL — dedicated email (e.g. grievance@ensured.in) — create this mailbox

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

// ─── FILL THESE IN BEFORE GOING LIVE ────────────────────────────────────────
const GRIEVANCE_OFFICER_NAME = "Nikhil Mhaskar";
const GRIEVANCE_OFFICER_DESIGNATION = "Director";
const GRIEVANCE_EMAIL = "nikhil@indsure.in";
const REGISTERED_ADDRESS = "Nashik, Maharashtra, India";
// ────────────────────────────────────────────────────────────────────────────

type RequestType = "access" | "correction" | "erasure" | "withdraw_consent" | "grievance" | "other";

const requestTypes: { value: RequestType; label: string; desc: string }[] = [
  { value: "access", label: "Right to access", desc: "Request a summary of the personal data we hold about you" },
  { value: "correction", label: "Right to correction", desc: "Ask us to correct inaccurate or incomplete data" },
  { value: "erasure", label: "Right to erasure / deletion", desc: "Request that we delete your personal data" },
  { value: "withdraw_consent", label: "Withdraw consent", desc: "Withdraw consent for data processing based on consent" },
  { value: "grievance", label: "Raise a grievance", desc: "Report mishandling of your personal data" },
  { value: "other", label: "Other data query", desc: "Any other question about your personal data" },
];

type FormState = {
  name: string;
  email: string;
  phone: string;
  requestType: RequestType | "";
  details: string;
  acknowledgement: boolean;
};

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function GrievanceOfficer() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    requestType: "",
    details: "",
    acknowledgement: false,
  });
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Grievance Officer — IndSure";
  }, []);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) newErrors.name = "Full name is required.";
    if (!form.email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (!form.requestType) newErrors.requestType = "Please select a request type.";
    if (!form.details.trim() || form.details.trim().length < 20) {
      newErrors.details = "Please provide at least 20 characters describing your request.";
    }
    if (!form.acknowledgement) newErrors.acknowledgement = "You must acknowledge this to submit.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus("submitting");
    try {
      const res = await apiFetch("/api/grievance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          requestType: form.requestType,
          details: form.details,
          acknowledgement: form.acknowledgement,
          submittedAt: new Date().toISOString(),
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Request failed with status ${res.status}`);
      }

      setStatus("success");
      setForm({ name: "", email: "", phone: "", requestType: "", details: "", acknowledgement: false });
    } catch {
      setStatus("error");
    }
  };

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const inputClass = (field: keyof FormState) =>
    `w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
      errors[field]
        ? "border-red-300 bg-red-50 focus:ring-red-400"
        : "border-gray-200 bg-white hover:border-gray-300"
    }`;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="inline-flex min-h-11 items-center text-sm text-gray-500 hover:text-gray-800 transition-colors">
            ← Back to IndSure
          </a>
          <span className="text-xs text-gray-400">DPDP Act 2023 — Section 13</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">
        {/* Title */}
        <div className="mb-10">
          <p className="text-xs font-medium tracking-widest text-gray-400 uppercase mb-3">Legal</p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-4 leading-tight">Grievance Officer</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Under Section 13 of the Digital Personal Data Protection Act, 2023 (India), IndSure has
            designated a Grievance Officer to address data-related queries and complaints.
          </p>
        </div>

        {/* Officer card */}
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mb-12">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Grievance Officer details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Name</p>
              <p className="text-gray-800 font-medium">{GRIEVANCE_OFFICER_NAME}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Designation</p>
              <p className="text-gray-800">{GRIEVANCE_OFFICER_DESIGNATION}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
              <a href={`mailto:${GRIEVANCE_EMAIL}`} className="text-blue-600 hover:underline">
                {GRIEVANCE_EMAIL}
              </a>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Response time</p>
              <p className="text-gray-800">Within 7 working days of receipt</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Address</p>
              <p className="text-gray-800">{REGISTERED_ADDRESS}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Submit a request or grievance</h2>
          <p className="text-sm text-gray-500 mb-8">
            Fill in the form below. You will receive an acknowledgement email within 48 hours and a
            substantive response within 7 working days.
          </p>

          {status === "success" ? (
            <div className="bg-green-50 border border-green-100 rounded-2xl px-8 py-10 text-center">
              <h3 className="text-lg font-semibold text-green-900 mb-2">Request submitted</h3>
              <p className="text-sm text-green-700 max-w-sm mx-auto">
                Thank you. We have received your request and will respond within 7 working days. Check your email for an acknowledgement.
              </p>
              <button onClick={() => setStatus("idle")} className="mt-6 text-sm text-green-700 underline hover:no-underline">
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Full name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Your full name"
                    className={inputClass("name")}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="you@example.com"
                    className={inputClass("email")}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone number <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+91 99999 99999"
                  className={inputClass("phone")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Request type <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {requestTypes.map((rt) => (
                    <label
                      key={rt.value}
                      className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.requestType === rt.value ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="requestType"
                        value={rt.value}
                        checked={form.requestType === rt.value}
                        onChange={() => handleChange("requestType", rt.value)}
                        className="mt-0.5 flex-shrink-0 accent-blue-600"
                      />
                      <div>
                        <p className={`text-sm font-medium ${form.requestType === rt.value ? "text-blue-800" : "text-gray-800"}`}>{rt.label}</p>
                        <p className={`text-xs mt-0.5 ${form.requestType === rt.value ? "text-blue-600" : "text-gray-400"}`}>{rt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.requestType && <p className="text-red-500 text-xs mt-1">{errors.requestType}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Details of your request <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={5}
                  value={form.details}
                  onChange={(e) => handleChange("details", e.target.value)}
                  placeholder="Please describe your request or grievance in detail."
                  className={inputClass("details")}
                  style={{ resize: "vertical" }}
                />
                <p className="text-gray-400 text-xs mt-1 text-right">{form.details.length} characters</p>
                {errors.details && <p className="text-red-500 text-xs mt-1">{errors.details}</p>}
              </div>

              <div>
                <label
                  className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                    errors.acknowledgement ? "border-red-200 bg-red-50" : "border-gray-100 bg-gray-50 hover:border-gray-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.acknowledgement}
                    onChange={(e) => handleChange("acknowledgement", e.target.checked)}
                    className="mt-0.5 flex-shrink-0 accent-blue-600"
                  />
                  <p className="text-sm text-gray-600">
                    I confirm that the information provided is accurate and that I am the data principal (or an authorised representative).
                  </p>
                </label>
                {errors.acknowledgement && <p className="text-red-500 text-xs mt-1">{errors.acknowledgement}</p>}
              </div>

              {status === "error" && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                  Something went wrong. Please try again or email us directly at{" "}
                  <a href={`mailto:${GRIEVANCE_EMAIL}`} className="underline">
                    {GRIEVANCE_EMAIL}
                  </a>
                  .
                </div>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full sm:w-auto px-8 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "submitting" ? "Submitting..." : "Submit request"}
              </button>

              <p className="text-xs text-gray-400">
                You will receive an acknowledgement at the email you provided. For urgent matters, email{" "}
                <a href={`mailto:${GRIEVANCE_EMAIL}`} className="text-blue-500 hover:underline">
                  {GRIEVANCE_EMAIL}
                </a>{" "}
                directly.
              </p>
            </form>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-wrap gap-x-4 text-sm [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
          <a href="/privacy-policy" className="text-blue-600 hover:underline">
            Privacy Policy
          </a>
          <a href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </a>
          <a href="/cookie-policy" className="text-blue-600 hover:underline">
            Cookie Policy
          </a>
        </div>
      </div>
    </div>
  );
}

