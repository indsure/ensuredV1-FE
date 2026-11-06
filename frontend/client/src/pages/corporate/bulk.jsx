// Bulk upload and the Drafts page. Files are read one at a time and wait as drafts: nothing counts in reports,
// and no customer is created, until someone approves it.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useApp, Card, Btn, Empty, Labeled, Pill, SearchPick, Select, Table, AskFirst, Icon } from "./ui.jsx";
import { FIELDS } from "./data.js";
import { readPolicyPdf, ReadError } from "./extract.js";
import { saveFile, loadTexts, docText } from "./store.js";
import { fmtStamp, fmtMoney, activePreset, nowIso } from "./lib.js";
import { suggestFromDocument, createPolicy, cleanInsurer } from "./add.jsx";
import { sameName } from "./review.jsx";
import { placeOf } from "./places.js";

// ---- The reading queue lives outside the page, so moving to another page does not stop it.
let rows = [];
let busy = false;
let app = null;
let snap = { rows, busy };
const subs = new Set();
const emit = () => { snap = { rows: [...rows], busy }; subs.forEach((f) => f()); };
export const bindBulk = (ctx) => { app = ctx; };
export const bulkBusy = () => busy;
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

const keep = (fx, fileId, who) => ({
  fileName: fx.fileName, fileSize: fx.fileSize, fileId: fileId || null, at: nowIso(), by: who, ocr: !!fx.ocr, noText: !!fx.noText,
  pages: fx.pages, readPages: fx.readPages, fields: fx.fields, info: fx.info, customer: fx.customer, other: fx.other || [], lines: fx.lines,
});

async function run() {
  if (busy) return;
  busy = true; emit();
  for (let row = rows.find((r) => r.state === "waiting"); row; row = rows.find((r) => r.state === "waiting")) {
    row.state = "reading"; row.msg = "Reading..."; emit();
    try {
      const fx = await readPolicyPdf(row.file, (p, n, ocr) => { row.msg = ocr ? `Scan, page ${p} of ${n}` : `Page ${p} of ${n}`; emit(); });
      const fileId = await saveFile(row.file);
      let id;
      app.update((d) => {
        d.inbox = d.inbox || [];
        id = `IN${++d.seq}`;
        d.inbox.push({ id, ...keep(fx, fileId, app.who) });
        app.log(d, { action: "Draft added by bulk upload", detail: fx.fileName });
      });
      row.state = fx.noText ? "attention" : "done";
      row.msg = fx.noText ? "No text found. Open it and type the values." : fx.ocr ? "Read as a scan. Needs checking." : "Read";
    } catch (e) {
      row.state = "failed";
      row.msg = e instanceof ReadError ? e.message : "Could not read this file.";
    }
    row.file = null; emit();
  }
  busy = false; emit();
}
export function addBulkFiles(files) {
  rows = [...rows.filter((r) => r.state !== "done"), ...[...files].map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, name: file.name, file, state: "waiting", msg: "Waiting" }))];
  emit(); run();
}

// ---- What a draft still needs
const words = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/\b(m\/s|the|pvt|private|ltd|limited|llp|co|company|inc)\b/g, " ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
const looksAlike = (a, b) => { const x = new Set(words(a)), y = new Set(words(b)); if (!x.size || !y.size) return false; const both = [...x].filter((w) => y.has(w)).length; return both / new Set([...x, ...y]).size >= 0.6; };
// Is renewable and brokerage are answered once for the batch, so they are left out of this list.
const NEEDED = FIELDS.filter((f) => f.req && !["renewable", "bookDate", "brokeragePct"].includes(f.key));

