/* eslint-disable react/prop-types */
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Calendar,
  Eye,
  Filter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Tag,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useAccountsApi,
  useCategoriesApi,
  useTransactionsApi,
} from "@/hooks/use-api";
import { formatCategoryLabel } from "@/lib/category-icons";
import { currency, formatDate as formatDateLabel } from "@/lib/format";
import {
  getDisplayTransactionType,
  getTransactionBadge,
  isTaxEvent,
  taxAdjustedAmountHint,
} from "@/lib/transactions";
import { cn } from "@/lib/utils";
import {
  TransactionType,
  type CategoryRead,
  type TransactionRead,
} from "@/types/api";
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

const sortableColumnKey: Partial<Record<ColumnKey, SortKey>> = {
  date: "date",
  type: "type",
  description: "description",
  category: "category",
  amount: "amount",
};

const columnWidthClass: Partial<Record<ColumnKey, string>> = {
  date: "w-40",
  type: "w-28",
  accounts: "w-72",
  category: "w-48",
  amount: "w-36",
  notes: "w-56",
};

const transactionTypeOptions: Array<{ value: TransactionType; label: string }> =
  [
    { value: TransactionType.INCOME, label: "Income" },
    { value: TransactionType.EXPENSE, label: "Expense" },
    { value: TransactionType.TRANSFER, label: "Transfer" },
    { value: TransactionType.ADJUSTMENT, label: "Adjustment" },
  ];

const formatCurrency = (value: number) =>
  currency(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso?: string) =>
  iso
    ? formatDateLabel(iso, { month: "short", day: "numeric", year: "numeric" })
    : "—";

