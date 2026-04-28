"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { agentsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/contexts/auth-context";

function AgentProfileContent({ id }: { id: string }) {
  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.getById(id),
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : agent ? (
          <>
            <div>
              <h1 className="text-3xl font-bold">{agent.name}</h1>
              <p className="text-muted-foreground">{agent.email}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader><CardTitle>Role</CardTitle></CardHeader>
                <CardContent>
                  <Badge variant="outline">{agent.role}</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                <CardContent>
                  <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                    {agent.status}
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Average Score</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">
                  {agent.averageScore}/100
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Assigned Policies</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">
                  {agent.assignedPolicies}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Completed Policies</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">
                  {agent.completedPolicies}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Agent not found</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function AgentProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  return (
    <ProtectedRoute allowedRoles={['admin', 'manager']}>
      <AgentProfileContent id={id} />
    </ProtectedRoute>
  );
}
