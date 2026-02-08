import { X, Check } from "lucide-react";
import { InsurerCount } from "./InsurerCard"; // Need to ensure this is shared
import { motion } from "framer-motion";

interface ComparisonItem {
    id: string; // Unique ID (e.g., city name or pincode)
    title: string;
    type: "city" | "pincode";
    insurers: InsurerCount[];
}

interface ComparisonViewProps {
    items: ComparisonItem[];
    onClose: () => void;
}

export function ComparisonView({ items, onClose }: ComparisonViewProps) {
    // Get all unique insurers across all selected items
    const allInsurers = Array.from(new Set(
        items.flatMap(item => item.insurers.map(i => i.insurer_slug))
    )).sort();

    return (
        <div className="flex flex-col h-full bg-[var(--color-cream-main)]">
            {/* Header */}
            <div className="p-6 border-b border-[var(--color-border-subtle)] bg-white flex justify-between items-center shadow-sm z-10">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-[var(--color-navy-900)]">
                        Network Comparison
                    </h2>
                    <p className="text-[var(--color-text-secondary)]">
                        Comparing hospital counts across {items.length} locations
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-[var(--color-text-muted)]"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Scrollable grid */}
            <div className="flex-1 overflow-auto p-8">
                <div className="min-w-max">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="p-4 text-left min-w-[200px] sticky top-0 bg-[var(--color-cream-main)] z-20 border-b-2 border-[var(--color-navy-900)]">
                                    <span className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Insurer</span>
                                </th>
                                {items.map(item => (
                                    <th key={item.id} className="p-4 text-center min-w-[180px] sticky top-0 bg-[var(--color-cream-main)] z-20 border-b-2 border-[var(--color-navy-900)]">
                                        <div className="font-bold text-lg text-[var(--color-navy-900)]">{item.title}</div>
                                        <div className="text-xs font-normal text-[var(--color-text-muted)] uppercase tracking-wide bg-white px-2 py-0.5 rounded-full inline-block mt-1 border border-[var(--color-border-light)]">
                                            {item.type}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {allInsurers.map((slug, idx) => (
                                <tr key={slug} className={idx % 2 === 0 ? "bg-white" : "bg-transparent"}>
                                    <td className="p-4 border-b border-[var(--color-border-light)] font-medium text-[var(--color-navy-900)] sticky left-0 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[var(--color-teal-500)]" />
                                            <span className="capitalize">{slug.replace(/_/g, " ")}</span>
                                        </div>
                                    </td>
                                    {items.map(item => {
                                        const insurerData = item.insurers.find(i => i.insurer_slug === slug);
                                        const count = insurerData ? insurerData.hospital_count : 0;

                                        // Find max count for this item to normalize bars if we wanted
                                        // Simple number display for now

                                        return (
                                            <td key={`${item.id}-${slug}`} className="p-4 border-b border-[var(--color-border-light)] text-center">
                                                {count > 0 ? (
                                                    <div className="inline-flex flex-col items-center">
                                                        <span className="text-xl font-bold font-mono text-[var(--color-teal-600)]">
                                                            {count}
                                                        </span>
                                                        <span className="text-[10px] text-[var(--color-text-muted)]">hospitals</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[var(--color-text-muted)] opacity-30 text-2xl font-mono">-</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer / Legend relative info */}
            <div className="p-4 bg-[var(--color-teal-50)] border-t border-[var(--color-teal-200)] text-center text-[var(--color-navy-900)] text-sm">
                <span className="font-bold">Tip:</span> Higher network density usually suggests easier cashless approvals in that region.
            </div>
        </div>
    );
}
