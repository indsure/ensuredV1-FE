/**
 * Demo data for the agent playground.
 *
 * Everything here is fake but shaped exactly like the real Supabase tables the
 * agent portal reads (clients/customers/agent_leads/lead_policies/agents/…), so
 * the existing pages render a believable, fully-populated portal. Built around
 * one demo agent (DEMO_AGENT_ID). Dates are computed relative to "now" so the
 * dashboard's "this week / expiring soon / 8-week chart" always looks alive.
 *
 * The store is created once per page load and held in memory: writes during a
 * session (add a lead, tag a customer) stick until reload, then reseed. Nothing
 * ever leaves the browser.
 */

import { DEMO_AGENT_ID, DEMO_EMAIL } from "./mode";

const now = new Date();
const day = 24 * 60 * 60 * 1000;

/** ISO timestamp `n` days ago (negative = future). */
function ago(days: number): string {
  return new Date(now.getTime() - days * day).toISOString();
}
/** `YYYY-MM-DD`, `n` days ago (negative = future). */
function dateAgo(days: number): string {
  return new Date(now.getTime() - days * day).toISOString().slice(0, 10);
}

const INSURERS = {
  star: "Star Health and Allied Insurance Co Ltd",
  hdfc: "HDFC ERGO General Insurance Company Limited",
  care: "Care Health Insurance Limited",
  niva: "Niva Bupa Health Insurance Company Limited",
  icici: "ICICI Lombard General Insurance Company Limited",
  tata: "Tata AIG General Insurance Company Limited",
  digit: "Go Digit General Insurance Limited",
  lic: "Life Insurance Corporation of India",
};

function healthReport(opts: {
  failures: string[];
  actions: { action: string; reason: string }[];
  port: "yes" | "consider" | "no";
  portReason: string;
}) {
  return {
    final_verdict: { key_failure_points: opts.failures },
    recommendations: {
      critical_actions: opts.actions,
      should_port_to_better_policy: { recommendation: opts.port, reason: opts.portReason },
    },
  };
}

export type Store = Record<string, any[]>;

