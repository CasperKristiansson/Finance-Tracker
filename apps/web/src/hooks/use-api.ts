import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  ArchiveAccount,
  AttachLoan,
  CreateAccount,
  FetchAccounts,
  ReconcileAccounts,
  UpdateAccount,
  UpdateLoan,
} from "@/features/accounts/accountsSaga";
import {
  selectAccountsState,
  type AccountsState,
} from "@/features/accounts/accountsSlice";
import {
  CreateBudget,
  DeleteBudget,
  FetchBudgets,
  UpdateBudget,
} from "@/features/budgets/budgetsSaga";
import {
  selectBudgets,
  selectBudgetsError,
  selectBudgetsLoading,
  selectBudgetRollups,
  selectBudgetTotals,
  selectBudgetsByUsage,
} from "@/features/budgets/budgetsSlice";
import {
  FetchCategories,
  CreateCategory,
  UpdateCategory,
  MergeCategory,
} from "@/features/categories/categoriesSaga";
import {
  selectCategoriesState,
  type CategoriesState,
} from "@/features/categories/categoriesSlice";
import {
  CommitImports,
  PreviewImports,
  FetchStoredImportFiles,
  DownloadImportFile,
  ResetImports,
  SuggestImportCategories,
} from "@/features/imports/importsSaga";
import {
  selectImportsError,
  selectImportsLoading,
  selectImportPreview,
  selectImportSuggestions,
  selectImportsSuggesting,
  selectImportsSuggestionsError,
  selectImportsSaving,
  selectStoredImportFiles,
  selectStoredImportFilesLoading,
  selectStoredImportFilesError,
} from "@/features/imports/importsSlice";
import {
  FetchInvestmentTransactions,
  FetchInvestmentOverview,
} from "@/features/investments/investmentsSaga";
import {
  selectInvestmentsState,
  selectInvestmentTransactions,
  selectInvestmentOverview,
} from "@/features/investments/investmentsSlice";
import {
  FetchLoanEvents,
  FetchLoanPortfolioSeries,
  FetchLoanSchedule,
} from "@/features/loans/loansSaga";
import {
  selectLoanError,
  selectLoanEvents,
  selectLoanLoading,
  selectLoanPortfolioSeries,
  selectLoanSchedule,
} from "@/features/loans/loansSlice";
import {
  FetchMonthlyReport,
  FetchNetWorthHistory,
  FetchTotalReport,
  FetchYearlyReport,
  FetchQuarterlyReport,
  FetchCustomReport,
  ExportReport,
} from "@/features/reports/reportsSaga";
import {
  selectMonthlyReport,
  selectNetWorthReport,
  selectQuarterlyByFilters,
  selectCustomByFilters,
  selectReportKpis,
  selectReportsState,
  selectTotalReport,
  selectYearlyReport,
  type ReportFilters,
} from "@/features/reports/reportsSlice";
import { LoadSettings, SaveSettings } from "@/features/settings/settingsSaga";
import {
  selectFirstName,
  selectLastName,
  selectSettingsError,
  selectSettingsLastSavedAt,
  selectSettingsLoading,
  selectSettingsSaving,
  selectSettingsState,
  selectCurrencyCode,
  setFirstName,
  setLastName,
  setCurrencyCode,
} from "@/features/settings/settingsSlice";
import {
  FetchRecentTransactions,
  FetchTransactions,
  CreateTransaction,
  UpdateTransaction,
  DeleteTransaction,
} from "@/features/transactions/transactionsSaga";
import {
  selectTransactionFilters,
  selectRecentTransactions,
  selectTransactions,
  selectTransactionsError,
  selectTransactionsLoading,
  selectTransactionsPagination,
  selectRunningBalanceByAccount,
  type TransactionFilters,
} from "@/features/transactions/transactionsSlice";
import type {
  BudgetCreateRequest,
  BudgetUpdateRequest,
  CategoryCreateRequest,
  CategoryUpdateRequest,
  ImportCommitRequest,
  ImportPreviewRequest,
  ImportPreviewResponse,
  TransactionCreate,
  TransactionUpdateRequest,
} from "@/types/api";

