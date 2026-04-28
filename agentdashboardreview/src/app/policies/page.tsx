"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { policiesApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/contexts/auth-context";
import Link from "next/link";

function PoliciesContent() {
  const [insurerFilter, setInsurerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ['policies', insurerFilter, statusFilter],
    queryFn: () => policiesApi.getAll({ 
      insurer: insurerFilter || undefined, 
      status: statusFilter || undefined 
    }),
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Policies</h1>
          <Button>+ Add Policy</Button>
        </div>
        
        <div className="flex gap-6">
          <div className="w-64 space-y-4 border-r pr-6">
            <h3 className="font-semibold">Filters</h3>
            <div>
              <label className="text-sm font-medium mb-1 block">Insurer</label>
              <Input
                type="text"
                placeholder="Filter by insurer..."
                value={insurerFilter}
                onChange={(e) => setInsurerFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <select 
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            {(insurerFilter || statusFilter) && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setInsurerFilter("");
                  setStatusFilter("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
          
          <div className="flex-1">
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
                      <th className="p-4">ID</th>
                      <th className="p-4">Insurer</th>
                      <th className="p-4">Assigned</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.data && data.data.length > 0 ? (
                      data.data.map((policy) => (
                        <tr key={policy.id} className="border-t hover:bg-muted/50">
                          <td className="p-4 font-medium">{policy.id}</td>
                          <td className="p-4">{policy.insurer}</td>
                          <td className="p-4">{policy.assignedTo}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                              policy.status === 'completed' ? 'bg-green-50 text-green-700' :
                              policy.status === 'processing' ? 'bg-blue-50 text-blue-700' :
                              policy.status === 'failed' ? 'bg-red-50 text-red-700' :
                              'bg-gray-50 text-gray-700'
                            }`}>
                              {policy.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <Link href={`/policies/${policy.id}`}>
                              <Button variant="link" size="sm" className="h-auto p-0">
                                View
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No policies found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function PoliciesPage() {
  return (
    <ProtectedRoute>
      <PoliciesContent />
    </ProtectedRoute>
  );
}
