import {
  createSelector,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";
import { BudgetPeriod, type BudgetProgress } from "@/types/api";

export interface BudgetsState {
  items: BudgetProgress[];
  loading: boolean;
  error?: string;
}

const initialState: BudgetsState = {
  items: [],
  loading: false,
};

const budgetsSlice = createSlice({
  name: "budgets",
  initialState,
  reducers: {
    setBudgets(state, action: PayloadAction<BudgetProgress[]>) {
      state.items = action.payload;
      state.error = undefined;
    },
    setBudgetsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setBudgetsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to load budgets";
    },
  },
  selectors: {
    selectBudgetsState: (state) => state,
    selectBudgets: (state) => state.items,
    selectBudgetsLoading: (state) => state.loading,
    selectBudgetsError: (state) => state.error,
  },
});

export const { setBudgets, setBudgetsLoading, setBudgetsError } =
  budgetsSlice.actions;
export const {
  selectBudgetsState,
  selectBudgets,
  selectBudgetsLoading,
  selectBudgetsError,
} = budgetsSlice.selectors;

const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

type BudgetTotals = {
  budgetTotal: number;
  spentTotal: number;
  remainingTotal: number;
  percentUsed: number;
};

export const selectBudgetTotals = createSelector(
  selectBudgets,
  (items): BudgetTotals => {
    const budgetTotal = items.reduce((sum, b) => sum + toNumber(b.amount), 0);
    const spentTotal = items.reduce((sum, b) => sum + toNumber(b.spent), 0);
    const remainingTotal = budgetTotal - spentTotal;
    const percentUsed = budgetTotal > 0 ? (spentTotal / budgetTotal) * 100 : 0;
    return { budgetTotal, spentTotal, remainingTotal, percentUsed };
  },
);

export const selectBudgetRollups = createSelector(
  (state: RootState) => state.budgets.items,
  (items): Record<BudgetPeriod, BudgetTotals> => {
    const emptyTotals = (): BudgetTotals => ({
      budgetTotal: 0,
      spentTotal: 0,
      remainingTotal: 0,
      percentUsed: 0,
    });

    const rollups: Record<BudgetPeriod, BudgetTotals> = {
      [BudgetPeriod.MONTHLY]: emptyTotals(),
      [BudgetPeriod.QUARTERLY]: emptyTotals(),
      [BudgetPeriod.YEARLY]: emptyTotals(),
    };

    items.forEach((budget) => {
      const bucket = rollups[budget.period];
      if (!bucket) return;
      bucket.budgetTotal += toNumber(budget.amount);
      bucket.spentTotal += toNumber(budget.spent);
    });

    (Object.values(rollups) as BudgetTotals[]).forEach((bucket) => {
      bucket.remainingTotal = bucket.budgetTotal - bucket.spentTotal;
      bucket.percentUsed =
        bucket.budgetTotal > 0
          ? (bucket.spentTotal / bucket.budgetTotal) * 100
          : 0;
    });

    return rollups;
  },
);

export const selectBudgetsByUsage = createSelector(selectBudgets, (items) =>
  [...items].sort(
    (a, b) => toNumber(b.percent_used) - toNumber(a.percent_used),
  ),
);

export const BudgetsReducer = budgetsSlice.reducer;
