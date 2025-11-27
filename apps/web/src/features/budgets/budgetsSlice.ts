import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { BudgetProgress } from "@/types/api";

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
export const BudgetsReducer = budgetsSlice.reducer;
