import React from "react";
import { NetWorthPerformanceCard } from "./children/netWorth";
import { AccountsCard } from "./children/accountCard";
import { Summary } from "./children/summary";

export const Accounts: React.FC = () => {
  return (
    <div className="">
      <NetWorthPerformanceCard />
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="col-span-2">
          <AccountsCard />
        </div>
        <div className="col-span-1">
          <Summary />
        </div>
      </div>
    </div>
  );
};
