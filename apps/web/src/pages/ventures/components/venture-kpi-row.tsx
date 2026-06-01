import { Coins, Droplets, ShieldCheck, TrendingUp } from "lucide-react";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { VentureOverview } from "@/features/ventures/venturesSlice";
import { cn } from "@/lib/utils";
import {
  formatVentureSek,
  toFiniteNumber,
} from "@/pages/ventures/utils/format";

type VentureKpiRowProps = {
  kpis: VentureOverview["kpis"];
};

const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: "teal" | "blue" | "amber" | "slate";
}> = ({ icon, label, value, detail, tone }) => (
  <Card className="rounded-lg border-slate-200/80 bg-white/95 shadow-sm">
    <CardContent className="flex min-h-28 items-center gap-4 p-5">
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-sm",
          {
            teal: "border-teal-100 bg-teal-50 text-teal-700",
            blue: "border-sky-100 bg-sky-50 text-sky-700",
            amber: "border-amber-100 bg-amber-50 text-amber-700",
            slate: "border-slate-200 bg-slate-50 text-slate-700",
          }[tone],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-semibold tracking-normal text-slate-950 tabular-nums">
          {value}
        </p>
        {detail ? (
          <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
        ) : null}
      </div>
    </CardContent>
  </Card>
);

export const VentureKpiRow: React.FC<VentureKpiRowProps> = ({ kpis }) => {
  const paperValue = toFiniteNumber(kpis.total_paper_value_sek);
  const illiquidValue = toFiniteNumber(kpis.illiquid_paper_value_sek);
  const illiquidShare =
    paperValue > 0 ? Math.round((illiquidValue / paperValue) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
      <KpiCard
        icon={<TrendingUp className="h-5 w-5" />}
        label="Paper value"
        value={formatVentureSek(kpis.total_paper_value_sek)}
        detail={`${kpis.company_count} companies tracked`}
        tone="teal"
      />
      <KpiCard
        icon={<ShieldCheck className="h-5 w-5" />}
        label="Risk-adjusted value"
        value={formatVentureSek(kpis.total_risk_adjusted_value_sek)}
        detail="After valuation haircuts"
        tone="blue"
      />
      <KpiCard
        icon={<Coins className="h-5 w-5" />}
        label="Realized value"
        value={formatVentureSek(kpis.total_realized_value_sek)}
        detail="Exited or distributed value"
        tone="amber"
      />
      <KpiCard
        icon={<Droplets className="h-5 w-5" />}
        label="Illiquid context"
        value={formatVentureSek(kpis.illiquid_paper_value_sek)}
        detail={`${illiquidShare}% of paper value`}
        tone="slate"
      />
    </div>
  );
};
