import { Loader2 } from "lucide-react";
import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatCurrency } from "../utils";

export type AccountHealth = {
  cash: number;
  investments: number;
  debt: number;
  netWorth: number;
};

type AccountHealthCardProps = {
  asOfDate?: string | null;
  includeInactive: boolean;
  loading: boolean;
  health: AccountHealth;
};

export const AccountHealthCard: React.FC<AccountHealthCardProps> = ({
  asOfDate,
  includeInactive,
  loading,
  health,
}) => (
  <Card className="border-slate-200 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.4)]">
    <CardHeader className="flex flex-row items-start justify-between space-y-0">
      <div>
        <CardTitle className="text-sm text-slate-500">Account health</CardTitle>
        <p className="text-xs text-slate-500">
          {asOfDate ? `As of ${asOfDate}` : "As of today"}
          {includeInactive ? " (including inactive)" : ""}
        </p>
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      ) : null}
    </CardHeader>
    <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        {
          label: "Cash",
          value: health.cash,
          color: "text-sky-700",
          shadow: "shadow-[0_10px_30px_-28px_rgba(14,116,144,0.45)]",
        },
        {
          label: "Investments",
          value: health.investments,
          color: "text-violet-700",
          shadow: "shadow-[0_10px_30px_-28px_rgba(88,28,135,0.45)]",
        },
        {
          label: "Debt",
          value: health.debt,
          color: "text-rose-700",
          shadow: "shadow-[0_10px_30px_-28px_rgba(190,18,60,0.45)]",
        },
        {
          label: "Net worth",
          value: health.netWorth,
          color: health.netWorth >= 0 ? "text-emerald-700" : "text-rose-700",
          shadow: "shadow-[0_10px_30px_-28px_rgba(30,64,175,0.45)]",
        },
      ].map((item) => (
        <div
          key={item.label}
          className={`rounded-lg border border-slate-100 bg-white px-4 py-3 ${item.shadow}`}
        >
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            <span className={item.color}>{formatCurrency(item.value)}</span>
          </p>
        </div>
      ))}
    </CardContent>
  </Card>
);
