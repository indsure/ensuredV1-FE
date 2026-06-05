import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api';
import { Eye, EyeOff, CheckCircle2, XCircle, AlertCircle, MessageCircle, Check } from 'lucide-react'

const TOP_INDIAN_CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Pune', 
    'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam',
    'Pimpri-Chinchwad', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad',
    'Meerut', 'Rajkot', 'Kalyan-Dombivali', 'Vasai-Virar', 'Varanasi', 'Srinagar', 'Aurangabad',
    'Dhanbad', 'Amritsar', 'Navi Mumbai', 'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur',
    'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Chandigarh', 'Guwahati',
    'Solapur', 'Hubli-Dharwad', 'Mysore', 'Tiruchirappalli', 'Bareilly', 'Aligarh', 'Tiruppur',
    'Moradabad', 'Jalandhar', 'Bhubaneswar', 'Salem', 'Warangal', 'Mira-Bhayandar', 'Thiruvananthapuram',
    'Bhiwandi', 'Saharanpur', 'Guntur', 'Amravati', 'Bikaner', 'Noida', 'Jamshedpur', 'Bhilai',
    'Cuttack', 'Firozabad', 'Kochi', 'Nellore', 'Bhavnagar', 'Dehradun', 'Durgapur', 'Asansol',
    'Rourkela', 'Nanded', 'Kolhapur', 'Ajmer', 'Akola', 'Gulbarga', 'Jamnagar', 'Ujjain', 'Loni',
    'Siliguri', 'Jhansi', 'Ulhasnagar', 'Jammu', 'Sangli-Miraj', 'Mangalore', 'Erode', 'Belgaum',
    'Ambattur', 'Tirunelveli', 'Malegaon', 'Gaya', 'Jalgaon', 'Udaipur', 'Maheshtala'
];

