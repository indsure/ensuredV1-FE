// Small shared UI pieces.
import { useState, useEffect, useLayoutEffect, useRef, createContext, useContext } from "react";
import { placeOf, searchCities, lookupPlace, COUNTRIES } from "./places.js";
import { parseDateText } from "./extract.js";
import { fmtDate } from "./lib.js";
import { tipFor } from "./glossary.js";

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function Pill({ tone = "muted", children, title }) {
  return <span className={`pill pill-${tone}`} title={title}>{children}</span>;
}

export function Card({ title, actions, children, className = "", sub }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div><h3>{title}{typeof title === "string" && <Tip k={title} />}</h3>{sub && <p className="muted small">{sub}</p>}</div>
          {actions && <div className="row gap-s wrap">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ title, children }) {
  return <div className="empty"><strong>{title}</strong>{children && <div className="muted">{children}</div>}</div>;
}

export function Btn({ kind = "secondary", children, disabled, why, ...rest }) {
  return (
    <button type="button" className={`btn btn-${kind}`} disabled={disabled} title={disabled && why ? why : rest.title} {...rest}>
      {children}
    </button>
  );
}

// The (i) beside a word. It explains the word in plain language on hover, focus or tap.
export function Tip({ k, text }) {
  const body = text || tipFor(k);
  const btn = useRef(null);
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!pos) return;
    const close = (e) => { if (e.type !== "keydown" || e.key === "Escape") setPos(null); };
    window.addEventListener("scroll", close, true); window.addEventListener("keydown", close); window.addEventListener("mousedown", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("keydown", close); window.removeEventListener("mousedown", close); };
  }, [pos]);
  if (!body) return null;
  const show = () => { const r = btn.current.getBoundingClientRect(); const w = Math.min(300, window.innerWidth - 24); setPos({ left: Math.max(12, Math.min(r.left - 8, window.innerWidth - w - 12)), top: r.bottom + 6, below: r.bottom + 170 < window.innerHeight, up: window.innerHeight - r.top + 6, width: w }); };
  return (
    <>
      <button type="button" ref={btn} className="tip" aria-label={`What does ${k || "this"} mean?`} aria-expanded={!!pos} onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!pos) show(); }}>i</button>
      {pos && <span role="tooltip" className="tip-pop" style={pos.below ? { left: pos.left, top: pos.top, width: pos.width } : { left: pos.left, bottom: pos.up, width: pos.width }}>{body}</span>}
    </>
  );
}

export function Labeled({ label, htmlFor, children, hint, error, req, wide }) {
  return (
    <div className={`fld ${wide ? "fld-wide" : ""} ${error ? "fld-err" : ""}`}>
      <div className="fld-top"><label htmlFor={htmlFor}>{label}{req && <span className="req"> *</span>}</label><Tip k={typeof label === "string" ? label : ""} /></div>
      {children}
      {hint && !error && <div className="hint">{hint}</div>}
      {error && <div className="err-text" role="alert">{error}</div>}
    </div>
  );
}

