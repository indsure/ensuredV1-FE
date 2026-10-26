// /refunds: Refund and Cancellation policy. Cashfree requires this page before live payments,
// and the Consumer Protection (E-Commerce) Rules require it for online sales.
// Source of every rule here: founder decisions 2026-10-26, docs/plans/2026-10-26-cashfree-payments.md.
// Behaviour it describes: backend/server/services/payments.ts (no auto-renew, 3-day grace).

import { LegalHindiNote } from "@/components/LegalHindiNote";
import { useEffect } from "react";
import { useSEO } from "@/hooks/use-seo";
import { seoFor } from "@/data/seo-pages";
import { teamWaLink } from "@/components/app/portfolio-utils";

const LAST_UPDATED = "26 October 2026";

export default function Refunds() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useSEO(seoFor("/refunds"));

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="inline-flex min-h-11 items-center text-sm text-gray-500 hover:text-gray-800 transition-colors">
            ← Back to IndSure
          </a>
          <span className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="mb-12">
          <p className="text-sm font-medium tracking-widest text-gray-500 uppercase mb-3">Legal</p>
          <LegalHindiNote />
          <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-4 leading-tight">Refund and Cancellation Policy</h1>
          <p className="text-gray-600 text-[15px] leading-relaxed">
            This page explains how you pay for IndSure, how to stop, and when you can get your money back.
          </p>
        </div>

        <div className="space-y-10 text-[15px] text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. What you pay for</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Advisor plans: Agent, ₹1,499 for one month or ₹14,990 for one year.</li>
              <li>Extra policy checks for advisors on a paid plan: ₹449 for 5 checks, ₹1,199 for 15 checks.</li>
              <li>Personal plan for individuals: ₹99 for one month or ₹999 for one year.</li>
            </ul>
            <p className="mt-3">
              All prices are in Indian Rupees. You pay online through our payment partner, Cashfree Payments,
              by UPI, debit or credit card, or netbanking. We never see or store your card details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Nothing renews by itself</h2>
            <p>
              Every payment is a one-time payment. We do not save your card or set up automatic debits. When your
              month or year is about to end, we remind you by email, and you choose whether to pay again.
            </p>
            <p className="mt-3">
              If you do not pay again, your plan keeps working for 3 more days after its end date. After that your
              account moves to the free plan. Your policies, customers and reports stay in your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Cancelling</h2>
            <p>
              Because nothing renews by itself, there is nothing to cancel. Simply do not pay again. Your plan runs
              until the end of the period you paid for.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Refunds: 7 days, if nothing was used</h2>
            <p>You can ask for a full refund of a payment when both of these are true:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>it is within 7 days of the payment, and</li>
              <li>no policy check has been used on your account since that payment.</li>
            </ul>
            <p className="mt-3">
              If even one policy check has been used after the payment, that payment cannot be refunded. We do not
              ask for a reason. When a refund is approved, the plan or checks bought with that payment are removed.
            </p>
            <p className="mt-3">
              Refunds go back to the same UPI account, card or bank account you paid from. Your bank usually shows
              it within 5 to 7 working days after we approve it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. If a payment fails</h2>
            <p>
              If money leaves your account but the payment does not complete, it is not kept by us. Your bank or
              Cashfree returns it automatically, usually within 3 to 5 working days. If it does not, contact us
              with the payment reference shown on screen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. How to ask</h2>
            <p>
              Message us on{" "}
              <a
                href={teamWaLink("Hi, I would like a refund for my IndSure payment.")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 underline"
              >
                WhatsApp
              </a>{" "}
              or email{" "}
              <a href="mailto:tech@indsure.in" className="text-teal-700 underline">tech@indsure.in</a>{" "}
              with the payment reference from your receipt email. We reply within 2 working days.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
