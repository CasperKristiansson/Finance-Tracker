import React from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-4 text-center text-sm text-slate-600",
      className,
    )}
  >
    {icon ? <div className="text-slate-500">{icon}</div> : null}
    <p className="font-semibold text-slate-800">{title}</p>
    {description ? <p className="text-slate-600">{description}</p> : null}
    {action ? <div className="pt-1">{action}</div> : null}
  </div>
);
