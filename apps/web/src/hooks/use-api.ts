import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  ArchiveAccount,
  AttachLoan,
  CreateAccount,
  FetchAccountOptions,
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
  FetchCategoryOptions,
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
  DeleteImportDraft,
  FetchImportDrafts,
  PreviewImports,
  FetchStoredImportFiles,
  LoadImportDraft,
  DownloadImportFile,
  ResetImports,
  SaveImportDraft,
  SuggestImportCategories,
} from "@/features/imports/importsSaga";
import {
  selectImportDraftSaving,
  selectImportDrafts,
  selectImportDraftsError,
  selectImportDraftsLoading,
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
  CreateInvestmentSnapshot,
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
import {
  LoadSettings,
  RunBackup,
  SaveSettings,
} from "@/features/settings/settingsSaga";
import {
  selectFirstName,
  selectLastName,
  selectSettingsError,
  selectSettingsLastSavedAt,
  selectSettingsLoading,
  selectSettingsSaving,
  selectSettingsState,
  selectCurrencyCode,
  selectBackingUp,
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
import {
  CreateVentureCompany,
  CreateVentureDocument,
  CreateVentureNote,
  CreateVentureOwnershipEvent,
  CreateVentureValuation,
  DeleteVentureCompany,
  DeleteVentureDocument,
  DeleteVentureNote,
  FetchVentureCompany,
  FetchVenturesOverview,
  ListVentureDocuments,
  ListVentureNotes,
  PresignVentureUpload,
  UpdateVentureCompany,
  UpdateVentureLayout,
  UpdateVentureNote,
} from "@/features/ventures/venturesSaga";
import { selectVenturesState } from "@/features/ventures/venturesSlice";
import type {
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
  const fetchAccountOptions = useCallback(
    (filters?: Pick<AccountsState, "includeInactive">) =>
      dispatch(FetchAccountOptions(filters)),
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
    fetchAccountOptions,
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
    (
      filters?: Partial<
        Pick<CategoriesState, "includeArchived" | "includeSpecial">
      >,
    ) => {
      dispatch(FetchCategories(filters));
    },
    [dispatch],
  );
  const fetchCategoryOptions = useCallback(
    (
      filters?: Partial<
        Pick<CategoriesState, "includeArchived" | "includeSpecial">
      >,
    ) => {
      dispatch(FetchCategoryOptions(filters));
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
    fetchCategoryOptions,
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
        includeTaxEvent?: boolean;
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
    (params?: Parameters<typeof FetchInvestmentTransactions>[0]) =>
      dispatch(FetchInvestmentTransactions(params)),
    [dispatch],
  );

  const fetchOverview = useCallback(
    () => dispatch(FetchInvestmentOverview()),
    [dispatch],
  );

  const createSnapshot = useCallback(
    (data: Parameters<typeof CreateInvestmentSnapshot>[0]["data"]) =>
      dispatch(CreateInvestmentSnapshot({ data })),
    [dispatch],
  );

  return {
    ...state,
    transactions,
    overview,
    fetchTransactions,
    fetchOverview,
    createSnapshot,
  };
};

export const useVenturesApi = () => {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectVenturesState);

  const fetchOverview = useCallback(
    () => dispatch(FetchVenturesOverview()),
    [dispatch],
  );

  const fetchCompany = useCallback(
    (companyId: string) => dispatch(FetchVentureCompany({ companyId })),
    [dispatch],
  );

  const createCompany = useCallback(
    (data: Parameters<typeof CreateVentureCompany>[0]["data"]) =>
      dispatch(CreateVentureCompany({ data })),
    [dispatch],
  );

  const updateCompany = useCallback(
    (
      companyId: string,
      data: Parameters<typeof UpdateVentureCompany>[0]["data"],
    ) => dispatch(UpdateVentureCompany({ companyId, data })),
    [dispatch],
  );

  const deleteCompany = useCallback(
    (companyId: string) => dispatch(DeleteVentureCompany({ companyId })),
    [dispatch],
  );

  const createValuation = useCallback(
    (
      companyId: string,
      data: Parameters<typeof CreateVentureValuation>[0]["data"],
    ) => dispatch(CreateVentureValuation({ companyId, data })),
    [dispatch],
  );

  const createOwnershipEvent = useCallback(
    (
      companyId: string,
      data: Parameters<typeof CreateVentureOwnershipEvent>[0]["data"],
    ) => dispatch(CreateVentureOwnershipEvent({ companyId, data })),
    [dispatch],
  );

  const listNotes = useCallback(
    (companyId: string) => dispatch(ListVentureNotes({ companyId })),
    [dispatch],
  );

  const createNote = useCallback(
    (
      companyId: string,
      data: Parameters<typeof CreateVentureNote>[0]["data"],
    ) => dispatch(CreateVentureNote({ companyId, data })),
    [dispatch],
  );

  const updateNote = useCallback(
    (
      companyId: string,
      noteId: string,
      data: Parameters<typeof UpdateVentureNote>[0]["data"],
    ) => dispatch(UpdateVentureNote({ companyId, noteId, data })),
    [dispatch],
  );

  const deleteNote = useCallback(
    (companyId: string, noteId: string) =>
      dispatch(DeleteVentureNote({ companyId, noteId })),
    [dispatch],
  );

  const listDocuments = useCallback(
    (companyId: string) => dispatch(ListVentureDocuments({ companyId })),
    [dispatch],
  );

  const createDocument = useCallback(
    (
      companyId: string,
      data: Parameters<typeof CreateVentureDocument>[0]["data"],
    ) => dispatch(CreateVentureDocument({ companyId, data })),
    [dispatch],
  );

  const deleteDocument = useCallback(
    (companyId: string, documentId: string) =>
      dispatch(DeleteVentureDocument({ companyId, documentId })),
    [dispatch],
  );

  const updateLayout = useCallback(
    (data: Parameters<typeof UpdateVentureLayout>[0]["data"]) =>
      dispatch(UpdateVentureLayout({ data })),
    [dispatch],
  );

  const presignUpload = useCallback(
    (data: Parameters<typeof PresignVentureUpload>[0]["data"]) =>
      dispatch(PresignVentureUpload({ data })),
    [dispatch],
  );

  return {
    ...state,
    fetchOverview,
    fetchCompany,
    createCompany,
    updateCompany,
    deleteCompany,
    createValuation,
    createOwnershipEvent,
    listNotes,
    createNote,
    updateNote,
    deleteNote,
    listDocuments,
    createDocument,
    deleteDocument,
    updateLayout,
    presignUpload,
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
  const drafts = useAppSelector(selectImportDrafts);
  const draftsLoading = useAppSelector(selectImportDraftsLoading);
  const draftsError = useAppSelector(selectImportDraftsError);
  const draftSaving = useAppSelector(selectImportDraftSaving);

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

  const fetchImportDrafts = useCallback(
    () => dispatch(FetchImportDrafts()),
    [dispatch],
  );

  const loadImportDraft = useCallback(
    (importBatchId: string) => dispatch(LoadImportDraft({ importBatchId })),
    [dispatch],
  );

  const saveImportDraft = useCallback(
    (payload: Parameters<typeof SaveImportDraft>[0]) =>
      dispatch(SaveImportDraft(payload)),
    [dispatch],
  );

  const deleteImportDraft = useCallback(
    (importBatchId: string) => dispatch(DeleteImportDraft({ importBatchId })),
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
    drafts,
    draftsLoading,
    draftsError,
    draftSaving,
    previewImports,
    commitImports,
    suggestCategories,
    resetImports,
    fetchStoredFiles,
    fetchImportDrafts,
    loadImportDraft,
    saveImportDraft,
    deleteImportDraft,
    downloadImportFile,
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
  const backingUp = useAppSelector(selectBackingUp);
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

  const runBackup = useCallback(() => {
    dispatch(RunBackup());
  }, [dispatch]);

  return {
    ...state,
    firstName,
    lastName,
    currencyCode,
    loading,
    saving,
    backingUp,
    error,
    lastSavedAt,
    loadSettings,
    saveSettings,
    runBackup,
    changeFirstName,
    changeLastName,
    changeCurrencyCode,
  };
};
