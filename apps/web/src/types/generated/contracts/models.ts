// THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.
// Run: python3 scripts/generate_api_contract_types.py

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type AccountType = "normal" | "debt" | "investment";

export type BankImportType = "circle_k_mastercard" | "seb" | "swedbank";

export type CategoryType =
  | "income"
  | "expense"
  | "adjustment"
  | "loan"
  | "interest";

export type InterestCompound = "daily" | "monthly" | "yearly";

export type LoanEventType =
  | "disbursement"
  | "payment_principal"
  | "payment_interest"
  | "interest_accrual"
  | "fee";

export type TaxEventType = "payment" | "refund";

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "adjustment"
  | "investment_event";

export interface AccountCreate {
  name?: string | null;
  account_type: AccountType;
  is_active?: boolean;
  icon?: string | null;
  bank_import_type?: BankImportType | null;
  loan?: LoanCreate | null;
}

export interface AccountFlowEntry {
  account_id: string;
  name: string;
  account_type: AccountType;
  start_balance: string;
  end_balance: string;
  change: string;
  income: string;
  expense: string;
  transfers_in: string;
  transfers_out: string;
  net_operating: string;
  net_transfers: string;
  monthly_income: string[];
  monthly_expense: string[];
  monthly_transfers_in: string[];
  monthly_transfers_out: string[];
  monthly_change: string[];
}

export interface AccountOptionRead {
  id: string;
  name: string;
  account_type: AccountType;
  is_active: boolean;
  icon?: string | null;
  bank_import_type?: BankImportType | null;
}

export interface AccountUpdate {
  name?: string | null;
  is_active?: boolean | null;
  icon?: string | null;
  bank_import_type?: BankImportType | null;
}

export interface AccountWithBalance {
  id: string;
  name: string;
  account_type: AccountType;
  is_active: boolean;
  icon?: string | null;
  bank_import_type?: BankImportType | null;
  created_at: string;
  updated_at: string;
  loan?: LoanRead | null;
  balance: string;
  last_reconciled_at?: string | null;
  reconciliation_gap?: string | null;
  needs_reconciliation?: boolean | null;
}

export interface BackupRunResponse {
  bucket: string;
  manifest_key: string;
  tables: BackupTableRead[];
}

export interface BackupTableRead {
  table: string;
  row_count: number;
  s3_key: string;
}

export interface BiggestMonthEntry {
  month: number;
  amount: string;
}

export interface CashflowForecastPoint {
  date: string;
  balance: string;
  delta?: string | null;
  low?: string | null;
  high?: string | null;
  baseline?: string | null;
  weekday_component?: string | null;
  monthday_component?: string | null;
}

export interface CashflowForecastQuery {
  days?: number;
  threshold?: string;
  lookback_days?: number;
  model?: string;
  account_ids?: string[] | null;
}

export interface CashflowForecastResponse {
  starting_balance: string;
  average_daily: string;
  threshold: string;
  alert_below_threshold_at?: string | null;
  points: CashflowForecastPoint[];
  model?: string | null;
  lookback_days?: number | null;
  residual_std?: string | null;
  weekday_averages?: string[] | null;
  monthday_averages?: (string | null)[] | null;
}

export interface CategoryChangeEntry {
  category_id?: string | null;
  name: string;
  amount: string;
  prev_amount: string;
  delta: string;
  delta_pct?: string | null;
}

export interface CategoryCreate {
  name: string;
  category_type: CategoryType;
  color_hex?: string | null;
  icon?: string | null;
}

export interface CategoryListResponse {
  categories: CategoryRead[];
}

export interface CategoryMonthlyPoint {
  period: string;
  total: string;
}

export interface CategoryOptionRead {
  id: string;
  name: string;
  category_type: CategoryType;
  color_hex?: string | null;
  icon?: string | null;
  is_archived: boolean;
}

export interface CategoryOptionsResponse {
  options: CategoryOptionRead[];
}

export interface CategoryRead {
  id: string;
  name: string;
  category_type: CategoryType;
  color_hex?: string | null;
  icon?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  transaction_count?: number;
  last_used_at?: string | null;
  lifetime_total?: string;
  recent_months?: CategoryMonthlyPoint[];
}

