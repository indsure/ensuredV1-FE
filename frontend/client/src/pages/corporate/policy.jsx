// One policy, its terms, and every tab that hangs off a term.
import { FIELDS, FIELD, TODAY, LIVE, PLAIN_SAMPLES, fixtureById, makeEndorsementFixture, makeRenewalFixture, isVesselType, isCargoOpen, isCharterers, CURRENCIES } from "./data.js";
import { fmtDate, fmtStamp, fmtMoney, fmtNum, fmtValue, isNum, r2, coverage, completeness, paymentSummary, instalmentRows, instTotal, missingFields, insurerOf, branchOf, teamName, nowIso, daysBetween } from "./lib.js";
import { useApp, Pill, Card, Empty, Btn, Labeled, Select, AskFirst, Modal, Tabs, KV, Table, Confirm, Proposed, Legacy, Icon, DocModal } from "./ui.jsx";
import { evaluate, demoCargoProfile, VERDICT_TONE, VERDICT_LABEL } from "./marine.js";
import { declarationNote, carrierNotice } from "./docs.js";
import { saveFile, fileUrl } from "./store.js";
import { OcrReview, DocPane, PdfAttach } from "./review.jsx";
import { useState } from "react";

export function docLines(doc) {
  if (!doc) return null;
  if (doc.lines) return doc.lines;
  if (doc.fixtureId) return fixtureById(doc.fixtureId)?.lines || null;
  return null;
}

export function DocViewer({ doc, onClose }) {
  const lines = docLines(doc);
  return (
    <Modal title={doc.name} onClose={onClose} wide>
      {doc.userFile?.fileId && <a className="btn btn-primary" href={fileUrl(doc.userFile.fileId)} target="_blank" rel="noreferrer">Open the original PDF</a>}
      <KV items={[["Type", doc.kind], ["Added", `${fmtStamp(doc.addedAt)} by ${doc.addedBy}`], ["Note", doc.note || "--"]]} />
      {lines ? <DocPane lines={lines} title={doc.name} generated={!!doc.lines && !doc.extracted} extracted={doc.extracted} />
        : doc.userFile ? <div className="note">{doc.userFile.fileId ? <>Kept on this computer: "{doc.userFile.name}" ({Math.ceil(doc.userFile.size / 1024)} KB).</> : <>Your file "{doc.userFile.name}" ({Math.ceil(doc.userFile.size / 1024)} KB) is listed only; the file itself was not kept.</>}</div>
          : <div className="note">Sample attachment with no preview in this demo.</div>}
    </Modal>
  );
}

export function StatePills({ term }) {
  const c = completeness(term), cov = coverage(term), pay = paymentSummary(term);
  const ren = term.values.renewable;
  return (
    <div className="statepills">
      <div><span className="axis">Record</span><Pill tone={c.tone}>{c.label}</Pill></div>
      <div><span className="axis">Cover</span><Pill tone={cov.tone} title={cov.why}>{cov.label}</Pill></div>
      <div><span className="axis">Payment</span><Pill tone={term.status === "draft" ? "muted" : pay.tone}>{term.status === "draft" ? "Not tracked yet" : pay.label}</Pill></div>
      <div><span className="axis">Renewable</span><Pill tone={ren ? "muted" : "warn"}>{ren || "Not entered"}</Pill></div>
      <div><span className="axis">Renewal outcome</span><Pill tone={term.outcome === "Renewed" ? "good" : term.outcome === "Lost" ? "bad" : "muted"}>{term.outcome}</Pill></div>
    </div>
  );
}

