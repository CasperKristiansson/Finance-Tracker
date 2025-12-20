import React, { useMemo } from "react";
import { ResponsiveContainer, Sankey } from "recharts";

import { EmptyState } from "@/components/composed/empty-state";
import { LoadingCard } from "@/components/composed/loading-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SankeyCategoryItem = {
  name: string;
  total: number;
  color?: string | null;
};

type SankeyNodePayload = {
  name: string;
  color: string;
  kind:
    | "incomeCategory"
    | "expenseCategory"
    | "income"
    | "expenses"
    | "saved"
    | "buffer";
};

type SankeyLinkDatum = { source: number; target: number; value: number };

type SankeyDatum = {
  nodes: SankeyNodePayload[];
  links: SankeyLinkDatum[];
};

type SankeyNodeRendererProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: SankeyNodePayload & { value: number };
};

type SankeyLinkRendererProps = {
  sourceX: number;
  sourceY: number;
  sourceControlX: number;
  targetX: number;
  targetY: number;
  targetControlX: number;
  linkWidth: number;
  source: { payload?: SankeyNodePayload } | number;
  target: { payload?: SankeyNodePayload } | number;
};

const formatCurrency = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });
};

const clampPositive = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const topWithOther = (
  items: SankeyCategoryItem[],
  maxVisible: number,
  otherLabel: string,
): Array<{ name: string; value: number; color: string }> => {
  const sorted = items
    .map((item) => ({
      name: item.name || "Unknown",
      value: clampPositive(item.total),
      color: item.color ?? "#94a3b8",
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const head = sorted.slice(0, maxVisible);
  const rest = sorted.slice(maxVisible);
  const otherValue = rest.reduce((sum, item) => sum + item.value, 0);

  return otherValue > 0
    ? [...head, { name: otherLabel, value: otherValue, color: "#94a3b8" }]
    : head;
};

const buildMoneyFlowSankey = ({
  incomeCategories,
  expenseCategories,
  maxIncome = 7,
  maxExpense = 8,
}: {
  incomeCategories: SankeyCategoryItem[];
  expenseCategories: SankeyCategoryItem[];
  maxIncome?: number;
  maxExpense?: number;
}): {
  data: SankeyDatum;
  income: number;
  expense: number;
  net: number;
} | null => {
  const incomeBuckets = topWithOther(
    incomeCategories,
    maxIncome,
    "Other income",
  );
  const expenseBuckets = topWithOther(
    expenseCategories,
    maxExpense,
    "Other expenses",
  );

  const incomeTotal = incomeBuckets.reduce((sum, row) => sum + row.value, 0);
  const expenseTotal = expenseBuckets.reduce((sum, row) => sum + row.value, 0);
  const net = incomeTotal - expenseTotal;

  if (incomeTotal <= 0 && expenseTotal <= 0) return null;

  const nodes: SankeyNodePayload[] = [];
  const links: SankeyLinkDatum[] = [];
  const indexOf = new Map<string, number>();

  const addNode = (node: SankeyNodePayload) => {
    const key = `${node.kind}:${node.name}`;
    const existing = indexOf.get(key);
    if (existing !== undefined) return existing;
    const idx = nodes.length;
    nodes.push(node);
    indexOf.set(key, idx);
    return idx;
  };

  const incomeNode = addNode({
    name: "Income",
    color: "#10b981",
    kind: "income",
  });

  const expensesNode =
    expenseTotal > 0
      ? addNode({
          name: "Expenses",
          color: "#ef4444",
          kind: "expenses",
        })
      : null;

  const savedNode =
    net === 0
      ? null
      : net > 0
        ? addNode({
            name: "Saved",
            color: "#0ea5e9",
            kind: "saved",
          })
        : addNode({
            name: "Buffer / debt",
            color: "#f97316",
            kind: "buffer",
          });

  incomeBuckets.forEach((bucket) => {
    const sourceIdx = addNode({
      name: bucket.name,
      color: bucket.color,
      kind: "incomeCategory",
    });
    links.push({ source: sourceIdx, target: incomeNode, value: bucket.value });
  });

  if (expensesNode !== null) {
    if (net >= 0) {
      links.push({
        source: incomeNode,
        target: expensesNode,
        value: expenseTotal,
      });
    } else {
      links.push({
        source: incomeNode,
        target: expensesNode,
        value: incomeTotal,
      });
      if (savedNode !== null) {
        links.push({
          source: savedNode,
          target: expensesNode,
          value: Math.abs(net),
        });
      }
    }

    expenseBuckets.forEach((bucket) => {
      const targetIdx = addNode({
        name: bucket.name,
        color: bucket.color,
        kind: "expenseCategory",
      });
      links.push({
        source: expensesNode,
        target: targetIdx,
        value: bucket.value,
      });
    });
  }

  if (savedNode !== null && net > 0) {
    links.push({ source: incomeNode, target: savedNode, value: net });
  }

  return {
    data: { nodes, links },
    income: incomeTotal,
    expense: expenseTotal,
    net,
  };
};

export const MoneyFlowSankeyCard: React.FC<{
  title: string;
  description: string;
  incomeCategories: SankeyCategoryItem[];
  expenseCategories: SankeyCategoryItem[];
  loading?: boolean;
  className?: string;
}> = ({
  title,
  description,
  incomeCategories,
  expenseCategories,
  loading,
  className,
}) => {
  const result = useMemo(
    () => buildMoneyFlowSankey({ incomeCategories, expenseCategories }),
    [expenseCategories, incomeCategories],
  );

  return (
    <Card
      className={cn(
        "border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        <p className="text-xs text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="flex h-[750px] flex-col gap-3">
        {loading ? (
          <LoadingCard className="h-full" lines={14} />
        ) : !result ? (
          <EmptyState className="h-full" title="No cashflow data yet." />
        ) : (
          <>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-medium tracking-wide text-slate-600 uppercase">
                  Income
                </p>
                <p className="text-sm font-semibold text-emerald-700">
                  {formatCurrency(result.income)}
                </p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-medium tracking-wide text-slate-600 uppercase">
                  Expenses
                </p>
                <p className="text-sm font-semibold text-rose-700">
                  {formatCurrency(result.expense)}
                </p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-medium tracking-wide text-slate-600 uppercase">
                  {result.net >= 0 ? "Saved" : "Overspent"}
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    result.net >= 0 ? "text-sky-700" : "text-orange-700",
                  )}
                >
                  {formatCurrency(Math.abs(result.net))}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 rounded-md border border-slate-100 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <Sankey
                  data={result.data}
                  iterations={64}
                  nodeWidth={14}
                  nodePadding={22}
                  linkCurvature={0.55}
                  sort={false}
                  margin={{ top: 12, right: 40, bottom: 12, left: 40 }}
                  node={(props: SankeyNodeRendererProps) => {
                    const { x, y, width, height, payload } = props;
                    const isExpenseCategory =
                      payload.kind === "expenseCategory";
                    const showLabel = isExpenseCategory ? true : height >= 16;
                    const label =
                      payload.name.length > 18
                        ? `${payload.name.slice(0, 17)}…`
                        : payload.name;
                    const placement =
                      payload.kind === "incomeCategory"
                        ? "right"
                        : payload.kind === "income"
                          ? "center"
                          : "left";
                    const labelX =
                      placement === "right"
                        ? x + width + 8
                        : placement === "left"
                          ? x - 10
                          : x + width / 2;
                    const anchor =
                      placement === "right"
                        ? "start"
                        : placement === "left"
                          ? "end"
                          : "middle";
                    const showValue =
                      payload.kind === "income" ||
                      payload.kind === "expenses" ||
                      payload.kind === "saved" ||
                      payload.kind === "buffer";
                    const showValueText =
                      showValue &&
                      (isExpenseCategory ? height >= 28 : height >= 18);
                    const gradientId = `sankey-node-${payload.kind}-${props.index}`;

                    return (
                      <g>
                        <defs>
                          <linearGradient
                            id={gradientId}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={payload.color}
                              stopOpacity={0.95}
                            />
                            <stop
                              offset="100%"
                              stopColor={payload.color}
                              stopOpacity={0.65}
                            />
                          </linearGradient>
                        </defs>
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          rx={4}
                          fill={`url(#${gradientId})`}
                          stroke="rgba(15,23,42,0.18)"
                        />
                        {showLabel ? (
                          <>
                            <text
                              x={labelX}
                              y={y + height / 2}
                              textAnchor={anchor}
                              dominantBaseline="middle"
                              fill="#0f172a"
                              fontSize={
                                payload.kind === "expenseCategory" ? 11 : 12
                              }
                              paintOrder={
                                payload.kind === "expenseCategory"
                                  ? "stroke"
                                  : undefined
                              }
                              stroke={
                                payload.kind === "expenseCategory"
                                  ? "rgba(255,255,255,0.9)"
                                  : undefined
                              }
                              strokeWidth={
                                payload.kind === "expenseCategory"
                                  ? 4
                                  : undefined
                              }
                            >
                              {label}
                            </text>
                            {showValueText ? (
                              <text
                                x={labelX}
                                y={y + height / 2 + 16}
                                textAnchor={anchor}
                                dominantBaseline="middle"
                                fill="#475569"
                                fontSize={11}
                              >
                                {formatCurrency(payload.value)}
                              </text>
                            ) : null}
                          </>
                        ) : null}
                      </g>
                    );
                  }}
                  link={(props: SankeyLinkRendererProps) => {
                    const {
                      sourceX,
                      sourceY,
                      sourceControlX,
                      targetX,
                      targetY,
                      targetControlX,
                      linkWidth,
                      source,
                      target,
                    } = props;
                    const sourcePayload =
                      typeof source === "object" ? source?.payload : undefined;
                    const targetPayload =
                      typeof target === "object" ? target?.payload : undefined;
                    const { stroke, opacity } = (() => {
                      if (sourcePayload?.kind === "incomeCategory") {
                        return { stroke: "#10b981", opacity: 0.14 };
                      }
                      if (
                        sourcePayload?.kind === "income" &&
                        targetPayload?.kind === "expenses"
                      ) {
                        return { stroke: "#94a3b8", opacity: 0.22 };
                      }
                      if (
                        sourcePayload?.kind === "income" &&
                        targetPayload?.kind === "saved"
                      ) {
                        return { stroke: "#0ea5e9", opacity: 0.22 };
                      }
                      if (
                        sourcePayload?.kind === "buffer" &&
                        targetPayload?.kind === "expenses"
                      ) {
                        return { stroke: "#f97316", opacity: 0.22 };
                      }
                      if (
                        sourcePayload?.kind === "expenses" &&
                        targetPayload?.kind === "expenseCategory"
                      ) {
                        return { stroke: "#ef4444", opacity: 0.16 };
                      }
                      return { stroke: "#cbd5e1", opacity: 0.2 };
                    })();
                    const d = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
                    return (
                      <path
                        d={d}
                        fill="none"
                        stroke={stroke}
                        strokeOpacity={opacity}
                        strokeWidth={Math.max(1, Number(linkWidth) || 0)}
                        strokeLinecap="round"
                      />
                    );
                  }}
                ></Sankey>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
