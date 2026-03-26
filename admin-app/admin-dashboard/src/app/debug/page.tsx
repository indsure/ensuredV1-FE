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
