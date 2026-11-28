// Users: the owner and Admins invite people by email, set their role and teams, send a new PIN link, or switch a
// login off. The owner also edits the roles. Online portal only.
import { useEffect, useState } from "react";
import { useApp, Btn, Labeled, Select, Table, Pill, Empty, AskFirst, Modal, Tabs, SearchPick } from "./ui.jsx";
import { DEPARTMENTS } from "./data.js";
import { fmtStamp, fmtDate } from "./lib.js";
import { localStamp } from "./confidence.js";
import { PAGES, ACTIONS, DEFAULT_ROLES } from "./access.js";
import { listTeam, inviteEmployee, cancelInvite, changeEmployee, newPinLink, saveRole, removeRole, saveTeam, removeTeam } from "./store.js";

const when = (t) => (t ? fmtStamp(localStamp(+new Date(t))) : "Never");
const toggle = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
const why = (r) => (r.status === 503 ? "IndSure is still setting this up on the server." : r.body?.error && r.status < 500 ? r.body.error : "It could not be saved. Try again.");

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
function Ticks({ legend, options, value, onChange, allKeys }) {
  const every = allKeys?.every((k) => value.includes(k));
  return <fieldset className="corp-depts"><legend>{legend}{allKeys && allKeys.length > 2 && <> <button type="button" className="linkbtn small" onClick={() => onChange(every ? value.filter((v) => !allKeys.includes(v)) : [...new Set([...value, ...allKeys])])}>{every ? "Clear all" : "Tick all"}</button></>}</legend>{options.map((o) => <label key={o.value} className="check"><input type="checkbox" checked={value.includes(o.value)} onChange={() => onChange(toggle(value, o.value))} /> {o.label}</label>)}</fieldset>;
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

// Today 10:54, Yesterday 10:54, else the date.
function seen(t) {
  if (!t) return "Never";
  const s = localStamp(+new Date(t)), d = s.slice(0, 10), now = localStamp(Date.now()).slice(0, 10), y = localStamp(Date.now() - 86400000).slice(0, 10);
  return d === now ? `Today ${s.slice(11, 16)}` : d === y ? `Yesterday ${s.slice(11, 16)}` : fmtDate(d);
}
const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
function Who({ name, sub, off }) {
  return <div className={`us-who ${off ? "us-off" : ""}`}><span className="us-av" aria-hidden="true">{initials(name)}</span><div className="us-txt"><strong>{name}</strong>{sub && <span className="small muted">{sub}</span>}</div></div>;
}

function People({ t, load, toast, db, go }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null); // { m } a person or { i } an invite
  const roleName = (k) => t.roles.find((r) => r.key === k)?.name || k;
  const teamsOf = (id) => t.teams.filter((x) => x.members.some((m) => String(m.id) === String(id)));
  const hit = (...x) => !q.trim() || x.join(" ").toLowerCase().includes(q.trim().toLowerCase());
  const members = [...t.members].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)).filter((m) => hit(m.name, m.email, m.user_code, m.designation, roleName(m.role), ...teamsOf(m.id).map((x) => x.name)));
  const invites = t.invites.filter((i) => hit(i.email, roleName(i.role)));
  const many = t.members.length + t.invites.length > 6;
  return (
    <div className="stack">
      {many && <div className="searchbar"><label htmlFor="us-q" className="sr">Search people</label><input id="us-q" type="search" placeholder="Search by name, email, UserID, role or team" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
      <Table className="us-table"><thead><tr><th>Person</th><th>UserID</th><th>Role</th><th>Teams</th><th>Last signed in</th><th><span className="sr">Manage</span></th></tr></thead><tbody>
        {t.ownerInfo && hit(t.ownerInfo.name, t.ownerInfo.email, "owner") && <tr><td><Who name={t.ownerInfo.name} sub={t.ownerInfo.email} /></td><td className="muted small">OrgID only</td><td><Pill tone="info">Owner</Pill></td><td className="muted">All</td><td className="nowrap">{seen(t.ownerInfo.last_login)}</td><td /></tr>}
        {members.map((m) => { const locked = m.role === "admin" && !t.owner, tm = teamsOf(m.id); return (
          <tr key={m.id}>
            <td><Who name={m.name} sub={[m.designation, m.email].filter(Boolean).join(" · ")} off={!m.active} /></td><td className="mono nowrap">{m.user_code}</td>
            <td><Pill tone={m.role === "admin" ? "info" : "muted"}>{roleName(m.role)}</Pill>{!m.active && <Pill tone="bad">Switched off</Pill>}</td>
            <td>{tm.length ? tm.slice(0, 2).map((x) => x.name).join(", ") + (tm.length > 2 ? ` +${tm.length - 2}` : "") : <span className="muted">None</span>}</td><td className="nowrap">{seen(m.last_login)}</td>
            <td className="us-act">{locked ? <span className="small muted">Only the owner can change an Admin</span> : <Btn onClick={() => setOpen({ m })} aria-label={`Manage ${m.name}`}>Manage</Btn>}</td>
          </tr>); })}
        {invites.map((i) => { const gone = new Date(i.expires_at) < new Date(); return (
          <tr key={`i${i.id}`}>
            <td><Who name={i.email} sub="Has not joined yet" off /></td><td className="muted">After joining</td><td><Pill tone="muted">{roleName(i.role)}</Pill></td><td><span className="muted">{(i.teams || []).map((x) => t.teams.find((y) => String(y.id) === String(x))?.name).filter(Boolean).join(", ") || "None"}</span></td>
            <td><Pill tone={gone ? "bad" : "warn"}>{gone ? "Invite expired" : "Invited"}</Pill></td>
            <td className="us-act">{i.role === "admin" && !t.owner ? <span className="small muted">Only the owner can change an Admin</span> : <Btn onClick={() => setOpen({ i })} aria-label={`Manage the invite to ${i.email}`}>Manage</Btn>}</td>
          </tr>); })}
      </tbody></Table>
      {!members.length && !invites.length && (q ? <p className="muted">Nobody matches "{q}".</p> : <p className="muted">Nobody has joined yet. Use Invite user.</p>)}
      {open?.m && <PersonBox key={open.m.id} m={open.m} t={t} mine={teamsOf(open.m.id).map((x) => String(x.id))} load={load} toast={toast} db={db} go={go} onClose={() => setOpen(null)} />}
      {open?.i && <InviteBox key={open.i.id} i={open.i} load={load} toast={toast} onClose={() => setOpen(null)} />}
    </div>
  );
}
function InviteBox({ i, load, toast, onClose }) {
  const [made, setMade] = useState(null);
  const again = async () => { const r = await inviteEmployee(i.email, i.role, i.teams || []); if (r.ok) { setMade({ ...r.body, email: i.email }); load(); } else toast(r.body?.error || "It could not be sent. Try again.", "bad"); };
  const cancel = async () => { const r = await cancelInvite(i.id); toast(r.ok ? "Invite cancelled" : "It could not be cancelled. Try again.", r.ok ? undefined : "bad"); load(); if (r.ok) onClose(); };
  return (
    <Modal title="Invite" onClose={onClose}>
      <Who name={i.email} sub={`Invited ${when(i.created_at)}. The link ${new Date(i.expires_at) < new Date() ? "has expired" : `works until ${when(i.expires_at)}`}.`} />
      {made ? <LinkBox made={made} onClose={onClose} /> : <div className="row gap-s wrap"><Btn kind="primary" onClick={again}>Send again</Btn><AskFirst label="Cancel invite" question="Cancel it? Their link stops working." yes="Cancel it" onYes={cancel} /></div>}
    </Modal>
  );
}
function PersonBox({ m, t, mine, load, toast, db, go, onClose }) {
  const start = { designation: m.designation, departments: m.departments, role: m.role, teams: mine, staff_code: m.staff_code || "" };
  const [f, setF] = useState(start);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const all = Object.keys(DEPARTMENTS);
  const codes = db.team.filter((x) => x.active !== false || x.code === f.staff_code).map((x) => ({ value: x.code, label: `${x.name} (${x.code}, ${x.role})` }));
  const role = t.roles.find((r) => r.key === f.role);
  const dirty = JSON.stringify(f) !== JSON.stringify(start);
  const send = async (patch, msg) => { setBusy(true); const r = await changeEmployee(m.id, patch); setBusy(false); if (!r.ok) { setErr(why(r)); return false; } toast(msg); load(); return true; };
  const save = async () => { const { teams, staff_code, ...rest } = f; if (await send({ ...rest, ...(t.access ? { teams, staff_code } : {}) }, "Saved")) onClose(); };
  const pin = async () => { const r = await newPinLink(m.id); if (r.ok) setMade({ ...r.body, email: m.email }); else setErr(why(r)); };
  return (
    <Modal title="Manage user" onClose={onClose}><div className="stack">
      <div className="row between wrap gap-s"><Who name={m.name} sub={m.email} off={!m.active} /><div className="small muted">UserID <span className="mono">{m.user_code}</span><br />Last signed in: {seen(m.last_login)}</div></div>
      <div className="us-grid">
        <Labeled label="Role" htmlFor="pb-role" hint={role ? (role.key === "admin" ? "Everything, and invites users." : role.actions.some((a) => a !== "backup" && a !== "export") ? "See Roles for what it can do." : "Can look, cannot change.") : null}><Select id="pb-role" value={f.role} onChange={(v) => setF({ ...f, role: v })} options={t.roles.filter((r) => r.key !== "admin" || t.owner).map((r) => ({ value: r.key, label: r.name }))} /></Labeled>
        <Labeled label="Designation" htmlFor="em-desig"><input id="em-desig" maxLength={120} value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></Labeled>
      </div>
      <Ticks legend="Departments" options={all.map((d) => ({ value: d, label: d }))} value={f.departments} onChange={(v) => setF({ ...f, departments: v })} allKeys={all} />
      {t.access && t.teams.length > 0 && <Ticks legend="Teams" options={t.teams.map((x) => ({ value: String(x.id), label: x.name }))} value={f.teams} onChange={(v) => setF({ ...f, teams: v })} />}
      {t.access && <Labeled label="Their CSC or RM code" htmlFor="em-code" hint="Optional. Links them to their customers, so their team can be used as a filter."><SearchPick id="em-code" value={f.staff_code} onChange={(v) => setF({ ...f, staff_code: v })} options={codes} noun="code" emptyLabel="Not linked" /></Labeled>}
      {err && <p className="err-text" role="alert">{err}</p>}
      <div className="row gap-s"><Btn kind="primary" onClick={save} disabled={busy || !dirty} why={busy ? "Saving" : "Nothing changed"}>Save</Btn><Btn onClick={onClose}>Cancel</Btn></div>
      <div className="us-more">
        <h4>Sign-in</h4>
        {made ? <LinkBox made={made} onClose={() => setMade(null)} /> : <div className="row gap-s wrap">
          {m.active && <Btn onClick={pin}>New PIN link</Btn>}
          {t.owner && <Btn onClick={() => { onClose(); go({ view: "logs", person: `m:${m.id}` }); }}>View log</Btn>}
          {m.active ? <AskFirst label="Switch off" question={`Switch off ${m.name}? They are signed out at once. Their work stays.`} yes="Switch off" onYes={async () => { if (await send({ active: false }, "Login switched off")) onClose(); }} /> : <Btn onClick={async () => { if (await send({ active: true }, "Login switched on")) onClose(); }}>Switch on</Btn>}
        </div>}
      </div>
    </div></Modal>
  );
}

