import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { z } from "zod";
import { useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { buildReportKey } from "@/features/reports/reportsSlice";
import {
  useBudgetsApi,
  useCategoriesApi,
  useReportsApi,
} from "@/hooks/use-api";
import {
  BudgetPeriod,
  CategoryType,
  type BudgetProgress,
  type CategoryRead,
} from "@/types/api";
import { budgetSchema } from "@/types/schemas";

const periodLabels: Record<BudgetPeriod, string> = {
  [BudgetPeriod.MONTHLY]: "Monthly",
  [BudgetPeriod.QUARTERLY]: "Quarterly",
  [BudgetPeriod.YEARLY]: "Yearly",
};

const formatCurrency = (value: string | number) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });

const categoryLabel = (cat: CategoryRead) =>
  `${cat.icon ? `${cat.icon} ` : ""}${cat.name}`;

const budgetFormSchema = budgetSchema
  .pick({ category_id: true, period: true, amount: true, note: true })
  .extend({
    amount: z.string().min(1, "Add an amount").trim(),
    note: z.string().optional(),
  });

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

const wizardSchema = z.object({
  rows: z.array(budgetFormSchema),
});

type WizardValues = z.infer<typeof wizardSchema>;

const editBudgetSchema = z.object({
  amount: z.string().min(1, "Add an amount").trim(),
  note: z.string().optional(),
});

type EditBudgetValues = z.infer<typeof editBudgetSchema>;

