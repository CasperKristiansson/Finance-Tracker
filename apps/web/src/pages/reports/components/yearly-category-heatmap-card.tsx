import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { currency, monthLabel, monthName } from "../reports-utils";

type Heatmap = {
  max: number;
  rows: Array<{ name: string; monthly: number[] }>;
};

export const YearlyCategoryHeatmapCard: React.FC<{
  title: string;
  description: string;
  year: number;
  hasOverview: boolean;
  heatmap: Heatmap;
  color: "income" | "expense";
}> = ({ title, description, year, hasOverview, heatmap, color }) => {
  const rgb = color === "income" ? "16, 185, 129" : "239, 68, 68";

  return (
    <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        <p className="text-xs text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="overflow-auto">
        {!hasOverview ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[160px_repeat(12,minmax(28px,1fr))] gap-1 text-[11px] text-slate-600">
              <div />
              {Array.from({ length: 12 }, (_, idx) => (
                <div key={idx} className="text-center">
                  {monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString())}
                </div>
              ))}
              {heatmap.rows.map((row) => (
                <React.Fragment key={row.name}>
                  <div className="truncate pr-2 text-slate-700">{row.name}</div>
                  {row.monthly.map((value, idx) => {
                    const intensity = heatmap.max > 0 ? value / heatmap.max : 0;
                    const bg = `rgba(${rgb}, ${Math.min(0.08 + intensity * 0.6, 0.7)})`;
                    return (
                      <div
                        key={idx}
                        title={`${row.name} — ${monthName(year, idx + 1)}: ${currency(value)}`}
                        className="h-7 rounded-sm border border-slate-100"
                        style={{
                          backgroundColor: value > 0 ? bg : undefined,
                        }}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
