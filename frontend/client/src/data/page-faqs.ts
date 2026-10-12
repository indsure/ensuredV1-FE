// FAQ question/answer i18n keys per public page. One list feeds both the
// visible FAQ on the page and the FAQPage JSON-LD that scripts/prerender.mjs
// writes into the static HTML, so the schema always matches what is on screen
// (Google ignores, or penalises, FAQ markup that differs from the page).
//
// A page may show more questions than it lists here: an answer is left out of
// the schema while its on-screen copy is under review (see the notes below).
// Import-free on purpose: prerender bundles this file for Node.

export type FaqKeys = [question: string, answer: string];

export const PAGE_FAQS: Record<string, FaqKeys[]> = {
  "/compare": [
    ["ccmp.faq_q1", "ccmp.faq_a1"],
    ["ccmp.faq_q2", "ccmp.faq_a2"],
    ["ccmp.faq_q3", "ccmp.faq_a3"],
    ["ccmp.faq_q4", "ccmp.faq_a4"],
  ],
  "/calculator": [
    ["cland.faq_q1", "cland.faq_a1"],
    ["cland.faq_q2", "cland.faq_a2"],
    ["cland.faq_q3", "cland.faq_a3"],
    ["cland.faq_q4", "cland.faq_a4"],
  ],
  "/policychecker": [
    ["pcl.faq_q1", "pcl.faq_a1"],
    ["pcl.faq_q2", "pcl.faq_a2"],
    ["pcl.faq_q3", "pcl.faq_a3"],
    ["pcl.faq_q4", "pcl.faq_a4"],
    ["pcl.faq_q5", "pcl.faq_a5"],
  ],
  "/pricing": [
    ["pricing.q1", "pricing.a1"],
    ["pricing.q2", "pricing.a2"],
    ["pricing.q3", "pricing.a3"],
    ["pricing.q4", "pricing.a4"],
    ["pricing.q5", "pricing.a5"],
    ["pricing.q6", "pricing.a6"],
    ["pricing.q7", "pricing.a7"],
  ],
  // how.q6 ("upload up to four policies" to compare) is left out: the public
  // compare works from the plan catalogue, not uploads. Copy under review.
  "/how-it-works": [
    ["how.q1", "how.a1"],
    ["how.q2", "how.a2"],
    ["how.q3", "how.a3"],
    ["how.q4", "how.a4"],
    ["how.q5", "how.a5"],
  ],
  // help.q3 (PDF only; photos are accepted elsewhere), help.q6 (says compare
  // shows premiums) and help.q8 (free plan "check of each type") are left out
  // until their copy is corrected.
  "/help": [
    ["help.q1", "help.a1"],
    ["help.q2", "help.a2"],
    ["help.q4", "help.a4"],
    ["help.q5", "help.a5"],
    ["help.q7", "help.a7"],
  ],
  // advp.q1 (says a comparison uses a check) and advp.q4/q5 (upcoming
  // features and future prices) are left out of the schema.
  "/advisors/pricing": [
    ["advp.q2", "advp.a2"],
    ["advp.q3", "advp.a3"],
    ["advp.q6", "advp.a6"],
    ["advp.q7", "advp.a7"],
    ["advp.q8", "advp.a8"],
    ["advp.q9", "advp.a9"],
  ],
  "/life": [
    ["lobp.q_how", "lobp.l_a_how"],
    ["lobp.q_safe", "lobp.a_safe"],
    ["lobp.q_custom", "lobp.l_a_custom"],
    ["lobp.q_download", "lobp.a_download"],
    ["lobp.q_disagree", "lobp.a_disagree"],
  ],
  "/vehicle": [
    ["lobp.q_how", "lobp.v_a_how"],
    ["lobp.q_safe", "lobp.a_safe"],
    ["lobp.q_custom", "lobp.v_a_custom"],
    ["lobp.q_download", "lobp.a_download"],
    ["lobp.q_disagree", "lobp.a_disagree"],
  ],
};
