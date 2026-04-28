"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { errorsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/contexts/auth-context";

function ErrorsContent() {
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['errors', severityFilter, statusFilter],
    queryFn: () => errorsApi.getAll({ 
      severity: severityFilter || undefined, 
      status: statusFilter || undefined 
    }),
  });

  const handleRetry = async (errorId: string) => {
    try {
      await errorsApi.retry(errorId);
      refetch();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const handleResolve = async (errorId: string) => {
    try {
      await errorsApi.resolve(errorId);
      refetch();
    } catch (error) {
      console.error('Resolve failed:', error);
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">System Errors</h1>
          <div className="flex gap-2">
            <select 
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select 
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
            </select>
          </div>
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
                  <th className="p-4">Policy</th>
                  <th className="p-4">Error Type</th>
                  <th className="p-4">Severity</th>
                  <th className="p-4">Message</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data && data.data.length > 0 ? (
                  data.data.map((error) => (
                    <tr key={error.id} className="border-t hover:bg-muted/50">
                      <td className="p-4 font-medium">{error.policyId}</td>
                      <td className="p-4">{error.errorType}</td>
                      <td className="p-4">
                        <Badge variant={
                          error.severity === 'critical' ? 'destructive' :
                          error.severity === 'high' ? 'destructive' :
                          'secondary'
                        }>
                          {error.severity}
                        </Badge>
                      </td>
                      <td className="p-4 max-w-xs truncate">{error.message}</td>
                      <td className="p-4">
                        <Badge variant={error.status === 'resolved' ? 'default' : 'outline'}>
                          {error.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(error.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {error.status === 'open' && (
                            <>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0"
                                onClick={() => handleRetry(error.id)}
                              >
                                Retry
                              </Button>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0"
                                onClick={() => handleResolve(error.id)}
                              >
                                Resolve
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No errors found
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

export default function ErrorsPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'manager']}>
      <ErrorsContent />
    </ProtectedRoute>
  );
}
