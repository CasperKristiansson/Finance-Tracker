import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

import { compactCurrency } from "../reports-utils";

export const TotalNetWorthTrajectoryCard: React.FC<{
  loading: boolean;
  data: Array<{ date: string; net: number; year: number }>;
  domain: [number, number];
}> = ({ loading, data, domain }) => {
  const yearMarkers = useMemo(
    () =>
      Array.from(new Set(data.map((point) => point.year)))
        .sort((a, b) => a - b)
        .map((year) => ({ year, first: data.find((d) => d.year === year) }))
        .filter(
          (entry): entry is { year: number; first: { date: string } } =>
            Boolean(entry.first),
        ),
    [data],
  );

  return (
    <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900">
            Net Worth
          </CardTitle>
          <p className="text-xs text-slate-500">Trajectory over time</p>
        </div>
      </CardHeader>
      <CardContent className="h-80 md:h-96">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : !data.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-600">
            <p>No net worth history yet.</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full w-full"
            config={{
              net: {
                label: "Net worth",
                color: "#4f46e5",
              },
            }}
          >
            <AreaChart
              data={data}
              margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="netFillTotalTrajectory"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-US", {
                    month: "short",
                  })
                }
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                domain={domain}
                allowDataOverflow
                tickMargin={12}
                width={90}
                tickFormatter={(v) => compactCurrency(Number(v))}
              />
              <Tooltip content={<ChartTooltipContent />} />
              {yearMarkers.map(({ year, first }) => (
                <ReferenceLine
                  key={year}
                  x={first.date}
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                  label={{
                    value: `${year}`,
                    position: "insideTopLeft",
                    fill: "#475569",
                    fontSize: 10,
                  }}
                />
              ))}
              <Area
                type="monotoneX"
                connectNulls
                dataKey="net"
                stroke="#4f46e5"
                fill="url(#netFillTotalTrajectory)"
                strokeWidth={2}
                name="Net worth"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