export interface CategoryTotalEntry {
  category_id?: string | null;
  name: string;
  total: string;
  icon?: string | null;
  color_hex?: string | null;
  transaction_count: number;
}

export interface CategoryUpdate {
  name?: string | null;
  category_type?: CategoryType | null;
  color_hex?: string | null;
  icon?: string | null;
  is_archived?: boolean | null;
}

export interface CategoryYearHeatmap {
  years: number[];
  rows: CategoryYearHeatmapRow[];
}

export interface CategoryYearHeatmapRow {
  category_id?: string | null;
  name: string;
  icon?: string | null;
  color_hex?: string | null;
  totals: string[];
}

export interface DashboardOverviewQuery {
  year?: number | null;
  account_ids?: string[] | null;
}

export interface DashboardOverviewResponse {
  year: number;
  monthly: MonthlyReportEntry[];
  total: TotalReportRead;
  net_worth: NetWorthPoint[];
}

export interface DateRangeReportQuery {
  start_date: string;
  end_date: string;
  account_ids?: string[] | null;
  category_ids?: string[] | null;
  source?: string | null;
}

export interface DateRangeReportResponse {
  results: MonthlyReportEntry[];
}

export interface DebtOverviewEntry {
  account_id: string;
  name: string;
  start_debt: string;
  end_debt: string;
  delta: string;
  monthly_debt: string[];
}

export interface DebtSeriesPoint {
  date: string;
  debt: string;
}

export interface ExportReportRequest {
  granularity: string;
  format?: string;
  year?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  account_ids?: unknown | null;
  category_ids?: unknown | null;
}

export interface ExportReportResponse {
  filename: string;
  content_type: string;
  data_base64: string;
}

export interface GoalCreate {
  name: string;
  target_amount: string;
  target_date?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  note?: string | null;
}

export interface GoalListResponse {
  goals: GoalRead[];
}

export interface GoalRead {
  id: string;
  name: string;
  target_amount: string;
  target_date?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
  current_amount: string;
  progress_pct: number;
  achieved_at?: string | null;
  achieved_delta_days?: number | null;
}

export interface GoalUpdate {
  name?: string | null;
  target_amount?: string | null;
  target_date?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  note?: string | null;
}

export interface ImportCategoryHistoryItem {
  description: string;
  category_id: string;
}

export interface ImportCategoryOption {
  id: string;
  name: string;
  category_type: string;
}

export interface ImportCategorySuggestJobRequest {
  categories: ImportCategoryOption[];
  history?: ImportCategoryHistoryItem[];
  transactions: ImportCategorySuggestTransaction[];
  model_id?: string | null;
  max_tokens?: number | null;
  import_batch_id?: string | null;
  client_id: string;
  client_token: string;
}

export interface ImportCategorySuggestJobResponse {
  job_id: string;
}

export interface ImportCategorySuggestRequest {
  categories: ImportCategoryOption[];
  history?: ImportCategoryHistoryItem[];
  transactions: ImportCategorySuggestTransaction[];
  model_id?: string | null;
  max_tokens?: number | null;
}

export interface ImportCategorySuggestResponse {
  suggestions: ImportCategorySuggestionRead[];
}

export interface ImportCategorySuggestTransaction {
  id: string;
  description: string;
  amount?: string | null;
  occurred_at?: string | null;
}

export interface ImportCategorySuggestionRead {
  id: string;
  category_id?: string | null;
  confidence: number;
  reason?: string | null;
}

export interface ImportCommitFile {
  id: string;
  filename: string;
  account_id: string;
  row_count: number;
  error_count: number;
  bank_import_type?: BankImportType | null;
  content_base64: string;
  content_type?: string | null;
}

export interface ImportCommitRequest {
  import_batch_id?: string | null;
  note?: string | null;
  rows: ImportCommitRow[];
  files?: ImportCommitFile[] | null;
}

export interface ImportCommitResponse {
  import_batch_id: string;
  transaction_ids: string[];
}

