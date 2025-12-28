import { zodResolver } from "@hookform/resolvers/zod";
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Award,
  CalendarClock,
  CheckCircle2,
  Goal as GoalIcon,
  Plus,
  Pencil,
  Sparkles,
  Target,
  Trophy,
  Trash2,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAppSelector } from "@/app/hooks";
import {
  fadeInUp,
  MotionPage,
  StaggerWrap,
  subtleHover,
} from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { selectToken } from "@/features/auth/authSlice";
import { apiFetch } from "@/lib/apiClient";
import { currency, formatDate as formatDateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fetchTotalOverview } from "@/services/reports";
import type {
  GoalListResponse,
  GoalRead,
  TotalOverviewResponse,
} from "@/types/api";
import { goalListSchema } from "@/types/schemas";

const goalFormSchema = z.object({
  name: z.string().min(1, "Name required").trim(),
  target_amount: z.string().min(1, "Target amount required").trim(),
  target_date: z.string().optional(),
  note: z.string().optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

type GoalWithProgress = GoalRead & {
  computedCurrentAmount: number;
  computedProgressPct: number;
  computedAchievedAt: string | null;
  computedAchievedDeltaDays: number | null;
  achieved: boolean;
};

const defaultGoalValues: GoalFormValues = {
  name: "",
  target_amount: "",
  target_date: "",
  note: "",
};

const formatCurrency = (value: string | number) =>
  currency(Number(value || 0), {
    maximumFractionDigits: 0,
  });

const formatDate = (value?: string | null) => {
  if (!value) return "Open-ended";
  return formatDateLabel(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDelta = (deltaDays: number) => {
  if (deltaDays === 0) return "On time";
  const abs = Math.abs(deltaDays);
  return deltaDays < 0 ? `${abs} days early` : `${abs} days late`;
};

export const Goals: React.FC = () => {
  const token = useAppSelector(selectToken);
  const prefersReducedMotion = useReducedMotion();
  const [goals, setGoals] = useState<GoalRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalOverview, setTotalOverview] =
    useState<TotalOverviewResponse | null>(null);
  const [totalOverviewLoading, setTotalOverviewLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<GoalRead | null>(null);
  const goalForm = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: defaultGoalValues,
  });

  useEffect(() => {
    void loadGoals();
    void loadTotalOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isDialogOpen) return;
    if (editingGoal) {
      goalForm.reset({
        name: editingGoal.name ?? "",
        target_amount: String(editingGoal.target_amount ?? ""),
        target_date: editingGoal.target_date ?? "",
        note: editingGoal.note ?? "",
      });
      return;
    }
    goalForm.reset(defaultGoalValues);
  }, [editingGoal, goalForm, isDialogOpen]);

  const loadTotalOverview = async () => {
    setTotalOverviewLoading(true);
    try {
      const { data } = await fetchTotalOverview({ token });
      setTotalOverview(data);
    } catch {
      setTotalOverview(null);
    } finally {
      setTotalOverviewLoading(false);
    }
  };

  const loadGoals = async () => {
    setLoading(true);
    try {
      const { data } = await apiFetch<GoalListResponse>({
        path: "/goals",
        schema: goalListSchema,
        token,
      });
      setGoals(data.goals ?? []);
    } catch (error) {
      toast.error("Unable to load goals", {
        description:
          error instanceof Error ? error.message : "Try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  const submitGoal = goalForm.handleSubmit(async (values) => {
    try {
      const payload = {
        ...values,
        target_date: values.target_date || null,
        note: values.note || null,
      };
      if (editingGoal) {
        await apiFetch({
          path: `/goals/${editingGoal.id}`,
          method: "PATCH",
          token,
          body: payload,
        });
        toast.success("Goal updated");
      } else {
        await apiFetch({
          path: "/goals",
          method: "POST",
          token,
          body: payload,
        });
        toast.success("Goal added");
      }
      goalForm.reset(defaultGoalValues);
      setIsDialogOpen(false);
      setEditingGoal(null);
      void loadGoals();
    } catch (error) {
      toast.error(
        editingGoal ? "Unable to update goal" : "Unable to add goal",
        {
          description: error instanceof Error ? error.message : "Try again.",
        },
      );
    }
  });

  const deleteGoal = async (goal: GoalRead) => {
    const confirmed = window.confirm(
      `Delete "${goal.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await apiFetch({
        path: `/goals/${goal.id}`,
        method: "DELETE",
        token,
      });
      toast.success("Goal deleted");
      setSelectedGoalId(null);
      void loadGoals();
    } catch (error) {
      toast.error("Unable to delete goal", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  const totalMoneySeries = useMemo(() => {
    if (!totalOverview) return [];
    const netSeries = [...totalOverview.net_worth_series]
      .map((row) => ({
        date: row.date,
        netWorth: Number(row.net_worth),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const debtSeries = [...totalOverview.debt.series]
      .map((row) => ({
        date: row.date,
        debt: Number(row.debt),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    let debtIndex = 0;
    let lastDebt = 0;
    return netSeries.map((row) => {
      while (
        debtIndex < debtSeries.length &&
        debtSeries[debtIndex].date <= row.date
      ) {
        lastDebt = debtSeries[debtIndex].debt;
        debtIndex += 1;
      }
      return {
        date: row.date,
        totalMoney: row.netWorth + lastDebt,
      };
    });
  }, [totalOverview]);

  const goalsWithProgress = useMemo<GoalWithProgress[]>(() => {
    const currentTotalAssets = totalOverview
      ? Number(totalOverview.kpis.net_worth) +
        Number(totalOverview.kpis.debt_total)
      : null;
    const findAchievedAt = (target: number) =>
      totalMoneySeries.find((point) => point.totalMoney >= target)?.date ??
      null;
    const toUtcDate = (value: string) => new Date(`${value}T00:00:00Z`);

    return goals.map((goal) => {
      const target = Number(goal.target_amount || 0);
      const fallbackCurrent = Number(goal.current_amount || 0);
      const isTotalAssetsGoal =
        !goal.category_id && !goal.account_id && !goal.subscription_id;
      const current =
        isTotalAssetsGoal && currentTotalAssets !== null
          ? currentTotalAssets
          : fallbackCurrent;
      const progressPct = target ? (current / target) * 100 : 0;
      const computedAchievedAt = isTotalAssetsGoal
        ? findAchievedAt(target)
        : (goal.achieved_at ?? null);
      const computedAchievedDeltaDays =
        computedAchievedAt && goal.target_date
          ? Math.round(
              (toUtcDate(computedAchievedAt).getTime() -
                toUtcDate(goal.target_date).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;
      const achieved = isTotalAssetsGoal
        ? currentTotalAssets !== null
          ? current >= target
          : goal.progress_pct >= 100
        : goal.progress_pct >= 100;

      return {
        ...goal,
        computedCurrentAmount: current,
        computedProgressPct: progressPct,
        computedAchievedAt,
        computedAchievedDeltaDays,
        achieved,
      };
    });
  }, [goals, totalMoneySeries, totalOverview]);

  const stats = useMemo(() => {
    const currentTotalAssets = totalOverview
      ? Number(totalOverview.kpis.net_worth) +
        Number(totalOverview.kpis.debt_total)
      : goals.length
        ? Math.max(...goals.map((goal) => Number(goal.current_amount || 0)))
        : 0;
    const achievedGoals = goalsWithProgress.filter((goal) => goal.achieved);
    const activeGoals = goalsWithProgress.filter((goal) => !goal.achieved);
    const totalTarget = activeGoals.reduce(
      (sum, goal) => sum + Number(goal.target_amount || 0),
      0,
    );
    const avgProgress = totalTarget
      ? Math.min(100, Math.round((currentTotalAssets / totalTarget) * 100))
      : 0;
    const nextGoal = activeGoals
      .filter((goal) => goal.target_date)
      .sort(
        (a, b) =>
          new Date(a.target_date ?? "").getTime() -
          new Date(b.target_date ?? "").getTime(),
      )[0];
    const achievedWithDelta = achievedGoals
      .map(
        (goal) =>
          goal.computedAchievedDeltaDays ?? goal.achieved_delta_days ?? null,
      )
      .filter((value): value is number => typeof value === "number");
    const avgDelta = achievedWithDelta.length
      ? Math.round(
          achievedWithDelta.reduce((sum, value) => sum + value, 0) /
            achievedWithDelta.length,
        )
      : null;

    return {
      totalTarget,
      currentTotalAssets,
      achievedGoals,
      activeGoals,
      avgProgress,
      nextGoal,
      avgDelta,
    };
  }, [goals, goalsWithProgress, totalOverview]);

  const selectedGoal = useMemo(
    () => goalsWithProgress.find((goal) => goal.id === selectedGoalId) ?? null,
    [goalsWithProgress, selectedGoalId],
  );

  return (
    <MotionPage className="space-y-10 pb-12">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-[0_35px_80px_-55px_rgba(15,23,42,0.9)]">
        <div className="pointer-events-none absolute inset-0">
          <ShaderGradientCanvas
            style={{ position: "absolute", inset: 0 }}
            pixelDensity={1.4}
          >
            <ShaderGradient
              animate={prefersReducedMotion ? "off" : "on"}
              axesHelper="off"
              brightness={1}
              cAzimuthAngle={180}
              cDistance={2.6}
              cPolarAngle={90}
              cameraZoom={1}
              color1="#d9a2ff"
              color2="#6cc7ff"
              color3="#ffe3c2"
              destination="onCanvas"
              envPreset="lobby"
              frameRate={10}
              grain="on"
              lightType="3d"
              pixelDensity={1.4}
              positionX={-0.5}
              positionY={0}
              positionZ={0}
              range="disabled"
              reflection={0.3}
              rotationX={0}
              rotationY={20}
              rotationZ={35}
              shader="defaults"
              type="plane"
              uAmplitude={1}
              uDensity={2}
              uFrequency={5.6}
              uSpeed={0.15}
              uStrength={3.4}
              uTime={0}
              wireframe={false}
            />
          </ShaderGradientCanvas>
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/35 via-slate-950/70 to-slate-950/90" />
        </div>

        <div className="relative z-10 grid gap-8 px-6 py-10 md:px-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">
              <Sparkles className="h-3.5 w-3.5" /> Total assets goals
            </div>
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Make net worth milestones feel inevitable.
              </h1>
              <p className="max-w-xl text-sm text-white/70 md:text-base">
                Focus on the only thing that matters: total assets. Set bold
                milestones, track momentum, and celebrate every breakthrough.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) setEditingGoal(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    className="gap-2 bg-white text-slate-900 hover:bg-white/90"
                    onClick={() => setEditingGoal(null)}
                  >
                    <Plus className="h-4 w-4" /> Create goal
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-slate-200 bg-white">
                  <DialogHeader>
                    <DialogTitle>
                      {editingGoal ? "Edit goal" : "Set a total assets goal"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingGoal
                        ? "Update the milestone details for your goal."
                        : "Your goal will track total assets and show progress over time."}
                    </DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={submitGoal}>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">
                        Goal name
                      </label>
                      <Input
                        placeholder="Reach 1,000,000 SEK"
                        {...goalForm.register("name")}
                      />
                      {goalForm.formState.errors.name ? (
                        <span className="text-xs text-rose-600">
                          {goalForm.formState.errors.name.message}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600">
                          Target amount
                        </label>
                        <Input
                          type="number"
                          placeholder="1000000"
                          {...goalForm.register("target_amount")}
                        />
                        {goalForm.formState.errors.target_amount ? (
                          <span className="text-xs text-rose-600">
                            {goalForm.formState.errors.target_amount.message}
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600">
                          Target date
                        </label>
                        <Input
                          type="date"
                          {...goalForm.register("target_date")}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">
                        Notes (optional)
                      </label>
                      <Textarea
                        placeholder="Why this milestone matters to you"
                        rows={3}
                        {...goalForm.register("note")}
                      />
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                      <span className="font-semibold text-slate-900">
                        Goal type:
                      </span>{" "}
                      Total assets (net worth)
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setIsDialogOpen(false);
                          setEditingGoal(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingGoal ? "Save changes" : "Save goal"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Badge className="gap-2 border-white/20 bg-white/10 text-white">
                <Trophy className="h-3.5 w-3.5" />
                {stats.achievedGoals.length} achieved
              </Badge>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-[0.2em] text-white/60 uppercase">
                Current total assets
              </p>
              <Award className="h-5 w-5 text-white/70" />
            </div>
            <p className="text-3xl font-semibold text-white">
              {totalOverviewLoading
                ? "—"
                : formatCurrency(stats.currentTotalAssets)}
            </p>
            <Progress
              value={stats.avgProgress}
              className="h-2.5 bg-white/15"
              indicatorClassName="bg-gradient-to-r from-emerald-400 via-cyan-300 to-violet-300"
            />
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>{stats.avgProgress}% of total targets</span>
              <span>{formatCurrency(stats.totalTarget)} total target</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">
              Next milestone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.nextGoal ? (
              <>
                <p className="text-lg font-semibold text-slate-900">
                  {stats.nextGoal.name}
                </p>
                <p className="text-sm text-slate-600">
                  Target {formatCurrency(stats.nextGoal.target_amount)} by{" "}
                  {formatDate(stats.nextGoal.target_date)}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Add a dated goal to see your next milestone.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">
              Active momentum
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold text-slate-900">
              {stats.activeGoals.length}
            </p>
            <p className="text-sm text-slate-600">
              Goals still in flight. Keep stacking wins.
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">
              Pace insight
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.avgDelta !== null ? (
              <>
                <p className="text-lg font-semibold text-slate-900">
                  {formatDelta(stats.avgDelta)}
                </p>
                <p className="text-sm text-slate-600">
                  Average timing across achieved milestones.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Hit your first goal to unlock timing insights.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {loading ? (
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <CardContent className="py-8 text-center text-sm text-slate-600">
            Loading goals...
          </CardContent>
        </Card>
      ) : goals.length === 0 ? (
        <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center text-slate-600">
            <GoalIcon className="h-9 w-9 text-slate-500" />
            <div className="space-y-2">
              <p className="text-xl font-semibold text-slate-900">
                No goals yet
              </p>
              <p className="text-sm text-slate-600">
                Add a total assets milestone to start tracking your journey.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingGoal(null);
                setIsDialogOpen(true);
              }}
            >
              Create your first goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {stats.activeGoals.length ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Active goals
                  </h2>
                  <p className="text-sm text-slate-500">
                    Keep moving—every step compounds.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {stats.activeGoals.length} in progress
                </Badge>
              </div>
              <StaggerWrap className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {stats.activeGoals.map((goal) => {
                  const pct = Math.min(
                    100,
                    Math.round(goal.computedProgressPct),
                  );
                  const remaining = Math.max(
                    0,
                    Number(goal.target_amount) - goal.computedCurrentAmount,
                  );
                  return (
                    <motion.div
                      key={goal.id}
                      variants={fadeInUp}
                      {...subtleHover}
                    >
                      <Card
                        className="flex h-full cursor-pointer flex-col border-slate-200 bg-white shadow-[0_24px_55px_-35px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:shadow-[0_32px_70px_-40px_rgba(15,23,42,0.35)]"
                        onClick={() => setSelectedGoalId(goal.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedGoalId(goal.id);
                          }
                        }}
                      >
                        <CardHeader className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-slate-500" />
                              <CardTitle className="text-base text-slate-900">
                                {goal.name}
                              </CardTitle>
                            </div>
                            <Badge className="bg-slate-900 text-white">
                              {pct}%
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            Target {formatCurrency(goal.target_amount)} •{" "}
                            {formatDate(goal.target_date)}
                          </p>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>Current</span>
                              <span className="font-semibold text-slate-900">
                                {formatCurrency(goal.computedCurrentAmount)}
                              </span>
                            </div>
                            <Progress
                              value={pct}
                              className="h-2.5"
                              indicatorClassName="bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500"
                            />
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{formatCurrency(remaining)} to go</span>
                              <span>{formatDate(goal.target_date)}</span>
                            </div>
                          </div>
                          {goal.note ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                              {goal.note}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </StaggerWrap>
            </div>
          ) : null}

          {stats.achievedGoals.length ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Achieved
                  </h2>
                  <p className="text-sm text-slate-500">
                    Celebrate the milestones you crushed.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {stats.achievedGoals.length} completed
                </Badge>
              </div>
              <StaggerWrap className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {stats.achievedGoals.map((goal) => {
                  const achievedDate =
                    goal.computedAchievedAt ??
                    goal.achieved_at ??
                    goal.updated_at;
                  const pct = Math.min(
                    100,
                    Math.round(goal.computedProgressPct),
                  );
                  return (
                    <motion.div
                      key={goal.id}
                      variants={fadeInUp}
                      {...subtleHover}
                    >
                      <Card
                        className="flex h-full cursor-pointer flex-col border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 shadow-[0_30px_70px_-40px_rgba(16,185,129,0.45)] transition hover:-translate-y-1 hover:shadow-[0_36px_80px_-45px_rgba(16,185,129,0.45)]"
                        onClick={() => setSelectedGoalId(goal.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedGoalId(goal.id);
                          }
                        }}
                      >
                        <CardHeader className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <CardTitle className="text-base text-slate-900">
                                {goal.name}
                              </CardTitle>
                            </div>
                            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">
                              Done
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            Target {formatCurrency(goal.target_amount)} •{" "}
                            {formatDate(goal.target_date)}
                          </p>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>Achieved</span>
                              <span className="font-semibold text-slate-900">
                                {formatDate(achievedDate)}
                              </span>
                            </div>
                            <Progress
                              value={pct}
                              className="h-2.5 bg-emerald-100"
                              indicatorClassName="bg-gradient-to-r from-emerald-500 via-lime-400 to-cyan-400"
                            />
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>
                                {goal.computedAchievedDeltaDays !== null &&
                                goal.computedAchievedDeltaDays !== undefined
                                  ? formatDelta(goal.computedAchievedDeltaDays)
                                  : "Milestone achieved"}
                              </span>
                              <span>
                                {formatCurrency(goal.computedCurrentAmount)}
                              </span>
                            </div>
                          </div>
                          {goal.note ? (
                            <div className="rounded-lg border border-emerald-200 bg-white/80 px-3 py-2 text-xs text-emerald-800">
                              {goal.note}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </StaggerWrap>
            </div>
          ) : null}
        </div>
      )}

      <Sheet
        open={Boolean(selectedGoal)}
        onOpenChange={(open) => {
          if (!open) setSelectedGoalId(null);
        }}
      >
        <SheetContent side="right" className="bg-white sm:max-w-lg">
          {selectedGoal ? (
            <>
              <SheetHeader className="border-b border-slate-100">
                <SheetTitle className="text-lg">{selectedGoal.name}</SheetTitle>
                <SheetDescription className="mt-2 text-sm text-slate-500">
                  Target {formatCurrency(selectedGoal.target_amount)} •{" "}
                  {formatDate(selectedGoal.target_date)}
                </SheetDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setEditingGoal(selectedGoal);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => deleteGoal(selectedGoal)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Current total assets</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(selectedGoal.computedCurrentAmount)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(
                      100,
                      Math.round(selectedGoal.computedProgressPct),
                    )}
                    className="mt-3 h-2.5"
                    indicatorClassName="bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500"
                  />
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {Math.min(
                        100,
                        Math.round(selectedGoal.computedProgressPct),
                      )}
                      % complete
                    </span>
                    <span>
                      {formatCurrency(
                        Math.max(
                          0,
                          Number(selectedGoal.target_amount) -
                            selectedGoal.computedCurrentAmount,
                        ),
                      )}{" "}
                      to go
                    </span>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Status
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {selectedGoal.achieved ? "Achieved" : "In progress"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedGoal.achieved
                        ? selectedGoal.computedAchievedDeltaDays !== null &&
                          selectedGoal.computedAchievedDeltaDays !== undefined
                          ? formatDelta(selectedGoal.computedAchievedDeltaDays)
                          : "Milestone achieved"
                        : "Keep stacking wins to reach the target."}
                    </p>
                    {selectedGoal.achieved ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Achieved{" "}
                        {formatDate(
                          selectedGoal.computedAchievedAt ??
                            selectedGoal.achieved_at ??
                            selectedGoal.updated_at,
                        )}
                      </p>
                    ) : null}
                  </div>
                  {selectedGoal.note ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase">
                        Notes
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {selectedGoal.note}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <section
        className={cn(
          "rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-[0_28px_60px_-45px_rgba(15,23,42,0.25)]",
          "md:px-10",
        )}
      >
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
              Motivation boost
            </p>
            <h3 className="text-2xl font-semibold text-slate-900">
              Turn goals into rituals, not reminders.
            </h3>
            <p className="text-sm text-slate-600">
              Keep your milestones visible, celebrate progress, and let the
              streak build your confidence. Every net worth check-in is a win.
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Upcoming review
                </p>
                <p className="text-xs text-slate-500">
                  Check in monthly to keep momentum strong.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Celebrate wins
                </p>
                <p className="text-xs text-slate-500">
                  Every goal reached is proof you can do the next one.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MotionPage>
  );
};
