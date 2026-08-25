/**
 * Demo data and API for the agency team, in playground mode.
 *
 * The team surface is the one part of the portal that never touches supabase-js:
 * every read goes through a backend endpoint so that an owner opening a member's
 * book leaves an audit row (see teamRoutes.ts). That makes it invisible in the
 * playground unless those endpoints are mocked too — which is what this file is.
 *
 * The demo agent (Rajesh Kumar) is the OWNER, so a visitor lands in the seat the
 * feature was built for. Writes mutate the in-memory state, so inviting an
 * advisor or moving checks actually changes the screen and sticks until reload —
 * a demo where the buttons do nothing is worse than no demo.
 *
 * Nothing here leaves the browser, and none of these people exist.
 */

import { DEMO_AGENT_ID } from "./mode";

const now = new Date();
const day = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(now.getTime() - days * day).toISOString();
const dateAgo = (days: number) => new Date(now.getTime() - days * day).toISOString().slice(0, 10);

export const CHECKS_PER_SEAT = 10;

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  created_at: string;
  is_owner: boolean;
  checks_left: number;
  entry_left: number;
  last_activity_at: string;
};

type Invite = {
  id: string;
  email: string;
  invited_name: string | null;
  expires_at: string;
  created_at: string;
};

type TeamState = {
  team: { id: string; name: string; seats: number };
  members: Member[];
  invites: Invite[];
};

/** Built once per page load, then mutated by the demo's own actions. */
let state: TeamState | null = null;

function build(): TeamState {
  return {
    team: { id: "demo-team-0000-0000-000000000001", name: "Shreyas Insurance Services", seats: 6 },
    members: [
      {
        id: DEMO_AGENT_ID, name: "Rajesh Kumar", email: "rajesh@shreyasinsure.in",
        phone: "+91 98200 10001", city: "Indore", created_at: ago(420),
        is_owner: true, checks_left: 4, entry_left: 31, last_activity_at: ago(0),
      },
      {
        // Deliberately at zero: the "someone is stuck, move them checks" state is
        // the most interesting thing on this screen and a demo should open on it.
        id: "demo-member-0000-0000-000000000002", name: "Priya Deshmukh", email: "priya@shreyasinsure.in",
        phone: "+91 98200 10002", city: "Indore", created_at: ago(74),
        is_owner: false, checks_left: 0, entry_left: 12, last_activity_at: ago(0),
      },
      {
        id: "demo-member-0000-0000-000000000003", name: "Imran Qureshi", email: "imran@shreyasinsure.in",
        phone: "+91 98200 10003", city: "Bhopal", created_at: ago(51),
        is_owner: false, checks_left: 8, entry_left: 44, last_activity_at: ago(2),
      },
      {
        id: "demo-member-0000-0000-000000000004", name: "Anjali Nair", email: "anjali@shreyasinsure.in",
        phone: "+91 98200 10004", city: "Ujjain", created_at: ago(33),
        is_owner: false, checks_left: 6, entry_left: 39, last_activity_at: ago(6),
      },
    ],
    invites: [
      {
        id: "demo-invite-0000-0000-000000000001",
        email: "sneha.iyer@gmail.com",
        invited_name: "Sneha Iyer",
        expires_at: ago(-5),
        created_at: ago(2),
      },
    ],
  };
}

function getTeam(): TeamState {
  if (!state) state = build();
  return state;
}

/* ── Each member's book ───────────────────────────────────────────────────── */

// Generated per member from a fixed roster so the numbers on the Team tab match
// what you actually see when you open somebody's book. A demo that says "24
// customers" and then lists three is worse than one that says three.

const BOOKS: Record<string, { customers: string[]; insurers: string[]; cities: string[] }> = {
  "demo-member-0000-0000-000000000002": {
    customers: ["Kavita Joshi", "Deepak Shetty", "Farida Merchant", "Ramesh Iyer", "Sunita Bhosale", "Arjun Kulkarni", "Nandini Rao", "Vivek Pandit"],
    insurers: ["Niva Bupa Health Insurance", "Star Health and Allied Insurance", "ICICI Lombard", "HDFC Life", "Care Health Insurance"],
    cities: ["Indore", "Dewas", "Indore", "Ujjain", "Indore"],
  },
  "demo-member-0000-0000-000000000003": {
    customers: ["Salim Ansari", "Rekha Verma", "Yusuf Shaikh", "Pooja Mandloi"],
    insurers: ["Bajaj Allianz General", "Tata AIG General Insurance", "Care Health Insurance"],
    cities: ["Bhopal", "Bhopal", "Sehore"],
  },
  "demo-member-0000-0000-000000000004": {
    customers: ["Girish Tiwari", "Manju Sharma", "Alok Dubey", "Shreya Bhatt", "Hemant Rathore", "Divya Chouhan"],
    insurers: ["HDFC Ergo General Insurance", "Star Health and Allied Insurance", "Go Digit General Insurance"],
    cities: ["Ujjain", "Indore", "Ujjain"],
  },
  [DEMO_AGENT_ID]: {
    customers: ["Suresh Agarwal", "Meena Joshi", "Vikram Singh", "Anita Desai", "Prakash Mehta"],
    insurers: ["Star Health and Allied Insurance", "HDFC ERGO General Insurance", "Care Health Insurance"],
    cities: ["Indore", "Bhopal", "Ujjain"],
  },
};

