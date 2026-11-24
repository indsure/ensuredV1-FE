// Users: the owner and Admins invite people by email, set their role and teams, send a new PIN link, or switch a
// login off. The owner also edits the roles. Online portal only.
import { useEffect, useState } from "react";
import { useApp, Card, Btn, Labeled, Select, Table, Pill, Empty, AskFirst, Modal, Tabs, SearchPick } from "./ui.jsx";
import { DEPARTMENTS } from "./data.js";
import { fmtStamp } from "./lib.js";
import { localStamp } from "./confidence.js";
import { PAGES, ACTIONS, DEFAULT_ROLES } from "./access.js";
import { listTeam, inviteEmployee, cancelInvite, changeEmployee, newPinLink, saveRole, removeRole, saveTeam, removeTeam } from "./store.js";

const when = (t) => (t ? fmtStamp(localStamp(+new Date(t))) : "Never");
const toggle = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
const why = (r) => (r.status === 503 ? "IndSure is still setting this up on the server." : r.body?.error && r.status < 500 ? r.body.error : "It could not be saved. Try again.");
const TOTAL = ACTIONS.flatMap((g) => g.items).length;

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
function Ticks({ legend, options, value, onChange }) {
  return <fieldset className="corp-depts"><legend>{legend}</legend>{options.map((o) => <label key={o.value} className="check"><input type="checkbox" checked={value.includes(o.value)} onChange={() => onChange(toggle(value, o.value))} /> {o.label}</label>)}</fieldset>;
}

/** The Invite user button's box. Opens over any page. */
export function InviteUser({ onClose }) {
  const [t, setT] = useState(null);
  const [f, setF] = useState({ email: "", role: "ops", teams: [] });
  const [err, setErr] = useState("");
  const [made, setMade] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { listTeam().then((r) => setT(r.ok ? r.body : r.status === 503 ? "setup" : "error")); }, []);
  const send = async () => {
    const email = f.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter a valid email.");
    setBusy(true); const r = await inviteEmployee(email, f.role, f.teams); setBusy(false);
    if (!r.ok) return setErr(r.body?.error || "The invite could not be sent. Try again.");
    setErr(""); setMade({ ...r.body, email }); window.dispatchEvent(new Event("corp-users"));
  };
  const roles = (t?.roles || DEFAULT_ROLES).filter((r) => r.key !== "admin" || t?.owner !== false);
  return (
    <Modal title="Invite user" onClose={onClose}>
      {t === null ? <p className="muted" role="status">Loading...</p> : typeof t === "string" ? <p className="err-text" role="alert">{t === "setup" ? "IndSure is still setting this up on the server." : "It could not be opened. Try again."}</p> : made ? (
        <div className="stack"><LinkBox made={made} onClose={onClose} /><div><Btn onClick={() => { setMade(null); setF({ ...f, email: "" }); }}>Invite another</Btn></div></div>
      ) : (
        <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) send(); }}>
          <p className="muted">They get a link by email, set up their own profile and PIN, and sign in with their UserID and your OrgID, {t.org?.code}.</p>
          <Labeled label="Email" htmlFor="em-email" req><input id="em-email" type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Labeled>
          <Labeled label="Role" htmlFor="em-role" req><Select id="em-role" value={f.role} onChange={(v) => setF({ ...f, role: v })} options={roles.map((r) => ({ value: r.key, label: r.name }))} /></Labeled>
          {t.teams?.length > 0 && <Ticks legend="Teams (optional)" options={t.teams.map((x) => ({ value: String(x.id), label: x.name }))} value={f.teams} onChange={(v) => setF({ ...f, teams: v })} />}
          {err && <p className="err-text" role="alert">{err}</p>}
          <div><Btn kind="primary" type="submit" disabled={busy}>{busy ? "Sending..." : "Send invite"}</Btn></div>
        </form>
      )}
    </Modal>
  );
}

