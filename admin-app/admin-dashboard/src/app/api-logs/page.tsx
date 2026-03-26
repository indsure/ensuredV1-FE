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
                <td className="p-4 cursor-pointer text-slate-500 hover:text-blue-500">{'{"error":"Too many requests"}'}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
