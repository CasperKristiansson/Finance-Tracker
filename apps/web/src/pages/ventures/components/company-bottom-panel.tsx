import {
  ArrowRight,
  Building2,
  CalendarDays,
  FileText,
  NotebookText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  VentureCompanyDetail,
  VentureOverview,
} from "@/features/ventures/venturesSlice";
import { cn } from "@/lib/utils";
import {
  formatVentureDate,
  formatVenturePercent,
  formatVentureSek,
  initialsForName,
  statusTheme,
  titleCase,
  ventureCompanyPath,
} from "@/pages/ventures/utils/format";

type CompanyBottomPanelProps = {
  summary: VentureOverview["companies"][number];
  detail?: VentureCompanyDetail;
  recentActivity: VentureOverview["recent_activity"];
  loading: boolean;
  error?: string;
  onClose: () => void;
};

const Stat: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: string;
  helper?: string;
}> = ({ icon, label, value, helper }) => (
  <div className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2.5">
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
      {icon}
      <span className="truncate">{label}</span>
    </div>
    <p className="mt-1 truncate text-base font-semibold text-slate-950 tabular-nums">
      {value}
    </p>
    {helper ? (
      <p className="mt-0.5 truncate text-xs text-slate-500">{helper}</p>
    ) : null}
  </div>
);

export const CompanyBottomPanel: React.FC<CompanyBottomPanelProps> = ({
  summary,
  detail,
  recentActivity,
  loading,
  error,
  onClose,
}) => {
  const company = summary.company;
  const theme = statusTheme(company.status);
  const latestValuation =
    detail?.summary.latest_valuation ?? summary.latest_valuation;
  const latestOwnership =
    detail?.summary.latest_ownership ?? summary.latest_ownership;
  const activity =
    detail?.timeline.slice(0, 3) ??
    (recentActivity ?? [])
      .filter((event) => event.company_id === company.id)
      .slice(0, 3);
  const notesCount = detail?.notes.length;
  const documentsCount = detail?.documents.length;

  return (
    <div className="absolute right-4 bottom-4 left-4 z-20 rounded-lg border border-slate-200 bg-white/98 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm",
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
              <h2 className="truncate text-xl font-semibold text-slate-950">
                {company.name}
              </h2>
              <Badge variant="outline" className={cn(theme.badge)}>
                {titleCase(company.status)}
              </Badge>
              <span className="text-sm text-slate-500">
                {company.exited_on
                  ? `Exited ${formatVentureDate(company.exited_on)}`
                  : titleCase(company.role)}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-slate-500">
              {[company.stage, company.industry, company.country]
                .filter(Boolean)
                .join(" · ") || titleCase(company.company_type)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={ventureCompanyPath(company.id)}>
              Open workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Close selected company panel"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-[1.1fr_1fr_1fr]">
        <div className="grid grid-cols-2 gap-3">
          <Stat
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Paper value"
            value={formatVentureSek(summary.paper_value_sek)}
            helper={latestValuation?.label}
          />
          <Stat
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            label="Risk-adjusted"
            value={formatVentureSek(summary.risk_adjusted_value_sek)}
            helper={
              latestValuation
                ? `${latestValuation.haircut_percentage}% haircut`
                : undefined
            }
          />
          <Stat
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Ownership"
            value={formatVenturePercent(summary.ownership_pct)}
            helper={latestOwnership?.reason ?? "Latest direct ownership"}
          />
          <Stat
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label="Latest update"
            value={formatVentureDate(
              summary.last_activity_at ?? company.updated_at,
            )}
          />
        </div>

        <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-950">
            Latest snapshot
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Latest valuation</span>
              <span className="font-medium text-slate-950">
                {latestValuation
                  ? formatVentureSek(latestValuation.paper_value_sek)
                  : "None"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Valuation date</span>
              <span className="font-medium text-slate-950">
                {formatVentureDate(latestValuation?.event_date)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Latest ownership</span>
              <span className="font-medium text-slate-950">
                {formatVenturePercent(latestOwnership?.direct_ownership_pct)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Fully diluted</span>
              <span className="font-medium text-slate-950">
                {formatVenturePercent(
                  latestOwnership?.fully_diluted_ownership_pct,
                  "Not set",
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Stat
                icon={<NotebookText className="h-3.5 w-3.5" />}
                label="Notes"
                value={
                  notesCount === undefined
                    ? loading
                      ? "Loading"
                      : "Unknown"
                    : String(notesCount)
                }
              />
              <Stat
                icon={<FileText className="h-3.5 w-3.5" />}
                label="Documents"
                value={
                  documentsCount === undefined
                    ? loading
                      ? "Loading"
                      : "Unknown"
                    : String(documentsCount)
                }
              />
            </div>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">
              Recent activity
            </h3>
            {loading && !detail ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />
            ) : null}
          </div>
          {error && !detail ? (
            <p className="mt-3 text-sm text-rose-600">{error}</p>
          ) : activity.length ? (
            <div className="mt-3 space-y-3">
              {activity.map((event) => (
                <div
                  key={event.id}
                  className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0"
                >
                  <p className="truncate text-sm font-medium text-slate-800">
                    {event.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatVentureDate(event.event_date)} ·{" "}
                    {titleCase(event.event_type)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No recent activity recorded yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