export function checkDraft(db, item, lines) {
  const fx = { ...item, lines: lines || [] };
  const guess = suggestFromDocument(db, fx);
  const must = [], warn = [];
  if (item.noText) must.push("No text could be read");
  if (item.ocr) must.push("Read from a scan: open it to check");
  const missing = NEEDED.filter((f) => !item.fields?.[f.key]);
  if (missing.length) must.push(`Not found: ${missing.map((f) => f.label).join(", ")}`);
  // Only the values a record cannot do without hold it back. Optional ones can be checked later.
  const low = NEEDED.filter((f) => item.fields?.[f.key]?.conf === "low").length;
  if (low && !item.ocr) must.push(`${low} value${low === 1 ? "" : "s"} to check`);
  if (!guess.insurerId) must.push(item.info?.insurer ? "Insurer not in your list" : "Insurer not found");
  else if (!guess.branchId) must.push("Branch not in your list");
  if (!guess.type) must.push("Policy type not found");
  if (!guess.customerId) {
    if (!guess.insuredName) must.push("Insured name not found");
    else {
      if (!guess.city) must.push("City not found");
      const alike = db.customers.find((c) => looksAlike(c.name, guess.insuredName));
      if (alike) warn.push(`Looks like your customer ${alike.name}`);
    }
  }
  const no = item.fields?.policyNo?.v;
  if (no && db.terms.some((t) => t.values?.policyNo === no)) warn.push(`Policy number ${no} is already in your register`);
  if (no && (db.inbox || []).some((x) => x.id !== item.id && x.fields?.policyNo?.v === no)) warn.push(`Policy number ${no} is on another draft`);
  if (item.fileId && (db.documents.some((d) => d.userFile?.fileId === item.fileId) || (db.inbox || []).some((x) => x.id !== item.id && x.fileId === item.fileId))) warn.push("This same file was uploaded before");
  if (guess.customerId && guess.type) {
    const earlier = db.policies.find((p) => p.customerId === guess.customerId && p.type === guess.type);
    if (earlier) warn.push(`Could be a renewal of ${earlier.controlNo}: if so, use Renew on that policy`);
  }
  return { guess, must, warn, clean: !must.length && !warn.length };
}

