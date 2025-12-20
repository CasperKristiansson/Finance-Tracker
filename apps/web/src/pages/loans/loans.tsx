import { motion } from "framer-motion";
import {
  Archive,
  ArrowLeft,
  Calendar,
  Copy,
  CreditCard,
  Plus,
  Loader2,
  Pencil,
  RefreshCw,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useAppSelector } from "@/app/hooks";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { selectToken } from "@/features/auth/authSlice";
import { useAccountsApi, useLoansApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import {
  currency,
  formatDate as formatDateLocale,
  formatDateTime as formatDateTimeLocale,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountWithBalance } from "@/types/api";
import { AccountType, InterestCompound, LoanEventType } from "@/types/api";
import {
  accountWithBalanceSchema,
  loanSchema,
  transactionSchema,
} from "@/types/schemas";

const selectLikeInput =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const formatCurrency = (value: number) => currency(value);

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
  return formatDateLocale(date, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTimeLocale(date, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return "";
  return value.slice(0, 10);
};

const parseMoneyToCents = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const [whole, fractional] = normalized.split(".");
  const wholeCents = BigInt(whole) * 100n;
  const fractionCents = BigInt((fractional ?? "").padEnd(2, "0").slice(0, 2));
  return wholeCents + fractionCents;
};

const parseDecimalString = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,8})?$/.test(normalized)) return null;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return normalized;
};

