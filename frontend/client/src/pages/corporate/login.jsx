// Sign-in for the online portal. The local dev server has no login.
//   Employee: UserID + OrgID + their own 6-digit PIN      Owner: OrgID + password
// People who joined before organisations existed can still use their email and password.
import { useState, useEffect } from "react";
import { signIn, login, joinLook, joinAccept, changeSecret, currentUser } from "./store.js";
import { useApp, Modal, Btn } from "./ui.jsx";

const ORG_KEY = "indsure-commercial-org", USER_KEY = "indsure-commercial-user";
const remembered = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
const remember = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
const WHY = { limit: "Too many tries. Wait 15 minutes and try again.", down: "Could not reach IndSure just now. Check your internet and try again." };
const onlyDigits = (s) => s.replace(/\D/g, "").slice(0, 6);

function Field({ id, label, hint, ...rest }) {
  return <label className="corp-login-field" htmlFor={id}><span>{label}</span><input id={id} {...rest} />{hint && <span className="small muted corp-login-hint">{hint}</span>}</label>;
}

export function CorpLogin({ onDone, notice }) {
  const [mode, setMode] = useState("employee"); // employee | owner | email
  const [org, setOrg] = useState(remembered(ORG_KEY));
  const [user, setUser] = useState(remembered(USER_KEY));
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(notice || "");
  const pick = (m) => { setMode(m); setErr(""); setPin(""); setPassword(""); setShow(false); };
  const submit = async (e) => {
    e.preventDefault();
    if (mode === "employee" && (!user.trim() || !org.trim() || pin.length !== 6)) return setErr("Enter your UserID, OrgID and 6-digit PIN.");
    if (mode === "owner" && (!org.trim() || !password)) return setErr("Enter your OrgID and password.");
    if (mode === "email" && (!email.trim() || !password)) return setErr("Enter your email and password.");
    setBusy(true); setErr("");
    const r = mode === "email" ? await login(email.trim(), password) : await signIn(mode === "owner" ? { org: org.trim(), password } : { org: org.trim(), user: user.trim(), pin });
    setBusy(false);
    if (r.ok) { if (mode !== "email") remember(ORG_KEY, org.trim().toUpperCase()); if (mode === "employee") remember(USER_KEY, user.trim().toUpperCase()); setPin(""); setPassword(""); onDone(); return; }
    setPin("");
    setErr(WHY[r.reason] || (mode === "employee" ? "Those details are not right. After 5 wrong tries the login is locked for 15 minutes." : mode === "owner" ? "That OrgID or password is not right." : "That email or password is not right."));
  };
  return (
    <main className="corp-login">
      <form className="corp-login-card" onSubmit={submit} noValidate>
        <h1>IndSure Commercial</h1>
        <p className="muted">Sign in to your records.</p>
        {mode !== "email" && <div className="seg corp-login-seg" role="radiogroup" aria-label="Sign in as">
          {[["employee", "Employee"], ["owner", "Owner"]].map(([k, l]) => <button key={k} id={`cl-as-${k}`} type="button" role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => pick(k)}>{l}</button>)}
        </div>}
        {mode === "employee" && <>
          <Field id="cl-user" label="UserID" autoComplete="username" autoCapitalize="characters" spellCheck={false} value={user} onChange={(e) => setUser(e.target.value)} placeholder="SITA12345" />
          <Field id="cl-org" label="OrgID" autoComplete="organization" autoCapitalize="characters" spellCheck={false} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="IC12345" />
          <Field id="cl-pin" label="PIN" type={show ? "text" : "password"} inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))} hint="Your own 6-digit PIN" />
        </>}
        {mode === "owner" && <>
          <Field id="cl-org" label="OrgID" autoComplete="username" autoCapitalize="characters" spellCheck={false} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="IC12345" />
          <Field id="cl-password" label="Password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </>}
        {mode === "email" && <>
          <Field id="cl-email" label="Email" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field id="cl-password" label="Password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </>}
        <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show {mode === "employee" ? "PIN" : "password"}</label>
        {err && <p className="err-text" role="alert">{err}</p>}
        <button type="submit" className="btn btn-primary corp-login-btn" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        {mode === "email" ? <button id="cl-back" type="button" className="linkbtn small" onClick={() => pick("employee")}>Sign in with an OrgID instead</button>
          : <button id="cl-legacy" type="button" className="linkbtn small" onClick={() => pick("email")}>I sign in with an email and password</button>}
        <p className="small muted">{mode === "owner" ? "Forgot the password? Ask IndSure for a new setup link." : mode === "employee" ? "Forgot your PIN or UserID? Ask your owner to send you a new PIN link." : ""}</p>
      </form>
    </main>
  );
}

