"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface SummaryCardProps {
  assets: number;
  liabilities: number;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  assets,
  liabilities,
}) => {
  const netWorth = assets - liabilities;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span>Assets</span>
            <span>
              {assets.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Liabilities</span>
            <span>
              {liabilities.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </span>
          </div>
          <hr className="my-2" />
          <div className="flex items-center justify-between font-semibold">
            <span>Net Worth</span>
            <span>
              {netWorth.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
