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

import type { TotalDrilldownState } from "../reports-types";
import { currency } from "../reports-utils";

export const TotalSourcesCard: React.FC<{
  flow: "income" | "expense";
  hasOverview: boolean;
  sources: Array<{ source: string; total: number; txCount: number }>;
  changes: Array<{ source: string; delta: number }>;
  onOpenDrilldownDialog: (state: TotalDrilldownState) => void;
}> = ({ flow, hasOverview, sources, changes, onOpenDrilldownDialog }) => {
  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {flow === "income" ? "Income sources" : "Expense sources"}
        </CardTitle>
        <p className="text-xs text-slate-500">
          Lifetime totals with biggest year-over-year shifts.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasOverview ? (
          <Skeleton className="h-56 w-full" />
        ) : sources.length ? (
          <>
            <div className="max-h-52 overflow-auto rounded-md border border-slate-100 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Lifetime</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      Tx
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.slice(0, 12).map((row) => (
                    <TableRow
                      key={row.source}
                      className="cursor-pointer"
                      onClick={() =>
                        onOpenDrilldownDialog({
                          kind: "source",
                          flow,
                          source: row.source,
                        })
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
            </div>
            <div className="rounded-md border border-slate-100 bg-white">
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                Biggest YoY changes
              </div>
              <div className="max-h-44 overflow-auto">
                {changes.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Δ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {changes.slice(0, 10).map((row) => (
                        <TableRow
                          key={row.source}
                          className="cursor-pointer"
                          onClick={() =>
                            onOpenDrilldownDialog({
                              kind: "source",
                              flow,
                              source: row.source,
                            })
                          }
                        >
                          <TableCell className="max-w-[220px] truncate font-medium">
                            {row.source}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <span
                              className={
                                (flow === "expense" ? row.delta <= 0 : row.delta >= 0)
                                  ? "text-emerald-700"
                                  : "text-rose-700"
                              }
                            >
                              {row.delta >= 0 ? "+" : "−"}
                              {currency(Math.abs(row.delta))}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-4 text-sm text-slate-600">
                    Not enough history for YoY source changes yet.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            No {flow} sources yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

