// IndSure Commercial demo prototype: shell, workspaces and the views that are not about one policy.
import "./commercial.css";
import { seed, TODAY, LIVE, DEPARTMENTS, NOTES_LOB, FIXTURES, fixtureById, isCargoOpen, CURRENCIES } from "./data.js";
import { fmtDate, fmtStamp, fmtMoney, fmtNum, fmtMonth, isNum, r2, nowIso, coverage, completeness, paymentSummary, instalmentRows, missingFields, insurerOf, branchOf, teamName, latestTerm, activePreset, fyRange, fyLabel, FY_OPTIONS, DATE_BASES, GROUPINGS, businessRows, groupRows, totals, renewalRows, toCsv, daysBetween, fxRate } from "./lib.js";
import { Ctx, useApp, SearchPick, Icon, PlaceFields, PlaceLists, Pill, Card, Empty, Btn, Labeled, Select, AskFirst, Modal, Tabs, KV, Table, Confirm, Proposed, Legacy } from "./ui.jsx";
import { OcrReview, PdfAttach, DocPane } from "./review.jsx";
import { PolicyView, AddDocForm, DocViewer, StatePills } from "./policy.jsx";
import { BrokerageView } from "./brokerage.jsx";
import { openStore, save, onSaveStatus, storeInfo, reloadLatest, listVersions, getVersion, hasUnsaved } from "./store.js";
import { QuickAdd, createPolicy } from "./add.jsx";
import { Guide } from "./guide.jsx";
import { placeOf } from "./places.js";
import { useState, useEffect, useMemo, useRef } from "react";

// Live and demo records never share storage.
const STORE = LIVE ? "indsure-commercial-live-v1" : "indsure-commercial-demo-v1";
const ROLES = {
  ops: { label: "Operations / BD", who: LIVE ? "Operations user" : "Meera Joshi (CSC014)", perms: ["createCustomer", "editCustomer", "newBusiness", "editDraft", "endorse", "renew", "markLost", "fleet", "declare", "schedule", "receipt", "addDoc", "addBranch"] },
  accounts: { label: "Accounts", who: LIVE ? "Accounts user" : "Farah Khan (ACC02)", perms: ["receipt", "export", "finalize", "addDoc"] },
  admin: { label: "Admin", who: LIVE ? "Admin" : "Admin (demo)", perms: "*" },
  readonly: { label: "Read-only", who: "Read-only viewer", perms: [] },
};
const NAV = [
  { group: "Operations", items: [
    { key: "home", label: "Today", icon: "home", roles: ["ops", "admin"] },
    { key: "customers", label: "Customers", icon: "users", roles: ["ops", "accounts", "admin", "readonly"] },
    { key: "new", label: "New business", icon: "plus", roles: ["ops", "admin"] },
    { key: "register", label: "Policy register", icon: "file", roles: ["ops", "accounts", "admin", "readonly"] },
    { key: "expiry", label: "Renewals due", icon: "refresh", roles: ["ops", "admin", "readonly"] }] },
  { group: "Accounts", items: [
    { key: "business", label: "Business report", icon: "chart", roles: ["accounts", "admin", "readonly"] },
    { key: "brokerage", label: "Brokerage received", icon: "wallet", roles: ["accounts", "admin", "readonly"] },
    { key: "renewreport", label: "Renewals report", icon: "list", roles: ["accounts", "admin", "readonly"] },
    { key: "snapshots", label: "Finalized reports", icon: "lock", roles: ["accounts", "admin"] }] },
  { group: "Admin", items: [
    { key: "masters", label: "Masters", icon: "db", roles: ["admin"] },
    { key: "fx", label: "FX rates", icon: "rupee", roles: ["accounts", "admin"] },
    { key: "presets", label: "Brokerage presets", icon: "percent", roles: ["accounts", "admin"] },
    { key: "reminders", label: "Reminders preview", icon: "bell", roles: ["ops", "admin"] },
    { key: "decisions", label: "Decisions", icon: "list", roles: ["ops", "accounts", "admin", "readonly"] }] },
  { group: "Help", items: [
    { key: "guide", label: "How to", icon: "help", roles: ["ops", "accounts", "admin", "readonly"] }] },
];


