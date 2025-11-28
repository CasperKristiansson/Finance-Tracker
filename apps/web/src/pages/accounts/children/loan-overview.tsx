import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { useLoansApi } from "@/hooks/use-api";
import type { AccountWithBalance } from "@/types/api";

type Props = {
  account: AccountWithBalance;
};

export const LoanOverview: React.FC<Props> = ({ account }) => {
  const { schedules, events, loading, fetchLoanSchedule, fetchLoanEvents } =
    useLoansApi();
  const schedule = schedules[account.id];
  const accountEvents = events[account.id] ?? [];
  const isLoading =
    loading[`loan-schedule-${account.id}`] ||
    loading[`loan-events-${account.id}`];

  useEffect(() => {
    fetchLoanSchedule({ accountId: account.id, periods: 12 });
    fetchLoanEvents({ accountId: account.id, limit: 5 });
  }, [account.id, fetchLoanEvents, fetchLoanSchedule]);

  return (
    <div className="space-y-3">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm text-slate-600">
            Loan schedule (next 12)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full" />
              ))}
            </div>
          ) : schedule ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Payment</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.schedule.slice(0, 6).map((row) => (
                  <TableRow key={row.period}>
                    <TableCell className="text-sm text-slate-700">
                      {new Date(row.due_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {Number(row.payment_amount).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-600">
                      {Number(row.principal_amount).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-600">
                      {Number(row.interest_amount).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-slate-900">
                      {Number(row.remaining_principal).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-4 text-sm text-slate-600">
              No schedule available. Add loan details to see amortization.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm text-slate-600">
            Recent loan events
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              fetchLoanEvents({ accountId: account.id, limit: 10 })
            }
            className="text-xs text-slate-600"
          >
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full" />
              ))}
            </div>
          ) : accountEvents.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountEvents.map((evt) => (
                  <TableRow key={evt.id}>
                    <TableCell className="text-sm text-slate-700">
                      {new Date(evt.occurred_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 capitalize">
                      {evt.event_type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-slate-900">
                      {Number(evt.amount).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-4 text-sm text-slate-600">
              No loan events yet. Payments and accruals will appear here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
