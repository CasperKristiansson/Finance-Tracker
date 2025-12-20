import { AlertCircle } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

type InlineErrorProps = {
  message: string;
  action?: React.ReactNode;
  className?: string;
  variant?: "danger" | "warning" | "neutral";
};

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  action,
  className,
  variant = "danger",
}) => (
  <div
    className={cn(
      "flex items-start gap-2 rounded-md border p-3 text-sm",
      {
        danger:
          "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100",
        warning:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100",
        neutral:
          "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-100",
      }[variant],
      className,
    )}
  >
    <AlertCircle
      className={cn(
        "mt-0.5 h-4 w-4 shrink-0",
        {
          danger: "text-rose-500 dark:text-rose-300",
          warning: "text-amber-500 dark:text-amber-300",
          neutral: "text-slate-500 dark:text-slate-200",
        }[variant],
      )}
    />
    <div className="flex-1">{message}</div>
    {action ? <div>{action}</div> : null}
  </div>
);
