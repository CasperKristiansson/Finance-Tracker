import React from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/composed/empty-state";
import { LoadingCard } from "@/components/composed/loading-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageRoutes } from "@/data/routes";
import { renderCategoryIcon } from "@/lib/category-icons";
import { currency } from "@/lib/format";
import { TransactionType } from "@/types/api";

type DashboardRecentTransactionCategory = {
  name: string;
  icon?: string | null;
} | null;

export type DashboardRecentTransaction = {
  id: string;
  description: string;
  amount: number;
  occurred_at: string;
  accountLabel: string;
  category: DashboardRecentTransactionCategory;
  type: TransactionType;
  typeLabel: string;
};

type RecentTransactionsCardProps = {
  loading: boolean;
  transactions: DashboardRecentTransaction[];
  tab: "all" | "income" | "expense";
  onTabChange: (tab: "all" | "income" | "expense") => void;
};

export const RecentTransactionsCard: React.FC<RecentTransactionsCardProps> = ({
  loading,
  transactions,
  tab,
  onTabChange,
}) => (
  <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.25)]">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
      <div>
        <CardTitle className="text-base font-semibold text-slate-900">
          Recent transactions
        </CardTitle>
        <p className="text-xs text-slate-500">
          Latest activity across tracked accounts
        </p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as typeof tab)}
        className="w-auto"
      >
        <TabsList className="bg-slate-100">
          <TabsTrigger value="all" className="cursor-pointer">
            All
          </TabsTrigger>
          <TabsTrigger value="income" className="cursor-pointer">
            Income
          </TabsTrigger>
          <TabsTrigger value="expense" className="cursor-pointer">
            Expense
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </CardHeader>
    <CardContent className="space-y-2">
      {loading ? (
        <LoadingCard lines={4} />
      ) : transactions.length === 0 ? (
        <EmptyState
          title="No recent transactions yet."
          description="Import files or add activity to see your latest account movements."
          action={
            <Button asChild variant="outline" className="border-slate-200">
              <Link to={PageRoutes.transactions}>Open transactions</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.4)]"
            >
              <div className="grid w-full items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] sm:items-center sm:gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {tx.description}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>
                      {new Date(tx.occurred_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="truncate">{tx.accountLabel}</span>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2 sm:flex-nowrap sm:justify-end">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      tx.type === TransactionType.TRANSFER
                        ? "bg-slate-100 text-slate-700"
                        : tx.amount >= 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {tx.typeLabel}
                  </span>

                  {tx.type === TransactionType.TRANSFER ? null : tx.category ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {renderCategoryIcon(
                        tx.category.icon ?? null,
                        tx.category.name,
                        tx.category.icon?.startsWith("lucide:")
                          ? "h-4 w-4 text-slate-700"
                          : "text-sm leading-none",
                      )}
                      <span className="max-w-44 truncate">
                        {tx.category.name}
                      </span>
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      Unassigned
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  {tx.type === TransactionType.TRANSFER ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {currency(Math.abs(tx.amount))}
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        tx.amount >= 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {tx.amount >= 0 ? "+" : "-"}
                      {currency(Math.abs(tx.amount))}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);
