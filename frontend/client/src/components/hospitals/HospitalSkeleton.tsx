import { Skeleton } from "@/components/ui/skeleton";

export function HospitalSkeleton() {
    return (
        <div className="space-y-8">
            {/* Hero Skeleton */}
            <section className="bg-[var(--color-navy-900)] pt-8 pb-12 border-t border-[var(--color-border-subtle)]">
                <div className="container-editorial">
                    <div className="mb-8">
                        <Skeleton className="h-4 w-48 mb-4 bg-[var(--color-blue-800)]" />
                        <div className="grid md:grid-cols-2 gap-8 items-start">
                            <div>
                                <Skeleton className="h-8 w-64 mb-2 bg-[var(--color-blue-800)]" />
                                <Skeleton className="h-6 w-96 bg-[var(--color-blue-800)]" />
                            </div>
                            <div className="md:pl-8">
                                <Skeleton className="h-40 w-full rounded-xl bg-[var(--color-blue-800)]" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Grid Skeleton */}
            <section className="bg-[var(--color-cream-main)] py-12">
                <div className="container-editorial">
                    <div className="flex items-center gap-3 mb-8">
                        <Skeleton className="w-12 h-12 rounded-lg bg-gray-200" />
                        <div>
                            <Skeleton className="h-8 w-64 mb-2 bg-gray-200" />
                            <Skeleton className="h-4 w-32 bg-gray-200" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="card-white h-64 border border-transparent">
                                <Skeleton className="h-6 w-3/4 mb-2 bg-gray-100" />
                                <Skeleton className="h-4 w-1/2 mb-6 bg-gray-100" />
                                <div className="space-y-4">
                                    <Skeleton className="h-4 w-full bg-gray-100" />
                                    <Skeleton className="h-4 w-full bg-gray-100" />
                                    <Skeleton className="h-4 w-2/3 bg-gray-100" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
