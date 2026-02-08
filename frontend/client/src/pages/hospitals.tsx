import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronDown, ChevronUp, MapPin, Search } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { WinnerPodium } from "@/components/hospitals/WinnerPodium";
import { InsurerCard, InsurerCount } from "@/components/hospitals/InsurerCard";
import { ComparisonTray } from "@/components/hospitals/ComparisonTray";
import { HospitalSkeleton } from "@/components/hospitals/HospitalSkeleton";
import { EmptyState } from "@/components/hospitals/EmptyState";
import { getAllStates, getCitiesForState } from "@/lib/indian-cities-data";
import { getApiBase } from "@/lib/api";
import { toast } from "sonner";
import { Info } from "lucide-react";

// Local interfaces using the shared InsurerCount
interface CityResult {
    city: string;
    insurers: InsurerCount[];
}

interface PincodeResult {
    pincode: string;
    insurers: InsurerCount[];
}

interface FilterResult {
    cityLevel: CityResult[];
    pincodeLevel: PincodeResult[];
}

const CollapsibleSection = ({ title, children, className = "", titleClassName = "" }: { title: string, children: React.ReactNode, className?: string, titleClassName?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <section className={`border-t border-[var(--color-border-subtle)] ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full py-6 flex items-center justify-between container-editorial hover:opacity-80 transition-opacity"
            >
                <h2 className={`text-2xl font-serif font-bold ${titleClassName}`}>
                    {title}
                </h2>
                {isOpen ? <ChevronUp className={`w-6 h-6 ${titleClassName}`} /> : <ChevronDown className={`w-6 h-6 ${titleClassName}`} />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pb-12 pt-4">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};

export default function HospitalFilter() {
    const [state, setState] = useState("");
    const [city, setCity] = useState("");
    const [pincode, setPincode] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<FilterResult | null>(null);
    const [selectedItems, setSelectedItems] = useState<{ id: string, title: string, type: "city" | "pincode", insurers: InsurerCount[] }[]>([]);
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const resultsRef = useRef<HTMLDivElement>(null);

    const allStates = getAllStates();

    // Selection Handler
    const toggleSelection = (item: { id: string, title: string, type: "city" | "pincode", insurers: InsurerCount[] }) => {
        if (selectedItems.find(i => i.id === item.id)) {
            setSelectedItems(selectedItems.filter(i => i.id !== item.id));
        } else {
            if (selectedItems.length >= 4) {
                toast.error("You can compare up to 4 locations at a time");
                return;
            }
            setSelectedItems([...selectedItems, item]);
        }
    };

    // Helper to calculate top insurers
    const getTopInsurers = (data: FilterResult) => {
        const insurerMap = new Map<string, number>();
        const source = data.pincodeLevel.length > 0 ? data.pincodeLevel : data.cityLevel;

        source.forEach(loc => {
            loc.insurers.forEach(ins => {
                const current = insurerMap.get(ins.insurer_slug) || 0;
                insurerMap.set(ins.insurer_slug, current + ins.hospital_count);
            });
        });

        return Array.from(insurerMap.entries())
            .map(([slug, count]) => ({ slug, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
    };

    // Helper to calculate total stats
    const getStats = (data: FilterResult) => {
        const totalHospitals = (data.pincodeLevel.length > 0 ? data.pincodeLevel : data.cityLevel)
            .reduce((acc, loc) => acc + loc.insurers.reduce((s, i) => s + i.hospital_count, 0), 0);

        const uniqueInsurers = new Set<string>();
        (data.pincodeLevel.length > 0 ? data.pincodeLevel : data.cityLevel)
            .forEach(loc => loc.insurers.forEach(i => uniqueInsurers.add(i.insurer_slug)));

        return { totalHospitals, totalInsurers: uniqueInsurers.size };
    };

    // Scroll to results when they load
    useEffect(() => {
        if (results && resultsRef.current) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [results]);

    // Load cities when state changes
    useEffect(() => {
        if (state) {
            setAvailableCities(getCitiesForState(state));
            setCity(""); // Reset city when state changes
        } else {
            setAvailableCities([]);
            setCity("");
        }
    }, [state]);

    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        console.log("Search button clicked");
        setLoading(true);
        setError(null);
        setResults(null);
        try {
            const params = new URLSearchParams();
            if (state) params.append("state", state);
            if (city) params.append("city", city);
            if (pincode) params.append("pincode", pincode);

            console.log("Fetching params:", params.toString());
            const response = await fetch(`${getApiBase()}/api/hospitals/filter?${params.toString()}`);
            console.log("Response status:", response.status);

            const data = await response.json();
            console.log("Data received:", JSON.stringify(data, null, 2));

            if (!response.ok) {
                throw new Error(data.error || "Failed to fetch data");
            }

            if (!data.cityLevel || !data.pincodeLevel) {
                console.error("Invalid data format received:", data);
                throw new Error("Received invalid data from server");
            }

            setResults(data);
        } catch (error: any) {
            console.error("Failed to fetch hospital data:", error);
            setError(error.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Auto-search on mount with no filters
        console.log("Auto-search on mount");
        handleSearch();
    }, []);

    return (
        <div className="bg-[var(--color-navy-900)] text-white font-sans min-h-screen flex flex-col">
            <Header />

            <main className="flex-grow pt-40 pb-24">
                {/* Pre-Search Leading Hero */}
                {!results && (
                    <section className="min-h-[60vh] flex flex-col justify-center items-center pb-16 bg-[var(--color-navy-900)] px-4">
                        <div className="container-editorial w-full max-w-4xl">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center mb-12"
                            >
                                <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6 text-white leading-tight">
                                    Hospital <span className="text-[var(--color-teal-400)]">Network</span> Finder
                                </h1>
                                <p className="text-2xl text-[var(--color-white-muted)] font-serif mb-4">
                                    Compare insurer hospital coverage before you buy.
                                </p>
                            </motion.div>

                            <div className="bg-[var(--color-blue-800)] border border-[var(--color-border-subtle)] rounded-2xl p-8 shadow-2xl">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[var(--color-white-muted)]">State</Label>
                                        <Combobox
                                            options={allStates.map(s => ({ value: s, label: s }))}
                                            value={state}
                                            onValueChange={setState}
                                            placeholder="Select state"
                                            searchPlaceholder="Search state..."
                                            className="bg-[var(--color-navy-900)] border-[var(--color-border-subtle)] h-12 text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[var(--color-white-muted)]">City</Label>
                                        <Combobox
                                            options={availableCities.map(c => ({ value: c, label: c }))}
                                            value={city}
                                            onValueChange={setCity}
                                            placeholder={state ? "Select city" : "Select state first"}
                                            searchPlaceholder="Search city..."
                                            className="bg-[var(--color-navy-900)] border-[var(--color-border-subtle)] h-12 text-white"
                                            disabled={!state}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[var(--color-white-muted)]">Pincode</Label>
                                        <Input
                                            type="text"
                                            value={pincode}
                                            onChange={(e) => setPincode(e.target.value)}
                                            placeholder="Enter 6-digit pincode"
                                            className="h-12 bg-[var(--color-navy-900)] border-[var(--color-border-subtle)] text-white placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-teal-600)]"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={handleSearch}
                                            disabled={loading}
                                            className="w-full bg-[var(--color-teal-600)] text-white px-6 py-3 rounded-lg font-medium hover:bg-[var(--color-teal-400)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 h-12 shadow-lg shadow-teal-900/20"
                                        >
                                            <Search className="w-5 h-5" />
                                            {loading ? "Searching..." : "Compare Coverage"}
                                        </button>
                                    </div>
                                </div>
                                {error && (
                                    <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        {error}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Post-Search Sticky Header */}
                {results && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="sticky top-[72px] z-40 bg-[var(--color-navy-900)] border-b border-[var(--color-border-subtle)] py-4 shadow-lg"
                    >
                        <div className="container-editorial">
                            <div className="flex flex-col lg:flex-row items-center gap-4">
                                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3 w-full">
                                    <Combobox
                                        options={allStates.map(s => ({ value: s, label: s }))}
                                        value={state}
                                        onValueChange={setState}
                                        placeholder="State"
                                        searchPlaceholder="Search state..."
                                        className="bg-[var(--color-blue-800)] border-transparent h-10 text-sm text-white"
                                    />
                                    <Combobox
                                        options={availableCities.map(c => ({ value: c, label: c }))}
                                        value={city}
                                        onValueChange={setCity}
                                        placeholder="City"
                                        searchPlaceholder="Search city..."
                                        className="bg-[var(--color-blue-800)] border-transparent h-10 text-sm text-white"
                                        disabled={!state}
                                    />
                                    <div className="hidden md:block">
                                        <Input
                                            type="text"
                                            value={pincode}
                                            onChange={(e) => setPincode(e.target.value)}
                                            placeholder="Pincode"
                                            className="h-10 bg-[var(--color-blue-800)] border-transparent text-white text-sm placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-teal-600)]"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSearch}
                                    disabled={loading}
                                    className="w-full lg:w-auto bg-[var(--color-teal-600)] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[var(--color-teal-400)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 h-10 whitespace-nowrap"
                                >
                                    <Search className="w-4 h-4" />
                                    {loading ? "..." : "Update Search"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Loading Skeleton */}
                {loading && !results && (
                    <HospitalSkeleton />
                )}

                {/* Results Section */}
                {results && !loading && (
                    <>
                        {/* Results Hero & Stats */}
                        <section className="bg-[var(--color-navy-900)] pt-8 pb-12 text-white border-t border-[var(--color-border-subtle)]">
                            <div className="container-editorial">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-8"
                                >
                                    <div className="flex items-center gap-2 text-[var(--color-white-muted)] text-sm mb-4 font-mono">
                                        <span>{state || "India"}</span>
                                        {city && <><span>/</span><span>{city}</span></>}
                                        {pincode && <><span>/</span><span>{pincode}</span></>}
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-8 items-start">
                                        <div>
                                            <h2 className="text-3xl font-serif font-bold text-white mb-2">
                                                Network Coverage
                                            </h2>
                                            <p className="text-[var(--color-white-muted)] text-lg">
                                                Found <span className="text-[var(--color-teal-400)] font-bold">{getStats(results).totalHospitals} hospitals</span> across <span className="text-white font-bold">{getStats(results).totalInsurers} insurers</span> in this area.
                                            </p>
                                        </div>

                                        {/* Winner Podium */}
                                        <div className="md:pl-8">
                                            <WinnerPodium
                                                insurers={getTopInsurers(results)}
                                                totalHospitals={getStats(results).totalHospitals}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </section>

                        <section ref={resultsRef} className="bg-[var(--color-cream-main)] text-[var(--color-text-main)] py-12">
                            <div className="container-editorial">
                                {/* City-Level Results */}
                                {results.cityLevel.length > 0 && (
                                    <div className="mb-16">
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="p-3 bg-[var(--color-teal-600)] rounded-lg">
                                                <Building2 className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h2 className="text-3xl font-serif font-bold text-[var(--color-navy-900)]">
                                                    Hospitals in Your City
                                                </h2>
                                                <p className="text-[var(--color-text-secondary)]">
                                                    {results.cityLevel.length} cities found
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {results.cityLevel.slice(0, 12).map((cityData, idx) => {
                                                const totalHospitals = cityData.insurers.reduce(
                                                    (sum, i) => sum + i.hospital_count,
                                                    0
                                                );
                                                return (
                                                    <InsurerCard
                                                        key={idx}
                                                        type="city"
                                                        title={cityData.city}
                                                        subtitle={`${totalHospitals} hospitals · ${cityData.insurers.length} insurers`}
                                                        insurers={cityData.insurers}
                                                        delay={idx * 0.05}
                                                        isSelected={selectedItems.some(i => i.id === cityData.city)}
                                                        onToggleSelect={() => toggleSelection({
                                                            id: cityData.city,
                                                            title: cityData.city,
                                                            type: "city",
                                                            insurers: cityData.insurers
                                                        })}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Pincode-Level Results */}
                                <div>
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-3 bg-[var(--color-gold-500)] rounded-lg">
                                            <MapPin className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-serif font-bold text-[var(--color-navy-900)]">
                                                Hospitals in Your Pincode
                                            </h2>
                                            <p className="text-[var(--color-text-secondary)]">
                                                {results.pincodeLevel.length} pincodes found
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {results.pincodeLevel.slice(0, 12).map((pincodeData, idx) => {
                                            const totalHospitals = pincodeData.insurers.reduce(
                                                (sum, i) => sum + i.hospital_count,
                                                0
                                            );
                                            return (
                                                <InsurerCard
                                                    key={idx}
                                                    type="pincode"
                                                    title={pincodeData.pincode}
                                                    subtitle={`${totalHospitals} hospitals · ${pincodeData.insurers.length} insurers`}
                                                    insurers={pincodeData.insurers}
                                                    delay={idx * 0.05}
                                                    isSelected={selectedItems.some(i => i.id === pincodeData.pincode)}
                                                    onToggleSelect={() => toggleSelection({
                                                        id: pincodeData.pincode,
                                                        title: pincodeData.pincode,
                                                        type: "pincode",
                                                        insurers: pincodeData.insurers
                                                    })}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {/* No Results Message */}
                {results && !loading && results.cityLevel.length === 0 && results.pincodeLevel.length === 0 && (
                    <div ref={resultsRef}>
                        <EmptyState />
                    </div>
                )}


                {/* Educational Sections (Progressive Disclosure) */}
                <CollapsibleSection
                    title="How this works"
                    className="bg-[var(--color-cream-main)] text-[var(--color-text-main)]"
                    titleClassName="text-[var(--color-navy-900)]"
                >
                    <div className="container-editorial">
                        <div className="max-w-3xl mx-auto">
                            <p className="text-lg text-[var(--color-text-secondary)] mb-4 leading-relaxed text-center">
                                Hospital Network Finder shows how well each insurer is networked in your area.
                            </p>
                            <p className="text-lg text-[var(--color-text-secondary)] mb-4 leading-relaxed text-center">
                                Instead of scanning PDFs or relying on sales claims, you get a direct comparison of hospital counts by insurer at:
                            </p>
                            <div className="flex justify-center gap-8 mb-6">
                                <div className="flex items-center gap-2 font-medium text-[var(--color-navy-900)]">
                                    <Building2 className="w-5 h-5 text-[var(--color-teal-600)]" />
                                    City level
                                </div>
                                <div className="flex items-center gap-2 font-medium text-[var(--color-navy-900)]">
                                    <MapPin className="w-5 h-5 text-[var(--color-teal-600)]" />
                                    Pincode level
                                </div>
                            </div>
                            <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed text-center italic">
                                This helps you evaluate network strength before buying health insurance, not after a claim is rejected.
                            </p>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection
                    title="Why this exists"
                    className="bg-[var(--color-navy-900)] text-white"
                    titleClassName="text-white"
                >
                    <div className="container-editorial">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div>
                                <p className="text-lg text-[var(--color-white-muted)] mb-4">
                                    Hospital network data in India is:
                                </p>
                                <ul className="space-y-3 mb-6">
                                    <li className="flex items-center gap-3 text-[var(--color-white-muted)]">
                                        <span className="w-1.5 h-1.5 bg-[var(--color-teal-400)] rounded-full" />
                                        Buried inside PDFs
                                    </li>
                                    <li className="flex items-center gap-3 text-[var(--color-white-muted)]">
                                        <span className="w-1.5 h-1.5 bg-[var(--color-teal-400)] rounded-full" />
                                        Inconsistent across insurers
                                    </li>
                                    <li className="flex items-center gap-3 text-[var(--color-white-muted)]">
                                        <span className="w-1.5 h-1.5 bg-[var(--color-teal-400)] rounded-full" />
                                        Impossible to compare objectively
                                    </li>
                                </ul>
                                <p className="text-lg text-[var(--color-white-muted)] leading-relaxed font-medium text-white mb-2">
                                    We extracted, standardized, and indexed official network lists into a single, queryable dataset.
                                </p>
                                <p className="text-lg text-[var(--color-teal-400)] font-serif italic">
                                    No PDFs. No customer care calls. No guesswork.
                                </p>
                            </div>
                            <div className="bg-[var(--color-blue-800)] border border-[var(--color-border-subtle)] rounded-xl p-8">
                                <h3 className="text-white font-serif text-xl mb-6 border-b border-[var(--color-border-subtle)] pb-2">Coverage Snapshot</h3>
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-[var(--color-teal-600)] rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Building2 className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg mb-1 text-white">83,000+ hospitals</h3>
                                            <p className="text-sm text-[var(--color-white-muted)]">Verified from official insurer network lists</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-[var(--color-teal-600)] rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Building2 className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg mb-1 text-white">2,800+ cities</h3>
                                            <p className="text-sm text-[var(--color-white-muted)]">Nationwide urban and semi-urban coverage</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-[var(--color-teal-600)] rounded-lg flex items-center justify-center flex-shrink-0">
                                            <MapPin className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg mb-1 text-white">19,000+ pincodes</h3>
                                            <p className="text-sm text-[var(--color-white-muted)]">Granular, locality-level insight</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-[var(--color-teal-600)] rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Search className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg mb-1 text-white">16 insurers</h3>
                                            <p className="text-sm text-[var(--color-white-muted)]">Major health insurance providers in India</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>


                <section className="py-16 bg-[var(--color-cream-main)] text-[var(--color-text-main)]">
                    <div className="container-editorial">
                        <h2 className="text-4xl font-serif font-bold mb-8 text-[var(--color-navy-900)] text-center">
                            Insurers Covered
                        </h2>
                        <p className="text-center text-[var(--color-text-secondary)] mb-12 max-w-2xl mx-auto">
                            Official hospital network lists processed from:
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                            {[
                                "Bajaj Allianz",
                                "Star Health",
                                "HDFC Ergo",
                                "ICICI Lombard",
                                "Care Health",
                                "Max Bupa",
                                "Niva Bupa",
                                "Aditya Birla",
                                "Reliance Health",
                                "Tata AIG",
                                "New India",
                                "Galaxy Health",
                                "Manipal Cigna",
                                "Future Generali",
                                "Kotak Health",
                                "Universal Sompo"
                            ].map((insurer, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="bg-white border border-[var(--color-border-light)] rounded-lg p-4 text-center hover:border-[var(--color-teal-600)] transition-colors"
                                >
                                    <p className="font-medium text-[var(--color-navy-900)]">{insurer}</p>
                                </motion.div>
                            ))}
                        </div>

                        <div className="max-w-3xl mx-auto bg-[var(--color-blue-50)] border border-[var(--color-blue-100)] rounded-lg p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                            <div className="p-3 bg-[var(--color-blue-100)] rounded-full text-[var(--color-blue-700)]">
                                <Info className="w-6 h-6" />
                            </div>
                            <p className="text-[var(--color-navy-900)] text-sm leading-relaxed">
                                <span className="font-bold block text-base mb-1">Important Disclaimer</span>
                                These network counts are based on official insurer lists processed by our engine. While we aim for accuracy, hospital tie-ups change frequently.
                                Always verify with the insurer or TPA before planned hospitalization. This tool tracks network <em>presence</em>, not quality of care.
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            <ComparisonTray
                selectedItems={selectedItems}
                onRemoveItem={(id) => setSelectedItems(selectedItems.filter(i => i.id !== id))}
                onClearAll={() => setSelectedItems([])}
            />
            <Footer />
        </div>
    );
}
