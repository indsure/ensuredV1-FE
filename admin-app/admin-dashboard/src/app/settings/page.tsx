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
