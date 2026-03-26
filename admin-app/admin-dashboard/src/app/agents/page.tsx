import { AppShell } from "@/components/AppShell";
import { Card, Button, Badge } from "@/components/ui";

export default function AgentManagement() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <Button>+ Invite Agent</Button>
        </div>
        
        <Card className="p-0 border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 border-b">
              <tr className="text-left"><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4">Success %</th><th className="p-4">Actions</th></tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-4 font-medium">Alice Smith</td><td className="p-4 text-slate-500">alice@indsure.com</td><td className="p-4">Manager</td><td className="p-4"><Badge className="bg-green-100 text-green-700">Active</Badge></td><td className="p-4">98%</td>
                <td className="p-4 gap-2 flex"><Button className="h-7 bg-slate-100 text-slate-700 hover:bg-slate-200">Edit</Button><Button className="h-7 bg-red-50 text-red-600 hover:bg-red-100">Suspend</Button></td>
              </tr>
              <tr className="border-b">
                <td className="p-4 font-medium">Bob Jones</td><td className="p-4 text-slate-500">bob@indsure.com</td><td className="p-4">Agent</td><td className="p-4"><Badge className="bg-slate-100 text-slate-700">Inactive</Badge></td><td className="p-4">84%</td>
                <td className="p-4 gap-2 flex"><Button className="h-7 bg-slate-100 text-slate-700 hover:bg-slate-200">Edit</Button><Button className="h-7 bg-red-50 text-red-600 hover:bg-red-100">Suspend</Button></td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
