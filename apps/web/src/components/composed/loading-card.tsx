import React from "react";

import { cn } from "@/lib/utils";

import { Skeleton } from "../ui/skeleton";

type LoadingCardProps = {
  lines?: number;
  className?: string;
  lineClassName?: string;
};

export const LoadingCard: React.FC<LoadingCardProps> = ({
  lines = 4,
  className,
  lineClassName,
}) => (
  <div
    className={cn(
      "flex flex-col justify-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-300",
      className,
    )}
  >
    {Array.from({ length: lines }).map((_, idx) => (
      <Skeleton
        key={idx}
        className={cn(
          "h-3 w-full",
          idx === 0 && "w-2/3",
          idx === 1 && "w-5/6",
          lineClassName,
        )}
      />
    ))}
  </div>
);
