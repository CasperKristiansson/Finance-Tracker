import React from "react";
import { Spinner } from "@/components/spinner";
import { Skeleton } from "@/components/ui/skeleton";

export const AppLoadingShell: React.FC<{ showSpinner?: boolean }> = ({
  showSpinner = true,
}) => {
  return (
    <div className="relative min-h-screen bg-slate-50">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="hidden h-full flex-col gap-4 border-r bg-white p-4 md:flex">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-2">
            {[...Array(5)].map((_, idx) => (
              <Skeleton key={idx} className="h-8 w-full rounded-md" />
            ))}
          </div>
          <div className="mt-auto space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-3/4 rounded-md" />
          </div>
        </aside>
        <main className="flex flex-col gap-4 p-4 md:p-6">
          <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-10 w-full max-w-sm" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, idx) => (
              <div
                key={idx}
                className="rounded-xl border bg-white p-4 shadow-sm"
              >
                <Skeleton className="mb-3 h-5 w-28" />
                <Skeleton className="h-8 w-3/4" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-4/6" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
      {showSpinner ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
          <Spinner height={72} width={72} />
        </div>
      ) : null}
    </div>
  );
};
