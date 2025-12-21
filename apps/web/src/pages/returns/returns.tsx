import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Unlink,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { MotionPage } from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReturnsApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { ReturnStatus, type ReturnSummary } from "@/types/api";

const formatCurrency = (amount: string) =>
  Number(amount || 0).toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 2,
  });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const statusTone: Record<ReturnStatus, string> = {
  [ReturnStatus.PENDING]: "bg-amber-100 text-amber-800 border border-amber-200",
  [ReturnStatus.PROCESSED]:
    "bg-emerald-100 text-emerald-800 border border-emerald-200",
};

const statusLabel: Record<ReturnStatus, string> = {
  [ReturnStatus.PENDING]: "Pending",
  [ReturnStatus.PROCESSED]: "Processed",
};

const matchSearch = (row: ReturnSummary, query: string) => {
  if (!query) return true;
  const haystack = [
    row.parent_description ?? "",
    row.accounts.join(" "),
    row.parent_id,
    row.return_id,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
};

export const Returns: React.FC = () => {
  const { items, loading, error, statusFilter, fetchReturns, updateReturn } =
    useReturnsApi();
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const filtered = useMemo(
    () =>
      items.filter((row) => {
        const statusOk =
          statusFilter === "all" || row.return_status === statusFilter;
        return statusOk && matchSearch(row, search);
      }),
    [items, search, statusFilter],
  );

  return (
    <MotionPage>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-2xl font-semibold text-slate-900">
            Returns
          </CardTitle>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2",
                  statusFilter === "all" && "border-slate-900 text-slate-900",
                )}
                onClick={() => fetchReturns("all")}
              >
                All
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2",
                  statusFilter === ReturnStatus.PENDING &&
                    "border-slate-900 text-slate-900",
                )}
                onClick={() => fetchReturns(ReturnStatus.PENDING)}
              >
                Pending
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2",
                  statusFilter === ReturnStatus.PROCESSED &&
                    "border-slate-900 text-slate-900",
                )}
                onClick={() => fetchReturns(ReturnStatus.PROCESSED)}
              >
                Processed
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search description or account…"
                className="w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchReturns(statusFilter)}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCcw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
                Refresh
              </Button>
            </div>
          </div>
          {error ? (
            <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}
        </CardHeader>
        <Separator />
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Original</TableHead>
                  <TableHead className="w-44">Return</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading returns…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <div className="py-6 text-sm text-slate-600">
                        {search
                          ? "No returns match your search."
                          : "No returns found."}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.return_id}>
                      <TableCell>
                        <div className="flex flex-col text-sm text-slate-800">
                          <span className="font-medium">
                            {formatCurrency(row.parent_amount)}
                          </span>
                          <span className="text-slate-500">
                            {formatDate(row.parent_occurred_at)}
                          </span>
                          <span className="truncate text-slate-600">
                            {row.parent_description || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm text-slate-800">
                          <span className="font-medium">
                            {formatCurrency(row.return_amount)}
                          </span>
                          <span className="text-slate-500">
                            {formatDate(row.return_occurred_at)}
                          </span>
                          <span className="text-slate-500">
                            Linked to {row.parent_id.slice(0, 8)}…
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {row.accounts.map((account) => (
                            <Badge key={account} variant="secondary">
                              {account}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusTone[row.return_status]}>
                          {statusLabel[row.return_status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={
                              loading ||
                              row.return_status === ReturnStatus.PROCESSED
                            }
                            onClick={() =>
                              updateReturn(row.return_id, "mark_processed")
                            }
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Processed
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-rose-700 hover:text-rose-700"
                            disabled={loading}
                            onClick={() =>
                              updateReturn(row.return_id, "detach")
                            }
                          >
                            <Unlink className="h-4 w-4" />
                            Detach
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </MotionPage>
  );
};
