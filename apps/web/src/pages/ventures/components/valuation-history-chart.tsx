import { TrendingUp } from "lucide-react";
import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/composed/empty-state";
import { ChartContainer } from "@/components/ui/chart";
import type { VentureCompanyDetail } from "@/features/ventures/venturesSlice";
import { compactCurrency } from "@/lib/format";
import {
  formatVentureDate,
  formatVentureSek,
  titleCase,
  toFiniteNumber,
} from "@/pages/ventures/utils/format";

type ValuationHistoryChartProps = {
  detail: VentureCompanyDetail;
};

type ValuationPoint = {
  id: string;
  date: string;
  label: string;
  paperValue: number;
  riskAdjustedValue: number;
  source: string;
  liquidity: string;
};

const tooltipValue = (value: unknown) =>
  typeof value === "number"
    ? formatVentureSek(value)
    : typeof value === "string"
      ? value
      : "";

const ValuationTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name?: string; value?: unknown; payload?: ValuationPoint }>;
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;

  return (
    <div className="min-w-52 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-950">
        {point?.label ?? formatVentureDate(label)}
      </p>
      <p className="mt-1 text-slate-500">{formatVentureDate(label)}</p>
      <div className="mt-2 grid gap-1">
        {payload.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between gap-4"
          >
            <span className="text-slate-500">{item.name}</span>
            <span className="font-medium text-slate-950">
              {tooltipValue(item.value)}
            </span>
          </div>
        ))}
      </div>
      {point ? (
        <p className="mt-2 text-slate-500">
          {titleCase(point.source)} · {titleCase(point.liquidity)}
        </p>
      ) : null}
    </div>
  );
};

export const ValuationHistoryChart: React.FC<ValuationHistoryChartProps> = ({
  detail,
}) => {
  const data = useMemo(
    () =>
      [...detail.valuations]
        .sort((left, right) => left.event_date.localeCompare(right.event_date))
        .map((valuation) => ({
          id: valuation.id,
          date: valuation.event_date,
          label: valuation.label,
          paperValue: toFiniteNumber(valuation.paper_value_sek),
          riskAdjustedValue: toFiniteNumber(valuation.risk_adjusted_value_sek),
          source: valuation.valuation_source,
          liquidity: valuation.liquidity_level ?? "none",
        })),
    [detail.valuations],
  );

  if (!data.length) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-teal-700" />
          <h2 className="text-base font-semibold text-slate-950">
            Valuation history
          </h2>
        </div>
        <EmptyState
          title="No valuations recorded"
          description="This workspace will show paper and risk-adjusted value once valuation events exist."
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-950">
              Valuation history
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Paper value and risk-adjusted value over time. Neither represents
            liquid cash.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-700" />
            Paper value
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Risk-adjusted
          </span>
        </div>
      </div>

      <ChartContainer
        className="h-[330px] w-full"
        config={{
          paperValue: { label: "Paper value", color: "#0f766e" },
          riskAdjustedValue: {
            label: "Risk-adjusted value",
            color: "#d97706",
          },
        }}
      >
        <AreaChart
          data={data}
          margin={{ left: 4, right: 16, top: 16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="venturePaperFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0f766e" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tickMargin={10}
            tickFormatter={(value: string) =>
              formatVentureDate(value).replace(",", "")
            }
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            width={88}
            tickFormatter={(value) =>
              compactCurrency(Number(value), { maximumFractionDigits: 1 })
            }
          />
          <Tooltip content={<ValuationTooltip />} />
          <Area
            type="monotone"
            dataKey="paperValue"
            name="Paper value"
            stroke="#0f766e"
            fill="url(#venturePaperFill)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="riskAdjustedValue"
            name="Risk-adjusted"
            stroke="#d97706"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2 }}
          />
        </AreaChart>
      </ChartContainer>
    </section>
  );
};