export interface ImportCommitRow {
  id: string;
  file_id?: string | null;
  account_id: string;
  occurred_at: string;
  amount: string;
  description: string;
  category_id?: string | null;
  transfer_account_id?: string | null;
  tax_event_type?: TaxEventType | null;
  delete?: boolean;
}

export interface ImportDraftDeleteResponse {
  import_batch_id: string;
  deleted: boolean;
}

export interface ImportDraftListResponse {
  drafts: ImportDraftRead[];
}

export interface ImportDraftRead {
  import_batch_id: string;
  note?: string | null;
  created_at: string;
  updated_at: string;
  file_count: number;
  row_count: number;
  error_count: number;
  file_names?: string[];
}

export interface ImportDraftSaveRequest {
  rows: ImportCommitRow[];
  snapshot?: ImportPreviewResponse | null;
  note?: string | null;
}

export interface ImportDraftSaveResponse {
  import_batch_id: string;
  updated_at: string;
}

export interface ImportErrorRead {
  row_number: number;
  message: string;
}

export interface ImportFileDownloadRequest {
  file_id: string;
}

export interface ImportFileDownloadResponse {
  url: string;
}

export interface ImportFileListResponse {
  files: ImportFileRead[];
}

export interface ImportFileRead {
  id: string;
  filename: string;
  account_id?: string | null;
  account_name?: string | null;
  bank_import_type?: BankImportType | null;
  row_count: number;
  error_count: number;
  transaction_ids?: string[];
  import_batch_id: string;
  size_bytes?: number | null;
  content_type?: string | null;
  uploaded_at: string;
  status: string;
}

export interface ImportPreviewAccountContextRead {
  account_id: string;
  recent_transactions?: ImportRelatedTransactionRead[];
  similar_transactions?: ImportRelatedTransactionRead[];
  similar_by_row?: ImportPreviewRowSimilarMatchRead[];
}

export interface ImportPreviewFile {
  filename: string;
  content_base64: string;
  account_id: string;
}

export interface ImportPreviewFileRead {
  id: string;
  filename: string;
  account_id: string;
  bank_import_type?: BankImportType | null;
  row_count: number;
  error_count: number;
  errors?: ImportErrorRead[];
  preview_rows?: Record<string, JsonValue>[];
}

export interface ImportPreviewRequest {
  files: ImportPreviewFile[];
  note?: string | null;
}

export interface ImportPreviewResponse {
  import_batch_id: string;
  suggestions_status?: "not_started" | "running" | "completed" | "failed";
  files: ImportPreviewFileRead[];
  rows: ImportPreviewRowRead[];
  accounts?: ImportPreviewAccountContextRead[];
}

export interface ImportPreviewRowRead {
  id: string;
  file_id: string;
  row_index: number;
  account_id: string;
  occurred_at: string;
  amount: string;
  description: string;
  suggested_category_id?: string | null;
  suggested_category_name?: string | null;
  suggested_confidence?: number | null;
  suggested_reason?: string | null;
  transfer_match?: Record<string, JsonValue> | null;
  rule_applied?: boolean;
  rule_type?: string | null;
  rule_summary?: string | null;
  draft?: Record<string, JsonValue> | null;
}

export interface ImportPreviewRowSimilarMatchRead {
  row_id: string;
  transaction_ids?: string[];
}

export interface ImportRelatedTransactionRead {
  id: string;
  account_id: string;
  occurred_at: string;
  description: string;
  category_id?: string | null;
  category_name?: string | null;
}

export interface InvestmentAccountOverviewRead {
  account_id: string;
  name: string;
  icon?: string | null;
  start_date?: string | null;
  as_of?: string | null;
  current_value: string;
  series?: InvestmentValuePointRead[];
  cashflow_12m_added: string;
  cashflow_12m_withdrawn: string;
  cashflow_since_start_added: string;
  cashflow_since_start_withdrawn: string;
  cashflow_since_start_net: string;
  growth_12m_ex_transfers: InvestmentGrowthRead;
  growth_since_start_ex_transfers: InvestmentGrowthRead;
}

