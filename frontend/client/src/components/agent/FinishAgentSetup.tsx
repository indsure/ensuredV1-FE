import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { MessageCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { agentSignupFromMetadata } from '@/lib/agentAccount'
import { teamWaLink } from '@/components/app/portfolio-utils'
import { useLanguage } from '@/i18n/LanguageContext'

/**
 * Finish an advisor account whose login exists but whose profile never saved.
 *
 * SignupStep1 creates the Supabase login first and the agents row second, so a
 * failed POST /api/agent/create-profile (backend down, a 500, the invite code
 * refused, a dropped connection) leaves a login with no advisor profile. Signing
 * in used to call that "a client account" and sign them out, forever.
 *
 * This calls the same create-profile route, now signed in: with a Bearer token
 * the server checks the token matches the id and takes the email from the auth
 * user, and ON CONFLICT DO NOTHING makes a second try (or a second tab) safe.
 * Signup is open, so no code is asked for; a code saved from the original
 * signup (a team link) is still sent and spent if it is still valid.
 *
 * No link to the personal portal here, deliberately: /app runs bootstrap, which
 * would turn this login into a personal account and lock it out of the advisor
 * portal for good.
 */
export default function FinishAgentSetup({
    user,
    onDone,
    onUseAnother,
}: {
    user: User
    onDone: (path: string) => void
    onUseAnother: () => void
}) {
    const { t } = useLanguage()
    const saved = agentSignupFromMetadata(user.user_metadata)

    const [fullName, setFullName] = useState(saved.full_name ?? '')
    const [phone, setPhone] = useState(saved.phone ?? '')
    const [city, setCity] = useState(saved.city ?? '')
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [marketingConsent, setMarketingConsent] = useState(saved.marketing_consent === true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const helpHref = teamWaLink('Hi, I need help finishing my IndSure advisor account.')
    const phoneDigits = phone.replace(/\D/g, '').slice(-10)
    const phoneValid = /^[6-9]\d{9}$/.test(phoneDigits)

    const stillNeeded: string[] = []
    if (!fullName.trim()) stillNeeded.push(t('signup.need_name'))
    if (!phone.trim()) stillNeeded.push(t('signup.need_mobile'))
    else if (!phoneValid) stillNeeded.push(t('signup.need_valid_mobile'))
    if (!city.trim()) stillNeeded.push(t('signup.need_city'))
    if (!termsAccepted) stillNeeded.push(t('signup.need_terms'))

    const inputClass = 'w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] focus:bg-white transition-all'

    // A login with no email (phone-only) cannot pass create-profile, which needs
    // one. Say so and hand them to a person rather than show a form that fails.
    if (!user.email) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t('finish_setup.title')}</h1>
                <p className="text-base text-slate-600">{t('finish_setup.no_email')}</p>
                <a href={helpHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-[#0D9488] hover:underline">
                    <MessageCircle className="w-5 h-5" />{t('finish_setup.help')}
                </a>
                <button type="button" onClick={onUseAnother} className="block min-h-11 text-base font-semibold text-slate-600 hover:text-slate-900">
                    {t('finish_setup.use_another')}
                </button>
            </div>
        )
    }

    async function finish(e: React.FormEvent) {
        e.preventDefault()
        if (stillNeeded.length > 0 || saving) return
        setSaving(true)
        setError('')
        try {
            const accountType = saved.account_type === 'agency' ? 'agency' : 'individual'
            const res = await apiFetch('/api/agent/create-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.id,
                    email: user.email,
                    full_name: fullName.trim(),
                    phone: phoneDigits,
                    city: city.trim(),
                    experience_years: 0,
                    invite_code: (saved.invite_code ?? '').trim().toUpperCase() || null,
                    marketing_consent: marketingConsent,
                    account_type: accountType,
                    agency_name: accountType === 'agency' ? saved.agency_name ?? null : null,
                    seats_wanted: accountType === 'agency' ? saved.seats_wanted ?? null : null,
                }),
            })
            const isJson = (res.headers.get('content-type') || '').includes('application/json')
            const body: any = isJson ? await res.json().catch(() => null) : null
            if (!res.ok) {
                // Non-JSON means the request never reached the backend (the SPA
                // host answered instead), the same case SignupStep1 reports.
                if (res.status === 429) setError(t('signup.rate_limited'))
                else if (!isJson) setError(t('signup.server_unreachable'))
                else if (res.status === 409 && body?.error === 'PERSONAL_ACCOUNT') setError(t('signup.email_personal'))
                else if (res.status === 403) setError(t('finish_setup.mismatch'))
                else setError(t('finish_setup.save_failed'))
                setSaving(false)
                return
            }
            // Same honesty rule as SignupStep1: an agency answer is only "recorded"
            // if the server says it stored it.
            const agencyUnconfirmed = accountType === 'agency' && body?.enterpriseCaptured !== true
            onDone(`/agent/signup/empanelment${agencyUnconfirmed ? '?agency=unconfirmed' : ''}`)
        } catch {
            setError(t('signup.generic_error'))
            setSaving(false)
        }
    }

    return (
        <form onSubmit={finish} className="space-y-6" noValidate>
            <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 font-['Playfair_Display']">{t('finish_setup.title')}</h1>
                <p className="text-base text-slate-600 leading-relaxed">{t('finish_setup.body')}</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label htmlFor="finish-email" className="text-sm font-semibold text-slate-700 ml-1">{t('finish_setup.email_label')}</label>
                    <input id="finish-email" type="email" value={user.email} readOnly className={`${inputClass} text-slate-500 cursor-not-allowed`} />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="finish-name" className="text-sm font-semibold text-slate-700 ml-1">{t('signup.full_name')}</label>
                    <input id="finish-name" type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label htmlFor="finish-phone" className="text-sm font-semibold text-slate-700 ml-1">{t('signup.phone')}</label>
                        <input id="finish-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} ${phone && !phoneValid ? 'border-red-500' : ''}`} />
                        {phone && !phoneValid && <p className="text-sm text-red-600 ml-1">{t('signup.phone_invalid')}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="finish-city" className="text-sm font-semibold text-slate-700 ml-1">{t('signup.city')}</label>
                        <input id="finish-city" type="text" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
                    </div>
                </div>

                <label className="flex items-start gap-3 min-h-11 cursor-pointer">
                    <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 w-5 h-5 rounded border-slate-300 accent-[#0D9488]" />
                    <span className="text-sm text-slate-700">
                        {t('signup.agree_1')} <a href="/terms" className="text-[#0D9488] underline">{t('signup.terms')}</a> {t('signup.and')} <a href="/privacy-policy" className="text-[#0D9488] underline">{t('signup.privacy')}</a> {t('signup.agree_2')}
                    </span>
                </label>
                <label className="flex items-start gap-3 min-h-11 cursor-pointer">
                    <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} className="mt-1 w-5 h-5 rounded border-slate-300 accent-[#0D9488]" />
                    <span className="text-sm text-slate-700">{t('signup.marketing')}</span>
                </label>
            </div>

            {error && (
                <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-sm font-medium">{error}</div>
            )}

            <div className="space-y-3">
                <button
                    type="submit"
                    disabled={saving || stillNeeded.length > 0}
                    className="w-full h-12 bg-[#0D9488] hover:bg-[#0f766e] text-white rounded-xl text-base font-bold shadow-lg shadow-[#0D9488]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? t('finish_setup.saving') : t('finish_setup.submit')}
                </button>
                {!saving && stillNeeded.length > 0 && (
                    <p className="text-sm text-slate-700" aria-live="polite">{t('signup.still_needed', { items: stillNeeded.join(', ') })}</p>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <a href={helpHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#0D9488] hover:underline">
                    <MessageCircle className="w-4 h-4" />{t('finish_setup.help')}
                </a>
                <button type="button" onClick={onUseAnother} className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600 hover:text-slate-900">
                    {t('finish_setup.use_another')}
                </button>
            </div>
        </form>
    )
}
