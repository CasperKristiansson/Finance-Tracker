import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  ArchiveAccount,
  AttachLoan,
  CreateAccount,
  FetchAccounts,
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
  StartImportSession,
  AppendImportFiles,
  FetchImportSession,
  CommitImportSession,
  ResetImportSession,
} from "@/features/imports/importsSaga";
import {
  selectImportSession,
  selectImportsError,
  selectImportsLoading,
  selectImportsSaving,
} from "@/features/imports/importsSlice";
import {
  FetchInvestmentSnapshots,
  FetchInvestmentTransactions,
  FetchInvestmentMetrics,
  ParseNordnetExport,
  SaveNordnetSnapshot,
  ClearDraft as ClearInvestmentDraft,
} from "@/features/investments/investmentsSaga";
import {
  selectInvestmentsState,
  selectParsedResults,
  selectParseLoading,
  selectLastSavedClientId,
  selectInvestmentTransactions,
  selectInvestmentMetrics,
} from "@/features/investments/investmentsSlice";
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
  selectApiBaseUrl,
  selectBankTemplates,
  selectEnvInfo,
  selectSettingsError,
  selectSettingsLastSavedAt,
  selectSettingsLoading,
  selectSettingsSaving,
  selectSettingsState,
  selectThemePreference,
  setThemePreference,
  upsertBankTemplate,
  removeBankTemplate,
  type BankTemplate,
} from "@/features/settings/settingsSlice";
import {
  FetchRecentTransactions,
  FetchTransactions,
  CreateTransaction,
  UpdateTransaction,
  DeleteTransaction,
  UpdateTransactionStatus,
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
  ImportCreateRequest,
  ImportCommitRow,
  TransactionCreate,
  TransactionStatus,
  TransactionUpdateRequest,
  ThemePreference,
  NordnetSnapshotCreateRequest,
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

  return {
    ...state,
    fetchAccounts,
    createAccount,
    updateAccount,
    archiveAccount,
    attachLoan,
    updateLoan,
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
  const updateTransactionStatus = useCallback(
    (id: string, status: TransactionStatus) =>
      dispatch(UpdateTransactionStatus({ id, status })),
    [dispatch],
  );
  const deleteTransaction = useCallback(
    (id: string) => dispatch(DeleteTransaction(id)),
    [dispatch],
  );
  const fetchRecentTransactions = useCallback(
    (params: { limit?: number; accountIds?: string[] } = {}) => {
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
    updateTransactionStatus,
    deleteTransaction,
  };
};

export const useInvestmentsApi = () => {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectInvestmentsState);
  const parseLoading = useAppSelector(selectParseLoading);
  const parsedResults = useAppSelector(selectParsedResults);
  const lastSavedClientId = useAppSelector(selectLastSavedClientId);
  const transactions = useAppSelector(selectInvestmentTransactions);
  const metrics = useAppSelector(selectInvestmentMetrics);

  const fetchSnapshots = useCallback(
    () => dispatch(FetchInvestmentSnapshots()),
    [dispatch],
  );

  const fetchTransactions = useCallback(
    () => dispatch(FetchInvestmentTransactions()),
    [dispatch],
  );

  const fetchMetrics = useCallback(
    () => dispatch(FetchInvestmentMetrics()),
    [dispatch],
  );

  const parseExport = useCallback(
    (
      clientId: string,
      raw_text: string,
      manual_payload?: Record<string, unknown>,
    ) =>
      dispatch(
        ParseNordnetExport({
          clientId,
          raw_text,
          manual_payload,
        }),
      ),
    [dispatch],
  );

  const saveSnapshot = useCallback(
    (payload: NordnetSnapshotCreateRequest & { clientId?: string }) =>
      dispatch(SaveNordnetSnapshot(payload)),
    [dispatch],
  );

  const clearDraft = useCallback(
    (clientId: string) => dispatch(ClearInvestmentDraft({ clientId })),
    [dispatch],
  );

  return {
    ...state,
    parseLoading,
    parsedResults,
    lastSavedClientId,
    transactions,
    metrics,
    fetchSnapshots,
    fetchTransactions,
    fetchMetrics,
    parseExport,
    saveSnapshot,
    clearDraft,
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
  const session = useAppSelector(selectImportSession);
  const loading = useAppSelector(selectImportsLoading);
  const saving = useAppSelector(selectImportsSaving);
  const error = useAppSelector(selectImportsError);

  const startImportSession = useCallback(
    (payload: ImportCreateRequest) => dispatch(StartImportSession(payload)),
    [dispatch],
  );

  const appendImportFiles = useCallback(
    (sessionId: string, payload: ImportCreateRequest) =>
      dispatch(AppendImportFiles({ ...payload, sessionId })),
    [dispatch],
  );

  const fetchImportSession = useCallback(
    (sessionId: string) => dispatch(FetchImportSession(sessionId)),
    [dispatch],
  );

  const commitImportSession = useCallback(
    (sessionId: string, rows: ImportCommitRow[]) =>
      dispatch(CommitImportSession({ sessionId, rows })),
    [dispatch],
  );

  const resetImportSession = useCallback(
    () => dispatch(ResetImportSession()),
    [dispatch],
  );

  return {
    session,
    loading,
    saving,
    error,
    startImportSession,
    appendImportFiles,
    fetchImportSession,
    commitImportSession,
    resetImportSession,
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
  const theme = useAppSelector(selectThemePreference);
  const templates = useAppSelector(selectBankTemplates);
  const envInfo = useAppSelector(selectEnvInfo);
  const apiBaseUrl = useAppSelector(selectApiBaseUrl);
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

  const changeTheme = useCallback(
    (nextTheme: ThemePreference) => dispatch(setThemePreference(nextTheme)),
    [dispatch],
  );

  const upsertTemplate = useCallback(
    (template: BankTemplate) => dispatch(upsertBankTemplate(template)),
    [dispatch],
  );

  const deleteTemplate = useCallback(
    (id: string) => dispatch(removeBankTemplate(id)),
    [dispatch],
  );

  return {
    ...state,
    theme,
    templates,
    envInfo,
    apiBaseUrl,
    loading,
    saving,
    error,
    lastSavedAt,
    loadSettings,
    saveSettings,
    changeTheme,
    upsertTemplate,
    deleteTemplate,
  };
};
