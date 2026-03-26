import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

const reportRows = [
  { id: "RPT-001", policy: "POL-001", status: "Approved", score: "96.4" },
  { id: "RPT-002", policy: "POL-002", status: "Pending Review", score: "81.2" },
];

export default function ReportsPage() {
  return (
    <AppShell role="admin">
      <div className="space-y-6">
        <h1 className="mb-6 text-3xl font-bold">Reports</h1>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-4">Report</th>
                <th className="p-4">Policy</th>
                <th className="p-4">Status</th>
                <th className="p-4">Score</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((report) => (
                <tr key={report.id} className="border-t">
                  <td className="p-4 font-medium">{report.id}</td>
                  <td className="p-4">{report.policy}</td>
                  <td className="p-4">{report.status}</td>
                  <td className="p-4">{report.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-sm text-muted-foreground">This review app is kept buildable as a non-canonical dashboard variant.</p>
      </div>
    </AppShell>
  );
}
