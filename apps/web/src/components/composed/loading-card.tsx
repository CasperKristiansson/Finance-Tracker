import React from "react";

import { cn } from "@/lib/utils";

import { Skeleton } from "../ui/skeleton";

type LoadingCardProps = {
  lines?: number;
  className?: string;
  lineClassName?: string;
};

const lineWidthClasses = ["w-2/3", "w-5/6"];

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
    {Array.from({ length: lines }, (_, index) => index).map((line) => (
      <Skeleton
        key={`line-${line}`}
        className={cn("h-3 w-full", lineWidthClasses[line], lineClassName)}
      />
    ))}
  </div>
);
