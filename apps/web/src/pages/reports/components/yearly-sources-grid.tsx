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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { YearlyOverviewResponse } from "@/types/api";
import { currency } from "../reports-utils";

type SourceRow = {
  source: string;
  total: number;
  txCount: number;
};

export const YearlySourcesGrid: React.FC<{
  overview: YearlyOverviewResponse | null;
  incomeSourceRows: SourceRow[];
  expenseSourceRows: SourceRow[];
  onOpenSourceDetail: (flow: "income" | "expense", source: string) => void;
}> = ({
  overview,
  incomeSourceRows,
  expenseSourceRows,
  onOpenSourceDetail,
}) => {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-900">
            Income sources
          </CardTitle>
          <p className="text-xs text-slate-500">
            Grouped by description. Click for seasonality.
          </p>
        </CardHeader>
        <CardContent className="max-h-[26rem] overflow-auto">
          {!overview ? (
            <Skeleton className="h-56 w-full" />
          ) : incomeSourceRows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    Tx
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeSourceRows.slice(0, 14).map((row) => (
                  <TableRow
                    key={row.source}
                    className="cursor-pointer"
                    onClick={() => onOpenSourceDetail("income", row.source)}
                  >
                    <TableCell className="max-w-[220px] truncate font-medium">
                      {row.source}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {currency(row.total)}
                    </TableCell>
                    <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                      {row.txCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              No income sources yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-900">
            Expense sources
          </CardTitle>
          <p className="text-xs text-slate-500">
            Grouped by description or merchant. Click for seasonality.
          </p>
        </CardHeader>
        <CardContent className="flex max-h-[26rem] flex-col">
          {!overview ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <Tabs
              defaultValue="sources"
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="self-start">
                <TabsTrigger value="sources">Sources</TabsTrigger>
                <TabsTrigger value="merchants">Merchants</TabsTrigger>
              </TabsList>
              <TabsContent
                value="sources"
                className="mt-2 min-h-0 flex-1 overflow-auto"
              >
                {expenseSourceRows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                          Tx
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseSourceRows.slice(0, 14).map((row) => (
                        <TableRow
                          key={row.source}
                          className="cursor-pointer"
                          onClick={() =>
                            onOpenSourceDetail("expense", row.source)
                          }
                        >
                          <TableCell className="max-w-[220px] truncate font-medium">
                            {row.source}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency(row.total)}
                          </TableCell>
                          <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                            {row.txCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No expense sources yet.
                  </div>
                )}
              </TabsContent>
              <TabsContent
                value="merchants"
                className="mt-2 min-h-0 flex-1 overflow-auto"
              >
                {overview.top_merchants.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Merchant</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.top_merchants.slice(0, 14).map((row) => (
                        <TableRow
                          key={row.merchant}
                          className="cursor-pointer"
                          onClick={() =>
                            onOpenSourceDetail("expense", row.merchant)
                          }
                        >
                          <TableCell className="max-w-[220px] truncate font-medium">
                            {row.merchant}
                          </TableCell>
                          <TableCell className="text-right">
                            {currency(Number(row.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No merchant spend yet.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
