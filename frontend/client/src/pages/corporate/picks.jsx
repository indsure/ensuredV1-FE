// How sure we are about a value, where it came from, and a pick list when the document shows more than one.
// Used by the review screen (policy number, sum insured) and step 1 of Add a policy (insurer).
import { useEffect, useRef, useState } from "react";
import { Btn, Icon } from "./ui.jsx";
import { loadPdfJs, pdfToLines, PDFJS_BASE } from "./extract.js";
import { fileBlobUrl } from "./store.js";
import { pageOf } from "./confidence.js";

const STATE_WORDS = { green: "Sure", amber: "Please check", red: "Please verify" };
const STATE_ICON = { green: "check", amber: "alert", red: "x" };
export function StateChip({ state, picked, typed }) {
  if (picked) return <span className="cf-chip cf-green"><Icon name="check" size={12} /> You picked this</span>;
  if (typed) return <span className="cf-chip">Typed in</span>;
  if (!state) return null;
  return <span className={`cf-chip cf-${state}`} data-state={state}><Icon name={STATE_ICON[state]} size={12} /> {STATE_WORDS[state]}</span>;
}

const lineText = (lines, ref) => String((lines || [])[ref - 1] ?? "").replace(/\s{2,}/g, "   ");
const canView = (fx) => !!(fx && (fx.localUrl || fx.fileId) && !fx.noText);

// The line a value was read from, with a link to see it on the PDF itself.
// Insurers use "gross" and "net" both ways round. Here gross is before GST and net is the total paid.
const PREMIUM_WORDS = { grossPremium: /\bnet\b/i, netPremium: /\bgross\b/i };
export function SourceLine({ fixture, at, onView, fkey }) {
  if (!fixture?.lines || !at) return null;
  const t = lineText(fixture.lines, at);
  if (!t) return null;
  const other = PREMIUM_WORDS[fkey] && PREMIUM_WORDS[fkey].test(t) && !(fkey === "grossPremium" ? /\bgross\b/i : /\bnet\b/i).test(t);
  return (
    <div className="cf-src">
      <div className="cf-line" title={t}>L{at}: {t}</div>
      {other && <div className="small muted">The policy calls this {fkey === "grossPremium" ? "net" : "gross"} premium. Here gross premium is the amount before GST and net premium is the total paid, so the figures decide which is which.</div>}
      <div className="row gap-s wrap small">
        {canView(fixture) && <button type="button" className="linkbtn" onClick={() => onView(at)}>View in PDF</button>}
        <span className="muted">Page {pageOf(fixture.lines, at)}</span>
      </div>
    </div>
  );
}

// How a candidate is described: the words next to it, its page and line, and why it is set aside.
export function whereWords(fkey, c) {
  const near = c.label ? (c.label === "Letterhead" ? "Letterhead" : `After "${c.label}"`) : "Found";
  const pages = c.pages > 1 ? `, on ${c.pages} pages` : "";
  const prior = c.prior ? (fkey === "insurer" ? " An earlier name, so not used." : " Another policy's number, so not used.") : "";
  return `${near}${pages}. Page ${c.page || 1}, line ${c.ref}.${prior}`;
}

// The list of every value found, plus "None of these, type it in". Picking one fills the field.
export function CandidatePicker({ fkey, name, judged, value, fmt, onPick, onType, onView, canSee, typed, label }) {
  const cands = judged?.cands || [];
  const isOn = (c) => !typed && value !== "" && value != null && String(c.v) === String(value);
  // Nothing is ticked until someone chooses, when no value is in use (a red field).
  const none = typed || (value !== "" && value != null && !cands.some(isOn));
  return (
    <div className="cf-cands" role="radiogroup" aria-label={`${label}: values found on the document`} data-picker={fkey}>
      {cands.map((c) => (
        <label key={String(c.v)} className={`cf-cand ${isOn(c) ? "cf-on" : ""} ${c.prior ? "cf-prior" : ""}`}>
          <input type="radio" name={name} checked={isOn(c)} onChange={() => onPick(c)} />
          <span className="cf-cand-body">
            <strong className={fkey === "policyNo" ? "mono" : ""}>{fmt ? fmt(c.v) : String(c.v)}</strong>
            <span className="small muted">{whereWords(fkey, c)}</span>
            {canSee && <button type="button" className="linkbtn small" onClick={(e) => { e.preventDefault(); onView(c.ref); }}>View in PDF</button>}
          </span>
        </label>
      ))}
      <label className={`cf-cand ${none ? "cf-on" : ""}`}>
        <input type="radio" name={name} checked={none} onChange={() => onType()} />
        <span className="cf-cand-body"><strong>None of these, type it in</strong></span>
      </label>
    </div>
  );
}

