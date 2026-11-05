// Side-by-side review of simulated OCR output. People correct and confirm; nothing is guessed.
import { LIVE } from "./data.js";
import { saveFile } from "./store.js";
import { FIELDS, FIELD, CURRENCIES, NUMERIC } from "./data.js";
import { activePreset, fmtValue, isNum, r2, insurerOf, branchOf, brokerageOf } from "./lib.js";
import { useApp, Btn, Pill, Labeled, AskFirst, Icon, DateInput } from "./ui.jsx";
import { readPolicyPdf, readerSelfTest, ReadError } from "./extract.js";
import { useState, useMemo, useRef, useEffect } from "react";

const GROUPS = ["Identification", "Dates", "Amounts", "Other", "Brokerage"];

export function DocPane({ lines, title, highlight, generated, extracted, onLine }) {
  const box = useRef(null);
  return (
    <div className="docpane">
      <div className="docpane-head">
        <strong>{title}</strong>
        <span className="muted small">{extracted ? "Text read from your file." : <>{generated ? "Sample generated for this demo." : "Sample document fixture."} Simulated scan, no real file is read.</>}</span>
      </div>
      <ol className="paper" ref={box}>
        {lines.map((l, i) => (
          <li key={i} id={`line-${i + 1}`} className={highlight === i + 1 ? "hl" : ""} onClick={() => onLine && onLine(i + 1)}>
            <span className="ln">L{i + 1}</span><span>{l}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Shows whether the in-browser PDF reader works in this view, from a self-test on a tiny built-in PDF.
function ReaderStatus() {
  const [st, setSt] = useState({ state: "checking" });
  useEffect(() => { let on = true; readerSelfTest().then((r) => on && setSt(r)); return () => { on = false; }; }, []);
  if (st.state === "checking") return <p className="reader small muted" role="status">PDF reader: checking...</p>;
  if (st.state === "ok") return <p className="reader small good-text" role="status"><Icon name="check" size={14} /> PDF reader: ready</p>;
  return <p className="reader small bad-text" role="alert"><Icon name="alert" size={14} /> PDF reader is not working in this view. You can still type the values or use a sample document. Technical detail for the IndSure team: {st.detail}</p>;
}

// Attach a PDF (click or drop) and read it in the browser. Calls onReady(fixture) once the text has been read.
export function PdfAttach({ id, label = "Attach the policy PDF", onReady, ready, describe }) {
  const [state, setState] = useState({ busy: false, msg: "", err: "", detail: "" });
  const [over, setOver] = useState(false);
  const read = async (file) => {
    if (!file) return;
    setState({ busy: true, msg: "Opening the PDF reader...", err: "", detail: "" });
    try {
      const fx = await readPolicyPdf(file, (p, n, ocr) => setState({ busy: true, msg: ocr ? `This is a scan, reading it page by page: page ${p} of ${n} (about 10 seconds a page)...` : `Reading page ${p} of ${n}...`, err: "", detail: "" }));
      fx.fileId = await saveFile(file);
      setState({ busy: false, msg: "", err: "", detail: "" });
      onReady(fx);
    } catch (e) {
      setState({ busy: false, msg: "", err: e instanceof ReadError ? e.message : LIVE ? "Something went wrong while reading this file. Try again, or type the values in." : "Something went wrong while reading this file. Try again, or use a sample document.", detail: e?.detail || (e instanceof ReadError ? "" : `${e?.name || "Error"}: ${e?.message || e}`) });
    }
  };
  const n = ready ? FIELDS.filter((f) => ready.fields[f.key]).length : 0;
  return (
    <div className={`attach ${ready ? "attach-on" : ""} ${over ? "attach-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); read(e.dataTransfer.files[0]); }}>
      <input id={id} className="sr" type="file" accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={state.busy} onChange={(e) => { read(e.target.files[0]); e.target.value = ""; }} />
      <label htmlFor={id} className="dropzone">
        <span className="dz-icon"><Icon name="upload" size={26} /></span>
        <span className="attach-label">{label}</span>
        <span className="dz-sub">Drop the PDF or a photo of it here, or click to browse</span>
        <span className="small muted">Digital PDFs from the insurer work best. Scanned PDFs and photos (JPG, PNG) are read too, more slowly, and every value is marked for checking. The text is read inside your browser. The original file is kept with your records.</span>
      </label>
      <ReaderStatus />
      {state.busy && <p className="small" role="status">{state.msg}</p>}
      {state.err && <div className="err-text" role="alert">{state.err}{state.detail && <div className="small muted">Technical detail: {state.detail}</div>}</div>}
      {ready && !state.busy && (
        <p className="small" role="status">{describe ? describe(ready) : ready.noText ? <><strong>{ready.fileName}</strong>: no readable text, even read as a scan. You will be asked to enter the values.</> : <><strong>{ready.fileName}</strong>: found {n} field{n === 1 ? "" : "s"} on {ready.readPages} page{ready.readPages === 1 ? "" : "s"}{ready.ocr ? " (read as a scan, so check each value)" : ""}. Anything not found will be asked for on the next screen.</>}</p>
      )}
    </div>
  );
}

function SourceChip({ src, onShow, req }) {
  if (!src) return req ? <span className="src src-miss">Not found on document, please enter</span> : <span className="src">Not on document (optional)</span>;
  if (src.conf === "issue") return <span className="src src-info">Same as the issue date. Change it if needed.</span>;
  if (src.conf === "preset") return <span className="src src-info">From brokerage preset v{src.version}</span>;
  if (src.conf === "manual") return <span className="src src-info">Entered by reviewer</span>;
  if (src.conf === "calc") return <span className="src src-info">Calculated by reviewer</span>;
  const label = `${src.docLabel || "Document"} L${src.ref}`;
  return (
    <span className="row gap-xs wrap">
      <button type="button" className={`src ${src.conf === "low" ? "src-low" : "src-ok"}`} onClick={() => onShow(src.ref)} title="Show this line on the document">
        {label} · {src.conf === "low" ? "low confidence, please check" : "read clearly"}
      </button>
      {src.edited && <span className="src src-edit">Edited (document said {src.originalText})</span>}
    </span>
  );
}

/**
 * fixture: { id, title, lines, fields, generated }
 * initial: saved values/sources (for an existing draft) or {}
 */
// Insured and customer name are the same thing. Compare them ignoring case, punctuation and company suffixes.
const NAME_NOISE = /\b(messrs|the|pvt|private|ltd|limited|llp|co|company|inc|corp|corporation)\b/g;
const nameKey = (n) => String(n || "").toLowerCase().replace(/\bm\/s\b/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(NAME_NOISE, " ").replace(/\s+/g, " ").trim();
export const sameName = (a, b) => { const x = nameKey(a), y = nameKey(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

export function OcrReview({ fixture, initial = {}, initialSources = {}, initialBrokerageConfirmed = false, insurerId, branchId, policyType, heading, customerName, onCancel, onSaveDraft, onConfirm, confirmLabel = "Confirm record" }) {
  const { db, can } = useApp();
  const preset = activePreset(db, insurerId, policyType);
  const start = useMemo(() => {
    const vals = {}, srcs = {};
    FIELDS.forEach((f) => {
      if (initial[f.key] !== undefined && initial[f.key] !== "") {
        vals[f.key] = initial[f.key];
        srcs[f.key] = initialSources[f.key] || { conf: "manual" };
      } else if (fixture.fields[f.key] && f.key !== "renewable") {
        const x = fixture.fields[f.key];
        vals[f.key] = x.v;
        srcs[f.key] = { ref: x.ref, conf: x.conf, docLabel: "Document", note: x.note };
      } else {
        vals[f.key] = "";
      }
    });
    // Booked date starts as the issue date and stays editable.
    if (!vals.bookDate && vals.issueDate) { vals.bookDate = vals.issueDate; srcs.bookDate = { conf: "issue" }; }
    vals.brokerageOnNet = !!initial.brokerageOnNet;
    vals.otherDetails = initial.otherDetails || fixture.other || [];
    if ((vals.brokeragePct === "" || vals.brokeragePct == null) && preset) {
      vals.brokeragePct = preset.pct;
      srcs.brokeragePct = { conf: "preset", version: preset.version, presetId: preset.presetId };
    }
    return { vals, srcs };
  }, []);
  const [vals, setVals] = useState(start.vals);
  const [srcs, setSrcs] = useState(start.srcs);
  const [hl, setHl] = useState(null);
  const [brokOk, setBrokOk] = useState(initialBrokerageConfirmed);
  const [tried, setTried] = useState(false);
  // Fields missing when the screen opened stay listed, so an input never vanishes while someone types in it.
  const [askKeys] = useState(() => FIELDS.filter((f) => f.req && (start.vals[f.key] === "" || start.vals[f.key] == null)).map((f) => f.key));
  const found = FIELDS.filter((f) => fixture.fields[f.key]).length;
  const dirty = JSON.stringify(vals) !== JSON.stringify(start.vals) || brokOk !== initialBrokerageConfirmed;
  const ins = insurerOf(db, insurerId);

  const set = (k, raw) => {
    const v = NUMERIC.has(k) ? (raw === "" ? "" : raw) : raw;
    setVals((p) => ({ ...p, [k]: v, ...(k === "issueDate" && (p.bookDate === "" || p.bookDate == null || srcs.bookDate?.conf === "issue") ? { bookDate: v } : {}) }));
    if (k === "issueDate" && (vals.bookDate === "" || vals.bookDate == null || srcs.bookDate?.conf === "issue")) setSrcs((p) => ({ ...p, bookDate: v ? { conf: "issue" } : undefined }));
    setSrcs((p) => {
      const s = p[k];
      if (s && s.ref && !s.edited) return { ...p, [k]: { ...s, edited: true, originalText: fmtValue(k, start.vals[k], vals.currency) } };
      if (s && s.edited && String(v) === String(start.vals[k])) { const { edited, originalText, ...rest } = s; return { ...p, [k]: rest }; }
      if (!s || s.conf === "preset" || s.conf === "calc" || s.conf === "issue") return { ...p, [k]: { conf: "manual" } };
      return p;
    });
  };
  const show = (ref) => { setHl(ref); document.getElementById(`line-${ref}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); };

  // checks
  const missing = FIELDS.filter((f) => f.req && (vals[f.key] === "" || vals[f.key] == null));
  const errors = {};
  FIELDS.forEach((f) => {
    const v = vals[f.key];
    if (NUMERIC.has(f.key) && v !== "" && v != null) {
      if (!isNum(v)) errors[f.key] = "Enter a number, digits only";
      else if (+v < 0) errors[f.key] = "Cannot be negative";
    }
  });
  if (vals.riskStart && vals.riskEnd && vals.riskEnd <= vals.riskStart) errors.riskEnd = "Risk end must be after risk start";
  const sumCheck = [vals.grossPremium, vals.gst, vals.netPremium].every(isNum) ? r2(+vals.grossPremium + +vals.gst) : null;
  const grossMismatch = sumCheck != null && Math.abs(sumCheck - +vals.netPremium) > 0.01;
  const lowConf = FIELDS.filter((f) => srcs[f.key]?.conf === "low" && !srcs[f.key]?.edited && !srcs[f.key]?.checked);
  const blockers = [...missing.map((f) => `${f.label} is missing`), ...Object.entries(errors).map(([k, e]) => `${FIELD[k].label}: ${e}`)];
  if (!brokOk) blockers.push("Tick the brokerage confirmation");
  if (lowConf.length) blockers.push(`${lowConf.length} low-confidence value${lowConf.length > 1 ? "s" : ""} not yet checked`);

  const payload = () => {
    const clean = {};
    FIELDS.forEach((f) => { const v = vals[f.key]; clean[f.key] = NUMERIC.has(f.key) && isNum(v) ? +v : v; });
    const snap = srcs.brokeragePct?.conf === "preset" ? { presetId: srcs.brokeragePct.presetId, version: srcs.brokeragePct.version, pct: +vals.brokeragePct } : null;
    return { values: clean, sources: srcs, brokerageConfirmed: brokOk, brokerageSnap: snap };
  };

  return (
    <div className="review">
      <div className="review-top">
        <div>
          <h2>{heading}</h2>
          <p className="muted">Values below were read from {fixture.extracted ? "your PDF" : "the sample document"}. Check each one against the page on the left, correct anything wrong, then save. Nothing here is advice or analysis.</p>
        </div>
        <div className="row gap-s wrap">
          <Pill tone={missing.length ? "warn" : "good"}>{missing.length ? `${missing.length} required field${missing.length > 1 ? "s" : ""} missing` : "All required fields filled"}</Pill>
          {lowConf.length > 0 && <Pill tone="warn">{lowConf.length} to check</Pill>}
        </div>
      </div>
      <div className="note small" role="status">
        {fixture.noText ? <><strong>No text could be read from {fixture.fileName}.</strong> It was read as a scan but the text was too faint or blurred. Please enter the values below.</>
          : <>Filled <strong>{found}</strong> field{found === 1 ? "" : "s"} from {fixture.extracted ? <strong>{fixture.fileName}</strong> : "the document"}{fixture.ocr ? " (read as a scan: every value is amber, check each one)" : ""}{fixture.extracted && fixture.readPages < fixture.pages ? ` (first ${fixture.readPages} of ${fixture.pages} pages)` : ""}. Click a green or amber tag to see the line it came from.</>}
        {fixture.info?.insured && (!customerName ? <div>Insured name on the document: <strong>{fixture.info.insured}</strong>. Check it is the right customer.</div>
          : sameName(fixture.info.insured, customerName) ? <div className="ins-ok">Insured on the document: <strong>{fixture.info.insured}</strong>. Matches the customer.</div>
          : <div className="ins-diff"><strong>Insured on the document is {fixture.info.insured}</strong>, but this record is for {customerName}. Check you picked the right customer before saving.</div>)}
        {fixture.info?.insurer && <div>Insurer named on the document: <strong>{fixture.info.insurer}</strong>. You chose {ins?.name}.</div>}
      </div>
      {askKeys.length > 0 && (
        <section className="askpanel" aria-labelledby="ask-head">
          <div className="row between wrap gap-s">
            <h3 id="ask-head">Please enter these. They were not found on the document.</h3>
            <Pill tone={askKeys.some((k) => vals[k] === "" || vals[k] == null) ? "warn" : "good"}>{askKeys.filter((k) => !(vals[k] === "" || vals[k] == null)).length} of {askKeys.length} entered</Pill>
          </div>
          <div className="formgrid">
            {askKeys.map((k) => {
              const f = FIELD[k], id = `ask-${k}`, done = !(vals[k] === "" || vals[k] == null);
              return (
                <Labeled key={k} label={<>{done && <span className="good-text">✓ </span>}{f.label}</>} htmlFor={id} req error={errors[k] || (tried && !done ? "Required before confirming" : null)} hint={f.help}>
                  {f.type === "date" ? <DateInput id={id} value={vals[k] || ""} onChange={(e) => set(k, e.target.value)} />
                    : f.type === "currency" ? <select id={id} value={vals[k] || ""} onChange={(e) => set(k, e.target.value)}><option value="">Choose</option>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
                      : f.type === "yesno" ? <select id={id} value={vals[k] || ""} onChange={(e) => set(k, e.target.value)}><option value="">Not entered</option><option>Yes</option><option>No</option></select>
                        : <input id={id} type="text" inputMode={NUMERIC.has(k) ? "decimal" : undefined} value={vals[k] ?? ""} onChange={(e) => set(k, e.target.value.replace(/,/g, ""))} />}
                </Labeled>
              );
            })}
          </div>
          <p className="small muted">Is renewable is never read from documents; a person always enters it. Business booked date starts as the issue date. You can save a draft with gaps, and a draft never counts as complete.</p>
        </section>
      )}
      <div className="review-grid">
        <DocPane lines={fixture.lines} title={fixture.title} highlight={hl} generated={fixture.generated} extracted={fixture.extracted} onLine={setHl} />
        <div className="review-fields">
          <div className="note small">Insurer and branch from step 3: <strong>{ins?.name}, {branchOf(db, insurerId, branchId)?.name || "selected branch"}</strong>. Policy type: <strong>{policyType}</strong>.</div>
          {GROUPS.map((g) => (
            <fieldset key={g} className="fgroup">
              <legend>{g}</legend>
              {FIELDS.filter((f) => f.group === g).map((f) => {
                const id = `rv-${f.key}`;
                const err = errors[f.key] || (tried && f.req && (vals[f.key] === "" || vals[f.key] == null) ? "Required before confirming" : null);
                const s = srcs[f.key];
                return (
                  <div key={f.key} className={`rv-row ${f.req && (vals[f.key] === "" || vals[f.key] == null) ? "rv-miss" : ""} ${s?.conf === "low" && !s?.edited && !s?.checked ? "rv-low" : ""}`}>
                    <Labeled label={f.label} htmlFor={id} req={f.req} error={err} hint={s?.note || f.help}>
                      {f.type === "date" ? <DateInput id={id} value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
                        : f.type === "currency" ? <select id={id} value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}><option value="">Choose</option>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
                        : f.type === "yesno" ? <select id={id} value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}><option value="">Not entered</option><option>Yes</option><option>No</option></select>
                        : <input id={id} type="text" inputMode={NUMERIC.has(f.key) ? "decimal" : undefined} value={vals[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value.replace(/,/g, ""))} />}
                    </Labeled>
                    <div className="rv-src">
                      <SourceChip src={s} onShow={show} req={f.req} />
                      {s?.conf === "low" && !s?.edited && !s?.checked && (
                        <button type="button" className="linkbtn" onClick={() => setSrcs((p) => ({ ...p, [f.key]: { ...s, checked: true } }))}>Checked, value is right</button>
                      )}
                      {s?.checked && <span className="src src-ok">Checked by reviewer</span>}
                      {f.key === "netPremium" && (
                        <div className="small">
                          {grossMismatch && <div className="warn-text">Gross + GST = {fmtValue("netPremium", sumCheck, vals.currency)}, which differs from the net entered.</div>}
                          <button type="button" className="linkbtn" disabled={sumCheck == null} onClick={() => { setVals((p) => ({ ...p, netPremium: sumCheck })); setSrcs((p) => ({ ...p, netPremium: { conf: "calc" } })); }}>Calc net premium</button>
                        </div>
                      )}
                      {f.key === "gst" && (
                        <button type="button" className="linkbtn small" disabled={!isNum(vals.grossPremium) || !isNum(vals.gstPct)} onClick={() => { setVals((p) => ({ ...p, gst: r2(+p.grossPremium * +p.gstPct / 100) })); setSrcs((p) => ({ ...p, gst: { conf: "calc" } })); }}>Calculate from GST %</button>
                      )}
                      {f.key === "location" && fixture.fields.location?.word && <span className="src src-info">The policy calls this: {fixture.fields.location.word}</span>}
                    </div>
                  </div>
                );
              })}
              {g === "Brokerage" && (
                <div className="brok">
                  <p className="small">{preset ? <>Preset for {ins?.name} + {policyType}: <strong>{preset.pct}%</strong> (version {preset.version}). It loads as a starting value and stays editable.</> : <>No confirmed preset for this insurer and policy type. Enter brokerage by hand.</>}</p>
                  <label className="check"><input id="rv-brok-net" type="checkbox" checked={!!vals.brokerageOnNet} onChange={(e) => setVals((p) => ({ ...p, brokerageOnNet: e.target.checked }))} /> Brokerage on net premium (leave unticked for gross)</label>
                  {isNum(vals.brokeragePct) && isNum(vals.brokerageOnNet ? vals.netPremium : vals.grossPremium) && <p className="small">Brokerage amount: <strong>{fmtValue("grossPremium", brokerageOf(vals), vals.currency)}</strong> ({vals.brokerageOnNet ? "net" : "gross"} premium x brokerage %)</p>}
                  <label className="check"><input id="rv-brok-ok" type="checkbox" checked={brokOk} onChange={(e) => setBrokOk(e.target.checked)} /> I have checked the brokerage for this policy</label>
                </div>
              )}
            </fieldset>
          ))}
          <fieldset className="rv-group">
            <legend>Other details</legend>
            <p className="small muted">Extensions, special conditions and anything else on the policy without a box of its own. Change, remove or add as needed.</p>
            {(vals.otherDetails || []).map((o, i) => {
              const put = (k, x) => setVals((p) => ({ ...p, otherDetails: p.otherDetails.map((y, j) => (j === i ? { ...y, [k]: x } : y)) }));
              return (
                <div key={i} className="other-row">
                  <input aria-label={`Other detail ${i + 1} name`} value={o.label} onChange={(e) => put("label", e.target.value)} />
                  <input aria-label={`Other detail ${i + 1} value`} value={o.value} onChange={(e) => put("value", e.target.value)} />
                  <span className="row gap-xs">{o.ref && <button type="button" className="src src-ok" onClick={() => show(o.ref)}>L{o.ref}</button>}<Btn onClick={() => setVals((p) => ({ ...p, otherDetails: p.otherDetails.filter((_, j) => j !== i) }))}>Remove</Btn></span>
                </div>
              );
            })}
            <Btn onClick={() => setVals((p) => ({ ...p, otherDetails: [...(p.otherDetails || []), { label: "", value: "" }] }))}>Add another detail</Btn>
          </fieldset>
        </div>
      </div>
      <div className="review-actions">
        {tried && blockers.length > 0 && (
          <div className="note note-bad" role="alert"><strong>Cannot confirm yet.</strong><ul>{blockers.map((b) => <li key={b}>{b}</li>)}</ul>Save as draft to keep your work.</div>
        )}
        <div className="row gap-s wrap">
          {dirty ? <AskFirst label="Cancel" question="Discard the changes on this screen?" yes="Discard" onYes={onCancel} /> : <Btn onClick={onCancel}>Cancel</Btn>}
          <Btn disabled={!can("editDraft") || Object.keys(errors).length > 0} why={Object.keys(errors).length ? "Fix the fields marked in red first" : "Your role cannot save"} onClick={() => onSaveDraft(payload())}>Save as draft</Btn>
          <Btn kind="primary" disabled={!can("editDraft")} why="Your role cannot confirm" onClick={() => { setTried(true); if (!blockers.length) onConfirm(payload()); }}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}
