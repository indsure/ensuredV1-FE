// How-to guide: short step lists for each job, grouped by who does it, with a search box.
import { useState, useMemo } from "react";
import { useApp, Card, Empty, Pill } from "./ui.jsx";

const ROLE_LABEL = { ops: "Operations / BD (CSC)", accounts: "Accounts", admin: "Admin", readonly: "Read-only" };
const ALL = ["ops", "accounts", "admin", "readonly"];

export const GUIDE = [
  { id: "add-pdf", title: "Add a policy from its PDF", roles: ["ops", "admin"], words: "upload attach new policy schedule ocr scan photo jpg png read",
    steps: ["Click \"Add a policy\" at the top of the menu.", "Drop the policy PDF on the box, or click it to choose the file. A photo (JPG or PNG) or a scanned PDF works too; it takes about 10 seconds a page.", "Check the insured, insurer, branch and policy type it found. Pick a different one if it is wrong, or click \"Branch not listed? Add it\".", "Click \"Continue to the values\". Green tags were read clearly. Amber tags need checking: click the tag to see the line on the document.", "Fill anything marked \"Not found on document\", then save."],
    tip: "Values read from a scan or photo are always amber. A scan can misread a letter or a digit, so check each one." },
  { id: "dates", title: "Enter or paste a date", roles: ALL, words: "date paste copy format dd mm yyyy day month year",
    steps: ["Dates show as DD/MM/YYYY everywhere.", "Type 14/08/2026 or 14/08/26, or paste the date straight from the policy. 14-Aug-26 and 14/08/2026 02:53 PM work too.", "After a paste the portal says how it read the date and asks if it is right. If day and month could be swapped, it offers the other reading."] },
  { id: "premium", title: "Gross, GST and net premium", roles: ALL, words: "gross net premium gst total final paid brokerage",
    steps: ["Gross premium is the amount before GST.", "Gross premium + GST = net premium, the final amount paid. Where a policy's total also includes stamp duty, the review screen offers both sums, so match the policy.", "Policies use these words differently, so the portal goes by the figures, not the printed word. Amber means they do not add up: check them against the policy."] },
  { id: "brokerage-net", title: "Charge brokerage on net premium", roles: ["ops", "accounts", "admin"], words: "brokerage net gross tick base commission",
    steps: ["Brokerage is on gross premium by default.", "For a policy where it is on net, tick \"Brokerage on net premium\" when reviewing the policy, or under Brokerage on the policy page.", "The brokerage amount and the Brokerage received page follow the tick."] },
  { id: "booked", title: "Business booked date", roles: ["ops", "accounts", "admin"], words: "booked booking business date issue",
    steps: ["The booked date starts as the policy issue date.", "Change it on the review screen if the business belongs to another date."] },
  { id: "other-details", title: "Other details on a policy", roles: ALL, words: "other details extensions special conditions exclusions sub limit aoa aoy jurisdiction",
    steps: ["Extensions, sub limits, special conditions and similar items are read into \"Other details\" on the review screen.", "Change, remove or add rows there. They then show on the policy page.", "Location also covers Jurisdiction and similar words. The review screen says which word the policy uses."] },
  { id: "add-customer", title: "Add a customer (insured)", roles: ["ops", "admin"], words: "new customer insured assured client city state country",
    steps: ["Open Customers and click \"Add customer\".", "Type the name. If a similar customer already exists the form says so: use that one instead of making a copy.", "Type the city. State and Country fill in by themselves; you can still change them.", "Pick the CSC and RM, then click \"Create customer\"."] },
  { id: "edit-customer", title: "Change a customer's details or team", roles: ["ops", "admin"], words: "edit customer rm csc team change address",
    steps: ["Open the customer from Customers.", "Click \"Edit details and team\".", "Change what you need and click \"Save changes\". The change is written to the customer's history."] },
  { id: "find", title: "Find a policy or customer", roles: ALL, words: "search filter find register lookup policy number",
    steps: ["Open Policy register for policies, or Customers for customers.", "Type in the search box: policy number, insured name, insurer or city all work.", "Use the filters to narrow by department, policy type, status or financial year.", "Click a row to open it."] },
  { id: "download", title: "Download or open the policy PDF", roles: ALL, words: "download pdf document view open original file save print",
    steps: ["Open the policy.", "On the \"Policy document\" card click \"Download policy PDF\". \"View document\" shows the text that was read.", "Other documents are on the Documents tab of the policy. Each row has View and Download."],
    tip: "Download is greyed out for documents whose original file was not kept, and for sample documents. Hover over it to see why." },
  { id: "add-doc", title: "Add a document to a policy", roles: ["ops", "accounts", "admin"], words: "document attach endorsement debit note letter",
    steps: ["Open the policy and go to Documents.", "Click \"Add document\", pick the kind, attach the file and save."] },
  { id: "endorse", title: "Record an endorsement", roles: ["ops", "admin"], words: "endorsement change sum insured increase decrease amend",
    steps: ["Open the policy and go to Endorsements.", "Attach the endorsement PDF. The changes it shows are listed for you to check.", "Click \"Confirm endorsement\". The old values stay in the policy's history."] },
  { id: "renew", title: "Renew a policy", roles: ["ops", "admin"], words: "renewal renew next year expiry due",
    steps: ["Open Renewals due to see what ends soon.", "Open the policy and start the renewal with the new schedule PDF.", "Check the values, then save. The new year is linked to the old one under \"Linked terms\"."] },
  { id: "lost", title: "Mark a renewal as lost", roles: ["ops", "admin"], words: "lost renewal lossby another broker direct",
    steps: ["Open the policy.", "Click \"Mark as lost\".", "Choose where it went, add why if you know, then click \"Save as lost\"."] },
  { id: "fleet", title: "Add or remove a vessel (fleet change)", roles: ["ops", "admin"], words: "fleet vessel hull add remove pro rata",
    steps: ["Open the policy and click \"Record fleet change\".", "Enter the vessel and the premium and brokerage change from the insurer's endorsement. They count in report totals in the month the change takes effect.", "Click \"Confirm fleet change\"."] },
  { id: "declare", title: "Record a cargo or charterers' declaration", roles: ["ops", "admin"], words: "declaration cargo open policy charterers balance sum insured",
    steps: ["Open the open policy.", "Click \"Add declaration\", fill the details and click \"Save declaration\".", "The balance left on the policy updates. A declaration over the balance is saved and flagged in red."] },
  { id: "instalments", title: "Set up instalments", roles: ["ops", "admin"], words: "instalment installment schedule emi split payment",
    steps: ["Open the policy, go to Payments and find \"Instalment schedule\". If the policy's document has an instalment table, click \"Use this schedule\" and you are done.", "Otherwise click \"Set up instalments\". You can read the table from a PDF or photo, or enter it here. Stamp duty has its own box and starts on the first instalment.", "Enter how many instalments, click \"Make rows\", or use \"Split remaining net equally (editable)\".", "Change any date or amount, then click \"Save schedule\"."] },
  { id: "payment", title: "Record a premium payment", roles: ["ops", "accounts", "admin"], words: "payment premium paid received instalment overdue",
    steps: ["Open the policy, find the instalment and click \"Record payment\".", "Enter the date and amount, then click \"Save payment\"."] },
  { id: "full-payment", title: "Record a full payment", roles: ["ops", "accounts", "admin"], words: "full payment received paid receipt whole amount premium",
    steps: ["Open the policy, go to Payments and click \"Record receipt\".", "Tick \"Received full payment\". The amount fills in, and every open instalment is cleared.", "Add the date and reference, then click \"Save receipt\"."] },
  { id: "receipt", title: "Record brokerage received", roles: ["accounts", "ops", "admin"], words: "brokerage receipt commission received insurer",
    steps: ["Open the policy and click \"Record receipt\", or use Brokerage received for many at once.", "Enter the amount and date, then click \"Save receipt\"."] },
  { id: "business-report", title: "Make the business report", roles: ["accounts", "admin", "readonly"], words: "business report export csv excel csc wise rm wise total",
    steps: ["Open Business report.", "1. Filters: pick the financial year and the date to use.", "2. Grouping: pick how rows are grouped, for example CSC Wise or Insurer.", "3. Output: look at the totals and download the file."] },
  { id: "renewals-report", title: "Make the renewals report", roles: ["accounts", "admin", "readonly"], words: "renewals report achieved lost renewed",
    steps: ["Open Renewals report.", "Pick the period. Each policy shows whether it was renewed, lost or is still open."] },
  { id: "finalize", title: "Finalize a month's report", roles: ["accounts", "admin"], words: "finalize lock snapshot month close",
    steps: ["Make the report as usual.", "Finalize it. A locked copy is kept under Finalized reports, even if records change later."] },
  { id: "team", title: "Add a team member (CSC, RM)", roles: ["admin"], words: "team member csc rm code add staff",
    steps: ["Open Masters and find \"Add team member\".", "Enter the name, code and role, then click \"Add\"."] },
  { id: "insurers", title: "Add or rename an insurer or branch", roles: ["admin"], words: "insurer branch office rename add masters city state",
    steps: ["Open Masters.", "Use \"Add insurer\" or \"Add branch\". For a branch, type the city: State and Country fill in.", "To fix a name, click Rename on its row and click \"Save name\". Old policies show the new name."] },
  { id: "presets", title: "Set brokerage rates", roles: ["accounts", "admin"], words: "brokerage preset rate percent commission",
    steps: ["Open Brokerage presets and fill \"New preset\" for the insurer and policy type.", "Every change is kept as a new version. Policies keep the rate they were made with."] },
  { id: "fx", title: "Enter a month's FX rate", roles: ["accounts", "admin"], words: "fx rate usd dollar currency exchange",
    steps: ["Open FX rates.", "Enter the rate for the month and click \"Save rate\"."] },
  { id: "backup", title: "Back up or restore the records", roles: ["admin"], words: "backup restore undo earlier save version",
    steps: ["Click Backup at the top.", "\"Download backup\" saves every record to one file. Keep it safe: it has customer data.", "To undo a mistake, use \"Earlier saves\" or \"Restore from a backup\"."] },
  { id: "logins", title: "Give someone a login", roles: ["admin"], words: "login password user account add switch off role access",
    steps: ["Open Masters and go to Logins.", "Enter their name, email, role and a password, then click \"Add login\". Share the password with them privately.", "To stop someone signing in, click \"Switch off\". \"New password\" sets a new one."] },
  { id: "reminders", title: "How reminders work", roles: ["ops", "admin"], words: "reminder email renewal expiry balance threshold",
    steps: ["The CSC gets an email 60, 30 and 15 days before a policy ends. Nothing goes to the customer.", "Add each CSC's email in Masters, under Team. Without one, no reminder goes out and the Reminders page says so.", "Cargo open policies send one email when the balance falls below the level on the Reminders page. It starts at 30%."] },
  { id: "report", title: "Report a problem", roles: ALL, words: "bug problem feedback idea report error help contact",
    steps: ["Click \"Report a problem\" in the menu.", "Say what happened, add a screenshot if it helps, and click \"Send to IndSure\". It reaches the IndSure team straight away."] },
  { id: "readonly", title: "What a read-only user can do", roles: ["readonly"], words: "read only view viewer",
    steps: ["You can open customers, policies and reports, and download documents.", "You cannot add or change anything. Ask a CSC or Admin."] },
];

