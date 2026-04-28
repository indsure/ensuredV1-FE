"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { policiesApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/contexts/auth-context";

function PolicyDetailContent({ id }: { id: string }) {
  const { data: policy, isLoading } = useQuery({
    queryKey: ['policy', id],
    queryFn: () => policiesApi.getById(id),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : policy ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">{policy.policyNumber}</h1>
                <p className="text-muted-foreground">
                  Client: {policy.client} | Insurer: {policy.insurer}
                </p>
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
              
              <TabsContent value="overview" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Policy Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Policy Number:</span>
                        <p className="font-medium">{policy.policyNumber}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Product:</span>
                        <p className="font-medium">{policy.product}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <div className="mt-1">
                          <Badge variant={policy.status === 'completed' ? 'default' : 'secondary'}>
                            {policy.status}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Assigned To:</span>
                        <p className="font-medium">{policy.assignedTo}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Created:</span>
                        <p className="font-medium">{new Date(policy.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Last Updated:</span>
                        <p className="font-medium">{new Date(policy.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="report" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Policy Report</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Report details will be displayed here...</p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="files" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Uploaded Files</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">File list will be displayed here...</p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="history" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Activity History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Activity timeline will be displayed here...</p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="notes" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Notes and comments will be displayed here...</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Policy not found</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  return (
    <ProtectedRoute>
      <PolicyDetailContent id={id} />
    </ProtectedRoute>
  );
}