function Roles({ t, load, toast }) {
  const [ed, setEd] = useState(null);
  const [err, setErr] = useState("");
  const used = (k) => t.members.filter((m) => m.role === k).length;
  const edit = (r) => { setErr(""); setEd(r); };
  const save = async () => {
    const r = await saveRole(ed.key, { name: ed.name, pages: ed.pages, actions: ed.actions });
    if (!r.ok) return setErr(why(r));
    toast("Role saved"); setEd(null); load();
  };
  const drop = async () => { const x = await removeRole(ed.key); if (!x.ok) return setErr(why(x)); toast(ed.builtIn ? "Back to its default" : "Role deleted"); setEd(null); load(); };
  const doing = (r) => r.actions.some((a) => a !== "backup" && a !== "export") ? ACTIONS.map((g) => [g.group, g.items.filter(([k]) => r.actions.includes(k)).length, g.items.length]).filter(([, n]) => n).map(([g, n, of]) => `${g}${n < of ? ` (${n} of ${of})` : ""}`).join(", ") : "Look only";
  return (
    <div className="stack">
      <div className="row between wrap gap-s"><p className="muted small">{t.owner ? "Changes reach people the next time they open the portal or come back to its tab." : "Only the owner can change roles."}</p>{t.owner && <Btn onClick={() => edit({ key: null, name: "", pages: PAGES.filter((p) => p.key !== "new").map((p) => p.key), actions: [] })}>Add role</Btn>}</div>
      <Table className="us-table"><thead><tr><th>Role</th><th>People</th><th>Sees</th><th>Can do</th><th><span className="sr">Edit</span></th></tr></thead><tbody>{t.roles.map((r) => (
        <tr key={r.key}><td className="nowrap"><strong>{r.name}</strong>{r.edited && <div className="small muted">Changed from default</div>}</td><td>{used(r.key)}</td>
          <td>{r.key === "admin" || r.pages.length === PAGES.length ? "Everything" : PAGES.every((p) => p.key === "new" || r.pages.includes(p.key)) ? "All records and reports" : `${r.pages.length} of ${PAGES.length} pages`}</td><td className="small">{r.key === "admin" ? "Everything, and invites users" : doing(r)}</td>
          <td className="us-act">{t.owner && r.key !== "admin" && <Btn onClick={() => edit({ ...r })} aria-label={`Edit ${r.name}`}>Edit</Btn>}</td></tr>))}</tbody></Table>
      {ed && <Modal wide title={ed.key ? "Edit role" : "Add role"} onClose={() => setEd(null)}><div className="stack">
        <Labeled label="Role name" htmlFor="rl-name" req><input id="rl-name" maxLength={60} value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} /></Labeled>
        <Ticks legend="Pages they see" options={PAGES.map((p) => ({ value: p.key, label: p.label }))} value={ed.pages} onChange={(v) => setEd({ ...ed, pages: v })} allKeys={PAGES.map((p) => p.key)} />
        {ACTIONS.map((g) => <Ticks key={g.group} legend={g.group} options={g.items.map(([value, label]) => ({ value, label }))} value={ed.actions} onChange={(v) => setEd({ ...ed, actions: v })} allKeys={g.items.map(([k]) => k)} />)}
        {err && <p className="err-text" role="alert">{err}</p>}
        <div className="row between wrap gap-s"><div className="row gap-s"><Btn kind="primary" onClick={save}>Save role</Btn><Btn onClick={() => setEd(null)}>Cancel</Btn></div>
          {ed.key && <div className="row gap-s wrap"><Btn onClick={() => edit({ key: null, name: `${ed.name} copy`, pages: ed.pages, actions: ed.actions })}>Make a copy</Btn>
            {ed.builtIn ? ed.edited && <AskFirst label="Back to default" question={`Put ${ed.name} back to its default?`} yes="Put back" onYes={drop} /> : <AskFirst label="Delete role" question={`Delete the role ${ed.name}?`} yes="Delete" onYes={drop} />}</div>}</div>
      </div></Modal>}
    </div>
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
    <div className="stack">
      <div className="row between wrap gap-s"><p className="muted small">Everyone sees every customer. Teams are for grouping people and filtering lists and reports.</p><Btn onClick={() => { setErr(""); setEd({ id: null, name: "", lead: "", members: [] }); }}>Add team</Btn></div>
      {!t.teams.length ? <Empty title="No teams yet">Add a team, then choose its people and lead.</Empty> : (
        <Table className="us-table"><thead><tr><th>Team</th><th>Lead</th><th>People</th><th>Filter</th><th><span className="sr">Edit</span></th></tr></thead><tbody>{t.teams.map((x) => (
          <tr key={x.id}><td><strong>{x.name}</strong></td><td>{x.lead_name || <span className="muted">None</span>}</td><td>{x.members.length ? x.members.slice(0, 4).map((m) => m.name).join(", ") + (x.members.length > 4 ? ` +${x.members.length - 4}` : "") : <span className="muted">Nobody yet</span>}</td><td>{x.members.some((m) => m.staff_code) ? <Pill tone="good">On</Pill> : <span className="small muted">Give its people a CSC or RM code</span>}</td>
            <td className="us-act"><Btn onClick={() => { setErr(""); setEd({ id: x.id, name: x.name, lead: x.lead_id ? String(x.lead_id) : "", members: x.members.map((m) => String(m.id)) }); }} aria-label={`Edit ${x.name}`}>Edit</Btn></td></tr>))}</tbody></Table>)}
      {ed && <Modal title={ed.id ? "Edit team" : "Add team"} onClose={() => setEd(null)}><div className="stack">
        <Labeled label="Team name" htmlFor="tmx-name" req><input id="tmx-name" maxLength={60} value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} /></Labeled>
        {people.length ? <Ticks legend="People" options={people.map((m) => ({ value: String(m.id), label: m.active ? m.name : `${m.name} (switched off)` }))} value={ed.members} onChange={(v) => setEd({ ...ed, members: v })} /> : <p className="muted small">Nobody has joined yet. You can add people later.</p>}
        <Labeled label="Lead" htmlFor="tmx-lead" hint="Optional. One of the people ticked above."><Select id="tmx-lead" value={ed.members.includes(ed.lead) ? ed.lead : ""} onChange={(v) => setEd({ ...ed, lead: v })} placeholder="No lead" options={ed.members.map((id) => ({ value: id, label: name(id) || id }))} /></Labeled>
        {err && <p className="err-text" role="alert">{err}</p>}
        <div className="row between wrap gap-s"><div className="row gap-s"><Btn kind="primary" onClick={save}>Save team</Btn><Btn onClick={() => setEd(null)}>Cancel</Btn></div>{ed.id && <AskFirst label="Delete team" question={`Delete ${ed.name}? Its people and their work stay.`} yes="Delete" onYes={async () => { const r = await removeTeam(ed.id); if (!r.ok) return setErr(why(r)); toast("Team deleted"); setEd(null); load(); }} />}</div>
      </div></Modal>}
    </div>
  );
}

