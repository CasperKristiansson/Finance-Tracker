import {
  createSlice,
  type PayloadAction,
  createSelector,
} from "@reduxjs/toolkit";
import type {
  MonthlyReportEntry,
  NetWorthPoint,
  TotalReportRead,
  YearlyReportEntry,
} from "@/types/api";

export interface ReportFilters {
  year?: number;
  accountIds?: string[];
  categoryIds?: string[];
}

type CacheKeyedState<T> = {
  cache: Record<string, T>;
  currentKey: string | null;
  loading: boolean;
  error?: string;
};

export interface ReportsState {
  monthly: CacheKeyedState<MonthlyReportEntry[]>;
  yearly: CacheKeyedState<YearlyReportEntry[]>;
  total: CacheKeyedState<TotalReportRead | undefined>;
  netWorth: CacheKeyedState<NetWorthPoint[]>;
}

const createInitialCache = <T>(): CacheKeyedState<T> => ({
  cache: {},
  currentKey: null,
  loading: false,
});

const initialState: ReportsState = {
  monthly: createInitialCache<MonthlyReportEntry[]>(),
  yearly: createInitialCache<YearlyReportEntry[]>(),
  total: createInitialCache<TotalReportRead | undefined>(),
  netWorth: createInitialCache<NetWorthPoint[]>(),
};

const reportsSlice = createSlice({
  name: "reports",
  initialState,
  reducers: {
    setMonthlyReport(
      state,
      action: PayloadAction<{ key: string; data: MonthlyReportEntry[] }>,
    ) {
      state.monthly.cache[action.payload.key] = action.payload.data;
      state.monthly.currentKey = action.payload.key;
      state.monthly.error = undefined;
    },
    setMonthlyLoading(state, action: PayloadAction<boolean>) {
      state.monthly.loading = action.payload;
    },
    setMonthlyError(state, action: PayloadAction<string | undefined>) {
      state.monthly.error = action.payload ?? "Unable to load monthly report";
    },
    setMonthlyCurrentKey(state, action: PayloadAction<string>) {
      state.monthly.currentKey = action.payload;
    },
    setYearlyReport(
      state,
      action: PayloadAction<{ key: string; data: YearlyReportEntry[] }>,
    ) {
      state.yearly.cache[action.payload.key] = action.payload.data;
      state.yearly.currentKey = action.payload.key;
      state.yearly.error = undefined;
    },
    setYearlyLoading(state, action: PayloadAction<boolean>) {
      state.yearly.loading = action.payload;
    },
    setYearlyError(state, action: PayloadAction<string | undefined>) {
      state.yearly.error = action.payload ?? "Unable to load yearly report";
    },
    setYearlyCurrentKey(state, action: PayloadAction<string>) {
      state.yearly.currentKey = action.payload;
    },
    setTotalReport(
      state,
      action: PayloadAction<{ key: string; data: TotalReportRead | undefined }>,
    ) {
      state.total.cache[action.payload.key] = action.payload.data;
      state.total.currentKey = action.payload.key;
      state.total.error = undefined;
    },
    setTotalLoading(state, action: PayloadAction<boolean>) {
      state.total.loading = action.payload;
    },
    setTotalError(state, action: PayloadAction<string | undefined>) {
      state.total.error = action.payload ?? "Unable to load totals";
    },
    setTotalCurrentKey(state, action: PayloadAction<string>) {
      state.total.currentKey = action.payload;
    },
    setNetWorthHistory(
      state,
      action: PayloadAction<{ key: string; data: NetWorthPoint[] }>,
    ) {
      state.netWorth.cache[action.payload.key] = action.payload.data;
      state.netWorth.currentKey = action.payload.key;
      state.netWorth.error = undefined;
    },
    setNetWorthLoading(state, action: PayloadAction<boolean>) {
      state.netWorth.loading = action.payload;
    },
    setNetWorthError(state, action: PayloadAction<string | undefined>) {
      state.netWorth.error =
        action.payload ?? "Unable to load net worth history";
    },
    setNetWorthCurrentKey(state, action: PayloadAction<string>) {
      state.netWorth.currentKey = action.payload;
    },
    resetReports: () => initialState,
  },
  selectors: {
    selectReportsState: (state) => state,
    selectMonthlyReportState: (state) => state.monthly,
    selectYearlyReportState: (state) => state.yearly,
    selectTotalReportState: (state) => state.total,
    selectNetWorthState: (state) => state.netWorth,
  },
});

const selectCurrentMonthly = createSelector(
  reportsSlice.selectors.selectMonthlyReportState,
  (monthly) => {
    const key = monthly.currentKey;
    return {
      ...monthly,
      data: key ? (monthly.cache[key] ?? []) : [],
    };
  },
);

const selectCurrentYearly = createSelector(
  reportsSlice.selectors.selectYearlyReportState,
  (yearly) => {
    const key = yearly.currentKey;
    return {
      ...yearly,
      data: key ? (yearly.cache[key] ?? []) : [],
    };
  },
);

const selectCurrentTotal = createSelector(
  reportsSlice.selectors.selectTotalReportState,
  (total) => {
    const key = total.currentKey;
    return {
      ...total,
      data: key ? total.cache[key] : undefined,
    };
  },
);

const selectCurrentNetWorth = createSelector(
  reportsSlice.selectors.selectNetWorthState,
  (netWorth) => {
    const key = netWorth.currentKey;
    return {
      ...netWorth,
      data: key ? (netWorth.cache[key] ?? []) : [],
    };
  },
);

export const {
  setMonthlyReport,
  setMonthlyLoading,
  setMonthlyError,
  setMonthlyCurrentKey,
  setYearlyReport,
  setYearlyLoading,
  setYearlyError,
  setYearlyCurrentKey,
  setTotalReport,
  setTotalLoading,
  setTotalError,
  setTotalCurrentKey,
  setNetWorthHistory,
  setNetWorthLoading,
  setNetWorthError,
  setNetWorthCurrentKey,
  resetReports,
} = reportsSlice.actions;

export const {
  selectReportsState,
  selectMonthlyReportState,
  selectYearlyReportState,
  selectTotalReportState,
  selectNetWorthState,
} = reportsSlice.selectors;

export const selectMonthlyReport = selectCurrentMonthly;
export const selectYearlyReport = selectCurrentYearly;
export const selectTotalReport = selectCurrentTotal;
export const selectNetWorthReport = selectCurrentNetWorth;

export const selectReportKpis = createSelector(selectCurrentTotal, (total) => {
  const data = total.data;
  if (!data) {
    return { net: undefined, income: undefined, expense: undefined };
  }
  return {
    net: data.net,
    income: data.income,
    expense: data.expense,
  };
});

export const ReportsReducer = reportsSlice.reducer;
