import {
  ArrowUpRight,
  Calendar,
  Clock,
  Goal as GoalIcon,
  Plus,
  Target,
} from "lucide-react";
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageRoutes } from "@/data/routes";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const formatDate = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

type GoalStatus = "on_track" | "at_risk" | "behind";

type Goal = {
  id: string;
  name: string;
  description: string;
  target: number;
  current: number;
  dueDate: string;
  monthlyContribution: number;
  status: GoalStatus;
};

const sampleGoals: Goal[] = [
  {
    id: "home-upgrade",
    name: "Home upgrade reserve",
    description: "Set aside for renovation and safety buffer.",
    target: 15000,
    current: 6200,
    dueDate: "2025-12-31",
    monthlyContribution: 600,
    status: "on_track",
  },
  {
    id: "emergency",
    name: "Emergency fund",
    description: "Six months of expenses for resilience.",
    target: 12000,
    current: 4800,
    dueDate: "2025-08-30",
    monthlyContribution: 500,
    status: "at_risk",
  },
  {
    id: "travel",
    name: "Summer travel",
    description: "Keep it fun without touching investments.",
    target: 4000,
    current: 1100,
    dueDate: "2025-06-15",
    monthlyContribution: 350,
    status: "behind",
  },
];

const statusTone: Record<GoalStatus, string> = {
  on_track: "bg-emerald-100 text-emerald-800",
  at_risk: "bg-amber-100 text-amber-800",
  behind: "bg-rose-100 text-rose-800",
};

const statusLabel: Record<GoalStatus, string> = {
  on_track: "On track",
  at_risk: "Watch",
  behind: "Behind",
};

export const Goals: React.FC = () => {
  const goals = sampleGoals;
  const totals = useMemo(() => {
    const totalTarget = goals.reduce((sum, goal) => sum + goal.target, 0);
    const totalCurrent = goals.reduce((sum, goal) => sum + goal.current, 0);
    const avgProgress = Math.round((totalCurrent / totalTarget) * 100);
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
            High-level cards today. Data will sync automatically once goal APIs
            land.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" className="gap-2" disabled>
            <Plus className="h-4 w-4" />
            New goal (coming soon)
          </Button>
          <Button variant="outline" className="gap-2 border-slate-300" disabled>
            <Target className="h-4 w-4" />
            Connect to ledger
          </Button>
        </div>
      </div>

      {goals.length === 0 ? (
        <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-slate-600">
            <GoalIcon className="h-8 w-8 text-slate-500" />
            <div className="space-y-1">
              <p className="text-lg font-semibold text-slate-900">
                No goals yet
              </p>
              <p className="text-sm text-slate-600">
                Plan targets now, then link them to transactions when the
                backend model ships.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="default" disabled>
                Add goal (coming soon)
              </Button>
              <Button asChild variant="outline">
                <Link to={PageRoutes.imports}>Import transactions</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={PageRoutes.transactions}>View transactions</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
              <CardHeader>
                <CardTitle className="text-sm text-slate-600">
                  Saved so far
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-slate-900">
                {formatCurrency(totals.totalCurrent)}
                <div className="mt-1 text-xs text-slate-500">
                  {Math.round(
                    (totals.totalCurrent / (totals.totalTarget || 1)) * 100,
                  )}
                  % of targets
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
              <CardHeader>
                <CardTitle className="text-sm text-slate-600">
                  Target total
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-slate-900">
                {formatCurrency(totals.totalTarget)}
                <div className="mt-1 text-xs text-slate-500">
                  Across {goals.length} goals
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
              <CardHeader>
                <CardTitle className="text-sm text-slate-600">
                  Average progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
                  {totals.avgProgress}%
                  <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                </div>
                <Progress value={totals.avgProgress} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => {
              const progress = Math.min(
                100,
                Math.round((goal.current / goal.target) * 100),
              );
              const daysLeft = Math.max(
                0,
                Math.ceil(
                  (new Date(goal.dueDate).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24),
                ),
              );
              const monthlyNeeded = Math.max(
                0,
                Math.round(
                  (goal.target - goal.current) / Math.max(1, daysLeft / 30),
                ),
              );

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
                      <Badge className={cn(statusTone[goal.status])}>
                        {statusLabel[goal.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">{goal.description}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="h-4 w-4" /> Due{" "}
                      {formatDate(goal.dueDate)}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <div className="flex items-center justify-between text-sm text-slate-700">
                      <div>
                        <span className="text-xs tracking-wide text-slate-500 uppercase">
                          Target
                        </span>
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(goal.target)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs tracking-wide text-slate-500 uppercase">
                          Saved
                        </span>
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(goal.current)}
                        </div>
                      </div>
                    </div>
                    <Progress value={progress} />
                    <div className="flex items-center justify-between text-sm text-slate-700">
                      <span className="text-xs tracking-wide text-slate-500 uppercase">
                        Progress
                      </span>
                      <span className="font-semibold text-slate-900">
                        {progress}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2 text-xs tracking-wide text-slate-500 uppercase">
                        <Clock className="h-4 w-4" /> Days left
                      </div>
                      <div className="text-right font-semibold text-slate-900">
                        {daysLeft}
                      </div>
                      <div className="flex items-center gap-2 text-xs tracking-wide text-slate-500 uppercase">
                        <ArrowUpRight className="h-4 w-4" /> Needed monthly
                      </div>
                      <div className="text-right font-semibold text-slate-900">
                        {formatCurrency(monthlyNeeded)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">
                        Ledger sync coming soon
                      </span>
                      <span>
                        Goals will auto-update from transactions once the
                        backend model is ready. Use these placeholders for
                        planning and reviews.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Goals;
