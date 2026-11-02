// Add a policy, PDF first: read the document, match the insured, insurer, branch and policy type, ask only
// for what is missing, then review the values. The step-by-step wizard stays for anyone who prefers it.
import { useState } from "react";
import { DEPARTMENTS, FIXTURES, fixtureById, isVesselType, LIVE } from "./data.js";
import { nowIso, missingFields, insurerOf } from "./lib.js";
import { useApp, SearchPick, Card, Btn, Labeled, Select, AskFirst, Pill, Confirm } from "./ui.jsx";
import { OcrReview, PdfAttach, sameName } from "./review.jsx";

// Saves a new policy and its first term. Shared by this screen and the step-by-step wizard.
// Everything happens in ONE update: React may run a second queued update later, after we navigate.
// newCustomer(d) creates the customer in that same update and returns its id.
export function createPolicy({ update, log, toast, go, who }, s0, fx, pl, confirm, newCustomer) {
  let pid, tid;
  update((d) => {
    const s = newCustomer ? { ...s0, customerId: newCustomer(d) } : s0;
    const cust = d.customers.find((x) => x.id === s.customerId);
    if (cust.cse !== s.cse || (cust.rm || "") !== (s.rm || "")) { cust.cse = s.cse; cust.rm = s.rm; log(d, { customerId: cust.id, action: "Team assigned", detail: `CSE ${s.cse}, RM ${s.rm || "none"}.` }); }
    pid = `P${++d.seq}`; tid = `T${++d.seq}`;
    const docId = `DOC${++d.seq}`;
    const n = d.policies.length + 1;
    d.documents.push(fx.extracted
      ? { id: docId, customerId: s.customerId, policyId: pid, termId: tid, kind: "Policy schedule", name: fx.fileName, fixtureId: null, lines: fx.lines, fixtureFields: fx.fields, info: fx.info, extracted: true, userFile: { name: fx.fileName, size: fx.fileSize, fileId: fx.fileId || null }, addedAt: nowIso(), addedBy: who, note: fx.noText ? "No readable text; values entered by hand" : "Text read in the browser" }
      : { id: docId, customerId: s.customerId, policyId: pid, termId: tid, kind: "Policy schedule", name: `${fx.title}.pdf`, fixtureId: fx.id, addedAt: nowIso(), addedBy: who, note: "" });
    d.policies.push({ id: pid, controlNo: `CN-${String(n).padStart(4, "0")}`, customerId: s.customerId, dept: s.dept, type: s.type, insurerId: s.insurerId, branchId: s.branchId, cover: s.cover || "", vesselMode: s.vesselMode || "", termIds: [tid] });
    d.terms.push({ id: tid, policyId: pid, termNo: 1, prevTermId: null, nextTermId: null, status: confirm ? "confirmed" : "draft", cancelled: false, nr: "New", outcome: "Open", lossDetail: "", instalments: [], receipts: [], endorsements: [], vesselSchedules: [], cargoDecls: [], charterDecls: [], docId, ...pl });
    log(d, { customerId: s.customerId, policyId: pid, termId: tid, action: confirm ? "Term confirmed" : "Draft saved", detail: confirm ? `New business confirmed after review of ${fx.title || fx.fileName}.` : `Draft saved from ${fx.title || fx.fileName}. Missing: ${missingFields(d.terms[d.terms.length - 1]).join(", ") || "none"}` });
  });
  toast(confirm ? "Policy confirmed and added to the register" : "Draft saved. It is listed under Today until complete");
  go({ view: "policy", id: pid, termId: tid });
}

