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
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useAppSelector } from "@/app/hooks";
import { EmptyState } from "@/components/composed/empty-state";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageRoutes } from "@/data/routes";
import { selectIsDemo, selectToken } from "@/features/auth/authSlice";
import { useAccountsApi, useLoansApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import { currency, formatDateTime as formatDateTimeLocale } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountWithBalance, LoanEventRead } from "@/types/api";
import { AccountType, InterestCompound, LoanEventType } from "@/types/api";

const selectLikeInput =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
const LOAN_EVENTS_PAGE_LIMIT = 200;
const LOAN_ACTIVITY_MONTHS = 12;

type LoanActivityMonthBucket = {
  key: string;
  label: string;
  principalPaid: number;
  disbursed: number;
  interestAndFees: number;
  eventCount: number;
};

const formatCurrency = (value: number) => currency(value);

const formatPercent = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "—";
  return `${parsed.toFixed(2)}%`;
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

const sumPrincipalPayments = (events: LoanEventRead[] | undefined) => {
  if (!events?.length) return 0;
  return events.reduce((sum, event) => {
    if (event.event_type !== LoanEventType.PAYMENT_PRINCIPAL) return sum;
    const amount = Number(event.amount);
    return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
  }, 0);
};

const toMonthKey = (date: Date) => {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
};

const buildLoanActivityBuckets = (months = LOAN_ACTIVITY_MONTHS) => {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );

  const buckets: LoanActivityMonthBucket[] = [];
  for (let i = 0; i < months; i += 1) {
    const bucketDate = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
    );
    buckets.push({
      key: toMonthKey(bucketDate),
      label: formatter.format(bucketDate),
      principalPaid: 0,
      disbursed: 0,
      interestAndFees: 0,
      eventCount: 0,
    });
  }

  return buckets;
};

const aggregateLoanActivityByMonth = (
  sourceEvents: LoanEventRead[] | undefined,
  months = LOAN_ACTIVITY_MONTHS,
) => {
  const buckets = buildLoanActivityBuckets(months);
  const byMonth = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const event of sourceEvents ?? []) {
    const amount = Number(event.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const occurredAt = new Date(event.occurred_at);
    if (Number.isNaN(occurredAt.getTime())) continue;

    const key = toMonthKey(occurredAt);
    const bucket = byMonth.get(key);
    if (!bucket) continue;

    if (event.event_type === LoanEventType.PAYMENT_PRINCIPAL) {
      bucket.principalPaid += amount;
      bucket.eventCount += 1;
      continue;
    }
    if (event.event_type === LoanEventType.DISBURSEMENT) {
      bucket.disbursed += amount;
      bucket.eventCount += 1;
      continue;
    }
    if (
      event.event_type === LoanEventType.INTEREST_ACCRUAL ||
      event.event_type === LoanEventType.PAYMENT_INTEREST ||
      event.event_type === LoanEventType.FEE
    ) {
      bucket.interestAndFees += amount;
      bucket.eventCount += 1;
    }
  }

  return buckets;
};

const getLoanCurrentPrincipal = (account: AccountWithBalance) => {
  const value = account.loan?.current_principal ?? account.balance ?? null;
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? Math.max(0, num) : null;
};

const getLoanOriginPrincipal = (account: AccountWithBalance) => {
  const origin = account.loan?.origin_principal;
  const current = getLoanCurrentPrincipal(account);
  if (origin === undefined || origin === null) return current;
  const num = Number(origin);
  if (!Number.isFinite(num)) return current;
  return Math.max(0, num);
};

