import React from "react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { DetailDialogState } from "../reports-types";
import {
  compactCurrency,
  currency,
  formatDate,
  percent,
} from "../reports-utils";

export const YearlyDetailDialog: React.FC<{
  open: boolean;
  detailDialog: DetailDialogState | null;
  onOpenChange: (open: boolean) => void;
}> = ({ open, detailDialog, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{detailDialog?.title ?? "Details"}</DialogTitle>
        </DialogHeader>
        {!detailDialog ? null : detailDialog.kind === "investments" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    As of
                  </p>
                  <p className="font-semibold text-slate-900">
                    {formatDate(detailDialog.asOf)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Value
                  </p>
                  <p className="font-semibold text-slate-900">
                    {currency(detailDialog.summary.end)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {detailDialog.summary.change >= 0 ? "+" : "−"}
                    {currency(Math.abs(detailDialog.summary.change))}{" "}
                    {detailDialog.summary.changePct !== null
                      ? `(${percent(detailDialog.summary.changePct)})`
                      : ""}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-white p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Contributions
                  </p>
                  <p className="font-semibold text-slate-900">
                    {currency(detailDialog.summary.contributions)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-white p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Withdrawals
                  </p>
                  <p className="font-semibold text-slate-900">
                    {currency(detailDialog.summary.withdrawals)}
                  </p>
                </div>
              </div>
              <div className="h-60 rounded-md border border-slate-100 bg-white p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={detailDialog.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#475569", fontSize: 12 }}
                      tickFormatter={(v) => compactCurrency(Number(v))}
                    />
                    <Tooltip
                      formatter={(value) => currency(Number(value))}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#4f46e5"
                      fill="rgba(79,70,229,0.15)"
                      strokeWidth={2}
                      name="Portfolio"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold">What this means</p>
                <p className="text-xs text-slate-600">
                  Investments are tracked via snapshots, so they should not
                  appear as an expense category.
                </p>
              </div>
              <div className="rounded-md border border-slate-100">
                <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  Accounts
                </div>
                <div className="max-h-[22rem] overflow-auto">
                  {detailDialog.accounts.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Start</TableHead>
                          <TableHead className="text-right">End</TableHead>
                          <TableHead className="text-right">Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailDialog.accounts.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell className="max-w-[200px] truncate font-medium">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-right">
                              {currency(row.start)}
                            </TableCell>
                            <TableCell className="text-right">
                              {currency(row.end)}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              <span
                                className={
                                  row.change >= 0
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }
                              >
                                {row.change >= 0 ? "+" : "−"}
                                {currency(Math.abs(row.change))}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-3 text-sm text-slate-500">
                      No investment accounts available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : detailDialog.kind === "debt" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Start
                  </p>
                  <p className="font-semibold text-slate-900">
                    {currency(detailDialog.startDebt)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    End
                  </p>
                  <p className="font-semibold text-slate-900">
                    {currency(detailDialog.endDebt)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-white p-3 sm:col-span-2">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Change
                  </p>
                  <p className="font-semibold text-slate-900">
                    {detailDialog.delta >= 0 ? "+" : "−"}
                    {currency(Math.abs(detailDialog.delta))}
                  </p>
                </div>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                A negative change means you paid down debt during the year.
              </div>
            </div>
            <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={detailDialog.monthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickFormatter={(v) => compactCurrency(Number(v))}
                  />
                  <Tooltip
                    formatter={(value) => currency(Number(value))}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    name="Debt"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : detailDialog.kind === "account" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              {[
                { label: "Start", value: detailDialog.startBalance },
                { label: "End", value: detailDialog.endBalance },
                { label: "Change", value: detailDialog.change },
                { label: "Type", value: detailDialog.accountType, text: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-md border border-slate-100 bg-slate-50 p-3"
                >
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    {item.label}
                  </p>
                  <p className="font-semibold text-slate-900">
                    {"text" in item && item.text
                      ? String(item.value)
                      : currency(Number(item.value))}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={detailDialog.monthly.map((m) => ({
                      ...m,
                      expenseNeg: -m.expense,
                      transfersOutNeg: -m.transfersOut,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#475569", fontSize: 12 }}
                      tickFormatter={(v) => compactCurrency(Number(v))}
                    />
                    <Tooltip
                      formatter={(value) => currency(Number(value))}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar
                      dataKey="income"
                      name="Income"
                      fill="#10b981"
                      radius={[4, 4, 4, 4]}
                    />
                    <Bar
                      dataKey="expenseNeg"
                      name="Expense"
                      fill="#ef4444"
                      radius={[4, 4, 4, 4]}
                    />
                    <Bar
                      dataKey="transfersIn"
                      name="Transfers in"
                      fill="#0ea5e9"
                      radius={[4, 4, 4, 4]}
                    />
                    <Bar
                      dataKey="transfersOutNeg"
                      name="Transfers out"
                      fill="#a855f7"
                      radius={[4, 4, 4, 4]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={detailDialog.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#475569", fontSize: 12 }}
                      tickFormatter={(v) => compactCurrency(Number(v))}
                    />
                    <Tooltip
                      formatter={(value) => currency(Number(value))}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="change"
                      name="Monthly change"
                      stroke="#334155"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : detailDialog.kind === "source" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  {detailDialog.subtitle}
                </p>
                <p className="font-semibold text-slate-900">
                  {currency(detailDialog.total)}
                </p>
                <p className="text-xs text-slate-600">
                  {detailDialog.txCount} transactions
                </p>
                {typeof detailDialog.compareTotal === "number" ? (
                  <p className="pt-1 text-xs text-slate-600">
                    {detailDialog.compareLabel ?? "Last year"}:{" "}
                    {currency(detailDialog.compareTotal)}{" "}
                    <span
                      className={
                        detailDialog.total - detailDialog.compareTotal >= 0
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-rose-700"
                      }
                    >
                      (
                      {detailDialog.total - detailDialog.compareTotal >= 0
                        ? "+"
                        : "−"}
                      {currency(
                        Math.abs(
                          detailDialog.total - detailDialog.compareTotal,
                        ),
                      )}
                      )
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                This is grouped by transaction description (good for spotting
                recurring sources and merchants).
              </div>
            </div>
            <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={detailDialog.monthly.map((row, idx) => ({
                    month: row.month,
                    current: row.total,
                    compare: detailDialog.compareMonthly?.[idx]?.total ?? null,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickFormatter={(v) => compactCurrency(Number(v))}
                  />
                  <Tooltip
                    formatter={(value) => currency(Number(value))}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar
                    dataKey="current"
                    name={detailDialog.subtitle}
                    fill="#334155"
                    radius={[6, 6, 4, 4]}
                  />
                  {detailDialog.compareMonthly?.length ? (
                    <Bar
                      dataKey="compare"
                      name={detailDialog.compareLabel ?? "Last year"}
                      fill="#94a3b8"
                      radius={[6, 6, 4, 4]}
                    />
                  ) : null}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
