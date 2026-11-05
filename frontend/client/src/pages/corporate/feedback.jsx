// "Report a problem": goes straight to the IndSure team. Keeps the page and role with it, so nobody has
// to describe where they were. Records are never sent with it.
import { useState } from "react";
import { useApp, Card, Btn, Labeled } from "./ui.jsx";
import { sendFeedback, saveFile } from "./store.js";

export function FeedbackPage({ page }) {
  const { toast } = useApp();
  const [kind, setKind] = useState("problem");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState("");
  const submit = async () => {
    setTried(true); setErr("");
    if (!message.trim()) return;
    setBusy(true);
    const fileId = file ? await saveFile(file) : null;
    const r = await sendFeedback({ kind, message: message.trim(), page, fileId });
    setBusy(false);
    if (!r.ok) { setErr("It could not be sent. Check your internet and try again. What you typed is still here."); return; }
    setDone(r.id || true); setMessage(""); setFile(null); setTried(false);
    toast("Sent to the IndSure team");
  };
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Report a problem</h1><p className="muted">Tell us what went wrong or what would help. It goes straight to the IndSure team.</p></div></header>
      {done && <div className="note" role="status"><strong>Thank you, we have it.</strong>{done !== true && <> Your report number is {done}.</>} <button className="linkbtn" onClick={() => setDone(null)}>Send another</button></div>}
      {!done && (
        <Card title="Your message">
          <div className="formgrid">
            <fieldset className="fld radios fld-wide"><legend>What is this about?</legend>
              <label className="check"><input type="radio" name="fb-kind" checked={kind === "problem"} onChange={() => setKind("problem")} /> Something is not working</label>
              <label className="check"><input type="radio" name="fb-kind" checked={kind === "idea"} onChange={() => setKind("idea")} /> An idea or a request</label>
            </fieldset>
            <Labeled label="What happened?" htmlFor="fb-msg" req wide error={tried && !message.trim() ? "Tell us what happened" : null} hint="What you did, what you expected, and what you saw. Please leave out customer details you do not need to share.">
              <textarea id="fb-msg" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Labeled>
            <Labeled label="Screenshot (optional)" htmlFor="fb-file" wide hint="JPG or PNG. Check it does not show anything you would rather not send.">
              <input id="fb-file" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={(e) => setFile(e.target.files[0] || null)} />
            </Labeled>
          </div>
          {err && <p className="err-text" role="alert">{err}</p>}
          <div className="row gap-s" style={{ marginTop: 12 }}><Btn kind="primary" disabled={busy} onClick={submit}>{busy ? "Sending..." : "Send to IndSure"}</Btn></div>
        </Card>
      )}
    </div>
  );
}
