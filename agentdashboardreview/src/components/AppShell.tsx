"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, FileSearch, FileText, Inbox, LayoutDashboard, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", role: ["admin", "manager"], icon: LayoutDashboard },
  { href: "/my-queue", label: "My Queue", role: ["admin", "manager", "agent"], icon: Inbox },
  { href: "/policies", label: "Policies", role: ["admin", "manager", "agent"], icon: FileText },
  { href: "/reports", label: "Reports", role: ["admin", "manager", "agent"], icon: FileSearch },
  { href: "/errors", label: "Errors", role: ["admin", "manager"], icon: AlertCircle },
  { href: "/agents", label: "Agents", role: ["admin", "manager"], icon: Users },
  { href: "/settings", label: "Settings", role: ["admin"], icon: Settings },
];

export function AppShell({ children, role = "admin" }: { children: React.ReactNode; role?: string }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background pt-16">
        <nav className="flex flex-col gap-2 p-4">
          {navItems.filter((item) => item.role.includes(role)).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                  pathname === item.href && "bg-muted text-primary"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col pl-64">
        <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center border-b bg-background px-6">
          <div className="flex w-64 items-center gap-2 font-semibold">IndSure Portal</div>
          <div className="flex flex-1 items-center justify-between pl-6">
            <input type="text" placeholder="Global Search..." className="w-96 rounded-md border px-3 py-1.5 text-sm" />
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-primary/20" />
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 pt-24">{children}</main>
      </div>
    </div>
  );
}
