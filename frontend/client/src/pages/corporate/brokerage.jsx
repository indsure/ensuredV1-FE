// Brokerage received against brokerage expected, per insurer, with one query email per insurer for the gaps.
import { useState } from "react";
import { TODAY } from "./data.js";
import { fmtDate, fmtMoney, fmtNum, isNum, r2, nowIso, fxRate, brokerageOf, brokerageBase } from "./lib.js";
import { useApp, Pill, Card, Empty, Btn, Labeled, Select, Table, DocModal, DateInput, Tip } from "./ui.jsx";
import { brokerageQuery } from "./docs.js";

const STATUS_TONE = { Paid: "good", "Short paid": "warn", "Not received": "bad", Overpaid: "info" };

// One row per confirmed policy term: what brokerage is due on it and what the insurer has paid.
export function brokerageLedger(db) {
  return db.terms.filter((t) => t.status === "confirmed" && !t.cancelled).map((t) => {
    const p = db.policies.find((x) => x.id === t.policyId);
    const c = db.customers.find((x) => x.id === p.customerId);
    const v = t.values;
    const expected = r2(brokerageOf(v) + (t.vesselSchedules || []).reduce((a, s) => a + (+s.change?.brokerageAdj || 0), 0));
    const pays = (db.remittances || []).flatMap((r) => r.lines.filter((l) => l.termId === t.id).map((l) => ({ ...l, ref: r.ref, date: r.date })));
    const received = r2(pays.reduce((a, l) => a + l.amount, 0));
    const out = r2(expected - received);
    const status = received === 0 ? "Not received" : out > 0.5 ? "Short paid" : out < -0.5 ? "Overpaid" : "Paid";
    const fx = fxRate(db, (v.bookDate || v.issueDate || TODAY).slice(0, 7), v.currency);
    return { t, p, c, insurerId: p.insurerId, policyNo: v.policyNo, controlNo: p.controlNo, insured: c.name, type: p.type, currency: v.currency, gross: brokerageBase(v), onNet: !!v.brokerageOnNet, pct: +v.brokeragePct || 0, expected, received, out, status, pays, rate: fx?.rate ?? null };
  });
}

function PaymentForm({ insurer, rows, onDone }) {
  const { update, log, toast, who, db } = useApp();
  const [f, setF] = useState({ date: TODAY, ref: "", note: "" });
  const [amts, setAmts] = useState({});
  const [tried, setTried] = useState(false);
  const open = rows.filter((r) => r.out > 0.5);
  const entered = Object.entries(amts).filter(([, v]) => v !== "");
  const dupRef = (db.remittances || []).some((r) => r.insurerId === insurer.id && r.ref.trim().toLowerCase() === f.ref.trim().toLowerCase());
  const errs = {
    date: !f.date ? "Enter the date received" : f.date > TODAY ? "Cannot be in the future" : null,
    ref: !f.ref.trim() ? "Enter the payment reference (UTR or advice no.)" : dupRef ? "This reference is already recorded for this insurer" : null,
    lines: !entered.length ? "Enter an amount against at least one policy" : entered.some(([, v]) => !isNum(v) || +v <= 0) ? "Amounts must be numbers above 0" : null,
  };
  const save = () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    update((d) => {
      const lines = entered.map(([termId, v]) => ({ termId, amount: +v }));
      d.remittances = d.remittances || [];
      d.remittances.push({ id: `RM${++d.seq}`, insurerId: insurer.id, date: f.date, ref: f.ref.trim(), note: f.note.trim(), lines, at: nowIso(), by: who });
      log(d, { action: "Brokerage received", detail: `${f.ref.trim()} from ${insurer.name}, dated ${fmtDate(f.date)}: ${lines.length} polic${lines.length === 1 ? "y" : "ies"}.` });
    });
    toast("Payment recorded");
    onDone();
  };
  return (
    <div className="boxed stack">
      <h4>Record a brokerage payment from {insurer.name}</h4>
      <div className="formgrid">
        <Labeled label="Received on" htmlFor="bp-date" req error={tried && errs.date}><DateInput id="bp-date" value={f.date} max={TODAY} onChange={(e) => setF({ ...f, date: e.target.value })} /></Labeled>
        <Labeled label="Payment reference" htmlFor="bp-ref" req error={tried && errs.ref} hint="UTR or the insurer's advice number"><input id="bp-ref" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></Labeled>
        <Labeled label="Note" htmlFor="bp-note"><input id="bp-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Labeled>
      </div>
      {open.length ? (
        <Table><thead><tr><th>Policy</th><th className="num">Still due</th><th>Amount in this payment</th></tr></thead>
          <tbody>{open.map((r) => <tr key={r.t.id}><td>{r.policyNo}<div className="small muted">{r.insured}</div></td><td className="num">{fmtMoney(r.out, r.currency)}</td>
            <td><div className="row gap-xs"><label className="sr" htmlFor={`bp-amt-${r.t.id}`}>Amount for {r.policyNo}</label><input id={`bp-amt-${r.t.id}`} inputMode="decimal" value={amts[r.t.id] ?? ""} placeholder={r.currency} onChange={(e) => setAmts({ ...amts, [r.t.id]: e.target.value })} />
              <Btn onClick={() => setAmts({ ...amts, [r.t.id]: String(r.out) })}>Full</Btn></div>
              {isNum(amts[r.t.id]) && +amts[r.t.id] > r.out + 0.5 && <div className="small warn-text">More than is due. It will show as overpaid.</div>}</td></tr>)}</tbody></Table>
      ) : <Empty title="Nothing outstanding from this insurer" />}
      {tried && errs.lines && <div className="err-text small">{errs.lines}</div>}
      <div className="row gap-s"><Btn onClick={onDone}>Cancel</Btn><Btn kind="primary" onClick={save} disabled={!open.length}>Save payment</Btn></div>
    </div>
  );
}

