// Sign-in for the built portal (beta). The local dev server has no login.
import { useState } from "react";
import { login } from "./store.js";

export function CorpLogin({ onDone, notice }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(notice || "");
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setErr("Enter your email and password."); return; }
    setBusy(true); setErr("");
    const r = await login(email.trim(), password);
    setBusy(false);
    if (r.ok) { setPassword(""); onDone(); return; }
    setErr(r.reason === "wrong" ? "That email or password is not right." : r.reason === "limit" ? "Too many tries. Wait 15 minutes and try again." : "Could not reach IndSure just now. Check your internet and try again.");
  };
  return (
    <main className="corp-login">
      <form className="corp-login-card" onSubmit={submit} noValidate>
        <h1>IndSure Commercial</h1>
        <p className="muted">Sign in to your records.</p>
        <label className="corp-login-field" htmlFor="cl-email"><span>Email</span>
          <input id="cl-email" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="corp-login-field" htmlFor="cl-password"><span>Password</span>
          <input id="cl-password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password</label>
        {err && <p className="err-text" role="alert">{err}</p>}
        <button type="submit" className="btn btn-primary corp-login-btn" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