const TYPES = ["Health", "Health", "Motor", "Term", "Health", "Motor"];
const SCORES = [58, 74, 81, 90, 63, 47, 88, 71];
const REC = ["Switch at renewal", "Review clauses", "Keep", "Keep", "Review add-ons", "Switch at renewal"];

function bookFor(memberId: string) {
  return BOOKS[memberId] ?? { customers: ["Demo Customer"], insurers: ["Star Health"], cities: ["Indore"] };
}

function policiesFor(memberId: string) {
  const b = bookFor(memberId);
  return b.customers.map((name, i) => ({
    id: `${memberId}-pol-${i}`,
    name,
    policyholder_name: name,
    insurer: b.insurers[i % b.insurers.length],
    insurance_type: TYPES[i % TYPES.length],
    policy_name: null,
    sum_insured: [500000, 1000000, 300000, 2500000][i % 4],
    expiry_date: dateAgo(-(8 + i * 11)),
    score: SCORES[i % SCORES.length],
    status: "done",
    created_at: ago(30 + i * 9),
    recommendation: REC[i % REC.length],
  }));
}

function customersFor(memberId: string) {
  const b = bookFor(memberId);
  return b.customers.map((name, i) => ({
    id: `${memberId}-cust-${i}`,
    name,
    phone: `+91 98${String(200 + i).padStart(3, "0")} ${String(10000 + i * 7).slice(0, 5)}`,
    email: null,
    city: b.cities[i % b.cities.length],
    created_at: ago(60 + i * 12),
    policies: 1 + (i % 3),
  }));
}

function leadsFor(memberId: string) {
  const b = bookFor(memberId);
  const statuses = ["new", "contacted", "quoted", "follow_up"];
  return b.customers.slice(0, Math.max(2, b.customers.length - 3)).map((name, i) => ({
    id: `${memberId}-lead-${i}`,
    name: `${name.split(" ")[0]} ${["Verma", "Patel", "Nair", "Sinha"][i % 4]}`,
    phone: `+91 97${String(300 + i).padStart(3, "0")} ${String(20000 + i * 13).slice(0, 5)}`,
    city: b.cities[i % b.cities.length],
    source: ["WhatsApp", "Referral", "My Page", "Walk-in"][i % 4],
    insurance_interest: ["Health", "Term", "Motor"][i % 3],
    expected_value: [18000, 25000, 9000][i % 3],
    status: statuses[i % statuses.length],
    next_follow_up: dateAgo(-(2 + i * 3)),
    created_at: ago(10 + i * 5),
  }));
}

function claimsFor(memberId: string) {
  const b = bookFor(memberId);
  const n = memberId === "demo-member-0000-0000-000000000002" ? 3 : memberId === DEMO_AGENT_ID ? 2 : 1;
  const statuses = ["under_process", "query_raised", "settled"];
  return Array.from({ length: n }, (_, i) => ({
    id: `${memberId}-claim-${i}`,
    claim_type: i % 2 === 0 ? "reimbursement" : "cashless",
    status: statuses[i % statuses.length],
    insurer: b.insurers[i % b.insurers.length],
    tpa: ["Medi Assist", "Paramount", null][i % 3],
    hospital: ["Bombay Hospital, Indore", "CHL Hospital, Indore", "Chirayu Hospital, Bhopal"][i % 3],
    ailment: ["Dengue with thrombocytopenia", "Laparoscopic cholecystectomy", "Angioplasty"][i % 3],
    claimed_amount: [86000, 145000, 320000][i % 3],
    settled_amount: statuses[i % statuses.length] === "settled" ? [74000, 132000, 298000][i % 3] : null,
    created_at: ago(14 + i * 8),
    customer_name: b.customers[i % b.customers.length],
    query_rounds: i % 2,
  }));
}

/* ── The mocked endpoints ─────────────────────────────────────────────────── */

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function memberSummary(m: Member) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    created_at: m.created_at,
    is_owner: m.is_owner,
    checks_left: m.checks_left,
    entry_left: m.entry_left,
    customers: customersFor(m.id).length,
    policies: policiesFor(m.id).length,
    last_activity_at: m.last_activity_at,
  };
}

