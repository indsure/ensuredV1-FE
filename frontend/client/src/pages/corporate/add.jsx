// Add a policy, PDF first: read the document, match the insured, insurer, branch and policy type, ask only
// for what is missing, then review the values. The step-by-step wizard stays for anyone who prefers it.
import { useState, useEffect } from "react";
import { DEPARTMENTS, FIXTURES, FIELDS, fixtureById, isVesselType, isWC, LIVE } from "./data.js";
import { nowIso, missingFields, insurerOf, isNum, plural } from "./lib.js";
import { sameInsurer, insurerKey } from "./tidy.js";
import { useApp, SearchPick, PlaceFields, Card, Btn, Labeled, Select, AskFirst, Pill } from "./ui.jsx";
import { OcrReview, PdfAttach, sameName, DocPane } from "./review.jsx";
import { placeOf } from "./places.js";
import { loadTexts, docText, fileBlobUrl } from "./store.js";

// Saves a new policy and its first term. Shared by this screen and the step-by-step wizard.
// Everything happens in ONE update: React may run a second queued update later, after we navigate.
// newCustomer(d) creates the customer in that same update and returns its id.
export function createPolicy({ update, log, toast, go, who }, s0, fx, pl0, confirm, newCustomer) {
  let pid, tid;
  const { payment, ...pl } = pl0;
  update((d) => {
    const s = newCustomer ? { ...s0, customerId: newCustomer(d) } : s0;
    const cust = d.customers.find((x) => x.id === s.customerId);
    if (cust.cse !== s.cse || (cust.rm || "") !== (s.rm || "")) { cust.cse = s.cse; cust.rm = s.rm; log(d, { customerId: cust.id, action: "Team assigned", detail: `CSC ${s.cse}, RM ${s.rm || "none"}.` }); }
    pid = `P${++d.seq}`; tid = `T${++d.seq}`;
    const docId = `DOC${++d.seq}`;
    const n = d.policies.length + 1;
    d.documents.push(fx.extracted
      ? { id: docId, customerId: s.customerId, policyId: pid, termId: tid, kind: "Policy schedule", name: fx.fileName, fixtureId: null, lines: fx.lines, textId: fx.textId, fixtureFields: fx.fields, info: fx.info, extracted: true, userFile: { name: fx.fileName, size: fx.fileSize, fileId: fx.fileId || null }, addedAt: nowIso(), addedBy: who, note: fx.noText ? "No readable text; values entered by hand" : fx.ocr ? "Scan read with OCR in the browser" : "Text read in the browser" }
      : { id: docId, customerId: s.customerId, policyId: pid, termId: tid, kind: "Policy schedule", name: `${fx.title}.pdf`, fixtureId: fx.id, addedAt: nowIso(), addedBy: who, note: "" });
    d.policies.push({ id: pid, controlNo: `CN-${String(n).padStart(4, "0")}`, customerId: s.customerId, dept: s.dept, type: s.type, insurerId: s.insurerId, branchId: s.branchId, cover: s.cover || "", vesselMode: s.vesselMode || "", termIds: [tid] });
    // Fields that belong to other policy types (for example liability limits on a fire policy) are not kept.
    // Workmen's Compensation has no sum insured, so the term says so for every later check.
    const values = { ...(pl.values || {}) }, sources = { ...(pl.sources || {}) };
    FIELDS.forEach((f) => { if (f.only && !f.only(s.type) && values[f.key] !== undefined) { values[f.key] = ""; delete sources[f.key]; } });
    values.sumInsuredNA = isWC(s.type);
    // Vessels named on the document start the first vessel schedule. Only what the reader found, never invented.
    const found = isVesselType(s.type) ? (fx.info?.vessels || []).filter((x) => x && String(x.name || "").trim()) : [];
    const vesselSchedules = found.length ? [{ version: 1, effectiveFrom: values.riskStart || "", vessels: found.map((x) => ({ name: String(x.name).trim(), imo: x.imo ? String(x.imo).trim() : "", gt: isNum(x.gt) ? +x.gt : "" })), change: null, at: nowIso(), by: who, fromDoc: docId }] : [];
    d.terms.push({ id: tid, policyId: pid, termNo: 1, prevTermId: null, nextTermId: null, status: confirm ? "confirmed" : "draft", cancelled: false, nr: "New", outcome: "Open", lossDetail: "", instalments: [], receipts: [], endorsements: [], vesselSchedules, cargoDecls: [], charterDecls: [], docId, ...pl, values, sources });
    if (confirm && payment && +pl.values?.netPremium > 0) {
      d.terms[d.terms.length - 1].receipts.push({ id: `R${++d.seq}`, instNo: null, date: payment.date, amount: +pl.values.netPremium, mode: payment.mode, ref: payment.ref, bank: "", remitDate: "", proofDocId: null });
      log(d, { customerId: s.customerId, policyId: pid, termId: tid, action: "Full payment recorded", detail: `Paid in full when the policy was added: ${pl.values.netPremium} on ${payment.date}.` });
    }
    if (found.length) log(d, { customerId: s.customerId, policyId: pid, termId: tid, action: "Vessel schedule started", detail: `${plural(found.length, "vessel")} taken from ${fx.title || fx.fileName}: ${found.map((x) => String(x.name).trim()).join(", ")}. Check them on the Marine tab.` });
    log(d, { customerId: s.customerId, policyId: pid, termId: tid, action: confirm ? "Term confirmed" : "Draft saved", detail: confirm ? `New business confirmed after review of ${fx.title || fx.fileName}.` : `Draft saved from ${fx.title || fx.fileName}. Missing: ${missingFields(d.terms[d.terms.length - 1], s.type).join(", ") || "none"}` });
  });
  toast(confirm ? "Policy confirmed and added to the register" : "Draft saved. It is listed under Today until complete");
  go({ view: "policy", id: pid, termId: tid });
}

