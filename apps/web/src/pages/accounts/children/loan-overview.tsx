import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import type { AccountWithBalance } from "@/types/api";
import { PageRoutes } from "@/data/routes";

type Props = {
  account: AccountWithBalance;
};

export const LoanOverview: React.FC<Props> = ({ account }) => {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm text-slate-700">Loan details</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          View amortization schedule, payments, and events for this loan.
        </p>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to={`${PageRoutes.loans}/${account.id}`}>Open loan page</Link>
        </Button>
      </CardContent>
    </Card>
  );
};
