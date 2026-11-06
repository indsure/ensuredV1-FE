// The How to guide. Written for someone on their first day and for someone with decades in the trade:
// search finds anything by the words people actually use, including old names for things.
import { useState, useMemo } from "react";
import { useApp, Card, Btn, Empty, Pill } from "./ui.jsx";
import { GLOSSARY } from "./glossary.js";

const ROLE_LABEL = { ops: "Operations / BD (CSC)", accounts: "Accounts", admin: "Admin", readonly: "Read-only" };
const ALL = ["ops", "accounts", "admin", "readonly"];
const ADD = ["ops", "admin"];
const MONEY = ["ops", "accounts", "admin"];

// The path for a newcomer, in the order the work happens.
const FIRST_DAY = [
  { title: "Know the idea", text: "One customer can hold many policies. A policy starts as a draft, someone checks it and confirms it, then the money comes in. During the year it may change (endorsement). At the end it renews or is lost.", },
  { title: "Add one policy", text: "Click Add a policy and drop the PDF. The portal reads what it can.", go: "add", label: "Add a policy" },
  { title: "Check what was read", text: "The policy shows beside the form. Green was read clearly; amber needs your eye. Click any tag to see the line it came from. Reading can make mistakes, especially on scans, so this check matters.", },
  { title: "Fill the gaps and confirm", text: "Type in anything missing and choose whether it is renewable, then click Confirm. Not sure yet? Save as draft and come back.", },
  { title: "Record the money", text: "When the customer pays, open the policy, go to Payments, and click Record receipt. Paid in one go? Tick Received full payment.", go: "register", label: "Policy register" },
  { title: "Look at Today each morning", text: "It lists drafts to finish, overdue instalments and policies ending soon. Each item opens the record.", go: "home", label: "Today" },
];