export function Select({ id, value, onChange, options, placeholder, disabled }) {
  return (
    <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

// Type-to-search picker. Matches every word typed against name and code, e.g. "meera", "cse01", "rao rm".
export function SearchPick({ id, value, onChange, options, placeholder = "Type a name or code", emptyLabel, noun = "person" }) {
  const sel = options.find((o) => o.value === value);
  const [q, setQ] = useState(sel ? sel.label : "");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  useEffect(() => { setQ(sel ? sel.label : ""); }, [value, sel?.label]);
  const typing = !sel || q !== sel.label;
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = typing && words.length ? options.filter((o) => words.every((w) => o.label.toLowerCase().includes(w))) : options;
  const pick = (o) => { onChange(o ? o.value : ""); setQ(o ? o.label : ""); setOpen(false); };
  const close = () => {
    setOpen(false);
    if (!q.trim() && emptyLabel) { if (value) onChange(""); return; }
    if (typing && list.length === 1 && words.length) { pick(list[0]); return; }
    setQ(sel ? sel.label : "");
  };
  const key = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && open) { e.preventDefault(); if (list[hi]) pick(list[hi]); }
    else if (e.key === "Escape") { setQ(sel ? sel.label : ""); setOpen(false); }
  };
  const listId = `${id}-list`;
  return (
    <div className="spick">
      <input id={id} type="text" role="combobox" className={sel && !open ? "has-sel" : undefined} aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
        aria-activedescendant={open && list[hi] ? `${id}-opt-${hi}` : undefined}
        value={q} placeholder={sel ? undefined : placeholder}
        onFocus={(e) => { setOpen(true); setHi(0); e.target.select(); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onBlur={close} onKeyDown={key} />
      {sel && !open && <span className="spick-ok" aria-hidden="true">Selected</span>}
      {open && (
        <ul id={listId} role="listbox" className="spick-list">
          {emptyLabel && !words.length && <li role="option" aria-selected={!value} className="spick-opt muted" onMouseDown={(e) => { e.preventDefault(); pick(null); }}>{emptyLabel}</li>}
          {list.map((o, i) => (
            <li key={o.value} id={`${id}-opt-${i}`} role="option" aria-selected={o.value === value} className={`spick-opt ${i === hi ? "hi" : ""} ${o.value === value ? "on" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setHi(i)}>{o.label}</li>
          ))}
          {!list.length && <li className="spick-none">No {noun} matches "{q.trim()}". Try part of the name or the code.</li>}
        </ul>
      )}
    </div>
  );
}

// Inline confirmation (the viewer has no confirm() dialog).
export function AskFirst({ label, question, yes = "Yes", onYes, kind = "secondary", disabled, why }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Btn kind={kind} disabled={disabled} why={why} onClick={() => setOpen(true)}>{label}</Btn>;
  return (
    <span className="askfirst" role="group">
      <span>{question}</span>
      <Btn kind="danger" onClick={() => { setOpen(false); onYes(); }}>{yes}</Btn>
      <Btn onClick={() => setOpen(false)}>No, go back</Btn>
    </span>
  );
}

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="card-head"><h3>{title}</h3><Btn onClick={onClose}>Close</Btn></header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} className={`tab ${value === t.key ? "on" : ""}`} onClick={() => onChange(t.key)}>
          {t.label}{t.count != null && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function KV({ items }) {
  return (
    <dl className="kv">
      {items.map(([k, v], i) => (<div key={i}><dt>{k}</dt><dd>{v ?? "--"}</dd></div>))}
    </dl>
  );
}

// On a phone each row becomes a card, so every cell is labelled with its column heading (data-l).
export function Table({ children, className = "" }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const t = ref.current; if (!t) return;
    const heads = [];
    t.querySelectorAll("thead th").forEach((th) => { for (let k = 0; k < (th.colSpan || 1); k++) heads.push(th.textContent.trim()); });
    t.querySelectorAll("tbody tr, tfoot tr").forEach((tr) => { let i = 0; tr.querySelectorAll(":scope > td").forEach((td) => { td.dataset.l = td.colSpan > 1 ? "" : heads[i] || ""; i += td.colSpan || 1; }); });
  });
  return <div className="table-wrap"><table ref={ref} className={className}>{children}</table></div>;
}

// Line icons in the style of the IndSure portal (lucide-like, 2px stroke).
const ICONS = {
  home: ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75", { c: [9, 7, 4] }],
  plus: ["M12 5v14", "M5 12h14"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  x: ["M18 6 6 18", "m6 6 12 12"],
  wallet: ["M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5", "M16 13.5h.01"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8"],
  refresh: ["M21 12a9 9 0 1 1-3-6.7L21 8", "M21 3v5h-5"],
  chart: ["M3 3v18h18", "M7 15l4-4 3 3 5-6"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  lock: ["M7 11V7a5 5 0 0 1 10 0v4", { r: [3, 11, 18, 11] }],
  db: ["M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5", "M3 12c0 1.7 4 3 9 3s9-1.3 9-3", { e: [12, 5, 9, 3] }],
  rupee: ["M6 3h12", "M6 8h12", "M6 13l8.5 8", "M6 13h3a5 5 0 0 0 0-10"],
  percent: ["M19 5 5 19", { c: [6.5, 6.5, 2.5] }, { c: [17.5, 17.5, 2.5] }],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  help: ["M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01", { c: [12, 12, 10] }],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  sparkle: ["M12 3l1.9 5.8L20 10.7l-6.1 1.9L12 18.5l-1.9-5.9L4 10.7l6.1-1.9z"],
  search: ["M21 21l-4.3-4.3", { c: [11, 11, 8] }],
  check: ["M20 6 9 17l-5-5"],
  alert: ["M12 9v4", "M12 17h.01", "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"],
};
export function Icon({ name, size = 18 }) {
  const parts = ICONS[name] || [];
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {parts.map((p, i) => typeof p === "string" ? <path key={i} d={p} />
        : p.c ? <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} />
          : p.r ? <rect key={i} x={p.r[0]} y={p.r[1]} width={p.r[2]} height={p.r[3]} rx="2" />
            : <ellipse key={i} cx={p.e[0]} cy={p.e[1]} rx={p.e[2]} ry={p.e[3]} />)}
    </svg>
  );
}

// Shows a generated letter with Copy and Download. There is deliberately no Send: nothing leaves this browser.
export function DocModal({ doc, onClose }) {
  const [msg, setMsg] = useState("");
  const ref = useRef(null);
  const copy = async () => { try { await navigator.clipboard.writeText(doc.body); setMsg("Copied. Paste it into your email."); } catch (e) { ref.current?.select(); setMsg("Text selected. Press Ctrl+C to copy."); } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([doc.body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = doc.filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setMsg(`Downloaded ${doc.filename}`);
  };
  return (
    <Modal title={doc.title} onClose={onClose} wide>
      {doc.note && <div className="note small">{doc.note}</div>}
      <textarea ref={ref} className="docbox" readOnly value={doc.body} aria-label={doc.title} />
      <div className="row gap-s wrap"><Btn kind="primary" onClick={copy}>Copy text</Btn><Btn onClick={download}>Download .txt</Btn><span className="small" role="status">{msg}</span></div>
      <p className="small muted">Draft for a person to check and send. Nothing is sent from here.</p>
    </Modal>
  );
}

// City, State and Country together. Choosing a known city fills State and Country; all three stay editable.
// value = { city, state, country }; onChange receives the whole updated object.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const inWords = (iso) => { const [y, m, d] = iso.split("-"); return `${+d} ${MONTHS[+m - 1]} ${y}`; };
// A date box that takes what people paste from a policy: 14/08/26, 14-Aug-2026, 140826. Reads day first and
// asks when a date was pasted. Values stay as YYYY-MM-DD underneath; on screen it is always DD/MM/YYYY.
export function DateInput({ id, value, onChange, disabled, max, min, ...rest }) {
  const [text, setText] = useState(value ? fmtDate(value) : "");
  const [ask, setAsk] = useState(null);
  const [bad, setBad] = useState(false);
  const sent = useRef(value || "");
  useEffect(() => { if ((value || "") !== sent.current) { sent.current = value || ""; setText(value ? fmtDate(value) : ""); setAsk(null); setBad(false); } }, [value]);
  const emit = (iso) => { sent.current = iso; onChange({ target: { value: iso } }); };
  const take = (raw, pasted) => {
    setText(raw);
    const r = parseDateText(raw);
    if (r) { setBad(false); emit(r.iso); setAsk(pasted || r.monthFirst ? r : null); }
    else { setAsk(null); setBad(raw.trim().length >= 8); if (sent.current) emit(""); }
  };
  const blur = () => { const r = parseDateText(text); if (r) setText(fmtDate(r.iso)); else if (text.trim()) setBad(true); };
  const swap = () => { const r = { iso: ask.swapped, swapped: ask.iso, ambiguous: true }; emit(r.iso); setText(fmtDate(r.iso)); setAsk(r); };
  return (
    <span className="dateinput">
      <input id={id} type="text" inputMode="text" placeholder="DD/MM/YYYY" autoComplete="off" value={text} disabled={disabled} {...rest}
        onChange={(e) => take(e.target.value, false)} onBlur={blur}
        onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t) { e.preventDefault(); take(t, true); } }} />
      {bad && <span className="date-q err-text" role="alert">Enter the date as DD/MM/YYYY</span>}
      {ask && (
        <span className="date-q" role="status">
          Read as <strong>{inWords(ask.iso)}</strong>. Is this right?
          <button type="button" className="linkbtn" onClick={() => setAsk(null)}>Yes</button>
          {ask.swapped && <button type="button" className="linkbtn" onClick={swap}>No, it is {inWords(ask.swapped)}</button>}
        </span>
      )}
    </span>
  );
}

export function PlaceFields({ id, value, onChange, req, cityError, cityHint, countryReq }) {
  const latest = useRef(value); latest.current = value;
  const send = useRef(onChange); send.current = onChange;
  const autoState = useRef(""); // the state we filled ourselves, so a changed city can replace it
  const [focus, setFocus] = useState(false);
  const [list, setList] = useState([]);
  const [hi, setHi] = useState(0);
  const [filled, setFilled] = useState(false);
  const asked = useRef(0);
  const fill = (p, city) => { autoState.current = p.state; setFilled(true); send.current({ ...latest.current, city, state: p.state, country: p.country }); };
  const setCity = (city) => {
    const p = placeOf(city);
    if (p) fill(p, city);
    else {
      const stale = latest.current.state && latest.current.state === autoState.current;
      if (stale) { autoState.current = ""; setFilled(false); }
      onChange({ ...value, city, ...(stale ? { state: "" } : {}) });
    }
    const n = ++asked.current;
    setHi(0);
    if (city.trim().length < 2) { setList([]); return; }
    searchCities(city).then((r) => { if (n === asked.current) setList(r); }).catch(() => setList([]));
  };
  const pick = (p) => { asked.current++; setList([]); fill(p, p.city); };
  // A city typed by hand or read from a document, with no state yet: look it up once the person has left the box.
  useEffect(() => {
    const city = (value.city || "").trim();
    if (focus || !city || (value.state || "").trim()) return;
    let on = true;
    lookupPlace(city).then((p) => { if (on && p && !(latest.current.state || "").trim() && latest.current.city === value.city) fill(p, value.city); }).catch(() => {});
    return () => { on = false; };
  }, [value.city, value.state, focus]);
  const open = focus && list.length > 0;
  const key = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(list[hi]); }
    else if (e.key === "Escape") setList([]);
  };
  const lid = `${id}-city-list`;
  return (
    <>
      <Labeled label="City" htmlFor={`${id}-city`} req={req} error={cityError} hint={cityHint || "Any city in the world. Pick from the list, or just type it."}>
        <div className="spick">
          <input id={`${id}-city`} type="text" role="combobox" aria-expanded={open} aria-controls={lid} aria-autocomplete="list" autoComplete="off" value={value.city || ""}
            onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); setList([]); }} onChange={(e) => setCity(e.target.value)} onKeyDown={key} />
          {open && (
            <ul id={lid} role="listbox" className="spick-list">
              {list.map((p, i) => (
                <li key={`${p.city}|${p.state}|${p.country}`} role="option" aria-selected={i === hi} className={`spick-opt ${i === hi ? "hi" : ""}`}
                  onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseEnter={() => setHi(i)}>
                  <strong>{p.city}</strong>{[p.state, p.country].filter(Boolean).length ? <span className="muted">, {[p.state, p.country].filter(Boolean).join(", ")}</span> : null}
                </li>
              ))}
              <li role="presentation" className="spick-none small">City data: GeoNames (CC BY 4.0)</li>
            </ul>
          )}
        </div>
      </Labeled>
      <Labeled label="State" htmlFor={`${id}-state`} hint={filled && value.state && value.state === autoState.current ? "Filled from the city" : ""}>
        <input id={`${id}-state`} value={value.state || ""} onChange={(e) => onChange({ ...value, state: e.target.value })} />
      </Labeled>
      <Labeled label="Country" htmlFor={`${id}-country`} req={countryReq}>
        <input id={`${id}-country`} list="ic-countries" value={value.country || ""} autoComplete="off" onChange={(e) => onChange({ ...value, country: e.target.value })} />
      </Labeled>
    </>
  );
}
// The suggestion lists PlaceFields uses; rendered once by the app shell.
export function PlaceLists() {
  return (
    <>
      <datalist id="ic-countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
    </>
  );
}