export function App() {
  const [db, setDb] = useState(null);
  const [saveState, setSaveState] = useState({ state: "idle" });
  const loaded = useRef(null);
  const [role, setRole] = useState("ops");
  const [fy, setFy] = useState("2026-27");
  const [route, setRoute] = useState({ view: "home" });
  const [toasts, setToasts] = useState([]);
  const [menu, setMenu] = useState(false);
  const [backup, setBackup] = useState(false);
  const menuBtn = useRef(null);
  const closeBtn = useRef(null);
  // Phone menu: focus moves into the drawer, Escape closes it from anywhere, focus returns to the Menu button.
  useEffect(() => {
    if (!menu) return;
    closeBtn.current?.focus();
    const k = (e) => { if (e.key === "Escape") { setMenu(false); menuBtn.current?.focus(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [menu]);
  const mainRef = useRef(null);
  // Load once. A book that has never been saved (a fresh seed) is saved straight away.
  useEffect(() => {
    onSaveStatus(setSaveState);
    openStore(STORE, seed).then((d) => {
      // The role once called CSE is now CSC. Books saved before the rename are brought up to date once.
      const old = (d.team || []).filter((t) => t.role === "CSE");
      if (old.length) {
        d = { ...d, team: d.team.map((t) => (t.role === "CSE" ? { ...t, role: "CSC" } : t)), audit: [...d.audit, { id: `A${d.audit.length + 1}`, at: nowIso(), who: "System", action: "Role renamed", detail: `CSE is now called CSC (${old.length} team member${old.length === 1 ? "" : "s"}).` }] };
        loaded.current = null; // save the updated book
      } else loaded.current = storeInfo().version ? d : null;
      setDb(d);
    });
  }, []);
  // Every change is saved shortly after it is made. The book exactly as loaded is not re-saved.
  useEffect(() => {
    if (!db || db === loaded.current) return;
    // Browser storage is instant, so save at once; server saves are batched a moment.
    if (storeInfo().kind !== "server") { save(STORE, db); return; }
    const t = setTimeout(() => save(STORE, db), 300);
    return () => clearTimeout(t);
  }, [db]);
  // Closing the tab while a change is still on its way to the local server asks first.
  useEffect(() => {
    const warn = (e) => { if (hasUnsaved()) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  // Another window saved first: take the latest book rather than overwrite it.
  useEffect(() => {
    if (saveState.state !== "conflict") return;
    reloadLatest().then((d) => { loaded.current = d; setDb(d); toast("Another window saved changes first. The latest records are shown; redo your last change if it is missing.", "bad"); }).catch(() => {});
  }, [saveState]);
  const R = ROLES[role];
  const can = (a) => R.perms === "*" || R.perms.includes(a);
  const log = (d, o) => d.audit.push({ id: `A${++d.seq}`, at: nowIso(), who: R.who, ...o });
  const update = (fn) => setDb((prev) => { const d = structuredClone(prev); fn(d); return d; });
  const toast = (msg, tone = "good") => { const id = Math.random(); setToasts((t) => [...t, { id, msg, tone }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600); };
  const go = (r) => { setRoute(r); setMenu(false); mainRef.current?.scrollTo?.(0, 0); window.scrollTo(0, 0); };
  const visible = (key) => NAV.flatMap((g) => g.items).find((i) => i.key === key)?.roles.includes(role);
  const switchRole = (r) => {
    setRole(r);
    const first = NAV.flatMap((g) => g.items).find((i) => i.roles.includes(r));
    const keep = ["customer", "policy"].includes(route.view) || NAV.flatMap((g) => g.items).find((i) => i.key === route.view)?.roles.includes(r);
    if (!keep) setRoute({ view: first.key });
  };
  const reset = () => { setDb(seed()); setRoute({ view: NAV.flatMap((g) => g.items).find((i) => i.roles.includes(role)).key }); toast(LIVE ? "All records in this browser were deleted" : "Demo reset to the starting example data"); };
  if (!db) return <div className="ic-loading" role="status">Opening your records...</div>;
  const ctx = { db, update, can, log, toast, who: R.who, role, fy, go };

  let view;
  const v = route.view;
  if (v === "policy") view = <PolicyView key={route.id + (route.termId || "")} policyId={route.id} termId={route.termId} tab={route.tab} go={go} />;
  else if (v === "customer") view = <CustomerView id={route.id} />;
  else if (v === "add") view = <QuickAdd key={route.nonce || "add"} />;
  else if (!visible(v)) view = <Empty title="Not available for this role">Switch role at the top, or pick a page from the menu.</Empty>;
  else view = {
    home: <HomeView />, customers: <CustomersView />, new: <NewBusiness key={(route.customerId || "new") + (route.fx?.id || "")} presetCustomer={route.customerId} presetFx={route.fx} />, register: <RegisterView />, expiry: <ExpiryView />,
    business: <BusinessReport />, brokerage: <BrokerageView />, renewreport: <RenewalsReport />, snapshots: <Snapshots openId={route.id} />, masters: <Masters />, fx: <FxView />, presets: <PresetsView />, reminders: <Reminders />, decisions: <Decisions />, guide: <Guide />,
  }[v];

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <header className="mtop">
          <div className="sb-brand"><img src={"/logo-white.png"} alt="" /><div><strong>IndSure</strong><span>Commercial</span></div></div>
          <button ref={menuBtn} className="mtop-btn" aria-expanded={menu} aria-controls="ic-sidebar" onClick={() => setMenu(true)}><Icon name="menu" /> Menu</button>
        </header>
        {menu && <div className="scrim" onClick={() => setMenu(false)} aria-hidden="true" />}
        <aside id="ic-sidebar" className={`sidebar ${menu ? "open" : ""}`}>
          <button ref={closeBtn} className="sb-close" aria-label="Close menu" onClick={() => { setMenu(false); menuBtn.current?.focus(); }}><Icon name="x" /></button>
          <div className="sb-brand"><img src={"/logo-white.png"} alt="" /><div><strong>IndSure</strong><span>Commercial</span></div></div>
          {can("newBusiness") && <button className={`sb-cta ${route.view === "add" ? "on" : ""}`} onClick={() => go({ view: "add", nonce: Date.now() })}><Icon name="upload" /> Add a policy</button>}
          <nav className="sidenav" aria-label="Workspaces">
            {NAV.map((g) => { const items = g.items.filter((i) => i.roles.includes(role)); return items.length ? (
              <div key={g.group} className="navgroup"><div className="navhead">{g.group}</div>
                {items.map((i) => <button key={i.key} className={`navitem ${route.view === i.key ? "on" : ""}`} aria-current={route.view === i.key ? "page" : undefined} onClick={() => go({ view: i.key })}><Icon name={i.icon} />{i.label}</button>)}
              </div>) : null; })}
          </nav>
          <div className="sb-foot">
            <span className="navhead">Signed in as</span>
            <strong>{R.who}</strong>
            <span>{R.label}</span>
          </div>
        </aside>
        <div className="content">
          <div className="demo-banner">
            <span className="row gap-xs"><Icon name="sparkle" size={16} /> {!LIVE ? "Demo prototype: fictional data, nothing leaves this browser." : storeInfo().kind === "server" ? "Your records are saved on this computer, not online." : "Beta: your records are kept in this browser only. Download a backup regularly."}</span>
            <div className="banner-ctl">
              <label className="pillsel"><span className="sr">Role</span><select id="role" value={role} onChange={(e) => switchRole(e.target.value)}>{Object.entries(ROLES).map(([k, x]) => <option key={k} value={k}>Role: {x.label}</option>)}</select></label>
              <label className="pillsel"><span className="sr">Financial year</span><select id="fy" value={fy} onChange={(e) => setFy(e.target.value)}>{FY_OPTIONS.map((f) => <option key={f} value={f}>F.Y. {f}</option>)}</select></label>
              {import.meta.env.DEV && <a className="btn btn-banner" href={LIVE ? "?demo" : "?"}>{LIVE ? "Open the demo" : "Back to my records"}</a>}
              <Btn kind="banner" onClick={() => setBackup(true)}>Backup</Btn>
              {LIVE ? <AskFirst label="Clear all data" question="Delete every record in this browser? Download a backup first." yes="Delete everything" onYes={reset} kind="banner" />
                : <AskFirst label="Reset demo" question="Put all example data back?" yes="Reset" onYes={reset} kind="banner" />}
            </div>
          </div>
          <p className="rolebar">{LIVE ? "Today" : "Today in this demo"}: {fmtDate(TODAY)}. Roles are for {LIVE ? "testing" : "the demo"}, not security <Confirm />. <SaveLine s={saveState} /></p>
          <main className="main" ref={mainRef}>{view}</main>
          <footer className="foot">{LIVE ? `IndSure Commercial beta. ${storeInfo().kind === "server" ? `Records and original PDFs are saved on this computer only (${storeInfo().dataDir}), never online.` : "Records you enter are kept in this browser only and are not sent anywhere."} PDFs are read on this computer, not uploaded anywhere. No email, payment or live system is used.` : <>IndSure Commercial demo prototype. All people, companies, insurers, policies, rates and amounts are fictional. No email, payment or live system is used. Sample documents use pre-written reading results; a PDF you attach is read inside this browser and not uploaded.</>}</footer>
          {backup && <BackupModal db={db} onRestore={(d) => { setDb(d); setBackup(false); setRoute({ view: NAV.flatMap((g) => g.items).find((i) => i.roles.includes(role)).key }); toast("Backup restored"); }} onClose={() => setBackup(false)} />}
        </div>
        <PlaceLists />
        <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.msg}</div>)}</div>
      </div>
    </Ctx.Provider>
  );
}

// ---------------------------------------------------------------- save status
function SaveLine({ s }) {
  const k = storeInfo().kind;
  const at = s.at ? ` at ${String(s.at.getHours()).padStart(2, "0")}:${String(s.at.getMinutes()).padStart(2, "0")}` : "";
  if (k === "server") {
    if (s.state === "offline") return <span className="save-line bad-text">Local server not answering. Changes will save when it is back; keep this tab open.</span>;
    return <span className="save-line" title={`Saved in ${storeInfo().dataDir}`}>{s.state === "saving" ? "Saving on this computer..." : `Saved on this computer${at}.`}</span>;
  }
  if (s.state === "error") return <span className="save-line bad-text">{s.reason === "full" ? "This browser's storage is full: recent changes are not saved. Download a backup." : "This browser blocked storage: changes last until you reload."}</span>;
  if (k === "browser-fallback") return <span className="save-line warn-text">The local server is not running, so records are kept in this browser only. Start it with the launcher.</span>;
  return <span className="save-line">Changes stay in this browser.</span>;
}

// ---------------------------------------------------------------- backup
function EarlierSaves({ onRestore }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { listVersions().then(setRows).catch(() => setRows([])); }, []);
  return (
    <Card title="Earlier saves" sub="Every change is kept as a numbered save on this computer (the last 200). Go back to one if something went wrong.">
      {rows == null ? <p className="small muted">Loading...</p> : !rows.length ? <p className="small muted">No earlier saves yet.</p> : (
        <Table><thead><tr><th>Save</th><th>When</th><th /></tr></thead>
          <tbody>{rows.slice(0, 15).map((r, i) => <tr key={r.version}><td>#{r.version}{i === 0 && <Pill tone="good">Current</Pill>}</td><td>{fmtStamp(r.savedAt.slice(0, 19))}</td>
            <td>{i > 0 && <AskFirst label="Go back to this" question={`Replace your records with save #${r.version}? Later saves are kept.`} yes="Go back" onYes={async () => onRestore((await getVersion(r.version)).db)} />}</td></tr>)}</tbody></Table>)}
    </Card>
  );
}

function BackupModal({ db, onRestore, onClose }) {
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(null);
  const counts = `${db.customers.length} customers, ${db.policies.length} policies, ${db.documents.length} documents`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ kind: "indsure-commercial-backup", mode: LIVE ? "live" : "demo", savedAt: nowIso(), db })], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `indsure-commercial-backup-${TODAY}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setMsg(`Downloaded a backup of ${counts}.`);
  };
  const read = async (file) => {
    setPending(null); setMsg("");
    if (!file) return;
    try {
      const x = JSON.parse(await file.text());
      const d = x?.db;
      const ok = x?.kind === "indsure-commercial-backup" && d && d.version === 2 && ["customers", "policies", "terms", "documents", "insurers", "team"].every((k) => Array.isArray(d[k]));
      if (!ok) return setMsg("This is not an IndSure Commercial backup file.");
      if ((x.mode === "live") !== LIVE) return setMsg(LIVE ? "This backup holds demo data and cannot be restored here." : "This backup holds live records; restore it on beta.");
      setPending({ d, savedAt: x.savedAt, counts: `${d.customers.length} customers, ${d.policies.length} policies` });
    } catch (e) { setMsg("The file could not be read as a backup."); }
  };
  return (
    <Modal title="Backup and restore" onClose={onClose}>
      <p>{!LIVE ? "Saves or restores everything in this browser." : storeInfo().kind === "server" ? `Your records and original PDFs are saved in ${storeInfo().dataDir} on this computer. Copy that folder, or download a backup file, to keep a copy elsewhere.` : "Your records live only in this browser. Clearing browser data, or using another browser or laptop, starts empty. Keep a backup file somewhere safe."}</p>
      <Card title="Download a backup" sub={`Now: ${counts}.`}><Btn kind="primary" onClick={download}>Download backup</Btn></Card>
      <Card title="Restore from a backup" sub="Replaces everything in this browser with the file's contents.">
        <input id="bk-file" type="file" accept=".json,application/json" onChange={(e) => { read(e.target.files[0]); e.target.value = ""; }} />
        {pending && <div className="row gap-s wrap"><span className="small">Backup from {fmtStamp(pending.savedAt)}: {pending.counts}.</span><AskFirst label="Restore this backup" question="Replace everything in this browser?" yes="Replace" onYes={() => onRestore(pending.d)} /></div>}
      </Card>
      {storeInfo().kind === "server" && <EarlierSaves onRestore={onRestore} />}
      {msg && <p className="small" role="status">{msg}</p>}
    </Modal>
  );
}

// ---------------------------------------------------------------- Today
function HomeView() {
  const { db, go, can } = useApp();
  const drafts = db.terms.filter((t) => t.status === "draft");
  const soon = db.terms.filter((t) => t.status === "confirmed" && t.outcome === "Open" && t.values.riskEnd && t.values.riskEnd >= TODAY && daysBetween(TODAY, t.values.riskEnd) <= 45 && !t.nextTermId);
  const overdue = db.terms.filter((t) => t.status === "confirmed").flatMap((t) => instalmentRows(t).filter((r) => r.out > 0 && r.due < TODAY).map((r) => ({ t, r })));
  const P = (t) => db.policies.find((p) => p.id === t.policyId);
  const C = (t) => db.customers.find((c) => c.id === P(t).customerId);
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Today</h1><p className="muted">What needs a person's attention. Each item opens the record.</p></div>{can("newBusiness") && <Btn kind="primary" onClick={() => go({ view: "add", nonce: Date.now() })}>Add a policy from a PDF</Btn>}</header>
      <div className="grid3">
        <Card title={`Drafts to finish (${drafts.length})`} sub="Saved from a document, still missing something.">
          {drafts.length ? drafts.map((t) => <button key={t.id} className="listrow" onClick={() => go({ view: "policy", id: t.policyId, termId: t.id })}><strong>{C(t).name}</strong><span>{P(t).type}{t.prevTermId ? " (renewal)" : ""}</span><span className="small warn-text">Missing: {missingFields(t).join(", ")}</span></button>) : <Empty title="No drafts" />}
        </Card>
        <Card title={`Ending in 45 days (${soon.length})`} sub="Includes policies marked non-renewable.">
          {soon.length ? soon.map((t) => <button key={t.id} className="listrow" onClick={() => go({ view: "policy", id: t.policyId, termId: t.id, tab: "renewals" })}><strong>{C(t).name}</strong><span>{P(t).type}</span><span className="small">Ends {fmtDate(t.values.riskEnd)} · Renewable: {t.values.renewable || "not entered"}</span></button>) : <Empty title="Nothing ending soon" />}
        </Card>
        <Card title={`Instalments overdue (${overdue.length})`} sub="Due date passed, money not fully received.">
          {overdue.length ? overdue.map(({ t, r }) => <button key={t.id + r.no} className="listrow" onClick={() => go({ view: "policy", id: t.policyId, termId: t.id, tab: "payments" })}><strong>{C(t).name}</strong><span>Instalment {r.no}, due {fmtDate(r.due)}</span><span className="small bad-text">{fmtMoney(r.out, t.values.currency)} outstanding</span></button>) : <Empty title="No overdue instalments">Upcoming ones are on each policy's Payments tab.</Empty>}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- customers
const CUST_FIELDS = { name: "Insured name", address: "Address", city: "City", phone: "Contact number", email: "Email", gst: "GSTIN" };
function CustomerForm({ onDone, initial, onUseExisting, offerPolicy }) {
  const { db, update, log, toast } = useApp();
  const [f, setF] = useState(initial || { name: "", vertical: "Corporate", address: "", city: "", state: "", country: "India", phone: "", email: "", gst: "", source: "Direct", referral: "", tags: "", cse: "", rm: "" });
  const [tried, setTried] = useState(false);
  const [fx, setFx] = useState(null);
  const [srcs, setSrcs] = useState({});
  const set = (k) => (v) => {
    const val = typeof v === "string" ? v : v.target.value;
    setF((x) => ({ ...x, [k]: val }));
    setSrcs((p) => (p[k] && !p[k].edited && val !== p[k].v ? { ...p, [k]: { ...p[k], edited: true } } : p));
  };
  const onRead = (x) => {
    setFx(x);
    const got = x.customer || {};
    const filled = {};
    setF((cur) => { const next = { ...cur }; Object.entries(got).forEach(([k, s]) => { if (!String(cur[k] || "").trim()) { next[k] = s.v; filled[k] = s; } });
      // A city read from the document fills State and Country too.
      const place = filled.city ? placeOf(next.city) : null;
      if (place) { if (!String(cur.state || "").trim()) next.state = place.state; next.country = place.country; }
      return next; });
    setSrcs(() => filled);
    setTried(false);
  };
  const hint = (k, base) => {
    const s = srcs[k];
    if (!fx) return base;
    if (!s) return fx.customer && !fx.customer[k] ? <span className="src">Not on the document{["name", "city"].includes(k) ? ", please enter" : ""}</span> : base;
    return <span className="row gap-xs wrap"><span className={`src ${s.edited ? "src-edit" : s.conf === "low" ? "src-low" : "src-ok"}`}>{s.edited ? `Edited (document said ${s.v})` : `From the PDF, line ${s.ref}`}</span>{s.note && !s.edited && <span className="warn-text">{s.note}</span>}</span>;
  };
  const dup = db.customers.find((c) => c.name.trim().toLowerCase() === f.name.trim().toLowerCase() && c.id !== initial?.id);
  const stillNeeded = [!f.name.trim() && "Insured name", !f.city.trim() && "City", !f.cse && "CSC"].filter(Boolean);
  const errs = {
    name: !f.name.trim() ? "Enter the insured name (the customer named on the policy)" : dup ? `Already exists as ${dup.code}. Open that customer instead.` : null,
    city: !f.city.trim() ? "Enter the city" : null,
    email: f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) ? "This does not look like an email address" : null,
    gst: f.gst && f.gst.trim().length !== 15 ? "A GSTIN has 15 characters" : null,
    cse: !f.cse ? "A CSC must be assigned" : null,
    referral: f.source === "Referral" && !f.referral.trim() ? "Name the referral" : null,
  };
  const save = (thenPolicy) => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return null;
    let id;
    update((d) => {
      const tags = (typeof f.tags === "string" ? f.tags.split(",") : f.tags).map((x) => x.trim()).filter(Boolean);
      if (initial) { const c = d.customers.find((x) => x.id === initial.id); Object.assign(c, { ...f, tags }); id = c.id; log(d, { customerId: c.id, action: "Customer updated", detail: `Details or team changed. CSC ${f.cse}, RM ${f.rm || "none"}.` }); }
      else {
        id = `C${++d.seq}`; const code = `CUST-${1000 + d.customers.length + 1}`; d.customers.push({ ...f, tags, id, code, createdAt: nowIso() });
        const from = Object.keys(srcs).filter((k) => !srcs[k].edited).map((k) => CUST_FIELDS[k]);
        log(d, { customerId: id, action: "Customer created", detail: `${f.name} created as ${code}.${fx ? ` ${from.length ? `${from.join(", ")} read from ${fx.fileName}` : `Nothing read from ${fx.fileName}`}; the rest entered by hand.` : ""}` });
      }
    });
    toast(initial ? "Customer saved" : "Customer created");
    onDone(id, thenPolicy ? fx : null);
    return id;
  };
  // Active people only, plus whoever this customer already has, so an inactive CSC still shows until changed.
  const team = (role) => db.team.filter((t) => t.role === role && (t.active !== false || t.code === f.cse || t.code === f.rm)).map((t) => ({ value: t.code, label: `${t.name} (${t.code})${t.active === false ? " (inactive)" : ""}` }));
  const nRead = Object.keys(fx?.customer || {}).length;
  return (
    <div className="formgrid boxed">
      {!initial && (
        <div className="fld-wide stack">
          <PdfAttach id="cf-file" label="Attach the customer's policy PDF or GST certificate to fill this in" ready={fx} onReady={onRead}
            describe={(x) => x.noText ? <><strong>{x.fileName}</strong>: no readable text, even read as a scan. Please type the details.</> : <><strong>{x.fileName}</strong>: found {nRead} customer detail{nRead === 1 ? "" : "s"}{nRead ? ` (${Object.keys(x.customer).map((k) => CUST_FIELDS[k]).join(", ")})` : ""}. Fields already typed were not changed.</>} />
          {fx && stillNeeded.length > 0 && <div className="askpanel" role="status"><strong>Please enter: {stillNeeded.join(", ")}.</strong> {stillNeeded.includes("CSC") ? "The CSC is never taken from a document. " : ""}{stillNeeded.includes("City") && f.address ? "The city is not filled from the address automatically; type it to be sure." : ""}</div>}
          {fx && !fx.noText && <details className="small"><summary>Show the text read from {fx.fileName}</summary><DocPane lines={fx.lines} title={fx.fileName} extracted /></details>}
        </div>
      )}
      <Labeled label="Insured name (customer)" htmlFor="cf-name" req error={tried && errs.name} hint={hint("name")}><input id="cf-name" value={f.name} onChange={set("name")} /></Labeled>
      {tried && dup && onUseExisting && <div className="fld"><Btn onClick={() => onUseExisting(dup.id, fx)}>Use {dup.code} instead</Btn></div>}
      <Labeled label="Vertical" htmlFor="cf-vert" hint="Corporate or Retail, as in current reports"><Select id="cf-vert" value={f.vertical} onChange={set("vertical")} options={["Corporate", "Retail"]} /></Labeled>
      <Labeled label="Address" htmlFor="cf-addr" hint={hint("address")}><input id="cf-addr" value={f.address} onChange={set("address")} /></Labeled>
      <PlaceFields id="cf" value={{ city: f.city, state: f.state, country: f.country }} req cityError={tried && errs.city} cityHint={hint("city")}
        onChange={(p) => { if (p.city !== f.city) set("city")(p.city); setF((x) => ({ ...x, state: p.state, country: p.country })); }} />
      <Labeled label="Contact number" htmlFor="cf-phone" hint={hint("phone")}><input id="cf-phone" value={f.phone} onChange={set("phone")} /></Labeled>
      <Labeled label="Email" htmlFor="cf-email" error={tried && errs.email} hint={hint("email")}><input id="cf-email" value={f.email} onChange={set("email")} /></Labeled>
      <Labeled label="GSTIN" htmlFor="cf-gst" error={tried && errs.gst} hint={hint("gst")}><input id="cf-gst" value={f.gst} onChange={set("gst")} /></Labeled>
      <Labeled label="Source" htmlFor="cf-src"><Select id="cf-src" value={f.source} onChange={set("source")} options={["Direct", "Referral"]} /></Labeled>
      {f.source === "Referral" && <Labeled label="Referral (REF/POS name)" htmlFor="cf-ref" req error={tried && errs.referral}><input id="cf-ref" value={f.referral} onChange={set("referral")} /></Labeled>}
      <Labeled label="POC tags (comma separated)" htmlFor="cf-tags"><input id="cf-tags" value={typeof f.tags === "string" ? f.tags : f.tags.join(", ")} onChange={set("tags")} /></Labeled>
      <Labeled label="CSC" htmlFor="cf-cse" req error={tried && errs.cse} hint="Type a name or code, then pick from the list"><SearchPick id="cf-cse" value={f.cse} onChange={set("cse")} options={team("CSC")} noun="CSC" /></Labeled>
      <Labeled label="RM" htmlFor="cf-rm" hint="Optional. Type a name or code. Inward/outward meaning is open (decision 8)"><SearchPick id="cf-rm" value={f.rm} onChange={set("rm")} options={team("RM")} noun="RM" emptyLabel="Not assigned" /></Labeled>
      <p className="fld-wide small muted">PAN is not collected until purpose, access and retention are decided <Confirm /></p>
      <div className="row gap-s fld-wide wrap">
        <Btn onClick={() => onDone(null)}>Cancel</Btn>
        {offerPolicy && fx && !fx.noText && <Btn kind="primary" onClick={() => save(true)}>Create customer and add this policy</Btn>}
        <Btn kind={offerPolicy && fx && !fx.noText ? "secondary" : "primary"} onClick={() => save(!offerPolicy && !!fx)}>{initial ? "Save customer" : offerPolicy && fx && !fx.noText ? "Create customer only" : "Create customer"}</Btn>
      </div>
    </div>
  );
}

function CustomersView() {
  const { db, go, can } = useApp();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const s = q.trim().toLowerCase();
  const list = db.customers.filter((c) => !s || [c.name, c.code, c.city, c.gst, teamName(db, c.cse), teamName(db, c.rm)].join(" ").toLowerCase().includes(s));
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Customers</h1><p className="muted">The customer is the insured named on the policy. One customer holds every policy, of any type. Search by insured name, code, city, GSTIN or team member.</p></div>{can("createCustomer") && !adding && <Btn kind="primary" onClick={() => setAdding(true)}>Add customer</Btn>}</header>
      {adding && <Card title="New customer"><CustomerForm offerPolicy onDone={(id, fx) => { setAdding(false); if (id) go(fx ? { view: "new", customerId: id, fx } : { view: "customer", id }); }} onUseExisting={(id, fx) => { setAdding(false); go(fx && !fx.noText ? { view: "new", customerId: id, fx } : { view: "customer", id }); }} /></Card>}
      <div className="searchbar"><label htmlFor="cs-q" className="sr">Search customers</label><input id="cs-q" type="search" placeholder="Search by insured name, code, city, GSTIN, CSC or RM" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.length ? (
        <Table><thead><tr><th>Code</th><th>Insured</th><th>Vertical</th><th>City</th><th>CSC</th><th>RM</th><th className="num">Policies</th></tr></thead>
          <tbody>{list.map((c) => <tr key={c.id} className="clickrow" onClick={() => go({ view: "customer", id: c.id })}><td>{c.code}</td><td><button className="linkbtn">{c.name}</button></td><td>{c.vertical}</td><td>{[c.city, c.state].filter(Boolean).join(", ")}<div className="small muted">{c.country}</div></td><td>{teamName(db, c.cse)}</td><td>{c.rm ? teamName(db, c.rm) : "--"}</td><td className="num">{db.policies.filter((p) => p.customerId === c.id).length}</td></tr>)}</tbody></Table>
      ) : <Empty title={`No customer matches "${q}"`}>Check the spelling, or add a new customer.</Empty>}
    </div>
  );
}

function CustomerView({ id }) {
  const { db, go, can } = useApp();
  const [edit, setEdit] = useState(false);
  const [addDoc, setAddDoc] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);
  const c = db.customers.find((x) => x.id === id);
  if (!c) return <Empty title="Customer not found">It may have been deleted, or the data was cleared.</Empty>;
  const pols = db.policies.filter((p) => p.customerId === c.id);
  const docs = db.documents.filter((d) => d.customerId === c.id);
  const hist = db.audit.filter((a) => a.customerId === c.id && !a.policyId).slice().reverse();
  return (
    <div className="stack">
      <div className="crumbs"><button className="linkbtn" onClick={() => go({ view: "customers" })}>Customers</button> / {c.code}</div>
      <header className="page-head"><div><p className="eyebrow">{c.code} · {c.vertical}</p><h1>{c.name}</h1><p className="muted">{[c.address, c.city, c.state, c.country].filter(Boolean).join(", ")}</p></div>
        <div className="row gap-s wrap">{can("editCustomer") && !edit && <Btn onClick={() => setEdit(true)}>Edit details and team</Btn>}{can("newBusiness") && <Btn kind="primary" onClick={() => go({ view: "new", customerId: c.id })}>New business for this customer</Btn>}</div></header>
      {edit ? <Card title="Edit customer"><CustomerForm initial={{ ...c, tags: c.tags.join(", ") }} onDone={() => setEdit(false)} /></Card> : (
        <div className="grid2">
          <Card title="Details"><KV items={[["Contact number", c.phone || "--"], ["Email", c.email || "--"], ["GSTIN", c.gst || "--"], ["Source", c.source === "Referral" ? `Referral: ${c.referral}` : "Direct business"], ["POC tags", c.tags.length ? c.tags.join(", ") : "--"]]} /></Card>
          <Card title="Team"><KV items={[["CSC", teamName(db, c.cse)], ["RM", c.rm ? teamName(db, c.rm) : "Not assigned"]]} /></Card>
        </div>
      )}
      <Card title={`Policies (${pols.length})`} sub="Each policy keeps its terms. Renewal adds a linked term.">
        {pols.length ? <Table><thead><tr><th>Control no.</th><th>Policy type</th><th>Latest policy no.</th><th>Insurer</th><th>Terms</th><th>Record</th><th>Cover</th><th>Payment</th></tr></thead>
          <tbody>{pols.map((p) => { const t = latestTerm(db, p); const pay = paymentSummary(t); return <tr key={p.id} className="clickrow" onClick={() => go({ view: "policy", id: p.id })}><td>{p.controlNo}</td><td><button className="linkbtn">{p.type}</button><div className="small muted">{p.dept}</div></td><td>{t.values.policyNo || "--"}</td><td>{insurerOf(db, p.insurerId)?.name}</td><td>{p.termIds.length}</td><td><Pill tone={completeness(t).tone}>{completeness(t).label}</Pill></td><td><Pill tone={coverage(t).tone}>{coverage(t).label}</Pill></td><td>{t.status === "draft" ? "--" : <Pill tone={pay.tone}>{pay.label}</Pill>}</td></tr>; })}</tbody></Table>
          : <Empty title="No policies yet">Documents such as quotes and KYC can sit here before any policy exists.</Empty>}
      </Card>
      <Card title={`Documents (${docs.length})`} sub="Pre-policy documents need no policy link. Link them later from a policy's Documents tab." actions={can("addDoc") && !addDoc && <Btn onClick={() => setAddDoc(true)}>Add document</Btn>}>
        {addDoc && <AddDocForm customerId={c.id} kinds={["Quote", "KYC", "GST certificate", "Supporting document"]} onDone={() => setAddDoc(false)} />}
        {docs.length ? <Table><thead><tr><th>Document</th><th>Type</th><th>Linked to</th><th>Added</th><th /></tr></thead>
          <tbody>{docs.map((d) => { const p = pols.find((x) => x.id === d.policyId); return <tr key={d.id}><td>{d.name}{d.note && <div className="small muted">{d.note}</div>}</td><td>{d.kind}</td><td>{p ? `${p.type} (${p.controlNo})` : <span className="muted">Customer only</span>}</td><td>{fmtStamp(d.addedAt)}</td><td><Btn onClick={() => setViewDoc(d)}>View</Btn></td></tr>; })}</tbody></Table> : <Empty title="No documents" />}
      </Card>
      {hist.length > 0 && <Card title="Customer history"><ol className="timeline">{hist.map((a) => <li key={a.id}><div className="row between wrap gap-s"><strong>{a.action}</strong><span className="small muted">{fmtStamp(a.at)} · {a.who}</span></div><div>{a.detail}</div></li>)}</ol></Card>}
      {viewDoc && <DocViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- new business
const STEPS = ["Customer", "Team", "Insurer and branch", "Department and type", "Document", "Review"];
function NewBusiness({ presetCustomer, presetFx }) {
  const { db, update, can, log, toast, go, who } = useApp();
  const [step, setStep] = useState(presetCustomer ? 1 : 0);
  const [s, setS] = useState({ customerId: presetCustomer || "", cse: "", rm: "", insurerId: "", branchId: "", dept: "", type: "", cover: "", vesselMode: "", fixtureId: "" });
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [addBr, setAddBr] = useState(false);
  const [nb, setNb] = useState({ name: "", city: "", state: "", country: "India" });
  const [tried, setTried] = useState(false);
  const [userFx, setUserFx] = useState(presetFx || null);
  const c = db.customers.find((x) => x.id === s.customerId);
  useEffect(() => { if (c) setS((x) => ({ ...x, cse: x.cse || c.cse, rm: x.rm || c.rm })); }, [s.customerId]);
  if (!can("newBusiness")) return <Empty title="Your role cannot start new business" />;
  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v }));
  const ins = insurerOf(db, s.insurerId), br = branchOf(db, s.insurerId, s.branchId);
  const stepErr = [
    !s.customerId ? "Choose or create a customer" : null,
    !s.cse ? "A CSC must be assigned" : null,
    !s.insurerId ? "Choose the insurer" : !s.branchId ? "Choose the insurer branch" : null,
    !s.dept ? "Choose the department" : !s.type ? "Choose the policy type" : null,
    !s.fixtureId && !userFx ? (LIVE ? "Attach the policy PDF" : "Attach the policy PDF, or choose a sample document") : null,
  ][step];
  const next = () => { setTried(true); if (!stepErr) { setTried(false); setStep(step + 1); } };
  const fx = userFx || fixtureById(s.fixtureId);
  const app = useApp();
  const finish = (pl, confirm) => createPolicy(app, s, fx, pl, confirm);
  const cancel = () => go({ view: presetCustomer ? "customer" : "home", id: presetCustomer });
  if (step === 5) return <OcrReview fixture={fx} customerName={c.name} insurerId={s.insurerId} branchId={s.branchId} policyType={s.type} heading={`New business: ${c.name}, ${s.type}`} onCancel={() => setStep(4)} onSaveDraft={(pl) => finish(pl, false)} onConfirm={(pl) => finish(pl, true)} />;
  const s_ = q.trim().toLowerCase();
  const matches = db.customers.filter((x) => !s_ || `${x.name} ${x.code} ${x.city}`.toLowerCase().includes(s_)).slice(0, 8);
  const team = (role) => db.team.filter((t) => t.role === role && t.active !== false).map((t) => ({ value: t.code, label: `${t.name} (${t.code})` }));
  return (
    <div className="stack">
      <header className="page-head"><div><h1>New business</h1><p className="muted">One step at a time. You can go back at any point; nothing is saved until the review screen.</p></div><AskFirst label="Cancel" question="Leave without saving?" yes="Leave" onYes={cancel} /></header>
      <ol className="stepper" aria-label={`Step ${step + 1} of ${STEPS.length}`}>{STEPS.map((x, i) => <li key={x} className={i === step ? "on" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}><span>{i + 1}</span>{x}{i === step && <em className="step-of"> of {STEPS.length}</em>}</li>)}</ol>
      <Card>
        {step === 0 && (creating ? <CustomerForm onDone={(id, fx) => { setCreating(false); if (id) { if (fx) setUserFx(fx); set("customerId")(id); setStep(1); } }} onUseExisting={(id, fx) => { setCreating(false); if (fx) setUserFx(fx); set("customerId")(id); setStep(1); }} /> : (
          <div className="stack">
            <h2>Who is the customer?</h2>
            <div className="searchbar"><label htmlFor="nb-q" className="sr">Search customers</label><input id="nb-q" type="search" placeholder="Type a name, code or city" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="choices">{matches.map((x) => <button key={x.id} className={`choice ${s.customerId === x.id ? "on" : ""}`} onClick={() => set("customerId")(x.id)} aria-pressed={s.customerId === x.id}><strong>{x.name}</strong><span>{x.code} · {x.city} · {x.vertical}</span></button>)}</div>
            {!matches.length && <Empty title="No match">Create the customer instead.</Empty>}
            <div><Btn onClick={() => setCreating(true)}>Create a new customer</Btn></div>
          </div>))}
        {step === 1 && (
          <div className="stack"><h2>Who looks after {c.name}?</h2>
            <div className="formgrid">
              <Labeled label="CSC" htmlFor="nb-cse" req error={tried && stepErr} hint="Mandatory. Type a name or code, then pick from the list"><SearchPick id="nb-cse" value={s.cse} onChange={set("cse")} options={team("CSC")} noun="CSC" /></Labeled>
              <Labeled label="RM" htmlFor="nb-rm" hint="Optional. Type a name or code"><SearchPick id="nb-rm" value={s.rm} onChange={set("rm")} options={team("RM")} noun="RM" emptyLabel="Not assigned" /></Labeled>
            </div>
            <p className="small muted">Changing these updates the customer record, with history.</p></div>)}
        {step === 2 && (
          <div className="stack"><h2>Which insurer office issued it?</h2>
            <div className="formgrid">
              <Labeled label="Insurer" htmlFor="nb-ins" req error={tried && !s.insurerId ? stepErr : null}><Select id="nb-ins" value={s.insurerId} onChange={(v) => setS((x) => ({ ...x, insurerId: v, branchId: "" }))} placeholder="Choose insurer" options={db.insurers.map((i) => ({ value: i.id, label: i.name }))} /></Labeled>
              <Labeled label="Insurer branch" htmlFor="nb-br" req error={tried && s.insurerId && !s.branchId ? stepErr : null}><Select id="nb-br" value={s.branchId} onChange={set("branchId")} disabled={!ins} placeholder={ins ? "Choose branch" : "Choose insurer first"} options={(ins?.branches || []).map((b) => ({ value: b.id, label: `${b.name}, ${b.city}` }))} /></Labeled>
              <Labeled label="City (filled from branch)" htmlFor="nb-city"><input id="nb-city" value={br?.city || ""} readOnly /></Labeled>
              <Labeled label="State (filled from branch)" htmlFor="nb-state"><input id="nb-state" value={br?.state || ""} readOnly /></Labeled>
              <Labeled label="Country (filled from branch)" htmlFor="nb-country"><input id="nb-country" value={br?.country || ""} readOnly /></Labeled>
            </div>
            {ins && can("addBranch") && (!addBr ? <div><Btn onClick={() => setAddBr(true)}>Branch not listed? Add it</Btn></div> : (
              <div className="formgrid boxed">
                <Labeled label="Branch name" htmlFor="nb-bn" req error={tried && addBr && !nb.name.trim() ? "Required" : null}><input id="nb-bn" value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} /></Labeled>
                <PlaceFields id="nb-b" value={nb} req countryReq onChange={(p) => setNb({ ...nb, ...p })} />
                <div className="row gap-s fld-wide"><Btn onClick={() => setAddBr(false)}>Cancel</Btn><Btn kind="primary" onClick={() => {
                  if (!nb.name.trim() || !nb.city.trim() || !nb.country.trim()) { setTried(true); toast("Fill branch name, city and country", "bad"); return; }
                  if (ins.branches.some((b) => b.name.toLowerCase() === nb.name.trim().toLowerCase())) { toast("That branch already exists for this insurer", "bad"); return; }
                  let bid; update((d) => { bid = `BR${++d.seq}`; d.insurers.find((i) => i.id === ins.id).branches.push({ id: bid, name: nb.name.trim(), city: nb.city.trim(), state: (nb.state || "").trim(), country: nb.country.trim() }); log(d, { action: "Branch added", detail: `${nb.name} (${nb.city}) added to ${ins.name} from new business.` }); });
                  setTimeout(() => setS((x) => ({ ...x, branchId: bid })), 0); setAddBr(false); setNb({ name: "", city: "", state: "", country: "India" }); toast("Branch added to masters"); }}>Save branch</Btn></div>
              </div>))}
          </div>)}
        {step === 3 && (
          <div className="stack"><h2>What kind of policy?</h2>
            <div className="formgrid">
              <Labeled label="Department" htmlFor="nb-dept" req error={tried && !s.dept ? stepErr : null}><Select id="nb-dept" value={s.dept} onChange={(v) => setS((x) => ({ ...x, dept: v, type: "" }))} placeholder="Choose department" options={Object.keys(DEPARTMENTS)} /></Labeled>
              <Labeled label="Policy type" htmlFor="nb-type" req error={tried && s.dept && !s.type ? stepErr : null}><Select id="nb-type" value={s.type} onChange={set("type")} disabled={!s.dept} placeholder={s.dept ? "Choose policy type" : "Choose department first"} options={DEPARTMENTS[s.dept] || []} /></Labeled>
              <Labeled label="Individual or Group" htmlFor="nb-cover" hint="Where it applies"><Select id="nb-cover" value={s.cover} onChange={set("cover")} placeholder="Not applicable" options={["Individual", "Group"]} /></Labeled>
              {s.dept === "Marine" && ["Protection & Indemnity", "Marine Hull & Machinery", "Charterers Liability"].includes(s.type) && <Labeled label="Vessel cover" htmlFor="nb-vm" hint="Kept apart from Individual/Group"><Select id="nb-vm" value={s.vesselMode} onChange={set("vesselMode")} placeholder="Choose" options={["Individual vessel", "Fleet"]} /></Labeled>}
            </div>
            <p className="small muted">Lists are as captured from the current platform; final lists are an open decision <Confirm /></p></div>)}
        {step === 4 && (
          <div className="stack"><h2>Attach the policy document</h2>
            <PdfAttach id="nb-file" ready={userFx} onReady={(x) => { setUserFx(x); set("fixtureId")(""); setTried(false); }} />
            {!LIVE && <>
            <h3>Or use a sample document</h3>
            <p className="muted small">Fixed samples with pre-written reading results, for trying the flow without a real policy.</p>
            <div className="choices">{FIXTURES.map((x) => <button key={x.id} className={`choice ${s.fixtureId === x.id ? "on" : ""}`} aria-pressed={s.fixtureId === x.id} onClick={() => { setUserFx(null); set("fixtureId")(x.id); }}><strong>{x.title}</strong><span>{x.dept} · {x.type}</span>{x.type !== s.type && <span className="small warn-text">Sample is a {x.type} document; you chose {s.type}.</span>}</button>)}</div></>}
            {tried && stepErr && <div className="err-text" role="alert">{stepErr}</div>}
          </div>)}
        {tried && stepErr && step !== 4 && step !== 0 && <div className="sr" role="alert">{stepErr}</div>}
        {tried && stepErr && step === 0 && <div className="err-text" role="alert">{stepErr}</div>}
        {!creating && (
          <div className="row gap-s wizard-nav">
            {step > 0 && <Btn onClick={() => { setTried(false); setStep(step - 1); }}>Back</Btn>}
            <Btn kind="primary" onClick={next}>{step === 4 ? "Read document and review" : "Next"}</Btn>
          </div>)}
      </Card>
      {c && <p className="small muted">Insured: {c.name} ({c.code}){s.cse ? ` · CSC ${teamName(db, s.cse)}` : ""}{ins ? ` · ${ins.name}` : ""}{br ? `, ${br.name}` : ""}{s.type ? ` · ${s.type}` : ""}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- register
function RegisterView() {
  const { db, go } = useApp();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [rec, setRec] = useState("");
  const [cov, setCov] = useState("");
  const rows = db.policies.map((p) => ({ p, t: latestTerm(db, p), c: db.customers.find((x) => x.id === p.customerId) }))
    .filter(({ p, t, c }) => (!dept || p.dept === dept) && (!rec || completeness(t).label === rec) && (!cov || coverage(t).label === cov) && (!q.trim() || `${c.name} ${c.code} ${p.controlNo} ${t.values.policyNo} ${p.type}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Policy register</h1><p className="muted">Latest term of every policy. Record, cover, payment, renewable and renewal outcome are separate facts.</p></div></header>
      <div className="filters">
        <Labeled label="Search" htmlFor="rg-q"><input id="rg-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Insured, code, policy or control no." /></Labeled>
        <Labeled label="Department" htmlFor="rg-dept"><Select id="rg-dept" value={dept} onChange={setDept} placeholder="All" options={Object.keys(DEPARTMENTS)} /></Labeled>
        <Labeled label="Record" htmlFor="rg-rec"><Select id="rg-rec" value={rec} onChange={setRec} placeholder="All" options={["Draft", "Complete"]} /></Labeled>
        <Labeled label="Cover" htmlFor="rg-cov"><Select id="rg-cov" value={cov} onChange={setCov} placeholder="All" options={["Scheduled", "Active", "Expired", "Cancelled", "Not confirmed"]} /></Labeled>
      </div>
      {rows.length ? <Table className="register"><thead><tr><th>Policy</th><th>Insured</th><th>Risk period</th><th className="num">Gross premium</th><th>Record · cover · payment</th><th>Renewal</th></tr></thead>
        <tbody>{rows.map(({ p, t, c }) => { const pay = paymentSummary(t); return <tr key={p.id} className="clickrow" onClick={() => go({ view: "policy", id: p.id })}><td><button className="linkbtn">{t.values.policyNo || "No policy no. yet"}</button><div className="small muted">{p.controlNo} · issued {fmtDate(t.values.issueDate)}</div></td><td><strong>{c.name}</strong><div className="small muted">{p.type}</div></td><td className="nowrap">{fmtDate(t.values.riskStart)}<div className="small muted">to {fmtDate(t.values.riskEnd)}</div></td><td className="num">{fmtMoney(t.values.grossPremium, t.values.currency)}</td><td><div className="pills"><Pill tone={completeness(t).tone}>{completeness(t).label}</Pill><Pill tone={coverage(t).tone}>{coverage(t).label}</Pill>{t.status !== "draft" && <Pill tone={pay.tone}>{pay.label}</Pill>}</div></td><td className="small">{t.outcome}<div className="muted">Renewable: {t.values.renewable || "not entered"}</div></td></tr>; })}</tbody></Table>
        : <Empty title="No policies match these filters">Clear a filter to see more.</Empty>}
    </div>
  );
}