const centsToMoneyString = (cents: bigint) => {
  const sign = cents < 0 ? "-" : "";
  const abs = cents < 0 ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${sign}${whole.toString()}.${frac.toString().padStart(2, "0")}`;
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

const interestCompoundLabel = (value: InterestCompound | null | undefined) => {
  switch (value) {
    case InterestCompound.DAILY:
      return "Daily";
    case InterestCompound.MONTHLY:
      return "Monthly";
    case InterestCompound.YEARLY:
      return "Yearly";
    default:
      return "—";
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
  const navigate = useNavigate();
  const token = useAppSelector(selectToken);
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
  const [createLoanOpen, setCreateLoanOpen] = useState(false);
  const [createLoanLoading, setCreateLoanLoading] = useState(false);
  const [editLoanOpen, setEditLoanOpen] = useState(false);
  const [editLoanLoading, setEditLoanLoading] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityKind, setActivityKind] = useState<"payment" | "draw">(
    "payment",
  );
  const [fundingAccountId, setFundingAccountId] = useState("");
  const [activityDate, setActivityDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [activityAmount, setActivityAmount] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [syncPrincipal, setSyncPrincipal] = useState(true);
  const [loanName, setLoanName] = useState("");
  const [loanOriginPrincipal, setLoanOriginPrincipal] = useState("");
  const [loanCurrentPrincipal, setLoanCurrentPrincipal] = useState("");
  const [loanInterestRateAnnual, setLoanInterestRateAnnual] = useState("");
  const [loanInterestCompound, setLoanInterestCompound] =
    useState<InterestCompound>(InterestCompound.MONTHLY);
  const [loanMinimumPayment, setLoanMinimumPayment] = useState("");
  const [loanExpectedMaturityDate, setLoanExpectedMaturityDate] = useState("");
  const [editOriginPrincipal, setEditOriginPrincipal] = useState("");
  const [editCurrentPrincipal, setEditCurrentPrincipal] = useState("");
  const [editInterestRateAnnual, setEditInterestRateAnnual] = useState("");
  const [editInterestCompound, setEditInterestCompound] =
    useState<InterestCompound>(InterestCompound.MONTHLY);
  const [editMinimumPayment, setEditMinimumPayment] = useState("");
  const [editExpectedMaturityDate, setEditExpectedMaturityDate] = useState("");
  const [loanEventDetailsId, setLoanEventDetailsId] = useState<string | null>(
    null,
  );

  const closeLoanEventDetails = () => setLoanEventDetailsId(null);

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

  useEffect(() => {
    setLoanEventDetailsId(null);
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

  const nextExpectedPayoff = useMemo(() => {
    let best: { ts: number; value: string } | null = null;
    for (const acc of loanAccounts) {
      const date = acc.loan?.expected_maturity_date;
      if (!date) continue;
      const ts = Date.parse(date);
      if (!Number.isFinite(ts)) continue;
      if (!best || ts < best.ts) best = { ts, value: date };
    }
    return best?.value ?? null;
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

  const selectedLoanEvent = useMemo(() => {
    if (!loanEventDetailsId) return null;
    return (
      accountEvents?.find((event) => event.id === loanEventDetailsId) ?? null
    );
  }, [accountEvents, loanEventDetailsId]);

  const copyValue = async (label: string, value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied", { description: `${label} copied to clipboard.` });
    } catch (error) {
      toast.error("Unable to copy", {
        description:
          error instanceof Error ? error.message : "Please copy manually.",
      });
    }
  };

  const openEditLoan = () => {
    if (!selectedAccount?.loan) {
      toast.error("Loan details are not available for this account.");
      return;
    }
    setEditOriginPrincipal(selectedAccount.loan.origin_principal ?? "");
    setEditCurrentPrincipal(selectedAccount.loan.current_principal ?? "");
    setEditInterestRateAnnual(selectedAccount.loan.interest_rate_annual ?? "");
    setEditInterestCompound(
      selectedAccount.loan.interest_compound ?? InterestCompound.MONTHLY,
    );
    setEditMinimumPayment(selectedAccount.loan.minimum_payment ?? "");
    setEditExpectedMaturityDate(
      toDateInputValue(selectedAccount.loan.expected_maturity_date),
    );
    setEditLoanOpen(true);
  };

  const fundingAccounts = useMemo(() => {
    return accounts.filter((acc) => acc.account_type !== AccountType.DEBT);
  }, [accounts]);

  const createLoan = async () => {
    if (!token) {
      toast.error("You must be logged in to create a loan.");
      return;
    }

    const originCents = parseMoneyToCents(loanOriginPrincipal);
    const currentCents = parseMoneyToCents(
      loanCurrentPrincipal || loanOriginPrincipal,
    );
    const rate = parseDecimalString(loanInterestRateAnnual);
    if (!loanName.trim()) {
      toast.error("Loan name is required.");
      return;
    }
    if (originCents === null || currentCents === null || rate === null) {
      toast.error("Principal and interest rate must be valid numbers.");
      return;
    }

    setCreateLoanLoading(true);
    try {
      const created = await apiFetch<AccountWithBalance>({
        path: "/accounts",
        method: "POST",
        token,
        schema: accountWithBalanceSchema,
        body: {
          name: loanName.trim(),
          account_type: AccountType.DEBT,
          is_active: true,
          icon: null,
          loan: {
            origin_principal: centsToMoneyString(originCents),
            current_principal: centsToMoneyString(currentCents),
            interest_rate_annual: rate,
            interest_compound: loanInterestCompound,
            minimum_payment: loanMinimumPayment.trim()
              ? loanMinimumPayment.trim()
              : null,
            expected_maturity_date: loanExpectedMaturityDate.trim()
              ? loanExpectedMaturityDate.trim()
              : null,
          },
        },
      });

      toast.success("Loan created");
      setCreateLoanOpen(false);
      setLoanName("");
      setLoanOriginPrincipal("");
      setLoanCurrentPrincipal("");
      setLoanInterestRateAnnual("");
      setLoanInterestCompound(InterestCompound.MONTHLY);
      setLoanMinimumPayment("");
      setLoanExpectedMaturityDate("");
      fetchAccounts({ includeInactive });
      navigate(`${PageRoutes.loans}/${created.data.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create loan",
      );
    } finally {
      setCreateLoanLoading(false);
    }
  };

  const recordLoanActivity = async () => {
    if (!token) {
      toast.error("You must be logged in to record loan activity.");
      return;
    }
    if (!accountId) return;
    if (!fundingAccountId) {
      toast.error("Pick a funding account.");
      return;
    }

    const amountCents = parseMoneyToCents(activityAmount);
    if (amountCents === null || amountCents <= 0) {
      toast.error("Amount must be a positive number.");
      return;
    }

    const occurredAtIso = new Date(
      `${activityDate}T00:00:00.000Z`,
    ).toISOString();
    const amount = centsToMoneyString(amountCents);
    const loanLegAmount = activityKind === "payment" ? amount : `-${amount}`;
    const fundingLegAmount = activityKind === "payment" ? `-${amount}` : amount;

    setActivityLoading(true);
    try {
      await apiFetch({
        path: "/transactions",
        method: "POST",
        token,
        schema: transactionSchema,
        body: {
          category_id: null,
          subscription_id: null,
          description: activityDescription.trim()
            ? activityDescription.trim()
            : activityKind === "payment"
              ? "Loan principal payment"
              : "Loan disbursement",
          notes: null,
          external_id: null,
          occurred_at: occurredAtIso,
          posted_at: occurredAtIso,
          status: "recorded",
          legs: [
            { account_id: accountId, amount: loanLegAmount },
            { account_id: fundingAccountId, amount: fundingLegAmount },
          ],
        },
      });

      if (syncPrincipal && selectedAccount?.loan?.current_principal) {
        const current = parseMoneyToCents(
          selectedAccount.loan.current_principal,
        );
        if (current !== null) {
          const next =
            activityKind === "payment"
              ? current - amountCents
              : current + amountCents;
          const clamped = next < 0 ? 0n : next;
          await apiFetch({
            path: `/loans/${accountId}`,
            method: "PATCH",
            token,
            schema: loanSchema,
            body: {
              current_principal: centsToMoneyString(clamped),
            },
          });
        }
      }

      toast.success("Loan activity recorded");
      setActivityOpen(false);
      setActivityAmount("");
      setActivityDescription("");
      setFundingAccountId("");
      refreshLoanData();
      fetchAccounts({ includeInactive });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to record loan activity",
      );
    } finally {
      setActivityLoading(false);
    }
  };

  const updateLoan = async () => {
    if (!token) {
      toast.error("You must be logged in to update a loan.");
      return;
    }
    if (!accountId) return;
    if (!selectedAccount?.loan) return;

    const originCents = parseMoneyToCents(editOriginPrincipal);
    const currentCents = parseMoneyToCents(editCurrentPrincipal);
    const rate = parseDecimalString(editInterestRateAnnual);
    if (originCents === null || currentCents === null || rate === null) {
      toast.error("Principal and interest rate must be valid numbers.");
      return;
    }

    const minPay = editMinimumPayment.trim();
    const minPayCents = minPay ? parseMoneyToCents(minPay) : null;
    if (minPay && minPayCents === null) {
      toast.error("Minimum payment must be a valid number.");
      return;
    }

    setEditLoanLoading(true);
    try {
      await apiFetch({
        path: `/loans/${accountId}`,
        method: "PATCH",
        token,
        schema: loanSchema,
        body: {
          origin_principal: centsToMoneyString(originCents),
          current_principal: centsToMoneyString(currentCents),
          interest_rate_annual: rate,
          interest_compound: editInterestCompound,
          minimum_payment: minPay
            ? centsToMoneyString(minPayCents ?? 0n)
            : null,
          expected_maturity_date: editExpectedMaturityDate.trim()
            ? editExpectedMaturityDate.trim()
            : null,
        },
      });

      toast.success("Loan updated");
      setEditLoanOpen(false);
      fetchAccounts({ includeInactive });
      refreshLoanData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update loan",
      );
    } finally {
      setEditLoanLoading(false);
    }
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
          <Button className="gap-2" onClick={() => setCreateLoanOpen(true)}>
            <Plus className="h-4 w-4" />
            Add loan
          </Button>
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
          label="Next expected payoff"
          value={nextExpectedPayoff ? formatDate(nextExpectedPayoff) : "—"}
          hint={
            nextExpectedPayoff
              ? "Earliest expected maturity date"
              : "Set expected maturity per loan"
          }
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
            const origin = acc.loan?.origin_principal
              ? Number(acc.loan.origin_principal)
              : null;
            const rate = acc.loan?.interest_rate_annual ?? null;
            const minPay = acc.loan?.minimum_payment ?? null;
            const compound = acc.loan?.interest_compound ?? null;
            const maturity = acc.loan?.expected_maturity_date ?? null;
            const paidDown =
              origin !== null &&
              Number.isFinite(origin) &&
              origin > 0 &&
              Number.isFinite(current)
                ? Math.max(0, origin - current)
                : null;
            const paidDownPct =
              paidDown !== null && origin !== null && origin > 0
                ? Math.min(100, Math.max(0, (paidDown / origin) * 100))
                : null;

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
                          {formatPercent(rate)} ·{" "}
                          {interestCompoundLabel(compound)}
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
                  <CardContent className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-xs text-slate-500">
                          Current principal
                        </div>
                        <div className="text-lg font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(
                            Number.isFinite(current) ? current : 0,
                          )}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-xs text-slate-500">
                          Origin principal
                        </div>
                        <div className="text-lg font-semibold text-slate-900 tabular-nums">
                          {origin !== null && Number.isFinite(origin)
                            ? formatCurrency(origin)
                            : "—"}
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
                        <div className="text-xs text-slate-500">
                          Expected payoff
                        </div>
                        <div className="text-lg font-semibold text-slate-900 tabular-nums">
                          {maturity ? formatDate(maturity) : "—"}
                        </div>
                      </div>
                    </div>

                    {paidDownPct !== null ? (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Paid down</span>
                          <span className="font-medium tabular-nums">
                            {Math.round(paidDownPct)}%
                          </span>
                        </div>
                        <Progress value={paidDownPct} className="mt-2 h-2" />
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span className="tabular-nums">
                            {formatCurrency(paidDown ?? 0)} paid
                          </span>
                          <span className="tabular-nums">
                            {formatCurrency(
                              Number.isFinite(current) ? current : 0,
                            )}{" "}
                            remaining
                          </span>
                        </div>
                      </div>
                    ) : null}
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

  if (!accountId) {
    return (
      <>
        {ListView}
        <LoansDialogs
          createLoanOpen={createLoanOpen}
          setCreateLoanOpen={setCreateLoanOpen}
          createLoanLoading={createLoanLoading}
          onCreateLoan={createLoan}
          loanName={loanName}
          setLoanName={setLoanName}
          loanOriginPrincipal={loanOriginPrincipal}
          setLoanOriginPrincipal={setLoanOriginPrincipal}
          loanCurrentPrincipal={loanCurrentPrincipal}
          setLoanCurrentPrincipal={setLoanCurrentPrincipal}
          loanInterestRateAnnual={loanInterestRateAnnual}
          setLoanInterestRateAnnual={setLoanInterestRateAnnual}
          loanInterestCompound={loanInterestCompound}
          setLoanInterestCompound={setLoanInterestCompound}
          loanMinimumPayment={loanMinimumPayment}
          setLoanMinimumPayment={setLoanMinimumPayment}
          loanExpectedMaturityDate={loanExpectedMaturityDate}
          setLoanExpectedMaturityDate={setLoanExpectedMaturityDate}
          editLoanOpen={editLoanOpen}
          setEditLoanOpen={setEditLoanOpen}
          editLoanLoading={editLoanLoading}
          onUpdateLoan={updateLoan}
          editOriginPrincipal={editOriginPrincipal}
          setEditOriginPrincipal={setEditOriginPrincipal}
          editCurrentPrincipal={editCurrentPrincipal}
          setEditCurrentPrincipal={setEditCurrentPrincipal}
          editInterestRateAnnual={editInterestRateAnnual}
          setEditInterestRateAnnual={setEditInterestRateAnnual}
          editInterestCompound={editInterestCompound}
          setEditInterestCompound={setEditInterestCompound}
          editMinimumPayment={editMinimumPayment}
          setEditMinimumPayment={setEditMinimumPayment}
          editExpectedMaturityDate={editExpectedMaturityDate}
          setEditExpectedMaturityDate={setEditExpectedMaturityDate}
          activityOpen={activityOpen}
          setActivityOpen={setActivityOpen}
          activityLoading={activityLoading}
          activityKind={activityKind}
          setActivityKind={setActivityKind}
          activityDate={activityDate}
          setActivityDate={setActivityDate}
          activityAmount={activityAmount}
          setActivityAmount={setActivityAmount}
          activityDescription={activityDescription}
          setActivityDescription={setActivityDescription}
          fundingAccountId={fundingAccountId}
          setFundingAccountId={setFundingAccountId}
          fundingAccounts={fundingAccounts}
          syncPrincipal={syncPrincipal}
          setSyncPrincipal={setSyncPrincipal}
          onRecordActivity={recordLoanActivity}
        />
      </>
    );
  }

  return (
    <>
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
            <Button
              variant="outline"
              className="gap-2 border-slate-300 text-slate-800"
              onClick={openEditLoan}
              disabled={
                accountsLoading ||
                selectedAccount?.account_type !== AccountType.DEBT ||
                !selectedAccount?.loan
              }
            >
              <Pencil className="h-4 w-4" />
              Edit loan
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-slate-300 text-slate-800"
              onClick={() => setActivityOpen(true)}
              disabled={
                accountsLoading ||
                selectedAccount?.account_type !== AccountType.DEBT
              }
            >
              <Plus className="h-4 w-4" />
              Record activity
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
                value={formatPercent(
                  selectedAccount.loan?.interest_rate_annual,
                )}
                hint="Annual rate"
              />
              <SummaryCard
                label="Minimum payment"
                value={
                  selectedAccount.loan?.minimum_payment
                    ? formatCurrency(
                        Number(selectedAccount.loan.minimum_payment),
                      )
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
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base font-semibold text-slate-900">
                            Remaining principal
                          </CardTitle>
                          <p className="mt-1 text-xs text-slate-500">
                            Projection from amortization schedule. Generated at{" "}
                            {formatDateTime(schedule?.generated_at)} · As of{" "}
                            {formatDate(schedule?.as_of_date)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={refreshLoanData}
                        >
                          {scheduleLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Generate
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label
                            className="text-sm text-slate-700"
                            htmlFor="asOfDate"
                          >
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
                          <label
                            className="text-sm text-slate-700"
                            htmlFor="periods"
                          >
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

                      <div className="h-56">
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
                      </div>
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
                                      {formatCurrency(
                                        Number(row.payment_amount),
                                      )}
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
                                <TableRow
                                  key={row.id}
                                  className={cn(
                                    "cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-slate-50",
                                    loanEventDetailsId === row.id
                                      ? "bg-slate-50"
                                      : undefined,
                                  )}
                                  onClick={() => setLoanEventDetailsId(row.id)}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      setLoanEventDetailsId(row.id);
                                    }
                                  }}
                                  tabIndex={0}
                                >
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
                                    <div className="max-w-[16rem] truncate font-mono text-xs text-slate-700">
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
      <Sheet
        open={Boolean(loanEventDetailsId)}
        onOpenChange={(open) => {
          if (!open) closeLoanEventDetails();
        }}
      >
        <SheetContent side="right" className="bg-white sm:max-w-lg">
          {selectedLoanEvent ? (
            <>
              <SheetHeader className="border-b border-slate-100">
                <SheetTitle className="truncate text-lg">
                  {loanEventLabel(selectedLoanEvent.event_type)}
                </SheetTitle>
                <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDateTime(selectedLoanEvent.occurred_at)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                      loanEventBadgeClass(selectedLoanEvent.event_type),
                    )}
                  >
                    {loanEventLabel(selectedLoanEvent.event_type)}
                  </span>
                </SheetDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      closeLoanEventDetails();
                      navigate(
                        `${PageRoutes.transactions}?search=${encodeURIComponent(
                          selectedLoanEvent.transaction_id,
                        )}`,
                      );
                    }}
                  >
                    <CreditCard className="h-4 w-4" />
                    View transaction
                  </Button>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="rounded-lg border border-slate-100 bg-white p-4">
                  <div className="text-xs text-slate-600">Amount</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(Number(selectedLoanEvent.amount))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="text-xs text-slate-500">Event id</div>
                    <div className="mt-1 truncate font-mono text-xs text-slate-900">
                      {selectedLoanEvent.id}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-white p-3 text-right">
                    <div className="text-xs text-slate-500">Loan id</div>
                    <div className="mt-1 truncate font-mono text-xs text-slate-900">
                      {selectedLoanEvent.loan_id}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500">
                        Transaction id
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-900">
                        {selectedLoanEvent.transaction_id}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        void copyValue(
                          "Transaction id",
                          selectedLoanEvent.transaction_id,
                        )
                      }
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                  </div>

                  {selectedLoanEvent.transaction_leg_id ? (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500">
                          Transaction leg id
                        </div>
                        <div className="mt-1 truncate font-mono text-xs text-slate-900">
                          {selectedLoanEvent.transaction_leg_id}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() =>
                          void copyValue(
                            "Transaction leg id",
                            selectedLoanEvent.transaction_leg_id,
                          )
                        }
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 text-sm text-slate-600">
              Select a loan event to see details.
            </div>
          )}
        </SheetContent>
      </Sheet>
      <LoansDialogs
        createLoanOpen={createLoanOpen}
        setCreateLoanOpen={setCreateLoanOpen}
        createLoanLoading={createLoanLoading}
        onCreateLoan={createLoan}
        loanName={loanName}
        setLoanName={setLoanName}
        loanOriginPrincipal={loanOriginPrincipal}
        setLoanOriginPrincipal={setLoanOriginPrincipal}
        loanCurrentPrincipal={loanCurrentPrincipal}
        setLoanCurrentPrincipal={setLoanCurrentPrincipal}
        loanInterestRateAnnual={loanInterestRateAnnual}
        setLoanInterestRateAnnual={setLoanInterestRateAnnual}
        loanInterestCompound={loanInterestCompound}
        setLoanInterestCompound={setLoanInterestCompound}
        loanMinimumPayment={loanMinimumPayment}
        setLoanMinimumPayment={setLoanMinimumPayment}
        loanExpectedMaturityDate={loanExpectedMaturityDate}
        setLoanExpectedMaturityDate={setLoanExpectedMaturityDate}
        editLoanOpen={editLoanOpen}
        setEditLoanOpen={setEditLoanOpen}
        editLoanLoading={editLoanLoading}
        onUpdateLoan={updateLoan}
        editOriginPrincipal={editOriginPrincipal}
        setEditOriginPrincipal={setEditOriginPrincipal}
        editCurrentPrincipal={editCurrentPrincipal}
        setEditCurrentPrincipal={setEditCurrentPrincipal}
        editInterestRateAnnual={editInterestRateAnnual}
        setEditInterestRateAnnual={setEditInterestRateAnnual}
        editInterestCompound={editInterestCompound}
        setEditInterestCompound={setEditInterestCompound}
        editMinimumPayment={editMinimumPayment}
        setEditMinimumPayment={setEditMinimumPayment}
        editExpectedMaturityDate={editExpectedMaturityDate}
        setEditExpectedMaturityDate={setEditExpectedMaturityDate}
        activityOpen={activityOpen}
        setActivityOpen={setActivityOpen}
        activityLoading={activityLoading}
        activityKind={activityKind}
        setActivityKind={setActivityKind}
        activityDate={activityDate}
        setActivityDate={setActivityDate}
        activityAmount={activityAmount}
        setActivityAmount={setActivityAmount}
        activityDescription={activityDescription}
        setActivityDescription={setActivityDescription}
        fundingAccountId={fundingAccountId}
        setFundingAccountId={setFundingAccountId}
        fundingAccounts={fundingAccounts}
        syncPrincipal={syncPrincipal}
        setSyncPrincipal={setSyncPrincipal}
        onRecordActivity={recordLoanActivity}
      />
    </>
  );
};

