import { CheckCircle2, FileText, CircleAlert, Circle } from "lucide-react";
import React, { useMemo } from "react";
import { EmptyState } from "@/components/composed/empty-state";
import { Badge } from "@/components/ui/badge";
import type { VentureCompanyDetail } from "@/features/ventures/venturesSlice";
import { cn } from "@/lib/utils";
import { formatVentureDate, titleCase } from "@/pages/ventures/utils/format";

type DocumentHealthCardProps = {
  detail: VentureCompanyDetail;
};

const statusClassName = (status: string | undefined) =>
  ({
    verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
    linked: "border-teal-200 bg-teal-50 text-teal-700",
    draft: "border-slate-200 bg-slate-50 text-slate-700",
    pending_review: "border-amber-200 bg-amber-50 text-amber-800",
    missing: "border-rose-200 bg-rose-50 text-rose-700",
  })[status ?? ""] ?? "border-slate-200 bg-slate-50 text-slate-700";

const statusIcon = (status: string | undefined) => {
  if (status === "verified" || status === "linked") {
    return <CheckCircle2 className="h-4 w-4 text-teal-700" />;
  }
  if (status === "missing" || status === "pending_review") {
    return <CircleAlert className="h-4 w-4 text-amber-600" />;
  }
  return <Circle className="h-4 w-4 text-slate-400" />;
};

export const DocumentHealthCard: React.FC<DocumentHealthCardProps> = ({
  detail,
}) => {
  const documents = useMemo(
    () =>
      [...detail.documents].sort((left, right) =>
        (right.document_date ?? right.updated_at).localeCompare(
          left.document_date ?? left.updated_at,
        ),
      ),
    [detail.documents],
  );
  const completeCount = documents.filter((document) =>
    ["verified", "linked"].includes(document.status ?? ""),
  ).length;
  const warnings = detail.document_health.warnings ?? [];
  const missingCategories = detail.document_health.missing_categories ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-teal-700" />
          <h2 className="text-base font-semibold text-slate-950">
            Documents checklist
          </h2>
        </div>
        <span className="text-xs text-slate-500">
          {completeCount} / {documents.length} complete
        </span>
      </div>

      {warnings.length || missingCategories.length ? (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {missingCategories.length ? (
            <p>
              Missing:{" "}
              {missingCategories
                .map((category) => titleCase(category))
                .join(", ")}
            </p>
          ) : null}
          {warnings.slice(0, 2).map((warning) => (
            <p key={`${warning.code}-${warning.message}`}>{warning.message}</p>
          ))}
        </div>
      ) : null}

      {documents.length ? (
        <div className="overflow-hidden rounded-md border border-slate-100">
          {documents.slice(0, 5).map((document) => (
            <div
              key={document.id}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0"
            >
              {statusIcon(document.status)}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-950">
                  {document.title}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {titleCase(document.category)}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(statusClassName(document.status))}
              >
                {titleCase(document.status)}
              </Badge>
              <span className="hidden min-w-24 text-right text-xs text-slate-500 xl:block">
                {formatVentureDate(
                  document.document_date ?? document.uploaded_at,
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No documents recorded"
          description="Evidence status will appear once company documents are linked."
          icon={<FileText className="h-5 w-5" />}
        />
      )}
    </section>
  );
};
