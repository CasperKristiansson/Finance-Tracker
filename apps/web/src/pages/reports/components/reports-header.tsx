import React from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PageRoutes } from "@/data/routes";

import type { ReportMode } from "../reports-types";

export const ReportsHeader: React.FC<{
  routeMode: ReportMode;
  year: number;
  yearOptions: number[];
  totalWindowPreset: "all" | "10" | "5" | "3";
  onTotalWindowPresetChange: (preset: "all" | "10" | "5" | "3") => void;
}> = ({
  routeMode,
  year,
  yearOptions,
  totalWindowPreset,
  onTotalWindowPresetChange,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs tracking-wide text-slate-500 uppercase">Reports</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Income, expense, and net
        </h1>
        <p className="text-sm text-slate-500">
          Yearly overview, trends, and high-signal breakdowns. Tax transactions
          are excluded — see{" "}
          <Link to={PageRoutes.taxes} className="underline underline-offset-2">
            Taxes
          </Link>
          .
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="w-[110px]">
          {routeMode === "yearly" ? (
            <select
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={year}
              onChange={(e) =>
                navigate(`${PageRoutes.reportsYearly}/${e.target.value}`)
              }
            >
              {yearOptions.map((optionYear) => (
                <option key={optionYear} value={optionYear}>
                  {optionYear}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={totalWindowPreset}
              onChange={(e) =>
                onTotalWindowPresetChange(e.target.value as "all" | "10" | "5" | "3")
              }
            >
              <option value="all">All time</option>
              <option value="10">Last 10y</option>
              <option value="5">Last 5y</option>
              <option value="3">Last 3y</option>
            </select>
          )}
        </div>
        <Button
          variant={routeMode === "yearly" ? "default" : "outline"}
          size="sm"
          onClick={() =>
            navigate(`${PageRoutes.reportsYearly}/${year}`, { replace: true })
          }
        >
          Yearly
        </Button>
        <Button
          variant={routeMode === "total" ? "default" : "outline"}
          size="sm"
          onClick={() => navigate(PageRoutes.reportsTotal, { replace: true })}
        >
          Total
        </Button>
      </div>
    </div>
  );
};