export const GUIDE = [
  // ---- Adding
  { group: "Adding policies and customers", id: "add-pdf", title: "Add a policy from its PDF", roles: ADD, go: "add", words: "upload attach new policy schedule ocr scan photo jpg png read fresh business",
    when: "You have a new policy from the insurer. This is the quickest way.",
    steps: ["Click \"Add a policy\" at the top of the menu.", "Drop the policy PDF on the box, or click it to choose the file. A photo (JPG or PNG) or a scanned PDF works too, at about 10 seconds a page.", "The policy now shows beside the form. Check the insured, insurer, branch and policy type. Click a green tag to see the line it came from. Change anything wrong.", "Click \"Next: check the figures\".", "Check each amber value against the policy and click \"This is right\", or type the correct value. Fill anything marked as not on the policy.", "Answer \"Is renewable\", tick that you have checked the brokerage, and click \"Confirm record\"."],
    tip: "Can't finish now? \"Save as draft\" keeps your work. It shows on Today until confirmed." },
  { group: "Adding policies and customers", id: "bulk", title: "Upload many policies at once", roles: ADD, go: "bulk", words: "bulk batch many multiple old book import load drafts folder",
    when: "You have a pile of policies, such as an old book to load.",
    steps: ["Open Bulk upload and drop the files, or click to choose them. PDFs and photos both work.", "Keep the tab open while they are read. You can use other pages meanwhile. Files that fail are listed with the reason.", "Open Drafts. Each file waits there until someone approves it. Nothing counts in reports until then."],
    tip: "The insurer's PDFs take seconds each. Scans take up to a minute each, so a large pile of scans is best run when nobody needs the computer." },
  { group: "Adding policies and customers", id: "drafts", title: "Check and approve drafts", roles: ADD, go: "drafts", words: "drafts approve approval review waiting inbox pending confirm batch together",
    steps: ["Open Drafts. It shows what is ready and what needs a look, and why.", "Click Open to check one against the policy, then click \"Confirm and next\" to go straight to the following one.", "To approve many at once: tick the ones marked Ready to approve, answer the questions, and click Approve. This is only for drafts read clearly with nothing missing."],
    tip: "Scans always need opening, because a scan can misread a digit. An insurer not in your list? Click its name in the draft to add it, and the draft moves on." },
  { group: "Adding policies and customers", id: "add-step", title: "Add a policy step by step, without reading a PDF first", roles: ADD, go: "new", words: "manual by hand new business no pdf type",
    when: "You would rather choose everything yourself first.",
    steps: ["Open New business.", "Choose the customer, then the team, the insurer and branch, then the department and policy type.", "Attach the document if you have it, then check the figures and confirm."] },
  { group: "Adding policies and customers", id: "add-customer", title: "Add a customer (insured)", roles: ADD, go: "customers", words: "new customer insured assured client city state country gstin",
    when: "A customer without a policy yet. Adding a policy from a PDF creates the customer for you.",
    steps: ["Open Customers and click \"Add customer\".", "Type the name. If that customer already exists the form says so: use that one instead of making a copy.", "Type the city and pick it from the list. State and Country fill in by themselves; you can still change them.", "Pick the CSC, and the RM if there is one, then click \"Create customer\"."] },
  { group: "Adding policies and customers", id: "edit-customer", title: "Change a customer's details or team", roles: ADD, go: "customers", words: "edit customer rm csc team change address transfer handover",
    steps: ["Open the customer from Customers.", "Click \"Edit details and team\".", "Change what you need and click \"Save changes\". The change is written to the customer's history."] },
  // ---- Finding
  { group: "Finding things", id: "find", title: "Find a policy or customer", roles: ALL, go: "register", words: "search filter find register lookup policy number where",
    steps: ["Open Policy register for policies, or Customers for customers.", "Type in the search box: policy number, insured name, insurer or city all work.", "Use the filters to narrow it down. \"Clear filters\" shows everything again.", "Click a row to open it."] },
  { group: "Finding things", id: "download", title: "Download or open the policy PDF", roles: ALL, go: "register", words: "download pdf document view open original file save print copy send",
    steps: ["Open the policy.", "On the \"Policy document\" card click \"Download policy PDF\". \"View document\" shows the text that was read.", "Other documents are on the Documents tab. Each row has View and Download."],
    tip: "Download is greyed out for documents whose original file was not kept, and for sample documents. Hover over it to see why." },
  { group: "Finding things", id: "add-doc", title: "Add a document to a policy", roles: MONEY, go: "register", words: "document attach debit note letter kyc quote upload",
    steps: ["Open the policy and go to Documents.", "Click \"Add document\", pick the kind, attach the file and save."], tip: "Adding a document never changes the policy's figures." },
  // ---- Payments
  { group: "Money", id: "premium", title: "Gross, GST and net premium", roles: ALL, words: "gross net premium gst total final paid stamp duty difference confused",
    when: "Policies use these words differently, and the same word can mean different things.",
    steps: ["Gross premium is the amount before GST.", "Net premium is the final amount paid: gross + GST, plus stamp duty if the policy's total includes it.", "The portal goes by the figures, not the printed word. A policy printing \"Net Premium 44,916\" before GST shows here as gross 44,916.", "Amber means the figures did not add up. Check them against the policy."] },
  { group: "Money", id: "full-payment", title: "Record a full payment", roles: MONEY, go: "register", words: "full payment received paid receipt whole amount premium one go",
    steps: ["Open the policy, go to Payments and click \"Record receipt\".", "Tick \"Received full payment\". The amount fills in, and every open instalment is cleared.", "Add the date and reference, then click \"Save receipt\"."] },
  { group: "Money", id: "payment", title: "Record a part payment or one instalment", roles: MONEY, go: "register", words: "payment premium paid received instalment overdue part receipt cheque neft",
    steps: ["Open the policy, go to Payments and click \"Record receipt\".", "Pick the instalment it is for. The amount fills in; change it if less came in.", "Enter the date it arrived, the payment mode and the reference, then click \"Save receipt\"."],
    tip: "Paid after the due date? Enter the real date. The portal keeps both dates and shows it as paid late." },
  { group: "Money", id: "instalments", title: "Set up instalments", roles: ADD, go: "register", words: "instalment installment schedule emi split payment stamp duty quarterly due dates table read",
    when: "The customer pays the premium in parts.",
    steps: ["Open the policy and go to Payments. If the policy's document has an instalment table, click \"Use this schedule\" and you are done.", "Otherwise click \"Set up instalments\". You can read the table from a PDF or photo.", "Or enter the first due date, how many months apart, and how many instalments, then click \"Make rows\".", "Click \"Split remaining net equally\", or type each amount. Stamp duty has its own box and starts on the first instalment.", "Check the total matches, then click \"Save schedule\"."] },
  { group: "Money", id: "brokerage-net", title: "Charge brokerage on net premium", roles: MONEY, words: "brokerage net gross tick base commission",
    steps: ["Brokerage is on gross premium by default.", "For a policy where it is on net, tick \"Brokerage on net premium\" on the review screen, or under Brokerage on the policy page.", "The brokerage amount and the Brokerage received page follow the tick."] },
  { group: "Money", id: "receipt", title: "Record brokerage received from an insurer", roles: MONEY, go: "brokerage", words: "brokerage receipt commission received insurer short paid outstanding remittance chase",
    steps: ["Open Brokerage received. It shows what each insurer owes, what has arrived and what to chase.", "Open the insurer and record what they paid against each policy."] },
  { group: "Money", id: "booked", title: "Business booked date", roles: MONEY, words: "booked booking business date issue month report which month",
    steps: ["The booked date starts as the policy issue date.", "Change it on the review screen if the business belongs to another date. Reports can go by this date."] },
  // ---- During the year
  { group: "Changes during the year", id: "endorse", title: "Record an endorsement", roles: ADD, go: "register", words: "endorsement change sum insured increase decrease amend correction midterm",
    when: "The insurer issued a change to a policy.",
    steps: ["Open the policy and go to Endorsements.", "Attach the endorsement PDF. The changes it shows are listed for you to check.", "Tick the fields that really changed, enter the effective date, and click \"Confirm endorsement\"."],
    tip: "Confirmed values change only this way, so the old value is always kept in the history." },
  { group: "Changes during the year", id: "fleet", title: "Add or remove a vessel (fleet change)", roles: ADD, go: "register", words: "fleet vessel hull add remove pro rata ship",
    steps: ["Open the policy, go to Marine and click \"Record fleet change\".", "Enter the vessel and the premium and brokerage change from the insurer's endorsement. The insurer's figure is final; the portal does not work out its own.", "Click \"Confirm fleet change\". It counts in report totals in the month it takes effect."] },
  { group: "Changes during the year", id: "declare", title: "Record a cargo or charterers' declaration", roles: ADD, go: "register", words: "declaration cargo open policy charterers balance sum insured shipment voyage",
    steps: ["Open the policy and go to Marine.", "Click \"Add declaration\", fill the details and click \"Save declaration\".", "The sum insured left updates. A declaration over the balance is saved and flagged in red, because the cargo has already moved: ask the insurer to raise the sum insured."] },
  // ---- Renewals
  { group: "Renewals", id: "renew", title: "Renew a policy", roles: ADD, go: "expiry", words: "renewal renew next year expiry due ending",
    steps: ["Open Renewals due to see what ends soon.", "Open the policy, go to Renewals and attach the renewal policy PDF.", "Check the values, then confirm. The new year is linked to the old one, which stays unchanged."] },
  { group: "Renewals", id: "lost", title: "Mark a renewal as lost", roles: ADD, go: "expiry", words: "lost renewal lossby another broker direct not renewed",
    steps: ["Open the policy and go to Renewals.", "Click \"Mark as lost\".", "Choose where it went, add why if you know, then click \"Save as lost\"."] },
  { group: "Renewals", id: "reminders", title: "How reminders work", roles: ADD, go: "reminders", words: "reminder email renewal expiry balance threshold alert",
    steps: ["The CSC gets an email 60, 30 and 15 days before a policy ends. Nothing goes to the customer.", "Add each CSC's email in Lists and team, under Team. Without one, no reminder goes out and the Reminders page says so.", "Cargo open policies send one email when the sum insured left falls below the level on the Reminders page. It starts at 30%."] },
  // ---- Reports
  { group: "Reports", id: "business-report", title: "Make the business report", roles: ["accounts", "admin", "readonly"], go: "business", words: "business report export csv excel csc wise rm wise total mis",
    steps: ["Open Business report.", "Choose the financial year and which date to use.", "Choose how to group it, for example CSC Wise or Insurer.", "Look at the totals, then print or download the file."], tip: "Drafts are left out. A note says how many, so you know to finish them." },
  { group: "Reports", id: "renewals-report", title: "Make the renewals report", roles: ["accounts", "admin", "readonly"], go: "renewreport", words: "renewals report achieved lost renewed expiry list",
    steps: ["Open Renewals report.", "Choose the period. Each policy shows whether it was renewed, lost or is still open."] },
  { group: "Reports", id: "finalize", title: "Lock a month's report", roles: ["accounts", "admin"], go: "business", words: "finalize finalise lock snapshot month close freeze",
    when: "You want a month-end figure that will not move later.",
    steps: ["Make the report as usual.", "Click \"Lock this report\". A copy is kept under Locked reports, even if records change later."] },
  // ---- Team
  { group: "Team and settings", id: "team", title: "Add a team member (CSC, RM)", roles: ["admin"], go: "masters", words: "team member csc rm code add staff email masters new joiner left",
    steps: ["Open Lists and team, and go to Team.", "Enter the code, name, email and role, then click \"Add\".", "When someone leaves, click Edit to move their customers to someone else, or switch them off. Their history stays."] },
  { group: "Team and settings", id: "logins", title: "Give someone a login", roles: ["admin"], go: "masters", words: "login password user account add switch off role access forgot",
    steps: ["Open Lists and team, and go to Logins.", "Enter their name, email, role and a password, then click \"Add login\". Share the password with them privately.", "Forgotten password? Click \"New password\". To stop someone signing in, click \"Switch off\"."],
    tip: "Give each person their own login, so the history shows who did what." },
  { group: "Team and settings", id: "insurers", title: "Add or rename an insurer or branch", roles: ["admin"], go: "masters", words: "insurer branch office rename add masters city state merge spelling",
    steps: ["Open Lists and team.", "Use \"Add insurer\" or \"Add branch\". For a branch, type the city: State and Country fill in.", "To fix a name, click Rename on its row and click \"Save name\". Old policies show the new name."] },
  { group: "Team and settings", id: "presets", title: "Set brokerage rates", roles: ["accounts", "admin"], go: "presets", words: "brokerage preset rate percent commission grid",
    steps: ["Open Brokerage rates and fill \"New preset\" for the insurer and policy type.", "New policies pick it up as a starting value you can still change.", "Every change is kept as a new version. Existing policies keep the rate they were made with."] },
  { group: "Team and settings", id: "fx", title: "Enter a month's exchange rate", roles: ["accounts", "admin"], go: "fx", words: "fx rate usd dollar currency exchange foreign",
    steps: ["Open Exchange rates.", "Enter the rupee rate for the month and click \"Save rate\"."], tip: "Without a rate for that month, a foreign policy shows in reports with no rupee value." },
  { group: "Team and settings", id: "backup", title: "Back up or restore the records", roles: ["admin"], words: "backup restore undo earlier save version mistake export",
    steps: ["Click Backup at the top.", "\"Download backup\" saves every record to one file. Keep it safe: it has customer data.", "To undo a mistake, use \"Earlier saves\" or \"Restore from a backup\"."] },
  { group: "Team and settings", id: "readonly", title: "What a read-only login can do", roles: ["readonly"], words: "read only view viewer auditor",
    steps: ["You can open customers, policies and reports, and download documents.", "You cannot add or change anything. Ask a CSC or an Admin."] },
  { group: "Team and settings", id: "report", title: "Report a problem", roles: ALL, go: "feedback", words: "bug problem feedback idea report error help contact support not working",
    steps: ["Click \"Report a problem\" in the menu.", "Say what happened, add a screenshot if it helps, and click \"Send to IndSure\". It reaches the IndSure team straight away."] },
];