export const Budgets: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const {
    items,
    loading,
    error,
    fetchBudgets,
    createBudget,
    updateBudget,
    deleteBudget,
    totals,
    budgetsByUsage,
    rollups,
  } = useBudgetsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();
  const { fetchMonthlyReport } = useReportsApi();
  const monthlyState = useAppSelector((state) => state.reports.monthly);
  const createForm = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      category_id: "",
      period: BudgetPeriod.MONTHLY,
      amount: "0",
      note: "",
    },
  });

  const wizardForm = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: { rows: [] },
  });

  const wizardArray = useFieldArray({
    control: wizardForm.control,
    name: "rows",
  });

  const wizardRows = wizardForm.watch("rows");

  const editForm = useForm<EditBudgetValues>({
    resolver: zodResolver(editBudgetSchema),
    defaultValues: { amount: "", note: "" },
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<BudgetPeriod | "all">("all");

  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCategories = useMemo(
    () => categories.filter((c) => !c.is_archived),
    [categories],
  );

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.name.toLowerCase(), c.id));
    return map;
  }, [categories]);

  const topCategoriesBySpend = useMemo(() => {
    // Heuristic: prioritize expense categories first, fall back to all available.
    const expenses = availableCategories.filter(
      (c) => c.category_type === CategoryType.EXPENSE,
    );
    const others = availableCategories.filter(
      (c) => c.category_type !== CategoryType.EXPENSE,
    );
    return [...expenses, ...others].slice(0, 6);
  }, [availableCategories]);

  useEffect(() => {
    const firstId = availableCategories[0]?.id;
    if (!createForm.getValues("category_id") && firstId) {
      createForm.setValue("category_id", firstId);
    }
  }, [availableCategories, createForm]);

  useEffect(() => {
    const year = new Date().getFullYear();
    const ids = Array.from(new Set(items.map((b) => b.category_id)));
    ids.forEach((id) => fetchMonthlyReport({ year, categoryIds: [id] }));
  }, [items, fetchMonthlyReport]);

  useEffect(() => {
    if (items.length === 0 && topCategoriesBySpend.length > 0) {
      wizardForm.reset({
        rows: topCategoriesBySpend.map((cat) => ({
          category_id: cat.id,
          period: BudgetPeriod.MONTHLY,
          amount: "500",
          note: "",
        })),
      });
    }
  }, [items.length, topCategoriesBySpend, wizardForm]);

  const filteredBudgets = useMemo(
    () =>
      periodFilter === "all"
        ? budgetsByUsage
        : budgetsByUsage.filter((b) => b.period === periodFilter),
    [budgetsByUsage, periodFilter],
  );

  const summaryCards = useMemo(() => {
    const cards = [
      {
        title: "All budgets",
        meta: "Across all periods",
        ...totals,
      },
      {
        title: "Monthly",
        meta: "Current month",
        ...(rollups?.[BudgetPeriod.MONTHLY] ?? totals),
      },
      {
        title: "Quarterly",
        meta: "Current quarter",
        ...(rollups?.[BudgetPeriod.QUARTERLY] ?? totals),
      },
      {
        title: "Yearly",
        meta: "This year",
        ...(rollups?.[BudgetPeriod.YEARLY] ?? totals),
      },
    ];
    return cards;
  }, [rollups, totals]);

  const startEdit = (budget: BudgetProgress) => {
    setEditingId(budget.id);
    editForm.reset({
      amount: budget.amount,
      note: budget.note ?? "",
    });
  };

  const submitEdit = editForm.handleSubmit((values) => {
    if (!editingId) return;
    updateBudget(editingId, {
      amount: values.amount,
      note: values.note,
    });
    toast.success("Budget updated");
    setEditingId(null);
  });

  const submitCreate = createForm.handleSubmit((values) => {
    createBudget({
      category_id: values.category_id,
      period: values.period,
      amount: values.amount,
      note: values.note?.trim() || undefined,
    });
    toast.success("Budget added");
    createForm.reset({
      category_id: values.category_id,
      period: values.period,
      amount: "0",
      note: "",
    });
  });

  const submitWizard = wizardForm.handleSubmit((values) => {
    const rows = (values.rows ?? []).filter(
      (row) => row.category_id && Number(row.amount) > 0,
    );
    if (!rows.length) {
      toast.error("Add at least one suggested budget with amount > 0");
      return;
    }
    rows.forEach((row) =>
      createBudget({
        category_id: row.category_id,
        period: row.period,
        amount: row.amount,
        note: row.note?.trim() || undefined,
      }),
    );
    toast.success("Budgets created");
    wizardForm.reset({ rows: [] });
  });

  const escapeCsv = (value: unknown) => {
    const str = value === null || value === undefined ? "" : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const parseCsvRows = (text: string) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length <= 1) return [];
    const [headerLine, ...dataLines] = lines;
    const headers = headerLine.split(",").map((h) => h.trim());
    return dataLines.map((line) => {
      const parts = line
        .split(",")
        .map((p) => p.replace(/^"|"$/g, "").replace(/""/g, '"'));
      const row: Record<string, string> = {};
      headers.forEach((key, idx) => {
        row[key] = parts[idx] ?? "";
      });
      return row;
    });
  };

  const exportBudgets = () => {
    const header = ["category", "period", "amount", "note"];
    const rows = items.map((b) => {
      const catName =
        categories.find((c) => c.id === b.category_id)?.name ?? "";
      return [
        escapeCsv(catName),
        escapeCsv(b.period),
        escapeCsv(b.amount),
        escapeCsv(b.note ?? ""),
      ];
    });
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "budgets.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBudgets = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseCsvRows(text);
      rows.forEach((row) => {
        const name = row["category"]?.toLowerCase().trim();
        const category_id =
          row["category_id"] || (name ? categoryNameMap.get(name) : "");
        const period = row["period"] as BudgetPeriod;
        const amount = row["amount"];
        const note = row["note"];
        if (!category_id || !period || !amount) return;
        createBudget({ category_id, period, amount, note });
      });
      toast.success("Budget import started");
    };
    reader.readAsText(file);
  };

  const getBudgetTrend = (budget: BudgetProgress, category?: CategoryRead) => {
    const key = buildReportKey({
      year: currentYear,
      categoryIds: [budget.category_id],
    });
    const data = monthlyState.cache[key] ?? [];
    const useIncome = category?.category_type === CategoryType.INCOME;
    return data
      .map((entry) => ({
        label: new Date(entry.period).toLocaleString("en-US", {
          month: "short",
        }),
        value: Number(useIncome ? entry.income : entry.expense),
      }))
      .slice(-6);
  };

  return (
    <MotionPage className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Budgets
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Guardrails for your spend
          </h1>
          <p className="text-sm text-slate-500">
            Allocate per category and monitor progress. Percentages use current
            period totals.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => fetchBudgets()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportBudgets}>
            Export CSV
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportBudgets(file);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => importInputRef.current?.click()}
          >
            Import CSV
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        {loading && items.length === 0
          ? Array.from({ length: 4 }).map((_, idx) => (
              <Card key={idx} className="border-slate-200">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))
          : summaryCards.map((card) => {
              const percent = Math.min(
                150,
                Math.max(0, Number(card.percentUsed ?? 0)),
              );
              return (
                <Card
                  key={card.title}
                  className="border-slate-200 shadow-[0_4px_30px_-22px_rgba(15,23,42,0.4)]"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      {card.title}
                    </CardTitle>
                    <p className="text-xs text-slate-500">{card.meta}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-lg font-semibold text-slate-900">
                      {formatCurrency(card.spentTotal)} /{" "}
                      {formatCurrency(card.budgetTotal)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Remaining {formatCurrency(card.remainingTotal)}
                    </div>
                    <Progress value={percent} className="h-2" />
                    <div className="text-xs text-slate-500">
                      {percent.toFixed(1)}% used
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {items.length === 0 && !loading ? (
        <Card className="border-dashed border-slate-300">
          <CardHeader>
            <CardTitle className="text-lg">
              Guided setup: seed budgets from top spenders
            </CardTitle>
            <p className="text-sm text-slate-500">
              Pick your most-used categories and set starter amounts. You can
              change periods before saving.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {(wizardRows?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">
                Add at least one category to start.
              </p>
            ) : (
              <div className="space-y-2">
                {wizardArray.fields.map((field, index) => {
                  const row = wizardRows?.[index];
                  const cat = categories.find((c) => c.id === row.category_id);
                  return (
                    <div
                      key={field.id}
                      className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-4"
                    >
                      <select
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                        {...wizardForm.register(
                          `rows.${index}.category_id` as const,
                        )}
                      >
                        <option value="">Select category</option>
                        {availableCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {categoryLabel(c)}
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                        {...wizardForm.register(
                          `rows.${index}.period` as const,
                        )}
                      >
                        {Object.values(BudgetPeriod).map((value) => (
                          <option key={value} value={value}>
                            {periodLabels[value]}
                          </option>
                        ))}
                      </select>
                      <Input
                        {...wizardForm.register(
                          `rows.${index}.amount` as const,
                        )}
                        placeholder="500"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => wizardArray.remove(index)}
                        >
                          Remove
                        </Button>
                        <Badge variant="outline">
                          {cat ? categoryLabel(cat) : "Unassigned"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  wizardArray.append({
                    category_id: availableCategories[0]?.id ?? "",
                    period: BudgetPeriod.MONTHLY,
                    amount: "0",
                    note: "",
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add category
              </Button>
              <Button size="sm" onClick={submitWizard} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create budgets
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              Allocations
              <Badge variant="secondary">
                Total: {formatCurrency(totals.budgetTotal)}
              </Badge>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <span className="text-xs tracking-wide text-slate-500 uppercase">
                Period
              </span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                value={periodFilter}
                onChange={(e) =>
                  setPeriodFilter(e.target.value as BudgetPeriod | "all")
                }
              >
                <option value="all">All</option>
                {Object.values(BudgetPeriod).map((value) => (
                  <option key={value} value={value}>
                    {periodLabels[value]}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && items.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="mt-2 space-y-2">
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredBudgets.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No budgets yet. Add your first one to see progress.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBudgets.map((budget) => {
                  const category = categories.find(
                    (c) => c.id === budget.category_id,
                  );
                  const categoryColor = category?.color_hex || "#0f172a";
                  const percent = Math.min(
                    100,
                    Math.max(0, Number(budget.percent_used || 0)),
                  );
                  const trend = getBudgetTrend(budget, category);
                  const isEditing = editingId === budget.id;
                  return (
                    <div
                      key={budget.id}
                      className="rounded-lg border border-slate-200 p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: categoryColor }}
                            />
                            <span className="text-base font-semibold text-slate-900">
                              {category
                                ? categoryLabel(category)
                                : "Uncategorized"}
                            </span>
                            <Badge variant="outline">
                              {periodLabels[budget.period]}
                            </Badge>
                          </div>
                          {isEditing ? (
                            <form
                              className="flex flex-col gap-2 md:flex-row"
                              onSubmit={submitEdit}
                            >
                              <div className="flex flex-col gap-1">
                                <Input
                                  className="w-32"
                                  {...editForm.register("amount")}
                                />
                                {editForm.formState.errors.amount ? (
                                  <p className="text-xs text-rose-600">
                                    {editForm.formState.errors.amount?.message}
                                  </p>
                                ) : null}
                              </div>
                              <Input
                                {...editForm.register("note")}
                                placeholder="Note"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" type="submit">
                                  Save
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <p className="text-sm text-slate-600">
                                Budget {formatCurrency(budget.amount)} • Spent{" "}
                                {formatCurrency(budget.spent)} • Remaining{" "}
                                {formatCurrency(budget.remaining)}
                              </p>
                              {budget.note ? (
                                <p className="text-xs text-slate-500">
                                  {budget.note}
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="hidden md:block">
                            <ResponsiveContainer width={140} height={60}>
                              <AreaChart data={trend}>
                                <Area
                                  type="monotone"
                                  dataKey="value"
                                  stroke={categoryColor}
                                  fill={categoryColor}
                                  fillOpacity={0.15}
                                  strokeWidth={2}
                                  isAnimationActive={false}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEdit(budget)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => deleteBudget(budget.id)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" /> Remove
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Progress</span>
                          <span>{percent.toFixed(1)}%</span>
                        </div>
                        <Progress
                          value={percent}
                          className="h-2"
                          indicatorStyle={{ backgroundColor: categoryColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> New budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={submitCreate} className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Category</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                  {...createForm.register("category_id")}
                >
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {categoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <label className="text-sm text-slate-600">Period</label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                    {...createForm.register("period")}
                  >
                    {Object.entries(periodLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-sm text-slate-600">Amount</label>
                  <Input placeholder="500" {...createForm.register("amount")} />
                  {createForm.formState.errors.amount ? (
                    <p className="text-xs text-rose-600">
                      {createForm.formState.errors.amount?.message}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Note</label>
                <Input
                  placeholder="Optional"
                  {...createForm.register("note")}
                />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add budget
              </Button>
              <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                Tip: budgets are unique per category + period. Update instead of
                duplicating to avoid conflicts.
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm text-slate-700">
          <div>
            <p className="text-slate-500">Budgeted</p>
            <p className="text-lg font-semibold">
              {formatCurrency(totals.budgetTotal)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Spent</p>
            <p className="text-lg font-semibold">
              {formatCurrency(totals.spentTotal)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Remaining</p>
            <p className="text-lg font-semibold">
              {formatCurrency(totals.budgetTotal - totals.spentTotal)}
            </p>
          </div>
        </CardContent>
      </Card>
    </MotionPage>
  );
};