export default function AgentSignupStep1() {
    const [, setLocation] = useLocation()
    
    // Load saved form data from localStorage on mount
    const getSavedFormData = () => {
        try {
            const saved = localStorage.getItem('indsure_signup_draft')
            if (saved) {
                return JSON.parse(saved)
            }
        } catch (e) {
            console.error('Failed to load saved form data:', e)
        }
        return {
            inviteCode: '',
            fullName: '',
            email: '',
            phone: '',
            city: '',
            password: '',
        }
    }

    const [form, setForm] = useState(getSavedFormData())
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [inviteCodeStatus, setInviteCodeStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'expired'>('idle')
    const [inviteCodeError, setInviteCodeError] = useState('')
    
    // Load saved checkbox states
    const getSavedCheckboxes = () => {
        try {
            const saved = localStorage.getItem('indsure_signup_checkboxes')
            if (saved) {
                return JSON.parse(saved)
            }
        } catch (e) {
            console.error('Failed to load saved checkboxes:', e)
        }
        return { termsAccepted: false, marketingConsent: false }
    }
    
    const savedCheckboxes = getSavedCheckboxes()
    const [termsAccepted, setTermsAccepted] = useState(savedCheckboxes.termsAccepted)
    const [marketingConsent, setMarketingConsent] = useState(savedCheckboxes.marketingConsent)
    const [citySearch, setCitySearch] = useState('')
    const [showCityDropdown, setShowCityDropdown] = useState(false)

    // Save form data to localStorage whenever it changes
    const update = (field: string, value: string) => {
        if (field === 'inviteCode') {
            value = value.toUpperCase().trim()
        }
        if (field === 'city') {
            setCitySearch(value)
        }
        const newForm = { ...form, [field]: value }
        setForm(newForm)
        
        // Save to localStorage
        try {
            localStorage.setItem('indsure_signup_draft', JSON.stringify(newForm))
        } catch (e) {
            console.error('Failed to save form data:', e)
        }
    }

    // Save checkbox states to localStorage
    const updateTermsAccepted = (checked: boolean) => {
        setTermsAccepted(checked)
        try {
            const checkboxes = { termsAccepted: checked, marketingConsent }
            localStorage.setItem('indsure_signup_checkboxes', JSON.stringify(checkboxes))
        } catch (e) {
            console.error('Failed to save checkbox state:', e)
        }
    }

    const updateMarketingConsent = (checked: boolean) => {
        setMarketingConsent(checked)
        try {
            const checkboxes = { termsAccepted, marketingConsent: checked }
            localStorage.setItem('indsure_signup_checkboxes', JSON.stringify(checkboxes))
        } catch (e) {
            console.error('Failed to save checkbox state:', e)
        }
    }

    const passwordChecks = {
        length: form.password.length >= 8,
        uppercase: /[A-Z]/.test(form.password),
        number: /[0-9]/.test(form.password),
    }
    const passwordValid = passwordChecks.length && passwordChecks.uppercase && passwordChecks.number
    const phoneValid = form.phone === '' || /^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ''))

    const validateInviteCode = async () => {
        if (!form.inviteCode) {
            setInviteCodeStatus('idle')
            return
        }

        setInviteCodeStatus('checking')
        setInviteCodeError('')

        const { data: invite, error: inviteError } = await supabase
            .from('invite_codes')
            .select('*')
            .eq('code', form.inviteCode)
            .eq('is_active', true)
            .single()

        if (inviteError || !invite) {
            setInviteCodeStatus('invalid')
            setInviteCodeError('Invite code not found. Check your email/WhatsApp for the correct code.')
            return
        }

        const isMultiUse = invite.max_uses === null || invite.max_uses > (invite.current_uses || 0)
        const isSingleUse = invite.max_uses === null && invite.used_by === null

        if (!isMultiUse && invite.used_by !== null) {
            setInviteCodeStatus('expired')
            setInviteCodeError('This invite code is no longer valid. Contact us for a new one.')
            return
        }

        if (invite.max_uses !== null && invite.current_uses >= invite.max_uses) {
            setInviteCodeStatus('expired')
            setInviteCodeError('This invite code is no longer valid. Contact us for a new one.')
            return
        }

        setInviteCodeStatus('valid')
    }

    const handleNext = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
        const { data: invite, error: inviteError } = await supabase
            .from('invite_codes')
            .select('*')
            .eq('code', form.inviteCode.trim().toUpperCase())
            .eq('is_active', true)
            .single()

        if (inviteError || !invite) {
            setError('Invalid or inactive invite code.')
            setLoading(false)
            return
        }

        const isMultiUse = invite.max_uses === null || invite.max_uses > (invite.current_uses || 0)
        const isSingleUse = invite.max_uses === null && invite.used_by === null

        if (!isMultiUse && invite.used_by !== null) {
            setError('This invite code has already been used.')
            setLoading(false)
            return
        }

        if (invite.max_uses !== null && invite.current_uses >= invite.max_uses) {
            setError('This invite code has reached its usage limit.')
            setLoading(false)
            return
        }

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

        const profileRes = await apiFetch('/api/agent/create-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: userId,
                email: form.email,
                full_name: form.fullName,
                phone: form.phone,
                city: form.city,
                experience_years: 0,
                invite_code: form.inviteCode.trim().toUpperCase(),
                marketing_consent: marketingConsent,
            }),
        })

        if (!profileRes.ok) {
            let errMsg = 'Failed to create profile. Please try again.'
            try {
                const profileErr = await profileRes.json()
                errMsg = profileErr.error || errMsg
            } catch {}
            setError(errMsg)
            setLoading(false)
            return
        }

        if (invite.max_uses === null && invite.used_by === null) {
            await supabase
                .from('invite_codes')
                .update({ used_by: userId, used_at: new Date().toISOString(), is_active: false })
                .eq('code', form.inviteCode.trim().toUpperCase())
        } else {
            await supabase
                .from('invite_codes')
                .update({ 
                    current_uses: (invite.current_uses || 0) + 1,
                    used_at: new Date().toISOString()
                })
                .eq('code', form.inviteCode.trim().toUpperCase())
        }

        setLoading(false)
        
        // Clear saved form data after successful signup
        try {
            localStorage.removeItem('indsure_signup_draft')
            localStorage.removeItem('indsure_signup_checkboxes')
        } catch (e) {
            console.error('Failed to clear saved data:', e)
        }
        
        setLocation('/agent/signup/empanelment')
        } catch (err) {
            console.error('Signup error:', err)
            setError('Something went wrong. Please try again.')
            setLoading(false)
        }
    }

    const filteredCities = TOP_INDIAN_CITIES.filter(city => 
        city.toLowerCase().includes(citySearch.toLowerCase())
    ).slice(0, 10)

    const isFormValid = 
        inviteCodeStatus === 'valid' &&
        form.fullName.trim() !== '' &&
        form.email.trim() !== '' &&
        form.phone.trim() !== '' &&
        phoneValid &&
        form.city.trim() !== '' &&
        passwordValid &&
        termsAccepted

    const inputClass = 'w-full h-11 px-4 rounded-full border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] transition-all'

    return (
        <div className="min-h-screen flex flex-col lg:flex-row">
            {/* LEFT COLUMN - FORM */}
            <div className="w-full lg:w-[45%] bg-white flex flex-col">
                <div className="flex-1 flex flex-col px-6 py-8 lg:px-20 lg:py-12 max-w-xl mx-auto w-full">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="font-['Playfair_Display'] text-[28px] font-semibold text-slate-900 tracking-tight mb-1">
                            IndSure
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">Advisor Portal</p>
                    </div>

                    {/* Progress Indicator */}
                    <div className="flex items-center gap-3 mb-10">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#0D9488] text-white text-xs flex items-center justify-center font-bold">1</div>
                            <span className="text-sm font-semibold text-slate-900">Your Details</span>
                        </div>
                        <div className="w-12 h-px bg-slate-200"></div>
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 text-xs flex items-center justify-center font-bold">2</div>
                            <span className="text-sm text-slate-400">Empanelment</span>
                        </div>
                    </div>

                    {/* Form Heading */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="font-['Playfair_Display'] text-[32px] font-semibold text-slate-900 leading-tight">
                                Create your account
                            </h2>
                            {(form.fullName || form.email || form.phone) && (
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Draft saved
                                </span>
                            )}
                        </div>
                        <p className="text-slate-600">You'll need an invite code to get started</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleNext} className="space-y-6 flex-1">
                        {/* Invite Code */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Invite Code <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={form.inviteCode}
                                    onChange={(e) => update('inviteCode', e.target.value)}
                                    onBlur={validateInviteCode}
                                    required
                                    placeholder="Paste your invite code here"
                                    className={`${inputClass} font-mono tracking-widest uppercase pr-10 ${
                                        inviteCodeStatus === 'valid' ? 'border-green-500 ring-2 ring-green-500/20' : 
                                        inviteCodeStatus === 'invalid' || inviteCodeStatus === 'expired' ? 'border-red-500 ring-2 ring-red-500/20' : ''
                                    }`}
                                />
                                {inviteCodeStatus === 'checking' && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <div className="w-4 h-4 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                                {inviteCodeStatus === 'valid' && (
                                    <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                                )}
                                {(inviteCodeStatus === 'invalid' || inviteCodeStatus === 'expired') && (
                                    <XCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                                )}
                            </div>
                            {inviteCodeError && (
                                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {inviteCodeError}
                                </p>
                            )}
                            <Link href="/agent">
                                <p className="mt-2 text-xs text-[#0D9488] hover:underline cursor-pointer font-medium">
                                    Don't have an invite code? Request access →
                                </p>
                            </Link>
                        </div>

                        {/* Full Name */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input 
                                type="text" 
                                value={form.fullName} 
                                onChange={(e) => update('fullName', e.target.value)} 
                                required 
                                placeholder="Rahul Sharma" 
                                className={inputClass} 
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Email <span className="text-red-500">*</span>
                            </label>
                            <input 
                                type="email" 
                                value={form.email} 
                                onChange={(e) => update('email', e.target.value)} 
                                required 
                                placeholder="rahul@example.com" 
                                className={inputClass} 
                            />
                        </div>

                        {/* Phone & City */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Phone <span className="text-red-500">*</span>
                                </label>
                                <input 
                                    type="tel" 
                                    value={form.phone} 
                                    onChange={(e) => update('phone', e.target.value)} 
                                    required
                                    placeholder="+91 98765 43210" 
                                    className={`${inputClass} ${!phoneValid && form.phone ? 'border-red-500' : ''}`}
                                />
                                {form.phone && !phoneValid && (
                                    <p className="mt-1.5 text-xs text-red-600">Enter valid 10-digit number</p>
                                )}
                            </div>
                            <div className="relative">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    City <span className="text-red-500">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    value={form.city} 
                                    onChange={(e) => {
                                        update('city', e.target.value)
                                        setShowCityDropdown(true)
                                    }}
                                    onFocus={() => setShowCityDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                                    required
                                    placeholder="Mumbai" 
                                    className={inputClass}
                                    autoComplete="off"
                                />
                                {showCityDropdown && filteredCities.length > 0 && form.city && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                        {filteredCities.map((city) => (
                                            <div
                                                key={city}
                                                onClick={() => {
                                                    update('city', city)
                                                    setShowCityDropdown(false)
                                                }}
                                                className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-900"
                                            >
                                                {city}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {(!form.phone || phoneValid) && form.phone && (
                            <p className="text-xs text-slate-500 -mt-3">We'll only contact you for important account updates.</p>
                        )}

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? 'text' : 'password'}
                                    value={form.password} 
                                    onChange={(e) => update('password', e.target.value)} 
                                    required 
                                    placeholder="Min. 8 characters" 
                                    minLength={8} 
                                    className={`${inputClass} pr-10`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {form.password && (
                                <div className="mt-3 space-y-2">
                                    <div className={`text-xs flex items-center gap-2 ${passwordChecks.length ? 'text-green-600' : 'text-slate-400'}`}>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        At least 8 characters
                                    </div>
                                    <div className={`text-xs flex items-center gap-2 ${passwordChecks.uppercase ? 'text-green-600' : 'text-slate-400'}`}>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        One uppercase letter
                                    </div>
                                    <div className={`text-xs flex items-center gap-2 ${passwordChecks.number ? 'text-green-600' : 'text-slate-400'}`}>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        One number
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Terms & Consent */}
                        <div className="space-y-3 pt-2">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={termsAccepted}
                                    onChange={(e) => updateTermsAccepted(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#0D9488] focus:ring-[#0D9488]"
                                    required
                                />
                                <span className="text-sm text-slate-600 group-hover:text-slate-900">
                                    I agree to the <a href="/terms" className="text-[#0D9488] underline hover:text-[#0f766e]">Terms of Service</a> and <a href="/privacy" className="text-[#0D9488] underline hover:text-[#0f766e]">Privacy Policy</a> <span className="text-red-500">*</span>
                                </span>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={marketingConsent}
                                    onChange={(e) => updateMarketingConsent(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#0D9488] focus:ring-[#0D9488]"
                                />
                                <span className="text-sm text-slate-600 group-hover:text-slate-900">
                                    I consent to receive product updates via WhatsApp, SMS, and email
                                </span>
                            </label>
                        </div>

                        {error && (
                            <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !isFormValid}
                            className="w-full h-11 bg-[#0D9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#0D9488] shadow-sm"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    Verifying...
                                </span>
                            ) : 'Continue to Empanelment →'}
                        </button>
                    </form>

                    {/* Footer Links */}
                    <div className="mt-8 text-center space-y-2">
                        <Link to="/agent/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium">
                            Already have an account? <span className="text-[#0D9488]">Sign in</span>
                        </Link>
                        <div>
                            <a 
                                href="https://wa.me/919987148125?text=Hi%2C%20I%20need%20help"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-slate-500 hover:text-[#0D9488] inline-flex items-center gap-1.5"
                            >
                                <MessageCircle className="w-3.5 h-3.5" />
                                Need help? Chat on WhatsApp →
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN - BRAND REINFORCEMENT */}
            <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-[#0D9488] to-[#0a7a6f] relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-16 py-20 text-white">
                    {/* Wordmark */}
                    <div className="mb-12">
                        <h2 className="font-['Playfair_Display'] text-2xl font-semibold">IndSure</h2>
                    </div>

                    {/* Hero Copy */}
                    <h1 className="font-['Playfair_Display'] text-5xl font-bold leading-tight mb-6">
                        Manage 10x more policies.
                        <br />
                        Without 10x the paperwork.
                    </h1>

                    <p className="text-lg text-white/90 mb-12 leading-relaxed">
                        Join 500+ Indian advisors using IndSure to streamline their policy workflow.
                    </p>

                    {/* Trust Points */}
                    <div className="space-y-4 mb-12">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="w-4 h-4" />
                            </div>
                            <span className="text-white/95 font-medium">IRDAI-compliant workflows</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="w-4 h-4" />
                            </div>
                            <span className="text-white/95 font-medium">Trusted across 200+ Indian cities</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="w-4 h-4" />
                            </div>
                            <span className="text-white/95 font-medium">99.9% uptime guarantee</span>
                        </div>
                    </div>

                    {/* Testimonial */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                        <p className="text-white/95 italic mb-4 leading-relaxed">
                            "IndSure helped me close 47 policies last month — double my previous best."
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-semibold">
                                P
                            </div>
                            <div>
                                <div className="font-semibold text-white">Priya Sharma</div>
                                <div className="text-sm text-white/70">Senior Advisor, Pune</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
