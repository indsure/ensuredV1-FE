import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, MapPin } from "lucide-react";
import { clsx } from "clsx";

export interface InsurerCount {
    insurer_slug: string;
    hospital_count: number;
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

    // Sort insurers by count descending for better presentation
    const sortedInsurers = [...insurers].sort((a, b) => b.hospital_count - a.hospital_count);
    const displayInsurers = isExpanded ? sortedInsurers : sortedInsurers.slice(0, 5);
    const remainingCount = Math.max(0, insurers.length - 5);

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
