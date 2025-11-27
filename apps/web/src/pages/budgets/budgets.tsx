import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useBudgetsApi, useCategoriesApi } from "@/hooks/use-api";
import {
  BudgetPeriod,
  type BudgetProgress,
  type CategoryRead,
} from "@/types/api";

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

export const Budgets: React.FC = () => {
  const {
    items,
    loading,
    error,
    fetchBudgets,
    createBudget,
    updateBudget,
    deleteBudget,
  } = useBudgetsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();

  const [form, setForm] = useState<{
    category_id: string;
    period: BudgetPeriod;
    amount: string;
    note?: string;
  }>({
    category_id: "",
    period: BudgetPeriod.MONTHLY,
    amount: "0",
    note: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<string>("");
  const [editingNote, setEditingNote] = useState<string>("");

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCategories = useMemo(
    () => categories.filter((c) => !c.is_archived),
    [categories],
  );

  useEffect(() => {
    if (!form.category_id && availableCategories.length > 0) {
      setForm((prev) => ({ ...prev, category_id: availableCategories[0].id }));
    }
  }, [availableCategories, form.category_id]);

  const totals = useMemo(() => {
    const budgetTotal = items.reduce((sum, b) => sum + Number(b.amount), 0);
    const spentTotal = items.reduce((sum, b) => sum + Number(b.spent), 0);
    return { budgetTotal, spentTotal };
  }, [items]);

  const startEdit = (budget: BudgetProgress) => {
    setEditingId(budget.id);
    setEditingAmount(budget.amount);
    setEditingNote(budget.note ?? "");
  };

  const submitEdit = () => {
    if (!editingId) return;
    updateBudget(editingId, {
      amount: editingAmount,
      note: editingNote,
    });
    toast.success("Budget updated");
    setEditingId(null);
  };

  const submitCreate = () => {
    if (!form.category_id || Number(form.amount) <= 0) {
      toast.error("Pick a category and amount > 0");
      return;
    }
    createBudget(form);
    toast.success("Budget added");
    setForm((prev) => ({ ...prev, amount: "0", note: "" }));
  };

  return (
    <div className="space-y-4">
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
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Allocations
              <Badge variant="secondary">
                Total: {formatCurrency(totals.budgetTotal)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No budgets yet. Add your first one to see progress.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((budget) => {
                  const category = categories.find(
                    (c) => c.id === budget.category_id,
                  );
                  const percent = Math.min(
                    100,
                    Math.max(0, Number(budget.percent_used || 0)),
                  );
                  const isEditing = editingId === budget.id;
                  return (
                    <div
                      key={budget.id}
                      className="rounded-lg border border-slate-200 p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
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
                            <div className="flex flex-col gap-2 md:flex-row">
                              <Input
                                value={editingAmount}
                                onChange={(e) =>
                                  setEditingAmount(e.target.value)
                                }
                                className="w-32"
                              />
                              <Input
                                value={editingNote}
                                onChange={(e) => setEditingNote(e.target.value)}
                                placeholder="Note"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={submitEdit}>
                                  Save
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
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
                        <Progress value={percent} className="h-2" />
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
            <div className="space-y-2">
              <label className="text-sm text-slate-600">Category</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                value={form.category_id}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category_id: e.target.value }))
                }
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
                  value={form.period}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      period: e.target.value as BudgetPeriod,
                    }))
                  }
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
                <Input
                  value={form.amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-600">Note</label>
              <Input
                value={form.note ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>
            <Button
              className="w-full"
              onClick={submitCreate}
              disabled={loading}
            >
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
    </div>
  );
};