// The PDF page with the spot a value was read from boxed. For a document being reviewed the position is
// known; for a saved one the page is read again in this browser to find the line. Nothing is uploaded.
export function PdfView({ fixture, at, title, cands = [], fkey, fmt, onUse, onType, onClose }) {
  const [cur, setCur] = useState(at);
  const [page, setPage] = useState(pageOf(fixture.lines, at));
  const [st, setSt] = useState({ busy: true, err: "" });
  const [box, setBox] = useState(null);
  const pdfRef = useRef(null), canvasRef = useRef(null), geoRef = useRef(fixture.geo || null), urlRef = useRef(null);
  const [total, setTotal] = useState(fixture.pages || 1);
  const isImg = !!fixture.localIsImage;
  const dialog = useRef(null);
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); dialog.current?.focus(); return () => window.removeEventListener("keydown", k); }, []);
  // Open the file once.
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const url = fixture.localUrl || (fixture.fileId ? await fileBlobUrl(fixture.fileId) : null);
        if (!url) throw new Error("The file is not on this computer or the server.");
        urlRef.current = url;
        if (!isImg) {
          const lib = await loadPdfJs();
          // Drawn for people to read, so the PDF's fonts are used (the reader itself skips them).
          pdfRef.current = await lib.getDocument({ url, isEvalSupported: false, standardFontDataUrl: PDFJS_BASE + "standard_fonts/", cMapUrl: PDFJS_BASE + "cmaps/", cMapPacked: true }).promise;
          if (on) setTotal(pdfRef.current.numPages);
          // A saved document: read its text again here, to know where each line sits.
          if (!geoRef.current && !fixture.ocr) {
            const blob = await (await fetch(url)).blob();
            const r = await pdfToLines(new File([blob], fixture.fileName || "policy.pdf", { type: "application/pdf" }));
            geoRef.current = matchGeo(fixture.lines, r.lines);
          }
        }
        if (on) setSt({ busy: false, err: "" });
      } catch (e) { if (on) setSt({ busy: false, err: e?.message || String(e) }); }
    })();
    return () => { on = false; };
  }, []);
  // Draw the page, then the box.
  useEffect(() => {
    if (st.busy || st.err) return;
    let on = true;
    const g = geoRef.current?.[cur - 1];
    setBox(g && g.length === 5 && g[0] === page ? g.slice(1) : null);
    if (isImg || !pdfRef.current) return;
    (async () => {
      const p = await pdfRef.current.getPage(page);
      const c = canvasRef.current; if (!c || !on) return;
      const w = Math.max(280, Math.min(820, (c.closest(".pv-page")?.clientWidth || 852) - 32));
      const vp0 = p.getViewport({ scale: 1 });
      const scale = (w / vp0.width) * (window.devicePixelRatio || 1);
      const vp = p.getViewport({ scale });
      c.width = vp.width; c.height = vp.height; c.style.width = `${w}px`;
      await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    })().catch(() => {});
    return () => { on = false; };
  }, [st, page, cur]);
  useEffect(() => { if (box) document.querySelector(".pv-box")?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [box]);
  const go = (ref) => { setCur(ref); setPage(pageOf(fixture.lines, ref)); };
  const shown = cands.find((c) => c.ref === cur);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide pv" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialog}>
        <header className="card-head"><h3>{title}</h3><Btn onClick={onClose}>Close</Btn></header>
        <div className="pv-wrap">
          {cands.length > 0 && (
            <aside className="pv-side" aria-label="Places found">
              <div className="lbl">{cands.length} {fkey === "insurer" ? (cands.length === 1 ? "name" : "names") : cands.length === 1 ? "value" : "values"} found</div>
              {cands.map((c) => (
                <button key={String(c.v) + c.ref} type="button" className={`pv-where ${c.ref === cur ? "cf-on" : ""}`} onClick={() => go(c.ref)}>
                  <strong className={fkey === "policyNo" ? "mono" : ""}>{fmt ? fmt(c.v) : String(c.v)}</strong>
                  <span className="small muted">{whereWords(fkey, c)}</span>
                </button>
              ))}
              <div className="pv-acts">
                {onUse && shown && <Btn kind="primary" onClick={() => { onUse(shown); onClose(); }}>Use {fmt ? fmt(shown.v) : String(shown.v)}</Btn>}
                {onType && <Btn onClick={() => { onType(); onClose(); }}>None of these, type it in</Btn>}
              </div>
            </aside>
          )}
          <section className="pv-page" aria-label="PDF page">
            <div className="row gap-s wrap pv-bar">
              {!isImg && <><button type="button" className="btn btn-secondary pv-nav" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>&#8249;</button>
                <strong>Page {page} of {total}</strong>
                <button type="button" className="btn btn-secondary pv-nav" aria-label="Next page" disabled={page >= total} onClick={() => setPage(page + 1)}>&#8250;</button></>}
              <span className="small muted pv-hint">{box ? "The box marks the line the value was read from." : st.busy ? "Opening the file..." : `Line ${cur}: ${lineText(fixture.lines, cur).slice(0, 90)}`}</span>
            </div>
            {st.err ? <div className="note note-bad small">The file could not be shown here: {st.err} The text we read is on the review screen.</div> : (
              <div className="pv-sheet">
                {isImg ? <img src={urlRef.current || fixture.localUrl} alt={`${fixture.fileName || "Policy"}, page ${page}`} /> : <canvas ref={canvasRef} />}
                {box && <div className="pv-box" style={{ left: `${box[0] * 100 - 0.6}%`, top: `${box[1] * 100 - 0.4}%`, width: `${(box[2] - box[0]) * 100 + 1.2}%`, height: `${(box[3] - box[1]) * 100 + 0.8}%` }}><span>Line {cur}</span></div>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// Positions for a saved document's lines, matched by text against a fresh reading of the same file.
function matchGeo(saved, fresh) {
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const out = [];
  let k = 0;
  for (const s of saved || []) {
    const t = norm(s);
    let found = null;
    for (let j = k; j < Math.min(fresh.length, k + 40); j++) if (norm(fresh[j].text) === t) { found = fresh[j]; k = j + 1; break; }
    out.push(found && found.g ? [found.page, ...found.g] : null);
  }
  return out;
}
