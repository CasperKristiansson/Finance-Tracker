import {
  ArrowLeft,
  Building2,
  CalendarDays,
  FileText,
  Network,
  NotebookText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { InlineError } from "@/components/composed/inline-error";
import { LoadingCard } from "@/components/composed/loading-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageRoutes } from "@/data/routes";
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

const titleCase = (value: string) =>
  value
    .split(/[_ -]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const statusClassName = (status: string) =>
  ({
    ongoing: "border-emerald-200 bg-emerald-50 text-emerald-700",
    idea: "border-sky-200 bg-sky-50 text-sky-700",
    stale: "border-amber-200 bg-amber-50 text-amber-800",
    exited: "border-orange-200 bg-orange-50 text-orange-800",
    failed: "border-rose-200 bg-rose-50 text-rose-700",
  })[status] ?? "border-slate-200 bg-slate-50 text-slate-700";

const MetricCard: React.FC<{
  label: string;
  value: string;
  helper?: string;
}> = ({ label, value, helper }) => (
  <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
    <CardContent className="p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 tabular-nums">
        {value}
      </p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </CardContent>
  </Card>
);

export const CompanyWorkspace: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const { companyDetails, loading, errors, fetchCompany } = useVenturesApi();
  const detail = companyId ? companyDetails[companyId] : undefined;

  useEffect(() => {
    if (companyId) {
      fetchCompany(companyId);
    }
  }, [companyId, fetchCompany]);

  if (!companyId) {
    return <InlineError message="Missing venture company id." />;
  }

  const isInitialLoading = loading.detail && !detail;

  if (isInitialLoading) {
    return (
      <div className="grid gap-4 p-2 md:p-4">
        <LoadingCard lines={4} />
        <div className="grid gap-4 xl:grid-cols-3">
          <LoadingCard lines={3} />
          <LoadingCard lines={3} />
          <LoadingCard lines={3} />
        </div>
      </div>
    );
  }

  if (errors.detail && !detail) {
    return (
      <div className="p-2 md:p-4">
        <InlineError
          message={errors.detail}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchCompany(companyId)}
            >
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const summary = detail.summary;
  const company = summary.company;
  const latestValuation = summary.latest_valuation;
  const latestOwnership = summary.latest_ownership;
  const lastActivity = summary.last_activity_at ?? company.updated_at;

  return (
    <div className="flex min-h-full flex-col gap-5 bg-slate-50/70 p-2 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={PageRoutes.ventures}>
            <ArrowLeft className="h-4 w-4" />
            Ventures
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchCompany(companyId)}
          disabled={loading.detail}
        >
          <RefreshCw
            className={cn("h-4 w-4", loading.detail && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {errors.detail ? <InlineError message={errors.detail} /> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-950 text-lg font-semibold text-white shadow-sm">
              {company.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
                  {company.name}
                </h1>
                <Badge
                  variant="outline"
                  className={cn(statusClassName(company.status))}
                >
                  {titleCase(company.status)}
                </Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                {company.description ||
                  [company.stage, company.industry, company.country]
                    .filter(Boolean)
                    .join(" · ") ||
                  titleCase(company.company_type)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {titleCase(company.role)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Updated{" "}
                  {formatDate(lastActivity, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-800"
          >
            Venture-only value
          </Badge>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard
          label="Paper value"
          value={formatSek(summary.paper_value_sek)}
          helper={latestValuation?.label}
        />
        <MetricCard
          label="Risk-adjusted value"
          value={formatSek(summary.risk_adjusted_value_sek)}
          helper={
            latestValuation
              ? `${latestValuation.haircut_percentage}% haircut`
              : undefined
          }
        />
        <MetricCard
          label="Ownership"
          value={formatPercent(summary.ownership_pct)}
          helper={latestOwnership?.effective_date}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="h-4 w-4 text-teal-700" />
              Company workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="font-medium text-slate-950">Valuations</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950 tabular-nums">
                {detail.valuations.length}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="font-medium text-slate-950">Ownership events</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950 tabular-nums">
                {detail.ownership_events.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              Records
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-slate-600">
                <NotebookText className="h-4 w-4" />
                Notes
              </span>
              <span className="font-semibold text-slate-950">
                {detail.notes.length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-slate-600">
                <FileText className="h-4 w-4" />
                Documents
              </span>
              <span className="font-semibold text-slate-950">
                {detail.documents.length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600">Timeline events</span>
              <span className="font-semibold text-slate-950">
                {detail.timeline.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