function People({ t, load, toast, db }) {
  const [made, setMade] = useState(null);
  const [edit, setEdit] = useState(null);
  const roleName = (k) => t.roles.find((r) => r.key === k)?.name || k;
  const teamsOf = (id) => t.teams.filter((x) => x.members.some((m) => String(m.id) === String(id)));
  const change = async (id, patch, msg) => { const r = await changeEmployee(id, patch); toast(r.ok ? msg : why(r), r.ok ? undefined : "bad"); if (r.ok) load(); return r.ok; };
  const again = async (i) => { const r = await inviteEmployee(i.email, i.role, i.teams || []); if (r.ok) { setMade({ ...r.body, email: i.email }); load(); } else toast(r.body?.error || "It could not be sent. Try again.", "bad"); };
  const codes = db.team.filter((x) => x.active !== false).map((x) => ({ value: x.code, label: `${x.name} (${x.code}, ${x.role})` }));
  return (
    <div className="stack">
      {made && <LinkBox key={made.link} made={made} onClose={() => setMade(null)} />}
      {t.invites.length > 0 && <Card title="Waiting to join">
        <Table><thead><tr><th>Email</th><th>Role</th><th>Invited</th><th>Link</th><th /></tr></thead><tbody>{t.invites.map((i) => { const gone = new Date(i.expires_at) < new Date(); const locked = i.role === "admin" && !t.owner; return (
          <tr key={i.id}><td>{i.email}</td><td>{roleName(i.role)}</td><td className="small">{when(i.created_at)}</td><td><Pill tone={gone ? "bad" : "info"}>{gone ? "Expired" : `Works until ${when(i.expires_at)}`}</Pill></td>
            <td>{!locked && <div className="row gap-xs wrap"><Btn onClick={() => again(i)}>Send again</Btn><AskFirst label="Cancel invite" question={`Cancel the invite to ${i.email}? Their link stops working.`} yes="Cancel it" onYes={async () => { const r = await cancelInvite(i.id); toast(r.ok ? "Invite cancelled" : "It could not be cancelled. Try again.", r.ok ? undefined : "bad"); load(); }} /></div>}</td></tr>); })}</tbody></Table>
      </Card>}
      <Card title="People">
        {!t.members.length ? <Empty title="Nobody has joined yet">Use Invite user.</Empty> : (
          <Table><thead><tr><th>Name</th><th>UserID</th><th>Role</th><th>Teams</th><th>Departments</th><th>Last signed in</th><th>Status</th><th /></tr></thead><tbody>{t.members.map((m) => { const locked = m.role === "admin" && !t.owner; return (
            <tr key={m.id}>
              <td>{m.name}<div className="small muted">{m.designation}</div><div className="small muted">{m.email}</div></td><td className="mono">{m.user_code}</td>
              <td>{locked ? roleName(m.role) : <select aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => change(m.id, { role: e.target.value }, "Role changed")}>{t.roles.filter((r) => r.key !== "admin" || t.owner).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select>}</td>
              <td className="small">{teamsOf(m.id).map((x) => x.name).join(", ") || "None"}</td><td className="small">{m.departments.join(", ")}</td>
              <td className="small">{when(m.last_login)}</td><td><Pill tone={m.active ? "good" : "muted"}>{m.active ? "Active" : "Switched off"}</Pill></td>
              <td>{locked ? <span className="small muted">Only the owner can change an Admin</span> : <div className="row gap-xs wrap">
                <Btn onClick={() => setEdit({ id: m.id, name: m.name, designation: m.designation, departments: m.departments, staff_code: m.staff_code || "", teams: teamsOf(m.id).map((x) => String(x.id)) })}>Edit</Btn>
                {m.active && <Btn onClick={async () => { const r = await newPinLink(m.id); if (r.ok) setMade({ ...r.body, email: m.email }); else toast(r.body?.error || "It could not be sent. Try again.", "bad"); }}>New PIN link</Btn>}
                {m.active ? <AskFirst label="Switch off" question={`Switch off ${m.name}? They are signed out at once. Their work stays.`} yes="Switch off" onYes={() => change(m.id, { active: false }, "Login switched off")} /> : <Btn onClick={() => change(m.id, { active: true }, "Login switched on")}>Switch on</Btn>}
              </div>}</td>
            </tr>); })}</tbody></Table>
        )}
      </Card>
      {edit && <Modal title={`Edit ${edit.name}`} onClose={() => setEdit(null)}><div className="stack">
        <Labeled label="Designation" htmlFor="em-desig"><input id="em-desig" value={edit.designation} onChange={(e) => setEdit({ ...edit, designation: e.target.value })} /></Labeled>
        <Ticks legend="Departments" options={Object.keys(DEPARTMENTS).map((d) => ({ value: d, label: d }))} value={edit.departments} onChange={(v) => setEdit({ ...edit, departments: v })} />
        {t.access && <>
          {t.teams.length > 0 && <Ticks legend="Teams" options={t.teams.map((x) => ({ value: String(x.id), label: x.name }))} value={edit.teams} onChange={(v) => setEdit({ ...edit, teams: v })} />}
          <Labeled label="Their CSC or RM code" htmlFor="em-code" hint="Optional. Links them to their customers, so their team can be used as a filter."><SearchPick id="em-code" value={edit.staff_code} onChange={(v) => setEdit({ ...edit, staff_code: v })} options={codes} noun="code" emptyLabel="Not linked" /></Labeled>
        </>}
        <div className="row gap-s"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={async () => { if (await change(edit.id, { designation: edit.designation, departments: edit.departments, ...(t.access ? { teams: edit.teams, staff_code: edit.staff_code } : {}) }, "Saved")) setEdit(null); }}>Save</Btn></div>
      </div></Modal>}
    </div>
  );
}

