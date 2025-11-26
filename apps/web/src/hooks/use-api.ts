import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { FetchAccounts } from "@/features/accounts/accountsSaga";
import {
  selectAccountsState,
  type AccountsState,
} from "@/features/accounts/accountsSlice";
import { FetchCategories } from "@/features/categories/categoriesSaga";
import {
  selectCategoriesState,
  type CategoriesState,
} from "@/features/categories/categoriesSlice";
import {
  FetchImportJobs,
  RegisterImportJob,
} from "@/features/imports/importsSaga";
import {
  selectImportJobs,
  selectImportsError,
  selectImportsLoading,
} from "@/features/imports/importsSlice";
import { FetchLoanEvents, FetchLoanSchedule } from "@/features/loans/loansSaga";
import {
  selectLoanError,
  selectLoanEvents,
  selectLoanLoading,
  selectLoanSchedule,
} from "@/features/loans/loansSlice";
import {
  FetchMonthlyReport,
  FetchNetWorthHistory,
  FetchTotalReport,
  FetchYearlyReport,
} from "@/features/reports/reportsSaga";
import {
  selectMonthlyReport,
  selectNetWorthReport,
  selectReportKpis,
  selectReportsState,
  selectTotalReport,
  selectYearlyReport,
  type ReportFilters,
} from "@/features/reports/reportsSlice";
import {
  FetchRecentTransactions,
  FetchTransactions,
} from "@/features/transactions/transactionsSaga";
import {
  selectTransactionFilters,
  selectRecentTransactions,
  selectTransactions,
  selectTransactionsError,
  selectTransactionsLoading,
  type TransactionFilters,
} from "@/features/transactions/transactionsSlice";
import type { ImportJob } from "@/types/api";

export const useAccountsApi = () => {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectAccountsState);

  const fetchAccounts = useCallback(
    (filters?: Partial<Pick<AccountsState, "includeInactive" | "asOfDate">>) =>
      dispatch(FetchAccounts(filters)),
    [dispatch],
  );

  return { ...state, fetchAccounts };
};

export const useCategoriesApi = () => {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectCategoriesState);

  const fetchCategories = useCallback(
    (filters?: Partial<Pick<CategoriesState, "includeArchived">>) => {
      dispatch(FetchCategories(filters));
    },
    [dispatch],
  );

  return { ...state, fetchCategories };
};

export const useTransactionsApi = () => {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectTransactions);
  const loading = useAppSelector(selectTransactionsLoading);
  const error = useAppSelector(selectTransactionsError);
  const filters = useAppSelector(selectTransactionFilters);
  const recent = useAppSelector(selectRecentTransactions);

  const fetchTransactions = useCallback(
    (nextFilters?: TransactionFilters) => {
      dispatch(FetchTransactions(nextFilters));
    },
    [dispatch],
  );
  const fetchRecentTransactions = useCallback(
    (params?: { limit?: number; accountIds?: string[] }) => {
      dispatch(FetchRecentTransactions(params));
    },
    [dispatch],
  );

  return {
    items,
    loading,
    error,
    filters,
    recent,
    fetchTransactions,
    fetchRecentTransactions,
  };
};

export const useReportsApi = () => {
  const dispatch = useAppDispatch();
  const monthly = useAppSelector(selectMonthlyReport);
  const yearly = useAppSelector(selectYearlyReport);
  const total = useAppSelector(selectTotalReport);
  const netWorth = useAppSelector(selectNetWorthReport);
  const kpis = useAppSelector(selectReportKpis);
  const state = useAppSelector(selectReportsState);

  const fetchMonthlyReport = useCallback(
    (filters?: ReportFilters) => dispatch(FetchMonthlyReport(filters)),
    [dispatch],
  );
  const fetchYearlyReport = useCallback(
    (filters?: Omit<ReportFilters, "year">) =>
      dispatch(FetchYearlyReport(filters)),
    [dispatch],
  );
  const fetchTotalReport = useCallback(
    (filters?: Omit<ReportFilters, "year">) =>
      dispatch(FetchTotalReport(filters)),
    [dispatch],
  );
  const fetchNetWorthReport = useCallback(
    (filters?: Omit<ReportFilters, "year" | "categoryIds">) =>
      dispatch(FetchNetWorthHistory(filters)),
    [dispatch],
  );

  return {
    monthly,
    yearly,
    total,
    netWorth,
    kpis,
    state,
    fetchMonthlyReport,
    fetchYearlyReport,
    fetchTotalReport,
    fetchNetWorthReport,
  };
};

export const useLoansApi = () => {
  const dispatch = useAppDispatch();
  const schedules = useAppSelector(selectLoanSchedule);
  const events = useAppSelector(selectLoanEvents);
  const loading = useAppSelector(selectLoanLoading);
  const error = useAppSelector(selectLoanError);

  const fetchLoanSchedule = useCallback(
    (params: { accountId: string; asOfDate?: string; periods?: number }) => {
      dispatch(FetchLoanSchedule(params));
    },
    [dispatch],
  );

  const fetchLoanEvents = useCallback(
    (params: { accountId: string; limit?: number; offset?: number }) => {
      dispatch(FetchLoanEvents(params));
    },
    [dispatch],
  );

  return {
    schedules,
    events,
    loading,
    error,
    fetchLoanSchedule,
    fetchLoanEvents,
  };
};

export const useImportsApi = () => {
  const dispatch = useAppDispatch();
  const jobs = useAppSelector(selectImportJobs);
  const loading = useAppSelector(selectImportsLoading);
  const error = useAppSelector(selectImportsError);

  const fetchImportJobs = useCallback(
    () => dispatch(FetchImportJobs()),
    [dispatch],
  );
  const registerImportJob = useCallback(
    (job: ImportJob) => dispatch(RegisterImportJob(job)),
    [dispatch],
  );

  return { jobs, loading, error, fetchImportJobs, registerImportJob };
};
