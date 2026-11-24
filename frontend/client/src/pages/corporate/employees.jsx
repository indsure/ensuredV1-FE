// Lists and team > Employees: the owner invites people by email, changes their role and departments, sends a
// new PIN link, or switches a login off. Online portal only, owner only.
import { useEffect, useState } from "react";
import { useApp, Card, Btn, Labeled, Select, Table, Pill, Empty, AskFirst } from "./ui.jsx";
import { DEPARTMENTS } from "./data.js";
import { fmtStamp } from "./lib.js";
import { localStamp } from "./confidence.js";
import { listTeam, inviteEmployee, cancelInvite, changeEmployee, newPinLink } from "./store.js";

const ROLE_OPTIONS = [{ value: "ops", label: "Operations / BD" }, { value: "accounts", label: "Accounts" }, { value: "admin", label: "Admin" }, { value: "readonly", label: "Read-only" }];
const when = (t) => (t ? fmtStamp(localStamp(+new Date(t))) : "Never");

// The link is shown as well as emailed, because the email may not arrive.
function LinkBox({ made, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(made.link); setCopied(true); } catch (e) { document.getElementById("em-link")?.select(); } };
  return (
    <div className="note" role="status" data-link>
      <strong>{made.emailed ? `Emailed to ${made.email}.` : `The email to ${made.email} could not be sent. Send them this link yourself.`}</strong>
      <div className="small muted">It works once, until {when(made.expiresAt)}. You can also share it on WhatsApp.</div>
      <div className="row gap-s wrap" style={{ marginTop: 8 }}><input id="em-link" className="grow" readOnly value={made.link} aria-label="Invite link" onFocus={(e) => e.target.select()} /><Btn kind="primary" onClick={copy}>{copied ? "Copied" : "Copy link"}</Btn><Btn onClick={onClose}>Done</Btn></div>
    </div>
  );
}

