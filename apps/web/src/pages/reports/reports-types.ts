export type ReportMode = "yearly" | "total";

export type DetailDialogState =
  | {
      kind: "investments";
      title: string;
      asOf: string;
      monthly: Array<{ month: string; value: number }>;
      accounts: Array<{
        name: string;
        start: number;
        end: number;
        change: number;
      }>;
      summary: {
        start: number;
        end: number;
        change: number;
        changePct: number | null;
        contributions: number;
        withdrawals: number;
      };
    }
  | {
      kind: "debt";
      title: string;
      monthly: Array<{ month: string; value: number }>;
      startDebt: number;
      endDebt: number;
      delta: number;
    }
  | {
      kind: "account";
      title: string;
      accountType: string;
      startBalance: number;
      endBalance: number;
      change: number;
      monthly: Array<{
        month: string;
        income: number;
        expense: number;
        transfersIn: number;
        transfersOut: number;
        change: number;
      }>;
    }
  | {
      kind: "source";
      title: string;
      subtitle: string;
      monthly: Array<{ month: string; total: number }>;
      total: number;
      txCount: number;
      compareLabel?: string;
      compareTotal?: number;
      compareMonthly?: Array<{ month: string; total: number }>;
    };

export type TotalDrilldownState =
  | {
      kind: "category";
      flow: "income" | "expense";
      categoryId: string;
      name: string;
      color: string;
    }
  | {
      kind: "source";
      flow: "income" | "expense";
      source: string;
    }
  | {
      kind: "account";
      accountId: string;
      name: string;
      accountType: string;
    }
  | {
      kind: "year";
      year: number;
    }
  | {
      kind: "investments";
    }
  | {
      kind: "debt";
    }
  | {
      kind: "netWorth";
    };

export type YearlyExtraDialogState =
  | {
      kind: "categoryDrivers";
    }
  | {
      kind: "merchantDrivers";
      flow: "income" | "expense";
    }
  | {
      kind: "oneOffs";
    }
  | {
      kind: "savingsDecomposition";
    };

export type TotalHeatmapDialogState =
  | {
      kind: "seasonality";
      flow: "income" | "expense";
      year: number;
      monthIndex: number;
      monthLabel: string;
      value: number;
      yearValues: number[];
      years: number[];
      monthAcrossYears: Array<{ year: number; value: number }>;
      yearTotal: number;
      monthRank: number;
      monthSharePct: number | null;
      yoyDelta: number | null;
      yoyDeltaPct: number | null;
    }
  | {
      kind: "categoryByYear";
      flow: "income" | "expense";
      year: number;
      categoryId: string | null;
      categoryName: string;
      color: string;
      value: number;
      years: number[];
      totals: number[];
      max: number;
      yearTotal: number | null;
      sharePct: number | null;
      yoyDelta: number | null;
      yoyDeltaPct: number | null;
    };

export type TotalTimeseriesDialogState =
  | {
      kind: "netWorthBreakdown";
      date: string;
      cash: number;
      investments: number;
      debt: number;
      netWorth: number;
      deltaMoM: number | null;
      deltaYoY: number | null;
      shareCashPct: number | null;
      shareInvestmentsPct: number | null;
      shareDebtPct: number | null;
    }
  | {
      kind: "savingsRate";
      date: string;
      income: number;
      expense: number;
      net: number;
      ratePct: number | null;
      rolling12mPct: number | null;
      window: Array<{
        date: string;
        label: string;
        income: number;
        expense: number;
        net: number;
        ratePct: number | null;
      }>;
    };
