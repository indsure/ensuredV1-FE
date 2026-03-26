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
