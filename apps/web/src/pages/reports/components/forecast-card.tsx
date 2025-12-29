import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { compactCurrency, currency, formatDate } from "../reports-utils";
import { ChartCard } from "./chart-card";

export type NetWorthForecast = {
  data: Array<{
    date: string;
    actual: number | null;
    projected: number | null;
  }>;
  horizonMonths: number;
  baselineChange: number;
  lastActualDate: string;
  projectedEndDate: string | null;
};

export const ForecastCard: React.FC<{
  loading: boolean;
  forecast: NetWorthForecast | null;
  horizonMonths: number;
  horizonOptions: Array<{ label: string; value: number }>;
  onHorizonChange: (value: number) => void;
}> = ({
  loading,
  forecast,
  horizonMonths,
  horizonOptions,
  onHorizonChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const domain = useMemo<[number, number]>(() => {
    if (!forecast?.data?.length) return [0, 0];
    const values = forecast.data
      .flatMap((row) => [row.actual, row.projected])
      .filter((value): value is number => typeof value === "number");
    if (!values.length) return [0, 0];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(1, Math.abs(max) * 0.05);
    return [min - pad, max + pad];
  }, [forecast]);

  return (
    <ChartCard
      title="Net worth forecast"
      description="Baseline from recent net worth and cash flow."
      loading={loading}
    >
      {!forecast && !loading ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-600">
          <p>Add a few months of history to unlock projections.</p>
        </div>
      ) : !forecast?.data.length ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-600">
          <p>No forecast data yet.</p>
        </div>
      ) : (
        <div className="flex h-full flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                Baseline: {compactCurrency(forecast.baselineChange)}/mo
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                Through{" "}
                {forecast.projectedEndDate
                  ? formatDate(forecast.projectedEndDate, {
                      month: "short",
                      year: "numeric",
                    })
                  : "next months"}
              </span>
            </div>
            <DropdownMenu onOpenChange={setIsOpen}>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm">
                {horizonOptions.find((option) => option.value === horizonMonths)
                  ?.label ?? `${horizonMonths} months`}
                {isOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {horizonOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => onHorizonChange(option.value)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ChartContainer
            className="h-64 w-full"
            config={{
              actual: { label: "Actual", color: "#4f46e5" },
              projected: { label: "Projected", color: "#22c55e" },
            }}
          >
            <LineChart data={forecast.data} margin={{ top: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  formatDate(String(value), {
                    month: "short",
                    year: "2-digit",
                  })
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                domain={domain}
                tickMargin={12}
                width={90}
                tickFormatter={(value) => compactCurrency(Number(value))}
              />
              <Tooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => currency(Number(value))}
                    labelFormatter={(value) =>
                      formatDate(String(value), {
                        month: "short",
                        year: "numeric",
                      })
                    }
                  />
                }
              />
              <ChartLegend
                verticalAlign="top"
                content={<ChartLegendContent className="pt-0" />}
              />
              <Line
                type="monotoneX"
                dataKey="actual"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotoneX"
                dataKey="projected"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                strokeDasharray="6 6"
                connectNulls
              />
            </LineChart>
          </ChartContainer>
        </div>
      )}
    </ChartCard>
  );
};