export function BrokerageView() {
  const { db, can } = useApp();
  const [ins, setIns] = useState("");
  const [st, setSt] = useState("");
  const [paying, setPaying] = useState(null);
  const [doc, setDoc] = useState(null);
  const all = brokerageLedger(db);
  const rows = all.filter((r) => (!ins || r.insurerId === ins) && (!st || r.status === st));
  const toInr = (r, k) => (r.rate == null ? null : r2(r[k] * r.rate));
  const sum = (k) => r2(all.reduce((a, r) => a + (toInr(r, k) ?? 0), 0));
  const noRate = all.filter((r) => r.rate == null).length;
  const chase = all.filter((r) => r.out > 0.5);
  const groups = db.insurers.map((i) => ({ i, rows: rows.filter((r) => r.insurerId === i.id), allRows: all.filter((r) => r.insurerId === i.id) })).filter((g) => g.rows.length || paying === g.i.id);
  return (
    <div className="stack">
      <header className="page-head"><div><h1>Brokerage received</h1><p className="muted">What each insurer owes you, what has arrived, and what to chase. Brokerage due is the gross premium times the rate on the policy, or the net premium where a policy is ticked for that.</p></div></header>
      <div className="stats">
        <div className="stat"><span>Brokerage due</span><strong>{fmtMoney(sum("expected"))}</strong><em>{all.length} confirmed policies, in INR</em></div>
        <div className="stat"><span>Received</span><strong>{fmtMoney(sum("received"))}</strong><em>{(db.remittances || []).length} payments recorded</em></div>
        <div className="stat"><span>Outstanding</span><strong className={sum("out") > 0 ? "bad-text" : ""}>{fmtMoney(sum("out"))}</strong><em>{chase.length} policies to chase</em></div>
        <div className="stat"><span>Short paid</span><strong>{all.filter((r) => r.status === "Short paid").length}</strong><em>{all.filter((r) => r.status === "Not received").length} not received at all</em></div>
      </div>
      {noRate > 0 && <div className="note note-warn small">{noRate} foreign-currency polic{noRate === 1 ? "y has" : "ies have"} no FX rate for their month, so {noRate === 1 ? "it is" : "they are"} left out of the INR totals above. Native amounts are shown in the tables.</div>}
      <div className="filters">
        <Labeled label="Insurer" htmlFor="bk-ins"><Select id="bk-ins" value={ins} onChange={setIns} placeholder="All insurers" options={db.insurers.map((i) => ({ value: i.id, label: i.name }))} /></Labeled>
        <Labeled label="Status" htmlFor="bk-st"><Select id="bk-st" value={st} onChange={setSt} placeholder="All" options={["Not received", "Short paid", "Paid", "Overpaid"]} /></Labeled>
      </div>
      {!groups.length && <Empty title="No policies match these filters">Clear a filter to see more.</Empty>}
      {groups.map(({ i, rows: gr, allRows }) => {
        const owed = allRows.filter((r) => r.out > 0.5);
        const totals = {};
        allRows.forEach((r) => { const x = (totals[r.currency] ||= { due: 0, got: 0 }); x.due += r.expected; x.got += r.received; });
        const line = Object.entries(totals).map(([cur, x]) => `${fmtMoney(r2(x.due), cur)} due, ${fmtMoney(r2(x.got), cur)} received`).join(" · ");
        return (
          <Card key={i.id} title={i.name} sub={line}
            actions={<>{can("receipt") && paying !== i.id && <Btn kind="primary" onClick={() => setPaying(i.id)}>Record payment</Btn>}
              <Btn disabled={!owed.length} why="Nothing outstanding" onClick={() => setDoc(brokerageQuery({ insurer: i.name, lines: owed.map((r) => ({ ...r, refs: r.pays.map((x) => x.ref).join(", ") })) }))}>Draft query email{owed.length ? ` (${owed.length})` : ""}</Btn></>}>
            {paying === i.id && <PaymentForm insurer={i} rows={allRows} onDone={() => setPaying(null)} />}
            {gr.length > 0 && (
              <Table><thead><tr><th>Policy</th><th>Insured</th><th className="num">Brokerage on<Tip k="Brokerage (%)" /></th><th className="num">Brokerage due</th><th className="num">Received</th><th className="num">Outstanding</th><th>Status</th></tr></thead>
                <tbody>{gr.map((r) => <tr key={r.t.id}>
                  <td>{r.policyNo}<div className="small muted">{r.controlNo}</div></td>
                  <td>{r.insured}<div className="small muted">{r.type}</div></td>
                  <td className="num">{fmtMoney(r.gross, r.currency)}<div className="small muted">{r.onNet ? "net" : "gross"}, at {fmtNum(r.pct)}%</div></td>
                  <td className="num">{fmtMoney(r.expected, r.currency)}</td>
                  <td className="num">{fmtMoney(r.received, r.currency)}{r.pays.length > 0 && <div className="small muted">{r.pays.map((x) => `${x.ref}, ${fmtDate(x.date)}`).join("; ")}</div>}</td>
                  <td className="num">{r.out > 0.5 ? <strong className="bad-text">{fmtMoney(r.out, r.currency)}</strong> : fmtMoney(Math.max(0, r.out), r.currency)}</td>
                  <td><Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill></td>
                </tr>)}</tbody></Table>)}
          </Card>
        );
      })}
      {doc && <DocModal doc={doc} onClose={() => setDoc(null)} />}
    </div>
  );
}
