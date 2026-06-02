import { FileCheck2, ShieldCheck } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import type { VentureCompanyDetail } from "@/features/ventures/venturesSlice";
import { cn } from "@/lib/utils";
import { formatVenturePercent, titleCase } from "@/pages/ventures/utils/format";

type OwnershipRiskPanelProps = {
  detail: VentureCompanyDetail;
};

const Row: React.FC<{
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}> = ({ label, value, muted }) => (
  <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
    <span className="text-sm text-slate-500">{label}</span>
    <span
      className={cn(
        "min-w-0 text-right text-sm font-medium text-slate-950",
        muted && "text-slate-500",
      )}
    >
      {value}
    </span>
  </div>
);

const LiquidityBadge: React.FC<{ value: string | null | undefined }> = ({
  value,
}) => {
  const label = value ? titleCase(value) : "No liquidity data";
  const className =
    value === "liquid"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value === "possible_secondary"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
};

const ConfidenceDots: React.FC<{ score?: number | null }> = ({ score }) => {
  if (!score) return <span className="text-slate-500">Not scored</span>;

  return (
    <span className="inline-flex items-center gap-1.5">
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            index < score ? "bg-teal-700" : "bg-slate-200",
          )}
        />
      ))}
      <span className="ml-1 tabular-nums">{score}/5</span>
    </span>
  );
};

export const OwnershipRiskPanel: React.FC<OwnershipRiskPanelProps> = ({
  detail,
}) => {
  const latestOwnership = detail.summary.latest_ownership;
  const latestValuation = detail.summary.latest_valuation;
  const linkedDocumentIds = new Set([
    ...(latestOwnership?.linked_document_ids ?? []),
    ...(latestValuation?.linked_document_ids ?? []),
  ]);
  const warnings = detail.document_health.warnings ?? [];
  const missingCategories = detail.document_health.missing_categories ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-teal-700" />
        <h2 className="text-base font-semibold text-slate-950">
          Ownership and risk profile
        </h2>
      </div>

      <div className="mt-3">
        <Row
          label="Direct ownership"
          value={formatVenturePercent(latestOwnership?.direct_ownership_pct)}
        />
        <Row
          label="Fully diluted"
          value={formatVenturePercent(
            latestOwnership?.fully_diluted_ownership_pct,
            "Not set",
          )}
        />
        <Row
          label="Share class"
          value={latestOwnership?.share_class || "Not set"}
          muted={!latestOwnership?.share_class}
        />
        <Row
          label="Voting rights"
          value={formatVenturePercent(
            latestOwnership?.voting_rights_pct,
            "Not set",
          )}
          muted={!latestOwnership?.voting_rights_pct}
        />
        <Row
          label="Valuation source"
          value={
            latestValuation
              ? titleCase(latestValuation.valuation_source)
              : "No valuation"
          }
          muted={!latestValuation}
        />
        <Row
          label="Liquidity level"
          value={<LiquidityBadge value={latestValuation?.liquidity_level} />}
        />
        <Row
          label="Haircut"
          value={
            latestValuation
              ? `${latestValuation.haircut_percentage ?? "0"}%`
              : "No valuation"
          }
          muted={!latestValuation}
        />
        <Row
          label="Confidence score"
          value={<ConfidenceDots score={latestValuation?.confidence_score} />}
        />
        <Row
          label="Document evidence"
          value={
            <span className="inline-flex items-center gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-teal-700" />
              {linkedDocumentIds.size
                ? `${linkedDocumentIds.size} linked`
                : warnings.length || missingCategories.length
                  ? "Needs review"
                  : "No linked evidence"}
            </span>
          }
        />
      </div>
    </section>
  );
};