// ---------------------------------------------------------------- expiry view
function ExpiryView() {
  const { db, go } = useApp();
  const [win, setWin] = useState("60");
  const [showDone, setShowDone] = useState(false);
  const rows = db.terms.filter((t) => t.status === "confirmed" && t.values.riskEnd).map((t) => ({ t, p: db.policies.find((x) => x.id === t.policyId) }))
    .map((x) => ({ ...x, c: db.customers.find((y) => y.id === x.p.customerId), days: daysBetween(TODAY, x.t.values.riskEnd), draft: db.terms.find((y) => y.prevTermId === x.t.id && y.status === "draft") }))
    .filter(({ days, t }) => days >= -45 && days <= +win && (showDone || t.outcome === "Open"))
    .sort((a, b) => a.days - b.days);
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Renewals due</h1><p className="muted">Every policy ending in the window, including ones marked non-renewable. Renew starts a draft; confirming it completes the renewal.</p></div></header>
      <div className="filters">
        <Labeled label="Ending within" htmlFor="ex-win"><Select id="ex-win" value={win} onChange={setWin} options={[{ value: "30", label: "30 days" }, { value: "60", label: "60 days" }, { value: "90", label: "90 days" }, { value: "365", label: "12 months" }]} /></Labeled>
        <div className="fld"><label className="check"><input id="ex-done" type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Also show renewed and lost (last 45 days)</label></div>
      </div>
      {rows.length ? <Table><thead><tr><th>Ends</th><th>Insured</th><th>Policy type</th><th>Policy no.</th><th>Renewable</th><th>Outcome</th><th /></tr></thead>
        <tbody>{rows.map(({ t, p, c, days, draft }) => <tr key={t.id} className={t.values.renewable === "No" ? "row-nonrenew" : ""}><td>{fmtDate(t.values.riskEnd)}<div className="small muted">{days < 0 ? `${-days} days ago` : days === 0 ? "today" : `in ${days} days`}</div></td><td>{c.name}</td><td>{p.type}</td><td>{t.values.policyNo}</td><td>{t.values.renewable === "No" ? <Pill tone="warn">Not renewable</Pill> : t.values.renewable || "Not entered"}</td><td>{draft ? <Pill tone="info">Renewal draft in progress</Pill> : <Pill tone={t.outcome === "Renewed" ? "good" : t.outcome === "Lost" ? "bad" : "muted"}>{t.outcome}</Pill>}</td><td><Btn onClick={() => go({ view: "policy", id: p.id, termId: t.id, tab: "renewals" })}>{draft ? "Continue renewal" : t.outcome === "Open" ? "Open to renew" : "View"}</Btn></td></tr>)}</tbody></Table>
        : <Empty title="Nothing ends in this window">Try a longer window.</Empty>}
    </div>
  );
}

