import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  MonthlyReportEntry,
  TotalReportRead,
  YearlyReportEntry,
} from "@/types/api";

export interface ReportFilters {
  year?: number;
  accountIds?: string[];
  categoryIds?: string[];
}

export interface ReportsState {
  monthly: {
    data: MonthlyReportEntry[];
    loading: boolean;
    error?: string;
    filters: ReportFilters;
  };
  yearly: {
    data: YearlyReportEntry[];
    loading: boolean;
    error?: string;
    filters: Omit<ReportFilters, "year">;
  };
  total: {
    data?: TotalReportRead;
    loading: boolean;
    error?: string;
    filters: Omit<ReportFilters, "year">;
  };
}

const initialState: ReportsState = {
  monthly: {
    data: [],
    loading: false,
    filters: {},
  },
  yearly: {
    data: [],
    loading: false,
    filters: {},
  },
  total: {
    data: undefined,
    loading: false,
    filters: {},
  },
};

const reportsSlice = createSlice({
  name: "reports",
  initialState,
  reducers: {
    setMonthlyReport(state, action: PayloadAction<MonthlyReportEntry[]>) {
      state.monthly.data = action.payload;
      state.monthly.error = undefined;
    },
    setMonthlyFilters(state, action: PayloadAction<ReportFilters>) {
      state.monthly.filters = { ...state.monthly.filters, ...action.payload };
    },
    setMonthlyLoading(state, action: PayloadAction<boolean>) {
      state.monthly.loading = action.payload;
    },
    setMonthlyError(state, action: PayloadAction<string | undefined>) {
      state.monthly.error = action.payload ?? "Unable to load monthly report";
    },
    setYearlyReport(state, action: PayloadAction<YearlyReportEntry[]>) {
      state.yearly.data = action.payload;
      state.yearly.error = undefined;
    },
    setYearlyFilters(
      state,
      action: PayloadAction<Omit<ReportFilters, "year">>,
    ) {
      state.yearly.filters = { ...state.yearly.filters, ...action.payload };
    },
    setYearlyLoading(state, action: PayloadAction<boolean>) {
      state.yearly.loading = action.payload;
    },
    setYearlyError(state, action: PayloadAction<string | undefined>) {
      state.yearly.error = action.payload ?? "Unable to load yearly report";
    },
    setTotalReport(state, action: PayloadAction<TotalReportRead | undefined>) {
      state.total.data = action.payload;
      state.total.error = undefined;
    },
    setTotalFilters(state, action: PayloadAction<Omit<ReportFilters, "year">>) {
      state.total.filters = { ...state.total.filters, ...action.payload };
    },
    setTotalLoading(state, action: PayloadAction<boolean>) {
      state.total.loading = action.payload;
    },
    setTotalError(state, action: PayloadAction<string | undefined>) {
      state.total.error = action.payload ?? "Unable to load totals";
    },
  },
  selectors: {
    selectReportsState: (state) => state,
    selectMonthlyReport: (state) => state.monthly,
    selectYearlyReport: (state) => state.yearly,
    selectTotalReport: (state) => state.total,
  },
});

export const {
  setMonthlyReport,
  setMonthlyFilters,
  setMonthlyLoading,
  setMonthlyError,
  setYearlyReport,
  setYearlyFilters,
  setYearlyLoading,
  setYearlyError,
  setTotalReport,
  setTotalFilters,
  setTotalLoading,
  setTotalError,
} = reportsSlice.actions;
export const {
  selectReportsState,
  selectMonthlyReport,
  selectYearlyReport,
  selectTotalReport,
} = reportsSlice.selectors;
export const ReportsReducer = reportsSlice.reducer;
