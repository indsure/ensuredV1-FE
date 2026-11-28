// "Rec GST" and "Pay GST" tick boxes, each opening an amount. One or the other, never both.
import { useState } from "react";
import { useApp, Card, Btn, MoneyInput, Table } from "./ui.jsx";
import { GST_KINDS, GST_COLUMNS, GST_SIDE_WORDS, cleanGst, gstErrors, gstSuggestion } from "./gst.js";
import { fmtMoney, fmtNum } from "./lib.js";

export function GstPair({ kind, vals, onChange, showErr, idBase }) {
  const k = GST_KINDS.find((x) => x.kind === kind);
  const side = vals[k.side] || "", err = showErr ? gstErrors(vals)[k.amt] : null, offer = gstSuggestion(kind, vals);
  const pick = (s) => onChange(side === s ? { [k.side]: "", [k.amt]: "" } : { [k.side]: s });
  const id = `${idBase}-${kind}`;
  return (
    <div className="gst-pair" data-gst={kind}>
      <strong className="small">{k.label}</strong>
      <div className="row gap-s wrap">
        <label className="check"><input id={`${id}-rec`} type="checkbox" checked={side === "rec"} onChange={() => pick("rec")} /> Rec GST</label>
        <label className="check"><input id={`${id}-pay`} type="checkbox" checked={side === "pay"} onChange={() => pick("pay")} /> Pay GST</label>
      </div>
      {side && (
        <div className="fld">
          <label htmlFor={`${id}-amt`}>{side === "rec" ? "How much GST is received" : "How much GST is paid"}{vals.currency ? ` (${vals.currency})` : ""}</label>
          <MoneyInput id={`${id}-amt`} value={vals[k.amt] ?? ""} onChange={(v) => onChange({ [k.amt]: v })} />
          {offer != null && String(vals[k.amt] ?? "") !== String(offer) && <button type="button" className="linkbtn small" onClick={() => onChange({ [k.amt]: String(offer) })}>Use {fmtMoney(offer, vals.currency || "INR")}, {kind === "premium" ? "the GST on this policy" : "the GST % of the brokerage"}</button>}
          {err && <div className="err-text" role="alert">{err}</div>}
        </div>
      )}
    </div>
  );
}

/** On the policy page: what was answered, changeable without an endorsement because it is the broker's own accounts. */
export function GstCard({ policyId, customerId, term }) {
  const { update, log, toast, can } = useApp();
  const v = term.values;
  const [edit, setEdit] = useState(null);
  const [tried, setTried] = useState(false);
  const may = can("editDraft") || can("receipt");
  const say = (k) => (v[k.side] && v[k.amt] !== "" ? `${GST_SIDE_WORDS[v[k.side]]}: ${fmtMoney(v[k.amt], v.currency)}` : "Not stated");
  const save = () => {
    setTried(true);
    if (Object.keys(gstErrors(edit)).length) return;
    const next = cleanGst(edit);
    update((d) => {
      const t = d.terms.find((x) => x.id === term.id);
      const words = GST_KINDS.map((k) => `${k.label}: ${next[k.side] ? `${GST_SIDE_WORDS[next[k.side]]} ${fmtMoney(next[k.amt], v.currency)}` : "not stated"}`).join("; ");
      Object.assign(t.values, next);
      log(d, { customerId, policyId, termId: t.id, action: "GST paid or received changed", detail: `${words}.` });
    });
    setEdit(null); setTried(false); toast("GST saved");
  };
  return (
    <Card title="GST paid or received" sub="For your own accounts. It does not change the premium or the brokerage." actions={may && !edit && <Btn onClick={() => setEdit({ ...v })}>Change</Btn>}>
      {edit ? <div className="stack">
        {GST_KINDS.map((k) => <GstPair key={k.kind} kind={k.kind} idBase="pv-gst" vals={edit} showErr={tried} onChange={(p) => setEdit((x) => ({ ...x, ...p }))} />)}
        <div className="row gap-s"><Btn onClick={() => { setEdit(null); setTried(false); }}>Cancel</Btn><Btn kind="primary" onClick={save}>Save GST</Btn></div>
      </div> : <Table><tbody>{GST_KINDS.map((k) => <tr key={k.kind}><td>{k.label}</td><td>{say(k)}</td></tr>)}</tbody></Table>}
    </Card>
  );
}

/** In accounts: what was received and paid, per currency and in rupees. */
export function GstTotalsCard({ T, title = "GST paid and received", only }) {
  if (!T.any) return null;
  const cols = GST_COLUMNS.filter(([k]) => !only || k.startsWith(only === "brokerage" ? "brok" : "prem"));
  return (
    <Card title={title} sub="From the Rec GST and Pay GST boxes on each policy. Kept apart from premium and brokerage totals.">
      <Table><thead><tr><th>Currency</th>{cols.map(([k, l]) => <th key={k} className="num">{l}</th>)}</tr></thead>
        <tbody>{Object.entries(T.native).map(([cur, n]) => <tr key={cur}><td>{cur}</td>{cols.map(([k]) => <td key={k} className="num">{fmtNum(n[k], cur)}</td>)}</tr>)}</tbody>
        <tfoot><tr><td>All in INR{T.noRate ? ` (${T.noRate} left out, no rate)` : ""}</td>{cols.map(([k]) => <td key={k} className="num">{fmtNum(T.inr[k])}</td>)}</tr></tfoot></Table>
    </Card>
  );
}
