// THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.
// Run: python3 scripts/generate_api_contract_types.py

import { defineEndpoint } from "./endpoint";
import type * as Models from "./models";

export type CashflowForecastRequest = void;
export type CashflowForecastResponse = Models.CashflowForecastResponse;
export type CashflowForecastQuery = Models.CashflowForecastQuery;
export type CashflowForecastPath = void;

export type CommitImportsRequest = Models.ImportCommitRequest;
export type CommitImportsResponse = Models.ImportCommitResponse;
export type CommitImportsQuery = void;
export type CommitImportsPath = void;

export type CreateAccountRequest = Models.AccountCreate;
export type CreateAccountResponse = Models.AccountWithBalance;
export type CreateAccountQuery = void;
export type CreateAccountPath = void;

export type CreateCategoryRequest = Models.CategoryCreate;
export type CreateCategoryResponse = Models.CategoryRead;
export type CreateCategoryQuery = void;
export type CreateCategoryPath = void;

export type CreateGoalRequest = Models.GoalCreate;
export type CreateGoalResponse = Models.GoalRead;
export type CreateGoalQuery = void;
export type CreateGoalPath = void;

export type CreateInvestmentSnapshotRequest =
  Models.InvestmentSnapshotCreateRequest;
export type CreateInvestmentSnapshotResponse =
  Models.InvestmentSnapshotCreateResponse;
export type CreateInvestmentSnapshotQuery = void;
export type CreateInvestmentSnapshotPath = void;

export type CreateLoanRequest = Models.LoanCreateRequest;
export type CreateLoanResponse = Models.LoanRead;
export type CreateLoanQuery = void;
export type CreateLoanPath = void;

export type CreateLoanActivityRequest = Models.LoanActivityCreateRequest;
export type CreateLoanActivityResponse = Models.LoanActivityCreateResponse;
export type CreateLoanActivityQuery = void;
export type CreateLoanActivityPath = { accountId: string };

export type CreateTaxEventRequest = Models.TaxEventCreateRequest;
export type CreateTaxEventResponse = Models.TaxEventCreateResponse;
export type CreateTaxEventQuery = void;
export type CreateTaxEventPath = void;

export type CreateTransactionRequest = Models.TransactionCreate;
export type CreateTransactionResponse = Models.TransactionRead;
export type CreateTransactionQuery = void;
export type CreateTransactionPath = void;

export type DashboardOverviewRequest = void;
export type DashboardOverviewResponse = Models.DashboardOverviewResponse;
export type DashboardOverviewQuery = Models.DashboardOverviewQuery;
export type DashboardOverviewPath = void;

export type DateRangeReportRequest = void;
export type DateRangeReportResponse = Models.DateRangeReportResponse;
export type DateRangeReportQuery = Models.DateRangeReportQuery;
export type DateRangeReportPath = void;

export type DeleteGoalRequest = void;
export type DeleteGoalResponse = void;
export type DeleteGoalQuery = void;
export type DeleteGoalPath = { goalId: string };

export type DeleteImportDraftRequest = void;
export type DeleteImportDraftResponse = Models.ImportDraftDeleteResponse;
export type DeleteImportDraftQuery = void;
export type DeleteImportDraftPath = { importBatchId: string };

export type DeleteTransactionRequest = void;
export type DeleteTransactionResponse = void;
export type DeleteTransactionQuery = void;
export type DeleteTransactionPath = { transactionId: string };

export type DownloadImportFileRequest = Models.ImportFileDownloadRequest;
export type DownloadImportFileResponse = Models.ImportFileDownloadResponse;
export type DownloadImportFileQuery = void;
export type DownloadImportFilePath = void;

export type ExportReportRequest = Models.ExportReportRequest;
export type ExportReportResponse = Models.ExportReportResponse;
export type ExportReportQuery = void;
export type ExportReportPath = void;

export type GetImportDraftRequest = void;
export type GetImportDraftResponse = Models.ImportPreviewResponse;
export type GetImportDraftQuery = void;
export type GetImportDraftPath = { importBatchId: string };

export type GetLoanScheduleRequest = void;
export type GetLoanScheduleResponse = Models.LoanScheduleRead;
export type GetLoanScheduleQuery = Models.LoanScheduleQuery;
export type GetLoanSchedulePath = { accountId: string };

export type GetSettingsRequest = void;
export type GetSettingsResponse = Models.SettingsResponse;
export type GetSettingsQuery = void;
export type GetSettingsPath = void;

