import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Receipt } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
} from "@/types/api";
import {
  taxEventCreateResponseSchema,
  taxEventTypeSchema,
  taxEventListResponseSchema,
  taxSummarySchema,
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

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
};

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
  const [year, setYear] = useState(currentYear);
  const [summary, setSummary] = useState<TaxSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [events, setEvents] = useState<TaxEventListResponse | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

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

  const loadEvents = async () => {
    if (!token) return;
    setEventsLoading(true);
    try {
      const { data } = await apiFetch<TaxEventListResponse>({
        path: "/tax/events",
        schema: taxEventListResponseSchema,
        token,
      });
      setEvents(data);
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
    void loadSummary(year);
    void loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, year]);

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
      await Promise.all([loadSummary(year), loadEvents()]);
    } catch (error) {
      toast.error("Unable to create tax event", {
        description:
          error instanceof Error ? error.message : "Please try again shortly.",
      });
    } finally {
      setCreating(false);
    }
  });

  const chartData = useMemo(() => {
    if (!summary) return [];
    return summary.monthly.map((row) => ({
      label: monthLabel(summary.year, row.month),
      value: toNumber(row.net_tax_paid),
    }));
  }, [summary]);

  const kpis = useMemo(() => {
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
  }, [summary]);

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
            Net tax paid by month (refunds are negative). Operating reports and
            cash flow exclude tax.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add tax
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            title: "Net tax paid YTD",
            value: currency(kpis.ytd),
          },
          {
            title: "Net tax paid last 12 months",
            value: currency(kpis.last12),
          },
          {
            title: "Largest month",
            value:
              kpis.largestMonth && kpis.largestValue !== null
                ? `${monthLabel(year, kpis.largestMonth)} · ${currency(
                    kpis.largestValue,
                  )}`
                : "—",
          },
        ].map((card) => (
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
              {summaryLoading ? <Skeleton className="h-7 w-32" /> : card.value}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-800">
            Net tax paid per month
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {summaryLoading ? (
            <Skeleton className="h-full w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-600">
              <Receipt className="h-6 w-6 text-slate-500" />
              <p>No tax events yet.</p>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                Add your first tax event
              </Button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => currency(Number(value))}
                  labelStyle={{ color: "#0f172a" }}
                />
                <Bar dataKey="value" fill="#0f172a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-800">Events</CardTitle>
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
                    <TableRow key={item.id}>
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
