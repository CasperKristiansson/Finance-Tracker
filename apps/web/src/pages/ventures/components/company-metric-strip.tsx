import { CalendarDays, Droplets, ShieldCheck, TrendingUp } from "lucide-react";
import React from "react";
import type { VentureCompanyDetail } from "@/features/ventures/venturesSlice";
import {
  formatVentureDate,
  formatVenturePercent,
  formatVentureSek,
  titleCase,
} from "@/pages/ventures/utils/format";

type CompanyMetricStripProps = {
  detail: VentureCompanyDetail;
};

const Metric: React.FC<{
  label: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode;
}> = ({ label, value, helper, icon }) => (
  <div className="min-w-0 border-slate-200 px-4 py-3 first:pl-0 lg:border-l lg:first:border-l-0">
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
      {icon}
      <span>{label}</span>
    </div>
    <p className="mt-1 truncate text-2xl font-semibold tracking-normal text-slate-950 tabular-nums">
      {value}
    </p>
    {helper ? (
      <p className="mt-1 truncate text-xs text-slate-500">{helper}</p>
    ) : null}
  </div>
);

const liquidityLabel = (value: string | null | undefined) =>
  value ? titleCase(value) : "No liquidity data";

export const CompanyMetricStrip: React.FC<CompanyMetricStripProps> = ({
  detail,
}) => {
  const { summary } = detail;
  const latestValuation = summary.latest_valuation;
  const latestOwnership = summary.latest_ownership;
  const confidenceScore = latestValuation?.confidence_score;
  const lastUpdate = summary.last_activity_at ?? summary.company.updated_at;

  return (
    <section className="grid rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6">
      <Metric
        icon={<TrendingUp className="h-3.5 w-3.5 text-teal-700" />}
        label="Ownership"
        value={formatVenturePercent(summary.ownership_pct)}
        helper={latestOwnership?.reason ?? latestOwnership?.effective_date}
      />
      <Metric
        label="Paper value"
        value={formatVentureSek(summary.paper_value_sek)}
        helper={latestValuation?.label ?? "Latest marked paper value"}
      />
      <Metric
        icon={<ShieldCheck className="h-3.5 w-3.5 text-teal-700" />}
        label="Risk-adjusted"
        value={formatVentureSek(summary.risk_adjusted_value_sek)}
        helper={
          latestValuation
            ? `${latestValuation.haircut_percentage ?? "0"}% haircut`
            : "No valuation event"
        }
      />
      <Metric
        icon={<Droplets className="h-3.5 w-3.5 text-amber-600" />}
        label="Liquidity"
        value={liquidityLabel(latestValuation?.liquidity_level)}
        helper="Not liquid cash"
      />
      <Metric
        label="Confidence"
        value={confidenceScore ? `${confidenceScore}/5` : "Not scored"}
        helper={
          latestValuation?.valuation_source
            ? titleCase(latestValuation.valuation_source)
            : undefined
        }
      />
      <Metric
        icon={<CalendarDays className="h-3.5 w-3.5 text-slate-500" />}
        label="Last update"
        value={formatVentureDate(lastUpdate)}
      />
    </section>
  );
};