export type InvestmentOverviewRequest = void;
export type InvestmentOverviewResponse = Models.InvestmentOverviewResponse;
export type InvestmentOverviewQuery = void;
export type InvestmentOverviewPath = void;

export type ListAccountOptionsRequest = void;
export type ListAccountOptionsResponse = Models.ListAccountOptionsResponse;
export type ListAccountOptionsQuery = Models.ListAccountOptionsQuery;
export type ListAccountOptionsPath = void;

export type ListAccountsRequest = void;
export type ListAccountsResponse = Models.ListAccountsResponse;
export type ListAccountsQuery = Models.ListAccountsQuery;
export type ListAccountsPath = void;

export type ListCategoriesRequest = void;
export type ListCategoriesResponse = Models.CategoryListResponse;
export type ListCategoriesQuery = Models.ListCategoriesQuery;
export type ListCategoriesPath = void;

export type ListCategoryOptionsRequest = void;
export type ListCategoryOptionsResponse = Models.CategoryOptionsResponse;
export type ListCategoryOptionsQuery = Models.ListCategoryOptionsQuery;
export type ListCategoryOptionsPath = void;

export type ListGoalsRequest = void;
export type ListGoalsResponse = Models.GoalListResponse;
export type ListGoalsQuery = void;
export type ListGoalsPath = void;

export type ListImportDraftsRequest = void;
export type ListImportDraftsResponse = Models.ImportDraftListResponse;
export type ListImportDraftsQuery = void;
export type ListImportDraftsPath = void;

export type ListImportFilesRequest = void;
export type ListImportFilesResponse = Models.ImportFileListResponse;
export type ListImportFilesQuery = void;
export type ListImportFilesPath = void;

export type ListInvestmentTransactionsRequest = void;
export type ListInvestmentTransactionsResponse =
  Models.InvestmentTransactionListResponse;
export type ListInvestmentTransactionsQuery =
  Models.InvestmentTransactionListQuery;
export type ListInvestmentTransactionsPath = void;

export type ListLoanEventsRequest = void;
export type ListLoanEventsResponse = Models.LoanEventListResponse;
export type ListLoanEventsQuery = Models.LoanEventListQuery;
export type ListLoanEventsPath = { accountId: string };

export type ListLoanPortfolioSeriesRequest = void;
export type ListLoanPortfolioSeriesResponse = Models.LoanPortfolioSeriesRead;
export type ListLoanPortfolioSeriesQuery = Models.LoanPortfolioSeriesQuery;
export type ListLoanPortfolioSeriesPath = void;

export type ListRecentTransactionsRequest = void;
export type ListRecentTransactionsResponse = Models.TransactionRecentResponse;
export type ListRecentTransactionsQuery = Models.TransactionRecentQuery;
export type ListRecentTransactionsPath = void;

export type ListTaxEventsRequest = void;
export type ListTaxEventsResponse = Models.TaxEventListResponse;
export type ListTaxEventsQuery = Models.TaxEventListQuery;
export type ListTaxEventsPath = void;

export type ListTransactionsRequest = void;
export type ListTransactionsResponse = Models.TransactionListResponse;
export type ListTransactionsQuery = Models.TransactionListQuery;
export type ListTransactionsPath = void;

export type MergeCategoriesRequest = Models.MergeCategoriesRequest;
export type MergeCategoriesResponse = Models.CategoryRead;
export type MergeCategoriesQuery = void;
export type MergeCategoriesPath = void;

export type MonthlyReportRequest = void;
export type MonthlyReportResponse = Models.MonthlyReportResponse;
export type MonthlyReportQuery = Models.MonthlyReportQuery;
export type MonthlyReportPath = void;

export type NetWorthHistoryRequest = void;
export type NetWorthHistoryResponse = Models.NetWorthHistoryResponse;
export type NetWorthHistoryQuery = Models.NetWorthHistoryQuery;
export type NetWorthHistoryPath = void;

export type NetWorthProjectionRequest = void;
export type NetWorthProjectionResponse = Models.NetWorthProjectionResponse;
export type NetWorthProjectionQuery = Models.NetWorthProjectionQuery;
export type NetWorthProjectionPath = void;

export type PersistImportFilesRequest = Models.ImportPersistFilesRequest;
export type PersistImportFilesResponse = Models.ImportPersistFilesResponse;
export type PersistImportFilesQuery = void;
export type PersistImportFilesPath = { importBatchId: string };

