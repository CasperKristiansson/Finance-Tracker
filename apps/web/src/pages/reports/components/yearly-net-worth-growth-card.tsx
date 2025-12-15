import React from "react";
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

import { compactCurrency } from "../reports-utils";
import { ChartCard } from "./chart-card";

export const YearlyNetWorthGrowthCard: React.FC<{
  year: number;
  loading: boolean;
  data: Array<{ date: string; net: number; year: number }>;
  domain: [number, number];
  quarterMarkers: Array<{ date: string; label: string }>;
}> = ({ year, loading, data, domain, quarterMarkers }) => {
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
              new Date(value).toLocaleDateString("en-US", { month: "short" })
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
              key={marker.label}
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