export interface InvestmentAccountSummaryEntry {
  account_name: string;
  start_value: string;
  end_value: string;
  change: string;
}

export interface InvestmentAccountValueEntry {
  account_name: string;
  value: string;
}

export interface InvestmentCashflowEventRead {
  occurred_at: string;
  account_id: string;
  account_name: string;
  direction: "deposit" | "withdrawal";
  amount_sek: string;
  description?: string | null;
  transaction_id: string;
}

export interface InvestmentCashflowPointRead {
  period: string;
  added: string;
  withdrawn: string;
  net: string;
}

export interface InvestmentCashflowSummaryRead {
  added_30d: string;
  withdrawn_30d: string;
  net_30d: string;
  added_ytd: string;
  withdrawn_ytd: string;
  net_ytd: string;
  added_12m: string;
  withdrawn_12m: string;
  net_12m: string;
  added_since_start: string;
  withdrawn_since_start: string;
  net_since_start: string;
}

export interface InvestmentGrowthRead {
  amount: string;
  pct?: number | null;
}

export interface InvestmentOverviewResponse {
  portfolio: InvestmentPortfolioOverviewRead;
  accounts: InvestmentAccountOverviewRead[];
  recent_cashflows?: InvestmentCashflowEventRead[];
}

export interface InvestmentPortfolioOverviewRead {
  start_date?: string | null;
  as_of?: string | null;
  current_value: string;
  series?: InvestmentValuePointRead[];
  cashflow_series?: InvestmentCashflowPointRead[];
  cashflow: InvestmentCashflowSummaryRead;
  growth_12m_ex_transfers: InvestmentGrowthRead;
  growth_since_start_ex_transfers: InvestmentGrowthRead;
}

export interface InvestmentSeriesPoint {
  date: string;
  value: string;
}

export interface InvestmentSnapshotCreateRequest {
  account_id: string;
  snapshot_date: string;
  balance: string;
  notes?: string | null;
}

export interface InvestmentSnapshotCreateResponse {
  snapshot_id: string;
  account_id: string;
  snapshot_date: string;
  balance: string;
}

export interface InvestmentTransactionListQuery {
  start?: string | null;
  end?: string | null;
  holding?: string | null;
  account_name?: string | null;
  type?: string | null;
  limit?: number | null;
  offset?: number;
}

export interface InvestmentTransactionListResponse {
  transactions: InvestmentTransactionRead[];
  limit?: number | null;
  offset?: number;
  has_more?: boolean;
  next_offset?: number | null;
}

export interface InvestmentTransactionRead {
  id: string;
  snapshot_id?: string | null;
  occurred_at: string;
  transaction_type: string;
  description?: string | null;
  holding_name?: string | null;
  isin?: string | null;
  account_name?: string | null;
  quantity?: string | null;
  amount_sek: string;
  currency?: string | null;
  fee_sek?: string | null;
  notes?: string | null;
}

export interface InvestmentValuePointRead {
  date: string;
  value: string;
}

export interface InvestmentYearEntry {
  year: number;
  end_value: string;
  contributions: string;
  withdrawals: string;
  net_contributions: string;
  implied_return?: string | null;
}

export interface InvestmentsSummary {
  as_of: string;
  start_value: string;
  end_value: string;
  change: string;
  change_pct?: string | null;
  contributions: string;
  withdrawals: string;
  net_contributions: string;
  monthly_values: string[];
  accounts: InvestmentAccountSummaryEntry[];
}

export interface LargestTransactionEntry {
  id: string;
  occurred_at: string;
  merchant: string;
  amount: string;
  category_id?: string | null;
  category_name: string;
  notes?: string | null;
}

export interface ListAccountOptionsQuery {
  include_inactive?: boolean;
}

export interface ListAccountOptionsResponse {
  options: AccountOptionRead[];
}

export interface ListAccountsQuery {
  include_inactive?: boolean;
  as_of_date?: string | null;
}

export interface ListAccountsResponse {
  accounts: AccountWithBalance[];
}

export interface ListCategoriesQuery {
  include_archived?: boolean;
  include_special?: boolean;
}

