import { motion } from "framer-motion";
import {
  Loader2,
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAppSelector } from "@/app/hooks";
import {
  MotionPage,
  StaggerWrap,
  fadeInUp,
  subtleHover,
} from "@/components/motion-presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { selectToken } from "@/features/auth/authSlice";
import { useCategoriesApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import type {
  CategoryRead,
  SubscriptionSummaryRead,
  SubscriptionSummaryResponse,
} from "@/types/api";
import { subscriptionSummaryResponseSchema } from "@/types/schemas";

type MatcherRow = {
  id: string;
  matcher_text?: string;
  matcher_amount_tolerance: number | null;
  matcher_day_of_month: number | null;
  category_id?: string | null;
};

type MatcherFormValues = {
  rows: MatcherRow[];
};

const matcherRowSchema: z.ZodType<MatcherRow> = z.object({
  id: z.string(),
  matcher_text: z.string().optional(),
  matcher_amount_tolerance: z.number().nullable(),
  matcher_day_of_month: z.number().nullable(),
  category_id: z.string().nullable().optional(),
});

const numberValue = (value: string | number | null | undefined) =>
  value === null || value === undefined ? 0 : Number(value);

const formatAmount = (value: string | number | null | undefined) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numberValue(value));

const toNumberOrNull = (value: string | number | null | undefined) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const Sparkline: React.FC<{ data: Array<string | number> }> = ({ data }) => {
  const points = data.map((value) => numberValue(value));
  const max = Math.max(...points, 1);
  const width = 120;
  const height = 40;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points
    .map((val, idx) => {
      const x = idx * step;
      const y = height - (val / max) * height;
      return `${x},${Number.isFinite(y) ? y : height}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="text-emerald-500">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
};

type EditableFields = Pick<
  SubscriptionSummaryRead,
  | "matcher_text"
  | "matcher_amount_tolerance"
  | "matcher_day_of_month"
  | "category_id"
>;

export const Subscriptions: React.FC = () => {
  const token = useAppSelector(selectToken);
  const { items: categories, fetchCategories } = useCategoriesApi();
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionSummaryRead[]>(
    [],
  );

  const matcherForm = useForm<MatcherFormValues>({
    defaultValues: { rows: [] },
  });

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await apiFetch<SubscriptionSummaryResponse>({
        path: "/subscriptions/summary",
        schema: subscriptionSummaryResponseSchema,
        token,
      });
      setSubscriptions(data.subscriptions ?? []);
      matcherForm.reset({
        rows: (data.subscriptions ?? []).map((sub) => ({
          id: sub.id,
          matcher_text: sub.matcher_text ?? "",
          matcher_amount_tolerance: toNumberOrNull(
            sub.matcher_amount_tolerance,
          ),
          matcher_day_of_month: toNumberOrNull(sub.matcher_day_of_month),
          category_id: sub.category_id ?? null,
        })),
      });
    } catch (error) {
      toast.error("Unable to load subscriptions", {
        description:
          error instanceof Error ? error.message : "Please try again shortly.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const grouped = useMemo(() => {
    const active = subscriptions.filter((s) => s.is_active);
    const archived = subscriptions.filter((s) => !s.is_active);
    return { active, archived };
  }, [subscriptions]);

  const rows = (matcherForm.watch("rows") as MatcherRow[] | undefined) ?? [];

  const saveMatcher = async (subscription: SubscriptionSummaryRead) => {
    if (!token) return;
    const row = rows?.find((r: MatcherRow) => r.id === subscription.id);
    const parsed = matcherRowSchema.safeParse(row);
    if (!parsed.success) {
      void matcherForm.trigger();
      toast.error("Fix matcher values", {
        description: parsed.error.issues[0]?.message,
      });
      return;
    }
    setSavingId(subscription.id);
    try {
      const payload: Partial<EditableFields> = {
        matcher_text: parsed.data.matcher_text?.trim() || undefined,
        matcher_amount_tolerance: parsed.data.matcher_amount_tolerance,
        matcher_day_of_month: parsed.data.matcher_day_of_month,
        category_id: parsed.data.category_id || null,
      };

      await apiFetch({
        path: `/subscriptions/${subscription.id}`,
        method: "PATCH",
        body: payload,
        token,
      });
      toast.success("Subscription updated", { description: subscription.name });
      await load();
    } catch (error) {
      toast.error("Update failed", {
        description:
          error instanceof Error ? error.message : "Please try again shortly.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (subscription: SubscriptionSummaryRead) => {
    if (!token) return;
    setSavingId(subscription.id);
    try {
      await apiFetch({
        path: `/subscriptions/${subscription.id}`,
        method: "PATCH",
        body: { is_active: !subscription.is_active },
        token,
      });
      await load();
      toast.success(
        subscription.is_active
          ? "Subscription archived"
          : "Subscription reactivated",
        { description: subscription.name },
      );
    } catch (error) {
      toast.error("Update failed", {
        description:
          error instanceof Error ? error.message : "Please try again shortly.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const renderGroup = (title: string, list: SubscriptionSummaryRead[]) => {
    if (loading && !list.length) {
      return <Skeleton className="h-40 w-full" />;
    }
    if (!list.length) {
      return (
        <p className="text-sm text-slate-500">
          No {title.toLowerCase()} subscriptions yet.
        </p>
      );
    }
    return (
      <StaggerWrap className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((sub, index) => {
          const rowIndex =
            rows?.findIndex((r: MatcherRow) => r.id === sub.id) ?? -1;
          if (rowIndex < 0) return null;
          const edit = rows?.[rowIndex] || {
            matcher_text: sub.matcher_text,
            matcher_amount_tolerance: sub.matcher_amount_tolerance,
            matcher_day_of_month: sub.matcher_day_of_month,
            category_id: sub.category_id,
          };
          const categoryName =
            categories.find(
              (c: CategoryRead) =>
                c.id === (edit.category_id ?? sub.category_id),
            )?.name ??
            sub.category_name ??
            "Unassigned";

          return (
            <motion.div
              key={sub.id}
              variants={fadeInUp}
              {...subtleHover}
              transition={{
                duration: 0.35,
                ease: "easeOut",
                delay: index * 0.04,
              }}
            >
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-slate-900">
                        {sub.name}
                      </CardTitle>
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        {categoryName}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(sub)}
                      disabled={savingId === sub.id}
                      className="text-slate-500"
                      title={sub.is_active ? "Archive" : "Reactivate"}
                    >
                      {sub.is_active ? (
                        <ToggleRight className="h-4 w-4" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Current month</span>
                    <span className="font-semibold text-slate-900">
                      {formatAmount(sub.current_month_spend)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Trailing 3 / 12</span>
                    <span className="font-semibold text-slate-900">
                      {formatAmount(sub.trailing_three_month_spend)} ·{" "}
                      {formatAmount(sub.trailing_twelve_month_spend)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Last charge</span>
                    <span className="font-semibold text-slate-900">
                      {sub.last_charge_at
                        ? new Date(sub.last_charge_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Trend</span>
                    <Sparkline data={sub.trend} />
                  </div>

                  <div className="rounded border border-slate-100 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Matcher
                    </p>
                    <div className="space-y-2">
                      <Input
                        size="sm"
                        {...matcherForm.register(
                          `rows.${rowIndex}.matcher_text` as const,
                        )}
                        placeholder="Matcher text or regex"
                        className="h-8"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          size="sm"
                          type="number"
                          {...matcherForm.register(
                            `rows.${rowIndex}.matcher_amount_tolerance` as const,
                            {
                              setValueAs: (val) =>
                                val === "" || val === undefined
                                  ? null
                                  : Number(val),
                            },
                          )}
                          placeholder="Amount tolerance"
                          className="h-8"
                        />
                        <Input
                          size="sm"
                          type="number"
                          {...matcherForm.register(
                            `rows.${rowIndex}.matcher_day_of_month` as const,
                            {
                              setValueAs: (val) =>
                                val === "" || val === undefined
                                  ? null
                                  : Number(val),
                            },
                          )}
                          placeholder="Day of month"
                          className="h-8"
                        />
                      </div>
                      <select
                        className="h-8 rounded border border-slate-200 px-2 text-sm"
                        {...matcherForm.register(
                          `rows.${rowIndex}.category_id` as const,
                          {
                            setValueAs: (val) => (val === "" ? null : val),
                          },
                        )}
                      >
                        <option value="">No category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => saveMatcher(sub)}
                        disabled={savingId === sub.id}
                      >
                        {savingId === sub.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Save matchers
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          matcherForm.reset({
                            rows: subscriptions.map((s) => ({
                              id: s.id,
                              matcher_text: s.matcher_text ?? "",
                              matcher_amount_tolerance: toNumberOrNull(
                                s.matcher_amount_tolerance,
                              ),
                              matcher_day_of_month: toNumberOrNull(
                                s.matcher_day_of_month,
                              ),
                              category_id: s.category_id ?? null,
                            })),
                          })
                        }
                        className="text-slate-500"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </StaggerWrap>
    );
  };

  return (
    <MotionPage className="space-y-6">
      <StaggerWrap className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <motion.div variants={fadeInUp}>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Subscriptions
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Recurring spend and matchers
          </h1>
          <p className="text-sm text-slate-500">
            Track recurring charges, update matchers, and archive old
            subscriptions.
          </p>
        </motion.div>
        <motion.div variants={fadeInUp} className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </motion.div>
      </StaggerWrap>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
            Active
          </h2>
          <span className="text-xs text-slate-500">
            Current month · trailing 3/12 months · last charge · trend
          </span>
        </div>
        {renderGroup("Active", grouped.active)}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
            Archived
          </h2>
          <span className="text-xs text-slate-500">
            Reactivate to include in suggestions
          </span>
        </div>
        {renderGroup("Archived", grouped.archived)}
      </div>
    </MotionPage>
  );
};

export default Subscriptions;
