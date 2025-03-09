import React from "react";
import { NetWorthPerformanceCard } from "./children/netWorth";

const data = {
  netWorth: 100000,
  monthlyChange: 1000,
  data: [
    { date: "2021-01-01", netWorth: 100000 },
    { date: "2021-02-01", netWorth: 101000 },
    { date: "2021-03-01", netWorth: 110000 },
    { date: "2021-04-01", netWorth: 113000 },
    { date: "2021-05-01", netWorth: 123000 },
    { date: "2021-06-01", netWorth: 129000 },
    { date: "2021-07-01", netWorth: 132000 },
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