const flat = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const ALL_TYPES = Object.entries(DEPARTMENTS).flatMap(([dept, types]) => types.map((type) => ({ dept, type })));
// Words that name a policy type without spelling it out in full.
const TYPE_HINTS = [
  [/charterers? (p and i|liability|legal liability)|charterers p and i club/, "Charterers Liability"],
  [/protection and indemnity|shipowners? p and i|owners p and i|\bp and i\b(?! club| association)/, "Protection & Indemnity"],
  [/hull and machinery|\bhull\b|inland vessels?|\bh and m\b/, "Marine Hull & Machinery"],
  [/multi ?modal transport|mto liability|multimodal transport operator/, "Multi Model Transport Operator"],
  [/directors and officers|\bd and o\b/, "Directors and Officers Liability Insurance"],
  [/professional indemnity/, "Professional Indemnity Insurance"],
  [/workm[ae]n'?s? compensation|employees? compensation/, "Workmens Compensation Policy"],
  [/group personal accident|group accident/, "Group Personal Accident Policy"],
  [/group mediclaim|group health/, "Group Mediclaim Policy"], [/family floater/, "Health Family Floater Policy"],
  [/errors and omm?issions/, "Errors and Ommissions Insurance"],
  [/(sookshma|laghu) udyam|bharat griha raksha|standard fire|fire and special perils|\bsfsp\b/, "Standard Fire and Special Perils"],
  [/marine cargo open|open (policy|cover)/, "Marine Cargo - Open Policy"],
  [/marine (cargo )?specific|single (transit|voyage)|completion of the voyage|institute cargo clauses/, "Marine Cargo - Specific Policy"],
  [/burglary/, "Burglary Insurance"], [/private car package|motor private car/, "Motor Private Car Package Policy"], [/event cancellation/, "Event Cancellation Insurance"],
];

// Reads who, which insurer and what kind of policy from the document. Each guess says where it came from.
export function suggestFromDocument(db, fx) {
  const text = flat((fx.lines || []).join(" "));
  const out = {};
  // Insured: the labelled name first, then any existing customer named anywhere in the text.
  const named = fx.info?.insured || fx.customer?.name?.v || "";
  const byName = named ? db.customers.filter((c) => sameName(c.name, named)) : [];
  const byText = byName.length ? [] : db.customers.filter((c) => text.includes(flat(c.name)));
  const hits = byName.length ? byName : byText;
  out.insuredName = named || (hits[0]?.name ?? "");
  // City: a labelled city, else the place just before the PIN code in the address.
  const addr = fx.customer?.address?.v || "";
  out.city = fx.customer?.city?.v || (addr.match(/([A-Za-z][A-Za-z ]{1,30}?)\s*[-,]?\s*\d{6}\b/)?.[1] || "").trim().split(/\s*,\s*/).pop();
  if (hits.length === 1) out.customerId = hits[0].id;
  // Insurer: its name, minus the generic words, appears in the text.
  const insHit = db.insurers.filter((i) => text.includes(flat(i.name).replace(/ (general )?(insurance|assurance)( company)?( limited| ltd)?$/, "")));
  // Several hits that are one company listed twice (or the printed name matches one of them): use one, never none.
  const printed = fx.info?.insurer;
  const insPick = insHit.length === 1 ? insHit[0]
    : (printed && sameInsurer(insHit.length ? insHit : db.insurers, printed))
    || (insHit.length > 1 && insHit.every((i) => insurerKey(i.name) === insurerKey(insHit[0].name)) ? insHit[0] : null);
  if (insPick) {
    out.insurerId = insPick.id;
    const brs = insPick.branches;
    const office = fx.info?.branch;
    const byOffice = office && brs.find((b) => flat(b.name) === flat(office.name) || (office.code && flat(b.name).includes(office.code)));
    const br = byOffice || brs.find((b) => text.includes(flat(b.name))) || (brs.filter((b) => text.includes(flat(b.city))).length === 1 ? brs.find((b) => text.includes(flat(b.city))) : null) || (brs.length === 1 ? brs[0] : null);
    if (br) out.branchId = br.id;
  }
  // Policy type: a sample says it outright; otherwise the longest type name in the text, then known short forms.
  if (fx.type) { out.type = fx.type; out.dept = fx.dept; out.typeFrom = fx.typeFrom === "document" ? "document" : "sample"; }
  else {
    const head = flat((fx.lines || []).slice(0, 80).join(" "));
    for (const region of [head, text]) {
      const hint = TYPE_HINTS.find(([re]) => re.test(region));
      const full = ALL_TYPES.filter((x) => region.includes(flat(x.type))).sort((a, b) => b.type.length - a.type.length)[0];
      const pick = (hint && ALL_TYPES.find((x) => x.type === hint[1])) || full;
      if (pick) { out.type = pick.type; out.dept = pick.dept; out.typeFrom = "document"; break; }
    }
  }
  return out;
}

export const cleanInsurer = (s) => String(s).replace(/\((fictional|sample)\)/gi, "").replace(/[\s,]*\b(co\.?|company)?\s*\b(ltd|limited)\b\.?\s*$/i, "").replace(/[\s,.-]+$/, "").replace(/\s+/g, " ").trim().replace(/\b([A-Z])([A-Z]+)\b/g, (m, a, b) => a + b.toLowerCase());

// A tag saying where a value came from. With a line number it jumps to that line in the document beside it.
const Found = ({ ok, children, line, onShow }) => (line && onShow
  ? <button type="button" className={`src src-btn ${ok ? "src-ok" : "src-miss"}`} title="Show this line on the policy" onClick={() => onShow(line)}>{children} · line {line}</button>
  : <span className={`src ${ok ? "src-ok" : "src-miss"}`}>{children}</span>);

export function QuickAdd({ inboxId }) {
  const app = useApp();
  const { db, can, go, log, update, toast } = app;
  const [fx, setFx] = useState(null);
  const [s, setS] = useState(null);
  const [guess, setGuess] = useState({});
  const [hl, setHl] = useState(null);
  const [nc, setNc] = useState({ name: "", city: "", state: "", country: "India", vertical: "Corporate" });
  const [tried, setTried] = useState(false);
  const [extra, setExtra] = useState({ insName: "", brName: "", brCity: "", cseCode: "", cseName: "" });
  const [extraErr, setExtraErr] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const draft = inboxId ? (db.inbox || []).find((x) => x.id === inboxId) : null;
  const waiting = db.inbox || [];
  // Opened from Drafts: bring back its text and original file, then carry on as if it had just been read.
  useEffect(() => {
    if (!draft) return;
    let on = true;
    (async () => {
      await loadTexts([draft.id]);
      if (!on) return;
      start({ ...draft, inboxId: draft.id, textId: draft.id, lines: docText(draft) || [], extracted: true, title: draft.fileName });
      if (draft.fileId) { const url = await fileBlobUrl(draft.fileId); if (on && url) setFx((x) => (x ? { ...x, localUrl: url, localIsImage: !/\.pdf$/i.test(draft.fileName) } : x)); }
    })();
    return () => { on = false; };
  }, [inboxId]);
  if (!can("newBusiness")) return <div className="stack"><h1>Add a policy</h1><p>Your role cannot add policies.</p></div>;
  if (inboxId && !draft) return <div className="stack"><h1>Draft not found</h1><p>It may already have been approved or deleted.</p><div><Btn onClick={() => go({ view: "drafts" })}>Back to Drafts</Btn></div></div>;

  const start = (x) => {
    const g = suggestFromDocument(db, x);
    const c = db.customers.find((y) => y.id === g.customerId);
    setFx(x); setGuess(g); setTried(false); setReviewing(false);
    setS({ customerId: g.customerId || (g.insuredName ? "NEW" : ""), cse: c?.cse || "", rm: c?.rm || "", insurerId: g.insurerId || "", branchId: g.branchId || "", dept: g.dept || "", type: g.type || "", cover: "", vesselMode: "" });
    const place = placeOf(g.city);
    setNc({ name: g.insuredName || "", city: g.city || "", state: place?.state || "", country: place?.country || "India", vertical: "Corporate" });
    const office = x.info?.branch;
    setExtra({ insName: cleanInsurer(x.info?.insurer || ""), brName: office?.name || "", brCity: office?.city || "", cseCode: "", cseName: "" }); setExtraErr("");
  };
  const set = (k) => (v) => setS((x) => {
    const n = { ...x, [k]: v };
    if (k === "insurerId") n.branchId = "";
    if (k === "dept") n.type = "";
    if (k === "customerId") { const c = db.customers.find((y) => y.id === v); n.cse = c?.cse || ""; n.rm = c?.rm || ""; }
    return n;
  });
  const isNew = s?.customerId === "NEW";
  const ins = s && insurerOf(db, s.insurerId);
  const team = (role) => db.team.filter((t) => t.role === role && t.active !== false).map((t) => ({ value: t.code, label: `${t.name} (${t.code})` }));
  const dup = isNew && nc.name.trim() && db.customers.find((c) => sameName(c.name, nc.name));
  const errs = s ? {
    customer: !s.customerId ? "Choose the customer, or add a new one" : isNew && !nc.name.trim() ? "Enter the insured name" : dup ? `Already exists as ${dup.code}. Choose ${dup.name} instead.` : null,
    city: isNew && !nc.city.trim() ? "Enter the city" : null,
    cse: !s.cse ? "Assign a CSC" : null,
    insurer: !s.insurerId ? "Choose the insurer" : null,
    branch: s.insurerId && !s.branchId ? "Choose the branch" : null,
    type: !s.dept ? "Choose the department" : !s.type ? "Choose the policy type" : null,
  } : {};
  const todo = Object.values(errs).filter(Boolean);
  const customerName = isNew ? nc.name.trim() : db.customers.find((c) => c.id === s?.customerId)?.name;

  const canAdd = can("addBranch");
  const newId = (p) => `${p}${Date.now().toString(36).toUpperCase()}`;
  const addInsurer = () => {
    const name = extra.insName.trim();
    if (!name) return setExtraErr("Enter the insurer's name");
    const same = sameInsurer(db.insurers, name);
    if (same) { set("insurerId")(same.id); return setExtraErr(""); }
    const id = newId("INS");
    update((d) => { d.insurers.push({ id, name, branches: [] }); log(d, { action: "Insurer added", detail: `${name}, from ${fx.fileName || fx.title}.` }); });
    setS((x) => ({ ...x, insurerId: id, branchId: "" })); setExtraErr(""); toast("Insurer added");
  };
  const addBranch = () => {
    const name = extra.brName.trim(), city = extra.brCity.trim();
    if (!name || !city) return setExtraErr("Enter the branch name and city");
    const same = ins.branches.find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (same) { set("branchId")(same.id); return setExtraErr(""); }
    const id = newId("BR");
    const place = placeOf(city);
    update((d) => { d.insurers.find((i) => i.id === ins.id).branches.push({ id, name, city, state: place?.state || "", country: place?.country || "India" }); log(d, { action: "Branch added", detail: `${name} (${city}) for ${ins.name}.` }); });
    setS((x) => ({ ...x, branchId: id })); setExtraErr(""); toast("Branch added");
  };
  const addCse = () => {
    const code = extra.cseCode.trim().toUpperCase(), name = extra.cseName.trim();
    if (!code || !name) return setExtraErr("Enter the CSC code and name");
    if (/\s/.test(code)) return setExtraErr("Codes cannot contain spaces");
    if (db.team.some((t) => t.code.toLowerCase() === code.toLowerCase())) return setExtraErr("That code is already used");
    update((d) => { d.team.push({ code, name, role: "CSC", active: true }); log(d, { action: "Team member added", detail: `${name} (${code}) as CSC.` }); });
    setS((x) => ({ ...x, cse: code })); setExtraErr(""); toast("CSC added");
  };
  const toReview = () => { setTried(true); if (!todo.length) setReviewing(true); };
  const addCustomer = (d) => {
    const cid = `C${++d.seq}`; const code = `CUST-${1000 + d.customers.length + 1}`;
    d.customers.push({ id: cid, code, name: nc.name.trim(), vertical: nc.vertical, address: fx.customer?.address?.v || "", city: nc.city.trim(), state: (nc.state || "").trim(), country: (nc.country || "India").trim(), phone: fx.customer?.phone?.v || "", email: fx.customer?.email?.v || "", gst: fx.customer?.gst?.v || "", source: "Direct", referral: "", tags: [], cse: s.cse, rm: s.rm, createdAt: nowIso() });
    log(d, { customerId: cid, action: "Customer created", detail: `${nc.name.trim()} created as ${code} from ${fx.fileName || fx.title}.` });
    return cid;
  };
  // From a draft: approving takes you straight to the next one.
  const nextAfter = () => { const i = waiting.findIndex((x) => x.id === inboxId); return waiting[i + 1] || waiting[i - 1] || null; };
  const finish = (pl, confirm) => {
    if (!inboxId) return createPolicy(app, s, fx, pl, confirm, isNew ? addCustomer : null);
    const next = nextAfter();
    createPolicy({ ...app, go: () => {} }, s, fx, pl, confirm, isNew ? addCustomer : null);
    update((d) => { d.inbox = (d.inbox || []).filter((x) => x.id !== inboxId); });
    go(next ? { view: "add", inboxId: next.id, nonce: Date.now() } : { view: "drafts" });
  };

  if (reviewing) return <OcrReview fixture={fx} customerName={customerName} insurerId={s.insurerId} branchId={s.branchId} policyType={s.type} heading={`Add a policy: ${customerName}, ${s.type}`} askPayment confirmLabel={inboxId ? (waiting.length > 1 ? "Confirm and next" : "Confirm record") : undefined} onCancel={() => setReviewing(false)} onSaveDraft={(pl) => finish(pl, false)} onConfirm={(pl) => finish(pl, true)} />;

  // Which line each value came from, for the tags.
  const lineOf = (text) => { const t = String(text || "").toLowerCase().trim(); if (!t) return null; const i = (fx?.lines || []).findIndex((l) => String(l).toLowerCase().includes(t)); return i >= 0 ? i + 1 : null; };
  const lines = { insured: fx?.customer?.name?.ref || lineOf(guess?.insuredName), insurer: lineOf(String(fx?.info?.insurer || "").split(/\s+/).filter((w) => !/^the$/i.test(w)).slice(0, 2).join(" ")), branch: fx?.info?.branch?.ref || null, city: fx?.customer?.city?.ref || lineOf(guess?.city), type: lineOf(guess?.type) };
  const hintFor = (key, ok, label) => (fx ? <Found ok={ok} line={ok ? lines[key] : null} onShow={setHl}>{ok ? label : "Not on the policy, please choose"}</Found> : null);
  const hasDoc = !!(fx?.lines?.length);
  return (
    <div className="stack">
      {inboxId && <div className="note row between wrap gap-s"><span><strong>Draft {waiting.findIndex((x) => x.id === inboxId) + 1} of {waiting.length}:</strong> {draft?.fileName}</span><div className="row gap-s wrap"><Btn onClick={() => go({ view: "drafts" })}>Back to Drafts</Btn>{nextAfter() && <Btn onClick={() => go({ view: "add", inboxId: nextAfter().id, nonce: Date.now() })}>Skip to next</Btn>}</div></div>}
      <header className="page-head"><div><h1>Add a policy</h1><p className="muted">Attach the policy document. Its details are read for you to check and complete. Nothing is saved until you confirm.</p></div>
        <div className="row gap-s">{fx && !inboxId && <AskFirst label="Start again" question="Clear this document?" yes="Clear" onYes={() => { setFx(null); setS(null); }} />}{!inboxId && <Btn onClick={() => go({ view: "new" })}>Fill in step by step</Btn>}</div></header>
      {!inboxId && <Card title="1. The policy document">
        <PdfAttach id="ap-file" ready={fx?.extracted ? fx : null} onReady={start} />
        {!LIVE && <div className="row gap-xs wrap small"><span className="muted">No PDF to hand? Try a sample:</span>{FIXTURES.filter((x) => x.kind === "Policy schedule").map((x) => <button key={x.id} className={`chipbtn ${fx?.id === x.id ? "on" : ""}`} onClick={() => start(fixtureById(x.id))}>{x.title}</button>)}</div>}
      </Card>}
      {fx && s && (
        <div className={hasDoc ? "review-grid" : ""}>
        {hasDoc && <DocPane lines={fx.lines} title={fx.title || fx.fileName} highlight={hl} generated={fx.generated} extracted={fx.extracted} onLine={setHl} localUrl={fx.localUrl} localIsImage={fx.localIsImage} readPages={fx.readPages} pages={fx.pages} />}
        <Card title={inboxId ? "Check what we read" : "2. Check what we read"} sub={todo.length ? `${todo.length} thing${todo.length === 1 ? "" : "s"} to fill before checking the values.` : "All filled. Check it against the policy, then go on."}
          actions={<Pill tone={todo.length ? "warn" : "good"}>{todo.length ? `${todo.length} to fill` : "Ready"}</Pill>}>
          <div className="formgrid">
            <Labeled label="Insured (customer)" htmlFor="ap-cust" req error={tried && errs.customer} hint={!fx ? null : guess.customerId ? <Found ok line={lines.insured} onShow={setHl}>Already one of your customers</Found> : isNew && guess.insuredName ? <span className="src src-info">Not an existing customer. It will be added</span> : <Found ok={false}>Not on the policy, please choose</Found>}>
              <Select id="ap-cust" value={s.customerId} onChange={set("customerId")} placeholder="Choose customer" options={[...(guess.insuredName ? [{ value: "NEW", label: `New customer: ${guess.insuredName}` }] : [{ value: "NEW", label: "New customer" }]), ...db.customers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))]} />
            </Labeled>
            {isNew && <>
              <Labeled label="Insured name" htmlFor="ap-nname" req error={tried && (errs.customer && isNew ? errs.customer : null)} hint={guess.insuredName ? <Found ok line={lines.insured} onShow={setHl}>Read from the policy</Found> : null}><input id="ap-nname" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></Labeled>
              <PlaceFields id="ap-n" value={{ city: nc.city, state: nc.state, country: nc.country }} req cityError={tried && errs.city}
                cityHint={nc.city && nc.city === guess.city ? <Found ok line={lines.city} onShow={setHl}>Read from the policy</Found> : null} onChange={(p) => setNc({ ...nc, ...p })} />
              <Labeled label="Customer type" htmlFor="ap-nvert"><Select id="ap-nvert" value={nc.vertical} onChange={(v) => setNc({ ...nc, vertical: v })} options={["Corporate", "Retail"]} /></Labeled>
            </>}
            <Labeled label="CSC" htmlFor="ap-cse" req error={tried && errs.cse} hint={s.cse && !isNew ? "From this customer's record" : "The team member responsible for this customer. Type a name or code"}><SearchPick id="ap-cse" value={s.cse} onChange={set("cse")} options={team("CSC")} noun="CSC" /></Labeled>
            <Labeled label="RM" htmlFor="ap-rm" hint="Optional"><SearchPick id="ap-rm" value={s.rm} onChange={set("rm")} options={team("RM")} noun="RM" emptyLabel="Not assigned" /></Labeled>
            <Labeled label="Insurer" htmlFor="ap-ins" req error={tried && errs.insurer} hint={!guess.insurerId && !s.insurerId && fx?.info?.insurer ? <Found ok line={lines.insurer} onShow={setHl}>The policy says {fx.info.insurer.replace(/\.$/, "")}. Not in your list yet, add it below</Found> : hintFor("insurer", !!guess.insurerId && s.insurerId === guess.insurerId, "Read from the policy")}><Select id="ap-ins" value={s.insurerId} onChange={set("insurerId")} placeholder="Choose insurer" options={db.insurers.map((i) => ({ value: i.id, label: i.name }))} /></Labeled>
            <Labeled label="Insurer branch" htmlFor="ap-br" req error={tried && errs.branch} hint={s.insurerId ? hintFor("branch", !!guess.branchId && s.branchId === guess.branchId, "Read from the policy") : null}><Select id="ap-br" value={s.branchId} onChange={set("branchId")} disabled={!ins} placeholder={ins ? "Choose branch" : "Choose insurer first"} options={(ins?.branches || []).map((b) => ({ value: b.id, label: `${b.name}, ${b.city}` }))} /></Labeled>
            <Labeled label="Department" htmlFor="ap-dept" req error={tried && !s.dept ? errs.type : null}><Select id="ap-dept" value={s.dept} onChange={set("dept")} placeholder="Choose department" options={Object.keys(DEPARTMENTS)} /></Labeled>
            <Labeled label="Policy type" htmlFor="ap-type" req error={tried && s.dept && !s.type ? errs.type : null} hint={hintFor("type", !!guess.type && s.type === guess.type, guess.typeFrom === "sample" ? "From the sample" : "Suggested from the policy")}><Select id="ap-type" value={s.type} onChange={set("type")} disabled={!s.dept} placeholder={s.dept ? "Choose policy type" : "Choose department first"} options={DEPARTMENTS[s.dept] || []} /></Labeled>
            {isVesselType(s.type) && <Labeled label="Vessel cover" htmlFor="ap-vm"><Select id="ap-vm" value={s.vesselMode} onChange={set("vesselMode")} placeholder="Choose" options={["Individual vessel", "Fleet"]} /></Labeled>}
          </div>
          {canAdd && fx && !s.insurerId && (
            <div className="boxed stack inline-add">
              <div className="small"><strong>Insurer not in your list?</strong> {fx.info?.insurer ? <>The policy names <em>{fx.info.insurer.replace(/\.$/, "")}</em>.</> : "Add it here."}</div>
              <div className="row gap-s wrap" style={{ alignItems: "flex-end" }}>
                <Labeled label="Insurer name" htmlFor="ap-new-ins"><input id="ap-new-ins" value={extra.insName} onChange={(e) => setExtra({ ...extra, insName: e.target.value })} /></Labeled>
                <Btn onClick={addInsurer}>Add insurer</Btn>
              </div>
            </div>)}
          {canAdd && ins && !s.branchId && (
            <div className="boxed stack inline-add">
              <div className="small"><strong>Branch not listed for {ins.name}?</strong> Add the office that issued this policy.</div>
              <div className="row gap-s wrap" style={{ alignItems: "flex-end" }}>
                <Labeled label="Branch" htmlFor="ap-new-br"><input id="ap-new-br" value={extra.brName} onChange={(e) => setExtra({ ...extra, brName: e.target.value })} /></Labeled>
                <Labeled label="City" htmlFor="ap-new-brcity"><input id="ap-new-brcity" value={extra.brCity} onChange={(e) => setExtra({ ...extra, brCity: e.target.value })} /></Labeled>
                <Btn onClick={addBranch}>Add branch</Btn>
              </div>
            </div>)}
          {canAdd && !team("CSC").length && (
            <div className="boxed stack inline-add">
              <div className="small"><strong>No CSCs yet.</strong> Add one here, or your whole team under Lists and team (Admin only).</div>
              <div className="row gap-s wrap" style={{ alignItems: "flex-end" }}>
                <Labeled label="CSC code" htmlFor="ap-new-csecode"><input id="ap-new-csecode" value={extra.cseCode} onChange={(e) => setExtra({ ...extra, cseCode: e.target.value })} /></Labeled>
                <Labeled label="Name" htmlFor="ap-new-csename"><input id="ap-new-csename" value={extra.cseName} onChange={(e) => setExtra({ ...extra, cseName: e.target.value })} /></Labeled>
                <Btn onClick={addCse}>Add CSC</Btn>
              </div>
            </div>)}
          {extraErr && <div className="err-text small" role="alert">{extraErr}</div>}
          {tried && todo.length > 0 && <div className="note note-warn small"><strong>Still needed:</strong> {todo.join("; ")}.</div>}
          <div className="row gap-s wrap"><Btn kind="primary" onClick={toReview}>Next: check the figures</Btn><span className="small muted">Policy number, dates and amounts come next.</span></div>
          <p className="small muted">If a match is wrong, change it here before continuing.</p>
        </Card>
        </div>
      )}
    </div>
  );
}
