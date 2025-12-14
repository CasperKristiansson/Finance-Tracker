/* eslint-disable react/prop-types */
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Eye,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  AlertCircle,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MotionPage } from "@/components/motion-presets";
import { ReconcileAccountsDialog } from "@/components/reconcile-accounts-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useAccountsApi,
  useCategoriesApi,
  useTransactionsApi,
} from "@/hooks/use-api";
import { formatCategoryLabel } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import { TransactionType, type CategoryRead } from "@/types/api";
import TransactionModal from "./transaction-modal";

type SortKey = "date" | "description" | "amount" | "category" | "type";

type ColumnKey =
  | "date"
  | "type"
  | "description"
  | "accounts"
  | "category"
  | "amount"
  | "notes";

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  align?: "left" | "right";
};

const columns: ColumnConfig[] = [
  { key: "date", label: "Date" },
  { key: "type", label: "Type" },
  { key: "description", label: "Payee / Description" },
  { key: "accounts", label: "Account" },
  { key: "category", label: "Category" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "notes", label: "Notes" },
];

const columnWidthClass: Partial<Record<ColumnKey, string>> = {
  date: "w-40",
  type: "w-28",
  accounts: "w-72",
  category: "w-48",
  amount: "w-36",
  notes: "w-56",
};

const formatCurrency = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const typeTone: Record<TransactionType, string> = {
  [TransactionType.INCOME]: "bg-emerald-100 text-emerald-800",
  [TransactionType.EXPENSE]: "bg-rose-100 text-rose-800",
  [TransactionType.TRANSFER]: "bg-slate-100 text-slate-700",
  [TransactionType.ADJUSTMENT]: "bg-amber-100 text-amber-800",
  [TransactionType.INVESTMENT_EVENT]: "bg-indigo-100 text-indigo-800",
};

const typeLabel: Record<TransactionType, string> = {
  [TransactionType.INCOME]: "Income",
  [TransactionType.EXPENSE]: "Expense",
  [TransactionType.TRANSFER]: "Transfer",
  [TransactionType.ADJUSTMENT]: "Adjustment",
  [TransactionType.INVESTMENT_EVENT]: "Investment",
};

const typeBadge = (type: TransactionType) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs leading-none font-medium",
      typeTone[type],
    )}
  >
    {typeLabel[type] ?? type}
  </span>
);

