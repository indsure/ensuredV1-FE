import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function RiskMeterSkeleton() {
  return (
    <div className="space-y-6" aria-live="polite" aria-label="Evaluating risk ratings">
      {/* Policy Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-gray-200 dark:border-gray-600">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton variant="circular" width={32} height={32} />
                <div className="space-y-1 flex-1">
                  <Skeleton variant="text" width="60%" height={16} />
                  <Skeleton variant="text" width="40%" height={12} />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton variant="text" width="40%" height={12} />
                <Skeleton variant="text" width="60%" height={20} />
              </div>
              <div className="space-y-2">
                <Skeleton variant="text" width="40%" height={12} />
                <Skeleton variant="text" width="70%" height={20} />
              </div>
              <Skeleton variant="rectangular" width="100%" height={32} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Best Match Card Skeleton */}
      <Card className="border-2 border-[#3CBBA0]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton variant="text" width="200px" height={24} />
              <Skeleton variant="text" width="150px" height={16} />
            </div>
            <div className="text-right space-y-1">
              <Skeleton variant="text" width="120px" height={24} />
              <Skeleton variant="text" width="80px" height={12} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton variant="text" width="100%" height={16} />
            <Skeleton variant="text" width="100%" height={16} />
            <Skeleton variant="text" width="80%" height={16} />
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton variant="text" width="200px" height={24} />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton variant="text" width="150px" height={20} />
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} variant="text" width="100%" height={16} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

