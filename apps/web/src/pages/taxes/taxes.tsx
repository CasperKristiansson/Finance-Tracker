import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Copy, Loader2, Plus, Receipt } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { z } from "zod";
import { useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { selectToken } from "@/features/auth/authSlice";
import { useAccountsApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { TaxEventType } from "@/types/api";
import type {
  TaxEventListResponse,
  TaxSummaryResponse,
  TaxEventCreateResponse,
  TaxTotalSummaryResponse,
} from "@/types/api";
import {
  taxEventCreateResponseSchema,
  taxEventTypeSchema,
  taxEventListResponseSchema,
  taxSummarySchema,
  taxTotalSummarySchema,
} from "@/types/schemas";

const currency = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });

const monthLabel = (year: number, month: number) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("sv-SE", {
    month: "short",
  });

const isoDate = (value: string) => value.slice(0, 10);

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
};

const formatDisplayDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const createTaxEventSchema = z.object({
  event_type: taxEventTypeSchema,
  account_id: z.string().min(1),
  occurred_at: z.string().min(1),
  amount: z
    .string()
    .min(1)
    .refine((value) => Number(value) > 0, "Amount must be positive"),
  description: z.string().min(1).max(250),
  note: z.string().nullable().optional(),
});

type CreateTaxEventValues = z.infer<typeof createTaxEventSchema>;

const typeTone: Record<TaxEventType, string> = {
  [TaxEventType.PAYMENT]: "bg-rose-100 text-rose-800",
  [TaxEventType.REFUND]: "bg-emerald-100 text-emerald-800",
};

