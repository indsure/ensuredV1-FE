import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const metrics = [
  { label: "Total Policies", value: "1,204" },
  { label: "Active Agents", value: "24" },
  { label: "Pending Queue", value: "56" },
  { label: "Success Rate", value: "98.2%" },
];

export default function DashboardPage() {
  return (
    <AppShell role="admin">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardHeader><CardTitle>{metric.label}</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{metric.value}</CardContent>
            </Card>
          ))}
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