export function buildSeed(): Store {
  const agent = {
    id: DEMO_AGENT_ID,
    full_name: "Rajesh Kumar",
    name: "Rajesh Kumar",
    email: DEMO_EMAIL,
    phone: "+91 98765 43210",
    city: "Indore, MP",
    location: "Indore, MP",
    role: "agent",
    experience_years: 12,
    invite_code: "DEMO2026",
    is_admin: false,
    partnered_companies: ["Star Health and Allied Insurance Co Ltd", "HDFC ERGO General Insurance Company Limited"],
    created_at: ago(420),
  };

  // ---- Customers (the people behind the portfolio) -------------------------
  const customers = [
    { id: "cust-1", agent_id: DEMO_AGENT_ID, name: "Suresh Agarwal", phone: "+91 98200 11111", email: "suresh@example.com", dob: "1972-04-18", city: "Indore", notes: "Prefers WhatsApp. Family floater renewal due soon.", created_at: ago(300) },
    { id: "cust-2", agent_id: DEMO_AGENT_ID, name: "Meena Joshi", phone: "+91 98200 22222", email: "meena@example.com", dob: "1980-11-02", city: "Bhopal", notes: "Diabetic — needs disease-specific cover.", created_at: ago(220) },
    { id: "cust-3", agent_id: DEMO_AGENT_ID, name: "Vikram Singh", phone: "+91 98200 33333", email: null, dob: "1968-01-25", city: "Ujjain", notes: "Senior citizen plan. Call, don't text.", created_at: ago(180) },
    { id: "cust-4", agent_id: DEMO_AGENT_ID, name: "Anita Desai", phone: "+91 98200 44444", email: "anita@example.com", dob: "1985-07-09", city: "Indore", notes: "Young family, first policy.", created_at: ago(95) },
    { id: "cust-5", agent_id: DEMO_AGENT_ID, name: "Prakash Mehta", phone: "+91 98200 55555", email: "prakash@example.com", dob: "1976-03-30", city: "Dewas", notes: "Has car + health. Cross-sell life.", created_at: ago(60) },
  ];

  // ---- Clients (analysed policies = the agent's book) ----------------------
  const clients = [
    {
      id: "pol-1", agent_id: DEMO_AGENT_ID, customer_id: "cust-1",
      policy_name: "Family Health Optima", name: "Suresh Agarwal", policyholder_name: "Suresh Agarwal",
      insurer: INSURERS.star, insurance_type: "health", status: "done", score: 58,
      sum_insured: 500000, expiry_date: dateAgo(-18), created_at: ago(5),
      share_token: "demo-share-1", share_enabled: true, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        failures: ["Room rent capped at 1% of sum insured", "2-year wait for diabetes", "Co-pay of 20% on every claim"],
        actions: [{ action: "Port to a no-room-rent-cap plan before renewal", reason: "Room cap forces large out-of-pocket on hospitalisation" }],
        port: "yes", portReason: "Better plans at similar premium remove the room-rent cap and co-pay.",
      }),
    },
    {
      id: "pol-2", agent_id: DEMO_AGENT_ID, customer_id: "cust-2",
      policy_name: "ReAssure 2.0", name: "Meena Joshi", policyholder_name: "Meena Joshi",
      insurer: INSURERS.niva, insurance_type: "health", status: "done", score: 82,
      sum_insured: 1000000, expiry_date: dateAgo(-120), created_at: ago(9),
      share_token: "demo-share-2", share_enabled: true, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        failures: ["Maternity has a 3-year wait"],
        actions: [{ action: "Add OPD rider at renewal", reason: "Frequent doctor visits not currently covered" }],
        port: "no", portReason: "Strong base plan — keep it, just add riders.",
      }),
    },
    {
      id: "pol-3", agent_id: DEMO_AGENT_ID, customer_id: "cust-3",
      policy_name: "Senior Citizen Red Carpet", name: "Vikram Singh", policyholder_name: "Vikram Singh",
      insurer: INSURERS.star, insurance_type: "health", status: "done", score: 49,
      sum_insured: 300000, expiry_date: dateAgo(-9), created_at: ago(12),
      share_token: "demo-share-3", share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        failures: ["50% co-pay on all claims", "Sum insured too low for age", "Pre-existing wait of 2 years"],
        actions: [
          { action: "Increase sum insured to at least ₹5L", reason: "₹3L is inadequate for senior hospitalisation" },
          { action: "Move to a plan with lower co-pay", reason: "50% co-pay defeats the purpose of cover" },
        ],
        port: "yes", portReason: "Co-pay and low SI make this risky; better senior plans exist.",
      }),
    },
    {
      id: "pol-4", agent_id: DEMO_AGENT_ID, customer_id: "cust-4",
      policy_name: "Optima Secure", name: "Anita Desai", policyholder_name: "Anita Desai",
      insurer: INSURERS.hdfc, insurance_type: "health", status: "done", score: 91,
      sum_insured: 1500000, expiry_date: dateAgo(-200), created_at: ago(18),
      share_token: "demo-share-4", share_enabled: true, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        failures: [],
        actions: [],
        port: "no", portReason: "Excellent comprehensive plan. No action needed.",
      }),
    },
    {
      id: "pol-5", agent_id: DEMO_AGENT_ID, customer_id: "cust-5",
      policy_name: "Care Supreme", name: "Prakash Mehta", policyholder_name: "Prakash Mehta",
      insurer: INSURERS.care, insurance_type: "health", status: "done", score: 67,
      sum_insured: 700000, expiry_date: dateAgo(-25), created_at: ago(22),
      share_token: "demo-share-5", share_enabled: true, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        failures: ["Sub-limit on cataract", "No restoration benefit"],
        actions: [{ action: "Add unlimited restoration rider", reason: "Single big claim can exhaust the cover for the year" }],
        port: "consider", portReason: "Decent plan; a top-up or rider closes the gaps cheaply.",
      }),
    },
    {
      id: "pol-6", agent_id: DEMO_AGENT_ID, customer_id: "cust-2",
      policy_name: "Activ One MAX", name: "Meena Joshi", policyholder_name: "Meena Joshi",
      insurer: INSURERS.icici, insurance_type: "health", status: "done", score: 74,
      sum_insured: 1000000, expiry_date: dateAgo(-300), created_at: ago(30),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        failures: ["Disease-wise sub-limits"],
        actions: [{ action: "Review sub-limits at renewal", reason: "Caps may not match treatment costs in metros" }],
        port: "no", portReason: "Good value; monitor sub-limits.",
      }),
    },
    // A couple of data-entry (non-health) policies to show multi-LoB
    {
      id: "pol-7", agent_id: DEMO_AGENT_ID, customer_id: "cust-5",
      policy_name: "Private Car Package", name: "Prakash Mehta", policyholder_name: "Prakash Mehta",
      insurer: INSURERS.digit, insurance_type: "motor", status: "done", score: null,
      sum_insured: 650000, expiry_date: dateAgo(-12), created_at: ago(14),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null,
      extracted_data: { premium: 18400, vehicle: "Hyundai Creta", reg_no: "MP09 CX 4521" },
    },
    {
      id: "pol-8", agent_id: DEMO_AGENT_ID, customer_id: "cust-1",
      policy_name: "Jeevan Anand", name: "Suresh Agarwal", policyholder_name: "Suresh Agarwal",
      insurer: INSURERS.lic, insurance_type: "life", status: "done", score: null,
      sum_insured: 2000000, expiry_date: dateAgo(-150), created_at: ago(40),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null,
      extracted_data: { premium: 48000, term_years: 21, mode: "Yearly" },
    },
    // In-flight + failed, so My Queue and the failures panel have content
    {
      id: "pol-9", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: "Health Companion", name: "Deepak Verma", policyholder_name: "Deepak Verma",
      insurer: INSURERS.niva, insurance_type: "health", status: "processing", score: null,
      sum_insured: null, expiry_date: null, created_at: ago(0.05),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null, extracted_data: null,
    },
    {
      id: "pol-10", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: "Young Star", name: "Pooja Nair", policyholder_name: "Pooja Nair",
      insurer: INSURERS.star, insurance_type: "health", status: "pending", score: null,
      sum_insured: null, expiry_date: null, created_at: ago(0.2),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null, extracted_data: null,
    },
    {
      id: "pol-11", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: "Scanned upload", name: "Rohit Sharma", policyholder_name: "Rohit Sharma",
      insurer: INSURERS.hdfc, insurance_type: "health", status: "error", score: null,
      sum_insured: null, expiry_date: null, created_at: ago(2),
      share_token: null, share_enabled: false, pdf_url: "#",
      error_message: "Document was blurry — couldn't read the policy schedule.",
      flaws: [], report_data: null, extracted_data: null,
    },
    {
      id: "pol-12", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: "Old policy", name: "Sunita Rao", policyholder_name: "Sunita Rao",
      insurer: INSURERS.tata, insurance_type: "health", status: "error", score: null,
      sum_insured: null, expiry_date: null, created_at: ago(20),
      share_token: null, share_enabled: false, pdf_url: "#",
      error_message: "Password-protected PDF.",
      flaws: [], report_data: null, extracted_data: null,
    },
  ];

  // ---- Leads (prospect pipeline) ------------------------------------------
  const agent_leads = [
    { id: "lead-1", agent_id: DEMO_AGENT_ID, name: "Aarti Kulkarni", phone: "+91 99000 11111", email: "aarti@example.com", city: "Indore", source: "Referral", insurance_interest: "Family health", expected_value: 35000, status: "new", next_follow_up: dateAgo(-1), notes: "Referred by Suresh. Wants ₹10L floater.", customer_id: null, created_at: ago(2), updated_at: ago(2) },
    { id: "lead-2", agent_id: DEMO_AGENT_ID, name: "Manoj Tiwari", phone: "+91 99000 22222", email: null, city: "Bhopal", source: "WhatsApp", insurance_interest: "Car insurance", expected_value: 12000, status: "contacted", next_follow_up: dateAgo(-3), notes: "Renewal coming up next month.", customer_id: null, created_at: ago(6), updated_at: ago(3) },
    { id: "lead-3", agent_id: DEMO_AGENT_ID, name: "Shilpa Reddy", phone: "+91 99000 33333", email: "shilpa@example.com", city: "Indore", source: "Walk-in", insurance_interest: "Term life", expected_value: 60000, status: "interested", next_follow_up: dateAgo(-2), notes: "Comparing 2 term plans. Send comparison.", customer_id: null, created_at: ago(10), updated_at: ago(2) },
    { id: "lead-4", agent_id: DEMO_AGENT_ID, name: "Imran Khan", phone: "+91 99000 44444", email: null, city: "Ujjain", source: "Phone call", insurance_interest: "Senior health", expected_value: 28000, status: "interested", next_follow_up: dateAgo(1), notes: "For his parents.", customer_id: null, created_at: ago(14), updated_at: ago(5) },
    { id: "lead-5", agent_id: DEMO_AGENT_ID, name: "Geeta Bansal", phone: "+91 99000 55555", email: "geeta@example.com", city: "Dewas", source: "Website", insurance_interest: "Health top-up", expected_value: 9000, status: "won", next_follow_up: null, notes: "Closed! Convert to customer.", customer_id: null, created_at: ago(25), updated_at: ago(1) },
    { id: "lead-6", agent_id: DEMO_AGENT_ID, name: "Rakesh Yadav", phone: "+91 99000 66666", email: null, city: "Indore", source: "Social media", insurance_interest: "Bike insurance", expected_value: 3500, status: "lost", next_follow_up: null, notes: "Went with online quote. Too cheap to match.", customer_id: null, created_at: ago(30), updated_at: ago(8) },
  ];

  // ---- Lead policies (prospect's existing cover → renewal hit-list) --------
  const lead_policies = [
    { id: "lp-1", lead_id: "lead-2", agent_id: DEMO_AGENT_ID, insurance_type: "motor", insurer: INSURERS.digit, policy_name: "Two-wheeler package", policyholder_name: "Manoj Tiwari", premium: 1850, due_date: dateAgo(-8), file_url: "#", file_name: "manoj-bike.pdf", extracted_data: { reg_no: "MP04 AB 1234" }, spoken_to: false, notes: "", created_at: ago(6), updated_at: ago(6) },
    { id: "lp-2", lead_id: "lead-4", agent_id: DEMO_AGENT_ID, insurance_type: "health", insurer: INSURERS.care, policy_name: "Existing senior plan", policyholder_name: "Imran Khan (parents)", premium: 31000, due_date: dateAgo(-22), file_url: "#", file_name: "parents-health.pdf", extracted_data: null, spoken_to: true, notes: "Current cover only ₹3L.", created_at: ago(14), updated_at: ago(5) },
    { id: "lp-3", lead_id: "lead-3", agent_id: DEMO_AGENT_ID, insurance_type: "life", insurer: INSURERS.lic, policy_name: "Old endowment", policyholder_name: "Shilpa Reddy", premium: 22000, due_date: dateAgo(-3), file_url: "#", file_name: "shilpa-lic.pdf", extracted_data: null, spoken_to: false, notes: "", created_at: ago(10), updated_at: ago(10) },
  ];

  // ---- Misc tables read across the portal (kept light) ---------------------
  const agent_credits = [{ id: "cred-1", agent_id: DEMO_AGENT_ID, balance: 25 }];

  const calculator_reports = [
    { id: "calc-1", agent_id: DEMO_AGENT_ID, customer_id: "cust-4", uuid: "demo-calc-1", inputs: { age: 38, members: 4, city_tier: 1 }, recommended_cover: 1500000, created_at: ago(7) },
    { id: "calc-2", agent_id: DEMO_AGENT_ID, customer_id: null, uuid: "demo-calc-2", inputs: { age: 55, members: 2, city_tier: 2 }, recommended_cover: 1000000, created_at: ago(20) },
  ];

  return {
    agents: [agent],
    agent_credits,
    customers,
    clients,
    agent_leads,
    lead_policies,
    calculator_reports,
    // Tables some pages query but the demo leaves empty — return [] gracefully.
    report_shares: [],
    invite_codes: [],
    reports: [],
    empanelments: [],
  };
}

