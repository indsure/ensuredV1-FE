import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Upload, CheckCircle2, MapPin, Plus
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Header } from "@/components/Header";
import { getAllStates, getCitiesForState } from "@/lib/indian-cities-data";
import { getCityTier, getTierDescription } from "@/lib/city-tier-util";
import { Footer } from "@/components/Footer";
import { motion, AnimatePresence } from "framer-motion";

// --- MOCK DATA ---
const SAMPLE_COMPARISON = [
  {
    feature: "Annual Premium",
    p1: { value: "₹15,400", sub: "Annual", status: "neutral" },
    p2: { value: "₹11,200", sub: "Annual", status: "good" },
    p3: { value: "₹13,800", sub: "Annual", status: "neutral" }
  },
  {
    feature: "Base Sum Insured",
    p1: { value: "₹10 Lakhs", sub: "Standard", status: "neutral" },
    p2: { value: "₹10 Lakhs", sub: "Standard", status: "neutral" },
    p3: { value: "₹10 Lakhs", sub: "Recharges Unlimitedly", status: "good" }
  },
  {
    feature: "Room Rent Limit",
    p1: { value: "No Cap", sub: "Any Room", status: "good" },
    p2: { value: "Single Private", sub: "Capped Category", status: "bad" },
    p3: { value: "No Cap", sub: "Any Room", status: "good" }
  },
  {
    feature: "Co-Payment",
    p1: { value: "None", sub: "Full Claim Paid", status: "good" },
    p2: { value: "None", sub: "Full Claim Paid", status: "good" },
    p3: { value: "None", sub: "Full Claim Paid", status: "good" }
  },
  {
    feature: "Pre-Existing Wait",
    p1: { value: "3 Years", sub: "Standard", status: "neutral" },
    p2: { value: "1 Year", sub: "Excellent", status: "good" },
    p3: { value: "2 Years", sub: "Better than avg", status: "good" }
  },
  {
    feature: "Bonus / No-Claim",
    p1: { value: "50% per year", sub: "Max 100%", status: "neutral" },
    p2: { value: "20% per year", sub: "Max 100%", status: "bad" },
    p3: { value: "Lock the Clock", sub: "Age lock benefit", status: "good" }
  }
];

const POLICY_NAMES = ["HDFC Ergo Optima", "Star Health Young", "Niva Bupa ReAssure"];

// --- COMPONENTS ---

