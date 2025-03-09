import React from "react";
import { NetWorthPerformanceCard } from "./children/netWorth";
import { AccountsCard } from "./children/accountCard";
import { Summary } from "./children/summary";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Accounts: React.FC = () => {
  return (
    <div className="relative">
      <div className="absolute top-0 right-0 mt-[-50px]">
        <Button variant="default">
          <Plus /> Add Account
        </Button>
      </div>
      <NetWorthPerformanceCard />
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="col-span-2">
          <AccountsCard />
        </div>
        <div className="col-span-2 md:col-span-1">
          <Summary />
        </div>
      </div>
    </div>
  );
};
