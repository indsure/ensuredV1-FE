import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Copy } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ComparisonView } from "./ComparisonView";
import { InsurerCount } from "./InsurerCard"; // Assuming we can iterate on shared types later

// Define interfaces locally for now to avoid circular deps if types aren't extracted
interface ComparisonItem {
    id: string; // Unique ID (e.g., city name or pincode)
    title: string;
    type: "city" | "pincode";
    insurers: InsurerCount[];
}

interface ComparisonTrayProps {
    selectedItems: ComparisonItem[];
    onRemoveItem: (id: string) => void;
    onClearAll: () => void;
}

export function ComparisonTray({ selectedItems, onRemoveItem, onClearAll }: ComparisonTrayProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Don't render if empty
    if (selectedItems.length === 0) return null;

    return (
        <>
            <AnimatePresence>
                {selectedItems.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
                    >
                        <div className="bg-[var(--color-navy-900)] text-white p-4 rounded-xl shadow-2xl flex items-center gap-6 pointer-events-auto border border-[var(--color-teal-900)] max-w-2xl w-full mx-auto">
                            <div className="flex-1">
                                <p className="text-sm font-bold text-[var(--color-teal-400)] mb-1 uppercase tracking-wider">
                                    Compare Analysis
                                </p>
                                <p className="text-white text-sm">
                                    <span className="font-bold text-lg mr-1">{selectedItems.length}</span>
                                    locations selected
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onClearAll}
                                    className="text-[var(--color-white-muted)] hover:text-white text-sm font-medium px-3 py-2 transition-colors"
                                >
                                    Clear all
                                </button>

                                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                                    <DialogTrigger asChild>
                                        <button
                                            className="bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-500)] text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-teal-900/40"
                                            disabled={selectedItems.length < 2}
                                        >
                                            Compare Now
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-5xl h-[90vh] p-0 bg-[var(--color-cream-light)] overflow-hidden">
                                        <ComparisonView items={selectedItems} onClose={() => setIsOpen(false)} />
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