export function PolicyView({ policyId, termId, tab = "overview", go }) {
  const { db, update, can, log, toast } = useApp();
  const p = db.policies.find((x) => x.id === policyId);
  const [viewDoc, setViewDoc] = useState(null);
  if (!p) return <Empty title="Policy not found">It may have been removed by Reset demo. <button className="linkbtn" onClick={() => go({ view: "register" })}>Go to the policy register</button></Empty>;
  const terms = p.termIds.map((id) => db.terms.find((t) => t.id === id));
  const term = terms.find((t) => t.id === termId) || terms.filter((t) => t.status === "confirmed").pop() || terms[terms.length - 1];
  const c = db.customers.find((x) => x.id === p.customerId);
  const ins = insurerOf(db, p.insurerId), br = branchOf(db, p.insurerId, p.branchId);
  const setTab = (t) => go({ view: "policy", id: p.id, termId: term.id, tab: t });
  const marine = isVesselType(p.type) || isCargoOpen(p.type) || isCharterers(p.type);
  const docs = db.documents.filter((d) => d.policyId === p.id);
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "documents", label: "Documents", count: docs.length },
    { key: "endorsements", label: "Endorsements", count: term.endorsements.length },
    { key: "payments", label: "Payments", count: term.receipts.length },
    ...(marine ? [{ key: "marine", label: "Marine" }] : []),
    { key: "renewals", label: "Renewals", count: terms.length },
    { key: "history", label: "History" },
  ];
  const isLatest = term.id === p.termIds[p.termIds.length - 1];

  return (
    <div className="stack">
      <div className="crumbs"><button className="linkbtn" onClick={() => go({ view: "customer", id: c.id })}>{c.name}</button> / {p.type}</div>
      <header className="page-head">
        <div>
          <p className="eyebrow">{p.dept} · Control no. {p.controlNo} <Legacy /></p>
          <h1>{term.values.policyNo || "Policy number not entered"}</h1>
          <p className="muted">{p.type} · {ins?.name}, {br?.name} ({br?.city}, {br?.country}){p.vesselMode ? ` · ${p.vesselMode}` : ""}{p.cover ? ` · ${p.cover}` : ""}</p>
        </div>
        <div className="termsel" aria-label="Terms of this policy">
          <span className="axis">Terms</span>
          <div className="row gap-xs wrap">
            {terms.map((t) => (
              <button key={t.id} className={`termchip ${t.id === term.id ? "on" : ""}`} onClick={() => go({ view: "policy", id: p.id, termId: t.id, tab })}>
                Term {t.termNo}{t.status === "draft" ? " (draft)" : ""}<span className="small">{t.values.riskStart ? `${fmtDate(t.values.riskStart).slice(3)} to ${fmtDate(t.values.riskEnd).slice(3)}` : "dates missing"}</span>
              </button>
            ))}
          </div>
        </div>
      </header>
      {!isLatest && <div className="note">You are viewing an earlier term. It is kept as it was; changes go on the latest term.</div>}
      <StatePills term={term} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "overview" && <Overview p={p} term={term} go={go} openDoc={setViewDoc} />}
      {tab === "documents" && <DocumentsTab p={p} term={term} terms={terms} openDoc={setViewDoc} />}
      {tab === "endorsements" && <EndorsementsTab p={p} term={term} openDoc={setViewDoc} />}
      {tab === "payments" && <PaymentsTab p={p} term={term} openDoc={setViewDoc} />}
      {tab === "marine" && marine && <MarineTab p={p} term={term} openDoc={setViewDoc} />}
      {tab === "renewals" && <RenewalsTab p={p} term={term} terms={terms} go={go} />}
      {tab === "history" && <HistoryTab p={p} />}
      {viewDoc && <DocViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- overview
function Overview({ p, term, go, openDoc }) {
  const { db, update, can, log, toast } = useApp();
  const [editing, setEditing] = useState(false);
  const c = db.customers.find((x) => x.id === p.customerId);
  const doc = db.documents.find((d) => d.id === term.docId);
  const miss = missingFields(term);
  if (editing) {
    const fixture = doc && docLines(doc) ? { id: doc.id, title: doc.name, lines: docLines(doc), fields: doc.fixtureId ? fixtureById(doc.fixtureId).fields : doc.fixtureFields || {}, info: doc.info, generated: !!doc.lines && !doc.extracted, extracted: doc.extracted, fileName: doc.name } : { id: "none", title: "No document", lines: ["No document attached"], fields: {} };
    const save = (pl, confirm) => {
      update((d) => {
        const t = d.terms.find((x) => x.id === term.id);
        Object.assign(t, pl, { status: confirm ? "confirmed" : "draft" });
        log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: confirm ? "Term confirmed" : "Draft saved", detail: confirm ? "Reviewer confirmed every required field." : `Draft saved. Missing: ${missingFields(t).join(", ") || "none"}` });
        if (confirm && t.prevTermId) {
          const prev = d.terms.find((x) => x.id === t.prevTermId);
          prev.outcome = "Renewed"; prev.nextTermId = t.id;
          log(d, { customerId: p.customerId, policyId: p.id, termId: prev.id, action: "Renewal confirmed", detail: `Linked forward to term ${t.termNo} (${t.values.policyNo}). Earlier term kept.` });
        }
      });
      toast(confirm ? "Record confirmed" : "Draft saved");
      setEditing(false);
    };
    return <OcrReview fixture={fixture} initial={term.values} initialSources={term.sources} initialBrokerageConfirmed={term.brokerageConfirmed} customerName={db.customers.find((x) => x.id === p.customerId)?.name} insurerId={p.insurerId} branchId={p.branchId} policyType={p.type}
      heading={`Review draft: ${p.type}`} onCancel={() => setEditing(false)} onSaveDraft={(pl) => save(pl, false)} onConfirm={(pl) => save(pl, true)} />;
  }
  const v = term.values;
  const groups = ["Identification", "Dates", "Amounts", "Other", "Brokerage"];
  return (
    <div className="stack">
      {term.status === "draft" && (
        <div className="note note-warn">
          <strong>Draft.</strong> Missing: {miss.join(", ") || "nothing, ready to confirm"}. Drafts stay out of accounts reports.
          <div className="row gap-s" style={{ marginTop: 8 }}><Btn kind="primary" disabled={!can("editDraft")} why="Your role cannot edit records" onClick={() => setEditing(true)}>Continue review</Btn></div>
        </div>
      )}
      <div className="grid2">
        <Card title="Customer and team">
          <KV items={[["Insured", <button className="linkbtn" onClick={() => go({ view: "customer", id: c.id })}>{c.name} ({c.code})</button>], ["Vertical", c.vertical], ["CSE", teamName(db, c.cse)], ["RM", c.rm ? teamName(db, c.rm) : "Not assigned"], ["Source", c.source === "Referral" ? c.referral : "Direct business"], ["New / Renewal", term.nr]]} />
        </Card>
        <Card title="Policy document">
          {doc ? <><p>{doc.name}</p><Btn onClick={() => openDoc(doc)}>View document</Btn></> : <Empty title="No policy document attached" />}
          {term.status === "confirmed" && <p className="small muted" style={{ marginTop: 8 }}>Confirmed values change only through an endorsement, so the earlier value is always kept.</p>}
        </Card>
      </div>
      {groups.map((g) => (
        <Card key={g} title={g}>
          <Table>
            <thead><tr><th>Field</th><th>Value</th><th>Where it came from</th></tr></thead>
            <tbody>
              {FIELDS.filter((f) => f.group === g).map((f) => {
                const s = term.sources[f.key];
                return (
                  <tr key={f.key} className={v[f.key] === "" || v[f.key] == null ? (f.req ? "row-miss" : "") : ""}>
                    <td>{f.label}{f.req && <span className="req"> *</span>}</td>
                    <td className="num-l">{v[f.key] === "" || v[f.key] == null ? <span className={f.req ? "bad-text" : "muted"}>{f.req ? "Missing" : "--"}</span> : fmtValue(f.key, v[f.key], v.currency)}</td>
                    <td className="small">{!s ? "--" : s.via ? `Changed by ${s.via}, line ${s.ref}` : s.conf === "preset" ? `Brokerage preset v${s.version}` : s.conf === "manual" ? s.note || "Entered by reviewer" : s.conf === "calc" ? "Calculated by reviewer" : `Policy document line ${s.ref}${s.edited ? `, corrected by reviewer (document said ${s.originalText})` : ""}${s.checked ? ", checked by reviewer" : ""}`}</td>
                  </tr>
                );
              })}
              {g === "Brokerage" && <tr><td>Brokerage amount</td><td className="num-l">{fmtMoney(r2((+v.netPremium || 0) * (+v.brokeragePct || 0) / 100), v.currency)}</td><td className="small">{term.brokerageSnap ? `Loaded from preset v${term.brokerageSnap.version} at ${term.brokerageSnap.pct}% and kept with this term` : "Entered by hand"}{term.brokerageConfirmed ? ", confirmed by reviewer" : ", not confirmed"}</td></tr>}
            </tbody>
          </Table>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- documents
export function AddDocForm({ customerId, policyId = null, termId = null, kinds, onDone }) {
  const { update, log, toast, who } = useApp();
  const [kind, setKind] = useState(kinds[0]);
  const [mode, setMode] = useState(LIVE ? "own" : "sample");
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const save = async () => {
    if (mode === "own" && !file) { setErr(LIVE ? "Choose a file" : "Choose a file, or switch to a sample document"); return; }
    const fileId = mode === "own" ? await saveFile(file) : null;
    update((d) => {
      const id = `DOC${++d.seq}`;
      const sample = PLAIN_SAMPLES.find((s) => s.kind === kind);
      d.documents.push({ id, customerId, policyId, termId, kind, name: mode === "own" ? file.name : sample ? sample.name : `${kind} (sample).pdf`, fixtureId: null, addedAt: nowIso(), addedBy: who, note, userFile: mode === "own" ? { name: file.name, size: file.size, fileId } : null });
      log(d, { customerId, policyId, termId, action: "Document added", detail: `${kind} added. No values changed.` });
    });
    toast(`${kind} added`);
    onDone();
  };
  return (
    <div className="formgrid">
      <Labeled label="Document type" htmlFor="ad-kind"><Select id="ad-kind" value={kind} onChange={setKind} options={kinds} /></Labeled>
      <Labeled label="File" htmlFor="ad-mode">
        <Select id="ad-mode" value={mode} onChange={setMode} options={[...(LIVE ? [] : [{ value: "sample", label: "Use a sample document" }]), { value: "own", label: "Choose my own file (name only)" }]} />
      </Labeled>
      {mode === "own" && <Labeled label="Your file" htmlFor="ad-file" error={err} hint="Only the file name and size are listed. Contents are not read."><input id="ad-file" type="file" onChange={(e) => { setFile(e.target.files[0] || null); setErr(""); }} /></Labeled>}
      <Labeled label="Note (optional)" htmlFor="ad-note" wide><input id="ad-note" value={note} onChange={(e) => setNote(e.target.value)} /></Labeled>
      <div className="row gap-s fld-wide"><Btn kind="primary" onClick={save}>Add document</Btn><Btn onClick={onDone}>Cancel</Btn></div>
    </div>
  );
}

function DocumentsTab({ p, term, terms, openDoc }) {
  const { db, update, can, log, toast } = useApp();
  const [adding, setAdding] = useState(false);
  const docs = db.documents.filter((d) => d.policyId === p.id);
  const loose = db.documents.filter((d) => d.customerId === p.customerId && !d.policyId);
  const tlabel = (tid) => { const t = terms.find((x) => x.id === tid); return t ? `Term ${t.termNo}` : "Policy level"; };
  const attach = (docId) => {
    update((d) => { const x = d.documents.find((y) => y.id === docId); x.policyId = p.id; x.termId = term.id; log(d, { customerId: p.customerId, policyId: p.id, termId: term.id, action: "Document linked", detail: `${x.name} linked to term ${term.termNo}. It stays on the customer too.` }); });
    toast("Document linked to this policy");
  };
  return (
    <div className="stack">
      <Card title="Documents on this policy" sub="Every term keeps its own documents. Adding a debit note or proof never changes policy values."
        actions={can("addDoc") && !adding && <Btn kind="primary" onClick={() => setAdding(true)}>Add document</Btn>}>
        {adding && <AddDocForm customerId={p.customerId} policyId={p.id} termId={term.id} kinds={["Debit note", "Supporting document", "Receipt proof", "Endorsement"]} onDone={() => setAdding(false)} />}
        {docs.length ? (
          <Table><thead><tr><th>Document</th><th>Type</th><th>Term</th><th>Added</th><th /></tr></thead>
            <tbody>{docs.map((d) => <tr key={d.id}><td>{d.name}</td><td>{d.kind}</td><td>{tlabel(d.termId)}</td><td>{fmtStamp(d.addedAt)}</td><td><Btn onClick={() => openDoc(d)}>View</Btn></td></tr>)}</tbody></Table>
        ) : <Empty title="No documents yet" />}
      </Card>
      <Card title="Customer documents not linked to a policy" sub="Quotes, KYC and similar papers live on the customer. Link one here if it belongs to this policy.">
        {loose.length ? (
          <Table><thead><tr><th>Document</th><th>Type</th><th>Added</th><th /></tr></thead>
            <tbody>{loose.map((d) => <tr key={d.id}><td>{d.name}</td><td>{d.kind}</td><td>{fmtStamp(d.addedAt)}</td><td className="row gap-xs"><Btn onClick={() => openDoc(d)}>View</Btn>{can("addDoc") && <Btn onClick={() => attach(d.id)}>Link to term {term.termNo}</Btn>}</td></tr>)}</tbody></Table>
        ) : <Empty title="Nothing waiting to be linked" />}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- endorsements
function EndorsementsTab({ p, term, openDoc }) {
  const { db, update, can, log, toast, who } = useApp();
  const [kind, setKind] = useState(null);
  const [picked, setPicked] = useState({});
  const [eff, setEff] = useState(TODAY);
  const [tried, setTried] = useState(false);
  const nextNo = `END-${String(term.endorsements.length + 1).padStart(2, "0")}`;
  const [ownFx, setOwnFx] = useState(null);
  const fx = kind === "own" ? ownFx : kind ? makeEndorsementFixture(kind, term, nextNo) : null;
  const canEndorse = can("endorse") && term.status === "confirmed" && term.id === p.termIds[p.termIds.length - 1];
  const v = term.values;
  const start = (k) => { setKind(k); setPicked({}); setTried(false); setEff(TODAY); };
  const confirm = () => {
    setTried(true);
    const keys = Object.keys(picked).filter((k) => picked[k]);
    if (!keys.length || !eff) return;
    update((d) => {
      const t = d.terms.find((x) => x.id === term.id);
      const docId = `DOC${++d.seq}`;
      d.documents.push({ id: docId, customerId: p.customerId, policyId: p.id, termId: t.id, kind: "Endorsement", name: fx.extracted ? fx.fileName : `${fx.title}.pdf`, lines: fx.lines, extracted: !!fx.extracted, userFile: fx.extracted ? { name: fx.fileName, size: fx.fileSize, fileId: fx.fileId || null } : null, addedAt: nowIso(), addedBy: who, note: "" });
      const changes = keys.map((k) => ({ field: k, before: t.values[k], after: fx.fields[k].v, beforeSrc: t.sources[k] || null, afterSrc: { docId, ref: fx.fields[k].ref } }));
      changes.forEach((ch) => { t.values[ch.field] = ch.after; t.sources[ch.field] = { docId, ref: ch.afterSrc.ref, conf: "high", via: nextNo }; });
      const unchanged = Object.keys(fx.fields).filter((k) => !keys.includes(k));
      t.endorsements.push({ id: `E${++d.seq}`, no: nextNo, docId, effDate: eff, at: nowIso(), by: who, changes, unchanged });
      log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Endorsement confirmed", detail: `${nextNo} changed ${changes.length} reviewed field(s): ${changes.map((c) => FIELD[c.field].label).join(", ")}. Not changed: ${unchanged.map((k) => FIELD[k].label).join(", ") || "none"}. Earlier values kept.` });
    });
    toast(`${nextNo} confirmed`);
    setKind(null);
  };
  return (
    <div className="stack">
      {!kind && (
        <Card title="Endorsements" sub="An endorsement changes only the fields a reviewer ticks. Both value sets and both documents are kept."
          actions={canEndorse && !LIVE && <><Btn onClick={() => start("premium")}>New endorsement: premium revision (sample)</Btn><Btn onClick={() => start("si")}>New endorsement: sum insured increase (sample)</Btn></>}>
          {!canEndorse && term.status === "draft" && <div className="note">Confirm this term before recording endorsements.</div>}
          {canEndorse && <PdfAttach id="en-file" label="Attach an endorsement PDF" onReady={(x) => { setOwnFx({ ...x, title: x.fileName }); start("own"); }} />}
          {term.endorsements.length === 0 ? <Empty title="No endorsements on this term" /> : term.endorsements.slice().reverse().map((e) => (
            <div key={e.id} className="endo">
              <div className="row between wrap gap-s"><strong>{e.no} · effective {fmtDate(e.effDate)}</strong><span className="muted small">Confirmed {fmtStamp(e.at)} by {e.by}</span></div>
              <Table><thead><tr><th>Field changed</th><th>Before</th><th>After</th><th>Before came from</th><th>After came from</th></tr></thead>
                <tbody>{e.changes.map((ch) => <tr key={ch.field}><td>{FIELD[ch.field].label}</td><td className="num-l old">{fmtValue(ch.field, ch.before, v.currency)}</td><td className="num-l">{fmtValue(ch.field, ch.after, v.currency)}</td><td className="small">{ch.beforeSrc?.ref ? `Earlier document line ${ch.beforeSrc.ref}` : "Entered by reviewer"}</td><td className="small">Endorsement line {ch.afterSrc.ref}</td></tr>)}</tbody></Table>
              <p className="small muted">Read but not changed: {e.unchanged.map((k) => FIELD[k].label).join(", ") || "none"}.</p>
              <Btn onClick={() => openDoc(db.documents.find((d) => d.id === e.docId))}>View endorsement document</Btn>
            </div>
          ))}
        </Card>
      )}
      {kind && (
        <div className="review">
          <div className="review-top"><div><h2>Review endorsement {nextNo}</h2><p className="muted">Tick only the fields this endorsement really changes. Unticked fields keep their current value.</p></div></div>
          <div className="review-grid">
            <DocPane lines={fx.lines} title={fx.title} generated={!fx.extracted} extracted={fx.extracted} />
            <div className="review-fields">
              <Labeled label="Effective date" htmlFor="en-eff" req error={tried && !eff ? "Enter the effective date" : null}><input id="en-eff" type="date" value={eff} onChange={(e) => setEff(e.target.value)} /></Labeled>
              <Table><thead><tr><th>Change?</th><th>Field</th><th>Current value</th><th>On endorsement</th></tr></thead>
                <tbody>{!Object.keys(fx.fields).length && <tr><td colSpan={4}><Empty title="No values could be read from this PDF">{fx.noText ? "It has no text layer (probably a scan)." : "None of the known labels were found."} Cancel and check the document, or record the change from a sample.</Empty></td></tr>}{Object.entries(fx.fields).filter(([k]) => FIELD[k]).map(([k, x]) => {
                  const same = String(x.v) === String(v[k]);
                  return (
                    <tr key={k} className={picked[k] ? "row-pick" : ""}>
                      <td><input type="checkbox" aria-label={`Change ${FIELD[k].label}`} id={`en-${k}`} disabled={same} checked={!!picked[k]} onChange={(e) => setPicked((p) => ({ ...p, [k]: e.target.checked }))} /></td>
                      <td><label htmlFor={`en-${k}`}>{FIELD[k].label}</label>{x.note && <div className="small warn-text">{x.note}</div>}</td>
                      <td className="num-l">{fmtValue(k, v[k], v.currency)}<div className="small muted">{term.sources[k]?.via ? `from ${term.sources[k].via}` : term.sources[k]?.ref ? `policy line ${term.sources[k].ref}` : ""}</div></td>
                      <td className="num-l">{fmtValue(k, x.v, v.currency)}<div className="small muted">line {x.ref}{x.conf === "low" ? ", low confidence" : ""}{same ? ", same as now" : ""}</div></td>
                    </tr>
                  );
                })}</tbody></Table>
              {tried && !Object.values(picked).some(Boolean) && <div className="note note-bad" role="alert">Tick at least one field to change, or cancel.</div>}
              <div className="row gap-s wrap"><Btn onClick={() => setKind(null)}>Cancel</Btn><Btn kind="primary" onClick={confirm}>Confirm endorsement</Btn></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- payments
function PaymentsTab({ p, term, openDoc }) {
  const { db, update, can, log, toast } = useApp();
  const [editSched, setEditSched] = useState(false);
  const [addRec, setAddRec] = useState(false);
  const cur = term.values.currency;
  const pay = paymentSummary(term);
  const rows = instalmentRows(term);
  const debitNotes = db.documents.filter((d) => d.termId === term.id && d.kind === "Debit note");
  if (term.status === "draft") return <div className="note">Payments are tracked once the term is confirmed.</div>;
  return (
    <div className="stack">
      <div className="note small">Receipts and debit notes are stored next to the policy. They never change premium, dates or sum insured.</div>
      <div className="stats">
        <div className="stat"><span>Due on this term</span><strong>{fmtMoney(pay.due, cur)}</strong><em>{term.instalments.length ? `${term.instalments.length} instalments` : "Gross premium, single payment"}</em></div>
        <div className="stat"><span>Received</span><strong>{fmtMoney(pay.received, cur)}</strong><em>{term.receipts.length} receipt(s)</em></div>
        <div className="stat"><span>Outstanding</span><strong className={pay.outstanding > 0 ? "bad-text" : ""}>{fmtMoney(pay.outstanding, cur)}</strong><em>{pay.label}</em></div>
      </div>
      <Card title="Instalment schedule" sub={<>Due date and receipt date are kept separately. Booking per receipt or per policy is open <Confirm /></>}
        actions={can("schedule") && !editSched && <Btn onClick={() => setEditSched(true)}>{term.instalments.length ? "Edit schedule" : "Set up instalments"}</Btn>}>
        {editSched ? <ScheduleEditor p={p} term={term} onDone={() => setEditSched(false)} /> : rows.length ? (
          <Table><thead><tr><th>No.</th><th>Due date</th><th className="num">Amount</th><th className="num">Tax</th><th className="num">Total due</th><th className="num">Received</th><th className="num">Outstanding</th><th>Status</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.no}><td>{r.no}</td><td>{fmtDate(r.due)}</td><td className="num">{fmtNum(r.amount, cur)}</td><td className="num">{fmtNum(r.tax, cur)} <span className="muted small">({r.taxPct}%)</span></td><td className="num">{fmtNum(r.total, cur)}</td><td className="num">{fmtNum(r.got, cur)}{r.recs.length > 0 && <div className="small muted">{r.recs.map((x) => fmtDate(x.date)).join(", ")}</div>}</td><td className="num">{fmtNum(r.out, cur)}</td><td><Pill tone={r.tone}>{r.status}</Pill></td></tr>)}</tbody></Table>
        ) : <Empty title="Single payment">This term has no instalment schedule. The gross premium is due as one amount.</Empty>}
        {term.scheduleHistory?.length > 0 && <details className="small"><summary>{term.scheduleHistory.length} earlier schedule version(s) kept</summary>{term.scheduleHistory.map((h, i) => <div key={i} className="muted">Version {i + 1}, replaced {fmtStamp(h.at)} by {h.by}: {h.rows.map((r) => `#${r.no} ${fmtDate(r.due)} ${fmtNum(instTotal(r), cur)}`).join("; ") || "no rows"}</div>)}</details>}
      </Card>
      <Card title="Receipts" sub="Each receipt can be linked to an instalment. Repeat as many payment blocks as needed." actions={can("receipt") && !addRec && <Btn kind="primary" onClick={() => setAddRec(true)}>Record receipt</Btn>}>
        {addRec && <ReceiptForm p={p} term={term} onDone={() => setAddRec(false)} />}
        {term.receipts.length ? (
          <Table><thead><tr><th>Received on</th><th className="num">Amount</th><th>Against</th><th>Mode</th><th>Reference / UTR</th><th>Bank</th><th>Remitted to insurer</th><th>Proof</th></tr></thead>
            <tbody>{term.receipts.map((r) => { const proof = db.documents.find((d) => d.id === r.proofDocId); const inst = term.instalments.find((i) => i.no === r.instNo); return <tr key={r.id}><td>{fmtDate(r.date)}</td><td className="num">{fmtMoney(r.amount, cur)}</td><td>{inst ? `Instalment ${inst.no} (due ${fmtDate(inst.due)})` : "Not linked to an instalment"}</td><td>{r.mode}</td><td>{r.ref || "--"}</td><td>{r.bank || "--"}</td><td>{r.remitDate ? fmtDate(r.remitDate) : <span className="muted">Not yet</span>}</td><td>{proof ? <button className="linkbtn" onClick={() => openDoc(proof)}>View</button> : "--"}</td></tr>; })}</tbody></Table>
        ) : <Empty title="No receipts recorded">Nothing has been received against this term yet. Issued cover does not mean paid.</Empty>}
      </Card>
      <Card title="Debit notes" sub="Stored for reference. A debit note does not overwrite policy values.">
        {debitNotes.length ? debitNotes.map((d) => <div key={d.id} className="row between"><span>{d.name}</span><Btn onClick={() => openDoc(d)}>View</Btn></div>) : <Empty title="No debit note attached">Add one from the Documents tab.</Empty>}
      </Card>
    </div>
  );
}

function ScheduleEditor({ p, term, onDone }) {
  const { update, log, toast, who } = useApp();
  const paidNos = new Set(term.receipts.map((r) => r.instNo).filter(Boolean));
  const [rows, setRows] = useState(term.instalments.length ? term.instalments.map((r) => ({ ...r })) : []);
  const [gen, setGen] = useState({ first: term.values.riskStart || TODAY, freq: 3, count: 4 });
  const [tried, setTried] = useState(false);
  const cur = term.values.currency;
  const gross = +term.values.grossPremium || 0;
  const total = r2(rows.reduce((a, r) => a + instTotal(r), 0));
  const setRow = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const errs = rows.map((r) => (!r.due ? "Due date needed" : !isNum(r.amount) || +r.amount <= 0 ? "Amount must be more than 0" : !isNum(r.taxPct) || +r.taxPct < 0 ? "Tax % must be 0 or more" : null));
  const addMonths = (iso, m) => { const d = new Date(iso + "T00:00:00"); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };
  const generate = () => {
    const keep = rows.filter((r) => paidNos.has(r.no));
    const out = [...keep];
    for (let i = 0; i < +gen.count; i++) { const no = out.length + 1; out.push({ no, due: addMonths(gen.first, i * +gen.freq), amount: "", taxPct: term.values.gstPct || 0 }); }
    setRows(out);
  };
  const split = () => {
    const free = rows.filter((r) => !paidNos.has(r.no));
    if (!free.length) return;
    const paid = r2(rows.filter((r) => paidNos.has(r.no)).reduce((a, r) => a + instTotal(r), 0));
    setRows((rs) => rs.map((r) => (paidNos.has(r.no) ? r : { ...r, amount: r2((gross - paid) / free.length / (1 + (+r.taxPct || 0) / 100)) })));
  };
  const save = () => {
    setTried(true);
    if (errs.some(Boolean)) return;
    update((d) => {
      const t = d.terms.find((x) => x.id === term.id);
      t.scheduleHistory = [...(t.scheduleHistory || []), { at: nowIso(), by: who, rows: t.instalments }];
      t.instalments = rows.map((r, i) => ({ no: i + 1, due: r.due, amount: +r.amount, taxPct: +r.taxPct }));
      log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Instalment schedule saved", detail: `${t.instalments.length} instalment(s), total ${fmtMoney(total, cur)}. Previous schedule kept as version ${t.scheduleHistory.length}.` });
    });
    toast("Instalment schedule saved");
    onDone();
  };
  return (
    <div className="stack">
      <div className="formgrid">
        <Labeled label="First due date" htmlFor="sg-first"><input id="sg-first" type="date" value={gen.first} onChange={(e) => setGen({ ...gen, first: e.target.value })} /></Labeled>
        <Labeled label="Frequency of payment (months)" htmlFor="sg-freq"><input id="sg-freq" type="number" min="1" value={gen.freq} onChange={(e) => setGen({ ...gen, freq: e.target.value })} /></Labeled>
        <Labeled label="No. of instalments" htmlFor="sg-count"><input id="sg-count" type="number" min="1" max="24" value={gen.count} onChange={(e) => setGen({ ...gen, count: e.target.value })} /></Labeled>
        <div className="row gap-s fld-wide wrap"><Btn onClick={generate}>Make rows</Btn><Btn onClick={split} disabled={!rows.length}>Split remaining gross equally (editable)</Btn><span className="small muted">Rows with receipts are locked so their due dates stay as they were.</span></div>
      </div>
      <Table><thead><tr><th>No.</th><th>Due date</th><th>Amount (before tax)</th><th>Tax %</th><th className="num">Total</th><th /></tr></thead>
        <tbody>{rows.map((r, i) => { const locked = paidNos.has(r.no); return (
          <tr key={i}><td>{i + 1}</td>
            <td><input aria-label={`Instalment ${i + 1} due date`} type="date" value={r.due} disabled={locked} onChange={(e) => setRow(i, "due", e.target.value)} /></td>
            <td><input aria-label={`Instalment ${i + 1} amount`} inputMode="decimal" value={r.amount} disabled={locked} onChange={(e) => setRow(i, "amount", e.target.value.replace(/,/g, ""))} />{tried && errs[i] && <div className="err-text">{errs[i]}</div>}</td>
            <td><input aria-label={`Instalment ${i + 1} tax percent`} inputMode="decimal" value={r.taxPct} disabled={locked} onChange={(e) => setRow(i, "taxPct", e.target.value)} /></td>
            <td className="num">{fmtNum(instTotal(r), cur)}</td>
            <td>{locked ? <span className="small muted">Has receipt</span> : <Btn onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Remove</Btn>}</td></tr>); })}
          {!rows.length && <tr><td colSpan={6}><Empty title="No rows">Make rows above, or add one.</Empty></td></tr>}</tbody></Table>
      <div className="row gap-s wrap"><Btn onClick={() => setRows((rs) => [...rs, { no: rs.length + 1, due: "", amount: "", taxPct: term.values.gstPct || 0 }])}>Add row</Btn></div>
      <div className={`note ${Math.abs(total - gross) > 0.01 ? "note-warn" : ""}`}>Schedule total {fmtMoney(total, cur)} vs gross premium {fmtMoney(gross, cur)}{Math.abs(total - gross) > 0.01 ? `: differs by ${fmtMoney(r2(total - gross), cur)}. Saving is allowed; check against the insurer schedule.` : ": matches."}</div>
      <div className="row gap-s"><Btn onClick={onDone}>Cancel</Btn><Btn kind="primary" onClick={save}>Save schedule</Btn></div>
    </div>
  );
}

function ReceiptForm({ p, term, onDone }) {
  const { update, log, toast, who } = useApp();
  const rows = instalmentRows(term).filter((r) => r.out > 0);
  const [f, setF] = useState({ instNo: rows[0]?.no ? String(rows[0].no) : "", date: TODAY, amount: rows[0] ? String(rows[0].out) : "", mode: "Bank transfer", ref: "", bank: "", remitDate: "", proof: false });
  const [tried, setTried] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const errs = { date: !f.date ? "Enter the date the money was received" : null, amount: !isNum(f.amount) || +f.amount <= 0 ? "Enter an amount more than 0" : null, remitDate: f.remitDate && f.remitDate < f.date ? "Remittance cannot be before receipt" : null };
  const inst = rows.find((r) => String(r.no) === f.instNo);
  const save = () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    update((d) => {
      const t = d.terms.find((x) => x.id === term.id);
      let proofDocId = null;
      if (f.proof) { proofDocId = `DOC${++d.seq}`; d.documents.push({ id: proofDocId, customerId: p.customerId, policyId: p.id, termId: t.id, kind: "Receipt proof", name: "Bank receipt advice (sample).pdf", addedAt: nowIso(), addedBy: who, note: "" }); }
      t.receipts.push({ id: `R${++d.seq}`, instNo: f.instNo ? +f.instNo : null, date: f.date, amount: +f.amount, mode: f.mode, ref: f.ref, bank: f.bank, remitDate: f.remitDate, proofDocId });
      log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Receipt recorded", detail: `${fmtMoney(+f.amount, t.values.currency)} received ${fmtDate(f.date)}${f.instNo ? ` against instalment ${f.instNo}` : ""}. Policy values unchanged.` });
    });
    toast("Receipt recorded");
    onDone();
  };
  return (
    <div className="formgrid boxed">
      <Labeled label="Against instalment" htmlFor="rc-inst"><Select id="rc-inst" value={f.instNo} onChange={(v) => { set("instNo")(v); const r = rows.find((x) => String(x.no) === v); if (r) set("amount")(String(r.out)); }} options={rows.map((r) => ({ value: String(r.no), label: `Instalment ${r.no}, due ${fmtDate(r.due)}, ${fmtNum(r.out, term.values.currency)} outstanding` }))} placeholder="Not linked to an instalment" /></Labeled>
      <Labeled label="Received on" htmlFor="rc-date" req error={tried && errs.date} hint={inst && f.date > inst.due ? `Later than the due date (${fmtDate(inst.due)}). Both dates are kept.` : null}><input id="rc-date" type="date" value={f.date} onChange={(e) => set("date")(e.target.value)} /></Labeled>
      <Labeled label={`Amount (${term.values.currency})`} htmlFor="rc-amt" req error={tried && errs.amount}><input id="rc-amt" inputMode="decimal" value={f.amount} onChange={(e) => set("amount")(e.target.value.replace(/,/g, ""))} /></Labeled>
      <Labeled label="Payment mode" htmlFor="rc-mode"><Select id="rc-mode" value={f.mode} onChange={set("mode")} options={["Bank transfer", "NEFT", "RTGS", "Cheque", "Demand draft", "UPI", "Debit card", "SWIFT"]} /></Labeled>
      <Labeled label="Cheque / DD / transaction no. or UTR" htmlFor="rc-ref"><input id="rc-ref" value={f.ref} onChange={(e) => set("ref")(e.target.value)} /></Labeled>
      <Labeled label="Bank and branch" htmlFor="rc-bank"><input id="rc-bank" value={f.bank} onChange={(e) => set("bank")(e.target.value)} /></Labeled>
      <Labeled label="Remitted to insurer on" htmlFor="rc-remit" error={tried && errs.remitDate}><input id="rc-remit" type="date" value={f.remitDate} onChange={(e) => set("remitDate")(e.target.value)} /></Labeled>
      <div className="fld"><label className="check"><input id="rc-proof" type="checkbox" checked={f.proof} onChange={(e) => set("proof")(e.target.checked)} /> Attach a sample payment proof</label></div>
      <div className="row gap-s fld-wide"><Btn onClick={onDone}>Cancel</Btn><Btn kind="primary" onClick={save}>Save receipt</Btn></div>
    </div>
  );
}

// ---------------------------------------------------------------- marine
function MarineTab({ p, term, openDoc }) {
  if (term.status === "draft") return <div className="note">Marine schedules and declarations open once the term is confirmed.</div>;
  return (
    <div className="stack">
      {isVesselType(p.type) && <VesselSection p={p} term={term} openDoc={openDoc} />}
      {isCargoOpen(p.type) && <CargoSection p={p} term={term} />}
      {isCharterers(p.type) && <CharterSection p={p} term={term} />}
    </div>
  );
}

function VesselSection({ p, term, openDoc }) {
  const { db, update, can, log, toast, who } = useApp();
  const cur = term.values.currency;
  const scheds = term.vesselSchedules;
  const current = scheds[scheds.length - 1];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("form");
  const [f, setF] = useState({ type: "Add", name: "", imo: "", gt: "", remove: "", effDate: TODAY, premiumAdj: "", brokerageAdj: "", note: "", withDoc: true });
  const [tried, setTried] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const errs = {
    name: f.type === "Add" && !f.name.trim() ? "Enter the vessel name" : f.type === "Add" && current?.vessels.some((v) => v.name.toLowerCase() === f.name.trim().toLowerCase()) ? "This vessel is already on the schedule" : null,
    remove: f.type === "Remove" && !f.remove ? "Choose the vessel to remove" : null,
    effDate: !f.effDate ? "Enter the effective date" : f.effDate < term.values.riskStart || f.effDate > term.values.riskEnd ? "Must fall inside this term's risk period" : current && f.effDate < current.effectiveFrom ? `Must be on or after the current schedule (${fmtDate(current.effectiveFrom)})` : null,
    premiumAdj: !isNum(f.premiumAdj) ? "Enter the amount from the insurer document (0 if none, minus for a refund)" : null,
    brokerageAdj: !isNum(f.brokerageAdj) ? "Enter the brokerage adjustment (0 if none, minus to reverse)" : null,
  };
  const ok = !Object.values(errs).some(Boolean);
  const confirm = () => {
    update((d) => {
      const t = d.terms.find((x) => x.id === term.id);
      const last = t.vesselSchedules[t.vesselSchedules.length - 1];
      let docId = null;
      if (f.withDoc) { docId = `DOC${++d.seq}`; d.documents.push({ id: docId, customerId: p.customerId, policyId: p.id, termId: t.id, kind: "Endorsement", name: `Fleet change endorsement, ${f.type === "Add" ? f.name : f.remove} (sample).pdf`, addedAt: nowIso(), addedBy: who, note: "" }); }
      const vessels = f.type === "Add" ? [...last.vessels, { name: f.name.trim(), imo: f.imo.trim(), gt: f.gt ? +f.gt : "" }] : last.vessels.filter((v) => v.name !== f.remove);
      t.vesselSchedules.push({ version: last.version + 1, effectiveFrom: f.effDate, vessels, change: { type: f.type, vessel: f.type === "Add" ? f.name.trim() : f.remove, effDate: f.effDate, premiumAdj: +f.premiumAdj, brokerageAdj: +f.brokerageAdj, docId, note: f.note || "Amounts entered from the insurer document. No formula applied." }, at: nowIso(), by: who });
      log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Fleet change confirmed", detail: `${f.type === "Add" ? "Added" : "Removed"} ${f.type === "Add" ? f.name : f.remove} from ${fmtDate(f.effDate)}. Premium adjustment ${fmtMoney(+f.premiumAdj, cur)}, brokerage adjustment ${fmtMoney(+f.brokerageAdj, cur)} (reviewed). Schedule v${last.version} kept.` });
    });
    toast(`Schedule version ${current.version + 1} saved`);
    setOpen(false); setStep("form"); setTried(false);
    setF({ type: "Add", name: "", imo: "", gt: "", remove: "", effDate: TODAY, premiumAdj: "", brokerageAdj: "", note: "", withDoc: true });
  };
  const adjP = r2(scheds.reduce((a, s) => a + (s.change?.premiumAdj || 0), 0)), adjB = r2(scheds.reduce((a, s) => a + (s.change?.brokerageAdj || 0), 0));
  return (
    <Card title={`Vessel schedule (${p.vesselMode || "mode not set"})`} sub="Individual vessel or fleet is recorded separately from Individual/Group policy classification."
      actions={can("fleet") && !open && <Btn kind="primary" onClick={() => setOpen(true)}>Record fleet change</Btn>}>
      {open && (
        <div className="boxed stack">
          {step === "form" ? (
            <>
              <div className="note note-warn small">No pro-rata rule is applied. Enter the premium and brokerage adjustments exactly as the insurer states them. The calculation rule is an open decision <Confirm /></div>
              <div className="formgrid">
                <Labeled label="Change" htmlFor="fl-type"><Select id="fl-type" value={f.type} onChange={set("type")} options={["Add", "Remove"]} /></Labeled>
                {f.type === "Add" ? <>
                  <Labeled label="Vessel name" htmlFor="fl-name" req error={tried && errs.name}><input id="fl-name" value={f.name} onChange={(e) => set("name")(e.target.value)} /></Labeled>
                  <Labeled label="IMO number" htmlFor="fl-imo"><input id="fl-imo" value={f.imo} onChange={(e) => set("imo")(e.target.value)} /></Labeled>
                  <Labeled label="Gross tonnage" htmlFor="fl-gt"><input id="fl-gt" inputMode="numeric" value={f.gt} onChange={(e) => set("gt")(e.target.value)} /></Labeled>
                </> : <Labeled label="Vessel to remove" htmlFor="fl-rem" req error={tried && errs.remove}><Select id="fl-rem" value={f.remove} onChange={set("remove")} placeholder="Choose" options={current.vessels.map((v) => v.name)} /></Labeled>}
                <Labeled label="Effective date" htmlFor="fl-eff" req error={tried && errs.effDate}><input id="fl-eff" type="date" value={f.effDate} onChange={(e) => set("effDate")(e.target.value)} /></Labeled>
                <Labeled label={`Premium adjustment (${cur}), minus for refund`} htmlFor="fl-padj" req error={tried && errs.premiumAdj}><input id="fl-padj" inputMode="decimal" value={f.premiumAdj} onChange={(e) => set("premiumAdj")(e.target.value)} /></Labeled>
                <Labeled label={`Brokerage adjustment (${cur})`} htmlFor="fl-badj" req error={tried && errs.brokerageAdj}><input id="fl-badj" inputMode="decimal" value={f.brokerageAdj} onChange={(e) => set("brokerageAdj")(e.target.value)} /></Labeled>
                <Labeled label="Reviewer note" htmlFor="fl-note" wide><input id="fl-note" value={f.note} onChange={(e) => set("note")(e.target.value)} placeholder="For example: as per insurer endorsement no." /></Labeled>
                <div className="fld"><label className="check"><input type="checkbox" checked={f.withDoc} onChange={(e) => set("withDoc")(e.target.checked)} /> Attach a sample endorsement document</label></div>
              </div>
              <div className="row gap-s"><Btn onClick={() => { setOpen(false); setTried(false); }}>Cancel</Btn><Btn kind="primary" onClick={() => { setTried(true); if (ok) setStep("review"); }}>Review change</Btn></div>
            </>
          ) : (
            <>
              <h4>Check before confirming</h4>
              <KV items={[["Change", `${f.type} ${f.type === "Add" ? f.name : f.remove}`], ["Effective from", fmtDate(f.effDate)], ["Premium adjustment", fmtMoney(+f.premiumAdj, cur)], ["Brokerage adjustment", fmtMoney(+f.brokerageAdj, cur)], ["Current schedule", `Version ${current.version}, ${current.vessels.length} vessel(s), kept unchanged`], ["New schedule", `Version ${current.version + 1}, ${f.type === "Add" ? current.vessels.length + 1 : current.vessels.length - 1} vessel(s)`]]} />
              <div className="row gap-s"><Btn onClick={() => setStep("form")}>Back</Btn><Btn kind="primary" onClick={confirm}>Confirm fleet change</Btn></div>
            </>
          )}
        </div>
      )}
      <div className="stack">
        {scheds.slice().reverse().map((s) => (
          <details key={s.version} open={s === current} className="sched">
            <summary><strong>Version {s.version}</strong>{s === current ? <Pill tone="good">Current</Pill> : <Pill>Earlier, kept</Pill>} effective from {fmtDate(s.effectiveFrom)} · {s.vessels.length} vessel(s)</summary>
            <Table><thead><tr><th>Vessel</th><th>IMO</th><th className="num">GT</th></tr></thead><tbody>{s.vessels.map((v) => <tr key={v.name}><td>{v.name}</td><td>{v.imo || "--"}</td><td className="num">{v.gt ? fmtNum(v.gt) : "--"}</td></tr>)}</tbody></Table>
            {s.change && <p className="small">{s.change.type === "Add" ? "Added" : "Removed"} {s.change.vessel} from {fmtDate(s.change.effDate)}. Premium adjustment {fmtMoney(s.change.premiumAdj, cur)}, brokerage adjustment {fmtMoney(s.change.brokerageAdj, cur)}. {s.change.note} Recorded {fmtStamp(s.at)} by {s.by}. {s.change.docId && <button className="linkbtn" onClick={() => openDoc(db.documents.find((d) => d.id === s.change.docId))}>View document</button>}</p>}
          </details>
        ))}
      </div>
      <p className="small muted">Recorded adjustments on this term: premium {fmtMoney(adjP, cur)}, brokerage {fmtMoney(adjB, cur)}. They are kept on the policy and are not added into report totals until the booking rule is decided <Confirm /></p>
    </Card>
  );
}

const DECL_BLANK = { interest: "", condition: "New", currency: "USD", invoiceValue: "", fxRate: "", inrValue: "", dutyInr: "", supplierInsuredOverseas: false, originPlace: "", originCountry: "India", destinationPlace: "", destinationCountry: "", routing: "", mode: "Sea", containerised: "Not known", stowage: "Under deck", vessel: "", sailingDate: "", blNo: "", certNo: "", invoiceNo: "", packages: "", packageType: "", lengthM: "", widthM: "", heightM: "", heaviestMT: "", warPaid: "Not known", rate: "" };
const GATE_ICON = { pass: "check", fail: "alert", warn: "alert", unknown: "help" };
const shipmentOf = (f) => ({ ...f, routing: String(f.routing || "").split(",").map((x) => x.trim()).filter(Boolean) });

// The live verdict: what cover this declaration actually buys, and anything that would void it.
function VerdictPanel({ v }) {
  return (
    <div className={`verdict verdict-${v.status}`} role="status" aria-live="polite">
      <div className="row between wrap gap-s"><h4>{v.headline}</h4><Pill tone={VERDICT_TONE[v.status]}>{VERDICT_LABEL[v.status]}</Pill></div>
      <div className="grid2">
        <div>
          <p className="small"><strong>Cover:</strong> {v.regime.label}. {v.regime.because}</p>
          <p className="small muted">{v.regime.clauses.join(" · ")}</p>
          <table className="mini"><tbody>{v.lines.map((l) => <tr key={l.label}><td>{l.label}{l.note && <div className="small muted">{l.note}</div>}</td><td className="num">{fmtMoney(l.amt)}</td></tr>)}<tr className="mini-total"><td>Insured value</td><td className="num">{fmtMoney(v.insured)}</td></tr><tr><td>Excess per claim</td><td className="num">{fmtMoney(v.excess)}</td></tr></tbody></table>
        </div>
        <ul className="gates">{v.gates.map((g) => <li key={g.id} className={`gate gate-${g.status}`}><Icon name={GATE_ICON[g.status]} size={16} /><div><strong>{g.label}</strong>{g.detail && <div className="small">{g.detail}</div>}{g.wording && g.status !== "pass" && <div className="small muted">Policy condition: {g.wording}</div>}</div></li>)}</ul>
      </div>
      {v.actions.length > 0 && <div className="note note-warn"><strong>Before the cargo leaves:</strong><ul>{v.actions.map((a) => <li key={a.label}>{a.label}: {fmtMoney(a.amt)}, {a.deadline}. <span className="small">{a.why}</span></li>)}</ul></div>}
      {v.endsAt && <p className="small"><strong>Cover ends at {v.endsAt}.</strong> The rest of the journey is not insured.</p>}
    </div>
  );
}

function CarrierNoticeForm({ decl, insured, onDoc, onClose }) {
  const [f, setF] = useState({ carrier: "", deliveredOn: "", discoveredOn: "", damage: "", lossInr: "" });
  const [tried, setTried] = useState(false);
  const errs = { carrier: !f.carrier.trim() && "Enter the carrier", deliveredOn: !f.deliveredOn && "Enter the delivery date", discoveredOn: !f.discoveredOn ? "Enter the date damage was found" : f.discoveredOn < f.deliveredOn ? "Cannot be before delivery" : null, damage: !f.damage.trim() && "Describe the damage", lossInr: (!isNum(f.lossInr) || +f.lossInr <= 0) && "Enter the estimated loss" };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const late = f.deliveredOn && daysBetween(f.deliveredOn, TODAY) > 3;
  return (
    <Modal title={`Carrier notice for ${decl.no}`} onClose={onClose}>
      <p className="small">Hidden damage must be notified to the carrier within three days of delivery, or the recovery is at risk.</p>
      <div className="formgrid">
        <Labeled label="Carrier (shipping line or transporter)" htmlFor="cn-carrier" req error={tried && errs.carrier}><input id="cn-carrier" value={f.carrier} onChange={set("carrier")} /></Labeled>
        <Labeled label="Delivered on" htmlFor="cn-del" req error={tried && errs.deliveredOn}><input id="cn-del" type="date" value={f.deliveredOn} onChange={set("deliveredOn")} /></Labeled>
        <Labeled label="Damage found on" htmlFor="cn-disc" req error={tried && errs.discoveredOn}><input id="cn-disc" type="date" value={f.discoveredOn} onChange={set("discoveredOn")} /></Labeled>
        <Labeled label="Estimated loss (INR)" htmlFor="cn-loss" req error={tried && errs.lossInr}><input id="cn-loss" inputMode="decimal" value={f.lossInr} onChange={set("lossInr")} /></Labeled>
        <Labeled label="What was damaged" htmlFor="cn-dmg" req error={tried && errs.damage}><input id="cn-dmg" value={f.damage} placeholder="For example: water damage to 12 bags" onChange={set("damage")} /></Labeled>
      </div>
      {late && <div className="note note-warn small">Delivered {daysBetween(f.deliveredOn, TODAY)} days ago, so the three-day window has passed. Send the notice anyway: a late notice is better than none.</div>}
      <div className="row gap-s"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={() => { setTried(true); if (Object.values(errs).some(Boolean)) return; onDoc(carrierNotice({ decl, insured, ...f, lossInr: +f.lossInr })); }}>Draft the notice</Btn></div>
    </Modal>
  );
}

function CargoSection({ p, term }) {
  const { db, update, can, log, toast, who } = useApp();
  const blank = () => ({ ...DECL_BLANK, rate: term.values.premiumRate ?? "" });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [tried, setTried] = useState(false);
  const [doc, setDoc] = useState(null);
  const [notice, setNotice] = useState(null);
  const profile = term.coverProfile;
  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setF((x) => {
      const n = { ...x, [k]: v };
      // The INR value follows invoice value times rate until someone types it directly.
      if (["invoiceValue", "fxRate", "currency"].includes(k) && !x.inrTyped) n.inrValue = n.currency === "INR" ? n.invoiceValue : isNum(n.invoiceValue) && isNum(n.fxRate) ? String(Math.round(+n.invoiceValue * +n.fxRate)) : "";
      if (k === "inrValue") n.inrTyped = true;
      return n;
    });
  };
  const si = +term.values.sumInsured || 0;
  const live = term.cargoDecls.filter((x) => !x.held);
  const used = r2(live.reduce((a, x) => a + x.siInr, 0));
  const premUsed = r2(live.reduce((a, x) => a + x.premiumInr, 0));
  const bal = r2(si - used);
  const pct = si ? r2(bal / si * 100) : 0;
  const th = db.settings.balanceThresholdPct;
  const customer = db.customers.find((c) => c.id === p.customerId);
  const insurer = insurerOf(db, p.insurerId);
  const hasValue = isNum(f.inrValue) && +f.inrValue > 0;
  const verdict = profile ? evaluate(shipmentOf(f), profile, { consumedInr: used, sameVessel: live.filter((x) => x.vessel).map((x) => ({ no: x.no, vessel: x.vessel, insured: x.siInr })) }) : null;
  const premium = verdict && isNum(f.rate) ? Math.round(verdict.insured * +f.rate / 100) : 0;
  const errs = { interest: !f.interest.trim() && "Describe the goods", inrValue: !hasValue && "Enter the invoice value in INR", sailingDate: !f.sailingDate && "Enter the sailing or dispatch date", originPlace: !f.originPlace.trim() && "Enter where it starts", destinationPlace: !f.destinationPlace.trim() && "Enter where it ends", rate: !isNum(f.rate) && "Enter the premium rate" };
  const held = hasValue && verdict?.status === "void";
  const save = () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    update((d) => {
      const t = d.terms.find((x) => x.id === term.id);
      const no = `D-${String(t.cargoDecls.length + 1).padStart(3, "0")}`;
      const sh = shipmentOf(f);
      delete sh.inrTyped;
      t.cargoDecls.push({ ...sh, id: `DEC${++d.seq}`, no, held, siInr: verdict.insured, premiumInr: held ? 0 : premium, verdict, at: nowIso(), by: who });
      log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: held ? "Declaration held back" : "Declaration saved", detail: `${no}: ${sh.interest}, ${sh.originPlace} to ${sh.destinationPlace}, insured value ${fmtMoney(verdict.insured)}. Check: ${VERDICT_LABEL[verdict.status]}.${held ? " Not drawn from the sum insured." : ` Premium used ${fmtMoney(premium)}.`}` });
    });
    toast(held ? "Held back. It does not use the sum insured" : "Declaration saved");
    setOpen(false); setF(blank()); setTried(false);
  };
  const setUp = () => update((d) => { const t = d.terms.find((x) => x.id === term.id); t.coverProfile = demoCargoProfile(si); log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Policy conditions set up", detail: "Demo cargo conditions added so declarations can be checked." }); });
  const F = ({ k, label, type = "text", req, hint, mode }) => <Labeled label={label} htmlFor={`dc-${k}`} req={req} hint={hint} error={tried && errs[k]}><input id={`dc-${k}`} type={type} inputMode={mode} value={f[k]} onChange={set(k)} /></Labeled>;
  const S = ({ k, label, options }) => <Labeled label={label} htmlFor={`dc-${k}`}><select id={`dc-${k}`} value={f[k]} onChange={set(k)}>{options.map((o) => <option key={o}>{o}</option>)}</select></Labeled>;
  return (
    <Card title="Marine cargo open policy: declarations" sub="Each shipment is checked against the policy conditions before it is declared. A declaration outside the terms would be void."
      actions={can("declare") && profile && !open && <Btn kind="primary" onClick={() => setOpen(true)}>Add declaration</Btn>}>
      <div className="stats">
        <div className="stat"><span>Sum insured</span><strong>{fmtMoney(si)}</strong></div>
        <div className="stat"><span>Sum insured used</span><strong>{fmtMoney(used)}</strong><em>{live.length} declarations{term.cargoDecls.length > live.length ? `, ${term.cargoDecls.length - live.length} held back` : ""}</em></div>
        <div className="stat"><span>Premium used</span><strong>{fmtMoney(premUsed)}</strong></div>
        <div className="stat"><span>Balanced SI</span><strong>{fmtMoney(bal)}</strong><em>{pct}% of sum insured left</em></div>
      </div>
      <div className="meter" role="img" aria-label={`${pct}% remaining`}><div style={{ width: `${Math.max(0, Math.min(100, 100 - pct))}%` }} /></div>
      <p className="small">{th == null ? <>Low-balance reminder: threshold not set. The notes gave 30% only as an example <Confirm /></> : bal / si * 100 < th ? <Pill tone="warn">Below the preview threshold of {th}%</Pill> : <>Above the preview threshold of {th}%.</>}</p>
      {!profile ? (
        <div className="note row between wrap gap-s"><span><strong>No policy conditions recorded for this open policy.</strong> Declarations cannot be checked until they are.</span>{can("declare") && <Btn onClick={setUp}>{LIVE ? "Use example cargo conditions" : "Use the demo cargo conditions"}</Btn>}</div>
      ) : (
        <details className="conditions"><summary>Policy conditions used for the checks <Proposed /></summary>
          <div className="small stack conditions-body">
            <div><strong>Insured interest:</strong> {profile.interestLabel}. <strong>Per sending limit:</strong> {fmtMoney(profile.perSendingLimitInr)}. <strong>Excess:</strong> {profile.excess.pct}% of the consignment, minimum {fmtMoney(profile.excess.minimumInr)}.</div>
            <div><strong>Basis of valuation:</strong> invoice value plus duty, plus 10%. Returned or used goods at depreciated market value.</div>
            <div><strong>War and strikes:</strong> {profile.warZones.map((z) => `${z.label} (${z.buyBackPct == null ? "excluded, no buy-back" : `${z.buyBackPct}% buy-back ${z.deadline}`})`).join("; ")}.</div>
            <div><strong>Excluded:</strong> sanctioned countries, bulk and break-bulk, items over 12 m by 2.5 m by 3.1 m or {profile.owcMT} t. Cargo must be containerised at sea.</div>
            <div className="muted">{LIVE ? "Example conditions, not read from this policy. Check every result against the policy schedule before relying on it." : "Fictional demo conditions."} A real policy's conditions would be entered from its schedule <Confirm /></div>
          </div>
        </details>
      )}
      {open && (
        <div className="boxed stack">
          <h4>Shipment</h4>
          <div className="formgrid">
            {F({ k: "interest", label: "Goods", req: true, hint: "As on the invoice" })}
            {S({ k: "condition", label: "Condition", options: ["New", "Used"] })}
            {F({ k: "sailingDate", label: "Sails or dispatched on", type: "date", req: true })}
            {F({ k: "invoiceNo", label: "Invoice no." })}
            <Labeled label="Invoice currency" htmlFor="dc-currency"><select id="dc-currency" value={f.currency} onChange={set("currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Labeled>
            {F({ k: "invoiceValue", label: "Invoice value", mode: "decimal" })}
            {f.currency !== "INR" && F({ k: "fxRate", label: `Rate (INR per ${f.currency})`, mode: "decimal" })}
            {F({ k: "inrValue", label: "Invoice value (INR)", req: true, mode: "decimal", hint: f.currency !== "INR" ? "Worked out from value and rate; you can overwrite it" : "" })}
            {F({ k: "dutyInr", label: "Duty at actuals (INR)", mode: "decimal", hint: "Imports only" })}
            <Labeled label="Overseas leg" htmlFor="dc-supplierInsuredOverseas"><label className="check"><input id="dc-supplierInsuredOverseas" type="checkbox" checked={f.supplierInsuredOverseas} onChange={set("supplierInsuredOverseas")} /> Supplier insured it (CIF or CIP import)</label></Labeled>
          </div>
          <h4>Voyage</h4>
          <div className="formgrid">
            {F({ k: "originPlace", label: "From (place)", req: true })}{F({ k: "originCountry", label: "From (country)" })}
            {F({ k: "destinationPlace", label: "To (place)", req: true })}{F({ k: "destinationCountry", label: "To (country)" })}
            {F({ k: "routing", label: "Route via", hint: "Ports, canals or seas, separated by commas" })}
            {S({ k: "mode", label: "Mode", options: ["Sea", "Air", "Road", "Rail", "Multimodal"] })}
            {F({ k: "vessel", label: "Vessel or conveyance" })}{F({ k: "blNo", label: "B/L or LR no." })}
            {S({ k: "containerised", label: "Containerised", options: ["Not known", "Yes", "No"] })}
            {S({ k: "stowage", label: "Stowage", options: ["Under deck", "On deck", "Not known"] })}
            {S({ k: "warPaid", label: "War and strikes buy-back paid", options: ["Not known", "Yes", "No"] })}
          </div>
          <h4>Packages and premium</h4>
          <div className="formgrid">
            {F({ k: "packages", label: "Number and kind", hint: "For example: 400 bags" })}{F({ k: "packageType", label: "Packing", hint: "Container, bags, crates" })}
            {F({ k: "lengthM", label: "Largest item length (m)", mode: "decimal" })}{F({ k: "widthM", label: "Width (m)", mode: "decimal" })}{F({ k: "heightM", label: "Height (m)", mode: "decimal" })}
            {F({ k: "heaviestMT", label: "Heaviest item (tonnes)", mode: "decimal" })}
            {F({ k: "rate", label: "Premium rate (%)", req: true, mode: "decimal" })}{F({ k: "certNo", label: "Certificate no." })}
          </div>
          {verdict && hasValue ? <VerdictPanel v={verdict} /> : <p className="small muted">Enter the goods and invoice value to see the check.</p>}
          {verdict && hasValue && !held && <p className="small">Premium used by this declaration: <strong>{fmtMoney(premium)}</strong> ({f.rate || 0}% of {fmtMoney(verdict.insured)}).</p>}
          {held && <div className="note note-bad small">Saving keeps this as <strong>held back</strong>: on record for follow-up, but not declared and not drawn from the sum insured.</div>}
          <div className="row gap-s wrap"><Btn onClick={() => { setOpen(false); setTried(false); }}>Cancel</Btn><Btn kind="primary" onClick={save}>{held ? "Save as held back" : "Save declaration"}</Btn>{tried && Object.values(errs).some(Boolean) && <span className="err-text small">Fill the marked fields.</span>}</div>
        </div>
      )}
      {term.cargoDecls.length ? (
        <Table><thead><tr><th>No.</th><th>Sails</th><th>Voyage</th><th>Goods</th><th className="num">Insured value</th><th className="num">Premium used</th><th>Check</th><th>Documents</th></tr></thead>
          <tbody>{term.cargoDecls.map((x) => <tr key={x.id} className={x.held ? "row-held" : ""}>
            <td>{x.no}</td>
            <td className="nowrap">{fmtDate(x.sailingDate || x.from)}</td>
            <td>{x.originPlace ? `${x.originPlace} to ${x.destinationPlace}` : [x.portLoading, x.portDischarge, x.finalDest].filter(Boolean).join(" to ") || "--"}{x.vessel || x.vesselNo ? <div className="small muted">{x.vessel || x.vesselNo}</div> : null}</td>
            <td>{x.interest || x.goods}</td>
            <td className="num">{fmtNum(x.siInr)}</td>
            <td className="num">{x.held ? "--" : fmtNum(x.premiumInr)}</td>
            <td>{x.verdict ? <div className="pills"><Pill tone={VERDICT_TONE[x.verdict.status]}>{VERDICT_LABEL[x.verdict.status]}</Pill>{x.held && <Pill tone="muted">Held back</Pill>}</div> : <span className="small muted">Entered before checks</span>}</td>
            <td><div className="row gap-xs wrap">{x.verdict && x.verdict.status !== "cleared" && <Btn onClick={() => setDoc(declarationNote({ decl: x, verdict: x.verdict, policyNo: term.values.policyNo, insurer: insurer?.name, insured: customer.name }))}>Reason note</Btn>}{!x.held && <Btn onClick={() => setNotice(x)}>Carrier notice</Btn>}</div></td>
          </tr>)}</tbody></Table>
      ) : <Empty title="No declarations yet" />}
      {notice && <CarrierNoticeForm decl={notice} insured={customer.name} onClose={() => setNotice(null)} onDoc={(d) => { setNotice(null); setDoc(d); }} />}
      {doc && <DocModal doc={doc} onClose={() => setDoc(null)} />}
    </Card>
  );
}

function CharterSection({ p, term }) {
  const { update, can, log, toast, who } = useApp();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ period: "", reference: "", vessel: "", remarks: "" });
  const [tried, setTried] = useState(false);
  const save = () => {
    setTried(true);
    if (!f.period.trim() || !f.reference.trim()) return;
    update((d) => { const t = d.terms.find((x) => x.id === term.id); t.charterDecls.push({ ...f, id: `CD${++d.seq}`, at: nowIso(), by: who }); log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Charterers declaration saved", detail: `${f.period}, ${f.reference}. No premium effect applied (not specified).` }); });
    toast("Charterers declaration saved");
    setOpen(false); setF({ period: "", reference: "", vessel: "", remarks: "" }); setTried(false);
  };
  return (
    <Card title="Charterers' Liability declarations" sub="Kept separate from cargo declarations. The notes require them, but their fields are not specified yet."
      actions={can("declare") && !open && <Btn kind="primary" onClick={() => setOpen(true)}>Add declaration</Btn>}>
      <div className="note note-warn small">Open items <Confirm />: which fields are needed, how often declarations are made, and whether they change premium. Only placeholder fields are captured; no premium is calculated.</div>
      {open && (
        <div className="formgrid boxed">
          <Labeled label="Declaration period" htmlFor="ch-per" req error={tried && !f.period.trim() ? "Required" : null}><input id="ch-per" value={f.period} placeholder="For example: Nov 2026" onChange={(e) => setF({ ...f, period: e.target.value })} /></Labeled>
          <Labeled label="Charter party reference" htmlFor="ch-ref" req error={tried && !f.reference.trim() ? "Required" : null}><input id="ch-ref" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Labeled>
          <Labeled label="Vessel" htmlFor="ch-ves"><input id="ch-ves" value={f.vessel} onChange={(e) => setF({ ...f, vessel: e.target.value })} /></Labeled>
          <Labeled label="Remarks" htmlFor="ch-rem"><input id="ch-rem" value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Labeled>
          <p className="fld-wide muted small">Further fields: to be specified <Confirm /> · Premium effect: to be specified <Confirm /></p>
          <div className="row gap-s fld-wide"><Btn onClick={() => { setOpen(false); setTried(false); }}>Cancel</Btn><Btn kind="primary" onClick={save}>Save declaration</Btn></div>
        </div>
      )}
      {term.charterDecls.length ? <Table><thead><tr><th>Period</th><th>Reference</th><th>Vessel</th><th>Remarks</th><th>Premium effect</th><th>Recorded</th></tr></thead>
        <tbody>{term.charterDecls.map((x) => <tr key={x.id}><td>{x.period}</td><td>{x.reference}</td><td>{x.vessel || "--"}</td><td>{x.remarks || "--"}</td><td><Confirm /></td><td className="small">{fmtStamp(x.at)} by {x.by}</td></tr>)}</tbody></Table> : <Empty title="No charterers declarations yet" />}
    </Card>
  );
}

// ---------------------------------------------------------------- renewals
function RenewalsTab({ p, term, terms, go }) {
  const { db, update, can, log, toast, who } = useApp();
  const latest = terms[terms.length - 1];
  const draft = latest.status === "draft" && latest.prevTermId ? latest : null;
  const base = draft ? terms.find((t) => t.id === draft.prevTermId) : latest;
  const [reviewing, setReviewing] = useState(false);
  const [losing, setLosing] = useState(false);
  const [loss, setLoss] = useState("");
  const [tried, setTried] = useState(false);
  const ins = insurerOf(db, p.insurerId);
  const startRenewal = (own) => {
    const fx = own || makeRenewalFixture(base, p, ins.name);
    update((d) => {
      const pol = d.policies.find((x) => x.id === p.id);
      const id = `T${++d.seq}`, docId = `DOC${++d.seq}`;
      d.documents.push({ id: docId, customerId: p.customerId, policyId: p.id, termId: id, kind: "Renewal schedule", name: fx.extracted ? fx.fileName : `${fx.title}.pdf`, lines: fx.lines, fixtureFields: fx.fields, info: fx.info, extracted: !!fx.extracted, userFile: fx.extracted ? { name: fx.fileName, size: fx.fileSize, fileId: fx.fileId || null } : null, addedAt: nowIso(), addedBy: who, note: "" });
      d.terms.push({ id, policyId: p.id, termNo: pol.termIds.length + 1, prevTermId: base.id, nextTermId: null, status: "draft", cancelled: false, nr: "Renewal", values: {}, sources: {}, outcome: "Open", lossDetail: "", brokerageSnap: null, brokerageConfirmed: false, instalments: [], receipts: [], endorsements: [], vesselSchedules: base.vesselSchedules.length ? [{ ...base.vesselSchedules[base.vesselSchedules.length - 1], version: 1, change: null, effectiveFrom: fx.fields.riskStart?.v || "", at: nowIso(), by: who }] : [], cargoDecls: [], charterDecls: [], docId });
      pol.termIds.push(id);
      log(d, { customerId: p.customerId, policyId: p.id, termId: base.id, action: "Renewal started", detail: `Draft term ${pol.termIds.length} created with renewal document. Term ${base.termNo} unchanged until the renewal is confirmed.` });
    });
    toast("Renewal draft started");
    setReviewing(true);
  };
  const saveRenewal = (pl, confirm) => {
    update((d) => {
      const t = d.terms.find((x) => x.id === draft.id);
      Object.assign(t, pl, { status: confirm ? "confirmed" : "draft" });
      if (confirm) {
        const prev = d.terms.find((x) => x.id === t.prevTermId);
        prev.outcome = "Renewed"; prev.nextTermId = t.id;
        log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Term confirmed", detail: `Renewal term ${t.termNo} confirmed (${t.values.policyNo}).` });
        log(d, { customerId: p.customerId, policyId: p.id, termId: prev.id, action: "Renewal confirmed", detail: `Term ${prev.termNo} marked Renewed and linked forward to term ${t.termNo}. Both terms and both documents kept.` });
      } else log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Draft saved", detail: `Renewal draft saved. Missing: ${missingFields(t).join(", ") || "none"}` });
    });
    toast(confirm ? "Renewal confirmed and linked" : "Renewal draft saved");
    setReviewing(false);
    if (confirm) go({ view: "policy", id: p.id, termId: draft.id, tab: "renewals" });
  };
  const discard = () => {
    update((d) => {
      d.terms = d.terms.filter((x) => x.id !== draft.id);
      const pol = d.policies.find((x) => x.id === p.id); pol.termIds = pol.termIds.filter((x) => x !== draft.id);
      d.documents.forEach((x) => { if (x.termId === draft.id) { x.termId = null; x.note = `Renewal draft discarded ${new Date().toLocaleDateString("en-IN")}; document kept`; } });
      log(d, { customerId: p.customerId, policyId: p.id, termId: base.id, action: "Renewal draft discarded", detail: `Unconfirmed draft term removed. Term ${base.termNo} unchanged. The renewal document stays on the policy.` });
    });
    toast("Renewal draft discarded");
  };
  const markLost = () => {
    setTried(true);
    if (!loss.trim()) return;
    update((d) => { const t = d.terms.find((x) => x.id === base.id); t.outcome = "Lost"; t.lossDetail = loss.trim(); log(d, { customerId: p.customerId, policyId: p.id, termId: t.id, action: "Marked lost", detail: `Renewal outcome set to Lost. Detail: ${loss.trim()}` }); });
    toast("Renewal outcome set to Lost");
    setLosing(false);
  };
  if (reviewing && draft) {
    const doc = db.documents.find((x) => x.id === draft.docId);
    return <OcrReview fixture={{ id: doc.id, title: doc.name, lines: doc.lines, fields: doc.fixtureFields || {}, info: doc.info, generated: !doc.extracted, extracted: doc.extracted, fileName: doc.name }} customerName={db.customers.find((x) => x.id === p.customerId)?.name} initial={draft.values} initialSources={draft.sources} initialBrokerageConfirmed={draft.brokerageConfirmed}
      insurerId={p.insurerId} branchId={p.branchId} policyType={p.type} heading={`Renewal review: term ${draft.termNo}`} confirmLabel="Confirm renewal"
      onCancel={() => setReviewing(false)} onSaveDraft={(pl) => saveRenewal(pl, false)} onConfirm={(pl) => saveRenewal(pl, true)} />;
  }
  return (
    <div className="stack">
      <Card title="Linked terms" sub="Each renewal is a new term linked to the one before. Earlier terms and their documents are never changed.">
        <ol className="chain">
          {terms.map((t) => (
            <li key={t.id} className={t.id === term.id ? "on" : ""}>
              <button className="linkbtn" onClick={() => go({ view: "policy", id: p.id, termId: t.id, tab: "overview" })}>Term {t.termNo}: {t.values.policyNo || "number not entered"}</button>
              <span className="small">{t.values.riskStart ? `${fmtDate(t.values.riskStart)} to ${fmtDate(t.values.riskEnd)}` : "Dates missing"}</span>
              <span className="row gap-xs wrap"><Pill tone={completeness(t).tone}>{completeness(t).label}</Pill><Pill tone={coverage(t).tone}>{coverage(t).label}</Pill><Pill tone={t.outcome === "Renewed" ? "good" : t.outcome === "Lost" ? "bad" : "muted"}>Outcome: {t.outcome}</Pill></span>
              {t.lossDetail && <span className="small">Loss detail: {t.lossDetail}</span>}
            </li>
          ))}
        </ol>
      </Card>
      <Card title="Next step">
        {draft ? (
          <div className="stack">
            <p>A renewal draft (term {draft.termNo}) is in progress. Term {base.termNo} stays <strong>Open</strong> until the renewal is confirmed.</p>
            <div className="row gap-s wrap"><Btn kind="primary" disabled={!can("renew")} why="Your role cannot renew" onClick={() => setReviewing(true)}>Continue renewal review</Btn>{can("renew") && <AskFirst label="Discard renewal draft" question="Remove the unconfirmed draft? The earlier term is not affected." yes="Discard draft" onYes={discard} />}</div>
          </div>
        ) : base.status !== "confirmed" ? <p>Confirm the current term first.</p>
          : base.outcome !== "Open" ? <p>Term {base.termNo} outcome is <strong>{base.outcome}</strong>. {base.outcome === "Lost" ? "Nothing more to do." : ""}</p>
            : (
              <div className="stack">
                <p>Term {base.termNo} ends {fmtDate(base.values.riskEnd)}. Renewable: <strong>{base.values.renewable || "not entered"}</strong>.{base.values.renewable === "No" && " It is marked non-renewable, but you can still renew if the insurer offers it."}</p>
                <p className="small muted">Renewing starts a draft from the renewal document. Only confirming the reviewed draft completes the renewal.</p>
                {!losing ? (
                  <>{can("renew") && <PdfAttach id="rn-file" label="Renew: attach the renewal policy PDF" onReady={(x) => startRenewal(x)} />}
                  <div className="row gap-s wrap">{!LIVE && <Btn disabled={!can("renew")} why="Your role cannot renew" onClick={() => startRenewal()}>Renew with a sample document</Btn>}<Btn disabled={!can("markLost")} why="Your role cannot change outcomes" onClick={() => setLosing(true)}>Mark as lost</Btn></div></>
                ) : (
                  <div className="formgrid boxed">
                    <Labeled label="Loss detail" htmlFor="ls-detail" req wide error={tried && !loss.trim() ? "Say what happened, in your own words" : null} hint={<>The legacy report has a LossBy column. What it should record is not decided <Confirm /></>}><input id="ls-detail" value={loss} onChange={(e) => setLoss(e.target.value)} /></Labeled>
                    <div className="row gap-s fld-wide"><Btn onClick={() => { setLosing(false); setTried(false); }}>Cancel</Btn><Btn kind="danger" onClick={markLost}>Save as lost</Btn></div>
                  </div>
                )}
              </div>
            )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- history
function HistoryTab({ p }) {
  const { db } = useApp();
  const items = db.audit.filter((a) => a.policyId === p.id).slice().reverse();
  const tno = (tid) => db.terms.find((t) => t.id === tid)?.termNo;
  return (
    <Card title="History" sub="Every change on this policy, newest first. Nothing here can be edited.">
      {items.length ? <ol className="timeline">{items.map((a) => <li key={a.id}><div className="row between wrap gap-s"><strong>{a.action}</strong><span className="small muted">{fmtStamp(a.at)} · {a.who}{tno(a.termId) ? ` · Term ${tno(a.termId)}` : ""}</span></div><div>{a.detail}</div></li>)}</ol> : <Empty title="No history yet" />}
    </Card>
  );
}
