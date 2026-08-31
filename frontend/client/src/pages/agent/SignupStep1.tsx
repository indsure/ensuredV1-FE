import { useEffect, useState } from 'react'
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
    
    // Load saved form data from sessionStorage on mount
    const getSavedFormData = () => {
        try {
            const saved = sessionStorage.getItem('indsure_signup_draft')
            if (saved) {
                // Merge over the defaults rather than returning the draft as-is:
                // a draft saved before the Individual/Agency question existed has
                // no accountType, and an undefined value there would render the
                // choice with neither option selected and no way to submit.
                //
                // password is forced back to empty: drafts written before it was
                // excluded still have one, and restoring it would put the value
                // back into storage on the next keystroke.
                return { ...emptyForm(), ...JSON.parse(saved), password: '' }
            }
        } catch (e) {
            console.error('Failed to load saved form data:', e)
        }
        return emptyForm()
    }

    function emptyForm() {
        return {
            inviteCode: '',
            fullName: '',
            email: '',
            phone: '',
            city: '',
            password: '',
            // 'individual' = a solo advisor, which is what everyone signing up
            // has been until now, so it stays the default. 'agency' opens the
            // two fields below and records a request for a team.
            accountType: 'individual',
            agencyName: '',
            seatsWanted: '',
        }
    }

    const [form, setForm] = useState(getSavedFormData())

    // Arriving from a team invite (/agent/join/<token> → "Create my account").
    // The invite already knows the address it is bound to and carries its own
    // single-use signup code, so both are filled in rather than asked for — a
    // typo in either is a dead end the person cannot diagnose.
    //
    // Read once, on mount, and only into EMPTY fields: a saved draft is the
    // person's own half-finished work and must win over a URL.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const email = params.get('email')
        const code = params.get('code')
        if (!email && !code) return
        setForm((prev: typeof form) => ({
            ...prev,
            email: prev.email || email || '',
            inviteCode: prev.inviteCode || (code ? code.toUpperCase() : ''),
        }))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [inviteCodeStatus, setInviteCodeStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'expired'>('idle')
    const [inviteCodeError, setInviteCodeError] = useState('')
    
    // Load saved checkbox states
    const getSavedCheckboxes = () => {
        try {
            const saved = sessionStorage.getItem('indsure_signup_checkboxes')
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

    // Save form data to sessionStorage whenever it changes
    const update = (field: string, value: string) => {
        if (field === 'inviteCode') {
            value = value.toUpperCase().trim()
        }
        if (field === 'city') {
            setCitySearch(value)
        }
        const newForm = { ...form, [field]: value }
        setForm(newForm)

        // guard-ok(pii-in-storage): the draft keeps a half-finished signup alive
        // across a refresh, which is worth the trade for the person's OWN
        // contact details in a tab-scoped store that dies when the tab closes.
        // It is cleared on successful signup below.
        //
        // The PASSWORD is excluded, deliberately and non-negotiably. It used to
        // be written here with everything else: `form` carries a password field,
        // and this saved the whole object, so every keystroke put a plaintext
        // password into web storage where any script on the page could read it.
        // Nothing about draft recovery needs it, and a password is not the kind
        // of thing a convenience feature gets to persist.
        try {
            const { password: _password, ...draft } = newForm
            sessionStorage.setItem('indsure_signup_draft', JSON.stringify(draft))
        } catch (e) {
            console.error('Failed to save form data:', e)
        }
    }

    // Save checkbox states to sessionStorage
    const updateTermsAccepted = (checked: boolean) => {
        setTermsAccepted(checked)
        try {
            const checkboxes = { termsAccepted: checked, marketingConsent }
            sessionStorage.setItem('indsure_signup_checkboxes', JSON.stringify(checkboxes))
        } catch (e) {
            console.error('Failed to save checkbox state:', e)
        }
    }

    const updateMarketingConsent = (checked: boolean) => {
        setMarketingConsent(checked)
        try {
            const checkboxes = { termsAccepted, marketingConsent: checked }
            sessionStorage.setItem('indsure_signup_checkboxes', JSON.stringify(checkboxes))
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
            options: {
                // Same reasoning as the consumer signup: without this the
                // confirmation link falls back to the project's single global
                // Site URL, so an agent signing up on indsure.in was sent to
                // beta. Derive it from where they actually are.
                emailRedirectTo: `${window.location.origin}/agent/login`,
            },
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
                // Agency answers ride along with the profile rather than a
                // second call: this endpoint already works without a session
                // (the email-confirmation path), so there is exactly one moment
                // that can fail instead of two. The backend records the ask; it
                // does NOT create a team.
                account_type: form.accountType,
                agency_name: form.accountType === 'agency' ? form.agencyName.trim() : null,
                seats_wanted: form.accountType === 'agency' && form.seatsWanted
                    ? Number(form.seatsWanted)
                    : null,
            }),
        })

        // Read the body once, up front: it carries the enterprise-capture
        // acknowledgement on success and the error message on failure.
        let profileBody: any = null
        try {
            if ((profileRes.headers.get('content-type') || '').includes('application/json')) {
                profileBody = await profileRes.json()
            }
        } catch {}

        if (!profileRes.ok) {
            let errMsg = 'Failed to create profile. Please try again.'
            const contentType = profileRes.headers.get('content-type') || ''
            if (contentType.includes('application/json')) {
                // Read from the body parsed above — a Response can only be
                // consumed once, and re-reading it here would throw and lose
                // the server's actual message.
                errMsg = profileBody?.error || errMsg
            } else {
                // Non-JSON response (e.g. the SPA host returned HTML/405 because
                // the API base is misconfigured) — the request never reached the
                // backend. Surface a clear message instead of a confusing generic one.
                errMsg = 'We could not reach the server. Please try again or contact support on WhatsApp.'
                console.error('create-profile got non-JSON response', profileRes.status, contentType)
            }
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
            sessionStorage.removeItem('indsure_signup_draft')
            sessionStorage.removeItem('indsure_signup_checkboxes')
        } catch (e) {
            console.error('Failed to clear saved data:', e)
        }
        
        // The agency answer is only real if the server says it stored it. It
        // can legitimately fail — an older backend that does not know the field
        // yet, or the insert erroring — and in that case the form has already
        // promised "we set the team up for you". Carry the truth forward rather
        // than let that promise stand unearned.
        //
        // In the URL, not storage: it is a one-hop hint, and rules.md keeps
        // signup data out of web storage.
        let agencyUnconfirmed = false
        if (form.accountType === 'agency') {
            try {
                agencyUnconfirmed = profileBody?.enterpriseCaptured !== true
            } catch {
                agencyUnconfirmed = true
            }
        }

        setLocation(`/agent/signup/empanelment${agencyUnconfirmed ? '?agency=unconfirmed' : ''}`)
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
        // An agency that has not named itself would create a request with
        // nothing to act on, so the name is required on that branch only.
        (form.accountType !== 'agency' || form.agencyName.trim() !== '') &&
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
                        {/* Who is signing up.
                            First question on the page because it changes what
                            the rest of it means. Two real radios in a fieldset,
                            not divs with onClick: this has to be reachable by
                            keyboard and announced as one choice with two
                            options. */}
                        <fieldset>
                            <legend className="block text-sm font-semibold text-slate-700 mb-2">
                                Are you signing up on your own, or for an agency? <span className="text-red-500">*</span>
                            </legend>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {([
                                    {
                                        value: 'individual',
                                        title: 'Individual advisor',
                                        blurb: 'Just you. Your own leads, customers and policy checks.',
                                    },
                                    {
                                        value: 'agency',
                                        title: 'Agency / Enterprise',
                                        blurb: 'Advisors work under you, and you can see their book.',
                                    },
                                ] as const).map((opt) => {
                                    const selected = form.accountType === opt.value
                                    return (
                                        <label
                                            key={opt.value}
                                            className={`relative flex gap-3 p-4 rounded-2xl border cursor-pointer transition-all min-h-[44px] ${
                                                selected
                                                    ? 'border-[#0D9488] bg-[#0D9488]/5 ring-2 ring-[#0D9488]/20'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="accountType"
                                                value={opt.value}
                                                checked={selected}
                                                onChange={() => update('accountType', opt.value)}
                                                className="mt-0.5 h-4 w-4 accent-[#0D9488] flex-none"
                                            />
                                            <span className="min-w-0">
                                                <span className="block text-sm font-semibold text-slate-900">{opt.title}</span>
                                                <span className="block mt-0.5 text-sm text-slate-500 leading-relaxed">{opt.blurb}</span>
                                            </span>
                                        </label>
                                    )
                                })}
                            </div>

                            {/* Only the agency branch asks for more. Kept inside
                                the fieldset so it reads as part of the answer,
                                and the copy is careful not to sound like a
                                quote — seats are agreed with us, not chosen here. */}
                            {form.accountType === 'agency' && (
                                <div className="mt-4 space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                    <div>
                                        <label htmlFor="agency-name" className="block text-sm font-semibold text-slate-700 mb-2">
                                            Agency name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="agency-name"
                                            type="text"
                                            value={form.agencyName}
                                            onChange={(e) => update('agencyName', e.target.value)}
                                            placeholder="Shreyas Insurance Services"
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="seats-wanted" className="block text-sm font-semibold text-slate-700 mb-2">
                                            How many advisors, roughly? <span className="font-normal text-slate-500">optional</span>
                                        </label>
                                        <input
                                            id="seats-wanted"
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            value={form.seatsWanted}
                                            onChange={(e) => update('seatsWanted', e.target.value)}
                                            placeholder="6"
                                            className={inputClass}
                                        />
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        Your account is created either way and works straight away. We set the team up
                                        for you and confirm the seats before anything is charged — the Agency plan
                                        starts at five seats.
                                    </p>
                                </div>
                            )}
                        </fieldset>

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
                                    I agree to the <a href="/terms" className="text-[#0D9488] underline hover:text-[#0f766e]">Terms of Service</a> and <a href="/privacy-policy" className="text-[#0D9488] underline hover:text-[#0f766e]">Privacy Policy</a> <span className="text-red-500">*</span>
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
                <div className="relative z-10 flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-12 sm:py-16 lg:py-20 text-white">
                    {/* Wordmark */}
                    <div className="mb-12">
                        <h2 className="font-['Playfair_Display'] text-2xl font-semibold">IndSure</h2>
                    </div>

                    {/* Hero Copy */}
                    <h1 className="font-['Playfair_Display'] text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-6">
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
