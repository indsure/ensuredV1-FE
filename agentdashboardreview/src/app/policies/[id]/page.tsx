import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PolicyDetailPage() {
  return (
    <AppShell role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">POL-8832</h1>
            <p className="text-muted-foreground">Client: Acme Corp | Insurer: HDFC Ergo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Edit</Button>
            <Button variant="secondary">Re-run</Button>
            <Button variant="outline">Assign</Button>
            <Button>Share</Button>
          </div>
        </div>
        
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6 border rounded-lg p-6 bg-card text-card-foreground">
            <h3 className="font-semibold mb-4">Metadata</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-muted-foreground">Product:</span> Health Suraksha</div>
              <div><span className="text-muted-foreground">Status:</span> Done</div>
            </div>
          </TabsContent>
          <TabsContent value="report">Report view goes here...</TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