export interface ListCategoryOptionsQuery {
  include_archived?: boolean;
  include_special?: boolean;
}

export interface LoanActivityCreateRequest {
  kind: string;
  funding_account_id: string;
  amount: string;
  occurred_at: string;
  description?: string | null;
  sync_principal?: boolean;
}

export interface LoanActivityCreateResponse {
  account_id: string;
  loan_id: string;
  transaction_id: string;
  amount: string;
  kind: string;
  current_principal: string;
}

export interface LoanCreate {
  origin_principal: string;
  current_principal: string;
  interest_rate_annual: string;
  interest_compound: InterestCompound;
  minimum_payment?: string | null;
  expected_maturity_date?: string | null;
}

export interface LoanCreateRequest {
  origin_principal: string;
  current_principal: string;
  interest_rate_annual: string;
  interest_compound: InterestCompound;
  minimum_payment?: string | null;
  expected_maturity_date?: string | null;
  account_id: string;
}

export interface LoanEventListQuery {
  limit?: number;
  offset?: number;
}

export interface LoanEventListResponse {
  events: LoanEventRead[];
}

export interface LoanEventRead {
  id: string;
  loan_id: string;
  transaction_id: string;
  transaction_leg_id?: string | null;
  event_type: LoanEventType;
  amount: string;
  occurred_at: string;
}

export interface LoanPortfolioSeriesPoint {
  date: string;
  total: string;
}

export interface LoanPortfolioSeriesQuery {
  start_date?: string | null;
  end_date?: string | null;
}

export interface LoanPortfolioSeriesRead {
  series: LoanPortfolioSeriesPoint[];
}

