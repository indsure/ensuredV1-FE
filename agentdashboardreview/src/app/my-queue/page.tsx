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
