import React, { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { currency, monthLabel, monthName, percent } from "../reports-utils";

type Heatmap = {
  max: number;
  rows: Array<{
    id: string | null;
    name: string;
    monthly: number[];
    total: number;
  }>;
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
  const [selectedCell, setSelectedCell] = useState<{
    row: Heatmap["rows"][number];
    monthIndex: number;
    value: number;
  } | null>(null);

  const selectedMonthLabel = selectedCell
    ? monthName(year, selectedCell.monthIndex + 1)
    : "";
  const selectedShare =
    selectedCell && selectedCell.row.total > 0
      ? selectedCell.value / selectedCell.row.total
      : null;

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
                      <button
                        key={idx}
                        title={`${row.name} — ${monthName(year, idx + 1)}: ${currency(value)}`}
                        type="button"
                        onClick={() =>
                          setSelectedCell({ row, monthIndex: idx, value })
                        }
                        className="h-7 rounded-sm border border-slate-100 transition hover:border-slate-200 hover:shadow-xs focus-visible:ring-2 focus-visible:ring-slate-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-white"
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
      <Dialog
        open={Boolean(selectedCell)}
        onOpenChange={(open) => {
          if (!open) setSelectedCell(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedCell?.row.name ?? "Category"} • {selectedMonthLabel}
            </DialogTitle>
          </DialogHeader>
          {selectedCell ? (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    Month
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedMonthLabel}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    Amount
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {currency(selectedCell.value)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    Share of annual
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {typeof selectedShare === "number"
                      ? percent(selectedShare)
                      : "—"}
                  </p>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold uppercase">Yearly trend</span>
                  <span>{currency(selectedCell.row.total)} total</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedCell.row.monthly.map((amount, idx) => (
                    <div
                      key={`${selectedCell.row.name}-${idx}`}
                      className={cn(
                        "rounded-md border px-2 py-2 text-xs text-slate-600",
                        idx === selectedCell.monthIndex
                          ? "border-slate-900/40 bg-slate-900/5 text-slate-900"
                          : "border-slate-100",
                      )}
                    >
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">
                        {monthLabel(
                          new Date(Date.UTC(year, idx, 1)).toISOString(),
                        )}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {currency(amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
