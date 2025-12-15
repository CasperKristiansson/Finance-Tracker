import React from "react";

import { Button } from "@/components/ui/button";
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

import type { YearlyOverviewResponse } from "@/types/api";
import type { YearlyExtraDialogState } from "../reports-types";
import { currency, downloadCsv } from "../reports-utils";

type CategoryDeltaRow = {
  key: string;
  id: string | null;
  name: string;
  current: number;
  prev: number;
  delta: number;
  deltaPct: number | null;
};

type SourceDeltaRow = {
  source: string;
  current: number;
  prev: number;
  delta: number;
  deltaPct: number | null;
  txCount: number;
};

type SavingsDecomposition = {
  incomeNow: number;
  expenseNow: number;
  netNow: number;
  incomePrev: number;
  expensePrev: number;
  netPrev: number;
  incomeDelta: number;
  expenseDelta: number;
  netDelta: number;
  contributions: Array<{
    kind: "income" | "expense";
    id: string | null;
    name: string;
    contribution: number;
  }>;
};

export const YearlyExtraDialog: React.FC<{
  year: number;
  open: boolean;
  state: YearlyExtraDialogState | null;
  overview: YearlyOverviewResponse | null;
  yearlyExpenseCategoryDeltas: CategoryDeltaRow[];
  yearlyIncomeCategoryDeltas: CategoryDeltaRow[];
  yearlyExpenseSourceDeltas: SourceDeltaRow[];
  yearlyIncomeSourceDeltas: SourceDeltaRow[];
  yearlySavingsDecomposition: SavingsDecomposition | null;
  onClose: () => void;
  onSetState: (next: YearlyExtraDialogState) => void;
  onSelectCategory: (flow: "income" | "expense", categoryId: string) => void;
  onOpenYearlySourceDetail: (
    flow: "income" | "expense",
    source: string,
  ) => void;
}> = ({
  year,
  open,
  state,
  overview,
  yearlyExpenseCategoryDeltas,
  yearlyIncomeCategoryDeltas,
  yearlyExpenseSourceDeltas,
  yearlyIncomeSourceDeltas,
  yearlySavingsDecomposition,
  onClose,
  onSetState,
  onSelectCategory,
  onOpenYearlySourceDetail,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {state?.kind === "categoryDrivers"
              ? `Category drivers (${year} vs ${year - 1})`
              : state?.kind === "merchantDrivers"
                ? `Merchant deltas (${year} vs ${year - 1})`
                : state?.kind === "oneOffs"
                  ? `Largest transactions (${year})`
                  : state?.kind === "savingsDecomposition"
                    ? `Savings decomposition (${year} vs ${year - 1})`
                    : "Details"}
          </DialogTitle>
        </DialogHeader>

        {!state ? null : state.kind === "categoryDrivers" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-slate-100 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                <span>Expenses</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!yearlyExpenseCategoryDeltas.length) return;
                    downloadCsv(
                      `reports-yearly-${year}-expense-category-deltas.csv`,
                      yearlyExpenseCategoryDeltas.map((row) => ({
                        category: row.name,
                        delta: row.delta,
                        this_year: row.current,
                        last_year: row.prev,
                        delta_pct: row.deltaPct ?? "",
                      })),
                    );
                  }}
                  disabled={!yearlyExpenseCategoryDeltas.length}
                >
                  Export
                </Button>
              </div>
              <div className="max-h-[26rem] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                      <TableHead className="text-right">This</TableHead>
                      <TableHead className="text-right">YoY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearlyExpenseCategoryDeltas.map((row) => (
                      <TableRow
                        key={`exp-${row.key}`}
                        className={row.id ? "cursor-pointer" : undefined}
                        onClick={() => {
                          if (!row.id) return;
                          onClose();
                          onSelectCategory("expense", row.id);
                        }}
                      >
                        <TableCell className="max-w-[220px] truncate font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <span
                            className={
                              row.delta <= 0
                                ? "text-emerald-700"
                                : "text-rose-700"
                            }
                          >
                            {row.delta >= 0 ? "+" : "−"}
                            {currency(Math.abs(row.delta))}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {currency(row.current)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-600">
                          {row.deltaPct !== null
                            ? `${Math.round(row.deltaPct)}%`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-md border border-slate-100 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                <span>Income</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!yearlyIncomeCategoryDeltas.length) return;
                    downloadCsv(
                      `reports-yearly-${year}-income-category-deltas.csv`,
                      yearlyIncomeCategoryDeltas.map((row) => ({
                        category: row.name,
                        delta: row.delta,
                        this_year: row.current,
                        last_year: row.prev,
                        delta_pct: row.deltaPct ?? "",
                      })),
                    );
                  }}
                  disabled={!yearlyIncomeCategoryDeltas.length}
                >
                  Export
                </Button>
              </div>
              <div className="max-h-[26rem] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                      <TableHead className="text-right">This</TableHead>
                      <TableHead className="text-right">YoY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearlyIncomeCategoryDeltas.map((row) => (
                      <TableRow
                        key={`inc-${row.key}`}
                        className={row.id ? "cursor-pointer" : undefined}
                        onClick={() => {
                          if (!row.id) return;
                          onClose();
                          onSelectCategory("income", row.id);
                        }}
                      >
                        <TableCell className="max-w-[220px] truncate font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <span
                            className={
                              row.delta >= 0
                                ? "text-emerald-700"
                                : "text-rose-700"
                            }
                          >
                            {row.delta >= 0 ? "+" : "−"}
                            {currency(Math.abs(row.delta))}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {currency(row.current)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-600">
                          {row.deltaPct !== null
                            ? `${Math.round(row.deltaPct)}%`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : state.kind === "merchantDrivers" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                Click a row for monthly comparison. Uses transaction
                descriptions, so rename noise as needed.
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={state.flow === "expense" ? "default" : "outline"}
                  onClick={() =>
                    onSetState({ kind: "merchantDrivers", flow: "expense" })
                  }
                >
                  Expense
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={state.flow === "income" ? "default" : "outline"}
                  onClick={() =>
                    onSetState({ kind: "merchantDrivers", flow: "income" })
                  }
                >
                  Income
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const rows =
                      state.flow === "income"
                        ? yearlyIncomeSourceDeltas
                        : yearlyExpenseSourceDeltas;
                    if (!rows.length) return;
                    downloadCsv(
                      `reports-yearly-${year}-${state.flow}-merchant-deltas.csv`,
                      rows.map((row) => ({
                        source: row.source,
                        delta: row.delta,
                        this_year: row.current,
                        last_year: row.prev,
                        delta_pct: row.deltaPct ?? "",
                        tx_count: row.txCount,
                      })),
                    );
                  }}
                  disabled={
                    (state.flow === "income"
                      ? yearlyIncomeSourceDeltas
                      : yearlyExpenseSourceDeltas
                    ).length === 0
                  }
                >
                  Export
                </Button>
              </div>
            </div>

            <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-100 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead className="text-right">This</TableHead>
                    <TableHead className="text-right">Last</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      YoY
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(state.flow === "income"
                    ? yearlyIncomeSourceDeltas
                    : yearlyExpenseSourceDeltas
                  ).map((row) => (
                    <TableRow
                      key={row.source}
                      className="cursor-pointer"
                      onClick={() => {
                        onClose();
                        onOpenYearlySourceDetail(state.flow, row.source);
                      }}
                    >
                      <TableCell className="max-w-[260px] truncate font-medium">
                        {row.source}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <span
                          className={
                            state.flow === "expense"
                              ? row.delta <= 0
                                ? "text-emerald-700"
                                : "text-rose-700"
                              : row.delta >= 0
                                ? "text-emerald-700"
                                : "text-rose-700"
                          }
                        >
                          {row.delta >= 0 ? "+" : "−"}
                          {currency(Math.abs(row.delta))}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {currency(row.current)}
                      </TableCell>
                      <TableCell className="text-right">
                        {currency(row.prev)}
                      </TableCell>
                      <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                        {row.deltaPct !== null
                          ? `${Math.round(row.deltaPct)}%`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : state.kind === "oneOffs" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                Largest expenses captured as individual transactions.
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!overview?.largest_transactions.length) return;
                  downloadCsv(
                    `reports-yearly-${year}-largest-transactions.csv`,
                    overview.largest_transactions.map((row) => ({
                      id: row.id,
                      occurred_at: row.occurred_at,
                      merchant: row.merchant,
                      amount: Number(row.amount),
                      category: row.category_name,
                      notes: row.notes ?? "",
                    })),
                  );
                }}
                disabled={!overview?.largest_transactions.length}
              >
                Export
              </Button>
            </div>

            {!overview ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-100 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Category
                      </TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.largest_transactions.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs text-slate-600">
                          {new Date(row.occurred_at).toLocaleDateString(
                            "sv-SE",
                            {
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                            },
                          )}
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate font-medium">
                          {row.merchant}
                        </TableCell>
                        <TableCell className="hidden max-w-[220px] truncate text-xs text-slate-600 md:table-cell">
                          {row.category_name}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {currency(Number(row.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : state.kind === "savingsDecomposition" ? (
          <div className="space-y-4">
            {!yearlySavingsDecomposition ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      Net delta
                    </p>
                    <p
                      className={
                        yearlySavingsDecomposition.netDelta >= 0
                          ? "text-xl font-semibold text-emerald-700"
                          : "text-xl font-semibold text-rose-700"
                      }
                    >
                      {yearlySavingsDecomposition.netDelta >= 0 ? "+" : "−"}
                      {currency(Math.abs(yearlySavingsDecomposition.netDelta))}
                    </p>
                    <p className="text-xs text-slate-600">
                      {currency(yearlySavingsDecomposition.netPrev)} →{" "}
                      {currency(yearlySavingsDecomposition.netNow)}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-white p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      Income delta
                    </p>
                    <p
                      className={
                        yearlySavingsDecomposition.incomeDelta >= 0
                          ? "text-xl font-semibold text-emerald-700"
                          : "text-xl font-semibold text-rose-700"
                      }
                    >
                      {yearlySavingsDecomposition.incomeDelta >= 0 ? "+" : "−"}
                      {currency(
                        Math.abs(yearlySavingsDecomposition.incomeDelta),
                      )}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-white p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      Expense delta
                    </p>
                    <p
                      className={
                        yearlySavingsDecomposition.expenseDelta <= 0
                          ? "text-xl font-semibold text-emerald-700"
                          : "text-xl font-semibold text-rose-700"
                      }
                    >
                      {yearlySavingsDecomposition.expenseDelta >= 0 ? "+" : "−"}
                      {currency(
                        Math.abs(yearlySavingsDecomposition.expenseDelta),
                      )}
                    </p>
                    <p className="text-xs text-slate-600">
                      (positive means you spent more)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-600">
                    Contributions rank by impact on net delta (income up helps,
                    spend up hurts).
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      downloadCsv(
                        `reports-yearly-${year}-savings-decomposition.csv`,
                        yearlySavingsDecomposition.contributions.map((row) => ({
                          kind: row.kind,
                          name: row.name,
                          contribution: row.contribution,
                        })),
                      );
                    }}
                    disabled={!yearlySavingsDecomposition.contributions.length}
                  >
                    Export
                  </Button>
                </div>

                <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-100 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Driver</TableHead>
                        <TableHead className="hidden md:table-cell">
                          Type
                        </TableHead>
                        <TableHead className="text-right">
                          Contribution
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {yearlySavingsDecomposition.contributions.map((row) => (
                        <TableRow
                          key={`${row.kind}-${row.name}`}
                          className={row.id ? "cursor-pointer" : undefined}
                          onClick={() => {
                            if (!row.id) return;
                            onClose();
                            onSelectCategory(
                              row.kind === "income" ? "income" : "expense",
                              row.id,
                            );
                          }}
                        >
                          <TableCell className="max-w-[260px] truncate font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell className="hidden text-xs text-slate-600 md:table-cell">
                            {row.kind === "income"
                              ? "Income category"
                              : "Expense category"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <span
                              className={
                                row.contribution >= 0
                                  ? "text-emerald-700"
                                  : "text-rose-700"
                              }
                            >
                              {row.contribution >= 0 ? "+" : "−"}
                              {currency(Math.abs(row.contribution))}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