// Dialogs are rendered at root of page to avoid layout shifts.
const LoansDialogs: React.FC<{
  createLoanOpen: boolean;
  setCreateLoanOpen: (open: boolean) => void;
  createLoanLoading: boolean;
  onCreateLoan: () => void;
  loanName: string;
  setLoanName: (value: string) => void;
  loanOriginPrincipal: string;
  setLoanOriginPrincipal: (value: string) => void;
  loanCurrentPrincipal: string;
  setLoanCurrentPrincipal: (value: string) => void;
  loanInterestRateAnnual: string;
  setLoanInterestRateAnnual: (value: string) => void;
  loanInterestCompound: InterestCompound;
  setLoanInterestCompound: (value: InterestCompound) => void;
  loanMinimumPayment: string;
  setLoanMinimumPayment: (value: string) => void;
  loanExpectedMaturityDate: string;
  setLoanExpectedMaturityDate: (value: string) => void;
  editLoanOpen: boolean;
  setEditLoanOpen: (open: boolean) => void;
  editLoanLoading: boolean;
  onUpdateLoan: () => void;
  editOriginPrincipal: string;
  setEditOriginPrincipal: (value: string) => void;
  editCurrentPrincipal: string;
  setEditCurrentPrincipal: (value: string) => void;
  editInterestRateAnnual: string;
  setEditInterestRateAnnual: (value: string) => void;
  editInterestCompound: InterestCompound;
  setEditInterestCompound: (value: InterestCompound) => void;
  editMinimumPayment: string;
  setEditMinimumPayment: (value: string) => void;
  editExpectedMaturityDate: string;
  setEditExpectedMaturityDate: (value: string) => void;
  activityOpen: boolean;
  setActivityOpen: (open: boolean) => void;
  activityLoading: boolean;
  activityKind: "payment" | "draw";
  setActivityKind: (kind: "payment" | "draw") => void;
  activityDate: string;
  setActivityDate: (value: string) => void;
  activityAmount: string;
  setActivityAmount: (value: string) => void;
  activityDescription: string;
  setActivityDescription: (value: string) => void;
  fundingAccountId: string;
  setFundingAccountId: (value: string) => void;
  fundingAccounts: Array<{ id: string; name: string; is_active: boolean }>;
  syncPrincipal: boolean;
  setSyncPrincipal: (value: boolean) => void;
  onRecordActivity: () => void;
}> = (props) => {
  return (
    <>
      <Dialog
        open={props.createLoanOpen}
        onOpenChange={props.setCreateLoanOpen}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create a loan</DialogTitle>
            <DialogDescription>
              Creates a debt account with linked loan metadata.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm text-slate-700" htmlFor="loan-name">
                Loan name
              </label>
              <Input
                id="loan-name"
                value={props.loanName}
                onChange={(e) => props.setLoanName(e.target.value)}
                placeholder="e.g., CSN"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="origin">
                Original principal
              </label>
              <Input
                id="origin"
                inputMode="decimal"
                value={props.loanOriginPrincipal}
                onChange={(e) => props.setLoanOriginPrincipal(e.target.value)}
                placeholder="e.g., 100000.00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="current">
                Current principal
              </label>
              <Input
                id="current"
                inputMode="decimal"
                value={props.loanCurrentPrincipal}
                onChange={(e) => props.setLoanCurrentPrincipal(e.target.value)}
                placeholder="Defaults to original"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="rate">
                Interest rate (annual)
              </label>
              <Input
                id="rate"
                inputMode="decimal"
                value={props.loanInterestRateAnnual}
                onChange={(e) =>
                  props.setLoanInterestRateAnnual(e.target.value)
                }
                placeholder="e.g., 0.045"
              />
            </div>
            <div className="space-y-1.5">
              <div className="text-sm text-slate-700">Compounding</div>
              <Tabs
                value={props.loanInterestCompound}
                onValueChange={(val) =>
                  props.setLoanInterestCompound(val as InterestCompound)
                }
              >
                <TabsList className="w-full">
                  <TabsTrigger value={InterestCompound.DAILY}>
                    Daily
                  </TabsTrigger>
                  <TabsTrigger value={InterestCompound.MONTHLY}>
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger value={InterestCompound.YEARLY}>
                    Yearly
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="minpay">
                Minimum payment (optional)
              </label>
              <Input
                id="minpay"
                inputMode="decimal"
                value={props.loanMinimumPayment}
                onChange={(e) => props.setLoanMinimumPayment(e.target.value)}
                placeholder="e.g., 1200.00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="maturity">
                Expected maturity date (optional)
              </label>
              <Input
                id="maturity"
                type="date"
                value={props.loanExpectedMaturityDate}
                onChange={(e) =>
                  props.setLoanExpectedMaturityDate(e.target.value)
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-300 text-slate-800"
              onClick={() => props.setCreateLoanOpen(false)}
              disabled={props.createLoanLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={props.onCreateLoan}
              disabled={props.createLoanLoading}
            >
              {props.createLoanLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.editLoanOpen} onOpenChange={props.setEditLoanOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit loan</DialogTitle>
            <DialogDescription>
              Update interest terms and set the current principal to match your
              lender statement. This updates metadata and does not create a
              transaction.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="edit-origin">
                Original principal
              </label>
              <Input
                id="edit-origin"
                inputMode="decimal"
                value={props.editOriginPrincipal}
                onChange={(e) => props.setEditOriginPrincipal(e.target.value)}
                placeholder="e.g., 100000.00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="edit-current">
                Current principal (real balance)
              </label>
              <Input
                id="edit-current"
                inputMode="decimal"
                value={props.editCurrentPrincipal}
                onChange={(e) => props.setEditCurrentPrincipal(e.target.value)}
                placeholder="e.g., 85600.00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="edit-rate">
                Interest rate (annual %)
              </label>
              <Input
                id="edit-rate"
                inputMode="decimal"
                value={props.editInterestRateAnnual}
                onChange={(e) =>
                  props.setEditInterestRateAnnual(e.target.value)
                }
                placeholder="e.g., 4.20"
              />
            </div>
            <div className="space-y-1.5">
              <div className="text-sm text-slate-700">Compounding</div>
              <Tabs
                value={props.editInterestCompound}
                onValueChange={(val) =>
                  props.setEditInterestCompound(val as InterestCompound)
                }
              >
                <TabsList className="w-full">
                  <TabsTrigger value={InterestCompound.DAILY}>
                    Daily
                  </TabsTrigger>
                  <TabsTrigger value={InterestCompound.MONTHLY}>
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger value={InterestCompound.YEARLY}>
                    Yearly
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="edit-minpay">
                Minimum payment (optional)
              </label>
              <Input
                id="edit-minpay"
                inputMode="decimal"
                value={props.editMinimumPayment}
                onChange={(e) => props.setEditMinimumPayment(e.target.value)}
                placeholder="e.g., 1200.00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="edit-maturity">
                Expected maturity date (optional)
              </label>
              <Input
                id="edit-maturity"
                type="date"
                value={props.editExpectedMaturityDate}
                onChange={(e) =>
                  props.setEditExpectedMaturityDate(e.target.value)
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-300 text-slate-800"
              onClick={() => props.setEditLoanOpen(false)}
              disabled={props.editLoanLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={props.onUpdateLoan}
              disabled={props.editLoanLoading}
            >
              {props.editLoanLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.activityOpen} onOpenChange={props.setActivityOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Record loan activity</DialogTitle>
            <DialogDescription>
              Creates a transfer transaction that automatically shows up as a
              loan event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-sm text-slate-700">Type</div>
              <Tabs
                value={props.activityKind}
                onValueChange={(val) =>
                  props.setActivityKind(val as "payment" | "draw")
                }
              >
                <TabsList className="w-full">
                  <TabsTrigger value="payment">Principal payment</TabsTrigger>
                  <TabsTrigger value="draw">Disbursement</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  className="text-sm text-slate-700"
                  htmlFor="activity-date"
                >
                  Date
                </label>
                <Input
                  id="activity-date"
                  type="date"
                  value={props.activityDate}
                  onChange={(e) => props.setActivityDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-sm text-slate-700"
                  htmlFor="activity-amount"
                >
                  Amount (SEK)
                </label>
                <Input
                  id="activity-amount"
                  inputMode="decimal"
                  value={props.activityAmount}
                  onChange={(e) => props.setActivityAmount(e.target.value)}
                  placeholder="e.g., 1000.00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="funding">
                Funding account
              </label>
              <select
                id="funding"
                className={cn(selectLikeInput, "bg-white")}
                value={props.fundingAccountId}
                onChange={(e) => props.setFundingAccountId(e.target.value)}
              >
                <option value="">Pick an account…</option>
                {props.fundingAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                    {!acc.is_active ? " (archived)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="activity-desc">
                Description (optional)
              </label>
              <Input
                id="activity-desc"
                value={props.activityDescription}
                onChange={(e) => props.setActivityDescription(e.target.value)}
                placeholder={
                  props.activityKind === "payment"
                    ? "Extra payment"
                    : "Additional draw"
                }
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Keep schedule in sync
                </div>
                <p className="text-xs text-slate-600">
                  Updates the loan’s current principal so the amortization
                  schedule reflects this activity.
                </p>
              </div>
              <Switch
                checked={props.syncPrincipal}
                onCheckedChange={props.setSyncPrincipal}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-300 text-slate-800"
              onClick={() => props.setActivityOpen(false)}
              disabled={props.activityLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={props.onRecordActivity}
              disabled={props.activityLoading}
            >
              {props.activityLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
