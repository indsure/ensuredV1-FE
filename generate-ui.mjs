import fs from "fs";
import path from "path";

const BASE_DIR = path.join(process.cwd(), "dashboard/src");

function writeFile(filePath, content) {
    const fullPath = path.join(BASE_DIR, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.trim() + "\n", "utf8");
    console.log("Created: " + filePath);
}

// 1. Providers
writeFile("app/providers.tsx", `
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
`);

// 2. Layouts
writeFile("app/layout.tsx", `
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IndSure Dashboard",
  description: "Agent Portal for IndSure",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
`);

writeFile("components/AppShell.tsx", `
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, INbox, FileText, FileSearch, AlertCircle, Users, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", role: ["admin", "manager"], icon: LayoutDashboard },
  { href: "/my-queue", label: "My Queue", role: ["admin", "manager", "agent"], icon: INbox },
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
          {navItems.filter(i => i.role.includes(role)).map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary", pathname === item.href && "bg-muted text-primary")}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col pl-64">
        <header className="fixed right-0 top-0 left-0 z-50 flex h-16 items-center border-b bg-background px-6">
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
`);

// 3. Pages
writeFile("app/(auth)/login/page.tsx", `
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50">
      <div className="w-full max-w-sm rounded-lg border bg-background p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold">Sign In to IndSure</h1>
        <form className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input className="mt-1 w-full rounded-md border p-2" type="email" placeholder="agent@indsure.com" />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input className="mt-1 w-full rounded-md border p-2" type="password" />
          </div>
          <button className="w-full rounded-md bg-primary p-2 text-primary-foreground">Sign In</button>
        </form>
      </div>
    </div>
  );
}
`);

writeFile("app/dashboard/page.tsx", `
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <AppShell role="admin">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader><CardTitle>Total Policies</CardTitle></CardHeader><CardContent className="text-2xl font-bold">1,204</CardContent></Card></Card>
          <Card><CardHeader><CardTitle>Active Agents</CardTitle></CardHeader><CardContent className="text-2xl font-bold">24</CardContent></Card></Card>
          <Card><CardHeader><CardTitle>Pending Queue</CardTitle></CardHeader><CardContent className="text-2xl font-bold">56</CardContent></Card></Card>
          <Card><CardHeader><CardTitle>Success Rate</CardTitle></CardHeader><CardContent className="text-2xl font-bold">98.2%</CardContent></Card></Card>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Recent Failures</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="pb-2">Policy</th><th className="pb-2">Error</th><th className="pb-2">Actions</th></tr></thead>
                <tbody>
                  <tr className="border-b"><td className="py-2">POL-001</td><td className="text-destructive">OCR Failed</td><td><button className="text-primary hover:underline">Retry</button></td></tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>High Risk Items</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="pb-2">ID</th><th className="pb-2">Score</th><th className="pb-2">Actions</th></tr></thead>
                <tbody>
                  <tr className="border-b"><td className="py-2">POL-002</td><td className="text-orange-500">42/100</td><td><button className="text-primary hover:underline">View</button></td></tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
`);

writeFile("app/my-queue/page.tsx", `
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MyQueuePage() {
  return (
    <AppShell role="agent">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Queue</h1>
          <div className="flex gap-2">
            <Badge variant="outline">All</Badge>
            <Badge variant="secondary">High Priority</Badge>
            <Badge variant="secondary">Needs Review</Badge>
          </div>
        </div>
        
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left"><th className="p-4">Policy #</th><th className="p-4">Client</th><th className="p-4">Status</th><th className="p-4">Added</th><th className="p-4">Actions</th></tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-4 font-medium">LIC-MYS-892</td>
                <td className="p-4">John Doe</td>
                <td className="p-4"><Badge>Queued</Badge></td>
                <td className="p-4">2 hrs ago</td>
                <td className="p-4"><button className="text-primary hover:underline">Review</button></td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
`);

writeFile("app/policies/page.tsx", `
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PoliciesPage() {
  return (
    <AppShell role="admin">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Policies</h1>
          <Button>+ Add Policy</Button>
        </div>
        <div className="flex gap-6">
          <div className="w-64 space-y-4 border-r pr-6">
            <h3 className="font-semibold">Filters</h3>
            <input type="text" placeholder="Insurer..." className="w-full rounded border p-2 text-sm" />
            <select className="w-full rounded border p-2 text-sm"><option>All Statuses</option></select>
          </div>
          <div className="flex-1">
            <Card className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left"><th className="p-4">ID</th><th className="p-4">Insurer</th><th className="p-4">Assigned</th><th className="p-4">Status</th></tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="p-4">P-1234</td><td className="p-4">Tata AIG</td><td className="p-4">Agent A</td><td className="p-4">Processing</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
`);

writeFile("app/policies/[id]/page.tsx", `
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PolicyDetailPage() {
  return (
    <AppShell role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">POL-8832</h1>
            <p className="text-muted-foreground">Client: Acme Corp | Insurer: HDFC Ergo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Edit</Button>
            <Button variant="secondary">Re-run</Button>
            <Button variant="outline">Assign</Button>
            <Button>Share</Button>
          </div>
        </div>
        
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6 border rounded-lg p-6 bg-card text-card-foreground">
            <h3 className="font-semibold mb-4">Metadata</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-muted-foreground">Product:</span> Health Suraksha</div>
              <div><span className="text-muted-foreground">Status:</span> Done</div>
            </div>
          </TabsContent>
          <TabsContent value="report">Report view goes here...</TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
`);

writeFile("app/reports/page.tsx", `
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
export default function ReportsPage() {
  return (
    <AppShell role="admin">
      <h1 className="text-3xl font-bold mb-6">Reports</h1>
      <Card>
        <div className="p-6">Reports Table Placeholder</div>
      </Card>
    </AppShell>
  );
}
`);

writeFile("app/reports/[id]/page.tsx", `
export default function ReportDetailPage() {
  return <div>Report Details</div>; 
}
`);

writeFile("app/errors/page.tsx", `
import { AppShell } from "@/components/AppShell";
export default function ErrorsPage() {
  return (
    <AppShell role="admin">
      <h1 className="text-3xl font-bold mb-6">System Errors</h1>
    </AppShell>
  );
}
`);

writeFile("app/agents/page.tsx", `
import { AppShell } from "@/components/AppShell";
export default function AgentsPage() {
  return (
    <AppShell role="admin">
      <h1 className="text-3xl font-bold mb-6">Agent Management</h1>
    </AppShell>
  );
}
`);

writeFile("app/agents/[id]/page.tsx", `
export default function AgentProfile() { return <div>Agent Profile</div>; }
`);

writeFile("app/settings/page.tsx", `
import { AppShell } from "@/components/AppShell";
export default function SettingsPage() {
  return (
    <AppShell role="admin">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
    </AppShell>
  );
}
`);

writeFile("app/r/[token]/page.tsx", `
export default function PublicSharePage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl bg-white p-8 shadow-lg rounded-xl">
        <h1 className="text-3xl font-bold border-b pb-4 mb-6">IndSure Policy Report</h1>
        <div className="prose">Public report rendering here...</div>
      </div>
    </div>
  );
}
`);

console.log("UI Components and Pages completely generated!");
