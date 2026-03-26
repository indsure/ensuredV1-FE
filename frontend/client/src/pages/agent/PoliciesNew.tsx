import { useState } from "react"
import { useLocation } from "wouter"
import { AlertTriangle, TrendingDown, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Policy = {
  id: string;
  client_name: string;
  insurer: string;
  days_to_expiry: number;
  risk_score: number;
  should_switch: boolean;
  painpoints: string;
};

const MOCK_POLICIES: Policy[] = [
  { id: "POL-001", client_name: "Rajesh Kumar", insurer: "HDFC Life", days_to_expiry: 42, risk_score: 96, should_switch: false, painpoints: "Inflation erosion is the only long term risk. Solid policy." },
  { id: "POL-002", client_name: "Aditi Sharma", insurer: "Care Health", days_to_expiry: 15, risk_score: 74, should_switch: true, painpoints: "Maternity permanently excluded. 3-Year PED waiting period active. Robotic surgery sub-limit." },
  { id: "POL-003", client_name: "Priya Singh", insurer: "Kotak General", days_to_expiry: 200, risk_score: 94, should_switch: false, painpoints: "Engine Protection is missing. High risk if living in a waterlogging area." },
  { id: "POL-004", client_name: "Amit Patel", insurer: "Star Health", days_to_expiry: 5, risk_score: 45, should_switch: true, painpoints: "High room rent co-pay (20%). Strict zone-based pricing limits. Missing modern treatments cover." },
  { id: "POL-005", client_name: "Neha Gupta", insurer: "ICICI Lombard", days_to_expiry: 112, risk_score: 88, should_switch: false, painpoints: "OPD not covered. Consumables require an additional rider." },
  { id: "POL-006", client_name: "Vikram Singh", insurer: "Niva Bupa", days_to_expiry: 30, risk_score: 62, should_switch: true, painpoints: "Initial 30-day wait active. Sub-limits on cardiac. No NCB scaling." },
  { id: "POL-007", client_name: "Anjali Desai", insurer: "SBI General", days_to_expiry: 85, risk_score: 81, should_switch: false, painpoints: "Good basic cover. Network hospitals limited in Tier 2 cities." },
  { id: "POL-008", client_name: "Rahul Verma", insurer: "Bajaj Allianz", days_to_expiry: 2, risk_score: 55, should_switch: true, painpoints: "Very high claim rejection risk. Lacking critical illness riders." }
];

export default function PoliciesNew() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const filtered = MOCK_POLICIES.filter(p => 
    p.client_name.toLowerCase().includes(search.toLowerCase()) || 
    p.insurer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">My Policies</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters */}
        <div className="w-full lg:w-64 shrink-0 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-4">Filters</h3>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Search</label>
              <input
                type="text"
                placeholder="Client or Insurer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
            <p className="text-xs text-slate-400 mt-6 leading-relaxed">
              This is a Live Demo view. It mimics the data presentation using hardcoded values designed to highlight the core engine's capability.
            </p>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 relative">
          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#FAFAF8] border-b border-slate-100 uppercase tracking-wider text-xs font-bold text-slate-400">
                  <tr className="text-left">
                    <th className="p-4 px-6">Customer Name</th>
                    <th className="p-4">Insured With</th>
                    <th className="p-4">Days to Expiry</th>
                    <th className="p-4">Score</th>
                    <th className="p-4 text-center">Should Switch</th>
                    <th className="p-4 text-right px-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic font-medium">No policies found matching your search.</td></tr>
                  )}
                  {filtered.map((policy) => (
                    <tr key={policy.id} className="group hover:bg-slate-50/80 transition-colors cursor-pointer">
                      <td className="p-4 px-6 font-bold text-slate-800">{policy.client_name}</td>
                      <td className="p-4 font-semibold text-slate-500">{policy.insurer}</td>
                      <td className="p-4">
                        <span className={`font-bold ${policy.days_to_expiry < 30 ? 'text-amber-600 bg-amber-50 px-2 py-1 rounded-md' : 'text-slate-700'}`}>
                          {policy.days_to_expiry} days
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md font-black text-xs ${policy.risk_score < 70 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                          {policy.risk_score}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {policy.should_switch ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-800">
                              <TrendingDown className="w-3 h-3" /> YES
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                              NO
                            </span>
                          )}
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-200">
                                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-3 text-sm shadow-xl border-slate-100" side="left">
                              <p className="font-extrabold text-[#0D9488] mb-1 text-[10px] uppercase tracking-widest">Painpoints Detected</p>
                              <p className="text-slate-700 font-medium leading-relaxed">{policy.painpoints}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="p-4 px-6 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[#0D9488] font-bold hover:bg-[#0D9488]/10"
                          onClick={() => setLocation('/agent/policies/' + policy.id)}
                        >
                          View Report
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