export const Taxes: React.FC = () => {
  const token = useAppSelector(selectToken);
  const { items: accounts, fetchAccounts } = useAccountsApi();

  const currentYear = new Date().getFullYear();
  const [viewMode, setViewMode] = useState<"year" | "total">("year");
  const [year, setYear] = useState(currentYear);
  const [summary, setSummary] = useState<TaxSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [totalSummary, setTotalSummary] =
    useState<TaxTotalSummaryResponse | null>(null);
  const [totalSummaryLoading, setTotalSummaryLoading] = useState(false);
  const [events, setEvents] = useState<TaxEventListResponse | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const closeDetails = () => setDetailsId(null);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    setDetailsId(null);
  }, [year, viewMode]);

  const yearOptions = useMemo(
    () => Array.from({ length: 11 }, (_, idx) => currentYear - idx),
    [currentYear],
  );

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((acc) => acc.is_active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );

  const loadSummary = async (targetYear: number) => {
    if (!token) return;
    setSummaryLoading(true);
    try {
      const { data } = await apiFetch<TaxSummaryResponse>({
        path: "/tax/summary",
        query: { year: targetYear },
        schema: taxSummarySchema,
        token,
      });
      setSummary(data);
    } catch (error) {
      setSummary(null);
      toast.error("Unable to load tax summary", {
        description:
          error instanceof Error ? error.message : "Please try again shortly.",
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadTotalSummary = async () => {
    if (!token) return;
    setTotalSummaryLoading(true);
    try {
      const { data } = await apiFetch<TaxTotalSummaryResponse>({
        path: "/tax/summary/total",
        schema: taxTotalSummarySchema,
        token,
      });
      setTotalSummary(data);
    } catch (error) {
      setTotalSummary(null);
      toast.error("Unable to load total tax summary", {
        description:
          error instanceof Error ? error.message : "Please try again shortly.",
      });
    } finally {
      setTotalSummaryLoading(false);
    }
  };

  const loadEvents = async (range?: { start?: string; end?: string }) => {
    if (!token) return;
    setEventsLoading(true);
    try {
      const limit = 200;
      const maxPages = 50;
      const all: TaxEventListResponse["events"] = [];

      for (let page = 0; page < maxPages; page += 1) {
        const query: Record<string, string | number> = {
          limit,
          offset: page * limit,
        };
        if (range?.start) query.start_date = range.start;
        if (range?.end) query.end_date = range.end;

        const { data } = await apiFetch<TaxEventListResponse>({
          path: "/tax/events",
          query,
          schema: taxEventListResponseSchema,
          token,
        });
        all.push(...data.events);
        if (data.events.length < limit) break;
      }

      setEvents({ events: all });
    } catch (error) {
      setEvents(null);
      toast.error("Unable to load tax events", {
        description:
          error instanceof Error ? error.message : "Please try again shortly.",
      });
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "year") {
      setTotalSummary(null);
      void loadSummary(year);
      const start = new Date(Date.UTC(year, 0, 1)).toISOString();
      const end = new Date(Date.UTC(year + 1, 0, 1)).toISOString();
      void loadEvents({ start, end });
    } else {
      setSummary(null);
      void loadTotalSummary();
      void loadEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, year, viewMode]);

  const form = useForm<CreateTaxEventValues>({
    resolver: zodResolver(createTaxEventSchema),
    defaultValues: {
      event_type: TaxEventType.PAYMENT,
      account_id: "",
      occurred_at: new Date().toISOString().slice(0, 10),
      amount: "",
      description: "Skatteverket",
      note: "",
    },
  });

  const submit = form.handleSubmit(async (values) => {
    if (!token) return;
    setCreating(true);
    try {
      const { data } = await apiFetch<TaxEventCreateResponse>({
        path: "/tax/events",
        method: "POST",
        schema: taxEventCreateResponseSchema,
        token,
        body: {
          account_id: values.account_id,
          occurred_at: new Date(values.occurred_at).toISOString(),
          amount: values.amount,
          event_type: values.event_type,
          description: values.description.trim(),
          note: values.note?.trim() || undefined,
        },
      });
      setDialogOpen(false);
      toast.success("Tax recorded", {
        description: `Created ${data.tax_event.event_type} event.`,
      });
      form.reset({
        event_type: TaxEventType.PAYMENT,
        account_id: "",
        occurred_at: new Date().toISOString().slice(0, 10),
        amount: "",
        description: "Skatteverket",
        note: "",
      });
      if (viewMode === "year") {
        const start = new Date(Date.UTC(year, 0, 1)).toISOString();
        const end = new Date(Date.UTC(year + 1, 0, 1)).toISOString();
        await Promise.all([loadSummary(year), loadEvents({ start, end })]);
      } else {
        await Promise.all([loadTotalSummary(), loadEvents()]);
      }
    } catch (error) {
      toast.error("Unable to create tax event", {
        description:
          error instanceof Error ? error.message : "Please try again shortly.",
      });
    } finally {
      setCreating(false);
    }
  });

  const gradientId = React.useId();

  const selectedEvent = useMemo(() => {
    if (!detailsId) return null;
    return (events?.events ?? []).find((item) => item.id === detailsId) ?? null;
  }, [detailsId, events?.events]);

  const eventAmount = useMemo(() => {
    if (!selectedEvent) return 0;
    const amount = toNumber(selectedEvent.amount);
    const sign = selectedEvent.event_type === TaxEventType.REFUND ? -1 : 1;
    return sign * amount;
  }, [selectedEvent]);

  const monthlyBreakdown = useMemo(() => {
    if (viewMode !== "year") return [];
    const base = Array.from({ length: 12 }, (_, idx) => ({
      month: idx + 1,
      label: monthLabel(year, idx + 1),
      payments: 0,
      refunds: 0,
      net: 0,
    }));

    for (const item of events?.events ?? []) {
      const occurred = new Date(item.occurred_at);
      const monthIdx = occurred.getUTCMonth();
      const amount = toNumber(item.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (monthIdx < 0 || monthIdx > 11) continue;

      if (item.event_type === TaxEventType.PAYMENT) {
        base[monthIdx].payments += amount;
        base[monthIdx].net += amount;
      } else {
        base[monthIdx].refunds -= amount; // negative for charting
        base[monthIdx].net -= amount;
      }
    }

    return base;
  }, [events?.events, year, viewMode]);

  const yearlyBreakdown = useMemo(() => {
    if (viewMode !== "total") return [];
    return (totalSummary?.yearly ?? []).map((row) => ({
      year: row.year,
      label: String(row.year),
      net: toNumber(row.net_tax_paid),
    }));
  }, [totalSummary?.yearly, viewMode]);

  const totals = useMemo(() => {
    if (viewMode === "total") {
      const payments = toNumber(totalSummary?.totals.total_payments);
      const refunds = toNumber(totalSummary?.totals.total_refunds);
      const net = toNumber(totalSummary?.totals.net_tax_paid_all_time);
      return { payments, refunds, net };
    }
    let payments = 0;
    let refunds = 0;
    for (const row of monthlyBreakdown) {
      payments += row.payments;
      refunds += -row.refunds;
    }
    return { payments, refunds, net: payments - refunds };
  }, [monthlyBreakdown, totalSummary?.totals, viewMode]);

  const hasEvents = useMemo(
    () => totals.payments !== 0 || totals.refunds !== 0,
    [totals.payments, totals.refunds],
  );

  const highlights = useMemo(() => {
    const list = events?.events ?? [];
    let lastEventAt: string | null = null;
    let lastEventTimestamp = -Infinity;
    for (const item of list) {
      const ts = Date.parse(item.occurred_at);
      if (!Number.isFinite(ts)) continue;
      if (ts > lastEventTimestamp) {
        lastEventTimestamp = ts;
        lastEventAt = item.occurred_at;
      }
    }

    if (viewMode === "year") {
      const activeMonths = monthlyBreakdown.filter(
        (row) => row.payments !== 0 || row.refunds !== 0,
      ).length;
      const refundMonths = monthlyBreakdown.filter((row) => row.net < 0).length;

      return {
        avgNet: totals.net / 12,
        activePeriods: activeMonths,
        periodLabel: "Months with activity",
        refundPeriods: refundMonths,
        refundLabel: "Refund months",
        eventCount: list.length,
        lastEventAt,
        averageLabel: "Avg net / month",
      };
    }

    const activeYears = yearlyBreakdown.length;
    const yearRange =
      activeYears > 0
        ? `${Math.min(...yearlyBreakdown.map((row) => row.year))}–${Math.max(...yearlyBreakdown.map((row) => row.year))}`
        : "—";

    return {
      avgNet: activeYears > 0 ? totals.net / activeYears : 0,
      activePeriods: activeYears,
      periodLabel: "Years tracked",
      refundPeriods: yearlyBreakdown.filter((row) => row.net < 0).length,
      refundLabel: "Refund years",
      eventCount: list.length,
      lastEventAt,
      averageLabel: "Avg net / year",
      yearRange,
    };
  }, [events?.events, monthlyBreakdown, totals.net, viewMode, yearlyBreakdown]);

  const kpis = useMemo(() => {
    if (viewMode !== "year") {
      return {
        ytd: 0,
        last12: 0,
        largestMonth: null as number | null,
        largestValue: null as number | null,
      };
    }
    if (!summary) {
      return {
        ytd: 0,
        last12: 0,
        largestMonth: null as number | null,
        largestValue: null as number | null,
      };
    }
    return {
      ytd: toNumber(summary.totals.net_tax_paid_ytd),
      last12: toNumber(summary.totals.net_tax_paid_last_12m),
      largestMonth: summary.totals.largest_month ?? null,
      largestValue:
        summary.totals.largest_month_value !== null &&
        summary.totals.largest_month_value !== undefined
          ? toNumber(summary.totals.largest_month_value)
          : null,
    };
  }, [summary, viewMode]);

  const totalKpis = useMemo(() => {
    if (viewMode !== "total") {
      return {
        ytd: 0,
        last12: 0,
        largestYear: null as number | null,
        largestValue: null as number | null,
      };
    }
    if (!totalSummary) {
      return {
        ytd: 0,
        last12: 0,
        largestYear: null,
        largestValue: null,
      };
    }
    return {
      ytd: toNumber(totalSummary.totals.net_tax_paid_ytd),
      last12: toNumber(totalSummary.totals.net_tax_paid_last_12m),
      largestYear: totalSummary.totals.largest_year ?? null,
      largestValue:
        totalSummary.totals.largest_year_value !== null &&
        totalSummary.totals.largest_year_value !== undefined
          ? toNumber(totalSummary.totals.largest_year_value)
          : null,
    };
  }, [totalSummary, viewMode]);

  const isLoading =
    eventsLoading ||
    (viewMode === "year" ? summaryLoading : totalSummaryLoading);

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

  return (
    <MotionPage className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Taxes
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Income tax (Skatteverket)
          </h1>
          <p className="text-sm text-slate-500">
            {viewMode === "year"
              ? "Net tax paid by month (refunds are negative)."
              : "All-time overview by year (refunds are negative)."}{" "}
            Operating reports and cash flow exclude tax.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === "year" ? (
            <select
              className="h-10 rounded border border-slate-200 bg-white px-3 text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : null}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <Button
              size="sm"
              variant={viewMode === "year" ? "default" : "ghost"}
              className="h-8 px-2.5 text-xs"
              onClick={() => setViewMode("year")}
            >
              Year
            </Button>
            <Button
              size="sm"
              variant={viewMode === "total" ? "default" : "ghost"}
              className="h-8 px-2.5 text-xs"
              onClick={() => setViewMode("total")}
            >
              Total
            </Button>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add tax
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {(viewMode === "year"
          ? [
              {
                title: "Payments",
                value: currency(totals.payments),
              },
              {
                title: "Refunds",
                value: currency(-totals.refunds),
              },
              {
                title: "Net tax paid YTD",
                value: currency(kpis.ytd),
              },
              {
                title: "Net tax paid last 12 months",
                value: currency(kpis.last12),
              },
            ]
          : [
              {
                title: "Payments",
                value: currency(totals.payments),
              },
              {
                title: "Refunds",
                value: currency(-totals.refunds),
              },
              {
                title: "Net tax paid all time",
                value: currency(totals.net),
              },
              {
                title: "Net tax paid last 12 months",
                value: currency(totalKpis.last12),
              },
            ]
        ).map((card) => (
          <Card
            key={card.title}
            className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-slate-900">
              {isLoading ? <Skeleton className="h-7 w-32" /> : card.value}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-800">
              {viewMode === "year"
                ? "Net tax paid per month"
                : "Net tax paid per year"}
            </CardTitle>
            <p className="text-xs text-slate-500">
              {viewMode === "year"
                ? kpis.largestMonth && kpis.largestValue !== null
                  ? `Largest: ${monthLabel(year, kpis.largestMonth)} · ${currency(kpis.largestValue)}`
                  : "Refunds are negative."
                : totalKpis.largestYear && totalKpis.largestValue !== null
                  ? `Largest: ${totalKpis.largestYear} · ${currency(totalKpis.largestValue)}`
                  : "Refunds are negative."}
            </p>
          </CardHeader>
          <CardContent className="h-[320px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : !hasEvents ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-600">
                <Receipt className="h-6 w-6 text-slate-500" />
                <p>No tax events yet.</p>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  Add your first tax event
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={
                    viewMode === "year" ? monthlyBreakdown : yearlyBreakdown
                  }
                >
                  <defs>
                    <linearGradient
                      id={`${gradientId}-net-pos`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#fb7185" stopOpacity={0.9} />
                      <stop
                        offset="100%"
                        stopColor="#ef4444"
                        stopOpacity={0.55}
                      />
                    </linearGradient>
                    <linearGradient
                      id={`${gradientId}-net-neg`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                      <stop
                        offset="100%"
                        stopColor="#10b981"
                        stopOpacity={0.55}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    fontSize={12}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value) => currency(Number(value))}
                    labelStyle={{ color: "#0f172a" }}
                  />
                  {viewMode === "year" ? (
                    <Bar dataKey="net" radius={[6, 6, 6, 6]} barSize={16}>
                      {monthlyBreakdown.map((row) => (
                        <Cell
                          key={row.month}
                          fill={
                            row.net >= 0
                              ? `url(#${gradientId}-net-pos)`
                              : `url(#${gradientId}-net-neg)`
                          }
                        />
                      ))}
                    </Bar>
                  ) : (
                    <Bar dataKey="net" radius={[6, 6, 6, 6]} barSize={16}>
                      {yearlyBreakdown.map((row) => (
                        <Cell
                          key={row.year}
                          fill={
                            row.net >= 0
                              ? `url(#${gradientId}-net-pos)`
                              : `url(#${gradientId}-net-neg)`
                          }
                        />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-800">
              Highlights
            </CardTitle>
            <p className="text-xs text-slate-500">
              {viewMode === "year"
                ? `Quick snapshot for ${year}.`
                : "Quick snapshot across all years."}
            </p>
          </CardHeader>
          <CardContent className="h-[320px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : !hasEvents ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-600">
                <p>Record tax events to see highlights.</p>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  Add tax event
                </Button>
              </div>
            ) : (
              <div className="grid h-full grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="text-xs text-slate-500">
                    {highlights.averageLabel}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                    {currency(highlights.avgNet)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="text-xs text-slate-500">
                    {highlights.periodLabel}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                    {highlights.activePeriods}
                  </div>
                  {"yearRange" in highlights ? (
                    <div className="mt-1 text-xs text-slate-500">
                      {highlights.yearRange}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="text-xs text-slate-500">
                    {highlights.refundLabel}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                    {highlights.refundPeriods}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="text-xs text-slate-500">Events</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                    {highlights.eventCount}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Last event:{" "}
                    {highlights.lastEventAt
                      ? formatDisplayDate(highlights.lastEventAt)
                      : "—"}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-800">
            {viewMode === "year" ? `Events (${year})` : "Events (all time)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading && !events?.events?.length ? (
            <Skeleton className="h-32 w-full" />
          ) : null}
          {!events?.events?.length && !eventsLoading ? (
            <p className="text-sm text-slate-500">
              No tax events recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(events?.events ?? []).map((item) => {
                  const sign = item.event_type === TaxEventType.REFUND ? -1 : 1;
                  const amount = sign * toNumber(item.amount);
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-slate-50",
                        detailsId === item.id ? "bg-slate-50" : undefined,
                      )}
                      onClick={() => setDetailsId(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDetailsId(item.id);
                        }
                      }}
                      tabIndex={0}
                    >
                      <TableCell className="whitespace-nowrap">
                        {new Date(item.occurred_at).toLocaleDateString("sv-SE")}
                      </TableCell>
                      <TableCell className="min-w-[240px]">
                        <div className="font-medium text-slate-900">
                          {item.description || item.authority || "Tax"}
                        </div>
                        {item.note ? (
                          <div className="text-xs text-slate-500">
                            {item.note}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{item.account_name ?? "—"}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                            typeTone[item.event_type],
                          )}
                        >
                          {item.event_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {currency(amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={Boolean(detailsId)}
        onOpenChange={(open) => {
          if (!open) closeDetails();
        }}
      >
        <SheetContent side="right" className="bg-white sm:max-w-lg">
          {selectedEvent ? (
            <>
              <SheetHeader className="border-b border-slate-100">
                <SheetTitle className="truncate text-lg">
                  {selectedEvent.description ||
                    selectedEvent.authority ||
                    "Tax event"}
                </SheetTitle>
                <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDisplayDate(selectedEvent.occurred_at)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {selectedEvent.account_name ?? "Unknown account"}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                      typeTone[selectedEvent.event_type],
                    )}
                  >
                    {selectedEvent.event_type}
                  </span>
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div
                  className={cn(
                    "rounded-lg border p-4",
                    eventAmount >= 0
                      ? "border-rose-100 bg-rose-50"
                      : "border-emerald-100 bg-emerald-50",
                  )}
                >
                  <div className="text-xs text-slate-600">
                    Net impact (refunds are negative)
                  </div>
                  <div
                    className={cn(
                      "mt-2 text-2xl font-semibold text-slate-900 tabular-nums",
                      eventAmount >= 0 ? "text-rose-700" : "text-emerald-700",
                    )}
                  >
                    {currency(eventAmount)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="text-xs text-slate-500">Occurred</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {isoDate(selectedEvent.occurred_at)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-white p-3 text-right">
                    <div className="text-xs text-slate-500">Amount</div>
                    <div className="mt-1 font-semibold text-slate-900 tabular-nums">
                      {currency(eventAmount)}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="text-xs text-slate-500">Authority</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {selectedEvent.authority || "Skatteverket"}
                  </div>
                  {selectedEvent.note ? (
                    <>
                      <div className="mt-3 text-xs text-slate-500">Note</div>
                      <div className="mt-1 text-sm text-slate-700">
                        {selectedEvent.note}
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500">
                        Transaction id
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-900">
                        {selectedEvent.transaction_id}
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
                          selectedEvent.transaction_id,
                        )
                      }
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500">Event id</div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-900">
                        {selectedEvent.id}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        void copyValue("Event id", selectedEvent.id)
                      }
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 text-sm text-slate-600">
              Select a tax event to see details.
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add tax event</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Type
                <Controller
                  control={form.control}
                  name="event_type"
                  render={({ field }) => (
                    <select
                      className="rounded border border-slate-200 px-3 py-2"
                      {...field}
                    >
                      <option value="payment">Payment</option>
                      <option value="refund">Refund</option>
                    </select>
                  )}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Account
                <Controller
                  control={form.control}
                  name="account_id"
                  render={({ field }) => (
                    <select
                      className="rounded border border-slate-200 px-3 py-2"
                      {...field}
                    >
                      <option value="">Pick account</option>
                      {accountOptions.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Date
                <input
                  type="date"
                  className="rounded border border-slate-200 px-3 py-2"
                  {...form.register("occurred_at")}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Amount (SEK)
                <input
                  inputMode="decimal"
                  className="rounded border border-slate-200 px-3 py-2"
                  placeholder="0"
                  {...form.register("amount")}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Description
              <input
                className="rounded border border-slate-200 px-3 py-2"
                {...form.register("description")}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Note (optional)
              <textarea
                className="min-h-[90px] rounded border border-slate-200 px-3 py-2"
                {...form.register("note")}
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MotionPage>
  );
};
