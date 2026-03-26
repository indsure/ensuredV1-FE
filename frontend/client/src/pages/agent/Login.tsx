import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'

export default function AgentLogin() {
    const [, navigate] = useLocation()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [msg, setMsg] = useState('')
    const [loading, setLoading] = useState(false)
    const [isResetMode, setIsResetMode] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setMsg('')

        if (isResetMode) {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/agent/reset-password`
            })
            if (error) {
                setError(error.message)
            } else {
                setMsg('A reset link has been sent to your email.')
            }
            setLoading(false)
            return
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setError('Invalid email or password. Please try again.')
            setLoading(false)
            return
        }

        navigate('/agent/dashboard')
    }

    return (
        <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <h1 className="font-['Playfair_Display'] text-3xl font-semibold text-[#0F172A] tracking-tight">
                        IndSure
                    </h1>
                    <p className="text-[#64748B] text-sm mt-1">Agent Portal</p>
                </div>

                <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-[#E2E8F0] p-8 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                    <h2 className="font-['Playfair_Display'] text-2xl font-semibold text-[#0F172A] mb-1">
                        {isResetMode ? 'Reset password' : 'Welcome back'}
                    </h2>
                    <p className="text-[#64748B] text-sm mb-6">
                        {isResetMode ? 'Enter your email to receive a recovery link' : 'Sign in to your advisor dashboard'}
                    </p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#334155] mb-1.5">
                                Email address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                className="w-full h-11 px-4 rounded-xl border border-[#E2E8F0] bg-transparent text-[#0F172A] placeholder-[#94A3B8] text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] transition-all"
                            />
                        </div>

                        {!isResetMode && (
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-sm font-medium text-[#334155]">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsResetMode(true)}
                                        className="text-xs font-semibold text-[#0D9488] hover:underline"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="w-full h-11 px-4 rounded-xl border border-[#E2E8F0] bg-transparent text-[#0F172A] placeholder-[#94A3B8] text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] transition-all"
                                />
                            </div>
                        )}

                        {error && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-sm text-[#ef4444] bg-red-50 px-4 py-2.5 rounded-lg"
                            >
                                {error}
                            </motion.p>
                        )}

                        {msg && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-sm text-green-700 bg-green-50 px-4 py-2.5 rounded-lg border border-green-200"
                            >
                                {msg}
                            </motion.p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-[#0D9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-xl shadow-lg shadow-teal-900/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    {isResetMode ? 'Sending...' : 'Signing in...'}
                                </span>
                            ) : isResetMode ? 'Send Reset Link' : 'Sign In'}
                        </button>
                    </form>

                    {isResetMode ? (
                        <p className="text-center text-sm text-[#64748B] mt-6">
                            Remember your password?{' '}
                            <button onClick={() => setIsResetMode(false)} className="text-[#0D9488] font-medium hover:underline">
                                Sign in
                            </button>
                        </p>
                    ) : (
                        <p className="text-center text-sm text-[#64748B] mt-6">
                            Don't have an account?{' '}
                            <Link to="/agent/signup" className="text-[#0D9488] font-medium hover:underline">
                                Request access
                            </Link>
                        </p>
                    )}
                </div>
            </motion.div>
        </div>
    )
}