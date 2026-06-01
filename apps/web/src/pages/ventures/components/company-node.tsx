import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CalendarDays, FileImage } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatVentureDate,
  formatVenturePercent,
  formatVentureSek,
  initialsForName,
  statusTheme,
  titleCase,
} from "@/pages/ventures/utils/format";
import type { VentureCompanyNode } from "@/pages/ventures/utils/layout";

export const CompanyNode: React.FC<NodeProps<VentureCompanyNode>> = ({
  data,
  selected,
}) => {
  const summary = data.summary;
  const company = summary.company;
  const theme = statusTheme(company.status);
  const lastActivity = summary.last_activity_at ?? company.updated_at;
  const accentStyle = company.node_color
    ? { backgroundColor: company.node_color }
    : undefined;

  return (
    <div
      className={cn(
        "w-[260px] rounded-lg border bg-white shadow-sm transition duration-150",
        theme.border,
        selected && "scale-[1.02] border-slate-900 shadow-lg",
      )}
    >
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-500"
      />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm",
                theme.icon,
              )}
              style={accentStyle}
              title={company.logo_file_name ?? undefined}
            >
              {company.logo_storage_key ? (
                <FileImage className="h-5 w-5" />
              ) : (
                initialsForName(company.name)
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-[15px] leading-5 font-semibold text-slate-950">
                {company.name}
              </h3>
              <p className="truncate text-xs text-slate-500">
                {[company.stage, company.industry]
                  .filter(Boolean)
                  .join(" · ") || titleCase(company.role)}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn("shrink-0 px-2 py-0.5 text-[11px]", theme.badge)}
          >
            {titleCase(company.status)}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_1px_1fr] items-center gap-3 border-y border-slate-100 py-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-slate-500">
              Paper value
            </p>
            <p className="mt-1 truncate text-base font-semibold text-slate-950 tabular-nums">
              {formatVentureSek(summary.paper_value_sek)}
            </p>
          </div>
          <div className="h-9 bg-slate-100" />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-slate-500">
              Ownership
            </p>
            <p className="mt-1 truncate text-base font-semibold text-slate-950 tabular-nums">
              {formatVenturePercent(summary.ownership_pct)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Updated {formatVentureDate(lastActivity)}
          </span>
        </div>
      </div>
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-500"
      />
    </div>
  );
};
