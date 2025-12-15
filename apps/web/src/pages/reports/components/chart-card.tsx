import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const ChartCard: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
  loading?: boolean;
  contentClassName?: string;
}> = ({ title, description, children, loading, contentClassName }) => (
  <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-semibold text-slate-900">
        {title}
      </CardTitle>
      {description ? (
        <p className="text-xs text-slate-500">{description}</p>
      ) : null}
    </CardHeader>
    <CardContent className={contentClassName ?? "h-80"}>
      {loading ? <Skeleton className="h-full w-full" /> : children}
    </CardContent>
  </Card>
);