export type PreviewImportsRequest = Models.ImportPreviewRequest;
export type PreviewImportsResponse = Models.ImportPreviewResponse;
export type PreviewImportsQuery = void;
export type PreviewImportsPath = void;

export type QuarterlyReportRequest = void;
export type QuarterlyReportResponse = Models.QuarterlyReportResponse;
export type QuarterlyReportQuery = Models.QuarterlyReportQuery;
export type QuarterlyReportPath = void;

export type ReconcileAccountRequest = Models.ReconcileAccountRequest;
export type ReconcileAccountResponse = Models.ReconcileAccountResponse;
export type ReconcileAccountQuery = void;
export type ReconcileAccountPath = { accountId: string };

export type RunTransactionsBackupRequest = void;
export type RunTransactionsBackupResponse = Models.BackupRunResponse;
export type RunTransactionsBackupQuery = void;
export type RunTransactionsBackupPath = void;

export type SaveImportDraftRequest = Models.ImportDraftSaveRequest;
export type SaveImportDraftResponse = Models.ImportDraftSaveResponse;
export type SaveImportDraftQuery = void;
export type SaveImportDraftPath = { importBatchId: string };

export type SaveSettingsRequest = Models.SettingsRequest;
export type SaveSettingsResponse = Models.SettingsResponse;
export type SaveSettingsQuery = void;
export type SaveSettingsPath = void;

export type SuggestImportCategoriesRequest =
  Models.ImportCategorySuggestRequest;
export type SuggestImportCategoriesResponse =
  Models.ImportCategorySuggestResponse;
export type SuggestImportCategoriesQuery = void;
export type SuggestImportCategoriesPath = void;

export type SuggestImportCategoriesJobRequest =
  Models.ImportCategorySuggestJobRequest;
export type SuggestImportCategoriesJobResponse =
  Models.ImportCategorySuggestJobResponse;
export type SuggestImportCategoriesJobQuery = void;
export type SuggestImportCategoriesJobPath = void;

export type TaxSummaryRequest = void;
export type TaxSummaryResponse = Models.TaxSummaryResponse;
export type TaxSummaryQuery = Models.TaxSummaryQuery;
export type TaxSummaryPath = void;

export type TaxTotalSummaryRequest = void;
export type TaxTotalSummaryResponse = Models.TaxTotalSummaryResponse;
export type TaxTotalSummaryQuery = void;
export type TaxTotalSummaryPath = void;

export type TotalOverviewRequest = void;
export type TotalOverviewResponse = Models.TotalOverviewResponse;
export type TotalOverviewQuery = Models.TotalOverviewQuery;
export type TotalOverviewPath = void;

export type TotalReportRequest = void;
export type TotalReportResponse = Models.TotalReportResponse;
export type TotalReportQuery = Models.TotalReportQuery;
export type TotalReportPath = void;

export type UpdateAccountRequest = Models.AccountUpdate;
export type UpdateAccountResponse = Models.AccountWithBalance;
export type UpdateAccountQuery = void;
export type UpdateAccountPath = { accountId: string };

export type UpdateCategoryRequest = Models.CategoryUpdate;
export type UpdateCategoryResponse = Models.CategoryRead;
export type UpdateCategoryQuery = void;
export type UpdateCategoryPath = { categoryId: string };

export type UpdateGoalRequest = Models.GoalUpdate;
export type UpdateGoalResponse = Models.GoalRead;
export type UpdateGoalQuery = void;
export type UpdateGoalPath = { goalId: string };

export type UpdateLoanRequest = Models.LoanUpdate;
export type UpdateLoanResponse = Models.LoanRead;
export type UpdateLoanQuery = void;
export type UpdateLoanPath = { accountId: string };

export type UpdateTransactionRequest = Models.TransactionUpdate;
export type UpdateTransactionResponse = Models.TransactionRead;
export type UpdateTransactionQuery = void;
export type UpdateTransactionPath = { transactionId: string };

export type WarmDatabaseRequest = void;
export type WarmDatabaseResponse = Models.WarmupResponse;
export type WarmDatabaseQuery = void;
export type WarmDatabasePath = void;

export type YearlyCategoryDetailRequest = void;
export type YearlyCategoryDetailResponse = Models.YearlyCategoryDetailResponse;
export type YearlyCategoryDetailQuery = Models.YearlyCategoryDetailQuery;
export type YearlyCategoryDetailPath = void;