// ---- Opened from an invite link: /corporate#join=<token>
const ROLE_WORDS = { ops: "Operations / BD", accounts: "Accounts", admin: "Admin", readonly: "Read-only" };
export const joinToken = () => { const m = /[#&]join=([\w-]{20,})/.exec(typeof location !== "undefined" ? location.hash : ""); return m ? m[1] : ""; };
const dropToken = () => { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* keep the address */ } };

export function JoinPage({ token, onDone }) {
  const [inv, setInv] = useState(null);
  const [dead, setDead] = useState("");
  const [f, setF] = useState({ name: "", designation: "", departments: [], pin: "", pin2: "", password: "", password2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  useEffect(() => { joinLook(token).then((r) => { if (r.ok) { setInv(r.body); setF((x) => ({ ...x, name: r.body.name || "" })); } else setDead(r.status === 410 ? r.body?.error : WHY[r.status === 429 ? "limit" : "down"]); }); }, [token]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dept = (d) => setF({ ...f, departments: f.departments.includes(d) ? f.departments.filter((x) => x !== d) : [...f.departments, d] });
  const submit = async (e) => {
    e.preventDefault();
    if (inv.kind !== "pin" && !f.name.trim()) return setErr("Enter your name.");
    if (inv.kind === "join" && !f.designation.trim()) return setErr("Enter your designation.");
    if (inv.kind === "join" && !f.departments.length) return setErr("Choose the departments you work in.");
    if (inv.kind === "owner") { if (f.password.length < 10) return setErr("The password needs at least 10 characters."); if (f.password !== f.password2) return setErr("The two passwords are not the same."); }
    else { if (f.pin.length !== 6) return setErr("The PIN is 6 digits."); if (f.pin !== f.pin2) return setErr("The two PINs are not the same."); }
    setBusy(true); setErr("");
    const r = await joinAccept({ token, name: f.name.trim(), designation: f.designation.trim(), departments: f.departments, pin: f.pin, password: f.password });
    setBusy(false);
    if (!r.ok) return r.status === 410 ? setDead(r.body?.error) : setErr(r.body?.error || WHY[r.status === 429 ? "limit" : "down"]);
    dropToken(); remember(ORG_KEY, r.body.user.code); if (r.body.userCode) remember(USER_KEY, r.body.userCode);
    setDone(r.body);
  };
  if (dead) return <main className="corp-login"><div className="corp-login-card"><h1>This link does not work</h1><p role="alert">{dead}</p><button type="button" className="btn btn-primary corp-login-btn" onClick={() => { dropToken(); onDone(); }}>Go to sign in</button></div></main>;
  if (!inv) return <main className="corp-login"><p role="status">Opening your invite...</p></main>;
  if (done) return (
    <main className="corp-login"><div className="corp-login-card" data-joined>
      <h1>You are set up</h1>
      <p>Note these down. They are also on their way to {done.user.email}.</p>
      <dl className="corp-ids">{done.userCode && <><dt>UserID</dt><dd>{done.userCode}</dd></>}<dt>OrgID</dt><dd>{done.user.code}</dd></dl>
      <p className="muted small">Sign in as {done.user.kind === "owner" ? "Owner with this OrgID and your password" : "Employee with both of these and your PIN"}.</p>
      <button type="button" className="btn btn-primary corp-login-btn" onClick={onDone}>Open the portal</button>
    </div></main>
  );
  return (
    <main className="corp-login">
      <form className="corp-login-card corp-join" onSubmit={submit} noValidate>
        <h1>{inv.kind === "owner" ? "Set up your organisation" : inv.kind === "pin" ? "Set a new PIN" : `Join ${inv.orgName}`}</h1>
        <p className="muted">{inv.kind === "owner" ? <>You are the owner of <strong>{inv.orgName}</strong> (OrgID {inv.orgCode}).</> : inv.kind === "pin" ? <>For {inv.name}, UserID {inv.userCode}.</> : <>You are joining as <strong>{ROLE_WORDS[inv.role]}</strong>, with {inv.email}.</>}</p>
        {inv.kind !== "pin" && <Field id="jn-name" label="Your name" autoComplete="name" value={f.name} onChange={set("name")} />}
        {inv.kind === "join" && <>
          <Field id="jn-desig" label="Designation" autoComplete="organization-title" value={f.designation} onChange={set("designation")} placeholder="For example, Executive, Motor" />
          <fieldset className="corp-depts"><legend>Departments you work in</legend>{inv.departments.map((d) => <label key={d} className="check"><input type="checkbox" checked={f.departments.includes(d)} onChange={() => dept(d)} /> {d}</label>)}</fieldset>
        </>}
        {inv.kind === "owner" ? <>
          <Field id="jn-pass" label="Password" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} hint="At least 10 characters" />
          <Field id="jn-pass2" label="Password again" type="password" autoComplete="new-password" value={f.password2} onChange={set("password2")} />
        </> : <>
          <Field id="jn-pin" label="Choose a 6-digit PIN" type="password" inputMode="numeric" autoComplete="new-password" value={f.pin} onChange={(e) => setF({ ...f, pin: onlyDigits(e.target.value) })} hint="Only you should know it. Not your birthday or 123456." />
          <Field id="jn-pin2" label="PIN again" type="password" inputMode="numeric" autoComplete="new-password" value={f.pin2} onChange={(e) => setF({ ...f, pin2: onlyDigits(e.target.value) })} />
        </>}
        {err && <p className="err-text" role="alert">{err}</p>}
        <button type="submit" className="btn btn-primary corp-login-btn" disabled={busy}>{busy ? "Saving..." : inv.kind === "pin" ? "Save the new PIN" : "Finish"}</button>
      </form>
    </main>
  );
}

// ---- Who is signed in, and changing one's own PIN or password
export function MySignIn({ onClose }) {
  const { toast } = useApp();
  const u = currentUser();
  const pinKind = u.kind === "member";
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: pinKind ? onlyDigits(e.target.value) : e.target.value });
  const save = async () => {
    if (!f.current || !f.next) return setErr(pinKind ? "Enter your current PIN and a new one." : "Enter your current password and a new one.");
    if (f.next !== f.again) return setErr(pinKind ? "The two new PINs are not the same." : "The two new passwords are not the same.");
    const r = await changeSecret(f.current, f.next);
    if (!r.ok) return setErr(r.body?.error || "It could not be changed. Try again.");
    toast(pinKind ? "PIN changed" : "Password changed"); onClose();
  };
  return (
    <Modal title="My sign-in" onClose={onClose}>
      <dl className="corp-ids"><dt>Name</dt><dd>{u.name}</dd>{u.orgName && <><dt>Organisation</dt><dd>{u.orgName}</dd><dt>OrgID</dt><dd>{u.code}</dd></>}{u.designation && <><dt>Designation</dt><dd>{u.designation}</dd></>}{u.departments?.length > 0 && <><dt>Departments</dt><dd>{u.departments.join(", ")}</dd></>}</dl>
      {u.kind === "legacy" ? <p className="muted small">You sign in with {u.email}. Ask your Admin to change the password.</p> : <>
        <Field id="ms-cur" label={pinKind ? "Current PIN" : "Current password"} type="password" inputMode={pinKind ? "numeric" : undefined} value={f.current} onChange={set("current")} />
        <Field id="ms-next" label={pinKind ? "New 6-digit PIN" : "New password"} type="password" inputMode={pinKind ? "numeric" : undefined} value={f.next} onChange={set("next")} />
        <Field id="ms-again" label={pinKind ? "New PIN again" : "New password again"} type="password" inputMode={pinKind ? "numeric" : undefined} value={f.again} onChange={set("again")} />
        {err && <p className="err-text" role="alert">{err}</p>}
        <div className="row gap-s"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={save}>{pinKind ? "Change PIN" : "Change password"}</Btn></div>
      </>}
    </Modal>
  );
}
