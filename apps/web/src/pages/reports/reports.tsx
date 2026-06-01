import React from "react";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { selectToken } from "@/features/auth/authSlice";
import {
  selectIncludeInvestmentGrowth,
  setIncludeInvestmentGrowth,
} from "@/features/settings/settingsSlice";

import { ReportsHeader } from "./components/reports-header";
import { useReportsRoute } from "./hooks/use-reports-route";
import { TotalReportsPage } from "./total/total-reports-page";
import { YearlyReportsPage } from "./yearly/yearly-reports-page";

export const Reports: React.FC = () => {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const includeInvestmentGrowth = useAppSelector(selectIncludeInvestmentGrowth);
  const {
    routeMode,
    year,
    yearOptions,
    totalWindowPreset,
    setTotalWindowPreset,
  } = useReportsRoute();

  return (
    <MotionPage className="space-y-4">
      <ReportsHeader
        routeMode={routeMode}
        year={year}
        yearOptions={yearOptions}
        totalWindowPreset={totalWindowPreset}
        onTotalWindowPresetChange={setTotalWindowPreset}
        includeInvestmentGrowth={includeInvestmentGrowth}
        onIncludeInvestmentGrowthChange={(checked) =>
          dispatch(setIncludeInvestmentGrowth(checked))
        }
      />

      {routeMode === "yearly" ? (
        <YearlyReportsPage
          token={token}
          year={year}
          includeInvestmentGrowth={includeInvestmentGrowth}
        />
      ) : (
        <TotalReportsPage
          token={token}
          year={year}
          totalWindowPreset={totalWindowPreset}
          includeInvestmentGrowth={includeInvestmentGrowth}
        />
      )}
    </MotionPage>
  );
};

export default Reports;
