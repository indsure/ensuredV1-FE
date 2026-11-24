// What each role may see and do. The same lists and defaults as backend/server/services/corpAccess.ts; online, the
// owner can change them, and what the server says replaces these.
export const PAGES = [
  { key: "home", label: "Today" }, { key: "customers", label: "Customers" }, { key: "register", label: "Policy register" },
  { key: "new", label: "New business, bulk upload and drafts" }, { key: "expiry", label: "Renewals due" },
  { key: "business", label: "Business report" }, { key: "brokerage", label: "Brokerage received" }, { key: "renewreport", label: "Renewals report" }, { key: "snapshots", label: "Locked reports" },
  { key: "masters", label: "Lists and team" }, { key: "fx", label: "Exchange rates" }, { key: "presets", label: "Brokerage rates" }, { key: "reminders", label: "Reminders" },
];
export const ACTIONS = [
  { group: "Customers and policies", items: [["createCustomer", "Add customers"], ["editCustomer", "Change, delete or merge customers"], ["newBusiness", "Add policies and approve drafts"], ["editDraft", "Change policy details"], ["addBranch", "Add insurers, branches and CSCs while adding a policy"], ["addDoc", "Add documents"], ["deletePolicy", "Delete confirmed policies and merge customers that have policies"]] },
  { group: "During the year", items: [["endorse", "Record endorsements, members and CD entries"], ["fleet", "Change a fleet"], ["declare", "Record declarations"], ["renew", "Renew policies"], ["markLost", "Mark renewals lost"]] },
  { group: "Money and reports", items: [["receipt", "Record payments, brokerage and GST"], ["schedule", "Set up instalments"], ["finalize", "Lock reports and delete payments"], ["export", "Download reports"]] },
  { group: "Settings", items: [["settings", "Change lists, team codes, exchange and brokerage rates, reminders and reading settings"], ["backup", "Download or restore backups"]] },
];
const ALL = ACTIONS.flatMap((g) => g.items.map(([k]) => k));
export const DEFAULT_ROLES = [
  { key: "ops", name: "Operations / BD", pages: ["home", "customers", "new", "register", "expiry", "reminders"], actions: ["createCustomer", "editCustomer", "newBusiness", "editDraft", "endorse", "renew", "markLost", "fleet", "declare", "schedule", "receipt", "addDoc", "addBranch", "backup"], builtIn: true },
  { key: "accounts", name: "Accounts", pages: ["customers", "register", "business", "brokerage", "renewreport", "snapshots", "fx", "presets"], actions: ["receipt", "export", "finalize", "addDoc", "backup"], builtIn: true },
  { key: "admin", name: "Admin", pages: PAGES.map((p) => p.key), actions: ALL, builtIn: true },
  { key: "readonly", name: "Read-only", pages: ["customers", "register", "expiry", "business", "brokerage", "renewreport"], actions: ["backup"], builtIn: true },
];
/** Bulk upload and Drafts come with New business; Help is for everyone. */
export const pageAllowed = (r, key) => ["guide", "feedback"].includes(key) || r.pages.includes(["bulk", "drafts"].includes(key) ? "new" : key);
