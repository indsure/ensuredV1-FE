import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '@/lib/api';

export default function AgentSignupStep1() {
    const [, setLocation] = useLocation()
    const [form, setForm] = useState({
        inviteCode: '',
        fullName: '',
        email: '',
        phone: '',
        city: '',
        experienceYears: '',
        password: '',
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const update = (field: string, value: string) =>
        setForm((prev) => ({ ...prev, [field]: value }))

    const handleNext = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        // Validate invite code
        const { data: invite, error: inviteError } = await supabase
            .from('invite_codes')
            .select('*')
            .eq('code', form.inviteCode.trim().toUpperCase())
            .eq('is_active', true)
            .is('used_by', null)
            .single()

        if (inviteError || !invite) {
            setError('Invalid or already used invite code.')
            setLoading(false)
            return
        }

        // Create Supabase auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: form.email,
            password: form.password,
        })

        if (authError || !authData.user) {
            setError(authError?.message || 'Signup failed. Please try again.')
            setLoading(false)
            return
        }

        const userId = authData.user.id

        // Insert into agents table via backend API (bypasses Supabase RLS)
        const profileRes = await apiFetch('/api/agent/create-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: userId,
                email: form.email,
                full_name: form.fullName,
                phone: form.phone,
                city: form.city,
                experience_years: parseInt(form.experienceYears) || 0,
                invite_code: form.inviteCode.trim().toUpperCase(),
            }),
        })

        if (!profileRes.ok) {
            const profileErr = await profileRes.json();
            setError(profileErr.error || 'Failed to create profile. Please try again.')
            setLoading(false)
            return
        }

        // Mark invite code as used
        await supabase
            .from('invite_codes')
            .update({ used_by: userId, used_at: new Date().toISOString(), is_active: false })
            .eq('code', form.inviteCode.trim().toUpperCase())

        setLoading(false)
        setLocation('/agent/signup/empanelment')
    }

    const inputClass =
        'w-full h-11 px-4 rounded-xl border border-[#E2E8F0] bg-transparent text-[#0F172A] placeholder-[#94A3B8] text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] transition-all'

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
                        <div className="w-6 h-6 rounded-full bg-[#0D9488] text-white text-xs flex items-center justify-center font-semibold">1</div>
                        <span className="text-sm font-medium text-[#0D9488]">Your Details</span>
                    </div>
                    <div className="w-8 h-px bg-[#E2E8F0]" />
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-[#E2E8F0] text-[#94A3B8] text-xs flex items-center justify-center font-semibold">2</div>
                        <span className="text-sm text-[#94A3B8]">Empanelment</span>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-[#E2E8F0] p-8 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                    <h2 className="font-['Playfair_Display'] text-2xl font-semibold text-[#0F172A] mb-1">
                        Create your account
                    </h2>
                    <p className="text-[#64748B] text-sm mb-6">You'll need an invite code to get started</p>

                    <form onSubmit={handleNext} className="space-y-4">
                        {/* Invite Code — first and prominent */}
                        <div>
                            <label className="block text-sm font-medium text-[#334155] mb-1.5">
                                Invite Code <span className="text-[#ef4444]">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.inviteCode}
                                onChange={(e) => update('inviteCode', e.target.value)}
                                required
                                placeholder="e.g. INDSURE2026"
                                className={`${inputClass} font-mono tracking-widest uppercase`}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-[#334155] mb-1.5">Full Name</label>
                                <input type="text" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} required placeholder="Rahul Sharma" className={inputClass} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-[#334155] mb-1.5">Email</label>
                                <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required placeholder="rahul@example.com" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#334155] mb-1.5">Phone</label>
                                <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 98765 43210" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#334155] mb-1.5">City</label>
                                <input type="text" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Mumbai" className={inputClass} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-[#334155] mb-1.5">Years of Experience</label>
                                <input type="number" min="0" max="50" value={form.experienceYears} onChange={(e) => update('experienceYears', e.target.value)} placeholder="5" className={inputClass} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-[#334155] mb-1.5">Password</label>
                                <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required placeholder="Min. 8 characters" minLength={8} className={inputClass} />
                            </div>
                        </div>

                        {error && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-sm text-[#ef4444] bg-red-50 px-4 py-2.5 rounded-lg"
                            >
                                {error}
                            </motion.p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-[#0D9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-xl shadow-lg shadow-teal-900/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    Verifying...
                                </span>
                            ) : 'Continue to Empanelment →'}
                        </button>
                    </form>

                    <p className="text-center text-sm text-[#64748B] mt-6">
                        Already have an account?{' '}
                        <Link to="/agent/login" className="text-[#0D9488] font-medium hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