/**
 * Canned head-to-head used by the Compare page in playground mode (both the
 * "see a sample comparison" shortcut and the simulated /api/agent/compare).
 * Mirrors CompareResponse in ../wordingProfile. Star Optima vs HDFC Optima
 * Secure — B wins clearly, so the side-by-side reads convincingly.
 */
const row = (
  key: string,
  label: string,
  group: string,
  aDisp: string,
  bDisp: string,
  winner: "a" | "b" | "tie" | "na",
  notes?: { a?: string; b?: string }
) => ({
  key, label, group,
  a: { display: aDisp, note: notes?.a ?? null },
  b: { display: bDisp, note: notes?.b ?? null },
  winner,
});

export const DEMO_COMPARE_RESPONSE = {
  result: {
    a: { insurer: "Star Health and Allied Insurance Co Ltd", plan_name: "Family Health Optima", uin: "SHAHLIP21211V032021", sum_insured_options: "₹3L – ₹25L", confidence: "high" },
    b: { insurer: "HDFC ERGO General Insurance Company Limited", plan_name: "Optima Secure", uin: "HDFHLIP21024V042021", sum_insured_options: "₹5L – ₹2Cr", confidence: "high" },
    groups: [
      {
        group: "money_at_claim", label: "Money at claim time",
        rows: [
          row("room_rent", "Room rent limit", "money_at_claim", "Single private A/C room (capped)", "No room-rent cap", "b", { a: "Higher-category room triggers proportionate deduction" }),
          row("copay", "Co-payment", "money_at_claim", "20% zone-based co-pay", "No co-pay", "b"),
          row("deductible", "Deductible", "money_at_claim", "Nil", "Nil", "tie"),
        ],
      },
      {
        group: "waiting", label: "Waiting periods",
        rows: [
          row("ped", "Pre-existing diseases", "waiting", "36 months", "36 months", "tie"),
          row("specific", "Specific illnesses", "waiting", "24 months", "24 months", "tie"),
          row("initial", "Initial waiting", "waiting", "30 days", "30 days", "tie"),
        ],
      },
      {
        group: "bonus_reset", label: "Bonus & restore",
        rows: [
          row("ncb", "No-claim bonus", "bonus_reset", "Up to 100%", "Up to 100%", "tie"),
          row("restore", "Restore benefit", "bonus_reset", "Once a year (unrelated illness only)", "Unlimited (related + unrelated)", "b"),
        ],
      },
      {
        group: "coverages", label: "What's covered",
        rows: [
          row("prepost", "Pre/post hospitalisation", "coverages", "60 / 90 days", "60 / 180 days", "b"),
          row("daycare", "Day-care procedures", "coverages", "All day-care", "All day-care", "tie"),
          row("maternity", "Maternity", "coverages", "Not covered", "Optional add-on", "b"),
        ],
      },
      {
        group: "fine_print", label: "The fine print",
        rows: [
          row("proportionate", "Proportionate deduction", "fine_print", "Applies if room category exceeded", "Not applicable", "b"),
          row("sublimits", "Disease sub-limits", "fine_print", "Cataract & a few others capped", "No disease-wise sub-limits", "b"),
        ],
      },
    ],
    verdict: {
      winner: "b", winner_name: "HDFC ERGO Optima Secure",
      score_a: 61, score_b: 89, wins_a: 0, wins_b: 7, ties: 6,
      reasons: [
        "No room-rent cap and no co-pay — the client pays far less out of pocket at claim time.",
        "Unlimited restore covers repeat claims in the same year.",
        "Longer post-hospitalisation cover (180 vs 90 days) and no disease sub-limits.",
      ],
      counterpoint: "Star Family Health Optima usually has a slightly lower premium and a wider hospital network in smaller towns — worth weighing if budget is tight.",
    },
  },
  profiles: { a: null, b: null },
} as const;

