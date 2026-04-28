"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { reportsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/contexts/auth-context";
import Markdown from 'react-markdown';

function ReportDetailContent({ id }: { id: string }) {
  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => reportsApi.getById(id),
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : report ? (
          <>
            <div>
              <h1 className="text-3xl font-bold">Report {report.id}</h1>
              <p className="text-muted-foreground">Policy: {report.policyId}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader><CardTitle>Score</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">
                  {report.score}/100
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Flaws Identified</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold text-destructive">
                  {report.flawsCount}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                <CardContent>
                  <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                    {report.status}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Report Summary</CardTitle></CardHeader>
              <CardContent>
                {report.reportMarkdown ? (
                  <div className="prose max-w-none">
                    <Markdown>{report.reportMarkdown}</Markdown>
                  </div>
                ) : (
                  <p className="text-muted-foreground">{report.summary || "No summary available"}</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Report not found</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  return (
    <ProtectedRoute>
      <ReportDetailContent id={id} />
    </ProtectedRoute>
  );
}
