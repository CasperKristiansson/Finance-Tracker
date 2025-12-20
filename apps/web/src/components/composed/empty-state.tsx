import React from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  variant?: "neutral" | "warning" | "danger";
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className,
  variant = "neutral",
}) => {
  const iconColor =
    variant === "warning"
      ? "text-amber-600 dark:text-amber-300"
      : variant === "danger"
        ? "text-rose-600 dark:text-rose-300"
        : undefined;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-md border p-4 text-center text-sm",
        {
          neutral:
            "border-slate-100 bg-slate-50 text-slate-600 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-300",
          warning:
            "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200",
          danger:
            "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200",
        }[variant],
        className,
      )}
    >
      {icon ? (
        <div className={cn("text-slate-500", iconColor)}>{icon}</div>
      ) : null}
      <p
        className={cn(
          "font-semibold",
          {
            neutral: "text-slate-800 dark:text-slate-100",
            warning: "text-amber-900 dark:text-amber-100",
            danger: "text-rose-900 dark:text-rose-100",
          }[variant],
        )}
      >
        {title}
      </p>
      {description ? (
        <p
          className={cn(
            {
              neutral: "text-slate-600 dark:text-slate-300",
              warning: "text-amber-700 dark:text-amber-200",
              danger: "text-rose-700 dark:text-rose-200",
            }[variant],
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
};