export function EmployeesTab() {
  const { toast } = useApp();
  const [t, setT] = useState(null);
  const [f, setF] = useState({ email: "", role: "ops" });
  const [err, setErr] = useState("");
  const [made, setMade] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => listTeam().then((r) => setT(r.ok ? r.body : r.status === 503 ? "setup" : "error"));
  useEffect(() => { load(); }, []);
  const invite = async () => {
    const email = f.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter a valid email.");
    setBusy(true); const r = await inviteEmployee(email, f.role); setBusy(false);
    if (!r.ok) return setErr(r.body?.error || "The invite could not be sent. Try again.");
    setErr(""); setF({ email: "", role: f.role }); setMade({ ...r.body, email }); load();
  };
  const again = async (i) => { const r = await inviteEmployee(i.email, i.role); if (r.ok) { setMade({ ...r.body, email: i.email }); load(); } else toast(r.body?.error || "It could not be sent. Try again.", "bad"); };
  const change = async (id, patch, msg) => { const r = await changeEmployee(id, patch); toast(r.ok ? msg : r.body?.error || "It could not be saved. Try again.", r.ok ? undefined : "bad"); if (r.ok) load(); return r.ok; };
  if (t === null) return <p className="muted" role="status">Loading...</p>;
  if (t === "setup") return <Empty title="Employee logins are not switched on yet">IndSure is still setting them up on the server.</Empty>;
  if (t === "error") return <p className="err-text" role="alert">The employees could not be loaded. Try again.</p>;
  return (
    <div className="stack">
      <Card title="Invite an employee" sub={`They get a link by email, set up their own profile and PIN, and sign in with their UserID and your OrgID, ${t.org?.code}.`}>
        <div className="filters">
          <Labeled label="Email" htmlFor="em-email"><input id="em-email" type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Labeled>
          <Labeled label="Role" htmlFor="em-role"><Select id="em-role" value={f.role} onChange={(v) => setF({ ...f, role: v })} options={ROLE_OPTIONS} /></Labeled>
          <div className="fld"><Btn kind="primary" onClick={invite} disabled={busy}>{busy ? "Sending..." : "Send invite"}</Btn></div>
        </div>
        {err && <p className="err-text" role="alert">{err}</p>}
        {made && <LinkBox key={made.link} made={made} onClose={() => setMade(null)} />}
      </Card>
      {t.invites.length > 0 && <Card title="Waiting to join">
        <Table><thead><tr><th>Email</th><th>Role</th><th>Invited</th><th>Link</th><th /></tr></thead><tbody>{t.invites.map((i) => { const gone = new Date(i.expires_at) < new Date(); return (
          <tr key={i.id}><td>{i.email}</td><td>{ROLE_OPTIONS.find((r) => r.value === i.role)?.label}</td><td className="small">{when(i.created_at)}</td><td><Pill tone={gone ? "bad" : "info"}>{gone ? "Expired" : `Works until ${when(i.expires_at)}`}</Pill></td>
            <td><div className="row gap-xs wrap"><Btn onClick={() => again(i)}>Send again</Btn><AskFirst label="Cancel invite" question={`Cancel the invite to ${i.email}? Their link stops working.`} yes="Cancel it" onYes={async () => { const r = await cancelInvite(i.id); toast(r.ok ? "Invite cancelled" : "It could not be cancelled. Try again.", r.ok ? undefined : "bad"); load(); }} /></div></td></tr>); })}</tbody></Table>
      </Card>}
      <Card title="Employees">
        {!t.members.length ? <Empty title="Nobody has joined yet">Invite people above.</Empty> : (
          <Table><thead><tr><th>Name</th><th>UserID</th><th>Departments</th><th>Role</th><th>Last signed in</th><th>Status</th><th /></tr></thead><tbody>{t.members.map((m) => (
            <tr key={m.id}>
              <td>{m.name}<div className="small muted">{m.designation}</div><div className="small muted">{m.email}</div></td><td className="mono">{m.user_code}</td><td className="small">{m.departments.join(", ")}</td>
              <td><select aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => change(m.id, { role: e.target.value }, "Role changed")}>{ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
              <td className="small">{when(m.last_login)}</td><td><Pill tone={m.active ? "good" : "muted"}>{m.active ? "Active" : "Switched off"}</Pill></td>
              <td><div className="row gap-xs wrap">
                <Btn onClick={() => setEdit({ id: m.id, name: m.name, designation: m.designation, departments: m.departments })}>Edit</Btn>
                {m.active && <Btn onClick={async () => { const r = await newPinLink(m.id); if (r.ok) setMade({ ...r.body, email: m.email }); else toast("It could not be sent. Try again.", "bad"); }}>New PIN link</Btn>}
                {m.active ? <AskFirst label="Switch off" question={`Switch off ${m.name}? They are signed out at once. Their work stays.`} yes="Switch off" onYes={() => change(m.id, { active: false }, "Login switched off")} /> : <Btn onClick={() => change(m.id, { active: true }, "Login switched on")}>Switch on</Btn>}
              </div></td>
            </tr>))}</tbody></Table>
        )}
        {edit && <div className="boxed stack" style={{ marginTop: 12 }}>
          <h4>{edit.name}</h4>
          <Labeled label="Designation" htmlFor="em-desig"><input id="em-desig" value={edit.designation} onChange={(e) => setEdit({ ...edit, designation: e.target.value })} /></Labeled>
          <fieldset className="corp-depts"><legend>Departments</legend>{Object.keys(DEPARTMENTS).map((d) => <label key={d} className="check"><input type="checkbox" checked={edit.departments.includes(d)} onChange={() => setEdit({ ...edit, departments: edit.departments.includes(d) ? edit.departments.filter((x) => x !== d) : [...edit.departments, d] })} /> {d}</label>)}</fieldset>
          <div className="row gap-s"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={async () => { if (await change(edit.id, { designation: edit.designation, departments: edit.departments }, "Saved")) setEdit(null); }}>Save</Btn></div>
        </div>}
      </Card>
    </div>
  );
}
