import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ChartCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  loading?: boolean;
};

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  description,
  children,
  action,
  loading,
}) => (
  <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
      <div>
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        {description ? (
          <p className="text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      {action}
    </CardHeader>
    <CardContent className="h-80 md:h-96">
      {loading ? <Skeleton className="h-full w-full" /> : children}
    </CardContent>
  </Card>
);
