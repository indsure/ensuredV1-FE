"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { queueApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/contexts/auth-context";
import Link from "next/link";

function MyQueueContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-queue'],
    queryFn: queueApi.getMyQueue,
  });

  return (
    <AppShell>
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
                  <th className="p-4">Policy #</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Added</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data && data.data.length > 0 ? (
                  data.data.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-muted/50">
                      <td className="p-4 font-medium">{item.policyNumber}</td>
                      <td className="p-4">{item.client}</td>
                      <td className="p-4">
                        <Badge>{item.status}</Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant={item.priority === 'high' ? 'destructive' : 'secondary'}>
                          {item.priority}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">{item.addedAt}</td>
                      <td className="p-4">
                        <Link href={`/policies/${item.id}`}>
                          <Button variant="link" size="sm" className="h-auto p-0">
                            Review
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Your queue is empty
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

export default function MyQueuePage() {
  return (
    <ProtectedRoute>
      <MyQueueContent />
    </ProtectedRoute>
  );
}