function idFromPath(url: string, after: string): string {
  const rest = url.split(after)[1] ?? "";
  return rest.split(/[/?#]/)[0];
}

function bodyOf(init: any): any {
  try {
    return JSON.parse(init?.body ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Answer a team API call, or return null so the caller falls through to the
 * rest of the playground mock. Order matters: the longer paths are tested
 * first, because "/api/team" is a prefix of every one of them.
 */
export function playgroundTeamApi(url: string, init?: any): Response | null {
  if (!url.includes("/api/team")) return null;

  const s = getTeam();
  const method = (init?.method ?? "GET").toUpperCase();

  // The advisor-facing audit list. The playground visitor is the OWNER, and an
  // owner reading their own book is not an event, so this is legitimately empty.
  if (url.includes("/api/team/access-log")) return json({ reads: [] });

  // Invites
  if (url.includes("/api/team/invites")) {
    if (url.includes("/resend")) {
      const id = idFromPath(url, "/api/team/invites/");
      const inv = s.invites.find((i) => i.id === id);
      if (inv) inv.expires_at = ago(-7);
      return json({
        emailed: true,
        expiresAt: inv?.expires_at,
        message: `A fresh link is on its way to ${inv?.email ?? "them"}. The earlier link no longer works.`,
      });
    }
    if (url.includes("/revoke")) {
      const id = idFromPath(url, "/api/team/invites/");
      const inv = s.invites.find((i) => i.id === id);
      s.invites = s.invites.filter((i) => i.id !== id);
      return json({ message: `The invite to ${inv?.email ?? "them"} will not work any more. The seat is free.` });
    }
    if (method === "POST") {
      const b = bodyOf(init);
      const email = String(b.email ?? "").trim();
      const used = s.members.length + s.invites.length;
      if (used >= s.team.seats) {
        return json({
          error: "NO_SEATS",
          message: `All ${s.team.seats} seats are taken. Revoke a pending invite or remove an advisor to free one.`,
        }, 409);
      }
      if (s.members.some((m) => m.email.toLowerCase() === email.toLowerCase())) {
        return json({ error: "ALREADY_ON_TEAM", message: "They are already on your team." }, 409);
      }
      if (s.invites.some((i) => i.email.toLowerCase() === email.toLowerCase())) {
        return json({
          error: "ALREADY_INVITED",
          message: "There is already a live invite for that address. Revoke it first, or resend it.",
        }, 409);
      }
      const inv: Invite = {
        id: `demo-invite-${Math.random().toString(36).slice(2, 10)}`,
        email,
        invited_name: b.name ?? null,
        expires_at: ago(-7),
        created_at: ago(0),
      };
      s.invites.push(inv);
      return json({ id: inv.id, email, expiresAt: inv.expires_at, emailed: true, message: `Invite sent to ${email}.` }, 201);
    }
  }

  // Moving checks between advisors
  if (url.includes("/api/team/checks/move") && method === "POST") {
    const b = bodyOf(init);
    const from = s.members.find((m) => m.id === b.fromId);
    const to = s.members.find((m) => m.id === b.toId);
    const count = Number(b.count);
    if (!from || !to) return json({ error: "NOT_A_TEAM_MEMBER", message: "No such advisor on your team." }, 404);
    if (from.checks_left < count) {
      return json({
        error: "NOT_ENOUGH",
        message: `${from.name} has only ${from.checks_left} check${from.checks_left === 1 ? "" : "s"} left.`,
      }, 409);
    }
    from.checks_left -= count;
    to.checks_left += count;
    return json({
      message: `${count} check${count === 1 ? "" : "s"} moved to ${to.name}. This lasts until the monthly refill.`,
    });
  }

  // One member: their book, or removing them
  if (url.includes("/api/team/members/")) {
    const id = idFromPath(url, "/api/team/members/");
    const m = s.members.find((x) => x.id === id);
    if (!m) return json({ error: "NOT_A_TEAM_MEMBER", message: "No such advisor on your team." }, 404);

    if (method === "DELETE") {
      s.members = s.members.filter((x) => x.id !== id);
      return json({
        message: `${m.name} are off the team and the seat is free. Their customers and policies stay theirs — you can no longer see them.`,
      });
    }
    if (url.includes("/policies")) return json({ policies: policiesFor(id) });
    if (url.includes("/customers")) return json({ customers: customersFor(id) });
    if (url.includes("/leads")) return json({ leads: leadsFor(id) });
    if (url.includes("/claims")) return json({ claims: claimsFor(id) });

    return json({
      member: {
        id: m.id, name: m.name, email: m.email, phone: m.phone, city: m.city,
        created_at: m.created_at, checks_left: m.checks_left, entry_left: m.entry_left,
        customers: customersFor(id).length,
        policies: policiesFor(id).length,
        leads: leadsFor(id).length,
        claims: claimsFor(id).length,
      },
      checksPerSeat: CHECKS_PER_SEAT,
    });
  }

  // The Team tab itself. Tested last: it is a prefix of everything above.
  if (url.includes("/api/team")) {
    const used = s.members.length + s.invites.length;
    return json({
      inTeam: true,
      role: "owner",
      team: { id: s.team.id, name: s.team.name, seats: s.team.seats },
      seats: {
        total: s.team.seats,
        members: s.members.length,
        pending: s.invites.length,
        free: Math.max(s.team.seats - used, 0),
      },
      checksPerSeat: CHECKS_PER_SEAT,
      members: s.members.map(memberSummary),
      invites: s.invites,
    });
  }

  return null;
}

/** Reseed on leaving playground, so a second visit starts clean. */
export function resetPlaygroundTeam(): void {
  state = null;
}
