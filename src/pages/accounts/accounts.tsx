import React from "react";
import { NetWorthPerformanceCard } from "./children/netWorth";

const data = {
  netWorth: 100000,
  monthlyChange: 1000,
  data: [
    { date: "2021-01-01", netWorth: 100000 },
    { date: "2021-02-01", netWorth: 101000 },
    { date: "2021-03-01", netWorth: 102000 },
    { date: "2021-04-01", netWorth: 103000 },
    { date: "2021-05-01", netWorth: 104000 },
    { date: "2021-06-01", netWorth: 105000 },
    { date: "2021-07-01", netWorth: 106000 },
  ],
};

export const Accounts: React.FC = () => {
  return (
    <div className="">
      <NetWorthPerformanceCard
        netWorth={data.netWorth}
        monthlyChange={data.monthlyChange}
        data={data.data}
      />
    </div>
  );
};
