export * from "./enums";
import type * as Models from "./generated/contracts/models";

export type AccountListResponse = Models.ListAccountsResponse;
export type AccountRead = Models.AccountWithBalance;
export type AccountWithBalance = Models.AccountWithBalance;
export type AccountCreateRequest = Models.AccountCreate;
export type AccountUpdateRequest = Models.AccountUpdate;
export type CashflowForecastPoint = Models.CashflowForecastPoint;
export type CashflowForecastResponse = Models.CashflowForecastResponse;
export type CategoryListResponse = Models.CategoryListResponse;
export type CategoryRead = Models.CategoryRead;
export type CategoryCreateRequest = Models.CategoryCreate;
export type CategoryUpdateRequest = Models.CategoryUpdate;
export type GoalListResponse = Models.GoalListResponse;
export type GoalRead = Models.GoalRead;
export type GoalCreateRequest = Models.GoalCreate;
export type GoalUpdateRequest = Models.GoalUpdate;
export type ImportError = Models.ImportErrorRead;
export type ImportPreviewRequest = Models.ImportPreviewRequest;
export type ImportPreviewFileRead = Omit<
  Models.ImportPreviewFileRead,
  "preview_rows"
> & {
  preview_rows?: Array<Record<string, unknown>>;
};
export type ImportPreviewRowRead = Omit<
  Models.ImportPreviewRowRead,
  "transfer_match" | "draft"
> & {
  transfer_match?: Record<string, unknown> | null;
  draft?: Record<string, unknown> | null;
};
export type ImportPreviewResponse = Omit<
  Models.ImportPreviewResponse,
  "files" | "rows"
> & {
  files: ImportPreviewFileRead[];
  rows: ImportPreviewRowRead[];
};
export type ImportCommitRow = Models.ImportCommitRow;
export type ImportCommitRequest = Models.ImportCommitRequest;
export type ImportCommitResponse = Models.ImportCommitResponse;
export type ImportCategoryHistoryItem = Models.ImportCategoryHistoryItem;
export type ImportCategoryOption = Models.ImportCategoryOption;
export type ImportCategorySuggestRequest = Models.ImportCategorySuggestRequest;
export type ImportCategorySuggestJobRequest =
  Models.ImportCategorySuggestJobRequest;
export type ImportCategorySuggestResponse =
  Models.ImportCategorySuggestResponse;
export type ImportCategorySuggestJobResponse =
  Models.ImportCategorySuggestJobResponse;
export type ImportCategorySuggestTransaction =
  Models.ImportCategorySuggestTransaction;
export type ImportCategorySuggestionRead = Models.ImportCategorySuggestionRead;
export type ImportFileDownloadResponse = Models.ImportFileDownloadResponse;
export type ImportFileListResponse = Models.ImportFileListResponse;
export type ImportFileRead = Models.ImportFileRead;
export type ImportDraftListResponse = Models.ImportDraftListResponse;
export type ImportDraftRead = Models.ImportDraftRead;
export type ImportDraftSaveRequest = Omit<
  Models.ImportDraftSaveRequest,
  "snapshot"
> & {
  snapshot?: ImportPreviewResponse | null;
};
export type ImportDraftSaveResponse = Models.ImportDraftSaveResponse;
export type TaxEventRead = Models.TaxEventRead;
export type TaxEventCreateRequest = Models.TaxEventCreateRequest;
export type TaxEventCreateResponse = Models.TaxEventCreateResponse;
export type TaxEventListItem = Models.TaxEventListItem;
export type TaxEventListResponse = Models.TaxEventListResponse;
export type TaxSummaryResponse = Models.TaxSummaryResponse;
export type TaxTotalSummaryResponse = Models.TaxTotalSummaryResponse;
export type InvestmentOverviewResponse = Models.InvestmentOverviewResponse;
export type InvestmentPortfolioOverview =
  Models.InvestmentPortfolioOverviewRead;
export type InvestmentAccountOverview = Models.InvestmentAccountOverviewRead;
export type InvestmentCashflowEvent = Models.InvestmentCashflowEventRead;
export type InvestmentCashflowSummary = Models.InvestmentCashflowSummaryRead;
export type InvestmentGrowth = Models.InvestmentGrowthRead;
export type InvestmentValuePoint = Models.InvestmentValuePointRead;
export type InvestmentSnapshotCreateRequest =
  Models.InvestmentSnapshotCreateRequest;
export type InvestmentSnapshotCreateResponse =
  Models.InvestmentSnapshotCreateResponse;
export type InvestmentTransactionListResponse =
  Models.InvestmentTransactionListResponse;
export type InvestmentTransactionRead = Models.InvestmentTransactionRead;
export type LoanEventRead = Models.LoanEventRead;
export type LoanPortfolioSeriesPoint = Models.LoanPortfolioSeriesPoint;
export type LoanPortfolioSeriesResponse = Models.LoanPortfolioSeriesRead;
export type LoanCreateRequest = Models.LoanCreateRequest;
export type LoanRead = Models.LoanRead;
export type LoanUpdateRequest = Models.LoanUpdate;
export type LoanScheduleEntry = Models.LoanScheduleEntry;
export type LoanScheduleRead = Models.LoanScheduleRead;
export type MonthlyReportEntry = Models.MonthlyReportEntry;
export type NetWorthHistoryResponse = Models.NetWorthHistoryResponse;
export type NetWorthPoint = Models.NetWorthPoint;
export type NetWorthProjectionPoint = Models.NetWorthProjectionPoint;
export type NetWorthProjectionResponse = Models.NetWorthProjectionResponse;
export type QuarterlyReportEntry = Models.QuarterlyReportEntry;
export type BackupRunResponse = Models.BackupRunResponse;
export type SettingsPayload = Models.SettingsPayload;
export type SettingsResponse = Models.SettingsResponse;
export type TotalReportRead = Models.TotalReportResponse;
export type TotalOverviewResponse = Models.TotalOverviewResponse;
export type TransactionLegRead = Models.TransactionLegRead;
export type TransactionListResponse = Models.TransactionListResponse;
export type TransactionRead = Models.TransactionRead;
export type TransactionLegCreate = Models.TransactionLegCreate;
export type TransactionCreate = Models.TransactionCreate;
export type TransactionUpdateRequest = Models.TransactionUpdate;
export type WarmupResponse = Models.WarmupResponse;
export type YearlyCategoryDetailResponse = Models.YearlyCategoryDetailResponse;
export type YearlyOverviewResponse = Models.YearlyOverviewResponse;
export type YearlyReportEntry = Models.YearlyReportEntry;

// Legacy demo-only aliases until investment snapshot read models are generated.
export type InvestmentHoldingRead = {
  id: string;
  snapshot_id: string;
  snapshot_date: string;
  account_name: string;
  name: string;
  isin?: string | null;
  holding_type: string;
  currency?: string | null;
  quantity?: number | string | null;
  price?: string | null;
  value_sek: string;
  notes?: string | null;
};

export type InvestmentSnapshot = {
  id: string;
  provider: string;
  report_type: string;
  account_name: string;
  snapshot_date: string;
  portfolio_value: string;
  raw_text?: string | null;
  parsed_payload?: unknown;
  cleaned_payload?: unknown;
  bedrock_metadata?: unknown;
  created_at: string;
  updated_at: string;
  holdings: InvestmentHoldingRead[];
};
