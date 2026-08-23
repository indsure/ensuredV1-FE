import { useEffect, useMemo, useState } from "react";
import { Search, Star } from "lucide-react";

import { useAgent } from "@/context/AgentContext";
import { supabase } from "@/lib/supabase";
import { resolvePartnerCompanies } from "@/lib/data/insurer-aliases";
import {
  RIDERS_DATABASE,
  type RiderEntry,
  type RiderType,
} from "@/lib/data/rider-data";

const ALL_TYPES: RiderType[] = Array.from(
  new Set(RIDERS_DATABASE.map((r) => r.riderType))
).sort() as RiderType[];

const ALL_COMPANIES = Array.from(new Set(RIDERS_DATABASE.map((r) => r.company))).sort();

export default function RiderDirectory() {
  const { agent } = useAgent();
  const [partners, setPartners] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [insurer, setInsurer] = useState<"all" | string>("all");
  const [type, setType] = useState<"all" | RiderType>("all");

  useEffect(() => {
    if (!agent?.agentId) return;
    supabase
      .from("agents")
      .select("partnered_companies")
      .eq("id", agent.agentId)
      .maybeSingle()
      .then(({ data }) => setPartners(resolvePartnerCompanies(data?.partnered_companies)));
  }, [agent?.agentId]);

  const partnerSet = useMemo(() => new Set(partners), [partners]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = RIDERS_DATABASE.filter((r) => {
      if (insurer !== "all" && r.company !== insurer) return false;
      if (type !== "all" && r.riderType !== type) return false;
      if (q) {
        const hay = `${r.riderName} ${r.description} ${r.company} ${r.plans}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // Partner riders first, then everyone else; stable within each group.
    return rows
      .map((r, i) => ({ r, i, partner: partnerSet.has(r.company) }))
      .sort((a, b) => (a.partner === b.partner ? a.i - b.i : a.partner ? -1 : 1))
      .map((x) => x.r);
  }, [search, insurer, type, partnerSet]);

  const partnerCount = filtered.filter((r) => partnerSet.has(r.company)).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">Rider Directory</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every rider across {ALL_COMPANIES.length} insurers — your partnered insurers show first.
        </p>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rider, benefit, plan or insurer…"
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
          />
        </div>
        <select
          value={insurer}
          onChange={(e) => setInsurer(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
        >
          <option value="all">All insurers</option>
          {partners.length > 0 && (
            <optgroup label="Your partners">
              {partners.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </optgroup>
          )}
          <optgroup label="All insurers">
            {ALL_COMPANIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </optgroup>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as RiderType | "all")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
        >
          <option value="all">All rider types</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* COUNT */}
      <div className="text-xs text-slate-400">
        Showing {filtered.length} rider{filtered.length !== 1 ? "s" : ""}
        {partnerCount > 0 && <span className="text-[#0D9488] font-semibold"> · {partnerCount} from your partners</span>}
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-10 lg:p-16 text-center text-slate-400 italic">
          No riders match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((r, i) => (
            <RiderCard key={`${r.company}-${r.riderName}-${i}`} rider={r} isPartner={partnerSet.has(r.company)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RiderCard({ rider, isPartner }: { rider: RiderEntry; isPartner: boolean }) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        isPartner ? "border-[#0D9488]/30 ring-1 ring-[#0D9488]/10" : "border-slate-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">{rider.riderName}</span>
            {rider.mustHave && (
              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 text-[11px] sm:text-[9px] font-black uppercase tracking-wider">
                ★ Must Have
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                isPartner ? "text-[#0D9488]" : "text-slate-500"
              }`}
            >
              {isPartner && <Star className="h-3 w-3 fill-[#0D9488] text-[#0D9488]" />}
              {rider.company}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[11px] sm:text-[10px] font-bold uppercase tracking-wider">
              {rider.riderType}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-600 leading-relaxed">{rider.description}</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] empty:hidden">
        <Field label="Payout" value={rider.payoutType} span />
        <Field label="Plans" value={rider.plans} span />
        <Field label="Waiting" value={rider.waitingPeriod} />
        <Field label="Survival" value={rider.survivalPeriod} />
      </dl>
    </div>
  );
}

function Field({ label, value, span }: { label: string; value?: string; span?: boolean }) {
  if (!value || value === "N/A") return null;
  return (
    <div className={span ? "col-span-2" : ""}>
      <dt className="font-black uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}
