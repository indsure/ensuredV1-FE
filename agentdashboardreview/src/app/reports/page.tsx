"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { reportsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/contexts/auth-context";
import Link from "next/link";

function ReportsContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: reportsApi.getAll,
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="mb-6 text-3xl font-bold">Reports</h1>
        
        <Card className="overflow-hidden">
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
                  <th className="p-4">Report</th>
                  <th className="p-4">Policy</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Score</th>
                  <th className="p-4">Created</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data && data.data.length > 0 ? (
                  data.data.map((report) => (
                    <tr key={report.id} className="border-t hover:bg-muted/50">
                      <td className="p-4 font-medium">{report.id}</td>
                      <td className="p-4">{report.policyId}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          report.status === 'completed' ? 'bg-green-50 text-green-700' :
                          report.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="p-4 font-medium">{report.score}/100</td>
                      <td className="p-4 text-muted-foreground">{new Date(report.createdAt).toLocaleDateString()}</td>
                      <td className="p-4">
                        <Link href={`/reports/${report.id}`}>
                          <Button variant="link" size="sm" className="h-auto p-0">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No reports found
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

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsContent />
    </ProtectedRoute>
  );
}
