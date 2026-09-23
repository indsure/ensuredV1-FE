import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AnimatePresence, motion } from "motion/react";
import { Building2, ChevronDown, ChevronUp, MapPin, Search } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { WinnerPodium } from "@/components/hospitals/WinnerPodium";
import { InsurerCard, InsurerCount } from "@/components/hospitals/InsurerCard";
import { ComparisonTray } from "@/components/hospitals/ComparisonTray";
import { HospitalSkeleton } from "@/components/hospitals/HospitalSkeleton";
import { EmptyState } from "@/components/hospitals/EmptyState";
import { getAllStates, getCitiesForState } from "@/lib/data/indian-cities-data";
import { toast } from "@/hooks/use-toast";
import { Info } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Eyebrow } from "@/components/marketing";
import { useLanguage } from "@/i18n/LanguageContext";

// Local interfaces using the shared InsurerCount
interface CityResult {
    city: string;
    unique_hospital_count: number;
    insurers: InsurerCount[];
}

interface PincodeResult {
    pincode: string;
    unique_hospital_count: number;
    insurers: InsurerCount[];
}

interface FilterResult {
    cityLevel: CityResult[];
    pincodeLevel: PincodeResult[];
}

const CollapsibleSection = ({ title, children, className = "", titleClassName = "" }: { title: string, children: React.ReactNode, className?: string, titleClassName?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <section className={`border-t border-[var(--color-border-light)] ${className}`}>
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
    const { t } = useLanguage();
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
                toast({ variant: "destructive", title: t("hosp.max4") });
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
        const source = data.pincodeLevel.length > 0 ? data.pincodeLevel : data.cityLevel;
        
        // Calculate total hospitals - if unique_hospital_count is missing or 0, 
        // sum up the insurer counts as a fallback
        const totalHospitals = source.reduce((acc, loc) => {
            let count = loc.unique_hospital_count;
            
            // If unique_hospital_count is missing or 0, sum the insurer counts
            if (!count || count === 0) {
                count = loc.insurers.reduce((sum, ins) => sum + (ins.hospital_count || 0), 0);
            }
            
            return acc + count;
        }, 0);

        const uniqueInsurers = new Set<string>();
        source.forEach(loc => loc.insurers.forEach(i => uniqueInsurers.add(i.insurer_slug)));

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
        setLoading(true);
        setError(null);
        setResults(null);
        try {
            const params = new URLSearchParams();
            if (state) params.append("state", state);
            if (city) params.append("city", city);
            if (pincode) params.append("pincode", pincode);

            const response = await apiFetch(`/api/hospitals/filter?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || t("hosp.fetch_failed"));
            }

            if (!data.cityLevel || !data.pincodeLevel) {
                throw new Error(t("hosp.invalid"));
            }

            setResults(data);
        } catch (error: any) {
            setError(error.message || t("hosp.wrong"));
        } finally {
            setLoading(false);
        }
    };




    return (
        <div className="bg-[var(--color-cream-main)] text-[var(--color-text-main)] font-sans min-h-screen flex flex-col">
            <Header />

            <main className="flex-grow pt-32 pb-14 sm:pb-20 lg:pb-24">
                {/* Pre-Search Leading Hero */}
                {!results && (
                    <section className="relative overflow-hidden flex flex-col items-center pb-14 px-4">
                        {/* This page was the only navy-first surface on the site,
                            and `min-h-[60vh]` on a hero holding one search box
                            produced a ~700px black void above the fold. It is now
                            cream like everything else, with the search panel
                            carrying the ink instead of the whole page. */}
                        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                            <div className="absolute inset-0 bg-grid-faint mask-fade-edges" />
                            <div
                                className="absolute -top-40 left-1/2 h-[460px] w-[820px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
                                style={{ background: "radial-gradient(ellipse, rgba(29,78,216,0.16), transparent 68%)" }}
                            />
                        </div>

                        <div className="container-editorial relative w-full max-w-4xl">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center mb-10 flex flex-col items-center gap-5"
                            >
                                <Eyebrow accent="var(--lob-travel)" icon={Building2}>
                                    {t("hosp.eyebrow")}
                                </Eyebrow>

                                <h1 className="font-serif font-bold tracking-[-0.035em] leading-[1.05] text-4xl sm:text-6xl text-[var(--color-navy-900)]">
                                    {t("hosp.h_a")}
                                    <br />
                                    <span className="italic text-[var(--lob-travel)]">{t("hosp.h_b")}</span>
                                </h1>

                                <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-[var(--color-text-secondary)]">
                                    {t("hosp.sub")}
                                </p>
                            </motion.div>

                            <div className="on-ink rounded-2xl bg-[var(--color-navy-900)] p-6 sm:p-8 shadow-[0_30px_60px_-24px_rgba(15,23,42,0.5)]">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-white/75 text-[15px]">{t("hosp.state")}</Label>
                                        <Combobox
                                            options={allStates.map(s => ({ value: s, label: s }))}
                                            value={state}
                                            onValueChange={setState}
                                            placeholder={t("hosp.sel_state")}
                                            searchPlaceholder={t("hosp.search_state")}
                                            className="bg-white/10 border-white/20 h-12 text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-white/75 text-[15px]">{t("hosp.city")}</Label>
                                        <Combobox
                                            options={availableCities.map(c => ({ value: c, label: c }))}
                                            value={city}
                                            onValueChange={setCity}
                                            placeholder={state ? t("hosp.sel_city") : t("hosp.state_first")}
                                            searchPlaceholder={t("hosp.search_city")}
                                            className="bg-white/10 border-white/20 h-12 text-white"
                                            disabled={!state}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-white/75 text-[15px]">{t("hosp.pincode")}</Label>
                                        <Input
                                            type="text"
                                            value={pincode}
                                            onChange={(e) => setPincode(e.target.value)}
                                            placeholder={t("hosp.pin6")}
                                            className="h-12 bg-white/10 border-white/20 text-white placeholder-white/45 focus:outline-none focus:border-[var(--color-teal-400)]"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={handleSearch}
                                            disabled={loading}
                                            className="w-full h-12 bg-[var(--color-cta)] text-white px-6 rounded-lg text-[15px] font-semibold hover:bg-[var(--color-teal-500)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Search className="w-5 h-5" />
                                            {loading ? t("hosp.searching") : t("hosp.compare")}
                                        </button>
                                    </div>
                                </div>
                                {error && (
                                    <div className="mt-4 p-4 bg-red-500/15 border border-red-400/40 rounded-lg text-red-200 text-[15px] flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                        {error}
                                    </div>
                                )}
                            </div>

                            <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">
                                {t("hosp.change_often")}
                            </p>
                        </div>
                    </section>
                )}

                {/* Post-Search Sticky Header */}
                {results && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="sticky top-[72px] z-40 bg-[color-mix(in_srgb,var(--color-cream-main)_92%,transparent)] backdrop-blur-md border-b border-[var(--color-border-light)] py-4 shadow-sm"
                    >
                        <div className="container-editorial">
                            <div className="flex flex-col lg:flex-row items-center gap-4">
                                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3 w-full">
                                    <Combobox
                                        options={allStates.map(s => ({ value: s, label: s }))}
                                        value={state}
                                        onValueChange={setState}
                                        placeholder={t("hosp.state")}
                                        searchPlaceholder={t("hosp.search_state")}
                                        className="bg-white border-[var(--color-border-medium)] h-10 text-sm text-[var(--color-text-main)]"
                                    />
                                    <Combobox
                                        options={availableCities.map(c => ({ value: c, label: c }))}
                                        value={city}
                                        onValueChange={setCity}
                                        placeholder={t("hosp.city")}
                                        searchPlaceholder={t("hosp.search_city")}
                                        className="bg-white border-[var(--color-border-medium)] h-10 text-sm text-[var(--color-text-main)]"
                                        disabled={!state}
                                    />
                                    <div className="hidden md:block">
                                        <Input
                                            type="text"
                                            value={pincode}
                                            onChange={(e) => setPincode(e.target.value)}
                                            placeholder={t("hosp.pincode")}
                                            className="h-10 bg-white border-[var(--color-border-medium)] text-[var(--color-text-main)] text-sm placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-teal-600)]"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSearch}
                                    disabled={loading}
                                    className="w-full lg:w-auto bg-[var(--color-cta)] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[var(--color-cta-hover)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 h-10 whitespace-nowrap"
                                >
                                    <Search className="w-4 h-4" />
                                    {loading ? "..." : t("hosp.update")}
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
                        <section className="bg-[var(--surface-mint)] pt-8 pb-12 border-t border-[var(--color-border-light)]">
                            <div className="container-editorial">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-8"
                                >
                                    <div className="flex items-center gap-2 text-[15px] text-[var(--color-text-secondary)] mb-4">
                                        <span>{state || t("hosp.india")}</span>
                                        {city && <><span>/</span><span>{city}</span></>}
                                        {pincode && <><span>/</span><span>{pincode}</span></>}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                        <div>
                                            <h2 className="text-3xl font-serif font-bold text-[var(--color-navy-900)] mb-2">
                                                {t("hosp.coverage")}
                                            </h2>
                                            <p className="text-[var(--color-text-secondary)] text-lg">
                                                {t("hosp.found", { h: getStats(results).totalHospitals, i: getStats(results).totalInsurers })}
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
                                                    {t("hosp.in_city")}
                                                </h2>
                                                <p className="text-[var(--color-text-secondary)]">
                                                    {t("hosp.n_cities", { n: results.cityLevel.length })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {results.cityLevel.slice(0, 12).map((cityData, idx) => {
                                                // Calculate hospital count - use unique_hospital_count if available,
                                                // otherwise sum up insurer counts
                                                let hospitalCount = cityData.unique_hospital_count || 0;
                                                if (hospitalCount === 0 && cityData.insurers.length > 0) {
                                                    hospitalCount = cityData.insurers.reduce((sum, ins) => sum + (ins.hospital_count || 0), 0);
                                                }
                                                
                                                return (
                                                    <InsurerCard
                                                        key={idx}
                                                        type="city"
                                                        title={cityData.city}
                                                        subtitle={t("hosp.card_sub", { h: hospitalCount, i: cityData.insurers.length })}
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
                                                {t("hosp.in_pin")}
                                            </h2>
                                            <p className="text-[var(--color-text-secondary)]">
                                                {t("hosp.n_pins", { n: results.pincodeLevel.length })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {results.pincodeLevel.slice(0, 12).map((pincodeData, idx) => {
                                            // Calculate hospital count - use unique_hospital_count if available,
                                            // otherwise sum up insurer counts
                                            let hospitalCount = pincodeData.unique_hospital_count || 0;
                                            if (hospitalCount === 0 && pincodeData.insurers.length > 0) {
                                                hospitalCount = pincodeData.insurers.reduce((sum, ins) => sum + (ins.hospital_count || 0), 0);
                                            }
                                            
                                            return (
                                                <InsurerCard
                                                    key={idx}
                                                    type="pincode"
                                                    title={pincodeData.pincode}
                                                    subtitle={t("hosp.card_sub", { h: hospitalCount, i: pincodeData.insurers.length })}
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
                    title={t("hosp.how")}
                    className="bg-[var(--color-cream-main)] text-[var(--color-text-main)]"
                    titleClassName="text-[var(--color-navy-900)]"
                >
                    <div className="container-editorial">
                        <div className="max-w-3xl mx-auto">
                            <p className="text-lg text-[var(--color-text-secondary)] mb-4 leading-relaxed text-center">
                                {t("hosp.how1")}
                            </p>
                            <p className="text-lg text-[var(--color-text-secondary)] mb-4 leading-relaxed text-center">
                                {t("hosp.how2")}
                            </p>
                            <div className="flex justify-center gap-8 mb-6">
                                <div className="flex items-center gap-2 font-medium text-[var(--color-navy-900)]">
                                    <Building2 className="w-5 h-5 text-[var(--color-teal-600)]" />
                                    {t("hosp.city_level")}
                                </div>
                                <div className="flex items-center gap-2 font-medium text-[var(--color-navy-900)]">
                                    <MapPin className="w-5 h-5 text-[var(--color-teal-600)]" />
                                    {t("hosp.pin_level")}
                                </div>
                            </div>
                            <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed text-center italic">
                                {t("hosp.how3")}
                            </p>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection
                    title={t("hosp.why")}
                    className="bg-[var(--surface-mint)]"
                    titleClassName="text-[var(--color-navy-900)]"
                >
                    <div className="container-editorial">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                            <div>
                                <p className="text-lg text-[var(--color-text-secondary)] mb-4">
                                    {t("hosp.why1")}
                                </p>
                                <ul className="space-y-3 mb-6">
                                    {[
                                        "hosp.w1",
                                        "hosp.w2",
                                        "hosp.w3",
                                    ].map((item) => (
                                        <li key={item} className="flex items-center gap-3 text-lg text-[var(--color-text-secondary)]">
                                            <span className="w-1.5 h-1.5 bg-[var(--lob-travel)] rounded-full shrink-0" />
                                            {t(item)}
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-lg leading-relaxed font-semibold text-[var(--color-navy-900)] mb-2">
                                    {t("hosp.why2")}
                                </p>
                                <p className="text-lg text-[var(--lob-travel)] font-serif italic">
                                    {t("hosp.why3")}
                                </p>
                            </div>

                            {/* claim-source: the four figures below describe the
                                processed network dataset. They were carried over
                                from the previous version of this page and have not
                                been re-counted against the live table. */}
                            <div className="bg-white border border-[var(--color-border-light)] rounded-2xl p-8 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                                <h3 className="font-serif text-xl font-bold mb-6 border-b border-[var(--color-border-light)] pb-3 text-[var(--color-navy-900)]">
                                    {t("hosp.snapshot")}
                                </h3>
                                <div className="space-y-6">
                                    {[
                                        { icon: Building2, accent: "var(--lob-health)", wash: "var(--lob-health-wash)", stat: "hosp.st1", note: "hosp.st1n" },
                                        { icon: Building2, accent: "var(--lob-life)", wash: "var(--lob-life-wash)", stat: "hosp.st2", note: "hosp.st2n" },
                                        { icon: MapPin, accent: "var(--lob-travel)", wash: "var(--lob-travel-wash)", stat: "hosp.st3", note: "hosp.st3n" },
                                        { icon: Search, accent: "var(--lob-motor)", wash: "var(--lob-motor-wash)", stat: "hosp.st4", note: "hosp.st4n" },
                                    ].map((row) => (
                                        <div key={row.stat} className="flex items-start gap-4">
                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ backgroundColor: row.wash, color: row.accent }}
                                            >
                                                <row.icon className="w-6 h-6" aria-hidden="true" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg mb-0.5 text-[var(--color-navy-900)] tabular">{t(row.stat)}</h4>
                                                <p className="text-[15px] text-[var(--color-text-secondary)]">{t(row.note)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>


                <section className="py-16 bg-[var(--color-cream-main)] text-[var(--color-text-main)]">
                    <div className="container-editorial">
                        <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-8 text-[var(--color-navy-900)] text-center">
                            {t("hosp.covered")}
                        </h2>
                        <p className="text-center text-[var(--color-text-secondary)] mb-12 max-w-2xl mx-auto">
                            {t("hosp.processed")}
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
                                <span className="font-bold block text-base mb-1">{t("hosp.disc_h")}</span>
                                {t("hosp.disc")}
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
