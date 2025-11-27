import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccountsApi, useCategoriesApi, useReportsApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { useTransactionsApi } from "@/hooks/use-api";
import {
  selectTransactions,
  selectTransactionsLoading,
} from "@/features/transactions/transactionsSlice";
import { useAppSelector } from "@/app/hooks";
import type { TransactionRead } from "@/types/api";
import type {
  NetWorthPoint,
  ReportFilters,
  QuarterlyReportEntry,
} from "@/types/api";

type Granularity = "monthly" | "quarterly" | "yearly" | "custom";

const currency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export const Reports: React.FC = () => {
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();
  const {
    fetchTransactions,
    items: transactionItems,
    loading: transactionsLoading,
  } = useTransactionsApi();
  const globalTransactions = useAppSelector(selectTransactions);
  const globalTransactionsLoading = useAppSelector(selectTransactionsLoading);
  const {
    monthly,
    yearly,
    quarterly,
    custom,
    netWorth,
    fetchMonthlyReport,
    fetchYearlyReport,
    fetchQuarterlyReport,
    fetchCustomReport,
    fetchNetWorthReport,
    exportReport,
  } = useReportsApi();

  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [compare, setCompare] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  const filters: ReportFilters = useMemo(
    () => ({
      year: new Date(dateRange.start).getFullYear(),
      accountIds: selectedAccounts,
      categoryIds: selectedCategories,
    }),
    [dateRange.start, selectedAccounts, selectedCategories],
  );

  useEffect(() => {
    if (granularity === "monthly") fetchMonthlyReport(filters);
    if (granularity === "yearly") fetchYearlyReport(filters);
    if (granularity === "quarterly") fetchQuarterlyReport(filters);
    if (granularity === "custom") {
      fetchCustomReport({
        start_date: dateRange.start,
        end_date: dateRange.end,
        accountIds: selectedAccounts,
        categoryIds: selectedCategories,
      });
    }
  }, [
    granularity,
    fetchMonthlyReport,
    fetchYearlyReport,
    fetchQuarterlyReport,
    fetchCustomReport,
    fetchNetWorthReport,
    filters,
    dateRange,
    selectedAccounts,
    selectedCategories,
  ]);

  const toggleValue = (list: string[], id: string) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

  const chartData = useMemo(() => {
    if (granularity === "monthly") {
      return (monthly.data || []).map((row) => ({
        label: new Date(row.period).toLocaleString("en-US", { month: "short" }),
        rawLabel: row.period,
        income: Number(row.income),
        expense: Math.abs(Number(row.expense)),
        net: Number(row.net),
      }));
    }
    if (granularity === "yearly") {
      return (yearly.data || []).map((row) => ({
        label: row.year,
        rawLabel: String(row.year),
        income: Number(row.income),
        expense: Math.abs(Number(row.expense)),
        net: Number(row.net),
      }));
    }
    if (granularity === "quarterly") {
      return (quarterly.data as QuarterlyReportEntry[]).map((row) => ({
        label: `Q${row.quarter} ${row.year}`,
        rawLabel: `Q${row.quarter}-${row.year}`,
        income: Number(row.income),
        expense: Math.abs(Number(row.expense)),
        net: Number(row.net),
      }));
    }
    return (custom.data || []).map((row) => ({
      label: new Date(row.period).toLocaleDateString(),
      rawLabel: row.period,
      income: Number(row.income),
      expense: Math.abs(Number(row.expense)),
      net: Number(row.net),
    }));
  }, [granularity, monthly.data, yearly.data, quarterly.data, custom.data]);

  const activeLoading =
    monthly.loading ||
    yearly.loading ||
    quarterly.loading ||
    custom.loading ||
    netWorth.loading;

  const exportCurrent = (format: "csv" | "xlsx") => {
    exportReport({
      granularity: granularity === "custom" ? "monthly" : granularity,
      format,
      year: granularity === "yearly" ? undefined : filters.year,
      start_date: granularity === "custom" ? dateRange.start : undefined,
      end_date: granularity === "custom" ? dateRange.end : undefined,
      accountIds: selectedAccounts,
      categoryIds: selectedCategories,
    });
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Granularity
              </span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as Granularity)}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom range</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Compare
              </span>
              <Button
                variant={compare ? "default" : "outline"}
                size="sm"
                onClick={() => setCompare((prev) => !prev)}
              >
                {compare ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Compare enabled
                  </span>
                ) : (
                  "Compare vs prior"
                )}
              </Button>
            </div>

            {granularity === "custom" ? (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, start: e.target.value }))
                  }
                  className="w-40"
                />
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="w-40"
                />
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCurrent("csv")}
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCurrent("xlsx")}
              >
                Export XLSX
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Accounts
              </span>
              <div className="flex flex-wrap gap-2">
                {accounts.map((acc) => (
                  <Badge
                    key={acc.id}
                    variant={
                      selectedAccounts.includes(acc.id) ? "default" : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() =>
                      setSelectedAccounts((prev) => toggleValue(prev, acc.id))
                    }
                  >
                    {acc.account_type}
                  </Badge>
                ))}
                {accounts.length === 0 ? (
                  <Skeleton className="h-6 w-16 rounded-full" />
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Categories
              </span>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant={
                      selectedCategories.includes(cat.id)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() =>
                      setSelectedCategories((prev) =>
                        toggleValue(prev, cat.id),
                      )
                    }
                  >
                    {cat.icon ? `${cat.icon} ` : ""}
                    {cat.name}
                  </Badge>
                ))}
                {categories.length === 0 ? (
                  <Skeleton className="h-6 w-24 rounded-full" />
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {(selectedCategory || selectedPeriod) && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              Detail
            </CardTitle>
            <div className="flex gap-2 text-sm text-slate-600">
              <Button size="sm" variant="outline" onClick={exportDetailCsv}>
                Export detail CSV
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedPeriod(null);
                }}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="flex flex-wrap gap-2">
              {selectedCategory ? (
                <Badge variant="outline">
                  Category: {selectedCategory.name} ({selectedCategory.value})
                </Badge>
              ) : null}
              {selectedPeriod ? (
                <Badge variant="outline">
                  Period: {selectedPeriod.label} • Income {currency(selectedPeriod.income)} •
                  Expense {currency(selectedPeriod.expense)} • Net {currency(selectedPeriod.net)}
                </Badge>
              ) : null}
            </div>
            {detailRows.length === 0 ? (
              <p className="text-slate-500">
                {transactionsLoading || globalTransactionsLoading
                  ? "Loading details..."
                  : "No transactions for this selection."}
              </p>
            ) : (
              <div className="overflow-auto rounded border border-slate-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.slice(0, 15).map((t) => {
                      const amount = t.legs.reduce(
                        (sum, leg) => sum + Number(leg.amount),
                        0,
                      );
                      const cat = categories.find((c) => c.id === t.category_id);
                      return (
                        <tr
                          key={t.id}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2">
                            {new Date(t.occurred_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">{t.description ?? "—"}</td>
                          <td className="px-3 py-2">
                            {cat ? categoryLabel(cat) : "Uncategorized"}
                          </td>
                          <td
                            className="px-3 py-2 text-right"
                            style={{ color: amount < 0 ? "#ef4444" : "#16a34a" }}
                          >
                            {currency(amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              Income vs Expense (stacked)
            </CardTitle>
            {activeLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            ) : null}
          </CardHeader>
          <CardContent className="h-80">
            {chartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <Skeleton className="h-48 w-full" />
                <p>Import data or add transactions to see income vs expense.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stackId="stack"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.35}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stackId="stack"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.35}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              Net trend
            </CardTitle>
            {compare ? (
              <Badge variant="outline">Comparing vs prior</Badge>
            ) : null}
          </CardHeader>
          <CardContent className="h-80">
            {chartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <Skeleton className="h-48 w-full" />
                <p>Import data or add transactions to see net trends.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  onClick={(e) => {
                    const payload = (e && "activePayload" in e && e.activePayload?.[0]?.payload) as
                      | typeof chartData[number]
                      | undefined;
                    if (payload) {
                      setSelectedPeriod({
                        label: payload.rawLabel ?? payload.label,
                        income: payload.income,
                        expense: payload.expense,
                        net: payload.net,
                      });
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="net" stroke="#0ea5e9" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              Cash flow by period
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {chartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <Skeleton className="h-48 w-full" />
                <p>Bring in data to view cash flow by period.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="income" fill="#22c55e" />
                  <Bar dataKey="expense" fill="#ef4444" />
                  <Bar dataKey="net" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              Category share
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {categoryShare.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <Skeleton className="h-48 w-full" />
                <p>Add categories and transactions to see share breakdown.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Pie
                    data={categoryShare}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    onClick={(_, idx) => {
                      const item = categoryShare[idx];
                      if (item) setSelectedCategory({ name: item.name, value: item.value });
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              Net worth history
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {netWorthSeries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <Skeleton className="h-48 w-full" />
                <p>Connect accounts to track net worth over time.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="#0ea5e9"
                    fill="#0ea5e9"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              Savings rate
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {savingsRate.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <Skeleton className="h-48 w-full" />
                <p>Add income and expense data to see savings rate.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={savingsRate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="rate" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900">
            Income flow by category
          </CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          {sankeyData.nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Skeleton className="h-48 w-full" />
              <p>Import data to see income flow between accounts and categories.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={sankeyData}
                nodePadding={12}
                linkCurvature={0.5}
                nodeWidth={16}
              >
                <Tooltip />
              </Sankey>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
  const categoryShare = useMemo(() => {
    const palette = [
      "#22c55e",
      "#ef4444",
      "#6366f1",
      "#f59e0b",
      "#0ea5e9",
      "#8b5cf6",
    ];
    const items =
      categories.length > 0
        ? categories
            .filter((c) => !c.is_archived)
            .slice(0, 8)
            .map((c, idx) => ({
              name: `${c.icon ? `${c.icon} ` : ""}${c.name}`,
              value: (idx + 1) * 10,
              fill: c.color_hex || palette[idx % palette.length],
            }))
        : [];

    const total = items.reduce((sum, i) => sum + i.value, 0);
    const threshold = total * 0.05;
    const main = items.filter((i) => i.value >= threshold);
    const otherSum = items
      .filter((i) => i.value < threshold)
      .reduce((sum, i) => sum + i.value, 0);
    if (otherSum > 0) {
      main.push({ name: "Other", value: otherSum, fill: "#cbd5e1" });
    }
    return main;
  }, [categories]);

  const netWorthSeries = useMemo(
    () =>
      (netWorth.data || []).map((p: NetWorthPoint) => ({
        date: p.period,
        net: Number(p.net_worth),
      })),
    [netWorth.data],
  );

  const savingsRate = useMemo(() => {
    return (monthly.data || []).map((row) => {
      const income = Number(row.income);
      const expense = Math.abs(Number(row.expense));
      const rate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
      return {
        label: new Date(row.period).toLocaleString("en-US", { month: "short" }),
        rate,
      };
    });
  }, [monthly.data]);

  const sankeyData = useMemo(() => {
    const nodes: { name: string }[] = [];
    const links: { source: number; target: number; value: number }[] = [];
    const addNode = (name: string) => {
      const idx = nodes.findIndex((n) => n.name === name);
      if (idx >= 0) return idx;
      nodes.push({ name });
      return nodes.length - 1;
    };

    const incomeSources = accounts.slice(0, 3);
    const targets = categoryShare.slice(0, 5);
    incomeSources.forEach((acc) => {
      const sourceIdx = addNode(acc.account_type);
      targets.forEach((cat) => {
        const targetIdx = addNode(cat.name);
        links.push({
          source: sourceIdx,
          target: targetIdx,
          value: cat.value / incomeSources.length,
        });
      });
    });

    return { nodes, links };
  }, [accounts, categoryShare]);

  const [selectedCategory, setSelectedCategory] = useState<{
    name: string;
    value: number;
  } | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<{
    label: string | number;
    income: number;
    expense: number;
    net: number;
  } | null>(null);
  const [detailRows, setDetailRows] = useState<TransactionRead[]>([]);

  const exportDetailCsv = () => {
    const headers = ["label", "income", "expense", "net", "category", "value"];
    const rows = [
      [
        selectedPeriod?.label ?? "",
        selectedPeriod?.income ?? "",
        selectedPeriod?.expense ?? "",
        selectedPeriod?.net ?? "",
        selectedCategory?.name ?? "",
        selectedCategory?.value ?? "",
      ],
      ...detailRows.map((t) => [
        t.occurred_at,
        "",
        "",
        "",
        t.category_id ?? "",
        t.legs.reduce((sum, leg) => sum + Number(leg.amount), 0),
      ]),
    ];
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "report-detail.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!selectedCategory && !selectedPeriod) {
      setDetailRows([]);
      return;
    }

    const now = new Date();
    let startDate = dateRange.start;
    let endDate = dateRange.end;

    if (selectedPeriod) {
      const label = String(selectedPeriod.label);
      if (label.startsWith("Q")) {
        const [q, yr] = label.replace("Q", "").split(" ");
        const yearNum = Number(yr || now.getFullYear());
        const quarter = Number(q);
        const startMonth = (quarter - 1) * 3;
        startDate = new Date(yearNum, startMonth, 1).toISOString().slice(0, 10);
        endDate = new Date(yearNum, startMonth + 3, 0).toISOString().slice(0, 10);
      } else if (label.length === 4 && /^\d+$/.test(label)) {
        const yearNum = Number(label);
        startDate = new Date(yearNum, 0, 1).toISOString().slice(0, 10);
        endDate = new Date(yearNum, 11, 31).toISOString().slice(0, 10);
      } else {
        const parsed = new Date(label);
        if (!Number.isNaN(parsed.getTime())) {
          startDate = new Date(parsed.getFullYear(), parsed.getMonth(), 1)
            .toISOString()
            .slice(0, 10);
          endDate = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0)
            .toISOString()
            .slice(0, 10);
        }
      }
    }

    const categoryIds = selectedCategory
      ? categories
          .filter((c) => c.name === selectedCategory.name.replace(/^[^A-Za-z0-9]+/, ""))
          .map((c) => c.id)
      : selectedCategories;

    fetchTransactions({
      startDate,
      endDate,
      categoryIds,
      limit: 50,
      offset: 0,
    });
  }, [
    selectedCategory,
    selectedPeriod,
    dateRange.start,
    dateRange.end,
    selectedCategories,
    categories,
    fetchTransactions,
  ]);

  useEffect(() => {
    setDetailRows(transactionItems);
  }, [transactionItems, globalTransactions]);
