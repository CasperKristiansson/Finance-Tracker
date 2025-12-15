import React, { useMemo } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type {
  YearlyCategoryDetailResponse,
  YearlyOverviewResponse,
} from "@/types/api";
import { currency, monthLabel } from "../reports-utils";

export const YearlyCategoryDetailDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategoryFlow: "expense" | "income";
  selectedCategoryId: string | null;
  year: number;
  prevOverview: YearlyOverviewResponse | null;
  categoryDetailLoading: boolean;
  categoryDetail: YearlyCategoryDetailResponse | null;
}> = ({
  open,
  onOpenChange,
  selectedCategoryFlow,
  selectedCategoryId,
  year,
  prevOverview,
  categoryDetailLoading,
  categoryDetail,
}) => {
  const prevMonthly = useMemo(() => {
    if (!prevOverview) return null;
    if (!selectedCategoryId) return null;
    const rows =
      selectedCategoryFlow === "income"
        ? prevOverview.income_category_breakdown
        : prevOverview.category_breakdown;
    const match = rows.find((row) => row.category_id === selectedCategoryId);
    if (!match) return null;
    return match.monthly.map((value) => Number(value));
  }, [prevOverview, selectedCategoryFlow, selectedCategoryId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {categoryDetail?.category_name || "Category"}
          </DialogTitle>
        </DialogHeader>
        {categoryDetailLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : categoryDetail ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryDetail.monthly.map((m, idx) => ({
                    month: monthLabel(m.date),
                    amount: Number(m.amount),
                    prevAmount: prevMonthly?.[idx] ?? undefined,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value, name) => [
                      currency(Number(value)),
                      String(name),
                    ]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar
                    dataKey="amount"
                    name={String(year)}
                    fill={
                      selectedCategoryFlow === "income" ? "#10b981" : "#ef4444"
                    }
                    radius={[6, 6, 6, 6]}
                  />
                  {prevMonthly ? (
                    <Bar
                      dataKey="prevAmount"
                      name={String(year - 1)}
                      fill="#94a3b8"
                      radius={[6, 6, 6, 6]}
                    />
                  ) : null}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="max-h-64 overflow-auto">
              <p className="mb-2 text-xs font-semibold text-slate-700 uppercase">
                Top merchants
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryDetail.top_merchants.map((row) => (
                    <TableRow key={row.merchant}>
                      <TableCell className="max-w-[180px] truncate font-medium">
                        {row.merchant}
                      </TableCell>
                      <TableCell className="text-right">
                        {currency(Number(row.amount))}
                      </TableCell>
                      <TableCell className="text-right text-xs text-slate-600">
                        {row.transaction_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No details available.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
