import { useEffect, useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { apiFetch } from "@/lib/api";
import ComparisonView from "@/components/ComparisonView";
import { type ComparisonResult } from "@/lib/wordingProfile";

export default function SharedComparison({ uuid }: { uuid: string }) {
  const [data, setData] = useState<ComparisonResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch(`/api/compare/report/${uuid}`);
        if (!res.ok) throw new Error("not found");
        const json = await res.json();
        if (alive) {
          setData(json.result as ComparisonResult);
          setStatus("ok");
        }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => { alive = false; };
  }, [uuid]);

  return (
    <div className="min-h-screen bg-[#FAFAF8] font-['Inter'] flex flex-col">
      <Header />
      <main className="flex-grow w-full max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-12 sm:pb-16 lg:pb-20">
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 lg:py-32 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="font-medium">Loading your comparison…</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 lg:py-32 text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
              <ScanSearch className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-black text-slate-800 mb-1">Comparison not found</h1>
            <p className="text-slate-500">This link may have expired or is incorrect.</p>
          </div>
        )}

        {status === "ok" && data && (
          <>
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D9488] mb-2">Policy Comparison</p>
              <h1 className="text-3xl sm:text-4xl font-black text-[#0F172A]">Your Side-by-Side Report</h1>
              <p className="text-slate-500 mt-2">An honest, clause-by-clause breakdown of two health policies.</p>
            </div>
            <ComparisonView data={data} />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