const getLoanPaidDown = (
  account: AccountWithBalance,
  accountEvents?: LoanEventRead[],
) => {
  const loanCreatedAtRaw = account.loan?.created_at;
  const loanCreatedAt = loanCreatedAtRaw
    ? Date.parse(loanCreatedAtRaw)
    : Number.NaN;
  const scopedEvents =
    Number.isFinite(loanCreatedAt) && accountEvents
      ? accountEvents.filter((event) => {
          const occurredAt = Date.parse(event.occurred_at);
          return Number.isFinite(occurredAt) && occurredAt >= loanCreatedAt;
        })
      : accountEvents;

  const principalPayments = sumPrincipalPayments(scopedEvents);
  const origin = getLoanOriginPrincipal(account);
  const current = getLoanCurrentPrincipal(account);
  const balanceDeltaPaidDown =
    origin !== null && current !== null ? Math.max(0, origin - current) : 0;
  return Math.max(principalPayments, balanceDeltaPaidDown);
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
  const isDemo = useAppSelector(selectIsDemo);
  const {
    items: accounts,
    loading: accountsLoading,
    error: accountsError,
    includeInactive,
    fetchAccounts,
  } = useAccountsApi();
  const { events, loading, error, fetchLoanEvents } = useLoansApi();

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
    fetchLoanEvents({ accountId, limit: LOAN_EVENTS_PAGE_LIMIT, offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    setLoanEventDetailsId(null);
  }, [accountId]);

  const loanAccounts = useMemo(
    () => accounts.filter((acc) => acc.account_type === AccountType.DEBT),
    [accounts],
  );

  useEffect(() => {
    if (accountId) return;
    for (const account of loanAccounts) {
      const existing = events[account.id];
      const isLoadingEvents = loading[`loan-events-${account.id}`];
      if (existing !== undefined || isLoadingEvents) continue;
      fetchLoanEvents({
        accountId: account.id,
        limit: LOAN_EVENTS_PAGE_LIMIT,
        offset: 0,
      });
    }
  }, [accountId, events, fetchLoanEvents, loading, loanAccounts]);

  const selectedAccount = useMemo(() => {
    if (!accountId) return null;
    return accounts.find((acc) => acc.id === accountId) ?? null;
  }, [accountId, accounts]);

  const selectedLoan = selectedAccount?.loan;
  const selectedOriginPrincipal = useMemo(() => {
    if (!selectedAccount || !selectedLoan) return null;
    return getLoanOriginPrincipal(selectedAccount);
  }, [selectedAccount, selectedLoan]);
  const selectedCurrentPrincipal = useMemo(() => {
    if (!selectedAccount || !selectedLoan) return null;
    return getLoanCurrentPrincipal(selectedAccount);
  }, [selectedAccount, selectedLoan]);
  const accountEvents = accountId ? events[accountId] : undefined;
  const selectedPaidDown = useMemo(() => {
    if (!selectedAccount || !selectedLoan) return null;
    return getLoanPaidDown(selectedAccount, accountEvents);
  }, [accountEvents, selectedAccount, selectedLoan]);
  const selectedPaidDownPct = useMemo(() => {
    if (
      selectedPaidDown === null ||
      selectedOriginPrincipal === null ||
      selectedOriginPrincipal <= 0
    ) {
      return null;
    }
    return Math.min(
      100,
      Math.max(0, (selectedPaidDown / selectedOriginPrincipal) * 100),
    );
  }, [selectedOriginPrincipal, selectedPaidDown]);
  const eventsLoading = accountId ? loading[`loan-events-${accountId}`] : false;

  const totalPrincipal = useMemo(() => {
    return loanAccounts.reduce((sum, acc) => {
      const principal = getLoanCurrentPrincipal(acc);
      return sum + (principal ?? 0);
    }, 0);
  }, [loanAccounts]);

  const totalOriginPrincipal = useMemo(() => {
    return loanAccounts.reduce((sum, acc) => {
      const origin = getLoanOriginPrincipal(acc);
      return sum + (origin ?? 0);
    }, 0);
  }, [loanAccounts]);

  const totalPaidDown = useMemo(
    () =>
      loanAccounts.reduce(
        (sum, account) => sum + getLoanPaidDown(account, events[account.id]),
        0,
      ),
    [events, loanAccounts],
  );

  const loanProgressData = useMemo(() => {
    return loanAccounts
      .map((acc) => {
        const current = getLoanCurrentPrincipal(acc) ?? 0;
        const paid = getLoanPaidDown(acc, events[acc.id]);
        return {
          name: acc.name,
          remaining: Math.max(0, current),
          paid,
        };
      })
      .filter(
        (item) =>
          Number.isFinite(item.remaining) &&
          Number.isFinite(item.paid) &&
          (item.remaining > 0 || item.paid > 0),
      );
  }, [events, loanAccounts]);

  const allLoanEvents = useMemo(
    () => loanAccounts.flatMap((account) => events[account.id] ?? []),
    [events, loanAccounts],
  );

  const totalPrincipalPaid12m = useMemo(
    () =>
      aggregateLoanActivityByMonth(allLoanEvents).reduce(
        (sum, item) => sum + item.principalPaid,
        0,
      ),
    [allLoanEvents],
  );

  const totalDisbursed12m = useMemo(
    () =>
      aggregateLoanActivityByMonth(allLoanEvents).reduce(
        (sum, item) => sum + item.disbursed,
        0,
      ),
    [allLoanEvents],
  );

  const totalInterestAndFees12m = useMemo(
    () =>
      aggregateLoanActivityByMonth(allLoanEvents).reduce(
        (sum, item) => sum + item.interestAndFees,
        0,
      ),
    [allLoanEvents],
  );

  const loanActivityByMonthData = useMemo(
    () => aggregateLoanActivityByMonth(allLoanEvents),
    [allLoanEvents],
  );

  const loanActivityByAccountData = useMemo(() => {
    return loanAccounts
      .map((account) => {
        const monthly = aggregateLoanActivityByMonth(events[account.id]);
        const principalPaid = monthly.reduce(
          (sum, item) => sum + item.principalPaid,
          0,
        );
        const disbursed = monthly.reduce(
          (sum, item) => sum + item.disbursed,
          0,
        );
        const interestAndFees = monthly.reduce(
          (sum, item) => sum + item.interestAndFees,
          0,
        );
        const total = principalPaid + disbursed + interestAndFees;

        return {
          name: account.name,
          principalPaid,
          disbursed,
          interestAndFees,
          total,
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [events, loanAccounts]);

  const selectedLoanActivityByMonthData = useMemo(
    () => aggregateLoanActivityByMonth(accountEvents),
    [accountEvents],
  );

  const selectedLoanActivityMixData = useMemo(() => {
    const monthly = aggregateLoanActivityByMonth(accountEvents);
    const principalPaid = monthly.reduce(
      (sum, item) => sum + item.principalPaid,
      0,
    );
    const disbursed = monthly.reduce((sum, item) => sum + item.disbursed, 0);
    const interestAndFees = monthly.reduce(
      (sum, item) => sum + item.interestAndFees,
      0,
    );
    return [
      { name: "Principal paid", amount: principalPaid },
      { name: "Disbursed", amount: disbursed },
      { name: "Interest + fees", amount: interestAndFees },
    ].filter((item) => item.amount > 0);
  }, [accountEvents]);

  const refreshLoanData = () => {
    if (!accountId) return;
    fetchLoanEvents({ accountId, limit: LOAN_EVENTS_PAGE_LIMIT, offset: 0 });
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
    if (isDemo) {
      toast.info("Demo mode", {
        description: "Loan creation is disabled in demo mode.",
      });
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
      const created = await apiFetch<AccountWithBalance>(
        buildEndpointRequest("createAccount", {
          token,
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
        }),
      );

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
    if (isDemo) {
      toast.info("Demo mode", {
        description: "Recording loan activity is disabled in demo mode.",
      });
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
    const apiKind = activityKind === "payment" ? "payment" : "disbursement";

    setActivityLoading(true);
    try {
      await apiFetch(
        buildEndpointRequest("createLoanActivity", {
          pathParams: { accountId },
          token,
          body: {
            kind: apiKind,
            funding_account_id: fundingAccountId,
            amount,
            occurred_at: occurredAtIso,
            description: activityDescription.trim()
              ? activityDescription.trim()
              : apiKind === "payment"
                ? "Loan principal payment"
                : "Loan disbursement",
            sync_principal: syncPrincipal,
          },
        }),
      );

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
    if (isDemo) {
      toast.info("Demo mode", {
        description: "Updating loans is disabled in demo mode.",
      });
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
      await apiFetch(
        buildEndpointRequest("updateLoan", {
          pathParams: { accountId },
          token,
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
        }),
      );

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
            Track balances and loan events for each loan.
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

      <motion.div
        variants={fadeInUp}
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          label="Total principal"
          value={formatCurrency(totalPrincipal)}
          hint={`${loanAccounts.length} loans`}
        />
        <SummaryCard
          label="Principal paid down"
          value={formatCurrency(totalPaidDown)}
          hint={
            totalOriginPrincipal > 0
              ? `${Math.round(
                  Math.min(
                    100,
                    Math.max(0, (totalPaidDown / totalOriginPrincipal) * 100),
                  ),
                )}% of original`
              : "Based on loan events"
          }
        />
        <SummaryCard
          label="Paid (12 months)"
          value={formatCurrency(totalPrincipalPaid12m)}
          hint="Principal payments"
        />
        <SummaryCard
          label="Drawn (12 months)"
          value={formatCurrency(totalDisbursed12m)}
          hint={`Interest + fees ${formatCurrency(totalInterestAndFees12m)}`}
        />
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="border-slate-200 shadow-[0_10px_40px_-26px_rgba(15,23,42,0.35)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-900">
              Principal vs. paid down
            </CardTitle>
            <p className="text-xs text-slate-500">
              How much of each loan remains versus what’s already been paid.
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full">
              {loanProgressData.length ? (
                <ChartContainer
                  config={{
                    paid: {
                      label: "Paid down",
                      color: "hsl(142.1 76.2% 36.3%)",
                    },
                    remaining: {
                      label: "Remaining",
                      color: "hsl(213.8 93.9% 67.8%)",
                    },
                  }}
                  className="h-full w-full"
                >
                  <BarChart
                    data={loanProgressData}
                    margin={{ left: -12, right: 4 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#64748b" }}
                    />
                    <YAxis
                      tickFormatter={(value) =>
                        new Intl.NumberFormat("sv-SE", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(value)
                      }
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => {
                            if (typeof value !== "number") return null;
                            return (
                              <div className="flex w-full items-center justify-between gap-3">
                                <span className="text-slate-600">{name}</span>
                                <span className="font-semibold text-slate-900 tabular-nums">
                                  {formatCurrency(value)}
                                </span>
                              </div>
                            );
                          }}
                          hideLabel
                        />
                      }
                    />
                    <Bar
                      dataKey="paid"
                      stackId="progress"
                      fill="var(--color-paid)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="remaining"
                      stackId="progress"
                      fill="var(--color-remaining)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
                  Add loans to visualize payoff progress.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-3 xl:grid-cols-2">
        <motion.div variants={fadeInUp}>
          <Card className="border-slate-200 shadow-[0_10px_40px_-26px_rgba(15,23,42,0.35)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Loan activity (last 12 months)
              </CardTitle>
              <p className="text-xs text-slate-500">
                Principal payments, disbursements, and interest/fees.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full">
                {loanActivityByMonthData.some(
                  (row) =>
                    row.principalPaid > 0 ||
                    row.disbursed > 0 ||
                    row.interestAndFees > 0,
                ) ? (
                  <ChartContainer
                    config={{
                      principalPaid: {
                        label: "Principal paid",
                        color: "hsl(142.1 76.2% 36.3%)",
                      },
                      disbursed: {
                        label: "Disbursed",
                        color: "hsl(221.2 83.2% 53.3%)",
                      },
                      interestAndFees: {
                        label: "Interest + fees",
                        color: "hsl(38 92% 50%)",
                      },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={loanActivityByMonthData}
                      margin={{ left: -12, right: 8 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#64748b" }}
                      />
                      <YAxis
                        tickFormatter={(value) =>
                          new Intl.NumberFormat("sv-SE", {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(value)
                        }
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => {
                              if (typeof value !== "number") return null;
                              return (
                                <div className="flex w-full items-center justify-between gap-3">
                                  <span className="text-slate-600">{name}</span>
                                  <span className="font-semibold text-slate-900 tabular-nums">
                                    {formatCurrency(value)}
                                  </span>
                                </div>
                              );
                            }}
                            hideLabel
                          />
                        }
                      />
                      <Bar
                        dataKey="principalPaid"
                        stackId="monthlyLoanActivity"
                        fill="var(--color-principalPaid)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="disbursed"
                        stackId="monthlyLoanActivity"
                        fill="var(--color-disbursed)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="interestAndFees"
                        stackId="monthlyLoanActivity"
                        fill="var(--color-interestAndFees)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
                    No loan activity in the last 12 months.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-slate-200 shadow-[0_10px_40px_-26px_rgba(15,23,42,0.35)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Most active loans (last 12 months)
              </CardTitle>
              <p className="text-xs text-slate-500">
                Accounts with the highest posted loan movement.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full">
                {loanActivityByAccountData.length ? (
                  <ChartContainer
                    config={{
                      principalPaid: {
                        label: "Principal paid",
                        color: "hsl(142.1 76.2% 36.3%)",
                      },
                      disbursed: {
                        label: "Disbursed",
                        color: "hsl(221.2 83.2% 53.3%)",
                      },
                      interestAndFees: {
                        label: "Interest + fees",
                        color: "hsl(38 92% 50%)",
                      },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={loanActivityByAccountData}
                      margin={{ left: -12, right: 8 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#64748b" }}
                      />
                      <YAxis
                        tickFormatter={(value) =>
                          new Intl.NumberFormat("sv-SE", {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(value)
                        }
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => {
                              if (typeof value !== "number") return null;
                              return (
                                <div className="flex w-full items-center justify-between gap-3">
                                  <span className="text-slate-600">{name}</span>
                                  <span className="font-semibold text-slate-900 tabular-nums">
                                    {formatCurrency(value)}
                                  </span>
                                </div>
                              );
                            }}
                            hideLabel
                          />
                        }
                      />
                      <Bar
                        dataKey="principalPaid"
                        stackId="loanMixByAccount"
                        fill="var(--color-principalPaid)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="disbursed"
                        stackId="loanMixByAccount"
                        fill="var(--color-disbursed)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="interestAndFees"
                        stackId="loanMixByAccount"
                        fill="var(--color-interestAndFees)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
                    Not enough activity to build account-level insights yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {accountsLoading ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : loanAccounts.length ? (
          loanAccounts.map((acc) => {
            const current = getLoanCurrentPrincipal(acc) ?? 0;
            const origin = getLoanOriginPrincipal(acc);
            const rate = acc.loan?.interest_rate_annual ?? null;
            const minPay = acc.loan?.minimum_payment ?? null;
            const compound = acc.loan?.interest_compound ?? null;
            const paidDown = getLoanPaidDown(acc, events[acc.id]);
            const paidDownPct =
              origin !== null && origin > 0
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
                    </div>

                    {origin !== null && origin > 0 ? (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Paid down</span>
                          <span className="font-medium tabular-nums">
                            {Math.round(paidDownPct ?? 0)}%
                          </span>
                        </div>
                        <Progress
                          value={paidDownPct ?? 0}
                          className="mt-2 h-2"
                        />
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span className="tabular-nums">
                            {formatCurrency(paidDown)} paid
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
                balances and loan events.
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
                  Current loan balance and recorded loan events.
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
              {eventsLoading ? (
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
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <SummaryCard
                label="Current principal"
                value={
                  selectedCurrentPrincipal !== null
                    ? formatCurrency(selectedCurrentPrincipal)
                    : "—"
                }
                hint="Current outstanding amount"
              />
              <SummaryCard
                label="Original principal"
                value={
                  selectedOriginPrincipal !== null
                    ? formatCurrency(selectedOriginPrincipal)
                    : "—"
                }
                hint="Initial baseline"
              />
              <SummaryCard
                label="Interest rate"
                value={formatPercent(
                  selectedAccount.loan?.interest_rate_annual,
                )}
                hint="Annual rate"
              />
              <SummaryCard
                label="Paid down"
                value={
                  selectedPaidDown !== null
                    ? formatCurrency(selectedPaidDown)
                    : "—"
                }
                hint={
                  selectedPaidDownPct !== null
                    ? `${Math.round(selectedPaidDownPct)}% of original`
                    : "From principal events since loan setup and balance deltas"
                }
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
            </div>

            {(accountsError || error) && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {accountsError || error}
              </div>
            )}

            <div className="grid gap-3 xl:grid-cols-2">
              <Card className="border-slate-200 shadow-[0_10px_40px_-26px_rgba(15,23,42,0.35)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Activity trend (last 12 months)
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Monthly principal payments, disbursements, and
                    interest/fees.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-56 w-full">
                    {selectedLoanActivityByMonthData.some(
                      (row) =>
                        row.principalPaid > 0 ||
                        row.disbursed > 0 ||
                        row.interestAndFees > 0,
                    ) ? (
                      <ChartContainer
                        config={{
                          principalPaid: {
                            label: "Principal paid",
                            color: "hsl(142.1 76.2% 36.3%)",
                          },
                          disbursed: {
                            label: "Disbursed",
                            color: "hsl(221.2 83.2% 53.3%)",
                          },
                          interestAndFees: {
                            label: "Interest + fees",
                            color: "hsl(38 92% 50%)",
                          },
                        }}
                        className="h-full w-full"
                      >
                        <BarChart
                          data={selectedLoanActivityByMonthData}
                          margin={{ left: -12, right: 8 }}
                        >
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#64748b" }}
                          />
                          <YAxis
                            tickFormatter={(value) =>
                              new Intl.NumberFormat("sv-SE", {
                                notation: "compact",
                                maximumFractionDigits: 1,
                              }).format(value)
                            }
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value, name) => {
                                  if (typeof value !== "number") return null;
                                  return (
                                    <div className="flex w-full items-center justify-between gap-3">
                                      <span className="text-slate-600">
                                        {name}
                                      </span>
                                      <span className="font-semibold text-slate-900 tabular-nums">
                                        {formatCurrency(value)}
                                      </span>
                                    </div>
                                  );
                                }}
                                hideLabel
                              />
                            }
                          />
                          <Bar
                            dataKey="principalPaid"
                            stackId="selectedLoanMonthly"
                            fill="var(--color-principalPaid)"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="disbursed"
                            stackId="selectedLoanMonthly"
                            fill="var(--color-disbursed)"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="interestAndFees"
                            stackId="selectedLoanMonthly"
                            fill="var(--color-interestAndFees)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
                        No recorded loan activity in the last 12 months.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-[0_10px_40px_-26px_rgba(15,23,42,0.35)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Activity composition (last 12 months)
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    How this loan changed over the recent year.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-56 w-full">
                    {selectedLoanActivityMixData.length ? (
                      <ChartContainer
                        config={{
                          amount: {
                            label: "Amount",
                            color: "hsl(217.2 91.2% 59.8%)",
                          },
                        }}
                        className="h-full w-full"
                      >
                        <BarChart
                          data={selectedLoanActivityMixData}
                          layout="vertical"
                          margin={{ left: 10, right: 12 }}
                        >
                          <CartesianGrid
                            horizontal={false}
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            type="number"
                            tickFormatter={(value) =>
                              new Intl.NumberFormat("sv-SE", {
                                notation: "compact",
                                maximumFractionDigits: 1,
                              }).format(value)
                            }
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={108}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#64748b" }}
                          />
                          <Tooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value) => {
                                  if (typeof value !== "number") return null;
                                  return (
                                    <span className="font-semibold text-slate-900 tabular-nums">
                                      {formatCurrency(value)}
                                    </span>
                                  );
                                }}
                                hideLabel
                              />
                            }
                          />
                          <Bar
                            dataKey="amount"
                            fill="var(--color-amount)"
                            radius={6}
                          />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
                        Add loan-linked transactions to see composition.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Loan events
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Recorded loan activity from posted transactions.
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
                            <TableHead className="px-3">Transaction</TableHead>
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
                  <EmptyState
                    className="rounded-lg"
                    title="No events yet."
                    description="Events appear when transactions post against this loan."
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
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
                    }
                  />
                )}
              </CardContent>
            </Card>
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
