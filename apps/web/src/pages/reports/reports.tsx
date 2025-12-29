import React from "react";

import { useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { selectToken } from "@/features/auth/authSlice";

import { ReportsHeader } from "./components/reports-header";
import { useReportsRoute } from "./hooks/use-reports-route";
import { TotalReportsPage } from "./total/total-reports-page";
import { YearlyReportsPage } from "./yearly/yearly-reports-page";

export const Reports: React.FC = () => {
  const token = useAppSelector(selectToken);
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
      />

      {routeMode === "yearly" ? (
        <YearlyReportsPage token={token} year={year} />
      ) : (
        <TotalReportsPage
          token={token}
          year={year}
          totalWindowPreset={totalWindowPreset}
        />
      )}
    </MotionPage>
  );
};

export default Reports;