export interface LoanRead {
  id: string;
  account_id: string;
  origin_principal: string;
  current_principal: string;
  interest_rate_annual: string;
  interest_compound: InterestCompound;
  minimum_payment?: string | null;
  expected_maturity_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanScheduleEntry {
  period: number;
  due_date: string;
  payment_amount: string;
  interest_amount: string;
  principal_amount: string;
  remaining_principal: string;
}

export interface LoanScheduleQuery {
  as_of_date?: string | null;
  periods?: number;
}

export interface LoanScheduleRead {
  account_id: string;
  loan_id: string;
  generated_at: string;
  as_of_date: string;
  schedule: LoanScheduleEntry[];
}

export interface LoanUpdate {
  origin_principal?: string | null;
  current_principal?: string | null;
  interest_rate_annual?: string | null;
  interest_compound?: InterestCompound | null;
  minimum_payment?: string | null;
  expected_maturity_date?: string | null;
}

export interface MerchantSummaryEntry {
  merchant: string;
  amount: string;
  transaction_count: number;
}

export interface MergeCategoriesRequest {
  source_category_id: string;
  target_category_id: string;
  rename_target_to?: string | null;
}

export interface MonthlyIncomeExpensePoint {
  date: string;
  income: string;
  expense: string;
}

export interface MonthlyReportEntry {
  period: string;
  income: string;
  expense: string;
  adjustment_inflow: string;
  adjustment_outflow: string;
  adjustment_net: string;
  net: string;
}

export interface MonthlyReportQuery {
  year?: number | null;
  account_ids?: string[] | null;
  category_ids?: string[] | null;
}

export interface MonthlyReportResponse {
  results: MonthlyReportEntry[];
}

export interface NetWorthHistoryQuery {
  account_ids?: string[] | null;
}

export interface NetWorthHistoryResponse {
  points: NetWorthPoint[];
}

export interface NetWorthPoint {
  period: string;
  net_worth: string;
}

export interface NetWorthProjectionPoint {
  date: string;
  net_worth: string;
  low?: string | null;
  high?: string | null;
}

export interface NetWorthProjectionQuery {
  months?: number;
  account_ids?: string[] | null;
}

export interface NetWorthProjectionResponse {
  current: string;
  cagr?: string | null;
  points: NetWorthProjectionPoint[];
  recommended_method?: string | null;
  methods?: Record<string, NetWorthProjectionPoint[]> | null;
  insights?: string[] | null;
}

export interface NetWorthSeriesPoint {
  date: string;
  net_worth: string;
}

export interface QuarterlyReportEntry {
  year: number;
  quarter: number;
  income: string;
  expense: string;
  adjustment_inflow: string;
  adjustment_outflow: string;
  adjustment_net: string;
  net: string;
}

export interface QuarterlyReportQuery {
  year?: number | null;
  account_ids?: string[] | null;
  category_ids?: string[] | null;
}

export interface QuarterlyReportResponse {
  results: QuarterlyReportEntry[];
}

export interface ReconcileAccountRequest {
  captured_at: string;
  reported_balance: string;
  description?: string | null;
  category_id?: string | null;
}

export interface ReconcileAccountResponse {
  account_id: string;
  reported_balance: string;
  ledger_balance: string;
  delta_posted: string;
  snapshot_id: string;
  transaction_id?: string | null;
  captured_at: string;
}

export interface SavingsIndicator {
  income: string;
  expense: string;
  saved: string;
  savings_rate_pct?: string | null;
}

export interface SettingsPayload {
  first_name?: string | null;
  last_name?: string | null;
}

export interface SettingsRequest {
  settings: SettingsPayload;
}

export interface SettingsResponse {
  settings: SettingsPayload;
}

export interface SourceChangeEntry {
  source: string;
  amount: string;
  prev_amount: string;
  delta: string;
  delta_pct?: string | null;
}

export interface SourceSummaryEntry {
  source: string;
  total: string;
  monthly: string[];
  transaction_count: number;
}

export interface SourceTotalEntry {
  source: string;
  total: string;
  transaction_count: number;
}

export interface TaxEventCreateRequest {
  account_id: string;
  occurred_at: string;
  posted_at?: string | null;
  amount: string;
  event_type: TaxEventType;
  description: string;
  authority?: string | null;
  note?: string | null;
}

export interface TaxEventCreateResponse {
  tax_event: TaxEventRead;
  transaction?: Record<string, JsonValue>;
}

export interface TaxEventListItem {
  id: string;
  transaction_id: string;
  occurred_at: string;
  description?: string | null;
  event_type: TaxEventType;
  authority?: string | null;
  note?: string | null;
  account_id: string;
  account_name?: string | null;
  amount: string;
}

export interface TaxEventListQuery {
  start_date?: string | null;
  end_date?: string | null;
  limit?: number;
  offset?: number;
}

export interface TaxEventListResponse {
  events: TaxEventListItem[];
  limit?: number;
  offset?: number;
  has_more?: boolean;
  next_offset?: number | null;
}

export interface TaxEventRead {
  id: string;
  transaction_id: string;
  event_type: TaxEventType;
  authority?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxSummaryMonthlyEntry {
  month: number;
  net_tax_paid: string;
}

export interface TaxSummaryQuery {
  year?: number | null;
}

export interface TaxSummaryResponse {
  year: number;
  monthly: TaxSummaryMonthlyEntry[];
  totals: TaxSummaryTotals;
}

export interface TaxSummaryTotals {
  net_tax_paid_ytd: string;
  net_tax_paid_last_12m: string;
  largest_month?: number | null;
  largest_month_value?: string | null;
}

export interface TaxTotalSummaryResponse {
  yearly: TaxTotalYearlyEntry[];
  totals: TaxTotalSummaryTotals;
}

export interface TaxTotalSummaryTotals {
  total_payments: string;
  total_refunds: string;
  net_tax_paid_all_time: string;
  net_tax_paid_ytd: string;
  net_tax_paid_last_12m: string;
  largest_year?: number | null;
  largest_year_value?: string | null;
}

export interface TaxTotalYearlyEntry {
  year: number;
  payments: string;
  refunds: string;
  net_tax_paid: string;
}

export interface TotalAccountOverviewEntry {
  account_id: string;
  name: string;
  account_type: AccountType;
  current_balance: string;
  operating_income: string;
  operating_expense: string;
  net_operating: string;
  transfers_in: string;
  transfers_out: string;
  net_transfers: string;
  first_transaction_date?: string | null;
}

export interface TotalDebtAccountEntry {
  account_id: string;
  name: string;
  current_debt: string;
  prev_year_end_debt?: string | null;
  delta?: string | null;
}

export interface TotalDebtOverview {
  total_current: string;
  total_prev_year_end?: string | null;
  change_since_prev_year_end?: string | null;
  debt_to_income_latest_year?: string | null;
  series: DebtSeriesPoint[];
  accounts: TotalDebtAccountEntry[];
}

export interface TotalInvestmentsOverview {
  series: InvestmentSeriesPoint[];
  yearly: InvestmentYearEntry[];
  contributions_lifetime: string;
  withdrawals_lifetime: string;
  net_contributions_lifetime: string;
  accounts_latest: InvestmentAccountValueEntry[];
}

export interface TotalOverviewKpis {
  net_worth: string;
  cash_balance: string;
  debt_total: string;
  investments_value?: string | null;
  lifetime_income: string;
  lifetime_expense: string;
  lifetime_saved: string;
  lifetime_savings_rate_pct?: string | null;
}

export interface TotalOverviewQuery {
  account_ids?: string[] | null;
}

export interface TotalOverviewResponse {
  as_of: string;
  kpis: TotalOverviewKpis;
  net_worth_series: NetWorthSeriesPoint[];
  monthly_income_expense: MonthlyIncomeExpensePoint[];
  yearly: TotalYearEntry[];
  best_year?: number | null;
  worst_year?: number | null;
  expense_categories_lifetime: CategoryTotalEntry[];
  income_categories_lifetime: CategoryTotalEntry[];
  expense_category_mix_by_year: YearCategoryMixEntry[];
  income_category_mix_by_year: YearCategoryMixEntry[];
  expense_category_heatmap_by_year: CategoryYearHeatmap;
  income_category_heatmap_by_year: CategoryYearHeatmap;
  expense_category_changes_yoy: CategoryChangeEntry[];
  income_category_changes_yoy: CategoryChangeEntry[];
  income_sources_lifetime: SourceTotalEntry[];
  expense_sources_lifetime: SourceTotalEntry[];
  income_source_changes_yoy: SourceChangeEntry[];
  expense_source_changes_yoy: SourceChangeEntry[];
  accounts: TotalAccountOverviewEntry[];
  investments?: TotalInvestmentsOverview | null;
  debt: TotalDebtOverview;
  insights: string[];
}

export interface TotalReportQuery {
  account_ids?: string[] | null;
  category_ids?: string[] | null;
}

export interface TotalReportRead {
  income: string;
  expense: string;
  adjustment_inflow: string;
  adjustment_outflow: string;
  adjustment_net: string;
  net: string;
}

export interface TotalReportResponse {
  income: string;
  expense: string;
  adjustment_inflow: string;
  adjustment_outflow: string;
  adjustment_net: string;
  net: string;
  generated_at: string;
}

export interface TotalYearEntry {
  year: number;
  income: string;
  expense: string;
  net: string;
  savings_rate_pct?: string | null;
}

export interface TransactionCreate {
  category_id?: string | null;
  description?: string | null;
  notes?: string | null;
  external_id?: string | null;
  occurred_at: string;
  posted_at?: string | null;
  transaction_type?: TransactionType;
  legs: TransactionLegCreate[];
}

export interface TransactionLegCreate {
  account_id: string;
  amount: string;
}

export interface TransactionLegRead {
  id: string;
  account_id: string;
  amount: string;
}

export interface TransactionListQuery {
  start_date?: string | null;
  end_date?: string | null;
  account_ids?: string[] | null;
  category_ids?: string[] | null;
  transaction_type?: TransactionType[] | null;
  tax_event?: boolean | null;
  min_amount?: string | null;
  max_amount?: string | null;
  search?: string | null;
  sort_by?: "occurred_at" | "amount" | "description" | "category" | "type";
  sort_dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
  include_running_balances?: boolean;
  include_tax_event?: boolean;
  view?: "full" | "summary";
}

export interface TransactionListResponse {
  transactions: (TransactionRead | TransactionSummaryRead)[];
  running_balances?: Record<string, string> | null;
}

export interface TransactionRead {
  id: string;
  category_id?: string | null;
  transaction_type: TransactionType;
  description?: string | null;
  notes?: string | null;
  external_id?: string | null;
  occurred_at: string;
  posted_at: string;
  created_at: string;
  updated_at: string;
  tax_event?: TaxEventRead | null;
  legs: TransactionLegRead[];
}

export interface TransactionRecentQuery {
  account_ids?: string[] | null;
  transaction_type?: TransactionType[] | null;
  include_tax_event?: boolean;
  limit?: number;
}

export interface TransactionRecentResponse {
  transactions: TransactionSummaryRead[];
}

export interface TransactionSummaryRead {
  id: string;
  category_id?: string | null;
  transaction_type: TransactionType;
  description?: string | null;
  notes?: string | null;
  occurred_at: string;
  posted_at: string;
  tax_event?: TaxEventRead | null;
  legs: TransactionLegRead[];
}

export interface TransactionUpdate {
  description?: string | null;
  notes?: string | null;
  occurred_at?: string | null;
  posted_at?: string | null;
  category_id?: string | null;
}

export interface WarmupResponse {
  status: "ready" | "starting" | "error";
  message?: string | null;
}

export interface YearCategoryMixEntry {
  year: number;
  categories: CategoryTotalEntry[];
}

export interface YearlyCategoryBreakdownEntry {
  category_id?: string | null;
  name: string;
  total: string;
  monthly: string[];
  icon?: string | null;
  color_hex?: string | null;
  transaction_count: number;
}

export interface YearlyCategoryDetailQuery {
  year: number;
  category_id: string;
  flow?: string;
  account_ids?: string[] | null;
}

export interface YearlyCategoryDetailResponse {
  year: number;
  category_id: string;
  category_name: string;
  monthly: YearlyCategoryMonthlyEntry[];
  top_merchants: MerchantSummaryEntry[];
}

export interface YearlyCategoryMonthlyEntry {
  date: string;
  month: number;
  amount: string;
}

export interface YearlyOverviewMonthEntry {
  date: string;
  month: number;
  income: string;
  expense: string;
  net: string;
}

export interface YearlyOverviewQuery {
  year: number;
  account_ids?: string[] | null;
}

export interface YearlyOverviewRangeQuery {
  start_year: number;
  end_year: number;
  account_ids?: string[] | null;
}

export interface YearlyOverviewRangeResponse {
  start_year: number;
  end_year: number;
  items: YearlyOverviewResponse[];
}

export interface YearlyOverviewResponse {
  year: number;
  monthly: YearlyOverviewMonthEntry[];
  net_worth: NetWorthSeriesPoint[];
  debt: DebtSeriesPoint[];
  savings: SavingsIndicator;
  stats: YearlyOverviewStats;
  category_breakdown: YearlyCategoryBreakdownEntry[];
  income_category_breakdown: YearlyCategoryBreakdownEntry[];
  top_merchants: MerchantSummaryEntry[];
  largest_transactions: LargestTransactionEntry[];
  category_changes: CategoryChangeEntry[];
  investments_summary: InvestmentsSummary;
  debt_overview: DebtOverviewEntry[];
  account_flows: AccountFlowEntry[];
  income_sources: SourceSummaryEntry[];
  expense_sources: SourceSummaryEntry[];
  insights: string[];
}

export interface YearlyOverviewStats {
  total_income: string;
  total_expense: string;
  net_savings: string;
  savings_rate_pct?: string | null;
  avg_monthly_spend: string;
  biggest_income_month: BiggestMonthEntry;
  biggest_expense_month: BiggestMonthEntry;
}

export interface YearlyReportEntry {
  year: number;
  income: string;
  expense: string;
  adjustment_inflow: string;
  adjustment_outflow: string;
  adjustment_net: string;
  net: string;
}

export interface YearlyReportQuery {
  account_ids?: string[] | null;
  category_ids?: string[] | null;
}

export interface YearlyReportResponse {
  results: YearlyReportEntry[];
}
