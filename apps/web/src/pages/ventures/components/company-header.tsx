import {
  ArrowLeft,
  Building2,
  CalendarDays,
  NotebookPen,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VentureCompanyDetail } from "@/features/ventures/venturesSlice";
import { cn } from "@/lib/utils";
import {
  formatVentureDate,
  initialsForName,
  statusTheme,
  titleCase,
} from "@/pages/ventures/utils/format";

type CompanyHeaderProps = {
  detail: VentureCompanyDetail;
  loading: boolean;
  onRefresh: () => void;
  onAddValuation: () => void;
  onAddNote: () => void;
  onEditOwnership: () => void;
};

export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
  detail,
  loading,
  onRefresh,
  onAddValuation,
  onAddNote,
  onEditOwnership,
}) => {
  const { company } = detail.summary;
  const theme = statusTheme(company.status);
  const lastActivity = detail.summary.last_activity_at ?? company.updated_at;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link to="/ventures">
              <ArrowLeft className="h-4 w-4" />
              Ventures
            </Link>
          </Button>
          <span>/</span>
          <span className="font-medium text-slate-950">{company.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddValuation}
          >
            <TrendingUp className="h-4 w-4" />
            Add valuation
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onAddNote}>
            <NotebookPen className="h-4 w-4" />
            Add note
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditOwnership}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Edit ownership
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-5">
          <div
            className={cn(
              "flex h-20 w-20 shrink-0 items-center justify-center rounded-lg text-2xl font-semibold shadow-sm",
              theme.icon,
            )}
            style={
              company.node_color
                ? { backgroundColor: company.node_color }
                : undefined
            }
          >
            {initialsForName(company.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
                {company.name}
              </h1>
              <Badge variant="outline" className={cn(theme.badge)}>
                {titleCase(company.status)}
              </Badge>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
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
                <ShieldCheck className="h-3.5 w-3.5" />
                {titleCase(company.company_type)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Updated {formatVentureDate(lastActivity)}
              </span>
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-800"
        >
          Venture-only value, excluded from main net worth
        </Badge>
      </div>
    </section>
  );
};