const normalizeMerchantKey = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .replace(/\d+/g, " ")
    .replace(/[^\p{L}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const transactionAmountHint = (
  tx: Pick<TransactionRead, "transaction_type" | "tax_event" | "legs">,
) => taxAdjustedAmountHint(tx);

const typeBadge = (
  tx: Pick<TransactionRead, "transaction_type" | "tax_event">,
) => {
  const { label, toneClass } = getTransactionBadge(tx);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs leading-none font-medium",
        toneClass,
      )}
    >
      {label}
    </span>
  );
};

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
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<
    TransactionType | ""
  >("");
  const [search, setSearch] = useState<string>("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTransaction, setModalTransaction] = useState<
    (typeof items)[number] | null
  >(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
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
      sortBy: "occurred_at",
      sortDir: sortAsc ? "asc" : "desc",
    });
    fetchAccounts({});
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      const sortBy =
        sortKey === "date"
          ? "occurred_at"
          : sortKey === "amount"
            ? "amount"
            : sortKey === "description"
              ? "description"
              : sortKey === "category"
                ? "category"
                : "type";

      fetchTransactions({
        limit: pagination.limit,
        offset: 0,
        transactionTypes: transactionTypeFilter
          ? [transactionTypeFilter]
          : undefined,
        accountIds: accountFilter ? [accountFilter] : undefined,
        categoryIds: categoryFilter ? [categoryFilter] : undefined,
        search: search || undefined,
        minAmount: minAmount || undefined,
        maxAmount: maxAmount || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortDir: sortAsc ? "asc" : "desc",
      });
    }, 250);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accountFilter,
    categoryFilter,
    transactionTypeFilter,
    search,
    minAmount,
    maxAmount,
    startDate,
    endDate,
    sortKey,
    sortAsc,
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

  const selectedTransaction = useMemo(
    () =>
      detailsId ? (items.find((tx) => tx.id === detailsId) ?? null) : null,
    [detailsId, items],
  );
  const selectedDisplayType = selectedTransaction
    ? getDisplayTransactionType(selectedTransaction)
    : null;
  const selectedIsTax = selectedTransaction
    ? isTaxEvent(selectedTransaction)
    : false;

  const openCreateModal = () => {
    setModalTransaction(null);
    setModalOpen(true);
  };

  const openEditModal = (tx: (typeof items)[number]) => {
    setModalTransaction(tx);
    setModalOpen(true);
  };

  const closeDetails = () => setDetailsId(null);

  const openDetails = (id: string) => setDetailsId(id);

  useEffect(() => {
    if (detailsId && !selectedTransaction) setDetailsId(null);
  }, [detailsId, selectedTransaction]);

  const rows = items;

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
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
          <Button size="sm" className="gap-2" onClick={openCreateModal}>
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
            transactionTypes: transactionTypeFilter
              ? [transactionTypeFilter]
              : undefined,
            categoryIds: categoryFilter ? [categoryFilter] : undefined,
            search: search || undefined,
            minAmount: minAmount || undefined,
            maxAmount: maxAmount || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          })
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col gap-0 border-slate-200 py-0 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
        <CardHeader className="flex shrink-0 flex-col gap-2 pt-2 pb-2">
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
              <select
                className="h-8 rounded border border-slate-200 bg-white px-2 text-slate-800"
                value={transactionTypeFilter}
                onChange={(e) =>
                  setTransactionTypeFilter(
                    e.target.value as TransactionType | "",
                  )
                }
              >
                <option value="">All types</option>
                {transactionTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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
                      {sortableColumnKey[col.key] ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-slate-700"
                          onClick={() =>
                            toggleSort(sortableColumnKey[col.key] as SortKey)
                          }
                        >
                          {col.label}
                          {sortKey === sortableColumnKey[col.key] ? (
                            sortAsc ? (
                              <ArrowUpWideNarrow className="h-3 w-3" />
                            ) : (
                              <ArrowDownWideNarrow className="h-3 w-3" />
                            )
                          ) : null}
                        </button>
                      ) : (
                        <span className="text-slate-700">{col.label}</span>
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
                  const row = rows[virtualRow.index];
                  if (!row) return null;
                  const displayType = getDisplayTransactionType(row);
                  const taxLinked = isTaxEvent(row);
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
                    if (
                      displayType === TransactionType.TRANSFER &&
                      !taxLinked
                    ) {
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
                      className="cursor-pointer border-b hover:bg-slate-50"
                      onClick={() => openDetails(row.id)}
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
                              {typeBadge(row)}
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
                                {displayType === TransactionType.TRANSFER &&
                                !taxLinked
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
      <Sheet
        open={Boolean(detailsId)}
        onOpenChange={(open) => {
          if (!open) closeDetails();
        }}
      >
        <SheetContent side="right" className="bg-white sm:max-w-lg">
          {selectedTransaction ? (
            <>
              <SheetHeader className="border-b border-slate-100">
                <SheetTitle className="truncate text-lg">
                  {selectedTransaction.description || "(No description)"}
                </SheetTitle>
                <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(selectedTransaction.occurred_at)}
                  </span>
                  {selectedDisplayType !== TransactionType.TRANSFER ||
                  selectedIsTax ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      <Tag className="h-3.5 w-3.5" />
                      {selectedTransaction.category_id
                        ? categoryLookup.get(selectedTransaction.category_id) ||
                          "Assigned"
                        : "Unassigned"}
                    </span>
                  ) : null}
                </SheetDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      closeDetails();
                      openEditModal(selectedTransaction);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="text-xs text-slate-500">Type</div>
                    <div className="mt-1">{typeBadge(selectedTransaction)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-white p-3 text-right">
                    <div className="text-xs text-slate-500">Amount (hint)</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(
                        transactionAmountHint(selectedTransaction),
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Occurred</div>
                      <div className="mt-1 font-medium text-slate-900">
                        {formatDate(selectedTransaction.occurred_at)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Posted</div>
                      <div className="mt-1 font-medium text-slate-900">
                        {formatDate(selectedTransaction.posted_at)}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-slate-500">ID</div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-700">
                        {selectedTransaction.id}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedTransaction.notes ? (
                  <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="text-xs text-slate-500">Notes</div>
                    <div className="mt-1 text-sm whitespace-pre-wrap text-slate-800">
                      {selectedTransaction.notes}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="text-xs text-slate-500">Legs</div>
                  <div className="mt-2 space-y-1.5">
                    {selectedTransaction.legs.map((leg) => {
                      const amt = Number(leg.amount);
                      const tone =
                        amt > 0
                          ? "text-emerald-700"
                          : amt < 0
                            ? "text-rose-700"
                            : "text-slate-700";
                      return (
                        <div
                          key={leg.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
                        >
                          <div className="min-w-0 truncate text-sm text-slate-800">
                            {accountLookup[leg.account_id] ?? leg.account_id}
                          </div>
                          <div
                            className={cn(
                              "shrink-0 text-sm font-semibold tabular-nums",
                              tone,
                            )}
                          >
                            {formatCurrency(amt)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  const merchantKey = normalizeMerchantKey(
                    selectedTransaction.description,
                  );
                  const similarByMerchant = merchantKey
                    ? items
                        .filter((tx) => tx.id !== selectedTransaction.id)
                        .filter((tx) => {
                          const key = normalizeMerchantKey(tx.description);
                          if (!key) return false;
                          return (
                            key === merchantKey ||
                            key.includes(merchantKey) ||
                            merchantKey.includes(key)
                          );
                        })
                        .sort(
                          (a, b) =>
                            new Date(b.occurred_at).getTime() -
                            new Date(a.occurred_at).getTime(),
                        )
                        .slice(0, 8)
                    : [];

                  const similarByCategory =
                    selectedTransaction.category_id &&
                    selectedDisplayType !== TransactionType.TRANSFER
                      ? items
                          .filter((tx) => tx.id !== selectedTransaction.id)
                          .filter(
                            (tx) =>
                              tx.category_id ===
                              selectedTransaction.category_id,
                          )
                          .sort(
                            (a, b) =>
                              new Date(b.occurred_at).getTime() -
                              new Date(a.occurred_at).getTime(),
                          )
                          .slice(0, 8)
                      : [];

                  const renderSimilar = (tx: (typeof items)[number]) => (
                    <button
                      key={tx.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 rounded-md border border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                      onClick={() => openDetails(tx.id)}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {tx.description || "(No description)"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDate(tx.occurred_at)} • {tx.transaction_type}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(transactionAmountHint(tx))}
                      </div>
                    </button>
                  );

                  return (
                    <div className="grid gap-4">
                      <div className="rounded-lg border border-slate-100 bg-white p-3">
                        <div className="mb-2 text-sm font-semibold text-slate-900">
                          Similar merchant
                        </div>
                        {similarByMerchant.length ? (
                          <div className="space-y-2">
                            {similarByMerchant.map(renderSimilar)}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500">
                            No similar transactions found in the current list.
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-slate-100 bg-white p-3">
                        <div className="mb-2 text-sm font-semibold text-slate-900">
                          Same category
                        </div>
                        {similarByCategory.length ? (
                          <div className="space-y-2">
                            {similarByCategory.map(renderSimilar)}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500">
                            No same-category transactions found in the current
                            list.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          ) : (
            <div className="p-4 text-sm text-slate-500">
              Select a transaction to see details.
            </div>
          )}
        </SheetContent>
      </Sheet>

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        transaction={modalTransaction}
      />
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
