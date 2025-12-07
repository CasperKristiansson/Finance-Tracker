/* eslint-disable react/prop-types */
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Eye,
  Filter,
  Layers,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MotionPage } from "@/components/motion-presets";
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
import { cn } from "@/lib/utils";
import { TransactionStatus, type CategoryRead } from "@/types/api";
import TransactionModal from "./transaction-modal";

type SortKey = "date" | "description" | "amount" | "status" | "category";

type ColumnKey =
  | "select"
  | "date"
  | "description"
  | "accounts"
  | "category"
  | "amount"
  | "status"
  | "notes";

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  align?: "left" | "right";
};

const columns: ColumnConfig[] = [
  { key: "select", label: "" },
  { key: "date", label: "Date" },
  { key: "description", label: "Payee / Description" },
  { key: "accounts", label: "Account" },
  { key: "category", label: "Category" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes" },
];

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const statusTone: Record<TransactionStatus, string> = {
  [TransactionStatus.RECORDED]: "bg-slate-100 text-slate-700",
  [TransactionStatus.IMPORTED]: "bg-amber-100 text-amber-800",
  [TransactionStatus.REVIEWED]: "bg-emerald-100 text-emerald-800",
  [TransactionStatus.FLAGGED]: "bg-rose-100 text-rose-800",
};

const badge = (status: TransactionStatus) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
      statusTone[status],
    )}
  >
    {status.charAt(0).toUpperCase() + status.slice(1)}
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
        {columns
          .filter((col) => col.key !== "select")
          .map((col) => (
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
  const {
    items,
    loading,
    error,
    pagination,
    runningBalances,
    fetchTransactions,
    updateTransaction,
    updateTransactionStatus,
    deleteTransaction,
  } = useTransactionsApi();
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<
    Record<ColumnKey, boolean>
  >({
    select: true,
    date: true,
    description: true,
    accounts: true,
    category: true,
    amount: true,
    status: true,
    notes: true,
  });
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [accountFilter, setAccountFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const needsReconcile = useMemo(
    () => accounts.some((acc) => acc.needs_reconciliation),
    [accounts],
  );

  useEffect(() => {
    fetchTransactions({ limit: pagination.limit, offset: 0 });
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
        status: statusFilter ? [statusFilter] : undefined,
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
    statusFilter,
    search,
    minAmount,
    maxAmount,
    startDate,
    endDate,
  ]);

  const accountLookup = useMemo(
    () =>
      Object.fromEntries(
        accounts.map((acc) => [
          acc.id,
          `${acc.account_type} • ${acc.id.slice(0, 6)}`,
        ]),
      ),
    [accounts],
  );
  const categoryLookup = useMemo(
    () =>
      new Map<string, string>(
        categories?.map((c: CategoryRead) => [
          c.id,
          `${c.icon ? `${c.icon} ` : ""}${c.name}`,
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
        if (sortKey === "status") {
          return a.status.localeCompare(b.status) * direction;
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
    estimateSize: () => 64,
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

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map((tx) => tx.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const applyBulkCategory = () => {
    if (!bulkCategory || selectedIds.size === 0) return;
    selectedIds.forEach((id) =>
      updateTransaction(id, { category_id: bulkCategory }),
    );
  };

  const applyBulkStatus = (status: TransactionStatus) => {
    selectedIds.forEach((id) => updateTransactionStatus(id, status));
  };

  const applyBulkDelete = () => {
    selectedIds.forEach((id) => deleteTransaction(id));
    setSelectedIds(new Set());
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

  return (
    <MotionPage className="space-y-4">
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
          <div>
            <div className="font-semibold">Accounts need reconciliation</div>
            <p className="text-amber-800">
              Balances may be stale. Reconcile from Accounts to keep running
              balances accurate.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Layers className="h-4 w-4 text-slate-500" />
            <div className="flex items-center gap-2 text-xs text-slate-600">
              {Object.entries(runningBalances).map(([accountId, balance]) => (
                <span
                  key={accountId}
                  className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-800"
                >
                  {accountLookup[accountId] || accountId.slice(0, 6)}:{" "}
                  {formatCurrency(balance)}
                </span>
              ))}
              {Object.keys(runningBalances).length === 0
                ? "No balances yet"
                : null}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm shadow-[0_6px_16px_-12px_rgba(15,23,42,0.3)]">
              <Filter className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                className="rounded border border-slate-200 px-2 py-1 text-slate-800"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                className="rounded border border-slate-200 px-2 py-1 text-slate-800"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <input
                type="search"
                placeholder="Search description"
                className="w-48 rounded border border-slate-200 px-3 py-1 text-slate-800"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-800"
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
                className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-800"
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
              <select
                className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-800"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All status</option>
                {Object.values(TransactionStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Min"
                className="w-24 rounded border border-slate-200 px-2 py-1 text-slate-800"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Max"
                className="w-24 rounded border border-slate-200 px-2 py-1 text-slate-800"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              ) : null}
            </div>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="text-slate-600">Bulk:</span>
              <select
                className="bg-transparent text-slate-800 outline-none"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
              >
                <option value="">Categorize...</option>
                {categories?.map((cat: CategoryRead) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="secondary"
                onClick={applyBulkCategory}
                disabled={!bulkCategory || selectedIds.size === 0}
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyBulkStatus(TransactionStatus.REVIEWED)}
                disabled={selectedIds.size === 0}
              >
                Mark reviewed
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyBulkStatus(TransactionStatus.FLAGGED)}
                disabled={selectedIds.size === 0}
              >
                Flag
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={applyBulkDelete}
                disabled={selectedIds.size === 0}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={parentRef} className="h-[640px] overflow-auto">
            <table className="w-full min-w-max table-fixed text-sm">
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
                    <th
                      key={col.key}
                      className={cn(
                        "px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase",
                        col.align === "right" && "text-right",
                      )}
                    >
                      {col.key === "select" ? (
                        <input
                          type="checkbox"
                          checked={
                            selectedIds.size === filtered.length &&
                            filtered.length > 0
                          }
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                      ) : (
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
                      )}
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
                  const amount = row.legs.reduce(
                    (sum, leg) => sum + Number(leg.amount),
                    0,
                  );
                  const accountsLabel = row.legs
                    .map(
                      (leg) =>
                        `${accountLookup[leg.account_id] || leg.account_id.slice(0, 6)} (${Number(leg.amount) >= 0 ? "+" : ""}${Number(leg.amount).toFixed(2)})`,
                    )
                    .join(", ");

                  return (
                    <tr
                      key={row.id}
                      data-index={virtualRow.index}
                      className="border-b hover:bg-slate-50"
                      style={{
                        position: "absolute",
                        transform: `translateY(${virtualRow.start}px)`,
                        width: "100%",
                        display: "table",
                        tableLayout: "fixed",
                      }}
                    >
                      {visibleColumns.map((col) => {
                        if (col.key === "select") {
                          return (
                            <td key={`${row.id}-select`} className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(row.id)}
                                onChange={() => toggleRow(row.id)}
                              />
                            </td>
                          );
                        }
                        if (col.key === "date") {
                          return (
                            <td key={`${row.id}-date`} className="px-3 py-2">
                              <div className="text-sm font-medium text-slate-900">
                                {formatDate(row.occurred_at)}
                              </div>
                              <div className="text-xs text-slate-500">
                                {row.external_id || ""}
                              </div>
                            </td>
                          );
                        }
                        if (col.key === "description") {
                          return (
                            <td key={`${row.id}-desc`} className="px-3 py-2">
                              <div className="font-semibold text-slate-900">
                                {row.description || "(No description)"}
                              </div>
                              <div className="text-xs text-slate-500">
                                {row.notes || ""}
                              </div>
                            </td>
                          );
                        }
                        if (col.key === "accounts") {
                          return (
                            <td
                              key={`${row.id}-accounts`}
                              className="px-3 py-2 text-slate-700"
                            >
                              {accountsLabel}
                            </td>
                          );
                        }
                        if (col.key === "category") {
                          return (
                            <td
                              key={`${row.id}-category`}
                              className="px-3 py-2 text-slate-700"
                            >
                              {row.category_id
                                ? categoryLookup.get(row.category_id) ||
                                  "Assigned"
                                : "Unassigned"}
                            </td>
                          );
                        }
                        if (col.key === "amount") {
                          return (
                            <td
                              key={`${row.id}-amount`}
                              className="px-3 py-2 text-right font-semibold text-slate-900"
                            >
                              {formatCurrency(amount)}
                            </td>
                          );
                        }
                        if (col.key === "status") {
                          return (
                            <td key={`${row.id}-status`} className="px-3 py-2">
                              {badge(row.status)}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={`${row.id}-notes`}
                            className="px-3 py-2 text-slate-600"
                          >
                            {row.notes || ""}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  selectedIds.size === filtered.length && filtered.length > 0
                }
                onChange={(e) => toggleSelectAll(e.target.checked)}
              />
              <span>{selectedIds.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
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
