import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { TotalDrilldownState } from "../reports-types";
import { currency, percent } from "../reports-utils";

export const TotalCategoryChangesCard: React.FC<{
  flow: "income" | "expense";
  hasOverview: boolean;
  rows: Array<{
    id: string | null;
    name: string;
    amount: number;
    prev: number;
    delta: number;
    deltaPct: number | null;
  }>;
  onOpenDrilldownDialog: (state: TotalDrilldownState) => void;
}> = ({ flow, hasOverview, rows, onOpenDrilldownDialog }) => {
  const title =
    flow === "income"
      ? "Income category changes (YoY)"
      : "Expense category changes (YoY)";
  const color = flow === "income" ? "#10b981" : "#ef4444";

  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        <p className="text-xs text-slate-500">
          Biggest changes vs the previous year (latest complete year when
          available).
        </p>
      </CardHeader>
      <CardContent className="max-h-[26rem] overflow-auto">
        {!hasOverview ? (
          <Skeleton className="h-56 w-full" />
        ) : rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  YoY
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 14).map((row) => (
                <TableRow
                  key={row.name}
                  className={row.id ? "cursor-pointer" : undefined}
                  onClick={() => {
                    if (!row.id) return;
                    onOpenDrilldownDialog({
                      kind: "category",
                      flow,
                      categoryId: row.id,
                      name: row.name,
                      color,
                    });
                  }}
                >
                  <TableCell className="max-w-[220px] truncate font-medium">
                    {row.name}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <span
                      className={
                        (flow === "expense" ? row.delta <= 0 : row.delta >= 0)
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }
                    >
                      {row.delta >= 0 ? "+" : "−"}
                      {currency(Math.abs(row.delta))}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                    {row.deltaPct !== null ? percent(row.deltaPct) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            No change data yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
