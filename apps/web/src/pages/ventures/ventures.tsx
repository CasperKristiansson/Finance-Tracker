import {
  ArrowRight,
  Building2,
  CalendarDays,
  Coins,
  Network,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/composed/empty-state";
import { InlineError } from "@/components/composed/inline-error";
import { LoadingCard } from "@/components/composed/loading-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageRoutes } from "@/data/routes";
import type { VentureOverview } from "@/features/ventures/venturesSlice";
import { useVenturesApi } from "@/hooks/use-api";
import { compactCurrency, formatDate, percent } from "@/lib/format";
import { cn } from "@/lib/utils";

const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatSek = (value: string | number | null | undefined) =>
  compactCurrency(toNumber(value), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });

const formatPercent = (value: string | number | null | undefined) =>
  value === null || value === undefined
    ? "No ownership"
    : percent(toNumber(value), { maximumFractionDigits: 1 });

const statusClassName = (status: string) =>
  ({
    ongoing: "border-emerald-200 bg-emerald-50 text-emerald-700",
    idea: "border-sky-200 bg-sky-50 text-sky-700",
    stale: "border-amber-200 bg-amber-50 text-amber-800",
    exited: "border-orange-200 bg-orange-50 text-orange-800",
    failed: "border-rose-200 bg-rose-50 text-rose-700",
  })[status] ?? "border-slate-200 bg-slate-50 text-slate-700";

const titleCase = (value: string) =>
  value
    .split(/[_ -]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const ventureCompanyPath = (companyId: string) =>
  PageRoutes.ventureCompany.replace(":companyId", companyId);

const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone?: "teal" | "blue" | "amber";
}> = ({ icon, label, value, detail, tone = "teal" }) => (
  <Card className="rounded-lg border-slate-200/80 bg-white/95 shadow-sm">
    <CardContent className="flex items-center gap-4 p-5">
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-sm",
          {
            teal: "border-teal-100 bg-teal-50 text-teal-700",
            blue: "border-sky-100 bg-sky-50 text-sky-700",
            amber: "border-amber-100 bg-amber-50 text-amber-700",
          }[tone],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-normal text-slate-950 tabular-nums">
          {value}
        </p>
        {detail ? (
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        ) : null}
      </div>
    </CardContent>
  </Card>
);

const CompanyCard: React.FC<{
  company: VentureOverview["companies"][number];
}> = ({ company }) => {
  const { company: meta } = company;
  const lastActivity = company.last_activity_at ?? meta.updated_at;

  return (
    <Link
      to={ventureCompanyPath(meta.id)}
      className="group block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white shadow-sm">
            {meta.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-950">
              {meta.name}
            </h3>
            <p className="truncate text-sm text-slate-500">
              {[meta.stage, meta.industry].filter(Boolean).join(" · ") ||
                titleCase(meta.company_type)}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn("shrink-0", statusClassName(meta.status))}
        >
          {titleCase(meta.status)}
        </Badge>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-y border-slate-100 py-4">
        <div>
          <p className="text-xs font-medium text-slate-500">Paper value</p>
          <p className="mt-1 text-lg font-semibold text-slate-950 tabular-nums">
            {formatSek(company.paper_value_sek)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Ownership</p>
          <p className="mt-1 text-lg font-semibold text-slate-950 tabular-nums">
            {formatPercent(company.ownership_pct)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Updated {formatDate(lastActivity, { month: "short", day: "numeric" })}
        </span>
        <span className="inline-flex items-center gap-1 text-teal-700 opacity-0 transition group-hover:opacity-100">
          Open <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
};

export const Ventures: React.FC = () => {
  const { overview, loading, errors, fetchOverview } = useVenturesApi();

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const isInitialLoading = loading.overview && !overview;
  const companies = overview?.companies ?? [];

  return (
    <div className="flex min-h-full flex-col gap-6 bg-slate-50/70 p-2 md:p-4">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
            Ventures
          </h1>
          <p className="mt-1 text-base text-slate-600">
            Founder equity, company history, and private holdings.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-800"
        >
          Paper values stay outside net worth
        </Badge>
      </section>

      {errors.overview ? (
        <InlineError
          message={errors.overview}
          action={
            <Button size="sm" variant="outline" onClick={fetchOverview}>
              Retry
            </Button>
          }
        />
      ) : null}

      {isInitialLoading ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <LoadingCard lines={3} />
          <LoadingCard lines={3} />
          <LoadingCard lines={3} />
        </div>
      ) : overview ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <KpiCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Paper value"
            value={formatSek(overview.kpis.total_paper_value_sek)}
            detail={`${formatSek(overview.kpis.illiquid_paper_value_sek)} illiquid`}
            tone="teal"
          />
          <KpiCard
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Risk-adjusted value"
            value={formatSek(overview.kpis.total_risk_adjusted_value_sek)}
            tone="blue"
          />
          <KpiCard
            icon={<Coins className="h-5 w-5" />}
            label="Realized value"
            value={formatSek(overview.kpis.total_realized_value_sek)}
            detail={`${overview.kpis.company_count} companies tracked`}
            tone="amber"
          />
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white/85 p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Company map
            </h2>
            <p className="text-sm text-slate-500">
              Private company holdings and ownership snapshots.
            </p>
          </div>
          <Network className="h-5 w-5 text-teal-700" />
        </div>

        {isInitialLoading ? (
          <div className="grid gap-4 xl:grid-cols-3">
            <LoadingCard lines={4} />
            <LoadingCard lines={4} />
            <LoadingCard lines={4} />
          </div>
        ) : companies.length ? (
          <div className="grid gap-4 xl:grid-cols-3">
            {companies.map((company) => (
              <CompanyCard key={company.company.id} company={company} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No venture companies yet"
            description="Ventures is ready to load your private company data once companies are added."
            className="min-h-64"
          />
        )}
      </section>
    </div>
  );
};