function Roles({ t, load, toast }) {
  const [ed, setEd] = useState(null);
  const [err, setErr] = useState("");
  const used = (k) => t.members.filter((m) => m.role === k).length;
  const save = async () => {
    const r = await saveRole(ed.key, { name: ed.name, pages: ed.pages, actions: ed.actions });
    if (!r.ok) return setErr(why(r));
    toast("Role saved"); setEd(null); load();
  };
  const drop = async (r) => { const x = await removeRole(r.key); toast(x.ok ? (r.builtIn ? "Back to its default" : "Role deleted") : why(x), x.ok ? undefined : "bad"); if (x.ok) load(); };
  const edit = (r) => { setErr(""); setEd(r); };
  return (
    <Card title="Roles" sub="What each role sees and can do. A change reaches people the next time they open the portal or come back to its tab." actions={t.owner && <Btn kind="primary" onClick={() => edit({ key: null, name: "", pages: ["customers", "register"], actions: [] })}>Add role</Btn>}>
      {!t.owner && <p className="muted small">Only the owner can change roles.</p>}
      <Table><thead><tr><th>Role</th><th>People</th><th>Pages</th><th>Can do</th><th /></tr></thead><tbody>{t.roles.map((r) => (
        <tr key={r.key}><td>{r.name}{r.builtIn && <div className="small muted">{r.key === "admin" ? "Always everything, and invites users" : r.edited ? "Built in, changed" : "Built in"}</div>}</td><td>{used(r.key)}</td>
          <td className="small">{r.key === "admin" ? "All" : PAGES.filter((p) => r.pages.includes(p.key)).map((p) => p.label).join(", ")}</td><td className="small">{r.key === "admin" ? "All" : r.actions.some((a) => a !== "backup" && a !== "export") ? `${r.actions.length} of ${TOTAL}` : "View only"}</td>
          <td>{t.owner && r.key !== "admin" && <div className="row gap-xs wrap"><Btn onClick={() => edit({ key: r.key, name: r.name, pages: r.pages, actions: r.actions })}>Edit</Btn><Btn onClick={() => edit({ key: null, name: `${r.name} copy`, pages: r.pages, actions: r.actions })}>Copy</Btn>
            {r.builtIn ? r.edited && <AskFirst label="Back to default" question={`Put ${r.name} back to its default?`} yes="Put back" onYes={() => drop(r)} /> : <AskFirst label="Delete" question={`Delete the role ${r.name}?`} yes="Delete" onYes={() => drop(r)} />}</div>}</td></tr>))}</tbody></Table>
      {ed && <Modal wide title={ed.key ? "Edit role" : "Add role"} onClose={() => setEd(null)}><div className="stack">
        <Labeled label="Role name" htmlFor="rl-name" req><input id="rl-name" maxLength={60} value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} /></Labeled>
        <Ticks legend="Pages they see" options={PAGES.map((p) => ({ value: p.key, label: p.label }))} value={ed.pages} onChange={(v) => setEd({ ...ed, pages: v })} />
        {ACTIONS.map((g) => <Ticks key={g.group} legend={g.group} options={g.items.map(([value, label]) => ({ value, label }))} value={ed.actions} onChange={(v) => setEd({ ...ed, actions: v })} />)}
        {err && <p className="err-text" role="alert">{err}</p>}
        <div className="row gap-s"><Btn onClick={() => setEd(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save role</Btn></div>
      </div></Modal>}
    </Card>
  );
}

function Teams({ t, load, toast }) {
  const [ed, setEd] = useState(null);
  const [err, setErr] = useState("");
  const save = async () => {
    const r = await saveTeam(ed.id, { name: ed.name, members: ed.members, lead: ed.members.includes(ed.lead) ? ed.lead : null });
    if (!r.ok) return setErr(why(r));
    toast("Team saved"); setEd(null); load();
  };
  const name = (id) => t.members.find((m) => String(m.id) === id)?.name;
  const people = ed ? t.members.filter((m) => m.active || ed.members.includes(String(m.id))) : [];
  return (
    <Card title="Teams" sub="Groups of people, used to filter lists and reports. A team hides nothing: everyone still sees every customer." actions={<Btn kind="primary" onClick={() => { setErr(""); setEd({ id: null, name: "", lead: "", members: [] }); }}>Add team</Btn>}>
      {!t.teams.length ? <Empty title="No teams yet">Add a team, then choose its people and lead.</Empty> : (
        <Table><thead><tr><th>Team</th><th>Lead</th><th>People</th><th /></tr></thead><tbody>{t.teams.map((x) => (
          <tr key={x.id}><td>{x.name}{!x.members.some((m) => m.staff_code) && <div className="small muted">Not a filter yet: give its people a CSC or RM code</div>}</td><td>{x.lead_name || "None"}</td><td className="small">{x.members.map((m) => m.name).join(", ") || "Nobody yet"}</td>
            <td><div className="row gap-xs wrap"><Btn onClick={() => { setErr(""); setEd({ id: x.id, name: x.name, lead: x.lead_id ? String(x.lead_id) : "", members: x.members.map((m) => String(m.id)) }); }}>Edit</Btn><AskFirst label="Delete" question={`Delete the team ${x.name}? Its people and their work stay.`} yes="Delete" onYes={async () => { const r = await removeTeam(x.id); toast(r.ok ? "Team deleted" : why(r), r.ok ? undefined : "bad"); if (r.ok) load(); }} /></div></td></tr>))}</tbody></Table>)}
      {ed && <Modal title={ed.id ? "Edit team" : "Add team"} onClose={() => setEd(null)}><div className="stack">
        <Labeled label="Team name" htmlFor="tmx-name" req><input id="tmx-name" maxLength={60} value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} /></Labeled>
        {people.length ? <Ticks legend="People" options={people.map((m) => ({ value: String(m.id), label: m.active ? m.name : `${m.name} (switched off)` }))} value={ed.members} onChange={(v) => setEd({ ...ed, members: v })} /> : <p className="muted small">Nobody has joined yet. You can add people later.</p>}
        <Labeled label="Lead" htmlFor="tmx-lead" hint="Optional. One of the people ticked above."><Select id="tmx-lead" value={ed.members.includes(ed.lead) ? ed.lead : ""} onChange={(v) => setEd({ ...ed, lead: v })} placeholder="No lead" options={ed.members.map((id) => ({ value: id, label: name(id) || id }))} /></Labeled>
        {err && <p className="err-text" role="alert">{err}</p>}
        <div className="row gap-s"><Btn onClick={() => setEd(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save team</Btn></div>
      </div></Modal>}
    </Card>
  );
}

export function UsersPage({ onInvite, onChanged }) {
  const { toast, db } = useApp();
  const [tab, setTab] = useState("people");
  const [t, setT] = useState(null);
  const load = () => listTeam().then((r) => { setT(r.ok ? { teams: [], roles: DEFAULT_ROLES, access: false, owner: true, ...r.body } : r.status === 503 ? "setup" : "error"); onChanged?.(); });
  useEffect(() => { load(); window.addEventListener("corp-users", load); return () => window.removeEventListener("corp-users", load); }, []);
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Users</h1><p className="muted">{t?.org ? `${t.org.name}, OrgID ${t.org.code}. ` : ""}Invite people, choose what they can see and do, and group them into teams.</p></div><Btn kind="primary" onClick={onInvite}>Invite user</Btn></header>
      {t === null ? <p className="muted" role="status">Loading...</p> : t === "setup" ? <Empty title="Employee logins are not switched on yet">IndSure is still setting them up on the server.</Empty> : t === "error" ? <p className="err-text" role="alert">The users could not be loaded. Try again.</p> : <>
        <Tabs tabs={[{ key: "people", label: "People" }, { key: "roles", label: "Roles" }, { key: "teams", label: "Teams" }]} value={tab} onChange={setTab} />
        {tab === "people" ? <People t={t} load={load} toast={toast} db={db} /> : !t.access ? <Empty title={`${tab === "roles" ? "Roles" : "Teams"} are not switched on yet`}>IndSure is still setting this up on the server.</Empty> : tab === "roles" ? <Roles t={t} load={load} toast={toast} /> : <Teams t={t} load={load} toast={toast} />}
      </>}
    </div>
  );
}

/** A team filter for lists and reports. Nothing is shown until a team has someone with a CSC or RM code. */
export function TeamFilter({ id, value, onChange }) {
  const { teams } = useApp();
  const list = teams.filter((x) => x.codes.length);
  return list.length ? <Labeled label="Team" htmlFor={id}><Select id={id} value={value} onChange={onChange} placeholder="All teams" options={list.map((x) => ({ value: x.id, label: x.name }))} /></Labeled> : null;
}