// Doubts people actually have.
export const QUESTIONS = [
  { q: "The portal read a value wrong. What do I do?", a: "Type the right value over it. The portal notes that you changed it and keeps what the document said. Reading can make mistakes, especially on scans and photos. The policy is what counts.", words: "wrong mistake incorrect ocr error misread edit fix" },
  { q: "What do green and amber mean?", a: "Green: read clearly, but still worth a glance. Amber: please check it against the policy. Everything read from a scan or photo is amber. Grey means it is not on the policy and is optional.", words: "colour color tag chip low confidence check" },
  { q: "Where do I see the actual policy while checking?", a: "It shows beside the form. Use \"Text we read\" to see the lines, and click a tag to jump to its line. Use \"Original file\" to see the page itself. This is the one to trust on a scan.", words: "see original pdf side by side view compare" },
  { q: "How do I find a word in the policy?", a: "Use the search box above the document, on the check screens and in View document. Type a word such as deductible. Press Enter or the arrows to move between matches. On a scan, reading can miss a word, so if nothing is found, look at the Original file too.", words: "search find word clause look document text ctrl f" },
  { q: "What is the difference between a draft and a confirmed record?", a: "A draft may have gaps and does not count in reports. A confirmed record has been checked and counts. After confirming, values change only through an endorsement.", words: "draft confirm save complete" },
  { q: "I confirmed a record with a mistake. Can I fix it?", a: "Record an endorsement if the insurer changed it. If it was a typing mistake, an Admin can go back to an earlier save under Backup, or tell us through Report a problem.", words: "undo mistake correct edit confirmed change" },
  { q: "Why does the policy print Net Premium, but the portal shows it as gross?", a: "Here, gross is always before GST and net is always the final amount paid. Policies use the words both ways, so the portal goes by the figures.", words: "gross net wrong word label premium" },
  { q: "The insurer or branch is not in the list.", a: "When adding a policy, a box appears to add it there and then. The document's name is filled in for you. An Admin can also add them under Lists and team.", words: "missing not listed add insurer branch" },
  { q: "The insurer's name is spelled differently on this policy. Will it make a duplicate?", a: "Pick the existing insurer from the list instead of adding a new one. Use Rename in Lists and team to correct a spelling; old policies follow it.", words: "duplicate spelling same insurer name" },
  { q: "Issue date, risk start and booked date: which is which?", a: "Issue date: when the insurer issued it. Risk start: when cover begins. Booked date: when the business counts in your reports. It starts as the issue date.", words: "dates difference issue risk booked which date" },
  { q: "How do I type dates?", a: "Dates show as DD/MM/YYYY. Type 14/08/2026 or 14/08/26, or paste straight from the policy: 14-Aug-26 and 14/08/2026 02:53 PM both work. After a paste the portal says how it read the date and asks if it is right.", words: "date format paste copy dd mm yyyy" },
  { q: "Why can't I see a page or button someone else can?", a: "What you see depends on your role. Operations add and change policies, Accounts handle money and reports, Admins do everything, and Read-only can look but not change. Ask an Admin if you need more.", words: "role permission access missing button greyed disabled" },
  { q: "A button is greyed out. Why?", a: "Hover over it, or tap it on a phone. It says why, usually your role or something still missing.", words: "disabled greyed cannot click" },
  { q: "Does anything go to my customer automatically?", a: "No. Reminders go only to your own team. Nothing is sent to customers.", words: "email customer sent automatic message reminder" },
  { q: "Two of us changed the same thing. What happens?", a: "The second person is told someone else saved first and sees the latest records, so nothing is overwritten silently. Redo your last change if it is missing.", words: "conflict same time saved elsewhere overwritten" },
  { q: "Is my data safe if I close the browser?", a: "Yes. Every change saves by itself within moments. The line at the top says when it last saved.", words: "save lost close browser auto" },
];

