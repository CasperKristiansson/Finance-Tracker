import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const TotalCategoryMixCard: React.FC<{
  title: string;
  description: string;
  hasOverview: boolean;
  data: Array<Record<string, number | string>>;
  keys: string[];
  colors: Record<string, string>;
}> = ({ title, description, hasOverview, data, keys, colors }) => {
  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        <p className="text-xs text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="h-80">
        {!hasOverview ? (
          <Skeleton className="h-56 w-full" />
        ) : data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#475569", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#475569", fontSize: 12 }}
                domain={[0, 100]}
                tickFormatter={(v) =>
                  `${Number(v).toLocaleString("sv-SE", {
                    maximumFractionDigits: 0,
                  })}%`
                }
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                      <p className="font-semibold text-slate-800">{label}</p>
                      {payload
                        .filter((p) => Number(p.value ?? 0) > 0.1)
                        .map((p) => (
                          <p key={String(p.dataKey)} className="text-slate-600">
                            {p.name}:{" "}
                            {Number(p.value ?? 0).toLocaleString("sv-SE", {
                              maximumFractionDigits: 1,
                            })}
                            %
                          </p>
                        ))}
                    </div>
                  );
                }}
              />
              {keys.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="mix"
                  fill={colors[key] ?? "#94a3b8"}
                  name={key}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            No category mix data yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