export function UsersPage({ onInvite, onChanged }) {
  const { toast, db, go } = useApp();
  const [tab, setTab] = useState("people");
  const [t, setT] = useState(null);
  const load = () => listTeam().then((r) => { setT(r.ok ? { teams: [], roles: DEFAULT_ROLES, access: false, owner: true, ownerInfo: null, ...r.body } : r.status === 503 ? "setup" : "error"); onChanged?.(); });
  useEffect(() => { load(); window.addEventListener("corp-users", load); return () => window.removeEventListener("corp-users", load); }, []);
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Users</h1><p className="muted">{t?.org ? <>{t.org.name} · OrgID <span className="mono">{t.org.code}</span></> : "Who can sign in, and what they can do."}</p></div><Btn kind="primary" onClick={onInvite}>Invite user</Btn></header>
      {t === null ? <p className="muted" role="status">Loading...</p> : t === "setup" ? <Empty title="Employee logins are not switched on yet">IndSure is still setting them up on the server.</Empty> : t === "error" ? <p className="err-text" role="alert">The users could not be loaded. Try again.</p> : <>
        <Tabs tabs={[{ key: "people", label: "People", count: t.members.length + (t.ownerInfo ? 1 : 0) }, { key: "roles", label: "Roles", count: t.roles.length }, { key: "teams", label: "Teams", count: t.teams.length }]} value={tab} onChange={setTab} />
        {tab === "people" ? <People t={t} load={load} toast={toast} db={db} go={go} /> : !t.access ? <Empty title={`${tab === "roles" ? "Roles" : "Teams"} are not switched on yet`}>IndSure is still setting this up on the server.</Empty> : tab === "roles" ? <Roles t={t} load={load} toast={toast} /> : <Teams t={t} load={load} toast={toast} />}
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
