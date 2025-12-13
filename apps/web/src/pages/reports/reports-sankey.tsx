import React, { useMemo } from "react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type SankeyCategoryItem = {
  name: string;
  total: number;
  color?: string | null;
};

type SankeyNodePayload = {
  name: string;
  color: string;
  kind: "incomeCategory" | "expenseCategory" | "income" | "expense" | "saved";
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
  depth: number;
  payload: SankeyNodePayload;
  value: number;
};

type SankeyLinkRendererProps = {
  linkPath: string;
  linkWidth: number;
  source: { payload?: SankeyNodePayload } | number;
  target: { payload?: SankeyNodePayload } | number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });

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
  const expenseNode = addNode({
    name: "Expenses",
    color: "#ef4444",
    kind: "expense",
  });

  const savedNode =
    net >= 0
      ? addNode({
          name: "Saved",
          color: "#0ea5e9",
          kind: "saved",
        })
      : addNode({
          name: "Buffer / debt",
          color: "#f97316",
          kind: "saved",
        });

  incomeBuckets.forEach((bucket) => {
    const sourceIdx = addNode({
      name: bucket.name,
      color: bucket.color,
      kind: "incomeCategory",
    });
    links.push({ source: sourceIdx, target: incomeNode, value: bucket.value });
  });

  if (net >= 0) {
    if (expenseTotal > 0) {
      links.push({
        source: incomeNode,
        target: expenseNode,
        value: expenseTotal,
      });
    }
    if (net > 0) {
      links.push({ source: incomeNode, target: savedNode, value: net });
    }
  } else {
    if (incomeTotal > 0) {
      links.push({
        source: incomeNode,
        target: expenseNode,
        value: incomeTotal,
      });
    }
    links.push({
      source: savedNode,
      target: expenseNode,
      value: Math.abs(net),
    });
  }

  expenseBuckets.forEach((bucket) => {
    const targetIdx = addNode({
      name: bucket.name,
      color: bucket.color,
      kind: "expenseCategory",
    });
    links.push({ source: expenseNode, target: targetIdx, value: bucket.value });
  });

  return {
    data: { nodes, links },
    income: incomeTotal,
    expense: expenseTotal,
    net,
  };
};

const SankeyTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name?: unknown; value?: unknown }>;
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const name = typeof item?.name === "string" ? item.name : "Flow";
  const value = clampPositive(Number(item?.value ?? 0));
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-slate-900">{name}</p>
      <p className="text-slate-600">{formatCurrency(value)}</p>
    </div>
  );
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
      <CardContent className="flex h-[420px] flex-col gap-3">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : !result ? (
          <div className="flex h-full items-center justify-center rounded-md border border-slate-100 bg-slate-50 p-6 text-sm text-slate-600">
            No cashflow data yet.
          </div>
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
                  iterations={48}
                  nodeWidth={12}
                  nodePadding={22}
                  linkCurvature={0.6}
                  node={(props: SankeyNodeRendererProps) => {
                    const { x, y, width, height, payload, depth, value } =
                      props;
                    const rx = 4;
                    const fill = payload.color;
                    const isLeft = depth === 0;
                    const isRight =
                      depth > 0 &&
                      (payload.kind === "expenseCategory" ||
                        payload.kind === "saved");
                    const labelX = isLeft
                      ? x + width + 8
                      : isRight
                        ? x - 8
                        : x + width / 2;
                    const anchor = isLeft
                      ? "start"
                      : isRight
                        ? "end"
                        : "middle";
                    const label = payload.name;
                    const showValue =
                      payload.kind === "income" ||
                      payload.kind === "expense" ||
                      payload.kind === "saved";

                    return (
                      <g>
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          rx={rx}
                          fill={fill}
                          fillOpacity={0.85}
                          stroke="rgba(15,23,42,0.18)"
                        />
                        <text
                          x={labelX}
                          y={y + height / 2}
                          textAnchor={anchor}
                          dominantBaseline="middle"
                          fill="#0f172a"
                          fontSize={12}
                        >
                          {label}
                        </text>
                        {showValue ? (
                          <text
                            x={labelX}
                            y={y + height / 2 + 16}
                            textAnchor={anchor}
                            dominantBaseline="middle"
                            fill="#475569"
                            fontSize={11}
                          >
                            {formatCurrency(value)}
                          </text>
                        ) : null}
                      </g>
                    );
                  }}
                  link={(props: SankeyLinkRendererProps) => {
                    const { linkPath, linkWidth, source } = props;
                    const sourceColor =
                      typeof source === "object" && source?.payload?.color
                        ? source.payload.color
                        : "#94a3b8";
                    return (
                      <path
                        d={linkPath}
                        fill="none"
                        stroke={sourceColor}
                        strokeOpacity={0.18}
                        strokeWidth={Math.max(1, linkWidth)}
                      />
                    );
                  }}
                >
                  <Tooltip content={<SankeyTooltip />} />
                </Sankey>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
