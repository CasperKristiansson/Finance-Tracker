import { AlertCircle, Loader2 } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";

type ReconcileBannerProps = {
  visible: boolean;
  reconcileLoading: boolean;
  onReconcile: () => void;
};

export const ReconcileBanner: React.FC<ReconcileBannerProps> = ({
  visible,
  reconcileLoading,
  onReconcile,
}) => {
  if (!visible) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 shadow-[0_8px_24px_-20px_rgba(146,64,14,0.45)]">
      <AlertCircle className="mt-0.5 h-5 w-5" />
      <div className="flex-1">
        <div className="font-semibold">Accounts need reconciliation</div>
        <p className="text-amber-800">
          Balances may be stale. Reconcile to keep running balances accurate.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-9 gap-2 border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
        onClick={onReconcile}
        disabled={reconcileLoading}
      >
        {reconcileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Reconcile
      </Button>
    </div>
  );
};