export const useAccountsApi = () => {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectAccountsState);

  const fetchAccounts = useCallback(
    (filters?: Partial<Pick<AccountsState, "includeInactive" | "asOfDate">>) =>
      dispatch(FetchAccounts(filters)),
    [dispatch],
  );

  const createAccount = useCallback(
    (payload: Parameters<typeof CreateAccount>[0]) =>
      dispatch(CreateAccount(payload)),
    [dispatch],
  );

  const updateAccount = useCallback(
    (accountId: string, data: Parameters<typeof UpdateAccount>[0]["data"]) =>
      dispatch(UpdateAccount({ accountId, data })),
    [dispatch],
  );

  const archiveAccount = useCallback(
    (accountId: string) => dispatch(ArchiveAccount({ accountId })),
    [dispatch],
  );

  const attachLoan = useCallback(
    (payload: Parameters<typeof AttachLoan>[0]) =>
      dispatch(AttachLoan(payload)),
    [dispatch],
  );

  const updateLoan = useCallback(
    (accountId: string, data: Parameters<typeof UpdateLoan>[0]["data"]) =>
      dispatch(UpdateLoan({ accountId, data })),
    [dispatch],
  );

  const reconcileAccounts = useCallback(
    (payload: Parameters<typeof ReconcileAccounts>[0]) =>
      dispatch(ReconcileAccounts(payload)),
    [dispatch],
  );

  return {
    ...state,
    fetchAccounts,
    createAccount,
    updateAccount,
    archiveAccount,
    attachLoan,
    updateLoan,
    reconcileAccounts,
    accountMutationError: state.mutationError,
    createLoading: state.createLoading,
    updateLoading: state.updateLoading,
  };
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

  const createCategory = useCallback(
    (payload: CategoryCreateRequest) => dispatch(CreateCategory(payload)),
    [dispatch],
  );

  const updateCategory = useCallback(
    (id: string, data: CategoryUpdateRequest) =>
      dispatch(UpdateCategory({ id, data })),
    [dispatch],
  );

  const mergeCategory = useCallback(
    (payload: Parameters<typeof MergeCategory>[0]) =>
      dispatch(MergeCategory(payload)),
    [dispatch],
  );

  return {
    ...state,
    fetchCategories,
    createCategory,
    updateCategory,
    mergeCategory,
  };
};

export const useTransactionsApi = () => {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectTransactions);
  const loading = useAppSelector(selectTransactionsLoading);
  const error = useAppSelector(selectTransactionsError);
  const filters = useAppSelector(selectTransactionFilters);
  const recent = useAppSelector(selectRecentTransactions);
  const pagination = useAppSelector(selectTransactionsPagination);
  const runningBalances = useAppSelector(selectRunningBalanceByAccount);

  const fetchTransactions = useCallback(
    (nextFilters?: TransactionFilters) => {
      dispatch(FetchTransactions(nextFilters));
    },
    [dispatch],
  );
  const createTransaction = useCallback(
    (payload: TransactionCreate) => dispatch(CreateTransaction(payload)),
    [dispatch],
  );
  const updateTransaction = useCallback(
    (id: string, data: TransactionUpdateRequest) =>
      dispatch(UpdateTransaction({ id, data })),
    [dispatch],
  );
  const deleteTransaction = useCallback(
    (id: string) => dispatch(DeleteTransaction(id)),
    [dispatch],
  );
  const fetchRecentTransactions = useCallback(
    (
      params: {
        limit?: number;
        accountIds?: string[];
        transactionTypes?: string[];
      } = {},
    ) => {
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
    pagination,
    runningBalances,
    fetchTransactions,
    fetchRecentTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
};

export const useInvestmentsApi = () => {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectInvestmentsState);
  const transactions = useAppSelector(selectInvestmentTransactions);
  const overview = useAppSelector(selectInvestmentOverview);

  const fetchTransactions = useCallback(
    () => dispatch(FetchInvestmentTransactions()),
    [dispatch],
  );

  const fetchOverview = useCallback(
    () => dispatch(FetchInvestmentOverview()),
    [dispatch],
  );

  return {
    ...state,
    transactions,
    overview,
    fetchTransactions,
    fetchOverview,
  };
};

export const useReportsApi = () => {
  const dispatch = useAppDispatch();
  const monthly = useAppSelector(selectMonthlyReport);
  const yearly = useAppSelector(selectYearlyReport);
  const quarterly = useAppSelector((state) =>
    selectQuarterlyByFilters(state, undefined),
  );
  const custom = useAppSelector((state) =>
    selectCustomByFilters(state, {
      start_date: "",
      end_date: "",
    }),
  );
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
  const fetchQuarterlyReport = useCallback(
    (filters?: ReportFilters) => dispatch(FetchQuarterlyReport(filters)),
    [dispatch],
  );
  const fetchCustomReport = useCallback(
    (params: Parameters<typeof FetchCustomReport>[0]) =>
      dispatch(FetchCustomReport(params)),
    [dispatch],
  );
  const exportReport = useCallback(
    (payload: Parameters<typeof ExportReport>[0]) =>
      dispatch(ExportReport(payload)),
    [dispatch],
  );

  return {
    monthly,
    yearly,
    quarterly,
    custom,
    total,
    netWorth,
    kpis,
    state,
    fetchMonthlyReport,
    fetchYearlyReport,
    fetchTotalReport,
    fetchNetWorthReport,
    fetchQuarterlyReport,
    fetchCustomReport,
    exportReport,
  };
};

