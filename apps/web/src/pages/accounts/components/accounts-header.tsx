import { AlertCircle, Loader2, Plus, RefreshCw } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";

type AccountsHeaderProps = {
  onAddAccount: () => void;
  onReconcile: () => void;
  onRefresh: () => void;
  reconcileLoading: boolean;
  subtitle?: string;
};

export const AccountsHeader: React.FC<AccountsHeaderProps> = ({
  onAddAccount,
  onReconcile,
  onRefresh,
  reconcileLoading,
  subtitle = "Live balances with as-of filtering and archive controls.",
}) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <p className="text-xs tracking-wide text-slate-500 uppercase">Accounts</p>
      <h1 className="text-2xl font-semibold text-slate-900">
        Balances and debt overview
      </h1>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="default" className="gap-2" onClick={onAddAccount}>
        <Plus className="h-4 w-4" />
        Add account
      </Button>
      <Button
        variant="outline"
        className="gap-2 border-slate-300 text-slate-800"
        onClick={onReconcile}
        disabled={reconcileLoading}
      >
        {reconcileLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        Reconcile
      </Button>
      <Button
        variant="outline"
        className="gap-2 border-slate-300 text-slate-800"
        onClick={onRefresh}
      >
        <RefreshCw className="h-4 w-4" />
        Refresh
      </Button>
    </div>
  </div>
);
