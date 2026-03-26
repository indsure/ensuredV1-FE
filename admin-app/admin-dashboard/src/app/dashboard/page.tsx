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