export function Guide() {
  const { role } = useApp();
  const [q, setQ] = useState("");
  const [who, setWho] = useState(role);
  const list = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return GUIDE.filter((g) => who === "all" || g.roles.includes(who)).filter((g) => {
      const hay = [g.title, g.words, g.tip || "", ...g.steps].join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [q, who]);
  return (
    <div className="stack">
      <header className="page-head"><div><h1>How to</h1><p className="muted">Short steps for each job. Search, or pick a role to see what that person does.</p></div></header>
      <div className="row gap-s wrap">
        <label className="grow"><span className="sr">Search the guide</span><input id="guide-search" type="search" placeholder="Search, for example: renew, download, instalment" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="pillsel"><span className="sr">Role</span><select id="guide-role" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">All roles</option>{ALL.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
      </div>
      <p className="small muted" role="status">{list.length} topic{list.length === 1 ? "" : "s"}</p>
      {!list.length && <Empty title="Nothing matches">Try another word, or pick "All roles".</Empty>}
      {list.map((g) => (
        <Card key={g.id} title={g.title}>
          <div className="row gap-xs wrap">{g.roles.map((r) => <Pill key={r} tone={r === role ? "info" : "muted"}>{ROLE_LABEL[r]}</Pill>)}</div>
          <ol className="guide-steps">{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          {g.tip && <p className="small note">{g.tip}</p>}
        </Card>
      ))}
    </div>
  );
}