// ---------------------------------------------------------------- downloads
async function saveCsv(filename, csv, toast, setFallback) {
  try {
    // BOM so Excel opens rupee signs and Hindi text correctly.
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Downloaded ${filename}`);
  } catch (e) {
    setFallback({ filename, csv });
  }
}
function CsvFallback({ data, onClose }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState("");
  return (
    <Modal title={`${data.filename}: download not available here`} onClose={onClose} wide>
      <p>This view cannot save files. Copy the CSV text below and paste it into a spreadsheet or a .csv file.</p>
      <textarea ref={ref} className="csvbox" readOnly value={data.csv} aria-label="CSV text" />
      <div className="row gap-s"><Btn kind="primary" onClick={async () => { try { await navigator.clipboard.writeText(data.csv); setCopied("Copied to clipboard"); } catch (e) { ref.current.select(); setCopied("Text selected. Press Ctrl+C to copy."); } }}>Copy CSV</Btn><span className="small">{copied}</span></div>
    </Modal>
  );
}

// ---------------------------------------------------------------- business report
const FILTER0 = { basis: "bookDate", vertical: "ALL", insurer: "", dept: "", cse: "", rm: "", nr: "", currency: "", useRange: false, from: "", to: "" };
function ReportFilters({ f, setF, withBasis = true, extra }) {
  const { db, fy } = useApp();
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Card title="1. Filters: which records">
      <div className="filters">
        {withBasis && <Labeled label="Date basis" htmlFor="bf-basis" req hint="Every total follows this date"><Select id="bf-basis" value={f.basis} onChange={set("basis")} options={DATE_BASES.map((b) => ({ value: b.key, label: b.label }))} /></Labeled>}
        <Labeled label="Period" htmlFor="bf-range"><Select id="bf-range" value={f.useRange ? "range" : "fy"} onChange={(v) => setF((x) => ({ ...x, useRange: v === "range" }))} options={[{ value: "fy", label: `F.Y. ${fy} (from the top bar)` }, { value: "range", label: "Custom date range" }]} /></Labeled>
        {f.useRange && <><Labeled label="From" htmlFor="bf-from" error={f.from && f.to && f.to < f.from ? "End is before start" : null}><input id="bf-from" type="date" value={f.from} onChange={(e) => set("from")(e.target.value)} /></Labeled><Labeled label="To" htmlFor="bf-to"><input id="bf-to" type="date" value={f.to} onChange={(e) => set("to")(e.target.value)} /></Labeled></>}
        <fieldset className="fld radios"><legend>Vertical <Legacy /></legend>{["ALL", "Corporate", "Retail"].map((x) => <label key={x} className="check"><input type="radio" name="vertical" checked={f.vertical === x} onChange={() => set("vertical")(x)} /> {x === "ALL" ? "All" : x}</label>)}</fieldset>
        <Labeled label="Insurer" htmlFor="bf-ins"><Select id="bf-ins" value={f.insurer} onChange={set("insurer")} placeholder="All insurers" options={db.insurers.map((i) => ({ value: i.id, label: i.name }))} /></Labeled>
        {extra}
      </div>
    </Card>
  );
}

function BusinessReport() {
  const { db, fy, can, update, log, toast, who } = useApp();
  const [f, setF] = useState(FILTER0);
  const [g, setG] = useState("insurer");
  const [out, setOut] = useState("screen");
  const [fallback, setFallback] = useState(null);
  const [printedAt] = useState(nowIso());
  const fl = { ...f, fy };
  const { rows, drafts, from, to } = businessRows(db, fl);
  const groups = groupRows(rows, g);
  const T = totals(rows);
  const groupSum = r2(groups.reduce((a, x) => a + x.totals.grossInr, 0));
  const consistent = Math.abs(groupSum - T.grossInr) < 0.01 && groups.reduce((a, x) => a + x.totals.count, 0) === T.count;
  const basisLabel = DATE_BASES.find((b) => b.key === f.basis).label;
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const missingRate = [...new Set(rows.filter((r) => r.fxRate == null).map((r) => `${r.currency} ${fmtMonth(r.fxMonth)}`))];
  const filterText = [`Vertical: ${f.vertical}`, f.insurer && `Insurer: ${insurerOf(db, f.insurer).name}`, f.dept && `Department: ${f.dept}`, f.cse && `CSC: ${teamName(db, f.cse)}`, f.rm && `RM: ${teamName(db, f.rm)}`, f.nr && `N/R: ${f.nr}`, f.currency && `Currency: ${f.currency}`].filter(Boolean).join("; ");
  const header = ["Group", "Control no", "Policy no", "Cust code", "Insured (customer)", "Vertical", "Department", "Policy type", "Insurer", "Insurer branch", "CSC", "RM", "N/R", `Basis date (${basisLabel})`, "Proposal date", "Issue date", "Risk start", "Risk end", "Business booked", "Currency", "Sum insured", "Net premium", "GST", "Stamp duty", "Gross premium", "Brokerage %", "Brokerage", "Brokerage source", "FX month", "FX rate (demo)", "FX rate version", "Net premium INR", "GST INR", "Gross premium INR", "Brokerage INR"];
  const csv = () => toCsv([
    ["Report", LIVE ? "Business report, IndSure Commercial beta" : "Business report, IndSure Commercial demo prototype (fictional data)"], ["Financial year", f.useRange ? "Custom range" : `F.Y. ${fy}`], ["Period", `${from} to ${to}`], ["Date basis", basisLabel], ["Filters", filterText], ["Grouping", GROUPINGS.find((x) => x.key === g).label], ["Printed", printedAt.replace("T", " ")], ["Excluded drafts", String(drafts)], ["FX", "Demo monthly rates, not market data. Month follows the date basis (open decision)."]],
    header, groups.flatMap((gr) => gr.rows.map((r) => [gr.key, r.controlNo, r.policyNo, r.custCode, r.customer, r.vertical, r.dept, r.type, r.insurer, r.branch, r.cse, r.rm, r.nr, r.basisDate, r.proposalDate, r.issueDate, r.riskStart, r.riskEnd, r.bookDate, r.currency, r.sumInsured, r.netPremium, r.gst, r.stampDuty, r.grossPremium, r.brokeragePct, r.brokerage, r.presetNote, r.fxMonth, r.fxRate ?? "NO RATE", r.fxVersion ?? "", r.netInr ?? "", r.gstInr ?? "", r.grossInr ?? "", r.brokerageInr ?? ""])).concat([["TOTAL (INR, rows with a rate)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", T.netInr, T.gstInr, T.grossInr, T.brokerageInr]]));
  const finalize = () => {
    update((d) => { d.snapshots.push({ id: `S${++d.seq}`, at: nowIso(), by: who, title: `Business report, ${f.useRange ? `${from} to ${to}` : `F.Y. ${fy}`}, ${basisLabel}`, basisLabel, filterText, grouping: GROUPINGS.find((x) => x.key === g).label, rows, totals: T, groupKey: g }); log(d, { action: "Report finalized", detail: `Business report frozen with ${rows.length} rows and the FX rates used at the time.` }); });
    toast("Report finalized. Later FX edits will not change it");
  };
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Business report</h1><p className="muted">Pick filters, grouping and output separately. Confirmed records only.</p></div></header>
      <ReportFilters f={f} setF={setF} extra={<>
        <Labeled label="Department" htmlFor="bf-dept"><Select id="bf-dept" value={f.dept} onChange={set("dept")} placeholder="All" options={Object.keys(DEPARTMENTS)} /></Labeled>
        <Labeled label="CSC" htmlFor="bf-cse"><SearchPick id="bf-cse" value={f.cse} onChange={set("cse")} noun="CSC" emptyLabel="All CSCs" placeholder="All CSCs" options={db.team.filter((t) => t.role === "CSC").map((t) => ({ value: t.code, label: `${t.name} (${t.code})${t.active === false ? " (inactive)" : ""}` }))} /></Labeled>
        <Labeled label="RM" htmlFor="bf-rm"><SearchPick id="bf-rm" value={f.rm} onChange={set("rm")} noun="RM" emptyLabel="All RMs" placeholder="All RMs" options={db.team.filter((t) => t.role === "RM").map((t) => ({ value: t.code, label: `${t.name} (${t.code})${t.active === false ? " (inactive)" : ""}` }))} /></Labeled>
        <Labeled label="New / Renewal" htmlFor="bf-nr"><Select id="bf-nr" value={f.nr} onChange={set("nr")} placeholder="Both" options={["New", "Renewal"]} /></Labeled>
        <Labeled label="Currency" htmlFor="bf-cur"><Select id="bf-cur" value={f.currency} onChange={set("currency")} placeholder="All" options={CURRENCIES} /></Labeled>
        <div className="fld"><Btn onClick={() => setF(FILTER0)} disabled={JSON.stringify(f) === JSON.stringify(FILTER0)} why="No filters set">Clear filters</Btn></div></>} />
      <div className="grid2">
        <Card title="2. Grouping: how rows are organised"><Labeled label="Group by" htmlFor="bf-group"><Select id="bf-group" value={g} onChange={setG} options={GROUPINGS.map((x) => ({ value: x.key, label: x.label }))} /></Labeled></Card>
        <Card title="3. Output">
          <div className="seg" role="radiogroup" aria-label="Output">{[["screen", "On screen"], ["print", "Print view"], ["csv", "CSV file"]].map(([k, l]) => <button key={k} role="radio" aria-checked={out === k} className={out === k ? "on" : ""} onClick={() => setOut(k)}>{l}</button>)}</div>
          {out === "csv" && <div className="stack" style={{ marginTop: 10 }}>{can("export") ? <><p className="small">Downloads exactly the rows on screen, with the date basis, filters, FX rates and print date written at the top.</p><Btn kind="primary" disabled={!rows.length} why="No rows to export" onClick={() => saveCsv(`business-report-${f.useRange ? "range" : fy}-${f.basis}.csv`, csv(), toast, setFallback)}>Download CSV</Btn></> : <p className="small">Your role cannot export. Permissions apply to downloads as well as screens <Confirm /></p>}</div>}
          {out === "print" && <div className="row gap-s wrap" style={{ marginTop: 10 }}><Btn kind="primary" onClick={() => window.print()}><Icon name="file" size={16} /> Print or save as PDF</Btn><span className="small muted">Prints only the report, with letterhead and print date.</span></div>}
          {can("finalize") && <div style={{ marginTop: 10 }}><AskFirst label="Finalize this report" question="Freeze these rows and FX rates?" yes="Finalize" onYes={finalize} disabled={!rows.length} why="No rows" /></div>}
        </Card>
      </div>
      <div className={out === "print" ? "printsheet" : ""}>
        {out === "print" && <div className="letterhead"><div><strong>IndSure Commercial{LIVE ? "" : " (demo)"}</strong><div className="small">Broker's Business Report, grouped {GROUPINGS.find((x) => x.key === g).label}</div></div><div className="small">Printed {fmtStamp(printedAt)}<br />Page 1 of 1</div></div>}
        <div className="reportmeta"><span>Date basis: <strong>{basisLabel}</strong></span><span>Period: <strong>{fmtDate(from)} to {fmtDate(to)}</strong>{!f.useRange && ` (F.Y. ${fy})`}</span><span>{filterText}</span><span>Printed {fmtStamp(printedAt)}</span><span>Drafts excluded: {drafts}</span></div>
        {missingRate.length > 0 && <div className="note note-warn">No FX rate for {missingRate.join(", ")}. {T.noRate} record(s) are left out of INR totals and shown as "No rate". Add the rate under FX rates.</div>}
        {!rows.length ? <Empty title="No confirmed records match">Change the period, date basis or filters. Drafts are never counted.</Empty> : (
          <>
            {groups.map((gr) => (
              <div key={gr.key} className="rgroup">
                {g !== "none" && <h4>{gr.key} <span className="muted small">({gr.rows.length})</span></h4>}
                <Table className="rtable"><thead><tr><th>Policy</th><th>Insured</th>{g !== "insurer" && <th>Insurer</th>}<th>N/R</th><th>Basis date</th><th className="num">Gross (native)</th><th className="num">Brokerage (native)</th><th className="num">Gross INR</th><th className="num">Brokerage INR</th></tr></thead>
                  <tbody>{gr.rows.map((r) => <tr key={r.termId}><td>{r.policyNo}<div className="small muted">{r.controlNo}</div></td><td>{r.customer}<div className="small muted">{r.type}</div></td>{g !== "insurer" && <td>{r.insurer}</td>}<td>{r.nr}</td><td>{fmtDate(r.basisDate)}</td><td className="num">{fmtMoney(r.grossPremium, r.currency)}</td><td className="num">{fmtMoney(r.brokerage, r.currency)}<div className="small muted">{r.brokeragePct}% · {r.presetNote}</div></td><td className="num">{r.grossInr == null ? "No rate" : fmtNum(r.grossInr)}{r.currency !== "INR" && <div className="small">{r.fxRate == null ? <span className="bad-text">No rate for {fmtMonth(r.fxMonth)}</span> : <span className="muted">{fmtMonth(r.fxMonth)} @ {r.fxRate} (v{r.fxVersion})</span>}</div>}</td><td className="num">{r.brokerageInr == null ? "No rate" : fmtNum(r.brokerageInr)}</td></tr>)}</tbody>
                  {g !== "none" && <tfoot><tr><td colSpan={g !== "insurer" ? 7 : 6}>Subtotal {gr.key}</td><td className="num">{fmtNum(gr.totals.grossInr)}</td><td className="num">{fmtNum(gr.totals.brokerageInr)}</td></tr></tfoot>}
                </Table>
              </div>
            ))}
            <TotalsBlock T={T} consistent={consistent} />
          </>
        )}
      </div>
      {fallback && <CsvFallback data={fallback} onClose={() => setFallback(null)} />}
    </div>
  );
}

function TotalsBlock({ T, consistent }) {
  return (
    <Card title="Totals" sub="Native currency totals are kept as they are. INR uses the monthly rate shown on each row.">
      <Table><thead><tr><th>Currency</th><th className="num">Records</th><th className="num">Sum insured</th><th className="num">Net premium</th><th className="num">GST</th><th className="num">Gross premium</th><th className="num">Brokerage</th></tr></thead>
        <tbody>{Object.entries(T.native).map(([cur, n]) => <tr key={cur}><td>{cur}</td><td className="num">{n.count}</td><td className="num">{fmtNum(n.si, cur)}</td><td className="num">{fmtNum(n.net, cur)}</td><td className="num">{fmtNum(n.gst, cur)}</td><td className="num">{fmtNum(n.gross, cur)}</td><td className="num">{fmtNum(n.brokerage, cur)}</td></tr>)}</tbody>
        <tfoot><tr><td>All in INR</td><td className="num">{T.count - T.noRate}{T.noRate ? ` (+${T.noRate} no rate)` : ""}</td><td className="num">{fmtNum(T.siInr)}</td><td className="num">{fmtNum(T.netInr)}</td><td className="num">{fmtNum(T.gstInr)}</td><td className="num">{fmtNum(T.grossInr)}</td><td className="num">{fmtNum(T.brokerageInr)}</td></tr></tfoot></Table>
      {consistent != null && <p className={`small ${consistent ? "good-text" : "bad-text"}`}>{consistent ? "Check passed: group subtotals add up to the grand total." : "Check failed: group subtotals do not match the grand total."}</p>}
      <p className="small muted">Net premium definitions on the current reports disagree; these totals are not yet reconciled with accounts <Confirm /></p>
    </Card>
  );
}

// ---------------------------------------------------------------- renewals report
function RenewalsReport() {
  const { db, fy, can, toast } = useApp();
  const [f, setF] = useState({ ...FILTER0, outcome: "" });
  const [fallback, setFallback] = useState(null);
  const [printedAt] = useState(nowIso());
  const rows = renewalRows(db, { ...f, fy });
  const [from, to] = f.useRange && f.from && f.to ? [f.from, f.to] : fyRange(fy);
  const byIns = groupRows(rows.map((r) => ({ ...r, basisDate: r.riskEnd, month: r.riskEnd.slice(0, 7), fxRate: 1, netInr: 0, gstInr: 0, grossInr: 0, brokerageInr: 0, siInr: 0, netPremium: 0, gst: 0, brokerage: 0 })), "insurer");
  const count = (o) => rows.filter((r) => r.outcome === o).length;
  const header = ["Insurer", "S.No", "Control no", "Policy no", "Start date", "Expiry date", "Policy type", "Customer group", "Insured (customer)", "Cust code", "Location", "Currency", "Sum insured", "Gross premium", "Brokerage", "RM", "CSC", "Renewable", "Outcome", "Renewed as", "Loss detail (LossBy meaning open)"];
  const csv = () => toCsv([["Report", LIVE ? "Renewals report, IndSure Commercial beta" : "Renewals report, IndSure Commercial demo prototype (fictional data)"], ["Date basis", "Risk end (expiry) date"], ["Period", `${from} to ${to}`], ["Printed", printedAt.replace("T", " ")], ["Counts", `Renewed ${count("Renewed")}, Lost ${count("Lost")}, Open ${count("Open")}`]], header,
    byIns.flatMap((g) => g.rows.map((r, i) => [g.key, i + 1, r.controlNo, r.policyNo, r.riskStart, r.riskEnd, r.type, r.group, r.customer, r.custCode, r.location, r.currency, r.sumInsured, r.grossPremium, r.brokerage, r.rm, r.cse, r.renewable, r.outcome, r.nextPolicyNo, r.lossDetail])));
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Renewals report</h1><p className="muted">Policies by expiry date, grouped Insurer Wise, with achieved and lost renewals. Includes non-renewable policies.</p></div></header>
      <ReportFilters f={f} setF={setF} withBasis={false} extra={<Labeled label="Outcome" htmlFor="rr-out"><Select id="rr-out" value={f.outcome} onChange={(v) => setF((x) => ({ ...x, outcome: v }))} placeholder="All" options={["Open", "Renewed", "Lost"]} /></Labeled>} />
      <div className="stats"><div className="stat"><span>Ending in period</span><strong>{rows.length}</strong></div><div className="stat"><span>Renewed (achieved)</span><strong className="good-text">{count("Renewed")}</strong></div><div className="stat"><span>Lost</span><strong className="bad-text">{count("Lost")}</strong></div><div className="stat"><span>Still open</span><strong>{count("Open")}</strong></div></div>
      <div className="reportmeta"><span>Date basis: <strong>Risk end (expiry) date</strong></span><span>Period: <strong>{fmtDate(from)} to {fmtDate(to)}</strong></span><span>Printed {fmtStamp(printedAt)}</span>{can("export") ? <Btn kind="primary" disabled={!rows.length} why="No rows" onClick={() => saveCsv(`renewals-report-${f.useRange ? "range" : fy}.csv`, csv(), toast, setFallback)}>Download CSV</Btn> : <span className="small">Export not allowed for this role</span>}</div>
      {!rows.length ? <Empty title="No policies end in this period" /> : byIns.map((g) => (
        <div key={g.key} className="rgroup"><h4>{g.key} <span className="muted small">({g.rows.length})</span></h4>
          <Table><thead><tr><th>S.No</th><th>Policy</th><th>Expiry</th><th>Insured</th><th className="num">Sum insured</th><th className="num">Gross premium</th><th>RM</th><th>Renewal</th></tr></thead>
            <tbody>{g.rows.map((r, i) => <tr key={r.termId} className={r.renewable === "No" ? "row-nonrenew" : ""}><td>{i + 1}</td><td>{r.policyNo}<div className="small muted">{r.controlNo}</div></td><td className="nowrap">{fmtDate(r.riskEnd)}</td><td>{r.customer}<div className="small muted">{r.type}{r.group ? ` · ${r.group}` : ""}</div></td><td className="num">{fmtMoney(r.sumInsured, r.currency)}</td><td className="num">{fmtMoney(r.grossPremium, r.currency)}</td><td>{r.rm}</td><td><div className="pills"><Pill tone={r.outcome === "Renewed" ? "good" : r.outcome === "Lost" ? "bad" : "muted"}>{r.outcome}</Pill>{r.draftInProgress && <Pill tone="info">Draft in progress</Pill>}</div><div className="small muted">Renewable: {r.renewable}{r.outcome === "Renewed" ? `. Renewed as ${r.nextPolicyNo}` : r.lossDetail ? `. ${r.lossDetail}` : ""}</div></td></tr>)}</tbody></Table></div>))}
      <p className="small muted">The legacy renewal report action reads "...el/Achieved/Lost"; its full label and the meaning of LossBy are open <Confirm /></p>
      {fallback && <CsvFallback data={fallback} onClose={() => setFallback(null)} />}
    </div>
  );
}

function Snapshots({ openId }) {
  const { db, go } = useApp();
  const [open, setOpen] = useState(openId || null);
  const s = db.snapshots.find((x) => x.id === open);
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Finalized reports</h1><p className="muted">Frozen copies. Later changes to FX rates, presets or records do not rewrite them.</p></div></header>
      {!db.snapshots.length ? <Empty title="No finalized reports yet">Finalize one from the Business report (Accounts or Admin role).</Empty> : (
        <Table><thead><tr><th>Report</th><th>Finalized</th><th className="num">Rows</th><th className="num">Gross INR at the time</th><th /></tr></thead>
          <tbody>{db.snapshots.map((x) => <tr key={x.id}><td>{x.title}<div className="small muted">{x.filterText} · {x.grouping}</div></td><td>{fmtStamp(x.at)} by {x.by}</td><td className="num">{x.rows.length}</td><td className="num">{fmtNum(x.totals.grossInr)}</td><td><Btn onClick={() => setOpen(x.id)}>Open</Btn></td></tr>)}</tbody></Table>)}
      {s && (() => {
        const live = totals(businessRows(db, { ...FILTER0, fy: "2026-27", basis: DATE_BASES.find((b) => b.label === s.basisLabel)?.key || "bookDate" }).rows.filter((r) => s.rows.some((y) => y.termId === r.termId)));
        return (
          <Card title={s.title} sub={`Frozen ${fmtStamp(s.at)} by ${s.by}`}>
            <Table><thead><tr><th>Control no.</th><th>Insured</th><th>Policy type</th><th className="num">Gross (native)</th><th>FX used then</th><th className="num">Gross INR then</th></tr></thead>
              <tbody>{s.rows.map((r) => <tr key={r.termId}><td>{r.controlNo}</td><td>{r.customer}</td><td>{r.type}</td><td className="num">{fmtMoney(r.grossPremium, r.currency)}</td><td className="small">{r.currency === "INR" ? "INR" : r.fxRate == null ? "No rate" : `${fmtMonth(r.fxMonth)} @ ${r.fxRate} (v${r.fxVersion})`}</td><td className="num">{r.grossInr == null ? "No rate" : fmtNum(r.grossInr)}</td></tr>)}</tbody></Table>
            <TotalsBlock T={s.totals} consistent={null} />
            <div className={`note ${Math.abs(live.grossInr - s.totals.grossInr) > 0.01 ? "note-warn" : ""}`}>Same records valued with today's rates and values: gross INR {fmtNum(live.grossInr)}. {Math.abs(live.grossInr - s.totals.grossInr) > 0.01 ? "This differs from the frozen figure, which is kept as finalized." : "No difference so far."}</div>
          </Card>);
      })()}
    </div>
  );
}

// ---------------------------------------------------------------- admin
// Renames an insurer or one of its branches. Policies point to them by id, so every record shows the new name.
function RenameMaster({ edit, onClose }) {
  const { db, update, log, toast } = useApp();
  const [f, setF] = useState({ name: edit.name, city: edit.city || "", state: edit.state || "", country: edit.country || "India" });
  const [err, setErr] = useState("");
  const ins = insurerOf(db, edit.insId);
  const isBranch = edit.kind === "branch";
  const used = db.policies.filter((p) => (isBranch ? p.branchId === edit.brId : p.insurerId === edit.insId)).length;
  const save = () => {
    const name = f.name.trim().replace(/\s+/g, " ");
    if (!name || (isBranch && (!f.city.trim() || !f.country.trim()))) return setErr(isBranch ? "Fill branch, city and country" : "Enter the insurer name");
    const clash = isBranch ? ins.branches.some((b) => b.id !== edit.brId && b.name.toLowerCase() === name.toLowerCase()) : db.insurers.some((i) => i.id !== edit.insId && i.name.toLowerCase() === name.toLowerCase());
    if (clash) return setErr(isBranch ? "That branch already exists for this insurer" : "That insurer already exists");
    update((d) => {
      const i = d.insurers.find((x) => x.id === edit.insId);
      if (isBranch) {
        const b = i.branches.find((x) => x.id === edit.brId);
        log(d, { action: "Branch renamed", detail: `${i.name}: ${b.name} (${b.city}) to ${name} (${f.city.trim()}).` });
        Object.assign(b, { name, city: f.city.trim(), state: (f.state || "").trim(), country: f.country.trim() });
      } else {
        log(d, { action: "Insurer renamed", detail: `${i.name} to ${name}.` });
        i.name = name;
      }
    });
    toast(isBranch ? "Branch renamed" : "Insurer renamed");
    onClose();
  };
  return (
    <Card title={isBranch ? `Rename branch of ${ins.name}` : `Rename ${edit.name}`} sub={used ? `Used on ${used} polic${used === 1 ? "y" : "ies"}; they will all show the new name.` : "Not used on any policy yet."}>
      <div className="formgrid">
        <Labeled label={isBranch ? "Branch" : "Insurer name"} htmlFor="rn-name"><input id="rn-name" value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setErr(""); }} /></Labeled>
        {isBranch && <PlaceFields id="rn" value={f} req countryReq onChange={(p) => { setF({ ...f, ...p }); setErr(""); }} />}
      </div>
      {err && <div className="err-text small" role="alert">{err}</div>}
      <div className="row gap-s"><Btn kind="primary" onClick={save}>Save name</Btn><Btn onClick={onClose}>Cancel</Btn></div>
    </Card>
  );
}

function Masters() {
  const { db, update, log, toast } = useApp();
  const [tab, setTab] = useState("insurers");
  const [ni, setNi] = useState("");
  const [nb, setNb] = useState({ ins: "", name: "", city: "", state: "", country: "India" });
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);
  const typeCount = {};
  Object.values(DEPARTMENTS).flat().forEach((t) => (typeCount[t] = (typeCount[t] || 0) + 1));
  const addIns = () => { if (!ni.trim()) return setErr("Enter the insurer name"); if (db.insurers.some((i) => i.name.toLowerCase() === ni.trim().toLowerCase())) return setErr("That insurer already exists"); update((d) => { d.insurers.push({ id: `INS${++d.seq}`, name: ni.trim(), branches: [] }); log(d, { action: "Insurer added", detail: ni.trim() }); }); setNi(""); setErr(""); toast("Insurer added"); };
  const addBr = () => { if (!nb.ins || !nb.name.trim() || !nb.city.trim() || !nb.country.trim()) return setErr("Choose an insurer and fill branch, city and country"); const ins = insurerOf(db, nb.ins); if (ins.branches.some((b) => b.name.toLowerCase() === nb.name.trim().toLowerCase())) return setErr("That branch already exists"); update((d) => { d.insurers.find((i) => i.id === nb.ins).branches.push({ id: `BR${++d.seq}`, name: nb.name.trim(), city: nb.city.trim(), state: (nb.state || "").trim(), country: nb.country.trim() }); log(d, { action: "Branch added", detail: `${nb.name} (${nb.city}) for ${ins.name}` }); }); setNb({ ...nb, name: "", city: "", state: "" }); setErr(""); toast("Branch added"); };
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Masters</h1><p className="muted">Lists that feed every entry screen.</p></div></header>
      <Tabs tabs={[{ key: "insurers", label: "Insurers and branches" }, { key: "types", label: "Departments and policy types" }, { key: "team", label: "Team" }]} value={tab} onChange={(t) => { setTab(t); setErr(""); }} />
      {err && <div className="note note-bad" role="alert">{err}</div>}
      {tab === "insurers" && <>
        <Card title="Add insurer"><div className="row gap-s wrap"><Labeled label="Insurer name" htmlFor="ms-ins"><input id="ms-ins" value={ni} onChange={(e) => setNi(e.target.value)} /></Labeled><Btn kind="primary" onClick={addIns}>Add insurer</Btn></div></Card>
        <Card title="Add branch"><div className="filters"><Labeled label="Insurer" htmlFor="ms-bi"><Select id="ms-bi" value={nb.ins} onChange={(v) => setNb({ ...nb, ins: v })} placeholder="Choose" options={db.insurers.map((i) => ({ value: i.id, label: i.name }))} /></Labeled><Labeled label="Branch" htmlFor="ms-bn"><input id="ms-bn" value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} /></Labeled><PlaceFields id="ms-b" value={nb} req countryReq onChange={(x) => setNb({ ...nb, ...x })} /><div className="fld"><Btn kind="primary" onClick={addBr}>Add branch</Btn></div></div></Card>
        <Table><thead><tr><th>Insurer</th><th>Branch</th><th>City</th><th>State</th><th>Country</th></tr></thead><tbody>{db.insurers.flatMap((i) => (i.branches.length ? i.branches : [null]).map((b, j) => <tr key={i.id + (b?.id || "none")}>
          <td>{j === 0 && <div className="row gap-s wrap"><span>{i.name}</span><Btn onClick={() => setEdit({ kind: "insurer", insId: i.id, name: i.name })}>Rename</Btn></div>}</td>
          <td>{b ? <div className="row gap-s wrap"><span>{b.name}</span><Btn onClick={() => setEdit({ kind: "branch", insId: i.id, brId: b.id, name: b.name, city: b.city, state: b.state, country: b.country })}>Rename</Btn></div> : <span className="muted">No branches yet</span>}</td>
          <td>{b?.city || ""}</td><td>{b?.state || ""}</td><td>{b?.country || ""}</td></tr>))}</tbody></Table>
        {edit && <RenameMaster edit={edit} onClose={() => setEdit(null)} />}
      </>}
      {tab === "types" && <Card title="Departments and policy types" sub={<>As captured from the current platform: unvalidated and possibly incomplete. Final lists are open <Confirm /></>}>
        <div className="note small">The notes list lines of business as {NOTES_LOB.join(", ")}. These departments differ: there is no Aviation or PA department, and Agriculture and Motor are extra. The notes win conflicts.</div>
        <div className="typegrid">{Object.entries(DEPARTMENTS).map(([dpt, types]) => <div key={dpt}><h4>{dpt} <span className="muted small">({types.length})</span></h4><ul>{types.map((t) => <li key={t}>{t}{typeCount[t] > 1 && <Pill tone="warn" title="Listed under more than one department">Also elsewhere</Pill>}</li>)}</ul>{dpt === "Miscellaneous" && <p className="small muted">Visible portion only; the source list scrolls further.</p>}</div>)}</div>
      </Card>}
      {tab === "team" && <TeamMaster />}
    </div>
  );
}

// Team master: add, edit, move customers, deactivate or remove. A code is referenced by customers, so
// changing it renames every reference, and nobody who still looks after a customer can be removed.
const TEAM_ROLES = ["CSC", "RM", "Accounts"];
function TeamMaster() {
  const { db, update, log, toast } = useApp();
  const [nt, setNt] = useState({ code: "", name: "", role: "CSC" });
  const [addErr, setAddErr] = useState("");
  const [edit, setEdit] = useState(null); // { code, f: { code, name, role }, moveTo, err }
  const [showInactive, setShowInactive] = useState(true);
  const uses = (code) => ({ cse: db.customers.filter((c) => c.cse === code), rm: db.customers.filter((c) => c.rm === code) });
  const codeTaken = (code, except) => db.team.some((t) => t.code.toLowerCase() === code.trim().toLowerCase() && t.code !== except);
  const add = () => {
    if (!nt.code.trim() || !nt.name.trim()) return setAddErr("Enter code and name");
    if (/\s/.test(nt.code.trim())) return setAddErr("Codes cannot contain spaces");
    if (codeTaken(nt.code)) return setAddErr("That code is already used");
    update((d) => { d.team.push({ code: nt.code.trim().toUpperCase(), name: nt.name.trim(), role: nt.role, active: true }); log(d, { action: "Team member added", detail: `${nt.name.trim()} (${nt.code.trim().toUpperCase()}) as ${nt.role}` }); });
    setNt({ code: "", name: "", role: "CSC" }); setAddErr(""); toast("Team member added");
  };
  const open = (t) => setEdit({ code: t.code, f: { code: t.code, name: t.name, role: t.role }, moveTo: "", err: "" });
  const t0 = edit && db.team.find((t) => t.code === edit.code);
  const u0 = t0 && uses(t0.code);
  const assigned = u0 ? u0.cse.length + u0.rm.length : 0;
  const save = () => {
    const f = edit.f; const code = f.code.trim().toUpperCase();
    const err = !code || !f.name.trim() ? "Enter code and name" : /\s/.test(code) ? "Codes cannot contain spaces" : codeTaken(code, t0.code) ? "That code is already used"
      : f.role !== t0.role && assigned ? `${t0.name} looks after ${assigned} customer${assigned === 1 ? "" : "s"} as ${t0.role}. Move them to someone else before changing the role.` : "";
    if (err) return setEdit({ ...edit, err });
    update((d) => {
      const t = d.team.find((x) => x.code === t0.code);
      const changes = [t.name !== f.name.trim() && `name ${t.name} to ${f.name.trim()}`, t.code !== code && `code ${t.code} to ${code}`, t.role !== f.role && `role ${t.role} to ${f.role}`].filter(Boolean);
      if (t.code !== code) d.customers.forEach((c) => { if (c.cse === t.code) c.cse = code; if (c.rm === t.code) c.rm = code; });
      Object.assign(t, { code, name: f.name.trim(), role: f.role });
      log(d, { action: "Team member updated", detail: changes.length ? `${changes.join(", ")}.${assigned && t0.code !== code ? ` ${assigned} customer record${assigned === 1 ? "" : "s"} updated to the new code.` : ""}` : "No change." });
    });
    setEdit(null); toast("Team member saved");
  };
  const move = () => {
    if (!edit.moveTo) return setEdit({ ...edit, err: "Choose who takes over" });
    const to = db.team.find((t) => t.code === edit.moveTo);
    update((d) => {
      let n = 0;
      d.customers.forEach((c) => { if (c.cse === t0.code) { c.cse = to.code; n++; } if (c.rm === t0.code) { c.rm = to.code; n++; } });
      log(d, { action: "Customers moved", detail: `${n} customer assignment${n === 1 ? "" : "s"} moved from ${t0.name} (${t0.code}) to ${to.name} (${to.code}).` });
    });
    setEdit({ ...edit, moveTo: "", err: "" }); toast(`Customers moved to ${to.name}`);
  };
  const setActive = (t, active) => { update((d) => { d.team.find((x) => x.code === t.code).active = active; log(d, { action: active ? "Team member reactivated" : "Team member deactivated", detail: `${t.name} (${t.code}). ${active ? "Back in the pickers." : "Kept on existing records and reports; no longer offered for new assignments."}` }); }); toast(active ? "Reactivated" : "Deactivated"); };
  const remove = (t) => { update((d) => { d.team = d.team.filter((x) => x.code !== t.code); log(d, { action: "Team member removed", detail: `${t.name} (${t.code}), ${t.role}. Was not assigned to any customer.` }); }); setEdit(null); toast("Team member removed"); };
  const rows = db.team.filter((t) => showInactive || t.active !== false);
  return (<>
    <Card title="Add team member" sub="CSC: the customer service coordinator who looks after the customer.">
      <div className="filters">
        <Labeled label="Code" htmlFor="ms-tc"><input id="ms-tc" value={nt.code} onChange={(e) => setNt({ ...nt, code: e.target.value })} /></Labeled>
        <Labeled label="Name" htmlFor="ms-tn"><input id="ms-tn" value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} /></Labeled>
        <Labeled label="Role" htmlFor="ms-tr"><Select id="ms-tr" value={nt.role} onChange={(v) => setNt({ ...nt, role: v })} options={TEAM_ROLES} /></Labeled>
        <div className="fld"><Btn kind="primary" onClick={add}>Add</Btn></div>
      </div>
      {addErr && <div className="err-text small" role="alert">{addErr}</div>}
    </Card>
    <label className="check small"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive people</label>
    <Table><thead><tr><th>Code</th><th>Name</th><th>Role</th><th className="num">Customers as CSC</th><th className="num">as RM</th><th>Status</th><th /></tr></thead>
      <tbody>{rows.map((t) => { const u = uses(t.code); return (
        <tr key={t.code} className={t.active === false ? "row-held" : ""}>
          <td>{t.code}</td><td>{t.name}</td><td>{t.role}</td><td className="num">{u.cse.length}</td><td className="num">{u.rm.length}</td>
          <td>{t.active === false ? <Pill tone="muted">Inactive</Pill> : <Pill tone="good">Active</Pill>}</td>
          <td><Btn onClick={() => (edit?.code === t.code ? setEdit(null) : open(t))}>{edit?.code === t.code ? "Close" : "Edit"}</Btn></td>
        </tr>); })}</tbody></Table>
    {edit && t0 && (
      <Card title={`Edit ${t0.name} (${t0.code})`} sub={assigned ? `Looks after ${u0.cse.length} customer${u0.cse.length === 1 ? "" : "s"} as CSC and ${u0.rm.length} as RM.` : "Not assigned to any customer."}>
        <div className="formgrid">
          <Labeled label="Code" htmlFor="tm-code" hint={assigned ? "Changing it updates every customer that uses it" : ""}><input id="tm-code" value={edit.f.code} onChange={(e) => setEdit({ ...edit, err: "", f: { ...edit.f, code: e.target.value } })} /></Labeled>
          <Labeled label="Name" htmlFor="tm-name"><input id="tm-name" value={edit.f.name} onChange={(e) => setEdit({ ...edit, err: "", f: { ...edit.f, name: e.target.value } })} /></Labeled>
          <Labeled label="Role" htmlFor="tm-role"><Select id="tm-role" value={edit.f.role} onChange={(v) => setEdit({ ...edit, err: "", f: { ...edit.f, role: v } })} options={TEAM_ROLES} /></Labeled>
        </div>
        {edit.err && <div className="note note-bad small" role="alert">{edit.err}</div>}
        <div className="row gap-s wrap"><Btn kind="primary" onClick={save}>Save changes</Btn><Btn onClick={() => setEdit(null)}>Cancel</Btn></div>
        {assigned > 0 && (
          <div className="boxed stack">
            <h4>Move their customers to someone else</h4>
            <div className="row gap-s wrap" style={{ alignItems: "flex-end" }}>
              <Labeled label={`New ${t0.role}`} htmlFor="tm-move"><Select id="tm-move" value={edit.moveTo} onChange={(v) => setEdit({ ...edit, err: "", moveTo: v })} placeholder="Choose" options={db.team.filter((x) => x.role === t0.role && x.code !== t0.code && x.active !== false).map((x) => ({ value: x.code, label: `${x.name} (${x.code})` }))} /></Labeled>
              <AskFirst label={`Move ${assigned} customer${assigned === 1 ? "" : "s"}`} question={`Move every customer from ${t0.name}?`} yes="Move" onYes={move} disabled={!edit.moveTo} why="Choose who takes over" />
            </div>
            <p className="small muted">The history on each customer keeps the earlier assignment.</p>
          </div>
        )}
        <div className="row gap-s wrap">
          {t0.active === false ? <Btn onClick={() => setActive(t0, true)}>Reactivate</Btn>
            : <AskFirst label="Deactivate" question={`Stop offering ${t0.name} for new work?`} yes="Deactivate" onYes={() => setActive(t0, false)} />}
          <AskFirst label="Remove" question={`Remove ${t0.name} for good?`} yes="Remove" onYes={() => remove(t0)} disabled={assigned > 0} why="Move their customers first, or deactivate instead" />
          <span className="small muted">{assigned > 0 ? "Remove is available once nobody is assigned to them. Deactivate keeps them on past records and reports." : "Deactivate keeps them on past records; Remove deletes them from the list."}</span>
        </div>
      </Card>
    )}
    <p className="small muted">Open: RM inward/outward, more than one RM per record, accounts owner level <Confirm /></p>
  </>);
}

function FxView() {
  const { db, update, can, log, toast, role, who } = useApp();
  const edit = role === "admin";
  const months = [...new Set(db.fx.map((x) => x.month))].sort();
  const [ed, setEd] = useState(null);
  const [val, setVal] = useState("");
  const [note, setNote] = useState("");
  const [newMonth, setNewMonth] = useState("2026-11");
  const [err, setErr] = useState("");
  const save = () => {
    if (!isNum(val) || +val <= 0) return setErr("Enter a rate above 0");
    update((d) => { let row = d.fx.find((x) => x.month === ed.month && x.cur === ed.cur); if (!row) { row = { month: ed.month, cur: ed.cur, versions: [] }; d.fx.push(row); } row.versions.push({ rate: +val, at: nowIso(), by: who, note: note || "Demo rate" }); log(d, { action: "FX rate saved", detail: `${ed.cur} ${fmtMonth(ed.month)} = ${val} (version ${row.versions.length}). Finalized reports keep the rate they used.` }); });
    toast(`${ed.cur} rate for ${fmtMonth(ed.month)} saved`); setEd(null); setErr("");
  };
  const allMonths = [...new Set([...months, ...(edit ? [newMonth] : [])])].sort();
  return (
    <div className="stack">
      <header className="page-head"><div><h1>FX rates</h1><p className="muted">Monthly rates used to show INR to accounts. {LIVE ? "Enter the rates your accounts team uses." : "Demo values only, not market data."}</p></div></header>
      <div className="note small">Which month a policy uses (booking, risk start or receipt) and who approves rates are open decisions <Confirm />. This demo uses the month of the report's date basis.</div>
      {edit && <div className="row gap-s wrap"><Labeled label="Show an extra month" htmlFor="fx-new"><input id="fx-new" type="month" value={newMonth} onChange={(e) => setNewMonth(e.target.value)} /></Labeled></div>}
      <Table><thead><tr><th>Month</th>{["USD", "AED", "EUR"].map((c) => <th key={c} className="num">INR per {c}</th>)}</tr></thead>
        <tbody>{allMonths.slice().reverse().map((m) => <tr key={m}><td>{fmtMonth(m)}</td>{["USD", "AED", "EUR"].map((c) => { const r = fxRate(db, m, c); const row = db.fx.find((x) => x.month === m && x.cur === c); return <td key={c} className="num">{r ? <>{r.rate}<span className="muted small"> v{r.version}</span></> : <span className="bad-text">No rate</span>}{row?.versions.length > 1 && <div className="small muted">was {row.versions[row.versions.length - 2].rate}</div>}{edit && <div><button className="linkbtn small" onClick={() => { setEd({ month: m, cur: c }); setVal(r ? String(r.rate) : ""); setNote(""); setErr(""); }}>{r ? "Change" : "Add"}</button></div>}</td>; })}</tr>)}</tbody></Table>
      {!edit && <p className="small muted">Only Admin can change rates in this demo <Confirm /></p>}
      {ed && <Modal title={`${ed.cur} rate for ${fmtMonth(ed.month)}`} onClose={() => setEd(null)}>
        <div className="formgrid"><Labeled label="INR per 1 unit" htmlFor="fx-val" req error={err}><input id="fx-val" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} /></Labeled><Labeled label="Source or note" htmlFor="fx-note"><input id="fx-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Demo rate" /></Labeled></div>
        <p className="small">Saving adds version {(db.fx.find((x) => x.month === ed.month && x.cur === ed.cur)?.versions.length || 0) + 1}. Earlier versions and finalized reports are kept.</p>
        <div className="row gap-s"><Btn onClick={() => setEd(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save rate</Btn></div>
      </Modal>}
    </div>
  );
}

function PresetsView() {
  const { db, update, log, toast, role, who } = useApp();
  const edit = role === "admin";
  const [nv, setNv] = useState({});
  const [np, setNp] = useState({ ins: "", type: "", pct: "" });
  const [err, setErr] = useState("");
  const use = (id, v) => db.terms.filter((t) => t.brokerageSnap?.presetId === id && t.brokerageSnap.version === v).length;
  const addVersion = (p) => { const x = nv[p.id]; if (!isNum(x) || +x < 0 || +x > 100) return setErr("Enter a percentage between 0 and 100"); update((d) => { const q = d.presets.find((y) => y.id === p.id); q.versions.push({ v: q.versions.length + 1, pct: +x, status: "draft", at: nowIso(), by: who }); log(d, { action: "Preset draft saved", detail: `${insurerOf(d, p.insurerId).name} + ${p.policyType}: ${x}% as version ${q.versions.length} (draft).` }); }); setNv({ ...nv, [p.id]: "" }); setErr(""); toast("Draft version saved. Confirm it to use it"); };
  const confirmV = (p, v) => { update((d) => { const q = d.presets.find((y) => y.id === p.id); q.versions.find((y) => y.v === v).status = "confirmed"; log(d, { action: "Preset confirmed", detail: `${insurerOf(d, p.insurerId).name} + ${p.policyType}: version ${v} now loads on new entries. Existing policies keep their own %.` }); }); toast(`Version ${v} confirmed`); };
  const addPreset = () => { if (!np.ins || !np.type || !isNum(np.pct)) return setErr("Choose insurer, policy type and %"); if (db.presets.some((p) => p.insurerId === np.ins && p.policyType === np.type)) return setErr("A preset already exists for that pair; add a version instead"); update((d) => { d.presets.push({ id: `PR${++d.seq}`, insurerId: np.ins, policyType: np.type, versions: [{ v: 1, pct: +np.pct, status: "draft", at: nowIso(), by: who }] }); log(d, { action: "Preset draft saved", detail: `New preset ${np.type}, ${np.pct}% (draft).` }); }); setNp({ ins: "", type: "", pct: "" }); setErr(""); toast("Preset saved as draft"); };
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Brokerage presets</h1><p className="muted">Load by insurer + policy type, stay editable on each policy, and need a reviewer to confirm. A policy keeps the % it was confirmed with.</p></div></header>
      <div className="note small">Open: whether "company" in the notes means insurer, customer or both; who may edit; how versions are approved <Confirm /></div>
      {err && <div className="note note-bad" role="alert">{err}</div>}
      {edit && <Card title="New preset"><div className="filters"><Labeled label="Insurer" htmlFor="pr-ins"><Select id="pr-ins" value={np.ins} onChange={(v) => setNp({ ...np, ins: v })} placeholder="Choose" options={db.insurers.map((i) => ({ value: i.id, label: i.name }))} /></Labeled><Labeled label="Policy type" htmlFor="pr-type"><Select id="pr-type" value={np.type} onChange={(v) => setNp({ ...np, type: v })} placeholder="Choose" options={[...new Set(Object.values(DEPARTMENTS).flat())].sort()} /></Labeled><Labeled label="Brokerage %" htmlFor="pr-pct"><input id="pr-pct" inputMode="decimal" value={np.pct} onChange={(e) => setNp({ ...np, pct: e.target.value })} /></Labeled><div className="fld"><Btn kind="primary" onClick={addPreset}>Save as draft</Btn></div></div></Card>}
      {db.presets.map((p) => { const act = activePreset(db, p.insurerId, p.policyType); return (
        <Card key={p.id} title={`${insurerOf(db, p.insurerId)?.name} + ${p.policyType}`} sub={act ? `Loads ${act.pct}% (version ${act.version}) on new entries` : "No confirmed version yet; nothing loads"}>
          <Table><thead><tr><th>Version</th><th className="num">Brokerage %</th><th>Status</th><th>Saved</th><th className="num">Policies using it</th><th /></tr></thead>
            <tbody>{p.versions.map((v) => <tr key={v.v}><td>v{v.v}</td><td className="num">{v.pct}%</td><td><Pill tone={v.status === "confirmed" ? (act?.version === v.v ? "good" : "muted") : "warn"}>{v.status === "confirmed" ? (act?.version === v.v ? "Confirmed, in use" : "Confirmed, superseded") : "Draft"}</Pill></td><td className="small">{fmtStamp(v.at)} by {v.by}</td><td className="num">{use(p.id, v.v)}</td><td>{edit && v.status === "draft" && <AskFirst label="Confirm" question={`Use ${v.pct}% for new entries?`} yes="Confirm" onYes={() => confirmV(p, v.v)} />}</td></tr>)}</tbody></Table>
          {edit && <div className="row gap-s wrap"><Labeled label="New version %" htmlFor={`pv-${p.id}`}><input id={`pv-${p.id}`} inputMode="decimal" value={nv[p.id] || ""} onChange={(e) => setNv({ ...nv, [p.id]: e.target.value })} /></Labeled><Btn onClick={() => addVersion(p)}>Save draft version</Btn></div>}
        </Card>); })}
    </div>
  );
}

function Reminders() {
  const { db, update, role, toast, log } = useApp();
  const [days, setDays] = useState("30");
  const [th, setTh] = useState(db.settings.balanceThresholdPct ?? "");
  const exp = db.terms.filter((t) => t.status === "confirmed" && t.outcome === "Open" && !t.nextTermId && t.values.riskEnd >= TODAY && daysBetween(TODAY, t.values.riskEnd) <= +days);
  const inst = db.terms.filter((t) => t.status === "confirmed").flatMap((t) => instalmentRows(t).filter((r) => r.out > 0 && daysBetween(TODAY, r.due) <= 30).map((r) => ({ t, r })));
  const bal = db.terms.filter((t) => t.status === "confirmed" && isCargoOpen(db.policies.find((p) => p.id === t.policyId).type)).map((t) => { const si = +t.values.sumInsured; const used = t.cargoDecls.reduce((a, x) => a + x.siInr, 0); return { t, pct: r2((si - used) / si * 100), bal: si - used }; });
  const C = (t) => db.customers.find((c) => c.id === db.policies.find((p) => p.id === t.policyId).customerId);
  const P = (t) => db.policies.find((p) => p.id === t.policyId);
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Reminders preview</h1><p className="muted">What reminders would cover, shown on screen only. No email or message is sent from this demo.</p></div></header>
      <div className="note note-warn">Not approved yet <Confirm />: triggers, recipients, templates, sender and opt-outs. Automation stays off until they are.</div>
      <Card title="Renewal reminders" sub="Trigger window is a preview setting, not a decided rule.">
        <Labeled label="Preview window" htmlFor="rm-days"><Select id="rm-days" value={days} onChange={setDays} options={[{ value: "30", label: "30 days before expiry" }, { value: "45", label: "45 days" }, { value: "60", label: "60 days" }]} /></Labeled>
        {exp.length ? <Table><thead><tr><th>Insured</th><th>Policy</th><th>Ends</th><th>Basis</th><th>Would go to</th><th>Status</th></tr></thead><tbody>{exp.map((t) => <tr key={t.id}><td>{C(t).name}</td><td>{P(t).type}{t.values.renewable === "No" && <Pill tone="warn">Not renewable</Pill>}</td><td>{fmtDate(t.values.riskEnd)}</td><td className="small">Risk end date, {daysBetween(TODAY, t.values.riskEnd)} days away</td><td><Confirm /></td><td><Pill>Preview only, not sent</Pill></td></tr>)}</tbody></Table> : <Empty title="Nothing in this window" />}
      </Card>
      <Card title="Instalments due or overdue (next 30 days and past)">
        {inst.length ? <Table><thead><tr><th>Insured</th><th>Instalment</th><th>Due</th><th className="num">Outstanding</th><th>Would go to</th><th>Status</th></tr></thead><tbody>{inst.map(({ t, r }) => <tr key={t.id + r.no}><td>{C(t).name}</td><td>{P(t).type}, #{r.no}</td><td>{fmtDate(r.due)}</td><td className="num">{fmtMoney(r.out, t.values.currency)}</td><td><Confirm /></td><td><Pill>Preview only, not sent</Pill></td></tr>)}</tbody></Table> : <Empty title="No instalments due" />}
      </Card>
      <Card title="Open policy balance" sub="Notes gave 30% only as an example. Set a preview value to see which policies would show.">
        <div className="row gap-s wrap">
          <Labeled label="Preview threshold (% of sum insured left)" htmlFor="rm-th"><input id="rm-th" inputMode="decimal" value={th} onChange={(e) => setTh(e.target.value)} disabled={role !== "admin"} /></Labeled>
          {role === "admin" && <Btn onClick={() => { const v = th === "" ? null : isNum(th) && +th >= 0 && +th <= 100 ? +th : undefined; if (v === undefined) { toast("Enter a number from 0 to 100, or leave blank", "bad"); return; } update((d) => { d.settings.balanceThresholdPct = v; log(d, { action: "Preview threshold saved", detail: v == null ? "Threshold cleared" : `${v}% (preview only, not a decided rule)` }); }); toast(v == null ? "Threshold cleared" : "Preview threshold saved"); }}>Save preview threshold</Btn>}
        </div>
        <Table><thead><tr><th>Insured</th><th>Policy</th><th className="num">Balanced SI</th><th className="num">% left</th><th>Would remind?</th></tr></thead><tbody>{bal.map(({ t, pct, bal: b }) => <tr key={t.id}><td>{C(t).name}</td><td>{t.values.policyNo}</td><td className="num">{fmtMoney(b)}</td><td className="num">{pct}%</td><td>{db.settings.balanceThresholdPct == null ? <span className="muted">No threshold set</span> : pct < db.settings.balanceThresholdPct ? <Pill tone="warn">Yes (preview)</Pill> : "No"}</td></tr>)}</tbody></Table>
      </Card>
      <Card title="Sample wording (draft, not approved)">
        <div className="paper-note">Dear customer, your {"{policy type}"} policy {"{policy no.}"} with {"{insurer}"} ends on {"{risk end date}"}. Please contact {"{CSC name}"} to discuss renewal. Sender, signature and opt-out text to be approved.</div>
      </Card>
    </div>
  );
}

// The 15 questions the notes left open, answered by IndSure on 4 Nov 2026. "status" says honestly
// whether the portal already works that way.
const DECISIONS = [
  ["CSE or CSC", "CSC. It is one role: the customer service coordinator who looks after the customer. Reports group it as \"CSC Wise\".", "built", "Renamed everywhere. Team members saved as CSE were changed to CSC."],
  ["Departments and policy types", "One list. Every policy type sits under one department only. Where the notes and the old system disagree, the old system's name is kept and the duplicate is merged into it.", "partly", "Masters shows both lists and flags duplicates. Merging is done by hand in Masters for now."],
  ["Date definitions", "Every date is kept separately. Business is booked on the risk start date (that is when the cover and our brokerage begin). Brokerage received is counted on the date the money arrives. Remittance is its own date.", "partly", "All dates are stored and every report lets you pick the date to use. Use risk start for the business report and receipt date for brokerage received."],
  ["Report totals", "The portal's totals are the only totals: the sum of net premium (without GST) from the policy records. The two figures on the old photographed report are not copied.", "built", "Totals are worked out from the records, with a note saying how."],
  ["Brokerage presets", "\"Company\" means the insurer. A rate is set per insurer and policy type. Accounts and Admin can change it. Every change is saved as a new version and each policy keeps the rate it was made with. No separate approval step for now.", "built", "Presets are per insurer and policy type, with versions."],
  ["PAN and record keeping", "Do not collect PAN: the insurer does KYC, we do not need it. Keep business contacts only. Keep policy records for at least 10 years after the policy ends, and never delete them earlier.", "check", "PAN is not collected and nothing is deleted. Ask your compliance adviser to confirm the 10-year period against the IRDAI broker rules before going live."],
  ["Reminders", "Renewal reminders 60, 30 and 15 days before the risk end date, to the CSC first. Open-policy balance reminder when less than 30% of the sum insured is left. Messages to customers only after the wording is approved.", "partly", "Reminders preview shows who would be reminded. Set the 30% threshold there (Admin). Sending email or WhatsApp is not built."],
  ["Team and permissions", "Four roles: Operations / BD (CSC), Accounts, Admin, Read-only. Each customer has one CSC and one RM; the RM who brought the business is kept on each policy. Only Accounts and Admin export. After a report is finalized only Admin can correct it.", "partly", "The roles and their screens exist. They are a role switch, not logins: everyone on this computer can switch. Real logins are needed before more than one person uses it."],
  ["Fleet changes", "The insurer's endorsement figure is final. We type it in; we never calculate our own premium for it.", "built", "Fleet changes take the premium and brokerage change from the insurer's document."],
  ["Charterers' Liability declarations", "Monthly declaration: vessel, charter period, GRT and the premium the insurer charges for it. The premium comes from the insurer, not a formula.", "partly", "Declarations can be recorded. The exact fields should be checked with the marine team on the first real policy."],
  ["Lost renewals", "The label is \"Renewed / Achieved / Lost\". For a lost renewal record who it went to (another broker, direct to the insurer, customer closed or did not buy) and why.", "partly", "\"Mark as lost\" saves who and why as free text. A fixed pick-list is not built."],
  ["FX month and approval", "Use the rate for the month of the date the report uses (normally risk start). Admin enters the monthly rate; every change is kept.", "built", "FX rates are per month, Admin and Accounts can enter them, and versions are kept."],
  ["Declarations over the limit", "Save it and flag it in red, and the CSC asks the insurer to raise the sum insured. Never block it: the cargo has already moved.", "built", "Over-limit declarations are saved and flagged."],
  ["Fleet changes in reports", "Include them in business and brokerage totals in the month the insurer's endorsement is dated.", "todo", "Not built yet: fleet changes show on the policy but are left out of report totals."],
  ["Technology and hosting", "Same stack as the rest of IndSure, no new vendor: this React portal, our own backend on the EC2 server, the Supabase database and file storage we already pay for.", "todo", "Today it runs only on this computer, with its own small records server. Moving it to EC2 and Supabase is the next build step."],
];
const STATUS = { built: ["good", "Built"], partly: ["warn", "Partly built"], todo: ["muted", "Not built yet"], check: ["bad", "Needs a legal check"] };
function Decisions() {
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Decisions</h1><p className="muted">The questions the notes left open, answered on 4 Nov 2026. Each one says whether the portal already works that way.</p></div></header>
      <Table><thead><tr><th>#</th><th>Topic</th><th>Decision</th><th>In the portal now</th></tr></thead>
        <tbody>{DECISIONS.map(([a, b, st, c], i) => <tr key={a}><td>{i + 1}</td><td><strong>{a}</strong></td><td>{b}</td><td className="small"><Pill tone={STATUS[st][0]}>{STATUS[st][1]}</Pill><div>{c}</div></td></tr>)}</tbody></Table>
      <Card title="How to read the labels"><p><Proposed /> is a design suggestion, not approved. <Legacy /> was seen on the current platform and is reference only. <Confirm /> still needs checking with the team.</p></Card>
    </div>
  );
}


// Scoped root: every rule in commercial.css sits under .ic-root, so nothing leaks into the rest of the app.
export default function CommercialPortal() {
  return <div className="ic-root"><App /></div>;
}
