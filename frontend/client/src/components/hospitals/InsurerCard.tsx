import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, MapPin } from "lucide-react";
import { clsx } from "clsx";
import { apiFetch } from "@/lib/api";

export interface InsurerCount {
    insurer_slug: string;
    hospital_count: number;
}

interface HospitalSample {
    hospital_name: string;
    address: string;
    insurer_slug: string;
}

interface InsurerCardProps {
    title: string;
    subtitle: string;
    insurers: InsurerCount[];
    type: "city" | "pincode";
    delay?: number;
    isSelected?: boolean;
    onToggleSelect?: () => void;
}

export function InsurerCard({ title, subtitle, insurers, type, delay = 0, isSelected = false, onToggleSelect }: InsurerCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [hospitalSamples, setHospitalSamples] = useState<HospitalSample[]>([]);
    const [loadingHospitals, setLoadingHospitals] = useState(true);

    // Sort insurers by count descending for better presentation
    const sortedInsurers = [...insurers].sort((a, b) => b.hospital_count - a.hospital_count);
    const displayInsurers = isExpanded ? sortedInsurers : sortedInsurers.slice(0, 5);
    const remainingCount = Math.max(0, insurers.length - 5);

    // Fetch hospital samples on mount
    useEffect(() => {
        const params = new URLSearchParams();
        if (type === "city") params.append("city", title);
        if (type === "pincode") params.append("pincode", title);
        params.append("limit", "10");

        apiFetch(`/api/hospitals/samples?${params.toString()}`)
            .then(r => {
                if (!r.ok) {
                    throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                }
                return r.json();
            })
            .then(data => {
                setHospitalSamples(data);
            })
            .catch(err => {
                console.error(`[InsurerCard] Failed to fetch hospital samples for ${title}:`, err);
            })
            .finally(() => {
                setLoadingHospitals(false);
            });
    }, [title, type]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={clsx(
                "card-white group transition-all duration-300 relative",
                isSelected ? "border-[var(--color-teal-500)] ring-1 ring-[var(--color-teal-500)] bg-[var(--color-teal-50)]/10" : "hover:border-[var(--color-teal-500)]"
            )}
        >
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className={clsx(
                        "text-xl font-bold mb-1 group-hover:text-[var(--color-teal-700)] transition-colors",
                        type === "pincode" ? "font-mono text-[var(--color-navy-900)]" : "text-[var(--color-navy-900)]"
                    )}>
                        {title}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] flex items-center gap-1.5">
                        {type === "city" ? <Building2 className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                        {subtitle}
                    </p>
                </div>
                {onToggleSelect && (
                    <button
                        onClick={onToggleSelect}
                        className={clsx(
                            "w-6 h-6 rounded border flex items-center justify-center transition-colors",
                            isSelected
                                ? "bg-[var(--color-teal-600)] border-[var(--color-teal-600)] text-white"
                                : "border-[var(--color-border-subtle)] text-transparent hover:border-[var(--color-teal-400)]"
                        )}
                        aria-label={isSelected ? "Unselect for comparison" : "Select for comparison"}
                    >
                        {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left side: Insurers */}
                <div className="space-y-3">
                    {displayInsurers.map((insurer, i) => (
                        <div
                            key={i}
                            className="flex justify-between items-center text-sm"
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[var(--color-teal-200)] rounded-full" />
                                <span className="text-[var(--color-text-secondary)] capitalize font-medium">
                                    {insurer.insurer_slug.replace(/_/g, " ")}
                                </span>
                            </div>
                            <span className="font-mono font-bold text-[var(--color-teal-600)] bg-[var(--color-teal-50)] px-2 py-0.5 rounded">
                                {insurer.hospital_count}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Right side: Hospital samples */}
                <div className="border-l border-[var(--color-border-light)] pl-4">
                    <div className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
                        Sample Hospitals
                    </div>
                    {loadingHospitals ? (
                        <div className="space-y-2">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-6 bg-[var(--color-border-light)] rounded animate-pulse" />
                            ))}
                        </div>
                    ) : hospitalSamples.length > 0 ? (
                        <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-2">
                            {hospitalSamples.slice(0, 8).map((hospital, i) => (
                                <div key={i} className="text-xs border-b border-[var(--color-border-light)] pb-2 last:border-0">
                                    <div className="font-medium text-[var(--color-navy-900)] line-clamp-2 leading-tight mb-0.5">
                                        {hospital.hospital_name}
                                    </div>
                                    <div className="text-[var(--color-text-muted)] text-xs line-clamp-1">
                                        {hospital.address}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                            <p className="italic">No hospital names available</p>
                            <p className="text-xs">This insurer has not shared its hospital list with us yet.</p>
                        </div>
                    )}
                </div>
            </div>

            {insurers.length > 5 && (
                <div className="mt-4 pt-3 border-t border-[var(--color-border-light)] text-center">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-teal-600)] transition-colors w-full text-center py-1 outline-none focus:text-[var(--color-teal-600)]"
                    >
                        {isExpanded ? "Show less" : `+${remainingCount} more insurers active`}
                    </button>
                </div>
            )}
        </motion.div>
    );
}
