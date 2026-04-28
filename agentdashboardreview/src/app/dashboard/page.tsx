"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardApi, errorsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/contexts/auth-context";

function DashboardContent() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: dashboardApi.getMetrics,
  });

  const { data: failures, isLoading: failuresLoading } = useQuery({
    queryKey: ['dashboard-failures'],
    queryFn: dashboardApi.getRecentFailures,
  });

  const { data: highRisk, isLoading: highRiskLoading } = useQuery({
    queryKey: ['dashboard-high-risk'],
    queryFn: dashboardApi.getHighRiskItems,
  });

  const handleRetry = async (errorId: string) => {
    try {
      await errorsApi.retry(errorId);
      // Refetch data after retry
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        
        <div className="grid gap-4 md:grid-cols-4">
          {metricsLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
                  <CardContent><Skeleton className="h-8 w-20" /></CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle>Total Policies</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">
                  {metrics?.totalPolicies?.toLocaleString() || '0'}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Active Agents</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">
                  {metrics?.activeAgents || '0'}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Pending Queue</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">
                  {metrics?.pendingQueue || '0'}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Success Rate</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">
                  {metrics?.successRate ? `${metrics.successRate}%` : '0%'}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Recent Failures</CardTitle></CardHeader>
            <CardContent>
              {failuresLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : failures && failures.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2">Policy</th>
                      <th className="pb-2">Error</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.map((failure) => (
                      <tr key={failure.id} className="border-b">
                        <td className="py-2">{failure.policyId}</td>
                        <td className="text-destructive">{failure.error}</td>
                        <td>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => handleRetry(failure.id)}
                            className="h-auto p-0"
                          >
                            Retry
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">No recent failures</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>High Risk Items</CardTitle></CardHeader>
            <CardContent>
              {highRiskLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : highRisk && highRisk.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2">ID</th>
                      <th className="pb-2">Score</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highRisk.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">{item.policyId}</td>
                        <td className="text-orange-500">{item.score}/100</td>
                        <td>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            onClick={() => window.location.href = `/policies/${item.policyId}`}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">No high risk items</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'manager']}>
      <DashboardContent />
    </ProtectedRoute>
  );
}