// 1. Setup Card (Editorial Style)
function ComparisonSetup({
  onLoadSample,
  state, setState,
  city, setCity,
  tier,
  dropProps,
  inputProps
}: any) {

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card-white p-5 sm:p-6 md:p-8 lg:p-12 relative overflow-hidden shadow-lg border-t-4 border-[var(--color-teal-600)]">

        {/* Section A: Context */}
        <div className="mb-8 sm:mb-12 border-b border-[var(--color-border-light)] pb-8 sm:pb-12">
          <h2 className="font-serif text-xl sm:text-2xl text-[var(--color-navy-900)] mb-4 sm:mb-6 flex items-center gap-3">
            <MapPin className="text-[var(--color-teal-600)] shrink-0" />
            Review Context
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[var(--color-navy-900)] font-semibold">State</label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="bg-[var(--color-cream-main)] border-[var(--color-border-medium)] text-[var(--color-text-main)] h-11 sm:h-12 focus:border-[var(--color-teal-600)] focus:ring-0">
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {getAllStates().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[var(--color-navy-900)] font-semibold">City</label>
              <Select value={city} onValueChange={setCity} disabled={!state}>
                <SelectTrigger className="bg-[var(--color-cream-main)] border-[var(--color-border-medium)] text-[var(--color-text-main)] h-11 sm:h-12 focus:border-[var(--color-teal-600)] focus:ring-0">
                  <SelectValue placeholder={state ? "Select City" : "-"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {getCitiesForState(state).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {tier && (
            <p className="mt-4 text-sm text-[var(--color-teal-600)] flex items-center gap-2 flex-wrap">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Analysis will be calibrated for <strong>{getTierDescription(tier)}</strong>.
            </p>
          )}
        </div>

        {/* Section B: Policies */}
        <div>
          <h2 className="font-serif text-xl sm:text-2xl text-[var(--color-navy-900)] mb-4 sm:mb-6 flex items-center gap-3">
            <Upload className="text-[var(--color-gold-500)] shrink-0" />
            Add Policies
          </h2>

          <div
            {...dropProps}
            className="border-2 hover:border-[var(--color-teal-600)] border-dashed border-[var(--color-border-medium)] rounded-xl p-6 sm:p-8 md:p-10 text-center cursor-pointer transition-all bg-[var(--color-cream-main)] hover:bg-white group"
          >
            <input {...inputProps} />
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-[var(--color-border-medium)] flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:bg-[var(--color-teal-600)] group-hover:text-white transition-colors bg-white text-[var(--color-text-muted)] group-hover:border-[var(--color-teal-600)] shadow-sm">
              <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <p className="text-[var(--color-navy-900)] font-medium mb-1 text-base sm:text-lg">Upload Policy PDFs</p>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">or Drag & Drop here</p>
          </div>

          <div className="flex items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
            <div className="h-[1px] bg-[var(--color-border-light)] flex-grow min-w-0"></div>
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest shrink-0">OR</span>
            <div className="h-[1px] bg-[var(--color-border-light)] flex-grow min-w-0"></div>
          </div>

          <div className="mt-6 sm:mt-8 text-center">
            <Button onClick={onLoadSample} variant="outline" className="w-full sm:w-auto text-[var(--color-teal-600)] border-[var(--color-teal-600)] hover:bg-[var(--color-teal-600)] hover:text-white h-11 sm:h-12 px-4 sm:px-6 text-sm sm:text-base">
              Load Sample Comparison (3 Policies)
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

// 2. Comparison Matrix (Premium Table)
function ComparisonMatrix({ names, data, onReset }: any) {
  return (
    <div className="w-full max-w-6xl mx-auto px-0 sm:px-2">

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8 border-b border-[var(--color-border-light)] pb-4 sm:pb-6">
        <div>
          <span className="inline-block py-1 px-3 border border-[var(--color-teal-400)] rounded-full text-[10px] font-mono uppercase tracking-widest text-[var(--color-teal-600)] mb-2 sm:mb-4 bg-white">
            Analysis Complete
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[var(--color-navy-900)]">Head-to-Head</h2>
        </div>
        <Button variant="ghost" onClick={onReset} className="self-start sm:self-auto text-[var(--color-text-secondary)] hover:text-[var(--color-teal-600)] text-sm sm:text-base -ml-2 sm:ml-0">
          ← Start Over
        </Button>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0 border border-[var(--color-border-light)] rounded-xl bg-white shadow-lg">
        <table className="w-full min-w-[640px] text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border-light)]">
              <th className="p-3 sm:p-4 md:p-6 min-w-[140px] sm:min-w-0 w-1/4 bg-[var(--color-cream-dark)] sticky left-0 z-10"></th>
              {names.map((name: string, i: number) => (
                <th key={i} className="p-3 sm:p-4 md:p-6 min-w-[120px] w-1/4 font-serif text-sm sm:text-base md:text-xl text-[var(--color-navy-900)] bg-[var(--color-cream-dark)] border-l border-[var(--color-border-light)] align-bottom pb-4 md:pb-8">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-light)]">
            {data.map((row: any, i: number) => (
              <tr key={i} className="group hover:bg-[var(--color-cream-main)] transition-colors">
                <td className="p-3 sm:p-4 md:p-6 font-mono text-[10px] sm:text-xs uppercase tracking-widest text-[var(--color-text-secondary)] bg-[var(--color-cream-dark)]/30 sticky left-0 border-r border-[var(--color-border-light)] group-hover:bg-[var(--color-cream-dark)]">
                  {row.feature}
                </td>

                <Cell data={row.p1} />
                <Cell data={row.p2} />
                <Cell data={row.p3} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Verdict Note */}
      <div className="mt-8 sm:mt-12 p-4 sm:p-6 md:p-8 border-l-4 border-[var(--color-gold-500)] bg-white shadow-md rounded-r-lg">
        <h4 className="font-serif text-lg sm:text-xl text-[var(--color-gold-500)] mb-2">Sach AI Verdict</h4>
        <p className="text-[var(--color-text-secondary)] leading-relaxed text-sm sm:text-base md:text-lg">
          <strong>{names[1]}</strong> offers the best value for money regarding waiting periods (1 Year for PED),
          but <strong>{names[0]}</strong> provides better room rent flexibility ("No Cap").
          Given your location in a Tier 1 city, prioritize "No Cap" on Room Rent to avoid proportionate deductions.
        </p>
      </div>

    </div>
  );
}

function Cell({ data }: any) {
  let color = "text-[var(--color-text-main)]";
  if (data.status === "good") color = "text-[var(--color-teal-600)] font-semibold";
  if (data.status === "bad") color = "text-red-500 font-semibold";

  return (
    <td className="p-3 sm:p-4 md:p-6 border-l border-[var(--color-border-light)] align-top">
      <div className={`text-sm sm:text-base md:text-lg mb-1 ${color}`}>{data.value}</div>
      <div className="text-xs sm:text-sm text-[var(--color-text-muted)]">{data.sub}</div>
    </td>
  )
}


export default function ComparePage() {
  const [location, setLocation] = useLocation();
  const [viewState, setViewState] = useState<"INPUT" | "Matrix">("INPUT");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [cityTier, setCityTier] = useState<number | null>(null);

  const { getRootProps, getInputProps } = useDropzone({
    maxFiles: 3,
    onDrop: (files) => console.log(files)
  } as any);

  // Hash Listener
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#report") {
      setViewState("Matrix");
    } else {
      setViewState("INPUT");
    }
  }, [location]);

  // Manual hash change listener
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      setViewState(hash === "#report" ? "Matrix" : "INPUT");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (selectedCity) setCityTier(getCityTier(selectedCity));
  }, [selectedCity]);

  const handleStateChange = (val: string) => {
    setSelectedState(val);
    setSelectedCity("");
  }

  const handleLoadSample = () => {
    window.location.hash = "report";
  };

  const handleReset = () => {
    window.location.hash = "";
  };

  // Animation Variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-32 sm:pt-36 md:pt-40 pb-12 md:pb-20 px-4 sm:px-6 w-full overflow-x-hidden">
        <AnimatePresence mode="wait">
          {viewState === "INPUT" && (
            <motion.div
              key="input"
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -20 }}
              variants={fadeInUp}
            >
              <div className="text-center mb-10 sm:mb-16 px-2">
                <span className="inline-block py-1 px-3 border border-[var(--color-teal-400)] rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-teal-600)] mb-4 sm:mb-6 bg-white">
                  Policy Comparison
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif mb-4 sm:mb-6 tracking-tight text-[var(--color-navy-900)]">Compare Policies</h1>
                <p className="text-base sm:text-lg md:text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto font-light leading-relaxed">
                  An unbiased, line-by-line audit of coverage, limitations, and hidden clauses.
                  See what they aren't telling you.
                </p>
              </div>

              <ComparisonSetup
                state={selectedState}
                setState={handleStateChange}
                city={selectedCity}
                setCity={setSelectedCity}
                tier={cityTier}
                onLoadSample={handleLoadSample}
                dropProps={getRootProps()}
                inputProps={getInputProps()}
              />
            </motion.div>
          )}

          {viewState === "Matrix" && (
            <motion.div
              key="matrix"
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
            >
              <ComparisonMatrix
                names={POLICY_NAMES}
                data={SAMPLE_COMPARISON}
                onReset={handleReset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
