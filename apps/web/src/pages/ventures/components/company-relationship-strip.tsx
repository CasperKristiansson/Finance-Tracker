import { ArrowRight, Building2, CircleUserRound } from "lucide-react";
import React from "react";
import type {
  VentureCompanyDetail,
  VentureOverview,
} from "@/features/ventures/venturesSlice";
import { cn } from "@/lib/utils";
import {
  formatVenturePercent,
  initialsForName,
  statusTheme,
  titleCase,
} from "@/pages/ventures/utils/format";

type CompanyRelationshipStripProps = {
  detail: VentureCompanyDetail;
  overview?: VentureOverview;
};

const Identity: React.FC<{
  name: string;
  helper: string;
  tone?: "person" | "company";
  color?: string | null;
  status?: string | null;
}> = ({ name, helper, tone = "company", color, status }) => {
  const theme = statusTheme(status);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm",
          tone === "person"
            ? "border border-amber-200 bg-amber-50 text-amber-800"
            : theme.icon,
        )}
        style={
          tone === "company" && color ? { backgroundColor: color } : undefined
        }
      >
        {tone === "person" ? (
          <CircleUserRound className="h-5 w-5" />
        ) : (
          initialsForName(name)
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">{name}</p>
        <p className="truncate text-xs text-slate-500">{helper}</p>
      </div>
    </div>
  );
};

export const CompanyRelationshipStrip: React.FC<
  CompanyRelationshipStripProps
> = ({ detail, overview }) => {
  const { company, latest_ownership: latestOwnership } = detail.summary;
  const edge = overview?.ownership_edges.find(
    (candidate) => candidate.company_id === company.id,
  );
  const ownerCompanyId =
    edge?.owner_company_id ?? latestOwnership?.owner_company_id;
  const ownerSummary = ownerCompanyId
    ? overview?.companies.find(
        (summary) => summary.company.id === ownerCompanyId,
      )
    : undefined;
  const ownerType = edge?.owner_type ?? latestOwnership?.owner_type ?? "person";
  const hasMissingOwnerCompany = ownerType === "company" && !ownerSummary;
  const ownershipPct =
    edge?.ownership_pct ??
    latestOwnership?.direct_ownership_pct ??
    detail.summary.ownership_pct;
  const fullyDilutedPct =
    edge?.fully_diluted_ownership_pct ??
    latestOwnership?.fully_diluted_ownership_pct;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Building2 className="h-4 w-4 text-teal-700" />
        Ownership relationship
      </div>
      <div className="grid items-center gap-4 rounded-lg border border-slate-100 bg-slate-50/70 p-4 lg:grid-cols-[1fr_auto_1fr]">
        {ownerSummary ? (
          <Identity
            name={ownerSummary.company.name}
            helper={titleCase(ownerSummary.company.company_type)}
            color={ownerSummary.company.node_color}
            status={ownerSummary.company.status}
          />
        ) : hasMissingOwnerCompany ? (
          <Identity
            name="Holding company"
            helper="Owner company details unavailable"
          />
        ) : (
          <Identity
            name="Casper"
            helper="You, founder and owner"
            tone="person"
          />
        )}

        <div className="flex items-center justify-center gap-3 text-xs font-medium text-teal-800">
          <span className="h-px w-20 bg-teal-700/50" />
          <span className="rounded-full border border-teal-100 bg-white px-3 py-1">
            {formatVenturePercent(ownershipPct)}
            {fullyDilutedPct
              ? ` / ${formatVenturePercent(fullyDilutedPct)} FD`
              : ""}
          </span>
          <ArrowRight className="h-4 w-4" />
          <span className="h-px w-20 bg-teal-700/50" />
        </div>

        <Identity
          name={company.name}
          helper={
            [company.stage, company.industry, company.country]
              .filter(Boolean)
              .join(" · ") || titleCase(company.company_type)
          }
          color={company.node_color}
          status={company.status}
        />
      </div>
    </section>
  );
};
