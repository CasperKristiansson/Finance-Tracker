import { Archive, Loader2, Plus, RefreshCw, Undo } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAppSelector } from "@/app/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountsApi } from "@/hooks/use-api";
import { AccountType } from "@/types/api";
import { PageRoutes } from "@/data/routes";
import { AccountModal } from "./children/account-modal";

type SortKey = "name" | "type" | "status" | "balance";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);

const formatAccountType = (type: AccountType) => {
  switch (type) {
    case AccountType.DEBT:
      return "Debt";
    case AccountType.INVESTMENT:
      return "Investment";
    default:
      return "Cash";
  }
};

export const Accounts: React.FC = () => {
  const {
    items,
    loading,
    includeInactive,
    asOfDate,
    fetchAccounts,
    archiveAccount,
    updateAccount,
  } = useAccountsApi();
  const [asOfInput, setAsOfInput] = useState<string>(asOfDate ?? "");
  const [showInactive, setShowInactive] = useState(includeInactive);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    fetchAccounts({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalBalance = useMemo(() => {
    return items.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
  }, [items]);

  const activeCount = useMemo(
    () => items.filter((acc) => acc.is_active).length,
    [items],
  );

  const editingAccount = useMemo(
    () => items.find((acc) => acc.id === editingId),
    [editingId, items],
  );

  const openCreate = () => {
    setEditingId(null);
    setModalOpen(true);
  };

  const handleArchiveToggle = (id: string, isActive: boolean) => {
    if (isActive) {
      archiveAccount(id);
      toast.success("Account archived");
    } else {
      updateAccount(id, { is_active: true });
      toast.success("Account restored");
    }
  };

  const handleApplyFilters = () => {
    fetchAccounts({
      includeInactive: showInactive,
      asOfDate: asOfInput || null,
    });
  };

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const direction = sortAsc ? 1 : -1;
      if (sortKey === "balance") {
        return (Number(a.balance) - Number(b.balance)) * direction;
      }
      if (sortKey === "name") {
        return a.name.localeCompare(b.name) * direction;
      }
      if (sortKey === "status") {
        return (Number(b.is_active) - Number(a.is_active)) * direction;
      }
      if (sortKey === "type") {
        return a.account_type.localeCompare(b.account_type) * direction;
      }
      return 0;
    });
    return copy;
  }, [items, sortAsc, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Accounts
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Balances and debt overview
          </h1>
          <p className="text-sm text-slate-500">
            Live balances with as-of filtering and archive controls.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add account
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-800"
            onClick={() =>
              fetchAccounts({
                includeInactive: showInactive,
                asOfDate: asOfInput,
              })
            }
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Reconciliation banner removed */}

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.4)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Total balance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-900">
            {formatCurrency(totalBalance)}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.4)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Active accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-900">
            {activeCount}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.4)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Include inactive
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              As of date
              <Input
                type="date"
                value={asOfInput}
                onChange={(e) => setAsOfInput(e.target.value)}
              />
            </label>
            <Button size="sm" variant="outline" onClick={handleApplyFilters}>
              Apply
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.4)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Accounts
            </CardTitle>
            <p className="text-xs text-slate-500">
              Balances {asOfInput ? `as of ${asOfInput}` : "up to now"}
            </p>
          </div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          <Separator />
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, idx) => (
                <Skeleton key={idx} className="h-12 w-full" />
              ))}
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <p className="text-sm font-semibold text-slate-900">
                No accounts yet
              </p>
              <p className="text-sm text-slate-500">
                Add an account or import data to see balances here.
              </p>
              <Button size="sm" onClick={openCreate}>
                Add account
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-100 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">
                      <button
                        className="flex items-center gap-1 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                        onClick={() => toggleSort("name")}
                      >
                        Name
                      </button>
                    </TableHead>
                    <TableHead className="px-4">
                      <button
                        className="flex items-center gap-1 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                        onClick={() => toggleSort("type")}
                      >
                        Type
                      </button>
                    </TableHead>
                    <TableHead className="px-4">
                      <button
                        className="flex items-center gap-1 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                        onClick={() => toggleSort("status")}
                      >
                        Status
                      </button>
                    </TableHead>
                    <TableHead className="px-4 text-right">
                      <button
                        className="ml-auto flex items-center gap-1 text-xs font-medium tracking-wide text-slate-500 uppercase"
                        onClick={() => toggleSort("balance")}
                      >
                        Balance
                      </button>
                    </TableHead>
                    <TableHead className="px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((account) => {
                    const isActive = account.is_active;
                    return (
                      <TableRow key={account.id} className="align-top">
                        <TableCell className="px-4 font-medium text-slate-900">
                          <div className="flex items-center gap-3">
                            {account.icon ? (
                              <img
                                src={`/${account.icon}`}
                                alt={account.name}
                                className="h-8 w-8 rounded-full border border-slate-100 bg-white object-contain p-1"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                                {account.name.charAt(0)}
                              </div>
                            )}
                            <span>{account.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 text-slate-600">
                          {formatAccountType(account.account_type)}
                        </TableCell>
                        <TableCell className="px-4">
                          <Badge
                            variant={isActive ? "default" : "outline"}
                            className={
                              isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "border-slate-300 text-slate-600"
                            }
                          >
                            {isActive ? "Active" : "Archived"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 text-right font-semibold text-slate-900">
                          {formatCurrency(Number(account.balance))}
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-slate-700"
                              onClick={() => {
                                setEditingId(account.id);
                                setModalOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            {account.account_type === AccountType.DEBT ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1 text-slate-700"
                                asChild
                              >
                                <Link to={`${PageRoutes.loans}/${account.id}`}>
                                  Loan page
                                </Link>
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-slate-700"
                              onClick={() =>
                                handleArchiveToggle(account.id, isActive)
                              }
                            >
                              {isActive ? (
                                <>
                                  <Archive className="h-4 w-4" /> Archive
                                </>
                              ) : (
                                <>
                                  <Undo className="h-4 w-4" /> Restore
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        account={editingAccount}
      />
    </div>
  );
};
