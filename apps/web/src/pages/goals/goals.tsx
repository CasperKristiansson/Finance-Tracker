import { Calendar, CheckCircle, Goal as GoalIcon, Plus } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppSelector } from "@/app/hooks";
import { useAccountsApi, useCategoriesApi } from "@/hooks/use-api";
import { selectToken } from "@/features/auth/authSlice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/apiClient";
import {
  type GoalRead,
  type GoalCreateRequest,
  type GoalListResponse,
} from "@/types/api";

const formatCurrency = (value: string | number) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const formatDate = (value?: string | null) => {
  if (!value) return "No target date";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const Goals: React.FC = () => {
  const token = useAppSelector(selectToken);
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();
  const [goals, setGoals] = useState<GoalRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<GoalCreateRequest>({
    name: "",
    target_amount: "",
    target_date: "",
    category_id: "",
    account_id: "",
    subscription_id: "",
    note: "",
  });

  useEffect(() => {
    fetchAccounts({});
    fetchCategories();
    void loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGoals = async () => {
    setLoading(true);
    try {
      const { data } = await apiFetch<GoalListResponse>({
        path: "/goals",
        token,
      });
      setGoals(data.goals ?? []);
    } catch (error) {
      toast.error("Unable to load goals", {
        description: error instanceof Error ? error.message : "Try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  const submitGoal = async () => {
    if (!form.name || !form.target_amount) {
      toast.error("Add a name and target amount");
      return;
    }
    try {
      await apiFetch({
        path: "/goals",
        method: "POST",
        token,
        body: {
          ...form,
          target_date: form.target_date || null,
          category_id: form.category_id || null,
          account_id: form.account_id || null,
          subscription_id: form.subscription_id || null,
          note: form.note || null,
        },
      });
      toast.success("Goal added");
      setForm({
        name: "",
        target_amount: "",
        target_date: "",
        category_id: "",
        account_id: "",
        subscription_id: "",
        note: "",
      });
      void loadGoals();
    } catch (error) {
      toast.error("Unable to add goal", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  const totals = useMemo(() => {
    const totalTarget = goals.reduce(
      (sum, goal) => sum + Number(goal.target_amount || 0),
      0,
    );
    const totalCurrent = goals.reduce(
      (sum, goal) => sum + Number(goal.current_amount || 0),
      0,
    );
    const avgProgress = Math.round(
      (totalCurrent / Math.max(1, totalTarget)) * 100,
    );
    return { totalTarget, totalCurrent, avgProgress };
  }, [goals]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Goals
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Track targets with clarity
          </h1>
          <p className="text-sm text-slate-500">
            Link targets to categories or accounts and monitor progress
            automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Goal name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="w-48"
          />
          <Input
            type="number"
            placeholder="Target amount"
            value={form.target_amount}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, target_amount: e.target.value }))
            }
            className="w-32"
          />
          <Input
            type="date"
            value={form.target_date || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, target_date: e.target.value }))
            }
            className="w-40"
          />
          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            value={form.account_id || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, account_id: e.target.value }))
            }
          >
            <option value="">Account (optional)</option>
            {accounts.map((acc, idx) => (
              <option key={acc.id} value={acc.id}>
                {`Account ${idx + 1}`} · {acc.account_type}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            value={form.category_id || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, category_id: e.target.value }))
            }
          >
            <option value="">Category (optional)</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <Button className="gap-2" onClick={submitGoal}>
            <Plus className="h-4 w-4" /> Add goal
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">
              Saved so far
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-900">
            {formatCurrency(totals.totalCurrent)}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">
              Target total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-900">
            {formatCurrency(totals.totalTarget)}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">
              Average progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
              {totals.avgProgress}%
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <Progress value={totals.avgProgress} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <CardContent className="py-6 text-center text-sm text-slate-600">
            Loading goals...
          </CardContent>
        </Card>
      ) : goals.length === 0 ? (
        <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-slate-600">
            <GoalIcon className="h-8 w-8 text-slate-500" />
            <div className="space-y-1">
              <p className="text-lg font-semibold text-slate-900">
                No goals yet
              </p>
              <p className="text-sm text-slate-600">
                Add a target and link it to a category or account to track progress
                automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => {
            const pct = Math.min(100, Math.round(goal.progress_pct));
            return (
              <Card
                key={goal.id}
                className="flex h-full flex-col border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]"
              >
                <CardHeader className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GoalIcon className="h-4 w-4 text-slate-500" />
                      <CardTitle className="text-base text-slate-900">
                        {goal.name}
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Target {formatCurrency(goal.target_amount)}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    {goal.target_date ? `Due ${formatDate(goal.target_date)}` : "No due date"}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Progress</span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(goal.current_amount)} of{" "}
                        {formatCurrency(goal.target_amount)}
                      </span>
                    </div>
                    <Progress value={pct} />
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{pct}%</span>
                      <span>{formatDate(goal.target_date)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
