import { AlertCircle } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

type InlineErrorProps = {
  message: string;
  action?: React.ReactNode;
  className?: string;
};

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  action,
  className,
}) => (
  <div
    className={cn(
      "flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700",
      className,
    )}
  >
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="flex-1">{message}</div>
    {action ? <div>{action}</div> : null}
  </div>
);
