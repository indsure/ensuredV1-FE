"use client";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, Input, Modal } from "@/components/ui";
import { Building2, Check, Copy, Plus } from "lucide-react";

type Org = {
  code: string;
  name: string;
  owner_name: string;
  owner_email: string | null;
  owner_ready: boolean;
  active: boolean;
  locked: boolean;
  people: number;
  last_login: string | null;
  created_at: string;
  link_email: string | null;
  link_expires: string | null;
};
type Entry = { at: string; code: string; who: string; event: string; detail: string };
type Made = { code: string; name: string; email: string; link: string; expiresAt: string; emailed: boolean };
type Ask = { kind: "create" | "owner" | "rename" | "off"; org?: Org };

const FIRST_ORG = "IC10001"; // has email logins too, which an off switch would not stop

function when(s: string | null) {
  if (!s) return "Never";
  return new Date(s).toLocaleString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  }).replace(",", "");
}

async function call(path: string, body?: unknown) {
  const res = await fetch(`/api/commercial${path}`, body === undefined ? { cache: "no-store" } : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) { window.location.href = "/login"; }
  if (!res.ok) throw new Error(json.error || `The server answered ${res.status}.`);
  return json;
}

export default function CommercialClient() {
  const [data, setData] = useState<{ orgs: Org[]; history: Entry[] } | null>(null);
  const [error, setError] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [f, setF] = useState({ name: "", email: "" });
  const [askError, setAskError] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<Made | null>(null);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try { setData(await call("")); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not load."); }
  }, []);
  // Owners and employees join on the portal, so coming back to this tab reads the list again.
  useEffect(() => {
    void load();
    const again = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    const t = setInterval(again, 60000);
    return () => { window.removeEventListener("focus", again); document.removeEventListener("visibilitychange", again); clearInterval(t); };
  }, [load]);

  const start = (kind: Ask["kind"], org?: Org) => {
    setF({ name: kind === "rename" ? org?.name || "" : "", email: kind === "owner" ? org?.link_email || org?.owner_email || "" : "" });
    setAskError(""); setAsk({ kind, org });
  };
  const act = async (path: string, body: unknown, done?: (r: Made) => void) => {
    setBusy(true); setAskError(""); setError("");
    try {
      const r = await call(path, body);
      done?.(r); setAsk(null); await load();
    } catch (e) {
      const m = e instanceof Error ? e.message : "It could not be saved.";
      if (ask) setAskError(m); else setError(m);
    } finally { setBusy(false); }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ask || busy) return;
    if (ask.kind === "create") void act("", f, (r) => { setMade(r); setCopied(""); });
    else if (ask.kind === "owner") void act(`/${ask.org!.code}/owner`, { email: f.email }, (r) => { setMade(r); setCopied(""); });
    else if (ask.kind === "rename") void act(`/${ask.org!.code}/rename`, { name: f.name });
    else void act(`/${ask.org!.code}/off`, {});
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(made!.link); setCopied("yes"); } catch { setCopied("no"); }
  };

  const TITLES = { create: "New organisation", owner: "Send an owner link", rename: "Rename organisation", off: "Switch off organisation" };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commercial</h1>
          <p className="mt-1 text-sm text-slate-500">Organisations on IndSure Commercial. Their policies and clients are not shown here.</p>
        </div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => void load()}>Refresh</Button><Button onClick={() => start("create")} disabled={!data}><Plus className="mr-2 h-4 w-4" />New organisation</Button></div>
      </div>

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><Button variant="outline" onClick={() => void load()}>Reload</Button></div>}

      {made && (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm">
          <p className="font-semibold text-slate-900">{made.name}, OrgID {made.code}</p>
          <p className="mt-1 text-slate-700">{made.emailed ? `Owner link emailed to ${made.email}.` : `The email to ${made.email} could not be sent. Send them this link yourself.`} It works once, until {when(made.expiresAt)}, and is shown only now.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input readOnly aria-label="Owner link" value={made.link} onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-700" />
            <Button onClick={copy}>{copied === "yes" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied === "yes" ? "Copied" : "Copy link"}</Button>
            <Button variant="outline" onClick={() => setMade(null)}>Done</Button>
          </div>
          {copied === "no" && <p className="mt-2 text-amber-700">It could not be copied. Select the link and copy it by hand.</p>}
        </div>
      )}

      {!data && !error && <p role="status" className="text-sm text-slate-500">Loading...</p>}

      {data && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-slate-500">
                <tr>{["Organisation", "Owner", "Employees", "Owner last signed in", "Status", ""].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.orgs.map((o) => {
                  const linkLive = o.link_expires && new Date(o.link_expires) > new Date();
                  return (
                    <tr key={o.code} className="border-b align-top last:border-0">
                      <td className="px-5 py-4"><div className="font-medium text-slate-900">{o.name}</div><div className="font-mono text-xs text-slate-500">{o.code}</div><div className="text-xs text-slate-500">Created {when(o.created_at)}</div></td>
                      <td className="px-5 py-4">
                        {o.owner_ready ? <><div className="text-slate-900">{o.owner_name}</div><div className="text-xs text-slate-500">{o.owner_email}</div></> : <div className="text-slate-500">Not set up yet</div>}
                        {o.link_email && <div className="mt-1 text-xs text-slate-500">{linkLive ? `Link for ${o.link_email} works until ${when(o.link_expires)}` : `Link for ${o.link_email} has expired`}</div>}
                      </td>
                      <td className="px-5 py-4 text-slate-700">{o.people}</td>
                      <td className="px-5 py-4 text-slate-700">{when(o.last_login)}</td>
                      <td className="px-5 py-4"><div className="flex flex-col items-start gap-1"><Badge variant={o.active ? "green" : "red"}>{o.active ? "On" : "Off"}</Badge>{o.locked && <Badge variant="yellow">Owner locked</Badge>}</div></td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {o.active && <Button variant="outline" disabled={busy} onClick={() => start("owner", o)}>Owner link</Button>}
                          <Button variant="outline" disabled={busy} onClick={() => start("rename", o)}>Rename</Button>
                          {o.locked && <Button variant="outline" disabled={busy} onClick={() => void act(`/${o.code}/unlock`, {})}>Unlock owner</Button>}
                          {o.active ? o.code !== FIRST_ORG && <Button variant="danger" disabled={busy} onClick={() => start("off", o)}>Switch off</Button> : <Button variant="outline" disabled={busy} onClick={() => void act(`/${o.code}/on`, {})}>Switch on</Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!data.orgs.length && <div className="py-12 text-center text-slate-500"><Building2 className="mx-auto mb-2 h-8 w-8 opacity-40" />No organisations yet.</div>}
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardContent className="p-0">
            <h2 className="border-b bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">History</h2>
            {!data.history.length ? <p className="px-5 py-6 text-sm text-slate-500">No changes yet.</p> : (
              <ul className="max-h-96 overflow-y-auto">{data.history.map((h, i) => (
                <li key={i} className="flex flex-wrap gap-x-4 gap-y-1 border-b px-5 py-3 text-sm last:border-0">
                  <span className="w-36 text-slate-500">{when(h.at)}</span><span className="font-mono text-slate-500">{h.code}</span><span className="font-medium text-slate-900">{h.event}</span><span className="min-w-0 break-words text-slate-700">{h.detail}</span>
                </li>
              ))}</ul>
            )}
          </CardContent>
        </Card>
      )}

      <Modal open={!!ask} onClose={() => { if (!busy) setAsk(null); }} title={ask ? TITLES[ask.kind] : ""}>
        {ask && (
          <form onSubmit={submit} className="space-y-4 text-sm" noValidate>
            {(ask.kind === "create" || ask.kind === "rename") && <div><label htmlFor="co-name" className="mb-1 block font-medium text-slate-700">Organisation name</label><Input id="co-name" autoFocus maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>}
            {(ask.kind === "create" || ask.kind === "owner") && <div><label htmlFor="co-email" className="mb-1 block font-medium text-slate-700">Owner&apos;s email</label><Input id="co-email" type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>}
            {ask.kind === "owner" && <p className="text-slate-600">{ask.org!.name}, {ask.org!.code}. {ask.org!.owner_ready ? "The current owner can still sign in until the new link is used. Then the new password replaces theirs." : "Any earlier owner link stops working."}</p>}
            {ask.kind === "off" && <p className="text-slate-700">Switch off {ask.org!.name} ({ask.org!.code})? Its owner and {ask.org!.people} {ask.org!.people === 1 ? "employee is" : "employees are"} signed out at once. Its records stay, and you can switch it on again.</p>}
            {askError && <p role="alert" className="text-red-600">{askError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setAsk(null)}>Cancel</Button>
              <Button type="submit" variant={ask.kind === "off" ? "danger" : "default"} disabled={busy}>{busy ? "Working..." : { create: "Create and send link", owner: "Send link", rename: "Save", off: "Switch off" }[ask.kind]}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