export type YearlyOverviewRequest = void;
export type YearlyOverviewResponse = Models.YearlyOverviewResponse;
export type YearlyOverviewQuery = Models.YearlyOverviewQuery;
export type YearlyOverviewPath = void;

export type YearlyOverviewRangeRequest = void;
export type YearlyOverviewRangeResponse = Models.YearlyOverviewRangeResponse;
export type YearlyOverviewRangeQuery = Models.YearlyOverviewRangeQuery;
export type YearlyOverviewRangePath = void;

export type YearlyReportRequest = void;
export type YearlyReportResponse = Models.YearlyReportResponse;
export type YearlyReportQuery = Models.YearlyReportQuery;
export type YearlyReportPath = void;

export const endpoints = {
  cashflowForecast: defineEndpoint<
    CashflowForecastRequest,
    CashflowForecastResponse,
    CashflowForecastQuery,
    CashflowForecastPath
  >({
    path: "/reports/forecast/cashflow",
    method: "GET",
    handler: "apps/api/handlers/reporting.cashflow_forecast",
    auth: true,
  }),
  commitImports: defineEndpoint<
    CommitImportsRequest,
    CommitImportsResponse,
    CommitImportsQuery,
    CommitImportsPath
  >({
    path: "/imports/commit",
    method: "POST",
    handler: "apps/api/handlers/imports.commit_imports",
    auth: true,
  }),
  createAccount: defineEndpoint<
    CreateAccountRequest,
    CreateAccountResponse,
    CreateAccountQuery,
    CreateAccountPath
  >({
    path: "/accounts",
    method: "POST",
    handler: "apps/api/handlers/accounts.create_account",
    auth: true,
  }),
  createCategory: defineEndpoint<
    CreateCategoryRequest,
    CreateCategoryResponse,
    CreateCategoryQuery,
    CreateCategoryPath
  >({
    path: "/categories",
    method: "POST",
    handler: "apps/api/handlers/categories.create_category",
    auth: true,
  }),
  createGoal: defineEndpoint<
    CreateGoalRequest,
    CreateGoalResponse,
    CreateGoalQuery,
    CreateGoalPath
  >({
    path: "/goals",
    method: "POST",
    handler: "apps/api/handlers/goals.create_goal",
    auth: true,
  }),
  createInvestmentSnapshot: defineEndpoint<
    CreateInvestmentSnapshotRequest,
    CreateInvestmentSnapshotResponse,
    CreateInvestmentSnapshotQuery,
    CreateInvestmentSnapshotPath
  >({
    path: "/investments/snapshots",
    method: "POST",
    handler: "apps/api/handlers/investments.create_investment_snapshot",
    auth: true,
  }),
  createLoan: defineEndpoint<
    CreateLoanRequest,
    CreateLoanResponse,
    CreateLoanQuery,
    CreateLoanPath
  >({
    path: "/loans",
    method: "POST",
    handler: "apps/api/handlers/loans.create_loan",
    auth: true,
  }),
  createLoanActivity: defineEndpoint<
    CreateLoanActivityRequest,
    CreateLoanActivityResponse,
    CreateLoanActivityQuery,
    CreateLoanActivityPath
  >({
    path: "/loans/{accountId}/activity",
    method: "POST",
    handler: "apps/api/handlers/loans.create_loan_activity",
    auth: true,
  }),
  createTaxEvent: defineEndpoint<
    CreateTaxEventRequest,
    CreateTaxEventResponse,
    CreateTaxEventQuery,
    CreateTaxEventPath
  >({
    path: "/tax/events",
    method: "POST",
    handler: "apps/api/handlers/tax.create_tax_event",
    auth: true,
  }),
  createTransaction: defineEndpoint<
    CreateTransactionRequest,
    CreateTransactionResponse,
    CreateTransactionQuery,
    CreateTransactionPath
  >({
    path: "/transactions",
    method: "POST",
    handler: "apps/api/handlers/transactions.create_transaction",
    auth: true,
  }),
  dashboardOverview: defineEndpoint<
    DashboardOverviewRequest,
    DashboardOverviewResponse,
    DashboardOverviewQuery,
    DashboardOverviewPath
  >({
    path: "/reports/dashboard-overview",
    method: "GET",
    handler: "apps/api/handlers/reporting.dashboard_overview",
    auth: true,
  }),
  dateRangeReport: defineEndpoint<
    DateRangeReportRequest,
    DateRangeReportResponse,
    DateRangeReportQuery,
    DateRangeReportPath
  >({
    path: "/reports/custom",
    method: "GET",
    handler: "apps/api/handlers/reporting.date_range_report",
    auth: true,
  }),
  deleteGoal: defineEndpoint<
    DeleteGoalRequest,
    DeleteGoalResponse,
    DeleteGoalQuery,
    DeleteGoalPath
  >({
    path: "/goals/{goalId}",
    method: "DELETE",
    handler: "apps/api/handlers/goals.delete_goal",
    auth: true,
  }),
  deleteImportDraft: defineEndpoint<
    DeleteImportDraftRequest,
    DeleteImportDraftResponse,
    DeleteImportDraftQuery,
    DeleteImportDraftPath
  >({
    path: "/imports/{importBatchId}",
    method: "DELETE",
    handler: "apps/api/handlers/imports.delete_import_draft",
    auth: true,
  }),
  deleteTransaction: defineEndpoint<
    DeleteTransactionRequest,
    DeleteTransactionResponse,
    DeleteTransactionQuery,
    DeleteTransactionPath
  >({
    path: "/transactions/{transactionId}",
    method: "DELETE",
    handler: "apps/api/handlers/transactions.delete_transaction",
    auth: true,
  }),
  downloadImportFile: defineEndpoint<
    DownloadImportFileRequest,
    DownloadImportFileResponse,
    DownloadImportFileQuery,
    DownloadImportFilePath
  >({
    path: "/import-files/download",
    method: "POST",
    handler: "apps/api/handlers/import_files.download_import_file",
    auth: true,
  }),
  exportReport: defineEndpoint<
    ExportReportRequest,
    ExportReportResponse,
    ExportReportQuery,
    ExportReportPath
  >({
    path: "/reports/export",
    method: "POST",
    handler: "apps/api/handlers/reporting.export_report",
    auth: true,
  }),
  getImportDraft: defineEndpoint<
    GetImportDraftRequest,
    GetImportDraftResponse,
    GetImportDraftQuery,
    GetImportDraftPath
  >({
    path: "/imports/{importBatchId}",
    method: "GET",
    handler: "apps/api/handlers/imports.get_import_draft",
    auth: true,
  }),
  getLoanSchedule: defineEndpoint<
    GetLoanScheduleRequest,
    GetLoanScheduleResponse,
    GetLoanScheduleQuery,
    GetLoanSchedulePath
  >({
    path: "/loans/{accountId}/schedule",
    method: "GET",
    handler: "apps/api/handlers/loans.get_loan_schedule",
    auth: true,
  }),
  getSettings: defineEndpoint<
    GetSettingsRequest,
    GetSettingsResponse,
    GetSettingsQuery,
    GetSettingsPath
  >({
    path: "/settings",
    method: "GET",
    handler: "apps/api/handlers/settings.get_settings",
    auth: true,
  }),
  investmentOverview: defineEndpoint<
    InvestmentOverviewRequest,
    InvestmentOverviewResponse,
    InvestmentOverviewQuery,
    InvestmentOverviewPath
  >({
    path: "/investments/overview",
    method: "GET",
    handler: "apps/api/handlers/investments.investment_overview",
    auth: true,
  }),
  listAccountOptions: defineEndpoint<
    ListAccountOptionsRequest,
    ListAccountOptionsResponse,
    ListAccountOptionsQuery,
    ListAccountOptionsPath
  >({
    path: "/accounts/options",
    method: "GET",
    handler: "apps/api/handlers/accounts.list_account_options",
    auth: true,
  }),
  listAccounts: defineEndpoint<
    ListAccountsRequest,
    ListAccountsResponse,
    ListAccountsQuery,
    ListAccountsPath
  >({
    path: "/accounts",
    method: "GET",
    handler: "apps/api/handlers/accounts.list_accounts",
    auth: true,
  }),
  listCategories: defineEndpoint<
    ListCategoriesRequest,
    ListCategoriesResponse,
    ListCategoriesQuery,
    ListCategoriesPath
  >({
    path: "/categories",
    method: "GET",
    handler: "apps/api/handlers/categories.list_categories",
    auth: true,
  }),
  listCategoryOptions: defineEndpoint<
    ListCategoryOptionsRequest,
    ListCategoryOptionsResponse,
    ListCategoryOptionsQuery,
    ListCategoryOptionsPath
  >({
    path: "/categories/options",
    method: "GET",
    handler: "apps/api/handlers/categories.list_category_options",
    auth: true,
  }),
  listGoals: defineEndpoint<
    ListGoalsRequest,
    ListGoalsResponse,
    ListGoalsQuery,
    ListGoalsPath
  >({
    path: "/goals",
    method: "GET",
    handler: "apps/api/handlers/goals.list_goals",
    auth: true,
  }),
  listImportDrafts: defineEndpoint<
    ListImportDraftsRequest,
    ListImportDraftsResponse,
    ListImportDraftsQuery,
    ListImportDraftsPath
  >({
    path: "/imports/drafts",
    method: "GET",
    handler: "apps/api/handlers/imports.list_import_drafts",
    auth: true,
  }),
  listImportFiles: defineEndpoint<
    ListImportFilesRequest,
    ListImportFilesResponse,
    ListImportFilesQuery,
    ListImportFilesPath
  >({
    path: "/import-files",
    method: "GET",
    handler: "apps/api/handlers/import_files.list_import_files",
    auth: true,
  }),
  listInvestmentTransactions: defineEndpoint<
    ListInvestmentTransactionsRequest,
    ListInvestmentTransactionsResponse,
    ListInvestmentTransactionsQuery,
    ListInvestmentTransactionsPath
  >({
    path: "/investments/transactions",
    method: "GET",
    handler: "apps/api/handlers/investments.list_investment_transactions",
    auth: true,
  }),
  listLoanEvents: defineEndpoint<
    ListLoanEventsRequest,
    ListLoanEventsResponse,
    ListLoanEventsQuery,
    ListLoanEventsPath
  >({
    path: "/loans/{accountId}/events",
    method: "GET",
    handler: "apps/api/handlers/loans.list_loan_events",
    auth: true,
  }),
  listLoanPortfolioSeries: defineEndpoint<
    ListLoanPortfolioSeriesRequest,
    ListLoanPortfolioSeriesResponse,
    ListLoanPortfolioSeriesQuery,
    ListLoanPortfolioSeriesPath
  >({
    path: "/loans/events/series",
    method: "GET",
    handler: "apps/api/handlers/loans.list_loan_portfolio_series",
    auth: true,
  }),
  listRecentTransactions: defineEndpoint<
    ListRecentTransactionsRequest,
    ListRecentTransactionsResponse,
    ListRecentTransactionsQuery,
    ListRecentTransactionsPath
  >({
    path: "/transactions/recent",
    method: "GET",
    handler: "apps/api/handlers/transactions.list_recent_transactions",
    auth: true,
  }),
  listTaxEvents: defineEndpoint<
    ListTaxEventsRequest,
    ListTaxEventsResponse,
    ListTaxEventsQuery,
    ListTaxEventsPath
  >({
    path: "/tax/events",
    method: "GET",
    handler: "apps/api/handlers/tax.list_tax_events",
    auth: true,
  }),
  listTransactions: defineEndpoint<
    ListTransactionsRequest,
    ListTransactionsResponse,
    ListTransactionsQuery,
    ListTransactionsPath
  >({
    path: "/transactions",
    method: "GET",
    handler: "apps/api/handlers/transactions.list_transactions",
    auth: true,
  }),
  mergeCategories: defineEndpoint<
    MergeCategoriesRequest,
    MergeCategoriesResponse,
    MergeCategoriesQuery,
    MergeCategoriesPath
  >({
    path: "/categories/merge",
    method: "POST",
    handler: "apps/api/handlers/categories.merge_categories",
    auth: true,
  }),
  monthlyReport: defineEndpoint<
    MonthlyReportRequest,
    MonthlyReportResponse,
    MonthlyReportQuery,
    MonthlyReportPath
  >({
    path: "/reports/monthly",
    method: "GET",
    handler: "apps/api/handlers/reporting.monthly_report",
    auth: true,
  }),
  netWorthHistory: defineEndpoint<
    NetWorthHistoryRequest,
    NetWorthHistoryResponse,
    NetWorthHistoryQuery,
    NetWorthHistoryPath
  >({
    path: "/reports/net-worth",
    method: "GET",
    handler: "apps/api/handlers/reporting.net_worth_history",
    auth: true,
  }),
  netWorthProjection: defineEndpoint<
    NetWorthProjectionRequest,
    NetWorthProjectionResponse,
    NetWorthProjectionQuery,
    NetWorthProjectionPath
  >({
    path: "/reports/forecast/net-worth",
    method: "GET",
    handler: "apps/api/handlers/reporting.net_worth_projection",
    auth: true,
  }),
  persistImportFiles: defineEndpoint<
    PersistImportFilesRequest,
    PersistImportFilesResponse,
    PersistImportFilesQuery,
    PersistImportFilesPath
  >({
    path: "/imports/{importBatchId}/files",
    method: "POST",
    handler: "apps/api/handlers/imports.persist_import_files",
    auth: true,
  }),
  previewImports: defineEndpoint<
    PreviewImportsRequest,
    PreviewImportsResponse,
    PreviewImportsQuery,
    PreviewImportsPath
  >({
    path: "/imports/preview",
    method: "POST",
    handler: "apps/api/handlers/imports.preview_imports",
    auth: true,
  }),
  quarterlyReport: defineEndpoint<
    QuarterlyReportRequest,
    QuarterlyReportResponse,
    QuarterlyReportQuery,
    QuarterlyReportPath
  >({
    path: "/reports/quarterly",
    method: "GET",
    handler: "apps/api/handlers/reporting.quarterly_report",
    auth: true,
  }),
  reconcileAccount: defineEndpoint<
    ReconcileAccountRequest,
    ReconcileAccountResponse,
    ReconcileAccountQuery,
    ReconcileAccountPath
  >({
    path: "/accounts/{accountId}/reconcile",
    method: "POST",
    handler: "apps/api/handlers/accounts.reconcile_account",
    auth: true,
  }),
  runTransactionsBackup: defineEndpoint<
    RunTransactionsBackupRequest,
    RunTransactionsBackupResponse,
    RunTransactionsBackupQuery,
    RunTransactionsBackupPath
  >({
    path: "/backups/transactions",
    method: "POST",
    handler: "apps/api/handlers/backups.run_transactions_backup",
    auth: true,
  }),
  saveImportDraft: defineEndpoint<
    SaveImportDraftRequest,
    SaveImportDraftResponse,
    SaveImportDraftQuery,
    SaveImportDraftPath
  >({
    path: "/imports/{importBatchId}/draft",
    method: "POST",
    handler: "apps/api/handlers/imports.save_import_draft",
    auth: true,
  }),
  saveSettings: defineEndpoint<
    SaveSettingsRequest,
    SaveSettingsResponse,
    SaveSettingsQuery,
    SaveSettingsPath
  >({
    path: "/settings",
    method: "PUT",
    handler: "apps/api/handlers/settings.save_settings",
    auth: true,
  }),
  suggestImportCategories: defineEndpoint<
    SuggestImportCategoriesRequest,
    SuggestImportCategoriesResponse,
    SuggestImportCategoriesQuery,
    SuggestImportCategoriesPath
  >({
    path: "/imports/suggest-categories",
    method: "POST",
    handler: "apps/api/handlers/bedrock_suggestions.suggest_import_categories",
    auth: true,
  }),
  suggestImportCategoriesJob: defineEndpoint<
    SuggestImportCategoriesJobRequest,
    SuggestImportCategoriesJobResponse,
    SuggestImportCategoriesJobQuery,
    SuggestImportCategoriesJobPath
  >({
    path: "/imports/suggest-categories/jobs",
    method: "POST",
    handler:
      "apps/api/handlers/bedrock_suggestions.enqueue_import_category_suggestions",
    auth: true,
  }),
  taxSummary: defineEndpoint<
    TaxSummaryRequest,
    TaxSummaryResponse,
    TaxSummaryQuery,
    TaxSummaryPath
  >({
    path: "/tax/summary",
    method: "GET",
    handler: "apps/api/handlers/tax.tax_summary",
    auth: true,
  }),
  taxTotalSummary: defineEndpoint<
    TaxTotalSummaryRequest,
    TaxTotalSummaryResponse,
    TaxTotalSummaryQuery,
    TaxTotalSummaryPath
  >({
    path: "/tax/summary/total",
    method: "GET",
    handler: "apps/api/handlers/tax.tax_total_summary",
    auth: true,
  }),
  totalOverview: defineEndpoint<
    TotalOverviewRequest,
    TotalOverviewResponse,
    TotalOverviewQuery,
    TotalOverviewPath
  >({
    path: "/reports/total-overview",
    method: "GET",
    handler: "apps/api/handlers/reporting.total_overview",
    auth: true,
  }),
  totalReport: defineEndpoint<
    TotalReportRequest,
    TotalReportResponse,
    TotalReportQuery,
    TotalReportPath
  >({
    path: "/reports/total",
    method: "GET",
    handler: "apps/api/handlers/reporting.total_report",
    auth: true,
  }),
  updateAccount: defineEndpoint<
    UpdateAccountRequest,
    UpdateAccountResponse,
    UpdateAccountQuery,
    UpdateAccountPath
  >({
    path: "/accounts/{accountId}",
    method: "PATCH",
    handler: "apps/api/handlers/accounts.update_account",
    auth: true,
  }),
  updateCategory: defineEndpoint<
    UpdateCategoryRequest,
    UpdateCategoryResponse,
    UpdateCategoryQuery,
    UpdateCategoryPath
  >({
    path: "/categories/{categoryId}",
    method: "PATCH",
    handler: "apps/api/handlers/categories.update_category",
    auth: true,
  }),
  updateGoal: defineEndpoint<
    UpdateGoalRequest,
    UpdateGoalResponse,
    UpdateGoalQuery,
    UpdateGoalPath
  >({
    path: "/goals/{goalId}",
    method: "PATCH",
    handler: "apps/api/handlers/goals.update_goal",
    auth: true,
  }),
  updateLoan: defineEndpoint<
    UpdateLoanRequest,
    UpdateLoanResponse,
    UpdateLoanQuery,
    UpdateLoanPath
  >({
    path: "/loans/{accountId}",
    method: "PATCH",
    handler: "apps/api/handlers/loans.update_loan",
    auth: true,
  }),
  updateTransaction: defineEndpoint<
    UpdateTransactionRequest,
    UpdateTransactionResponse,
    UpdateTransactionQuery,
    UpdateTransactionPath
  >({
    path: "/transactions/{transactionId}",
    method: "PATCH",
    handler: "apps/api/handlers/transactions.update_transaction",
    auth: true,
  }),
  warmDatabase: defineEndpoint<
    WarmDatabaseRequest,
    WarmDatabaseResponse,
    WarmDatabaseQuery,
    WarmDatabasePath
  >({
    path: "/warmup",
    method: "GET",
    handler: "apps/api/handlers/warmup.warm_database",
    auth: true,
  }),
  yearlyCategoryDetail: defineEndpoint<
    YearlyCategoryDetailRequest,
    YearlyCategoryDetailResponse,
    YearlyCategoryDetailQuery,
    YearlyCategoryDetailPath
  >({
    path: "/reports/yearly-category-detail",
    method: "GET",
    handler: "apps/api/handlers/reporting.yearly_category_detail",
    auth: true,
  }),
  yearlyOverview: defineEndpoint<
    YearlyOverviewRequest,
    YearlyOverviewResponse,
    YearlyOverviewQuery,
    YearlyOverviewPath
  >({
    path: "/reports/yearly-overview",
    method: "GET",
    handler: "apps/api/handlers/reporting.yearly_overview",
    auth: true,
  }),
  yearlyOverviewRange: defineEndpoint<
    YearlyOverviewRangeRequest,
    YearlyOverviewRangeResponse,
    YearlyOverviewRangeQuery,
    YearlyOverviewRangePath
  >({
    path: "/reports/yearly-overview-range",
    method: "GET",
    handler: "apps/api/handlers/reporting.yearly_overview_range",
    auth: true,
  }),
  yearlyReport: defineEndpoint<
    YearlyReportRequest,
    YearlyReportResponse,
    YearlyReportQuery,
    YearlyReportPath
  >({
    path: "/reports/yearly",
    method: "GET",
    handler: "apps/api/handlers/reporting.yearly_report",
    auth: true,
  }),
} as const;

export type EndpointMap = typeof endpoints;
export type EndpointName = keyof EndpointMap;
export type EndpointPath = EndpointMap[EndpointName]["path"];
export type EndpointRequest<N extends EndpointName> = NonNullable<
  EndpointMap[N]["__types"]
>["request"];
export type EndpointResponse<N extends EndpointName> = NonNullable<
  EndpointMap[N]["__types"]
>["response"];
export type EndpointQuery<N extends EndpointName> = NonNullable<
  EndpointMap[N]["__types"]
>["query"];
export type EndpointPathParams<N extends EndpointName> = NonNullable<
  EndpointMap[N]["__types"]
>["path"];
