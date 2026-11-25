// A name box that offers the people who can sign in. A name that is not among them can still be typed.
import { useState } from "react";

export function NamePick({ id, value, people, onType, onPick }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const words = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = people.filter((p) => words.every((w) => `${p.name} ${p.email || ""} ${p.note || ""}`.toLowerCase().includes(w)));
  const show = open && list.length > 0;
  const pick = (p) => { onPick(p); setOpen(false); setHi(-1); };
  const key = (e) => {
    if (e.key === "ArrowDown" && list.length) { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && show && list[hi]) { e.preventDefault(); pick(list[hi]); }
    else if (e.key === "Escape") setOpen(false);
  };
  return (
    <div className="spick">
      <input id={id} type="text" role="combobox" aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={show && list[hi] ? `${id}-opt-${hi}` : undefined} autoComplete="off"
        placeholder={people.length ? "Type or pick a name" : undefined} value={value} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={key} onChange={(e) => { onType(e.target.value); setOpen(true); setHi(-1); }} />
      {show && <ul id={`${id}-list`} role="listbox" className="spick-list">{list.map((p, i) => (
        <li key={p.id || "owner"} id={`${id}-opt-${i}`} role="option" aria-selected={i === hi} className={`spick-opt ${i === hi ? "hi" : ""}`} onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseEnter={() => setHi(i)}>
          <strong>{p.name}</strong><div className="small muted">{[p.note, p.email, p.code && `code ${p.code}`].filter(Boolean).join(" · ")}</div></li>))}</ul>}
    </div>
  );
}