export const useLoansApi = () => {
  const dispatch = useAppDispatch();
  const schedules = useAppSelector(selectLoanSchedule);
  const events = useAppSelector(selectLoanEvents);
  const portfolioSeries = useAppSelector(selectLoanPortfolioSeries);
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

  const fetchLoanPortfolioSeries = useCallback(
    (params: { startDate?: string; endDate?: string } = {}) => {
      dispatch(FetchLoanPortfolioSeries(params));
    },
    [dispatch],
  );

  return {
    schedules,
    events,
    portfolioSeries,
    loading,
    error,
    fetchLoanSchedule,
    fetchLoanEvents,
    fetchLoanPortfolioSeries,
  };
};

export const useImportsApi = () => {
  const dispatch = useAppDispatch();
  const preview = useAppSelector(selectImportPreview);
  const loading = useAppSelector(selectImportsLoading);
  const saving = useAppSelector(selectImportsSaving);
  const suggesting = useAppSelector(selectImportsSuggesting);
  const suggestions = useAppSelector(selectImportSuggestions);
  const suggestionsError = useAppSelector(selectImportsSuggestionsError);
  const error = useAppSelector(selectImportsError);
  const storedFiles = useAppSelector(selectStoredImportFiles);
  const storedFilesLoading = useAppSelector(selectStoredImportFilesLoading);
  const storedFilesError = useAppSelector(selectStoredImportFilesError);

  const previewImports = useCallback(
    (payload: ImportPreviewRequest) => dispatch(PreviewImports(payload)),
    [dispatch],
  );

  const commitImports = useCallback(
    (payload: ImportCommitRequest) => dispatch(CommitImports(payload)),
    [dispatch],
  );

  const resetImports = useCallback(() => dispatch(ResetImports()), [dispatch]);

  const suggestCategories = useCallback(
    (previewResponse: ImportPreviewResponse) =>
      dispatch(SuggestImportCategories({ preview: previewResponse })),
    [dispatch],
  );

  const fetchStoredFiles = useCallback(
    () => dispatch(FetchStoredImportFiles()),
    [dispatch],
  );

  const downloadImportFile = useCallback(
    (fileId: string) => dispatch(DownloadImportFile({ fileId })),
    [dispatch],
  );

  return {
    preview,
    loading,
    saving,
    suggesting,
    suggestions,
    suggestionsError,
    error,
    storedFiles,
    storedFilesLoading,
    storedFilesError,
    previewImports,
    commitImports,
    suggestCategories,
    resetImports,
    fetchStoredFiles,
    downloadImportFile,
  };
};

export const useBudgetsApi = () => {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectBudgets);
  const loading = useAppSelector(selectBudgetsLoading);
  const error = useAppSelector(selectBudgetsError);
  const totals = useAppSelector(selectBudgetTotals);
  const rollups = useAppSelector(selectBudgetRollups);
  const budgetsByUsage = useAppSelector(selectBudgetsByUsage);

  const fetchBudgets = useCallback(() => {
    dispatch(FetchBudgets());
  }, [dispatch]);

  const createBudget = useCallback(
    (payload: BudgetCreateRequest) => dispatch(CreateBudget(payload)),
    [dispatch],
  );

  const updateBudget = useCallback(
    (id: string, data: BudgetUpdateRequest) =>
      dispatch(UpdateBudget({ id, data })),
    [dispatch],
  );

  const deleteBudget = useCallback(
    (id: string) => dispatch(DeleteBudget(id)),
    [dispatch],
  );

  return {
    items,
    loading,
    error,
    fetchBudgets,
    createBudget,
    updateBudget,
    deleteBudget,
    totals,
    rollups,
    budgetsByUsage,
  };
};

export const useSettings = () => {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectSettingsState);
  const firstName = useAppSelector(selectFirstName);
  const lastName = useAppSelector(selectLastName);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const loading = useAppSelector(selectSettingsLoading);
  const saving = useAppSelector(selectSettingsSaving);
  const error = useAppSelector(selectSettingsError);
  const lastSavedAt = useAppSelector(selectSettingsLastSavedAt);

  const loadSettings = useCallback(() => {
    dispatch(LoadSettings());
  }, [dispatch]);

  const saveSettings = useCallback(() => {
    dispatch(SaveSettings());
  }, [dispatch]);

  const changeFirstName = useCallback(
    (value: string) => dispatch(setFirstName(value)),
    [dispatch],
  );

  const changeLastName = useCallback(
    (value: string) => dispatch(setLastName(value)),
    [dispatch],
  );

  const changeCurrencyCode = useCallback(
    (value: string | undefined) => dispatch(setCurrencyCode(value)),
    [dispatch],
  );

  return {
    ...state,
    firstName,
    lastName,
    currencyCode,
    loading,
    saving,
    error,
    lastSavedAt,
    loadSettings,
    saveSettings,
    changeFirstName,
    changeLastName,
    changeCurrencyCode,
  };
};
