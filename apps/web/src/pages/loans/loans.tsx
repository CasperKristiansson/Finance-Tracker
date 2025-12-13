import { motion } from "framer-motion";
import {
  Archive,
  ArrowLeft,
  Calendar,
  CreditCard,
  Loader2,
  RefreshCw,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MotionPage,
  StaggerWrap,
  fadeInUp,
  subtleHover,
} from "@/components/motion-presets";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
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
import { PageRoutes } from "@/data/routes";
import { useAccountsApi, useLoansApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { AccountType, LoanEventType } from "@/types/api";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "—";
  return `${parsed.toFixed(2)}%`;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const loanEventLabel = (type: LoanEventType) => {
  switch (type) {
    case LoanEventType.INTEREST_ACCRUAL:
      return "Interest accrual";
    case LoanEventType.PAYMENT_PRINCIPAL:
      return "Principal payment";
    case LoanEventType.PAYMENT_INTEREST:
      return "Interest payment";
    case LoanEventType.DISBURSEMENT:
      return "Disbursement";
    case LoanEventType.FEE:
      return "Fee";
    default:
      return type;
  }
};

const loanEventBadgeClass = (type: LoanEventType) => {
  switch (type) {
    case LoanEventType.INTEREST_ACCRUAL:
      return "bg-amber-50 text-amber-800";
    case LoanEventType.PAYMENT_PRINCIPAL:
    case LoanEventType.PAYMENT_INTEREST:
      return "bg-emerald-50 text-emerald-800";
    case LoanEventType.DISBURSEMENT:
      return "bg-rose-50 text-rose-800";
    case LoanEventType.FEE:
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

const SummaryCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
}> = ({ label, value, hint }) => (
  <Card className="border-slate-200 shadow-[0_10px_40px_-26px_rgba(15,23,42,0.35)]">
    <CardHeader className="pb-2">
      <CardTitle className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-1">
      <div className="text-2xl font-semibold text-slate-900 tabular-nums">
        {value}
      </div>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </CardContent>
  </Card>
);

export const Loans: React.FC = () => {
  const { accountId } = useParams<{ accountId?: string }>();
  const {
    items: accounts,
    loading: accountsLoading,
    error: accountsError,
    includeInactive,
    fetchAccounts,
  } = useAccountsApi();
  const {
    schedules,
    events,
    loading,
    error,
    fetchLoanSchedule,
    fetchLoanEvents,
  } = useLoansApi();

  const [asOfDate, setAsOfDate] = useState("");
  const [periods, setPeriods] = useState(60);
  const [activeTab, setActiveTab] = useState<"schedule" | "events">("schedule");

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!accountId) return;
    fetchLoanSchedule({ accountId, asOfDate: asOfDate || undefined, periods });
    fetchLoanEvents({ accountId, limit: 50, offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const loanAccounts = useMemo(
    () => accounts.filter((acc) => acc.account_type === AccountType.DEBT),
    [accounts],
  );

  const selectedAccount = useMemo(() => {
    if (!accountId) return null;
    return accounts.find((acc) => acc.id === accountId) ?? null;
  }, [accountId, accounts]);

  const schedule = accountId ? schedules[accountId] : undefined;
  const accountEvents = accountId ? events[accountId] : undefined;
  const scheduleLoading = accountId
    ? loading[`loan-schedule-${accountId}`]
    : false;
  const eventsLoading = accountId ? loading[`loan-events-${accountId}`] : false;

  const totalPrincipal = useMemo(() => {
    return loanAccounts.reduce((sum, acc) => {
      const principal =
        acc.loan?.current_principal !== undefined
          ? Number(acc.loan.current_principal)
          : Math.abs(Number(acc.balance ?? 0));
      return sum + (Number.isFinite(principal) ? principal : 0);
    }, 0);
  }, [loanAccounts]);

  const scheduleChartData = useMemo(() => {
    const raw = schedule?.schedule ?? [];
    return raw.map((row) => ({
      period: row.period,
      remaining: Number(row.remaining_principal),
      payment: Number(row.payment_amount),
      interest: Number(row.interest_amount),
      principal: Number(row.principal_amount),
    }));
  }, [schedule?.schedule]);

  const payoffDate = useMemo(() => {
    if (!schedule?.schedule?.length) return null;
    return schedule.schedule[schedule.schedule.length - 1]?.due_date ?? null;
  }, [schedule?.schedule]);

  const refreshLoanData = () => {
    if (!accountId) return;
    fetchLoanSchedule({ accountId, asOfDate: asOfDate || undefined, periods });
    fetchLoanEvents({ accountId, limit: 50, offset: 0 });
  };

  const ListView = (
    <MotionPage className="space-y-4">
      <StaggerWrap className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <motion.div variants={fadeInUp}>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Loans
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Debt accounts and amortization
          </h1>
          <p className="text-sm text-slate-500">
            Track balances, schedules, and interest events for each loan.
          </p>
        </motion.div>
        <motion.div variants={fadeInUp} className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-800"
            asChild
          >
            <Link to={PageRoutes.accounts}>Manage accounts</Link>
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-800"
            onClick={() => fetchAccounts({ includeInactive: !includeInactive })}
          >
            <Archive className="h-4 w-4" />
            {includeInactive ? "Hide archived" : "Show archived"}
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-800"
            onClick={() => fetchAccounts()}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </motion.div>
      </StaggerWrap>

      {accountsError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {accountsError}
        </div>
      ) : null}

      <motion.div variants={fadeInUp} className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          label="Total principal"
          value={formatCurrency(totalPrincipal)}
          hint={`${loanAccounts.length} loans`}
        />
        <SummaryCard
          label="Included accounts"
          value={includeInactive ? "Active + archived" : "Active only"}
          hint="Loans are created as debt accounts"
        />
        <SummaryCard
          label="Next step"
          value="Open a loan"
          hint="View schedule and events per account"
        />
      </motion.div>

      <div className="grid gap-3 lg:grid-cols-2">
        {accountsLoading ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : loanAccounts.length ? (
          loanAccounts.map((acc) => {
            const current = acc.loan?.current_principal
              ? Number(acc.loan.current_principal)
              : Math.abs(Number(acc.balance ?? 0));
            const rate = acc.loan?.interest_rate_annual ?? null;
            const minPay = acc.loan?.minimum_payment ?? null;

            return (
              <motion.div key={acc.id} variants={fadeInUp} {...subtleHover}>
                <Card className="border-slate-200 shadow-[0_10px_40px_-26px_rgba(15,23,42,0.35)]">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          {acc.name}
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                          {acc.is_active ? "Active" : "Archived"} ·{" "}
                          {formatPercent(rate)}
                        </p>
                      </div>
                      <Button asChild size="sm" className="gap-2">
                        <Link to={`${PageRoutes.loans}/${acc.id}`}>
                          <CreditCard className="h-4 w-4" />
                          Details
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs text-slate-500">Principal</div>
                      <div className="text-lg font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(Number.isFinite(current) ? current : 0)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs text-slate-500">
                        Minimum payment
                      </div>
                      <div className="text-lg font-semibold text-slate-900 tabular-nums">
                        {minPay ? formatCurrency(Number(minPay)) : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs text-slate-500">Account id</div>
                      <div className="truncate font-mono text-xs text-slate-700">
                        {acc.id}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        ) : (
          <Card className="border-slate-200 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-900">
                No loans yet
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Create a debt account with loan details to start tracking
                schedules and interest events.
              </p>
              <Button asChild className="gap-2">
                <Link to={PageRoutes.accounts}>Add debt account</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MotionPage>
  );

  if (!accountId) return ListView;

  return (
    <MotionPage className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={PageRoutes.loans}>Loans</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {selectedAccount?.name ?? "Loan"}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link to={PageRoutes.loans}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {selectedAccount?.name ?? "Loan details"}
              </h1>
              <p className="text-sm text-slate-500">
                Schedule and events based on the current loan configuration.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-800"
            onClick={() => fetchAccounts()}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh account
          </Button>
          <Button className="gap-2" onClick={refreshLoanData}>
            {scheduleLoading || eventsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh loan data
          </Button>
        </div>
      </div>

      {accountsLoading ? (
        <div className="grid gap-3 md:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : selectedAccount?.account_type !== AccountType.DEBT ? (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Not a debt account
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              This account is not marked as debt, so it doesn’t have loan
              tracking enabled.
            </p>
            <Button asChild variant="outline">
              <Link to={PageRoutes.accounts}>Open accounts</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard
              label="Current principal"
              value={
                selectedAccount.loan?.current_principal
                  ? formatCurrency(
                      Number(selectedAccount.loan.current_principal),
                    )
                  : "—"
              }
              hint="From loan metadata"
            />
            <SummaryCard
              label="Interest rate"
              value={formatPercent(selectedAccount.loan?.interest_rate_annual)}
              hint="Annual rate"
            />
            <SummaryCard
              label="Minimum payment"
              value={
                selectedAccount.loan?.minimum_payment
                  ? formatCurrency(Number(selectedAccount.loan.minimum_payment))
                  : "—"
              }
              hint="If configured"
            />
            <SummaryCard
              label="Estimated payoff"
              value={payoffDate ? formatDate(payoffDate) : "—"}
              hint="From generated schedule"
            />
          </div>

          {(accountsError || error) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {accountsError || error}
            </div>
          )}

          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Schedule settings
              </CardTitle>
              <p className="text-xs text-slate-500">
                Generated at {formatDateTime(schedule?.generated_at)} · As of{" "}
                {formatDate(schedule?.as_of_date)}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm text-slate-700" htmlFor="asOfDate">
                    As of date (optional)
                  </label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="asOfDate"
                      type="date"
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-slate-700" htmlFor="periods">
                    Periods
                  </label>
                  <Input
                    id="periods"
                    type="number"
                    min={1}
                    max={360}
                    value={periods}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (!Number.isFinite(value)) {
                        setPeriods(60);
                        return;
                      }
                      setPeriods(Math.min(360, Math.max(1, value)));
                    }}
                  />
                </div>
              </div>

              <Button className="gap-2" onClick={refreshLoanData}>
                {scheduleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Generate schedule
              </Button>
            </CardContent>
          </Card>

          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "schedule" | "events")
            }
          >
            <TabsList>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>

            <TabsContent value="schedule">
              <div className="grid gap-3 lg:grid-cols-5">
                <Card className="border-slate-200 lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Remaining principal
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      Projection from amortization schedule.
                    </p>
                  </CardHeader>
                  <CardContent className="h-64">
                    {scheduleLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : scheduleChartData.length ? (
                      <ChartContainer
                        config={{
                          remaining: {
                            label: "Remaining",
                            color: "hsl(0 72% 51%)",
                          },
                        }}
                        className="h-full w-full"
                      >
                        <LineChart data={scheduleChartData}>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="period"
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) =>
                              new Intl.NumberFormat("sv-SE", {
                                notation: "compact",
                                maximumFractionDigits: 1,
                              }).format(value)
                            }
                          />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey="remaining"
                            stroke="var(--color-remaining)"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
                        No schedule generated yet.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 lg:col-span-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Amortization table
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      Payment, interest, and principal breakdown per period.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {scheduleLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : schedule?.schedule?.length ? (
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <div className="max-h-[480px] overflow-auto">
                          <Table>
                            <TableHeader className="sticky top-0 bg-white">
                              <TableRow>
                                <TableHead className="w-16 px-3">#</TableHead>
                                <TableHead className="px-3">Due</TableHead>
                                <TableHead className="px-3 text-right">
                                  Payment
                                </TableHead>
                                <TableHead className="px-3 text-right">
                                  Interest
                                </TableHead>
                                <TableHead className="px-3 text-right">
                                  Principal
                                </TableHead>
                                <TableHead className="px-3 text-right">
                                  Remaining
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {schedule.schedule.map((row) => (
                                <TableRow key={row.period}>
                                  <TableCell className="px-3 font-medium text-slate-900 tabular-nums">
                                    {row.period}
                                  </TableCell>
                                  <TableCell className="px-3 text-slate-700">
                                    {formatDate(row.due_date)}
                                  </TableCell>
                                  <TableCell className="px-3 text-right font-medium text-slate-900 tabular-nums">
                                    {formatCurrency(Number(row.payment_amount))}
                                  </TableCell>
                                  <TableCell className="px-3 text-right text-slate-700 tabular-nums">
                                    {formatCurrency(
                                      Number(row.interest_amount),
                                    )}
                                  </TableCell>
                                  <TableCell className="px-3 text-right text-slate-700 tabular-nums">
                                    {formatCurrency(
                                      Number(row.principal_amount),
                                    )}
                                  </TableCell>
                                  <TableCell className="px-3 text-right font-semibold text-slate-900 tabular-nums">
                                    {formatCurrency(
                                      Number(row.remaining_principal),
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-sm text-slate-600">
                          No schedule data returned for this account.
                        </p>
                        <Button
                          variant="outline"
                          className="border-slate-300 text-slate-800"
                          onClick={refreshLoanData}
                        >
                          Retry
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="events">
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Loan events
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Derived from transactions (payments, interest accruals,
                    adjustments).
                  </p>
                </CardHeader>
                <CardContent>
                  {eventsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : accountEvents?.length ? (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="max-h-[520px] overflow-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-white">
                            <TableRow>
                              <TableHead className="px-3">When</TableHead>
                              <TableHead className="px-3">Type</TableHead>
                              <TableHead className="px-3 text-right">
                                Amount
                              </TableHead>
                              <TableHead className="px-3">
                                Transaction
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {accountEvents.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="px-3 text-slate-700">
                                  {formatDateTime(row.occurred_at)}
                                </TableCell>
                                <TableCell className="px-3">
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                      loanEventBadgeClass(row.event_type),
                                    )}
                                  >
                                    {loanEventLabel(row.event_type)}
                                  </span>
                                </TableCell>
                                <TableCell className="px-3 text-right font-semibold text-slate-900 tabular-nums">
                                  {formatCurrency(Number(row.amount))}
                                </TableCell>
                                <TableCell className="px-3">
                                  <div className="max-w-[18rem] truncate font-mono text-xs text-slate-700">
                                    {row.transaction_id}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-medium text-slate-900">
                        No events yet
                      </div>
                      <p className="text-sm text-slate-600">
                        Events appear when transactions post against this loan
                        (payments, interest accruals, adjustments).
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="border-slate-300 text-slate-800"
                          onClick={refreshLoanData}
                        >
                          Refresh
                        </Button>
                        <Button asChild variant="outline">
                          <Link to={PageRoutes.transactions}>
                            Open transactions
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </MotionPage>
  );
};
