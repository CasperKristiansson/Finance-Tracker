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
import { compactCurrency } from "@/lib/format";
import { ChartCard } from "./chart-card";

type NetWorthPoint = {
  date: string;
  net: number;
  year: number;
};

type NetWorthChartCardProps = {
  data: NetWorthPoint[];
  loading: boolean;
  domain: [number, number];
};

export const NetWorthChartCard: React.FC<NetWorthChartCardProps> = ({
  data,
  loading,
  domain,
}) => (
  <ChartCard
    title="Net Worth"
    description="Trajectory over time"
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
      <AreaChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
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
        {Array.from(new Set(data.map((d) => d.year))).map((year) => {
          const firstPoint = data.find((d) => d.year === year);
          return firstPoint ? (
            <ReferenceLine
              key={year}
              x={firstPoint.date}
              stroke="#cbd5e1"
              strokeDasharray="4 4"
              label={{
                value: `${year}`,
                position: "insideTopLeft",
                fill: "#475569",
                fontSize: 10,
              }}
            />
          ) : null;
        })}
        <Area
          type="monotoneX"
          connectNulls
          dataKey="net"
          stroke="#4f46e5"
          fill="url(#netFill)"
          strokeWidth={2}
          name="Net worth"
        />
      </AreaChart>
    </ChartContainer>
  </ChartCard>
);
