"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { agentsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/contexts/auth-context";
import Link from "next/link";

function AgentsContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.getAll,
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <Button>+ Add Agent</Button>
        </div>

        <Card className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Assigned Policies</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data && data.data.length > 0 ? (
                  data.data.map((agent) => (
                    <tr key={agent.id} className="border-t hover:bg-muted/50">
                      <td className="p-4 font-medium">{agent.name}</td>
                      <td className="p-4">{agent.email}</td>
                      <td className="p-4">
                        <Badge variant="outline">{agent.role}</Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                          {agent.status}
                        </Badge>
                      </td>
                      <td className="p-4">{agent.assignedPolicies}</td>
                      <td className="p-4">
                        <Link href={`/agents/${agent.id}`}>
                          <Button variant="link" size="sm" className="h-auto p-0">
                            View Profile
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No agents found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export default function AgentsPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'manager']}>
      <AgentsContent />
    </ProtectedRoute>
  );
}
