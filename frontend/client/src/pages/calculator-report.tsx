import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
    Check, Shield, AlertTriangle, Activity, RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { EngineResult, UserInputs } from "@/lib/health-engine-logic";

export default function CalculatorReportPage() {
    const [_, setLocation] = useLocation();
    const [result, setResult] = useState<EngineResult | null>(null);
    const [inputs, setInputs] = useState<UserInputs | null>(null);

    useEffect(() => {
        const savedResult = sessionStorage.getItem("calculator_result");
        const savedInputs = sessionStorage.getItem("calculator_inputs");

        if (savedResult && savedInputs) {
            setResult(JSON.parse(savedResult));
            setInputs(JSON.parse(savedInputs));
        } else {
            // Redirect back if no data
            setLocation("/calculator");
        }
    }, [setLocation]);

    if (!result || !inputs) {
        return null; // Or loader
    }

    return (
        <div className="min-h-screen bg-[var(--color-cream-main)] font-sans flex flex-col">
            <Header />
            <main className="flex-grow pt-24 pb-20 px-6">
                <div className="max-w-4xl mx-auto space-y-12">

                    {/* Header */}
                    <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-teal-50)] text-[var(--color-teal-600)] rounded-full text-sm font-bold tracking-wide">
                            <Check className="w-4 h-4" /> ANALYSIS COMPLETE
                        </div>
                        <h1 className="text-4xl md:text-5xl font-serif text-[var(--color-navy-900)]">
                            Your Optimised Coverage Plan
                        </h1>
                        <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto text-lg">
                            Designed for {inputs.cityTier} costs, {inputs.familyStructure} risk, and {inputs.riskPosture?.toLowerCase()} posture.
                        </p>
                    </div>

                    {/* 1. The Numbers */}
                    <div className="grid md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        <div className="md:col-span-1 bg-white p-6 rounded-xl border border-[var(--color-border-light)] shadow-sm">
                            <div className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Base Policy</div>
                            <div className="text-4xl font-serif text-[var(--color-navy-900)]">{result.baseCover}</div>
                            <div className="text-sm text-[var(--color-text-muted)] mt-2">Primary layer for standard hospitalisations.</div>
                        </div>
                        <div className="md:col-span-1 bg-[var(--color-teal-600)] text-white p-6 rounded-xl shadow-md transform md:-translate-y-4">
                            <div className="text-sm font-bold text-white/80 uppercase tracking-wider mb-2">Super Top-Up</div>
                            <div className="text-4xl font-serif">{result.superTopUp}</div>
                            <div className="text-sm text-white/80 mt-2">High-value protection at 80% lower cost than base cover.</div>
                        </div>
                        <div className="md:col-span-1 bg-white p-6 rounded-xl border border-[var(--color-border-light)] shadow-sm">
                            <div className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Total Shield</div>
                            <div className="text-4xl font-serif text-[var(--color-navy-900)]">{result.totalProtection}</div>
                            <div className="text-sm text-[var(--color-text-muted)] mt-2">Sufficient for 99.5% of medical scenarios in {inputs.cityTier}.</div>
                        </div>
                    </div>

                    {/* 2. Reasoning */}
                    <div className="bg-white rounded-2xl p-8 border border-[var(--color-border-light)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                        <h3 className="font-serif text-2xl text-[var(--color-navy-900)] mb-6 flex items-center gap-3">
                            <Activity className="text-[var(--color-teal-600)]" /> Why this structure?
                        </h3>
                        <ul className="space-y-4">
                            {result.reasoning.map((r: string, i: number) => (
                                <li key={i} className="flex gap-4 items-start">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-[var(--color-cream-dark)] flex items-center justify-center text-[var(--color-navy-900)] font-bold text-xs shrink-0">{i + 1}</div>
                                    <p className="text-[var(--color-text-main)] leading-relaxed">{r}</p>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* 3. Riders (Grid) */}
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
                        <h3 className="font-serif text-2xl text-[var(--color-navy-900)] mb-6 flex items-center gap-3 ml-2">
                            <Shield className="text-[var(--color-teal-600)]" /> Recommended Riders
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            {result.riders.map((rider: any, i: number) => (
                                <div key={i} className="bg-white p-6 rounded-xl border border-[var(--color-border-light)] hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-lg text-[var(--color-navy-900)]">{rider.name}</h4>
                                        {rider.priority === "High" && <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-bold uppercase">Must Have</span>}
                                        {rider.priority === "Medium" && <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded font-bold uppercase">Recommended</span>}
                                        {rider.priority === "Optional" && <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded font-bold uppercase">Optional</span>}
                                    </div>
                                    <p className="text-sm text-[var(--color-text-secondary)]">{rider.reason}</p>
                                </div>
                            ))}
                            {result.riders.length === 0 && (
                                <div className="col-span-2 p-6 bg-[var(--color-cream-dark)] rounded-xl text-center text-[var(--color-text-muted)] italic">
                                    Standard comprehensive policy covers your needs. No extra riders required.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 4. Education & Mistakes */}
                    <div className="grid md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-700">
                        <div className="bg-red-50 p-8 rounded-2xl border border-red-100">
                            <h3 className="font-serif text-xl text-red-800 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" /> What Most People Get Wrong
                            </h3>
                            <ul className="space-y-4">
                                {result.commonMistakes.map((m: string, i: number) => (
                                    <li key={i} className="text-red-900/80 text-sm leading-relaxed flex gap-2">
                                        <span>•</span> {m}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-[var(--color-teal-50)] p-8 rounded-2xl border border-[var(--color-teal-100)]">
                            <h3 className="font-serif text-xl text-[var(--color-teal-800)] mb-4 flex items-center gap-2">
                                <RefreshCcw className="w-5 h-5" /> Sensitivity Check
                            </h3>
                            <p className="text-sm text-[var(--color-teal-900)] mb-3 opacity-80">This recommendation changes if:</p>
                            <ul className="space-y-4">
                                {result.sensitivityAnalysis.map((s: string, i: number) => (
                                    <li key={i} className="text-[var(--color-teal-900)] text-sm leading-relaxed flex gap-2">
                                        <span>•</span> {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="flex justify-center pt-8 pb-12 animate-in fade-in duration-1000 delay-1000">
                        <Button
                            size="lg"
                            className="bg-[var(--color-navy-900)] text-white hover:bg-[var(--color-teal-600)] shadow-lg px-8 py-6 text-lg"
                            onClick={() => setLocation("/calculator")}
                        >
                            Start New Analysis
                        </Button>
                    </div>

                </div>
            </main>
            <Footer />
        </div>
    );
}
