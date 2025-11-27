import React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
  indicatorClassName?: string;
  indicatorStyle?: React.CSSProperties;
};

export const Progress: React.FC<ProgressProps> = ({
  value = 0,
  className,
  indicatorClassName,
  indicatorStyle,
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
        className={cn("h-full bg-slate-800 transition-all", indicatorClassName)}
        style={{ width: `${clamped}%`, ...indicatorStyle }}
      />
    </div>
  );
};

export default Progress;
