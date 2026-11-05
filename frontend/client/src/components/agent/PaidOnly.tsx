import { useEffect } from 'react'
import { Link } from 'wouter'
import { Lock, MessageCircle } from 'lucide-react'
import { useAgent } from '@/context/AgentContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { teamWaLink } from '@/components/app/portfolio-utils'
import { setLimitedFree } from '@/lib/entitlement'

/**
 * The limited Free plan in the portal (founder, 2026-11-02): Free = 3 health policy checks +
 * 20 policy scans; everything else is paid. Advisors from before the change are not limited
 * (AgentContext.limitedFree). The server refuses the paid routes on its own; these components
 * only decide what the portal shows.
 */

/** Keeps lib/entitlement in step with the loaded profile. Mounted once, inside AgentLayout. */
export function EntitlementSync() {
    const { agent } = useAgent()
    const { t } = useLanguage()
    useEffect(() => {
        setLimitedFree(!!agent?.limitedFree, t('paywall.readonly_error'))
    }, [agent?.limitedFree, t])
    return null
}

/** The screen a limited advisor sees instead of a paid feature. */
export function UpgradeScreen({ feature }: { feature: string }) {
    const { t } = useLanguage()
    return (
        <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
            <div className="mx-auto w-14 h-14 rounded-full bg-[#0D9488]/10 flex items-center justify-center">
                <Lock className="w-6 h-6 text-[#0D9488]" />
            </div>
            <div className="space-y-3">
                <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t('paywall.title')}</h1>
                <p className="text-base text-slate-600 leading-relaxed">{t('paywall.body', { feature })}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/agent/plan" className="inline-flex min-h-12 items-center justify-center px-6 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white text-base font-bold">
                    {t('paywall.see_plans')}
                </Link>
                <a
                    href={teamWaLink('Hi, I would like to move my IndSure account to the paid plan.')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 px-6 rounded-xl border border-slate-200 text-slate-700 text-base font-semibold hover:bg-slate-50"
                >
                    <MessageCircle className="w-5 h-5" />{t('paywall.whatsapp')}
                </a>
            </div>
        </div>
    )
}

/** Route wrapper: the feature for paid (and grandfathered) advisors, the upgrade screen for limited ones. */
export function PaidOnly({ featureKey, children }: { featureKey: string; children: React.ReactNode }) {
    const { agent, loading } = useAgent()
    const { t } = useLanguage()
    if (loading && !agent) {
        return (
            <div className="min-h-[40vh] flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin" />
            </div>
        )
    }
    if (agent?.limitedFree) return <UpgradeScreen feature={t(featureKey)} />
    return <>{children}</>
}

/** Top of the dashboard for a limited advisor: what is left, and what paid adds. */
export function FreePlanBanner() {
    const { agent, creditsRemaining, ocrRemaining } = useAgent()
    const { t } = useLanguage()
    if (!agent?.limitedFree) return null
    return (
        <div className="rounded-xl border border-[#0D9488]/30 bg-[#0D9488]/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-slate-900">{t('paywall.free_banner_title')}</p>
                <p className="text-sm text-slate-700">{t('paywall.free_banner_body', { checks: creditsRemaining, scans: ocrRemaining })}</p>
            </div>
            <Link href="/agent/plan" className="inline-flex min-h-11 items-center justify-center px-5 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white text-sm font-bold shrink-0">
                {t('paywall.upgrade')}
            </Link>
        </div>
    )
}

/** Customers, Leads and Renewals for a limited advisor: readable, not changeable. */
export function CrmReadOnly({ children }: { children: React.ReactNode }) {
    const { agent } = useAgent()
    const { t } = useLanguage()
    if (!agent?.limitedFree) return <>{children}</>
    return (
        <>
            <div className="mx-4 sm:mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-amber-900">{t('paywall.readonly_title')}</p>
                    <p className="text-sm text-amber-900/90">{t('paywall.readonly_body')}</p>
                </div>
                <Link href="/agent/plan" className="inline-flex min-h-11 items-center justify-center px-5 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white text-sm font-bold shrink-0">
                    {t('paywall.upgrade')}
                </Link>
            </div>
            {children}
        </>
    )
}
