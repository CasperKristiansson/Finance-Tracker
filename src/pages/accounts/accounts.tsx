import React from "react";
import { NetWorthPerformanceCard } from "./children/netWorth";
import { AccountsCard } from "./children/accountCard";
import { SummaryCard } from "./children/summaryCard";

export const Accounts: React.FC = () => {
  return (
    <div className="">
      <NetWorthPerformanceCard />
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="col-span-2">
          <AccountsCard />
        </div>
        <div className="col-span-1">
          <SummaryCard assets={929038.67} liabilities={242000.88} />
        </div>
      </div>
    </div>
  );
};