export function BulkPage() {
  const { can, go, db } = useApp();
  const q = useSyncExternalStore(subscribe, () => snap);
  const [over, setOver] = useState(false);
  if (!can("newBusiness")) return <Empty title="Your role cannot add policies" />;
  const count = (s) => q.rows.filter((r) => r.state === s).length;
  const left = count("waiting") + count("reading");
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Bulk upload</h1><p className="muted">Drop many policies at once. They wait in Drafts until you approve them. Nothing counts in reports until then.</p></div>
        <Btn kind="primary" onClick={() => go({ view: "drafts" })}>Open Drafts ({(db.inbox || []).length})</Btn></header>
      <div className={`attach ${over ? "attach-over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); addBulkFiles(e.dataTransfer.files); }}>
        <input id="bulk-files" className="sr" type="file" multiple accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(e) => { addBulkFiles(e.target.files); e.target.value = ""; }} />
        <label htmlFor="bulk-files" className="dropzone">
          <span className="dz-icon"><Icon name="upload" size={26} /></span>
          <span className="attach-label">Choose or drop policy files</span>
          <span className="dz-sub">PDFs and photos, as many as you like</span>
          <span className="small muted">The insurer's PDFs take a few seconds each. Scans take up to a minute each. Keep this tab open until it finishes; you can use other pages meanwhile.</span>
        </label>
      </div>
      {q.rows.length > 0 && (
        <Card title={left ? `Reading: ${left} left` : "Finished"} sub={left ? "Please keep this tab open." : `${count("done") + count("attention")} added to Drafts${count("failed") ? `, ${count("failed")} could not be read` : ""}.`}
          actions={!left && (count("done") + count("attention")) > 0 ? <Btn kind="primary" onClick={() => go({ view: "drafts" })}>Go to Drafts</Btn> : null}>
          <Table><thead><tr><th>File</th><th>Status</th></tr></thead>
            <tbody>{q.rows.map((r) => <tr key={r.key}><td>{r.name}</td><td><Pill tone={r.state === "done" ? "good" : r.state === "failed" ? "bad" : r.state === "attention" ? "warn" : "muted"}>{r.state === "done" ? "Added" : r.state === "failed" ? "Failed" : r.state === "attention" ? "Needs attention" : r.state === "reading" ? "Reading" : "Waiting"}</Pill> <span className="small muted">{r.msg}</span></td></tr>)}</tbody></Table>
        </Card>
      )}
    </div>
  );
}

// ---- Drafts
export function DraftsPage() {
  const ctx = useApp();
  const { db, can, go, update, log, toast, who } = ctx;
  const inbox = db.inbox || [];
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all");
  const [picked, setPicked] = useState({});
  const [ans, setAns] = useState({ renewable: "", cse: "", rate: "", ok: false });
  const [err, setErr] = useState("");
  useEffect(() => { let on = true; setReady(false); loadTexts(inbox.map((x) => x.id)).finally(() => on && setReady(true)); return () => { on = false; }; }, [inbox.length]);
  const rows = useMemo(() => inbox.map((item) => ({ item, ...checkDraft(db, item, docText(item)) })), [db, ready]);
  const shown = rows.filter((r) => {
    if (show === "clean" && !r.clean) return false;
    if (show === "check" && r.clean) return false;
    const t = q.trim().toLowerCase();
    return !t || [r.item.fileName, r.guess.insuredName, r.item.fields?.policyNo?.v, r.item.info?.insurer, r.guess.type].join(" ").toLowerCase().includes(t);
  });
  const clean = rows.filter((r) => r.clean);
  const chosen = clean.filter((r) => picked[r.item.id]);
  const anyNew = chosen.some((r) => !r.guess.customerId);
  const noRate = chosen.filter((r) => !activePreset(db, r.guess.insurerId, r.guess.type));
  const team = db.team.filter((t) => t.role === "CSC" && t.active !== false).map((t) => ({ value: t.code, label: `${t.name} (${t.code})` }));
  const saved = db.terms.filter((t) => t.status === "draft");
  const remove = (id) => { update((d) => { const it = (d.inbox || []).find((x) => x.id === id); d.inbox = (d.inbox || []).filter((x) => x.id !== id); log(d, { action: "Draft deleted", detail: it?.fileName || id }); }); toast("Draft deleted"); };
  const addInsurer = (r) => {
    const office = r.item.info?.branch;
    update((d) => {
      let ins = d.insurers.find((i) => i.id === r.guess.insurerId);
      const name = cleanInsurer(r.item.info?.insurer || "");
      if (!ins && name) { ins = { id: `INS${++d.seq}`, name, branches: [] }; d.insurers.push(ins); log(d, { action: "Insurer added", detail: `${name}, from ${r.item.fileName}.` }); }
      if (ins && office?.name && !ins.branches.some((b) => b.name.toLowerCase() === office.name.toLowerCase())) {
        const place = placeOf(office.city);
        ins.branches.push({ id: `BR${++d.seq}`, name: office.name, city: office.city || "", state: place?.state || "", country: place?.country || "India" });
        log(d, { action: "Branch added", detail: `${office.name}, from ${r.item.fileName}.` });
      }
    });
    toast("Added to your list");
  };
  const approve = () => {
    if (!chosen.length) return setErr("Tick the drafts to approve.");
    if (!ans.renewable) return setErr("Answer: are these policies renewable?");
    if (anyNew && !ans.cse) return setErr("Choose who looks after the new customers.");
    if (noRate.length && !(+ans.rate > 0)) return setErr(`${noRate.length} have no saved brokerage rate. Enter one.`);
    if (!ans.ok) return setErr("Tick that you have checked the brokerage.");
    setErr("");
    let done = 0;
    for (const r of chosen) {
      // Check again with the latest records: an earlier draft in this batch may have created this customer.
      const now = ctx.latest();
      const fx = { ...r.item, lines: docText(r.item) || [], extracted: true, title: r.item.fileName, textId: r.item.id };
      const check = checkDraft({ ...now, inbox: now.inbox.filter((x) => !chosen.some((c) => c.item.id === x.id)) }, r.item, fx.lines);
      const g = check.guess;
      if (check.must.length || !g.insurerId || !g.branchId) continue;
      const preset = activePreset(now, g.insurerId, g.type);
      const values = {}; const sources = {};
      FIELDS.forEach((f) => { const x = r.item.fields?.[f.key]; values[f.key] = x ? x.v : ""; if (x) sources[f.key] = { ref: x.ref, conf: x.conf, docLabel: "Document", note: x.note }; });
      values.bookDate = values.issueDate; sources.bookDate = { conf: "issue" };
      values.renewable = ans.renewable; sources.renewable = { conf: "manual" };
      values.brokeragePct = preset ? preset.pct : +ans.rate;
      sources.brokeragePct = preset ? { conf: "preset", version: preset.version, presetId: preset.presetId } : { conf: "manual" };
      values.brokerageOnNet = false; values.otherDetails = r.item.other || [];
      const pl = { values, sources, brokerageConfirmed: true, brokerageSnap: preset ? { presetId: preset.presetId, version: preset.version, pct: preset.pct } : null };
      const existing = now.customers.find((c) => c.id === g.customerId);
      const s = { customerId: g.customerId || "NEW", cse: existing?.cse || ans.cse, rm: existing?.rm || "", insurerId: g.insurerId, branchId: g.branchId, dept: g.dept, type: g.type, cover: "", vesselMode: "" };
      if (!s.cse) continue;
      const place = placeOf(g.city);
      const newCustomer = g.customerId ? null : (d) => {
        const cid = `C${++d.seq}`; const code = `CUST-${1000 + d.customers.length + 1}`;
        d.customers.push({ id: cid, code, name: g.insuredName, vertical: "Corporate", address: fx.customer?.address?.v || "", city: g.city, state: place?.state || "", country: place?.country || "India", phone: fx.customer?.phone?.v || "", email: fx.customer?.email?.v || "", gst: fx.customer?.gst?.v || "", source: "", referral: "", cse: s.cse, rm: "", tags: [], createdAt: nowIso() });
        log(d, { customerId: cid, action: "Customer created", detail: `${g.insuredName} created as ${code} from ${fx.fileName}.` });
        return cid;
      };
      createPolicy({ ...ctx, toast: () => {}, go: () => {} }, s, fx, pl, true, newCustomer);
      update((d) => { d.inbox = d.inbox.filter((x) => x.id !== r.item.id); });
      done++;
    }
    setPicked({}); setAns({ ...ans, ok: false });
    toast(done === chosen.length ? `${done} polic${done === 1 ? "y" : "ies"} approved` : `${done} of ${chosen.length} approved. The rest need opening.`, done === chosen.length ? undefined : "bad");
  };
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Drafts</h1><p className="muted">Everything waiting for approval. Open a draft to check it against the policy. Drafts do not count in reports.</p></div>
        {can("newBusiness") && <Btn kind="primary" onClick={() => go({ view: "bulk" })}>Bulk upload</Btn>}</header>
      {!inbox.length && !saved.length && <Empty title="No drafts">Files from Bulk upload wait here until someone approves them.</Empty>}
      {inbox.length > 0 && !ready && <p className="muted" role="status">Opening your drafts...</p>}
      {inbox.length > 0 && ready && (
        <>
          <div className="stats">
            <div className="stat"><span>Waiting</span><strong>{rows.length}</strong><em>From bulk upload</em></div>
            <div className="stat"><span>Ready to approve</span><strong>{clean.length}</strong><em>Read clearly, nothing missing</em></div>
            <div className="stat"><span>To open and check</span><strong>{rows.length - clean.length}</strong><em>Scans, gaps or something to look at</em></div>
          </div>
          {can("newBusiness") && clean.length > 0 && (
            <Card title="Approve together" sub="Only for drafts read clearly with nothing missing. Scans always need opening. Tick the drafts below, then answer these once for all of them.">
              <div className="filters">
                <Labeled label="Are these policies renewable?" htmlFor="bd-ren"><Select id="bd-ren" value={ans.renewable} onChange={(v) => setAns({ ...ans, renewable: v })} placeholder="Choose" options={["Yes", "No"]} /></Labeled>
                {anyNew && <Labeled label="Who looks after the new customers? (CSC)" htmlFor="bd-csc"><SearchPick id="bd-csc" value={ans.cse} onChange={(v) => setAns({ ...ans, cse: v })} options={team} noun="CSC" /></Labeled>}
                {noRate.length > 0 && <Labeled label={`Brokerage % for the ${noRate.length} with no saved rate`} htmlFor="bd-rate"><input id="bd-rate" inputMode="decimal" value={ans.rate} onChange={(e) => setAns({ ...ans, rate: e.target.value })} /></Labeled>}
              </div>
              <label className="check" style={{ marginTop: 8 }}><input id="bd-ok" type="checkbox" checked={ans.ok} onChange={(e) => setAns({ ...ans, ok: e.target.checked })} /> I have checked the brokerage on these policies</label>
              {err && <p className="err-text" role="alert">{err}</p>}
              <div className="row gap-s wrap" style={{ marginTop: 10 }}>
                <Btn onClick={() => setPicked(Object.fromEntries(clean.map((r) => [r.item.id, true])))}>Tick all {clean.length} ready</Btn>
                <Btn kind="primary" onClick={approve}>Approve {chosen.length || ""} ticked</Btn>
              </div>
            </Card>
          )}
          <div className="row gap-s wrap">
            <label className="grow"><span className="sr">Search drafts</span><input id="bd-search" type="search" placeholder="Search by insured, file, policy number or insurer" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            <label className="pillsel"><span className="sr">Show</span><select id="bd-show" value={show} onChange={(e) => setShow(e.target.value)}><option value="all">All drafts</option><option value="clean">Ready to approve</option><option value="check">To open and check</option></select></label>
          </div>
          {shown.length ? (
            <Table><thead><tr><th /><th>Insured</th><th>Policy</th><th>Added</th><th>Status</th><th /></tr></thead>
              <tbody>{shown.map((r) => (
                <tr key={r.item.id}>
                  <td>{r.clean && can("newBusiness") ? <input type="checkbox" aria-label={`Approve ${r.item.fileName}`} checked={!!picked[r.item.id]} onChange={(e) => setPicked({ ...picked, [r.item.id]: e.target.checked })} /> : null}</td>
                  <td>{r.guess.insuredName || <span className="muted">Not found</span>}{!r.guess.customerId && r.guess.insuredName && <div className="small muted">New customer</div>}<div className="small muted">{r.item.fileName}</div></td>
                  <td>{r.guess.type || <span className="muted">Type not found</span>}<div className="small muted">{r.item.fields?.policyNo?.v || "No policy number"}{r.item.fields?.netPremium ? ` · ${fmtMoney(r.item.fields.netPremium.v, r.item.fields.currency?.v || "INR")}` : ""}</div></td>
                  <td className="small">{fmtStamp(r.item.at)}<div className="muted">{r.item.by}</div></td>
                  <td>{r.clean ? <Pill tone="good">Ready to approve</Pill> : <Pill tone="warn">Open to check</Pill>}
                    {[...r.must, ...r.warn].map((x) => <div key={x} className="small muted">{x}</div>)}
                    {can("addBranch") && (r.must.includes("Insurer not in your list") || r.must.includes("Branch not in your list")) && r.item.info?.insurer && <button type="button" className="linkbtn small" onClick={() => addInsurer(r)}>Add {r.item.info.branch?.name ? `${cleanInsurer(r.item.info.insurer)}, ${r.item.info.branch.name}` : cleanInsurer(r.item.info.insurer)} to your list</button>}
                  </td>
                  <td><div className="row gap-xs wrap">{can("newBusiness") && <Btn onClick={() => go({ view: "add", inboxId: r.item.id, nonce: Date.now() })}>Open</Btn>}{can("newBusiness") && <AskFirst label="Delete" question={`Delete the draft for ${r.item.fileName}?`} yes="Delete" onYes={() => remove(r.item.id)} />}</div></td>
                </tr>
              ))}</tbody></Table>
          ) : <Empty title="No drafts match" />}
        </>
      )}
      {saved.length > 0 && (
        <Card title={`Saved partway (${saved.length})`} sub="Opened and saved as a draft earlier. Open one to finish it.">
          {saved.map((t) => { const p = db.policies.find((x) => x.id === t.policyId); const c = db.customers.find((x) => x.id === p?.customerId); return <button key={t.id} className="listrow" onClick={() => go({ view: "policy", id: t.policyId, termId: t.id })}><strong>{c?.name}</strong><span className="small muted">{p?.type}{t.values?.policyNo ? ` · ${t.values.policyNo}` : ""}</span></button>; })}
        </Card>
      )}
    </div>
  );
}