const flat = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const ALL_TYPES = Object.entries(DEPARTMENTS).flatMap(([dept, types]) => types.map((type) => ({ dept, type })));
// Words that name a policy type without spelling it out in full.
const TYPE_HINTS = [
  [/charterers? (p and i|liability|legal liability)|charterers p and i club/, "Charterers Liability"],
  [/protection and indemnity|shipowners? p and i|owners p and i|\\bp and i\\b/, "Protection & Indemnity"],
  [/hull and machinery|\\bhull\\b/, "Marine Hull & Machinery"],
  [/multi ?modal transport|mto liability|multimodal transport operator/, "Multi Model Transport Operator"],
  [/directors and officers|\\bd and o\\b/, "Directors and Officers Liability Insurance"],
  [/professional indemnity/, "Professional Indemnity Insurance"],
  [/workm[ae]n'?s? compensation|employees? compensation/, "Workmens Compensation Policy"],
  [/group personal accident|group accident/, "Group Personal Accident Policy"],
  [/group mediclaim|group health/, "Group Mediclaim Policy"], [/family floater/, "Health Family Floater Policy"],
  [/errors and omm?issions/, "Errors and Ommissions Insurance"],
  [/(sookshma|laghu) udyam|bharat griha raksha|standard fire|fire and special perils|\\bsfsp\\b/, "Standard Fire and Special Perils"],
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
  if (insHit.length === 1) {
    out.insurerId = insHit[0].id;
    const brs = insHit[0].branches;
    const br = brs.find((b) => text.includes(flat(b.name))) || (brs.filter((b) => text.includes(flat(b.city))).length === 1 ? brs.find((b) => text.includes(flat(b.city))) : null) || (brs.length === 1 ? brs[0] : null);
    if (br) out.branchId = br.id;
  }
  // Policy type: a sample says it outright; otherwise the longest type name in the text, then known short forms.
  if (fx.type) { out.type = fx.type; out.dept = fx.dept; out.typeFrom = "sample"; }
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

const cleanInsurer = (s) => String(s).replace(/\((fictional|sample)\)/gi, "").replace(/\b(company\s+)?(limited|ltd\.?)\b/gi, "").replace(/\s+/g, " ").trim().replace(/\b([A-Z])([A-Z]+)\b/g, (m, a, b) => a + b.toLowerCase());

const Found = ({ ok, children }) => <span className={`src ${ok ? "src-ok" : "src-miss"}`}>{children}</span>;

export function QuickAdd() {
  const app = useApp();
  const { db, can, go, log, update, toast } = app;
  const [fx, setFx] = useState(null);
  const [s, setS] = useState(null);
  const [guess, setGuess] = useState({});
  const [nc, setNc] = useState({ name: "", city: "", vertical: "Corporate" });
  const [tried, setTried] = useState(false);
  const [extra, setExtra] = useState({ insName: "", brName: "", brCity: "", cseCode: "", cseName: "" });
  const [extraErr, setExtraErr] = useState("");
  const [reviewing, setReviewing] = useState(false);
  if (!can("newBusiness")) return <div className="stack"><h1>Add a policy</h1><p>Your role cannot add policies.</p></div>;

  const start = (x) => {
    const g = suggestFromDocument(db, x);
    const c = db.customers.find((y) => y.id === g.customerId);
    setFx(x); setGuess(g); setTried(false); setReviewing(false);
    setS({ customerId: g.customerId || (g.insuredName ? "NEW" : ""), cse: c?.cse || "", rm: c?.rm || "", insurerId: g.insurerId || "", branchId: g.branchId || "", dept: g.dept || "", type: g.type || "", cover: "", vesselMode: "" });
    setNc({ name: g.insuredName || "", city: g.city || "", vertical: "Corporate" });
    const brLine = (x.lines || []).find((l) => /\bbranch\b/i.test(l) && l.length < 80) || "";
    setExtra({ insName: cleanInsurer(x.info?.insurer || ""), brName: brLine.replace(/\bbranch\b.*$/i, "").replace(/[^A-Za-z0-9 ,&.-]/g, "").trim(), brCity: "", cseCode: "", cseName: "" }); setExtraErr("");
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
    cse: !s.cse ? "Assign a CSE" : null,
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
    const same = db.insurers.find((i) => i.name.toLowerCase() === name.toLowerCase());
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
    update((d) => { d.insurers.find((i) => i.id === ins.id).branches.push({ id, name, city, country: "India" }); log(d, { action: "Branch added", detail: `${name} (${city}) for ${ins.name}.` }); });
    setS((x) => ({ ...x, branchId: id })); setExtraErr(""); toast("Branch added");
  };
  const addCse = () => {
    const code = extra.cseCode.trim().toUpperCase(), name = extra.cseName.trim();
    if (!code || !name) return setExtraErr("Enter the CSE code and name");
    if (/\s/.test(code)) return setExtraErr("Codes cannot contain spaces");
    if (db.team.some((t) => t.code.toLowerCase() === code.toLowerCase())) return setExtraErr("That code is already used");
    update((d) => { d.team.push({ code, name, role: "CSE", active: true }); log(d, { action: "Team member added", detail: `${name} (${code}) as CSE.` }); });
    setS((x) => ({ ...x, cse: code })); setExtraErr(""); toast("CSE added");
  };
  const toReview = () => { setTried(true); if (!todo.length) setReviewing(true); };
  const addCustomer = (d) => {
    const cid = `C${++d.seq}`; const code = `CUST-${1000 + d.customers.length + 1}`;
    d.customers.push({ id: cid, code, name: nc.name.trim(), vertical: nc.vertical, address: fx.customer?.address?.v || "", city: nc.city.trim(), country: "India", phone: fx.customer?.phone?.v || "", email: fx.customer?.email?.v || "", gst: fx.customer?.gst?.v || "", source: "Direct", referral: "", tags: [], cse: s.cse, rm: s.rm, createdAt: nowIso() });
    log(d, { customerId: cid, action: "Customer created", detail: `${nc.name.trim()} created as ${code} from ${fx.fileName || fx.title}.` });
    return cid;
  };
  const finish = (pl, confirm) => createPolicy(app, s, fx, pl, confirm, isNew ? addCustomer : null);

  if (reviewing) return <OcrReview fixture={fx} customerName={customerName} insurerId={s.insurerId} branchId={s.branchId} policyType={s.type} heading={`Add a policy: ${customerName}, ${s.type}`} onCancel={() => setReviewing(false)} onSaveDraft={(pl) => finish(pl, false)} onConfirm={(pl) => finish(pl, true)} />;

  const hintFor = (key, ok, label) => (fx ? <Found ok={ok}>{ok ? label : "Not found on the document, please choose"}</Found> : null);
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Add a policy</h1><p className="muted">Drop the policy PDF. The insured, insurer, branch and policy type are read from it; you confirm, fill any gaps, then check the values.</p></div>
        <div className="row gap-s">{fx && <AskFirst label="Start again" question="Clear this document?" yes="Clear" onYes={() => { setFx(null); setS(null); }} />}<Btn onClick={() => go({ view: "new" })}>Step-by-step instead</Btn></div></header>
      <Card title="1. The policy document">
        <PdfAttach id="ap-file" ready={fx?.extracted ? fx : null} onReady={start} />
        {!LIVE && <div className="row gap-xs wrap small"><span className="muted">No PDF to hand? Try a sample:</span>{FIXTURES.filter((x) => x.kind === "Policy schedule").map((x) => <button key={x.id} className={`chipbtn ${fx?.id === x.id ? "on" : ""}`} onClick={() => start(fixtureById(x.id))}>{x.title}</button>)}</div>}
      </Card>
      {fx && s && (
        <Card title="2. What the document says" sub={todo.length ? `${todo.length} thing${todo.length === 1 ? "" : "s"} to fill before checking the values.` : "Everything needed is filled. Check it, then continue."}
          actions={<Pill tone={todo.length ? "warn" : "good"}>{todo.length ? `${todo.length} to fill` : "Ready"}</Pill>}>
          <div className="formgrid">
            <Labeled label="Insured (customer)" htmlFor="ap-cust" req error={tried && errs.customer} hint={!fx ? null : guess.customerId ? <Found ok>Matched an existing customer</Found> : isNew && guess.insuredName ? <span className="src src-info">Not an existing customer. It will be added</span> : <Found ok={false}>Not found on the document, please choose</Found>}>
              <Select id="ap-cust" value={s.customerId} onChange={set("customerId")} placeholder="Choose customer" options={[...(guess.insuredName ? [{ value: "NEW", label: `New customer: ${guess.insuredName}` }] : [{ value: "NEW", label: "New customer" }]), ...db.customers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))]} />
            </Labeled>
            {isNew && <>
              <Labeled label="Insured name" htmlFor="ap-nname" req error={tried && (errs.customer && isNew ? errs.customer : null)} hint={guess.insuredName ? <Found ok>Read from the document</Found> : null}><input id="ap-nname" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></Labeled>
              <Labeled label="City" htmlFor="ap-ncity" req error={tried && errs.city} hint={nc.city && nc.city === guess.city ? <Found ok>Read from the document</Found> : null}><input id="ap-ncity" value={nc.city} onChange={(e) => setNc({ ...nc, city: e.target.value })} /></Labeled>
              <Labeled label="Vertical" htmlFor="ap-nvert"><Select id="ap-nvert" value={nc.vertical} onChange={(v) => setNc({ ...nc, vertical: v })} options={["Corporate", "Retail"]} /></Labeled>
            </>}
            <Labeled label="CSE" htmlFor="ap-cse" req error={tried && errs.cse} hint={s.cse && !isNew ? "From the customer record" : "Type a name or code"}><SearchPick id="ap-cse" value={s.cse} onChange={set("cse")} options={team("CSE")} noun="CSE" /></Labeled>
            <Labeled label="RM" htmlFor="ap-rm" hint="Optional"><SearchPick id="ap-rm" value={s.rm} onChange={set("rm")} options={team("RM")} noun="RM" emptyLabel="Not assigned" /></Labeled>
            <Labeled label="Insurer" htmlFor="ap-ins" req error={tried && errs.insurer} hint={hintFor("insurer", !!guess.insurerId && s.insurerId === guess.insurerId, "Read from the document")}><Select id="ap-ins" value={s.insurerId} onChange={set("insurerId")} placeholder="Choose insurer" options={db.insurers.map((i) => ({ value: i.id, label: i.name }))} /></Labeled>
            <Labeled label="Insurer branch" htmlFor="ap-br" req error={tried && errs.branch} hint={s.insurerId ? hintFor("branch", !!guess.branchId && s.branchId === guess.branchId, "Read from the document") : null}><Select id="ap-br" value={s.branchId} onChange={set("branchId")} disabled={!ins} placeholder={ins ? "Choose branch" : "Choose insurer first"} options={(ins?.branches || []).map((b) => ({ value: b.id, label: `${b.name}, ${b.city}` }))} /></Labeled>
            <Labeled label="Department" htmlFor="ap-dept" req error={tried && !s.dept ? errs.type : null}><Select id="ap-dept" value={s.dept} onChange={set("dept")} placeholder="Choose department" options={Object.keys(DEPARTMENTS)} /></Labeled>
            <Labeled label="Policy type" htmlFor="ap-type" req error={tried && s.dept && !s.type ? errs.type : null} hint={hintFor("type", !!guess.type && s.type === guess.type, guess.typeFrom === "sample" ? "From the sample" : "Suggested from the document title")}><Select id="ap-type" value={s.type} onChange={set("type")} disabled={!s.dept} placeholder={s.dept ? "Choose policy type" : "Choose department first"} options={DEPARTMENTS[s.dept] || []} /></Labeled>
            {isVesselType(s.type) && <Labeled label="Vessel cover" htmlFor="ap-vm"><Select id="ap-vm" value={s.vesselMode} onChange={set("vesselMode")} placeholder="Choose" options={["Individual vessel", "Fleet"]} /></Labeled>}
          </div>
          {canAdd && fx && !s.insurerId && (
            <div className="boxed stack inline-add">
              <div className="small"><strong>Insurer not in your list?</strong> {fx.info?.insurer ? <>The document names <em>{fx.info.insurer}</em>.</> : "Add it here."}</div>
              <div className="row gap-s wrap" style={{ alignItems: "flex-end" }}>
                <Labeled label="Insurer name" htmlFor="ap-new-ins"><input id="ap-new-ins" value={extra.insName} onChange={(e) => setExtra({ ...extra, insName: e.target.value })} /></Labeled>
                <Btn onClick={addInsurer}>Add insurer</Btn>
              </div>
            </div>)}
          {canAdd && ins && !s.branchId && (
            <div className="boxed stack inline-add">
              <div className="small"><strong>Branch not listed for {ins.name}?</strong> Add the issuing office.</div>
              <div className="row gap-s wrap" style={{ alignItems: "flex-end" }}>
                <Labeled label="Branch" htmlFor="ap-new-br"><input id="ap-new-br" value={extra.brName} onChange={(e) => setExtra({ ...extra, brName: e.target.value })} /></Labeled>
                <Labeled label="City" htmlFor="ap-new-brcity"><input id="ap-new-brcity" value={extra.brCity} onChange={(e) => setExtra({ ...extra, brCity: e.target.value })} /></Labeled>
                <Btn onClick={addBranch}>Add branch</Btn>
              </div>
            </div>)}
          {canAdd && !team("CSE").length && (
            <div className="boxed stack inline-add">
              <div className="small"><strong>No CSEs yet.</strong> Add one here, or your whole team under Masters, Team (Admin role).</div>
              <div className="row gap-s wrap" style={{ alignItems: "flex-end" }}>
                <Labeled label="CSE code" htmlFor="ap-new-csecode"><input id="ap-new-csecode" value={extra.cseCode} onChange={(e) => setExtra({ ...extra, cseCode: e.target.value })} /></Labeled>
                <Labeled label="Name" htmlFor="ap-new-csename"><input id="ap-new-csename" value={extra.cseName} onChange={(e) => setExtra({ ...extra, cseName: e.target.value })} /></Labeled>
                <Btn onClick={addCse}>Add CSE</Btn>
              </div>
            </div>)}
          {extraErr && <div className="err-text small" role="alert">{extraErr}</div>}
          {tried && todo.length > 0 && <div className="note note-warn small"><strong>Still needed:</strong> {todo.join("; ")}.</div>}
          <div className="row gap-s wrap"><Btn kind="primary" onClick={toReview}>Continue to the values</Btn><span className="small muted">Next: policy number, dates and amounts read from the same document, for you to check.</span></div>
          <p className="small muted">Matching uses the names in the masters. A wrong match is easy to change here; nothing is saved until the review screen <Confirm /></p>
        </Card>
      )}
    </div>
  );
}