const ColumnToggle: React.FC<{
  visibility: Record<ColumnKey, boolean>;
  onToggle: (key: ColumnKey) => void;
}> = ({ visibility, onToggle }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-slate-300 text-slate-700"
        >
          <Eye className="h-4 w-4" /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Show / hide</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={visibility[col.key] !== false}
            onCheckedChange={() => onToggle(col.key)}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Transactions: React.FC = () => {
  const location = useLocation();
  const { items, loading, error, pagination, fetchTransactions } =
    useTransactionsApi();
  const {
    items: accounts,
    fetchAccounts,
    reconcileAccounts,
    reconcileLoading,
    reconcileError,
  } = useAccountsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<
    Record<ColumnKey, boolean>
  >({
    date: true,
    type: true,
    description: true,
    accounts: true,
    category: true,
    amount: true,
    notes: false,
  });
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [accountFilter, setAccountFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const needsReconcile = useMemo(
    () => accounts.some((acc) => acc.needs_reconciliation),
    [accounts],
  );
  const reconcileTargets = useMemo(
    () => accounts.filter((acc) => acc.needs_reconciliation),
    [accounts],
  );

  useEffect(() => {
    const urlSearch = new URLSearchParams(location.search).get("search") ?? "";
    if (urlSearch) {
      setSearch(urlSearch);
    }
    fetchTransactions({
      limit: pagination.limit,
      offset: 0,
      search: urlSearch || undefined,
    });
    fetchAccounts({});
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchTransactions({
        limit: pagination.limit,
        offset: 0,
        accountIds: accountFilter ? [accountFilter] : undefined,
        categoryIds: categoryFilter ? [categoryFilter] : undefined,
        search: search || undefined,
        minAmount: minAmount || undefined,
        maxAmount: maxAmount || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
    }, 250);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accountFilter,
    categoryFilter,
    search,
    minAmount,
    maxAmount,
    startDate,
    endDate,
  ]);

  const accountLookup = useMemo(
    () => Object.fromEntries(accounts.map((acc) => [acc.id, acc.name])),
    [accounts],
  );
  const categoryLookup = useMemo(
    () =>
      new Map<string, string>(
        categories?.map((c: CategoryRead) => [
          c.id,
          formatCategoryLabel(c.name, c.icon),
        ]) ?? [],
      ),
    [categories],
  );

  const filtered = useMemo(() => {
    return items
      .filter((tx) => {
        const categoryMatch = categoryFilter
          ? tx.category_id === categoryFilter
          : true;
        const accountMatch =
          accountFilter === ""
            ? true
            : tx.legs.some((leg) => leg.account_id === accountFilter);
        return categoryMatch && accountMatch;
      })
      .sort((a, b) => {
        const direction = sortAsc ? 1 : -1;
        if (sortKey === "date") {
          return (
            (new Date(a.occurred_at).getTime() -
              new Date(b.occurred_at).getTime()) *
            direction
          );
        }
        if (sortKey === "amount") {
          const aSum = a.legs.reduce((sum, leg) => sum + Number(leg.amount), 0);
          const bSum = b.legs.reduce((sum, leg) => sum + Number(leg.amount), 0);
          return (aSum - bSum) * direction;
        }
        if (sortKey === "type") {
          return (
            a.transaction_type.localeCompare(b.transaction_type) * direction
          );
        }
        if (sortKey === "category") {
          return (
            (categoryLookup.get(a.category_id || "") || "").localeCompare(
              categoryLookup.get(b.category_id || "") || "",
            ) * direction
          );
        }
        return (
          (a.description || "").localeCompare(b.description || "") * direction
        );
      });
  }, [items, categoryFilter, accountFilter, sortKey, sortAsc, categoryLookup]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const loadMore = () => {
    if (!pagination.hasMore || loading) return;
    fetchTransactions({
      offset: pagination.offset + pagination.limit,
      limit: pagination.limit,
    });
  };

  const visibleColumns = columns.filter(
    (col) => columnVisibility[col.key] !== false,
  );

  const headerCellClass = (col: ColumnConfig) =>
    cn(
      "py-1.5 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase",
      "px-3",
      columnWidthClass[col.key],
      col.align === "right" && "text-right",
    );

  const bodyCellClass = (key: ColumnKey, extra?: string) =>
    cn("py-1 align-middle", "px-3", columnWidthClass[key], extra);

  return (
    <MotionPage className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Transactions
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Activity and ledger
          </h1>
          <p className="text-sm text-slate-500">
            Virtualized list with bulk actions, column controls, and running
            balances.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ColumnToggle
            visibility={columnVisibility}
            onToggle={(key) =>
              setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
            }
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-slate-300 text-slate-700"
            onClick={() =>
              fetchTransactions({ limit: pagination.limit, offset: 0 })
            }
          >
            <RefreshIcon className="h-4 w-4" /> Refresh
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add transaction
          </Button>
        </div>
      </div>

      {needsReconcile ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 shadow-[0_8px_24px_-20px_rgba(146,64,14,0.45)]">
          <AlertCircle className="mt-0.5 h-5 w-5" />
          <div className="flex-1">
            <div className="font-semibold">Accounts need reconciliation</div>
            <p className="text-amber-800">
              Balances may be stale. Reconcile to keep running balances
              accurate.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-2 border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
            onClick={() => setReconcileOpen(true)}
            disabled={reconcileLoading}
          >
            {reconcileLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Reconcile
          </Button>
        </div>
      ) : null}

      <ReconcileAccountsDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        accounts={accounts}
        targets={reconcileTargets}
        mode="targets"
        loading={reconcileLoading}
        error={reconcileError}
        description="Reconciled from Transactions"
        onReconcile={reconcileAccounts}
        onSuccess={() =>
          fetchTransactions({
            limit: pagination.limit,
            offset: 0,
            accountIds: accountFilter ? [accountFilter] : undefined,
            categoryIds: categoryFilter ? [categoryFilter] : undefined,
            search: search || undefined,
            minAmount: minAmount || undefined,
            maxAmount: maxAmount || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          })
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col gap-0 border-slate-200 py-2 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
        <CardHeader className="flex shrink-0 flex-col gap-2 pb-2">
          <div className="flex flex-col gap-2">
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[13px] shadow-[0_6px_16px_-12px_rgba(15,23,42,0.3)]">
              <Filter className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                className="h-8 rounded border border-slate-200 px-2 text-slate-800"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                className="h-8 rounded border border-slate-200 px-2 text-slate-800"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <input
                type="search"
                placeholder="Search description"
                className="h-8 w-48 rounded border border-slate-200 px-3 text-slate-800"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="h-8 rounded border border-slate-200 bg-white px-2 text-slate-800"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
              >
                <option value="">All accounts</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {accountLookup[acc.id]}
                  </option>
                ))}
              </select>
              <select
                className="h-8 rounded border border-slate-200 bg-white px-2 text-slate-800"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All categories</option>
                {categories?.map((cat: CategoryRead) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Min"
                className="h-8 w-24 rounded border border-slate-200 px-2 text-slate-800"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Max"
                className="h-8 w-24 rounded border border-slate-200 px-2 text-slate-800"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div
            ref={parentRef}
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
          >
            <table className="w-full table-fixed text-[13px]">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                <tr
                  className="border-b"
                  style={{
                    display: "table",
                    tableLayout: "fixed",
                    width: "100%",
                  }}
                >
                  {visibleColumns.map((col) => (
                    <th key={col.key} className={headerCellClass(col)}>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-slate-700"
                        onClick={() => toggleSort(col.key as SortKey)}
                      >
                        {col.label}
                        {sortKey === col.key ? (
                          sortAsc ? (
                            <ArrowUpWideNarrow className="h-3 w-3" />
                          ) : (
                            <ArrowDownWideNarrow className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody
                style={{
                  position: "relative",
                  display: "block",
                  height: rowVirtualizer.getTotalSize(),
                  width: "100%",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = filtered[virtualRow.index];
                  if (!row) return null;
                  const knownLegs = row.legs.filter((leg) =>
                    Boolean(accountLookup[leg.account_id]),
                  );
                  const displayAmount = (() => {
                    if (accountFilter) {
                      return knownLegs
                        .filter((leg) => leg.account_id === accountFilter)
                        .reduce((sum, leg) => sum + Number(leg.amount), 0);
                    }

                    const sumKnown = knownLegs.reduce(
                      (sum, leg) => sum + Number(leg.amount),
                      0,
                    );
                    if (sumKnown !== 0) return sumKnown;

                    const largest = knownLegs.reduce<null | { amount: number }>(
                      (best, leg) => {
                        const numeric = Number(leg.amount);
                        if (!best) return { amount: numeric };
                        return Math.abs(numeric) > Math.abs(best.amount)
                          ? { amount: numeric }
                          : best;
                      },
                      null,
                    );
                    return largest ? Math.abs(largest.amount) : 0;
                  })();

                  const accountsLabel = (() => {
                    if (row.transaction_type === TransactionType.TRANSFER) {
                      const fromLeg =
                        knownLegs.find((leg) => Number(leg.amount) < 0) ??
                        knownLegs[0];
                      const toLeg =
                        knownLegs.find((leg) => Number(leg.amount) > 0) ??
                        knownLegs[1];

                      const fromName = fromLeg
                        ? accountLookup[fromLeg.account_id]
                        : undefined;
                      const toName = toLeg
                        ? accountLookup[toLeg.account_id]
                        : undefined;

                      if (fromName && toName) return `${fromName} → ${toName}`;
                      if (fromName) return `${fromName} → (unknown)`;
                      if (toName) return `(unknown) → ${toName}`;
                      return "Internal transfer";
                    }

                    const primary = knownLegs[0];
                    if (!primary) return "Internal transfer";
                    return (
                      accountLookup[primary.account_id] ?? "Internal transfer"
                    );
                  })();

                  return (
                    <tr
                      key={row.id}
                      data-index={virtualRow.index}
                      className="border-b hover:bg-slate-50"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        transform: `translateY(${virtualRow.start}px)`,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        display: "table",
                        tableLayout: "fixed",
                      }}
                    >
                      {visibleColumns.map((col) => {
                        if (col.key === "date") {
                          return (
                            <td
                              key={`${row.id}-date`}
                              className={bodyCellClass("date")}
                            >
                              <div className="text-[13px] leading-none font-medium text-slate-900">
                                {formatDate(row.occurred_at)}
                              </div>
                            </td>
                          );
                        }
                        if (col.key === "type") {
                          return (
                            <td
                              key={`${row.id}-type`}
                              className={bodyCellClass("type")}
                            >
                              {typeBadge(row.transaction_type)}
                            </td>
                          );
                        }
                        if (col.key === "description") {
                          return (
                            <td
                              key={`${row.id}-desc`}
                              className={bodyCellClass(
                                "description",
                                "min-w-0",
                              )}
                            >
                              <div className="truncate leading-none font-semibold text-slate-900">
                                {row.description || "(No description)"}
                              </div>
                            </td>
                          );
                        }
                        if (col.key === "accounts") {
                          return (
                            <td
                              key={`${row.id}-accounts`}
                              className={bodyCellClass(
                                "accounts",
                                "min-w-0 text-slate-700",
                              )}
                            >
                              <div className="truncate">{accountsLabel}</div>
                            </td>
                          );
                        }
                        if (col.key === "category") {
                          return (
                            <td
                              key={`${row.id}-category`}
                              className={bodyCellClass(
                                "category",
                                "min-w-0 text-slate-700",
                              )}
                            >
                              <div className="truncate">
                                {row.transaction_type ===
                                TransactionType.TRANSFER
                                  ? "—"
                                  : row.category_id
                                    ? categoryLookup.get(row.category_id) ||
                                      "Assigned"
                                    : "Unassigned"}
                              </div>
                            </td>
                          );
                        }
                        if (col.key === "amount") {
                          return (
                            <td
                              key={`${row.id}-amount`}
                              className={bodyCellClass(
                                "amount",
                                "text-right font-semibold text-slate-900",
                              )}
                            >
                              {formatCurrency(displayAmount)}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={`${row.id}-notes`}
                            className={bodyCellClass(
                              "notes",
                              "min-w-0 text-slate-600",
                            )}
                          >
                            <div className="truncate">{row.notes || ""}</div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end border-t bg-white px-3 py-1.5 text-xs text-slate-600">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-slate-300 text-slate-700"
              onClick={loadMore}
              disabled={!pagination.hasMore || loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
              {pagination.hasMore ? "Load more" : "End of list"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </MotionPage>
  );
};

const RefreshIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("h-4 w-4", props.className)}
  >
    <path d="M21 2v6h-6" />
    <path d="M3 13v-6h6" />
    <path d="M21 13a9 9 0 0 1-15 6l-3-3" />
    <path d="M3 11a9 9 0 0 1 15-6l3 3" />
  </svg>
);

export default Transactions;

/* eslint-enable react/prop-types */
