import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Search, X, Check, Plus, CheckCircle2 } from 'lucide-react'

// Insurers grouped by category
const INSURERS_BY_CATEGORY = {
    'Life Insurance': [
        'LIC of India',
        'HDFC Life',
        'Max Life Insurance',
        'SBI Life',
        'ICICI Prudential Life',
        'Bajaj Allianz Life',
        'Tata AIA Life',
        'Aditya Birla Sun Life',
        'Kotak Life',
        'PNB MetLife'
    ],
    'Health Insurance': [
        'Star Health',
        'Niva Bupa',
        'Care Health Insurance',
        'HDFC Ergo Health',
        'ICICI Lombard Health',
        'Aditya Birla Health',
        'Manipal Cigna'
    ],
    'General Insurance': [
        'Bajaj Allianz General',
        'Reliance General',
        'TATA AIG',
        'SBI General',
        'Royal Sundaram',
        'IFFCO Tokio',
        'New India Assurance'
    ]
}

// Flatten all insurers for search
const ALL_INSURERS = Object.values(INSURERS_BY_CATEGORY).flat()

export default function AgentSignupStep2() {
    const [, setLocation] = useLocation()
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showCustomInput, setShowCustomInput] = useState(false)
    const [customInsurer, setCustomInsurer] = useState('')

    // Set by step 1 when the account was created but the agency request was
    // not stored. Read once on mount — it is a hand-off from the previous
    // screen, not state that changes here.
    const [agencyUnconfirmed] = useState(
        () => new URLSearchParams(window.location.search).get('agency') === 'unconfirmed'
    )

    // Selections live in component state only. They are not written to web
    // storage on purpose — but that means a refresh or an accidental close
    // silently discards them, so warn first. (A real Back to step 1 is not
    // offered here: the account is already created by this point.)
    useEffect(() => {
        if (selected.length === 0) return
        const warn = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [selected])

    const toggleInsurer = (name: string) => {
        if (selected.includes(name)) {
            setSelected(prev => prev.filter(i => i !== name))
        } else {
            setSelected(prev => [...prev, name])
        }
    }

    const removeInsurer = (name: string) => {
        setSelected(prev => prev.filter(i => i !== name))
    }

    const addCustomInsurer = () => {
        const trimmed = customInsurer.trim()
        if (trimmed && !selected.includes(trimmed)) {
            setSelected(prev => [...prev, trimmed])
            setCustomInsurer('')
            setShowCustomInput(false)
        }
    }

    const handleFinish = async () => {
        if (selected.length === 0) {
            setError('Please select at least one insurer to continue')
            return
        }

        setLoading(true)
        setError('')

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setError('Session expired. Please sign up again.')
            setLoading(false)
            return
        }

        const rows = selected.map((name) => ({ agent_id: user.id, insurer_name: name }))
        const { error: empError } = await supabase.from('empanelments').insert(rows)
        if (empError) {
            setError('Failed to save empanelments. Please try again.')
            setLoading(false)
            return
        }

        setLocation('/agent/dashboard')
    }

    const handleSkip = () => {
        setLocation('/agent/dashboard')
    }

    // Filter insurers based on search
    const getFilteredInsurers = () => {
        if (!search) return INSURERS_BY_CATEGORY

        const searchLower = search.toLowerCase()
        const filtered: typeof INSURERS_BY_CATEGORY = {
            'Life Insurance': [],
            'Health Insurance': [],
            'General Insurance': []
        }

        Object.entries(INSURERS_BY_CATEGORY).forEach(([category, insurers]) => {
            filtered[category as keyof typeof INSURERS_BY_CATEGORY] = insurers.filter(
                insurer => insurer.toLowerCase().includes(searchLower)
            )
        })

        return filtered
    }

    const filteredInsurers = getFilteredInsurers()
    const hasResults = Object.values(filteredInsurers).some(arr => arr.length > 0)

    return (
        <div className="min-h-screen flex flex-col lg:flex-row">
            {/* LEFT COLUMN - INSURER SELECTION */}
            <div className="w-full lg:w-[45%] bg-white flex flex-col">
                <div className="flex-1 flex flex-col px-6 py-8 lg:px-20 lg:py-12 max-w-4xl mx-auto w-full">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="font-['Playfair_Display'] text-[28px] font-semibold text-slate-900 tracking-tight mb-1">
                            IndSure
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">Advisor Portal</p>
                    </div>

                    {/* Step 1 said "agency" but the server did not confirm it
                        stored the request. Rather than let the promise on the
                        previous screen stand unearned, say so and give them a
                        way to reach us. Silence here would mean an agency that
                        thinks a team is coming and never hears from anyone. */}
                    {agencyUnconfirmed && (
                        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-sm font-semibold text-amber-900">
                                Your account is set up, but we could not record your agency details.
                            </p>
                            <p className="mt-1 text-sm text-amber-800 leading-relaxed">
                                Nothing is lost on your side — carry on below and use IndSure normally.
                                Message us and we will set your team up by hand.
                            </p>
                            {/* target and rel stay on ONE line: checks/guard.mjs
                                matches them per line, so splitting them reads
                                as an unprotected _blank. */}
                            <a
                                href="https://wa.me/919987148125?text=Hi%2C%20I%20signed%20up%20as%20an%20agency%20but%20my%20agency%20details%20were%20not%20saved."
                                target="_blank" rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center min-h-[44px] px-4 rounded-full bg-amber-600 text-white text-sm font-semibold"
                            >
                                Message us on WhatsApp
                            </a>
                        </div>
                    )}

                    {/* Progress Indicator */}
                    <div className="flex items-center gap-3 mb-10">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 text-xs flex items-center justify-center font-bold">✓</div>
                            <span className="text-sm text-slate-400">Your Details</span>
                        </div>
                        <div className="w-12 h-px bg-[#0D9488]"></div>
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#0D9488] text-white text-xs flex items-center justify-center font-bold">2</div>
                            <span className="text-sm font-semibold text-slate-900">Empanelment</span>
                        </div>
                    </div>

                    {/* Page Heading */}
                    <div className="mb-8">
                        <h2 className="font-['Playfair_Display'] text-[32px] font-semibold text-slate-900 leading-tight mb-3">
                            Which insurers are you empanelled with?
                        </h2>
                        <p className="text-slate-600 leading-relaxed">
                            Select all that apply. We'll use this to tailor your dashboard and recommendations. You can update this anytime from your profile.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-8">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search insurers (e.g., LIC, HDFC Life, Star Health)"
                                className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] transition-all"
                            />
                        </div>
                    </div>

                    {/* Insurer Grid */}
                    <div className="flex-1 overflow-y-auto mb-6 space-y-8">
                        {hasResults ? (
                            Object.entries(filteredInsurers).map(([category, insurers]) => {
                                if (insurers.length === 0) return null
                                
                                return (
                                    <div key={category}>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                                            {category}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {insurers.map((insurer) => {
                                                const isSelected = selected.includes(insurer)
                                                return (
                                                    <button
                                                        key={insurer}
                                                        onClick={() => toggleInsurer(insurer)}
                                                        className={`
                                                            relative h-16 px-4 rounded-xl border-2 transition-all duration-200
                                                            flex items-center justify-between gap-3
                                                            ${isSelected 
                                                                ? 'border-[#0D9488] bg-[#0D9488]/5' 
                                                                : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                                                            }
                                                        `}
                                                    >
                                                        <span className={`text-sm font-semibold text-left ${isSelected ? 'text-[#0D9488]' : 'text-slate-700'}`}>
                                                            {insurer}
                                                        </span>
                                                        {isSelected && (
                                                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0D9488] flex items-center justify-center">
                                                                <Check className="w-3 h-3 text-white" />
                                                            </div>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-slate-500 mb-4">No insurers found matching "{search}"</p>
                                <button
                                    onClick={() => {
                                        setCustomInsurer(search)
                                        setShowCustomInput(true)
                                        setSearch('')
                                    }}
                                    className="text-sm text-[#0D9488] font-semibold hover:underline"
                                >
                                    + Add "{search}" as custom insurer
                                </button>
                            </div>
                        )}

                        {/* Custom Insurer Entry */}
                        <div>
                            {!showCustomInput ? (
                                <button
                                    onClick={() => setShowCustomInput(true)}
                                    className="w-full h-16 px-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all flex items-center justify-center gap-2 text-slate-600 font-semibold text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add another insurer
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={customInsurer}
                                        onChange={(e) => setCustomInsurer(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                addCustomInsurer()
                                            }
                                            if (e.key === 'Escape') {
                                                setShowCustomInput(false)
                                                setCustomInsurer('')
                                            }
                                        }}
                                        placeholder="Enter insurer name"
                                        autoFocus
                                        className="flex-1 h-12 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] transition-all"
                                    />
                                    <button
                                        onClick={addCustomInsurer}
                                        className="px-4 h-12 bg-[#0D9488] hover:bg-[#0f766e] text-white rounded-xl font-semibold text-sm transition-all"
                                    >
                                        Add
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowCustomInput(false)
                                            setCustomInsurer('')
                                        }}
                                        className="px-4 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selection Summary Footer */}
                    <div className="sticky bottom-0 bg-white pt-6 pb-4 border-t border-slate-200 space-y-4">
                        {/* Selected Count & Chips */}
                        {selected.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 className="w-4 h-4 text-[#0D9488]" />
                                    <span className="text-sm font-semibold text-slate-700">
                                        {selected.length} {selected.length === 1 ? 'insurer' : 'insurers'} selected
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                                    <AnimatePresence>
                                        {selected.map((name) => (
                                            <motion.span
                                                key={name}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0D9488]/10 text-[#0D9488] text-xs font-semibold border border-[#0D9488]/20"
                                            >
                                                {name}
                                                <button 
                                                    onClick={() => removeInsurer(name)} 
                                                    className="hover:bg-[#0D9488]/20 rounded-full p-0.5 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </motion.span>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}

                        {error && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg"
                            >
                                {error}
                            </motion.p>
                        )}

                        {/* Primary CTA */}
                        <button
                            onClick={handleFinish}
                            disabled={loading || selected.length === 0}
                            className="w-full h-12 bg-[#0D9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#0D9488] shadow-sm"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    Setting up dashboard...
                                </span>
                            ) : selected.length > 0 ? (
                                'Continue to Dashboard →'
                            ) : (
                                'Select at least one insurer to continue'
                            )}
                        </button>

                        {/* Skip Link */}
                        <div className="text-center">
                            <button
                                onClick={handleSkip}
                                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                I'll add these later →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN - BRAND PANEL */}
            <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-[#0D9488] to-[#0a7a6f] relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-12 sm:py-16 lg:py-20 text-white">
                    {/* Wordmark */}
                    <div className="mb-12">
                        <h2 className="font-['Playfair_Display'] text-2xl font-semibold">IndSure</h2>
                    </div>

                    {/* Hero Copy */}
                    <h1 className="font-['Playfair_Display'] text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-6">
                        Almost there.
                        <br />
                        Let's personalize your experience.
                    </h1>

                    <p className="text-lg text-white/90 mb-8 leading-relaxed">
                        Adding your empanelled insurers helps IndSure show you:
                    </p>

                    {/* Benefits */}
                    <div className="space-y-4 mb-12">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1">
                                <Check className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="text-white/95 font-semibold mb-1">Recommendations tailored to your insurer mix</div>
                                <div className="text-white/70 text-sm">Get policy suggestions that match your partnerships</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1">
                                <Check className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="text-white/95 font-semibold mb-1">Commission tracking across all insurers in one place</div>
                                <div className="text-white/70 text-sm">Unified view of earnings from all your partnerships</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1">
                                <Check className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="text-white/95 font-semibold mb-1">Auto-filled forms for faster policy submissions</div>
                                <div className="text-white/70 text-sm">Save time with pre-populated insurer-specific fields</div>
                            </div>
                        </div>
                    </div>

                    {/* Stat/Testimonial */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                        <p className="text-white/95 italic mb-2 leading-relaxed">
                            "Advisors who complete empanelment process 3x more policies in their first month."
                        </p>
                        <div className="text-sm text-white/70">
                            — IndSure Platform Analytics, 2026
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
