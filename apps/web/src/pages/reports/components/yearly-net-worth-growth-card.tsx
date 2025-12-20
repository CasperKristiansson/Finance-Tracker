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

import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { YearlyOverviewResponse } from "@/types/api";

import { compactCurrency, formatDate } from "../reports-utils";
import { ChartCard } from "./chart-card";

export const YearlyNetWorthGrowthCard: React.FC<{
  year: number;
  loading: boolean;
  series: YearlyOverviewResponse["net_worth"] | null;
}> = ({ year, loading, series }) => {
  const data = useMemo(
    () =>
      (series || []).map((row) => ({
        date: row.date,
        net: Number(row.net_worth),
        year: new Date(row.date).getFullYear(),
      })),
    [series],
  );

  const domain = useMemo<[number, number]>(() => {
    if (!data.length) return [0, 0];
    const values = data.map((d) => d.net);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const upperPad = Math.abs(max) * 0.05 || 1;
    const lower = min;
    const upper = max + upperPad;
    return [lower, upper];
  }, [data]);

  const quarterMarkers = useMemo(() => {
    const quarterStartMonths = new Set([1, 4, 7, 10]);
    return data
      .map((point) => {
        const date = new Date(point.date);
        const month = date.getMonth() + 1;
        const quarter = Math.floor((month - 1) / 3) + 1;
        return { date: point.date, month, quarter };
      })
      .filter((point) => quarterStartMonths.has(point.month))
      .map((point) => ({ date: point.date, label: `Q${point.quarter}` }));
  }, [data]);

  return (
    <ChartCard
      title="Net worth growth"
      description="Includes investment snapshots when available."
      loading={loading}
    >
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
              id={`netFillReports-${year}`}
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
              formatDate(value, { month: "short", locale: "en-US" })
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
          {quarterMarkers.map((marker) => (
            <ReferenceLine
              key={`${marker.label}-${marker.date}`}
              x={marker.date}
              stroke="#cbd5e1"
              strokeDasharray="4 4"
              label={{
                value: marker.label,
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
            fill={`url(#netFillReports-${year})`}
            strokeWidth={2}
            name="Net worth"
          />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  );
};
