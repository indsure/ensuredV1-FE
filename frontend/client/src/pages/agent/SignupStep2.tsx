import { useState } from 'react'
import { useLocation } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

const POPULAR_INSURERS = [
    'HDFC ERGO', 'Tata AIG', 'Niva Bupa', 'Star Health', 'Manipal Cigna',
    'Care Health', 'Aditya Birla Health', 'New India Assurance', 'United India',
    'ICICI Lombard', 'Bajaj Allianz', 'SBI Health', 'ManipalCigna', 'Reliance Health'
]

export default function AgentSignupStep2() {
    const [, setLocation] = useLocation()
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const filtered = POPULAR_INSURERS.filter(
        (i) => i.toLowerCase().includes(search.toLowerCase()) && !selected.includes(i)
    )

    const addInsurer = (name: string) => {
        setSelected((prev) => [...prev, name])
        setSearch('')
    }

    const addCustom = () => {
        const trimmed = search.trim()
        if (trimmed && !selected.includes(trimmed)) {
            setSelected((prev) => [...prev, trimmed])
            setSearch('')
        }
    }

    const remove = (name: string) =>
        setSelected((prev) => prev.filter((i) => i !== name))

    const handleFinish = async () => {
        setLoading(true)
        setError('')

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setError('Session expired. Please sign up again.')
            setLoading(false)
            return
        }

        if (selected.length > 0) {
            const rows = selected.map((name) => ({ agent_id: user.id, insurer_name: name }))
            const { error: empError } = await supabase.from('empanelments').insert(rows)
            if (empError) {
                setError('Failed to save empanelments. Please try again.')
                setLoading(false)
                return
            }
        }

        setLocation('/agent/dashboard')
    }

    return (
        <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4 py-12">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="w-full max-w-md"
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="font-['Playfair_Display'] text-3xl font-semibold text-[#0F172A] tracking-tight">
                        IndSure
                    </h1>
                    <p className="text-[#64748B] text-sm mt-1">Agent Portal</p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-[#E2E8F0] text-[#94A3B8] text-xs flex items-center justify-center font-semibold">✓</div>
                        <span className="text-sm text-[#94A3B8]">Your Details</span>
                    </div>
                    <div className="w-8 h-px bg-[#0D9488]" />
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-[#0D9488] text-white text-xs flex items-center justify-center font-semibold">2</div>
                        <span className="text-sm font-medium text-[#0D9488]">Empanelment</span>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-[#E2E8F0] p-8 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                    <h2 className="font-['Playfair_Display'] text-2xl font-semibold text-[#0F172A] mb-1">
                        Who are you empanelled with?
                    </h2>
                    <p className="text-[#64748B] text-sm mb-6">
                        This helps us tailor recommendations for your clients. You can update this anytime.
                    </p>

                    {/* Search Input */}
                    <div className="relative mb-3">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), filtered.length ? addInsurer(filtered[0]) : addCustom())}
                            placeholder="Search or type insurer name..."
                            className="w-full h-11 px-4 rounded-xl border border-[#E2E8F0] bg-transparent text-[#0F172A] placeholder-[#94A3B8] text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] transition-all"
                        />
                    </div>

                    {/* Dropdown suggestions */}
                    <AnimatePresence>
                        {search.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="bg-white border border-[#E2E8F0] rounded-xl shadow-lg mb-4 overflow-hidden"
                            >
                                {filtered.slice(0, 5).map((name) => (
                                    <button
                                        key={name}
                                        onClick={() => addInsurer(name)}
                                        className="w-full text-left px-4 py-2.5 text-sm text-[#334155] hover:bg-[#F0F0ED] transition-colors"
                                    >
                                        {name}
                                    </button>
                                ))}
                                {search.trim() && !POPULAR_INSURERS.some(i => i.toLowerCase() === search.toLowerCase()) && (
                                    <button
                                        onClick={addCustom}
                                        className="w-full text-left px-4 py-2.5 text-sm text-[#0D9488] font-medium hover:bg-[#F0F0ED] transition-colors border-t border-[#E2E8F0]"
                                    >
                                        + Add "{search.trim()}"
                                    </button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Selected Pills */}
                    {selected.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                            <AnimatePresence>
                                {selected.map((name) => (
                                    <motion.span
                                        key={name}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D9488]/10 text-[#0D9488] text-xs font-semibold border border-[#0D9488]/20"
                                    >
                                        {name}
                                        <button onClick={() => remove(name)} className="text-[#0D9488]/60 hover:text-[#0D9488] transition-colors">×</button>
                                    </motion.span>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {error && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-sm text-[#ef4444] bg-red-50 px-4 py-2.5 rounded-lg mb-4"
                        >
                            {error}
                        </motion.p>
                    )}

                    <button
                        onClick={handleFinish}
                        disabled={loading}
                        className="w-full h-11 bg-[#0D9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-xl shadow-lg shadow-teal-900/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                Setting up dashboard...
                            </span>
                        ) : selected.length > 0 ? `Go to Dashboard →` : 'Skip for now →'}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
