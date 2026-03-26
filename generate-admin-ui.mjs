import fs from "fs";
import path from "path";

const BASE_DIR = path.join(process.cwd(), "admin-dashboard/src");

function writeFile(filePath, content) {
    const fullPath = path.join(BASE_DIR, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.trim().replace(/\[@@/g, "\`").replace(/\[\$\$/g, "\${") + "\n", "utf8");
    console.log("Created: " + filePath);
}

// Layout and Providers
writeFile("app/providers.tsx", `
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
`);

writeFile("app/layout.tsx", `
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IndSure Team Admin",
  description: "Internal Admin Dashboard",
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

// Mock primitives
writeFile("components/ui.tsx", `
import * as React from "react"
export const Button = React.forwardRef<HTMLButtonElement, any>(({ className, ...props }, ref) => (
  <button ref={ref} className={"inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 transition-colors hover:bg-slate-900/90 disabled:opacity-50 " + (className || "")} {...props} />
))
Button.displayName = "Button"

export const Card = ({ className, ...props }: any) => <div className={"rounded-xl border bg-white shadow-sm " + (className || "")} {...props} />
export const CardHeader = ({ className, ...props }: any) => <div className={"flex flex-col space-y-1.5 p-6 " + (className || "")} {...props} />
export const CardTitle = ({ className, ...props }: any) => <h3 className={"font-semibold leading-none tracking-tight " + (className || "")} {...props} />
export const CardContent = ({ className, ...props }: any) => <div className={"p-6 pt-0 " + (className || "")} {...props} />

export const Badge = ({ className, ...props }: any) => <div className={"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold " + (className || "")} {...props} />

export const Input = React.forwardRef<HTMLInputElement, any>(({ className, ...props }, ref) => (
  <input ref={ref} className={"flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 " + className} {...props} />
))
Input.displayName = "Input"
`);

writeFile("components/AppShell.tsx", `
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
`);

writeFile("lib/utils.ts", `
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`);

// PAGES
writeFile("app/(auth)/login/page.tsx", `
import { Button } from "@/components/ui";

export default function AdminLogin() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-lg text-center">
        <h1 className="mb-2 text-2xl font-bold">IndSure Team Admin</h1>
        <p className="mb-8 text-sm text-slate-500">Sign in with your Google Workspace account.</p>
        <form>
          <Button className="w-full bg-blue-600 hover:bg-blue-700">Continue with Google</Button>
        </form>
        <p className="mt-6 text-xs text-slate-400">Requires manual approval in Supabase Dashboard.</p>
      </div>
    </div>
  );
}
`);

writeFile("app/dashboard/page.tsx", `
import { AppShell } from "@/components/AppShell";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "@/components/ui";

export default function AdminDashboard() {
  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">System Overview</h1>
        
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium text-slate-500">API Health</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">99.9%</div><p className="text-xs text-slate-400">Uptime (30d)</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium text-slate-500">Active Extraction Jobs</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">14</div><p className="text-xs text-slate-400">In OCR/Gemini Pipeline</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium text-slate-500">Total Tokens Used (Today)</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">4.2M</div><p className="text-xs text-slate-400">Gemini 3.1 Pro</p></CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Recent API Exceptions</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="pb-2">Endpoint</th><th className="pb-2">Status</th><th className="pb-2">Time</th></tr></thead>
                <tbody>
                  <tr className="border-b"><td className="py-3 font-mono">POST /api/analyze</td><td><Badge className="bg-red-100 text-red-700">500</Badge></td><td className="text-slate-500">2 mins ago</td></tr>
                  <tr className="border-b"><td className="py-3 font-mono">GET /api/policies</td><td><Badge className="bg-orange-100 text-orange-700">429</Badge></td><td className="text-slate-500">14 mins ago</td></tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Active Jobs Queue</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="pb-2">Job ID</th><th className="pb-2">Step</th><th className="pb-2">Action</th></tr></thead>
                <tbody>
                  <tr className="border-b"><td className="py-3 font-mono">job-99a1</td><td>Chunking Vectors</td><td><Button className="h-7 text-xs">Kill</Button></td></tr>
                  <tr className="border-b"><td className="py-3 font-mono">job-82b2</td><td>LLM Extraction</td><td><Button className="h-7 text-xs">Kill</Button></td></tr>
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

writeFile("app/agents/page.tsx", `
import { AppShell } from "@/components/AppShell";
import { Card, Button, Badge } from "@/components/ui";

export default function AgentManagement() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <Button>+ Invite Agent</Button>
        </div>
        
        <Card className="p-0 border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 border-b">
              <tr className="text-left"><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4">Success %</th><th className="p-4">Actions</th></tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-4 font-medium">Alice Smith</td><td className="p-4 text-slate-500">alice@indsure.com</td><td className="p-4">Manager</td><td className="p-4"><Badge className="bg-green-100 text-green-700">Active</Badge></td><td className="p-4">98%</td>
                <td className="p-4 gap-2 flex"><Button className="h-7 bg-slate-100 text-slate-700 hover:bg-slate-200">Edit</Button><Button className="h-7 bg-red-50 text-red-600 hover:bg-red-100">Suspend</Button></td>
              </tr>
              <tr className="border-b">
                <td className="p-4 font-medium">Bob Jones</td><td className="p-4 text-slate-500">bob@indsure.com</td><td className="p-4">Agent</td><td className="p-4"><Badge className="bg-slate-100 text-slate-700">Inactive</Badge></td><td className="p-4">84%</td>
                <td className="p-4 gap-2 flex"><Button className="h-7 bg-slate-100 text-slate-700 hover:bg-slate-200">Edit</Button><Button className="h-7 bg-red-50 text-red-600 hover:bg-red-100">Suspend</Button></td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
`);

writeFile("app/settings/page.tsx", `
import { AppShell } from "@/components/AppShell";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/components/ui";

export default function SystemSettings() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-3xl font-bold">System Settings</h1>
        
        <Card>
          <CardHeader><CardTitle>Pipeline Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">LLM Model Runtime</label>
              <select className="mt-1 block w-full rounded-md border p-2 text-sm"><option>gemini-3.1-pro-preview</option><option>gpt-4-turbo</option></select>
            </div>
            <div>
              <label className="text-sm font-medium">Chunk Size (Tokens)</label>
              <Input type="number" defaultValue="4000" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Reporting & Thresholds</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Auto-Approval Score Threshold</label>
              <Input type="number" defaultValue="95" />
              <p className="text-xs text-slate-500 mt-1">Policies scoring above this will bypass the "needs_review" queue.</p>
            </div>
          </CardContent>
        </Card>
        
        <Button className="w-48 bg-blue-600 hover:bg-blue-700">Save Configuration</Button>
      </div>
    </AppShell>
  );
}
`);

writeFile("app/debug/page.tsx", `
import { AppShell } from "@/components/AppShell";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";

export default function DebugPipeline() {
  return (
    <AppShell>
      <div className="space-y-6 h-full flex flex-col">
        <h1 className="text-3xl font-bold">Debug Pipeline</h1>
        
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium block mb-1">Target Policy ID / File Hash</label>
            <input type="text" className="w-full rounded-md border p-2 text-sm" placeholder="Enter UUID or Drag File..." />
          </div>
          <Button className="bg-orange-600 hover:bg-orange-700 shrink-0">Trigger Manual Extraction</Button>
        </div>

        <Card className="flex-1 min-h-[500px] flex flex-col bg-slate-950 text-slate-50 border-slate-800">
          <CardHeader className="border-b border-slate-800 px-4 py-3"><CardTitle className="text-sm font-mono text-slate-400">Live Execution Logs</CardTitle></CardHeader>
          <CardContent className="p-4 font-mono text-xs space-y-2 overflow-auto flex-1 h-96">
            <div className="text-slate-500">[14:56:01] System idle. Ready for manual trigger.</div>
            <div className="text-green-400">[14:56:02] Awaiting inputs...</div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
`);

writeFile("app/api-logs/page.tsx", `
import { AppShell } from "@/components/AppShell";
import { Card, Badge, Button } from "@/components/ui";

export default function ApiLogs() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">API Logs</h1>
          <Button variant="outline">Export Selected (CSV)</Button>
        </div>
        
        <div className="flex gap-4">
          <input type="date" className="rounded-md border p-2 text-sm" />
          <select className="rounded-md border p-2 text-sm"><option>All Statuses</option><option>Errors Only (4xx, 5xx)</option></select>
          <input type="text" placeholder="Filter Path..." className="flex-1 rounded-md border p-2 text-sm" />
        </div>

        <Card className="p-0 border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 border-b">
              <tr className="text-left"><th className="p-4">Timestamp</th><th className="p-4">Method/Path</th><th className="p-4">Status</th><th className="p-4">Latency</th><th className="p-4">IP / Actor</th><th className="p-4">JSON Payload</th></tr>
            </thead>
            <tbody className="font-mono text-xs">
              <tr className="border-b">
                <td className="p-4">2026-03-18 14:57:02</td>
                <td className="p-4 text-blue-600">POST /api/policies/POL-2/analyze</td>
                <td className="p-4"><Badge className="bg-green-100 text-green-700">200</Badge></td>
                <td className="p-4">184ms</td>
                <td className="p-4">192.168.1.5 (Alice)</td>
                <td className="p-4 text-slate-500 hover:text-blue-500 cursor-pointer">{ "{}" }</td>
              </tr>
              <tr className="border-b">
                <td className="p-4">2026-03-18 14:55:12</td>
                <td className="p-4 text-blue-600">GET /api/dashboard/summary</td>
                <td className="p-4"><Badge className="bg-red-100 text-red-700">429</Badge></td>
                <td className="p-4">12ms</td>
                <td className="p-4">10.0.0.4 (Rate Limiter)</td>
                <td className="p-4 text-slate-500 hover:text-blue-500 cursor-pointer">{ "{ \"error\": \"Too many requests\" }" }</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
`);

writeFile("app/billing/page.tsx", `
import { AppShell } from "@/components/AppShell";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";

export default function Billing() {
  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Billing & Usage</h1>
        
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Current Cycle Usage</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>Gemini Output Tokens</span><span>4.2M / 10M</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full w-[42%]"></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>OCR Pages Processed</span><span>1,402 / 5,000</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full w-[28%]"></div></div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="pb-2">Date</th><th className="pb-2">Amount</th><th className="pb-2">Status</th><th className="pb-2"></th></tr></thead>
                <tbody>
                  <tr className="border-b"><td className="py-3">Feb 2026</td><td className="font-mono">$402.12</td><td className="text-green-600">Paid</td><td><Button variant="link" className="text-blue-600">PDF</Button></td></tr>
                  <tr className="border-b"><td className="py-3">Jan 2026</td><td className="font-mono">$389.50</td><td className="text-green-600">Paid</td><td><Button variant="link" className="text-blue-600">PDF</Button></td></tr>
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

console.log("Admin Dashboard perfectly scaffolded!");
