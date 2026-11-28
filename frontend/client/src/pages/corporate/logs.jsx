// Logs: the owner's view of who signed in and what they changed. Owner only; the server refuses everyone else.
import { useEffect, useRef, useState } from "react";
import { useApp, Btn, Labeled, Select, Table, Pill, Empty, DateInput } from "./ui.jsx";
import { fmtStamp, toCsv } from "./lib.js";
import { localStamp } from "./confidence.js";
import { fetchLogs } from "./store.js";

const KINDS = { records: "Records", signins: "Sign-ins", users: "Users and roles" };
const MAX_CSV = 10000;
const stamp = (t) => fmtStamp(localStamp(+new Date(t)));

export function LogsPage({ person }) {
  const { db, go, toast } = useApp();
  const FRESH = { person: "", kind: "", from: "", to: "", q: "" };
  const [f, setF] = useState({ ...FRESH, person: person || "" });
  const [d, setD] = useState(null);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState("");
  const turn = useRef(0);
  const badRange = f.from && f.to && f.to < f.from;
  useEffect(() => {
    if (badRange) return;
    const me = ++turn.current;
    const wait = setTimeout(async () => {
      const r = await fetchLogs(f);
      if (me !== turn.current) return;
      if (r.ok && Array.isArray(r.body?.rows)) { setD(r.body); setErr(""); } else setErr(r.status === 403 ? "Only the owner can see the logs." : r.status === 404 || r.status === 503 ? "IndSure is still setting this up on the server." : "The logs could not be loaded. Try again.");
    }, f.q ? 300 : 0);
    return () => clearTimeout(wait);
  }, [JSON.stringify(f)]);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const next = async () => { const me = turn.current; setMore(true); const r = await fetchLogs({ ...f, after: d.next }); setMore(false); if (me !== turn.current) return; if (r.ok) setD({ ...r.body, rows: [...d.rows, ...r.body.rows] }); else toast("More could not be loaded. Try again.", "bad"); };
  const about = (x) => { const p = x.policyId && db.policies.find((y) => y.id === x.policyId), c = db.customers.find((y) => y.id === (p ? p.customerId : x.customerId)); return p ? { label: `${c?.name || ""}, ${p.type}`, to: { view: "policy", id: p.id } } : c ? { label: c.name, to: { view: "customer", id: c.id } } : null; };
  const csv = async () => {
    setMore(true);
    let rows = [], after = "", r;
    do { r = await fetchLogs({ ...f, after }); if (!r.ok) { setMore(false); return toast("The download did not finish. Try again.", "bad"); } rows = rows.concat(r.body.rows); after = r.body.next; } while (after && rows.length < MAX_CSV);
    setMore(false);
    // A cell that starts like a formula must not run as one in Excel.
    const safe = (x) => (/^[=+\-@]/.test(String(x)) ? "'" + x : x);
    const url = URL.createObjectURL(new Blob(["\ufeff" + toCsv([], ["When", "Who", "Type", "What", "About", "Details"], rows.map((x) => [stamp(x.at), x.who, KINDS[x.kind], x.what, about(x)?.label || "", x.detail].map(safe)))], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "commercial-logs.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(after ? `Downloaded the newest ${rows.length} lines. Narrow the dates for older ones.` : `Downloaded ${rows.length} lines`);
  };
  const people = d?.people || [];
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Logs</h1><p className="muted">Who signed in and what they changed. Only you, the owner, can see this.</p></div><Btn onClick={csv} disabled={!d?.rows.length || more} why="Nothing to download">Download CSV</Btn></header>
      <div className="filters">
        <Labeled label="Person" htmlFor="lg-person"><Select id="lg-person" value={f.person} onChange={set("person")} placeholder="Everyone" options={people.map((x) => ({ value: x.key, label: x.name }))} /></Labeled>
        <Labeled label="Type" htmlFor="lg-kind"><Select id="lg-kind" value={f.kind} onChange={set("kind")} placeholder="Everything" options={Object.entries(KINDS).map(([value, label]) => ({ value, label }))} /></Labeled>
        <Labeled label="From" htmlFor="lg-from"><DateInput id="lg-from" value={f.from} onChange={(e) => set("from")(e.target.value)} /></Labeled>
        <Labeled label="To" htmlFor="lg-to" error={badRange ? "End is before start" : null}><DateInput id="lg-to" value={f.to} onChange={(e) => set("to")(e.target.value)} /></Labeled>
        <Labeled label="Search" htmlFor="lg-q"><input id="lg-q" type="search" value={f.q} onChange={(e) => set("q")(e.target.value)} placeholder="Name, change or detail" /></Labeled>
        <div className="fld"><Btn onClick={() => setF(FRESH)} disabled={JSON.stringify(f) === JSON.stringify(FRESH)} why="No filters set">Clear filters</Btn></div>
      </div>
      {err && <p className="err-text" role="alert">{err}</p>}
      {!d ? !err && <p className="muted" role="status">Loading...</p> : !d.rows.length ? <Empty title="Nothing found">Try a wider date range or clear the filters.</Empty> : <>
        <Table className="us-table"><thead><tr><th>When</th><th>Who</th><th>What</th><th>About</th><th>Details</th></tr></thead><tbody>{d.rows.map((x) => { const a = about(x); return (
          <tr key={x.id}><td className="nowrap">{stamp(x.at)}</td><td className="nowrap">{x.who}</td><td>{/failed|refused/i.test(x.what) && x.kind === "signins" ? <Pill tone="bad">{x.what}</Pill> : x.what}</td><td>{a ? <button type="button" className="linkbtn" onClick={() => go(a.to)}>{a.label}</button> : <span className="muted">{KINDS[x.kind]}</span>}</td><td className="small lg-det">{x.detail}</td></tr>); })}</tbody></Table>
        {d.next && <div><Btn onClick={next} disabled={more}>{more ? "Loading..." : "Show more"}</Btn></div>}
      </>}
    </div>
  );
}
