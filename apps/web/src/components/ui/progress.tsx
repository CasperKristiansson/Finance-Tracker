import React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
};

export const Progress: React.FC<ProgressProps> = ({
  value = 0,
  className,
  ...props
}) => {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-slate-100",
        className,
      )}
      {...props}
    >
      <div
        className="h-full bg-slate-800 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

export default Progress;