const hayOf = (x) => [x.title, x.q, x.a, x.when, x.words, x.tip, x.group, x.word, x.also, x.text, ...(x.steps || [])].filter(Boolean).join(" ").toLowerCase();
const matches = (x, terms) => { const h = hayOf(x); return terms.every((t) => h.includes(t)); };

function Topic({ g, open, role, go, roleLabels = true }) {
  return (
    <details className="guide-topic" open={open}>
      <summary>{g.title}</summary>
      {g.when && <p className="muted">{g.when}</p>}
      <ol className="guide-steps">{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {g.tip && <p className="small note">{g.tip}</p>}
      <div className="row gap-s wrap" style={{ marginTop: 10 }}>
        {g.go && g.roles.includes(role) && <Btn onClick={() => go(g.go === "add" ? { view: "add", nonce: Date.now() } : { view: g.go })}>Go there</Btn>}
        {roleLabels && g.roles.length < 4 && g.roles.map((r) => <Pill key={r} tone={r === role ? "info" : "muted"}>{ROLE_LABEL[r]}</Pill>)}
      </div>
    </details>
  );
}

export function Guide() {
  const { role, go } = useApp();
  const [q, setQ] = useState("");
  const [who, setWho] = useState(role);
  const terms = useMemo(() => q.toLowerCase().split(/\s+/).filter(Boolean), [q]);
  const searching = terms.length > 0;
  const topics = useMemo(() => {
    // Searching looks everywhere, so nobody is stopped by the role filter.
    const list = searching ? GUIDE.filter((g) => matches(g, terms)) : GUIDE.filter((g) => who === "all" || g.roles.includes(who));
    return searching ? [...list].sort((a, b) => Number(terms.every((t) => b.title.toLowerCase().includes(t))) - Number(terms.every((t) => a.title.toLowerCase().includes(t)))) : list;
  }, [terms, who, searching]);
  const faqs = useMemo(() => (searching ? QUESTIONS.filter((x) => matches(x, terms)) : QUESTIONS), [terms, searching]);
  const words = useMemo(() => (searching ? GLOSSARY.filter((x) => matches(x, terms)) : GLOSSARY), [terms, searching]);
  const groups = [...new Set(topics.map((g) => g.group))];
  const found = topics.length + faqs.length + words.length;
  return (
    <div className="stack">
      <header className="page-head"><div><h1>How to</h1><p className="muted">Search for what you want to do, or a word you want explained. New here? Start with your first day below.</p></div></header>
      <div className="guide-search">
        <label className="sr" htmlFor="guide-search">Search the guide</label>
        <input id="guide-search" type="search" placeholder="What do you want to do? Try: renew, part payment, what is an endorsement" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {searching && <p className="small muted" role="status">{found ? `${found} result${found === 1 ? "" : "s"}` : ""}</p>}
      {searching && !found && <Empty title="Nothing matches">Try fewer or different words. Still stuck? <button className="linkbtn" onClick={() => go({ view: "feedback" })}>Ask us through Report a problem</button>.</Empty>}

      {!searching && (
        <Card title="Your first day" sub="Do these in order with one real policy. It takes about ten minutes.">
          <ol className="guide-path">{FIRST_DAY.map((s, i) => (
            <li key={i}><div><strong>{s.title}</strong><p>{s.text}</p></div>{s.go && <Btn onClick={() => go(s.go === "add" ? { view: "add", nonce: Date.now() } : { view: s.go })}>{s.label}</Btn>}</li>
          ))}</ol>
        </Card>
      )}

      {topics.length > 0 && (
        <section className="stack">
          <div className="row between wrap gap-s"><h2 className="guide-h">How do I...</h2>
            {!searching && <label className="pillsel"><span className="sr">Show topics for</span><select id="guide-role" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="all">All roles</option>{ALL.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>}
          </div>
          {groups.map((name) => (
            <Card key={name} title={name}>
              {topics.filter((g) => g.group === name).map((g) => <Topic key={g.id} g={g} role={role} go={go} open={searching && topics.length <= 6} />)}
            </Card>
          ))}
        </section>
      )}

      {faqs.length > 0 && (
        <Card title="Common questions">
          {faqs.map((x) => <details className="guide-topic" key={x.q} open={searching && faqs.length <= 4}><summary>{x.q}</summary><p>{x.a}</p></details>)}
        </Card>
      )}

      {words.length > 0 && (
        <Card title="Words explained" sub="Every (i) in the portal comes from this list.">
          <dl className="guide-words">{words.map((w) => <div key={w.word}><dt>{w.word}</dt><dd>{w.text}</dd></div>)}</dl>
        </Card>
      )}

      {!searching && <p className="small muted">Can't find it? <button className="linkbtn" onClick={() => go({ view: "feedback" })}>Ask us through Report a problem</button>. City data: GeoNames (CC BY 4.0).</p>}
    </div>
  );
}
