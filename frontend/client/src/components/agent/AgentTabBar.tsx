import { Link, useLocation } from "wouter"
import { Home, FileText, Users, ShieldCheck, MoreHorizontal } from "lucide-react"
import { useLanguage } from "@/i18n/LanguageContext"

/**
 * Bottom tab navigation for the agent portal on phones.
 *
 * The portal's nav lives in an off-canvas drawer, which costs two taps to reach
 * any screen and hides where you are. On a phone the four screens an agent
 * actually cycles through get a permanent bar instead; everything else stays one
 * tap away behind "More", which opens the same drawer.
 *
 * Rendered only under `md` — the desktop sidebar is unchanged.
 */
export function AgentTabBar({ onMore }: { onMore: () => void }) {
  const [location] = useLocation()
  const { t } = useLanguage()

  const tabs = [
    { href: "/agent/dashboard", label: t("layout.overview") ?? "Home", icon: Home },
    { href: "/agent/policies", label: t("layout.my_policies") ?? "Policies", icon: FileText },
    { href: "/agent/customers", label: t("layout.customers") ?? "Customers", icon: Users },
    { href: "/agent/claims", label: t("layout.claims") ?? "Claims", icon: ShieldCheck },
  ]

  const isActive = (href: string) => location === href || location.startsWith(href + "/")

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="Agent navigation"
    >
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const active = isActive(tab.href)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 min-h-[58px] flex-col items-center justify-center gap-1 pt-2 transition-colors ${
                active ? "text-[#0D9488]" : "text-slate-400"
              }`}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
              <span className="text-[11px] font-bold leading-none">{tab.label}</span>
            </Link>
          )
        })}

        <button
          type="button"
          onClick={onMore}
          aria-label="More"
          className="flex flex-1 min-h-[58px] flex-col items-center justify-center gap-1 pt-2 text-slate-400 transition-colors"
        >
          <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={2} />
          <span className="text-[11px] font-bold leading-none">{t("layout.more") ?? "More"}</span>
        </button>
      </div>
    </nav>
  )
}
