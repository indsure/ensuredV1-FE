// Masters > Logins: who can sign in and with which role. Admin only, and only on the online portal.
import { useEffect, useState } from "react";
import { useApp, Card, Btn, Labeled, Select, Table, Pill, Empty } from "./ui.jsx";
import { fmtStamp } from "./lib.js";
import { listLogins, addLogin, changeLogin } from "./store.js";

const ROLE_OPTIONS = [{ value: "ops", label: "Operations / BD (CSC)" }, { value: "accounts", label: "Accounts" }, { value: "admin", label: "Admin" }, { value: "readonly", label: "Read-only" }];
const roleLabel = (r) => ROLE_OPTIONS.find((x) => x.value === r)?.label || r;

export function LoginsTab() {
  const { toast } = useApp();
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ name: "", email: "", role: "ops", password: "" });
  const [err, setErr] = useState("");
  const [reset, setReset] = useState(null);
  const load = () => listLogins().then(setRows).catch(() => setRows("error"));
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!f.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { setErr("Enter a name and a valid email."); return; }
    if (f.password.length < 8) { setErr("The password needs at least 8 characters."); return; }
    const r = await addLogin({ ...f, email: f.email.trim(), name: f.name.trim() });
    if (!r.ok) { setErr(r.status === 409 ? "That email already has a login." : "It could not be saved. Try again."); return; }
    setF({ name: "", email: "", role: "ops", password: "" }); setErr(""); toast("Login added. Share the password with them privately."); load();
  };
  const change = async (email, patch, msg) => { const r = await changeLogin(email, patch); toast(r.ok ? msg : "It could not be saved. Try again.", r.ok ? undefined : "bad"); if (r.ok) load(); return r.ok; };
  return (
    <div className="stack">
      <Card title="Add a login" sub="Each person gets their own, so the history shows who did what.">
        <div className="filters">
          <Labeled label="Name" htmlFor="lg-name"><input id="lg-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Labeled>
          <Labeled label="Email" htmlFor="lg-email"><input id="lg-email" type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Labeled>
          <Labeled label="Role" htmlFor="lg-role"><Select id="lg-role" value={f.role} onChange={(v) => setF({ ...f, role: v })} options={ROLE_OPTIONS} /></Labeled>
          <Labeled label="Password" htmlFor="lg-pass" hint="At least 8 characters"><input id="lg-pass" type="text" autoComplete="off" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Labeled>
          <div className="fld"><Btn kind="primary" onClick={add}>Add login</Btn></div>
        </div>
        {err && <p className="err-text" role="alert">{err}</p>}
      </Card>
      <Card title="Logins">
        {rows === null ? <p className="muted" role="status">Loading...</p> : rows === "error" ? <p className="err-text" role="alert">The logins could not be loaded. Try again.</p> : !rows.length ? <Empty title="No other logins yet" /> : (
          <Table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last signed in</th><th>Status</th><th /></tr></thead>
            <tbody>{rows.map((u) => (
              <tr key={u.email}>
                <td>{u.name}</td><td>{u.email}</td>
                <td><select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => change(u.email, { role: e.target.value }, `Role changed to ${roleLabel(e.target.value)}`)}>{ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                <td className="small">{u.last_login ? fmtStamp(new Date(u.last_login).toISOString()) : "Never"}</td>
                <td><Pill tone={u.active ? "good" : "muted"}>{u.active ? "Active" : "Switched off"}</Pill></td>
                <td><div className="row gap-xs wrap">
                  <Btn onClick={() => change(u.email, { active: !u.active }, u.active ? "Login switched off" : "Login switched on")}>{u.active ? "Switch off" : "Switch on"}</Btn>
                  <Btn onClick={() => setReset({ email: u.email, name: u.name, password: "" })}>New password</Btn>
                </div></td>
              </tr>
            ))}</tbody></Table>
        )}
        {reset && (
          <div className="row gap-s wrap" style={{ marginTop: 12 }}>
            <Labeled label={`New password for ${reset.name}`} htmlFor="lg-reset" hint="At least 8 characters"><input id="lg-reset" type="text" autoComplete="off" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} /></Labeled>
            <Btn kind="primary" disabled={reset.password.length < 8} onClick={async () => { if (await change(reset.email, { password: reset.password }, "Password changed")) setReset(null); }}>Save password</Btn>
            <Btn onClick={() => setReset(null)}>Cancel</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}
