"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, Bug, Activity, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agent Management", icon: Users },
  { href: "/settings", label: "System Settings", icon: Settings },
  { href: "/debug", label: "Debug Pipeline", icon: Bug },
  { href: "/api-logs", label: "API Logs", icon: Activity },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-slate-900 text-slate-300">
        <div className="flex h-16 items-center border-b border-slate-800 px-6 font-bold text-white">IndSure Admin HQ</div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-800 hover:text-white", active && "bg-blue-600 text-white hover:bg-blue-700")}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col pl-64">
        <header className="flex h-16 items-center justify-end border-b bg-white px-6">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium">team@indsure.com</div>
            <div className="h-8 w-8 rounded-full bg-slate-200" />
          </div>
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
