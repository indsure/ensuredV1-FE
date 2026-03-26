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
