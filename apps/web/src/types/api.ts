export enum AccountType {
  NORMAL = "normal",
  DEBT = "debt",
  INVESTMENT = "investment",
}

export enum CategoryType {
  INCOME = "income",
  EXPENSE = "expense",
  ADJUSTMENT = "adjustment",
  LOAN = "loan",
  INTEREST = "interest",
}

export enum TransactionType {
  INCOME = "income",
  EXPENSE = "expense",
  TRANSFER = "transfer",
  ADJUSTMENT = "adjustment",
  INVESTMENT_EVENT = "investment_event",
}

export enum TransactionStatus {
  RECORDED = "recorded",
  IMPORTED = "imported",
  REVIEWED = "reviewed",
  FLAGGED = "flagged",
}

export enum BudgetPeriod {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  YEARLY = "yearly",
}

export enum InterestCompound {
  DAILY = "daily",
  MONTHLY = "monthly",
  YEARLY = "yearly",
}

export enum LoanEventType {
  DISBURSEMENT = "disbursement",
  PAYMENT_PRINCIPAL = "payment_principal",
  PAYMENT_INTEREST = "payment_interest",
  INTEREST_ACCRUAL = "interest_accrual",
  FEE = "fee",
}

export interface InvestmentSnapshot {
  id: string;
  provider: string;
  report_type?: string | null;
  account_name?: string | null;
  snapshot_date: string;
  portfolio_value?: string | number | null;
  raw_text: string;
  parsed_payload: Record<string, unknown>;
  cleaned_payload?: Record<string, unknown> | null;
  bedrock_metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  holdings?: InvestmentHoldingRead[] | null;
}

export interface InvestmentSnapshotResponse {
  snapshot: InvestmentSnapshot;
}

export interface InvestmentSnapshotListResponse {
  snapshots: InvestmentSnapshot[];
}

export interface NordnetParseRequest {
  raw_text: string;
  manual_payload?: Record<string, unknown>;
}

export interface NordnetParseResponse {
  report_type?: string | null;
  snapshot_date?: string | null;
  portfolio_value?: number | string | null;
  parsed_payload: Record<string, unknown>;
}

export interface NordnetSnapshotCreateRequest {
  raw_text: string;
  parsed_payload?: Record<string, unknown>;
  manual_payload?: Record<string, unknown>;
  snapshot_date?: string;
  account_name?: string | null;
  report_type?: string | null;
  portfolio_value?: number | string | null;
  use_bedrock?: boolean;
  bedrock_model_id?: string | null;
  bedrock_max_tokens?: number | null;
}

export interface InvestmentHoldingRead {
  id: string;
  snapshot_id: string;
  snapshot_date: string;
  account_name?: string | null;
  name: string;
  isin?: string | null;
  holding_type?: string | null;
  currency?: string | null;
  quantity?: string | number | null;
  price?: string | number | null;
  value_sek?: string | number | null;
  notes?: string | null;
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

export interface AccountRead {
  id: string;
  display_order?: number | null;
  account_type: AccountType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  loan?: LoanRead | null;
}

export interface AccountWithBalance extends AccountRead {
  balance: string;
}

export interface AccountCreateRequest {
  display_order?: number | null;
  account_type: AccountType;
  is_active?: boolean;
  loan?: {
    origin_principal: string;
    current_principal: string;
    interest_rate_annual: string;
    interest_compound: InterestCompound;
    minimum_payment?: string | null;
    expected_maturity_date?: string | null;
  } | null;
}

export interface AccountUpdateRequest {
  display_order?: number | null;
  is_active?: boolean;
}

export interface CategoryRead {
  id: string;
  name: string;
  category_type: CategoryType;
  color_hex?: string | null;
  icon?: string | null;
  is_archived: boolean;
}

export interface CategoryCreateRequest {
  name: string;
  category_type: CategoryType;
  color_hex?: string | null;
  icon?: string | null;
}

export interface CategoryUpdateRequest {
  name?: string;
  category_type?: CategoryType;
  color_hex?: string | null;
  icon?: string | null;
  is_archived?: boolean;
}

export interface TransactionLegRead {
  id: string;
  account_id: string;
  amount: string;
}

export interface TransactionLegCreate {
  account_id: string;
  amount: string;
}

export interface TransactionCreate {
  category_id?: string | null;
  subscription_id?: string | null;
  description?: string | null;
  notes?: string | null;
  external_id?: string | null;
  occurred_at: string;
  posted_at?: string | null;
  transaction_type?: TransactionType;
  status?: TransactionStatus;
  legs: TransactionLegCreate[];
}

export interface TransactionUpdateRequest {
  description?: string | null;
  notes?: string | null;
  occurred_at?: string;
  posted_at?: string;
  category_id?: string | null;
  subscription_id?: string | null;
  status?: TransactionStatus;
}

export interface TransactionRead {
  id: string;
  category_id?: string | null;
  subscription_id?: string | null;
  transaction_type: TransactionType;
  description?: string | null;
  notes?: string | null;
  external_id?: string | null;
  occurred_at: string;
  posted_at: string;
  created_at: string;
  updated_at: string;
  status: TransactionStatus;
  legs: TransactionLegRead[];
}

export interface MonthlyReportEntry {
  period: string;
  income: string;
  expense: string;
  net: string;
}

export interface YearlyReportEntry {
  year: number;
  income: string;
  expense: string;
  net: string;
}

export interface QuarterlyReportEntry {
  year: number;
  quarter: number;
  income: string;
  expense: string;
  net: string;
}

export interface TotalReportRead {
  income: string;
  expense: string;
  net: string;
  generated_at?: string;
}

export interface NetWorthPoint {
  period: string;
  net_worth: string;
}

export interface NetWorthHistoryResponse {
  points: NetWorthPoint[];
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

export interface LoanScheduleEntry {
  period: number;
  due_date: string;
  payment_amount: string;
  interest_amount: string;
  principal_amount: string;
  remaining_principal: string;
}

export interface LoanScheduleRead {
  account_id: string;
  loan_id: string;
  generated_at: string;
  as_of_date: string;
  schedule: LoanScheduleEntry[];
}

export interface LoanCreateRequest {
  account_id: string;
  origin_principal: string;
  current_principal: string;
  interest_rate_annual: string;
  interest_compound: InterestCompound;
  minimum_payment?: string | null;
  expected_maturity_date?: string | null;
}

export interface LoanUpdateRequest {
  origin_principal?: string;
  current_principal?: string;
  interest_rate_annual?: string;
  interest_compound?: InterestCompound;
  minimum_payment?: string | null;
  expected_maturity_date?: string | null;
}

export interface ImportError {
  row_number: number;
  message: string;
}

export interface ImportFileRead {
  id: string;
  filename: string;
  account_id?: string;
  row_count: number;
  error_count: number;
  status: string;
  template_id?: string;
  preview_rows?: Record<string, unknown>[];
  errors?: ImportError[];
}

export interface ImportRowRead {
  id: string;
  file_id: string;
  row_index: number;
  data: Record<string, unknown>;
  suggested_category?: string | null;
  suggested_confidence?: number | null;
  suggested_reason?: string | null;
  suggested_subscription_id?: string | null;
  suggested_subscription_name?: string | null;
  suggested_subscription_confidence?: number | null;
  suggested_subscription_reason?: string | null;
  transfer_match?: Record<string, string> | null;
}

export interface ImportBatch {
  id: string;
  source_name?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
  file_count: number;
  total_rows: number;
  total_errors: number;
  status: string;
  files?: ImportFileRead[];
}

export interface ImportListResponse {
  imports: ImportBatch[];
}

export interface ImportSession extends ImportBatch {
  rows: ImportRowRead[];
}

export interface ImportSessionResponse {
  import_session: ImportSession;
}

export interface ImportFileUpload {
  filename: string;
  content_base64: string;
  account_id?: string;
  template_id?: string;
}

export interface ImportExampleTransaction {
  description: string;
  amount: string;
  category_hint: string;
}

export interface ImportCreateRequest {
  files: ImportFileUpload[];
  note?: string;
  examples?: ImportExampleTransaction[];
}

export interface ImportCommitRow {
  row_id: string;
  category_id?: string | null;
  account_id?: string | null;
  description?: string | null;
  amount?: string | null;
  occurred_at?: string | null;
  subscription_id?: string | null;
  delete?: boolean;
}

export interface ImportCommitRequest {
  rows: ImportCommitRow[];
}

export interface SubscriptionRead {
  id: string;
  name: string;
  matcher_text: string;
  matcher_amount_tolerance?: string | null;
  matcher_day_of_month?: number | null;
  category_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionListResponse {
  subscriptions: SubscriptionRead[];
}

export interface SubscriptionSummaryRead extends SubscriptionRead {
  current_month_spend: string | number;
  trailing_three_month_spend: string | number;
  trailing_twelve_month_spend: string | number;
  trend: Array<string | number>;
  last_charge_at?: string | null;
  category_name?: string | null;
}

export interface SubscriptionSummaryResponse {
  subscriptions: SubscriptionSummaryRead[];
}

export interface AccountListResponse {
  accounts: AccountWithBalance[];
}

export interface CategoryListResponse {
  categories: CategoryRead[];
}

export interface TransactionListResponse {
  transactions: TransactionRead[];
  running_balances: Record<string, string>;
}

export interface BudgetRead {
  id: string;
  category_id: string;
  period: BudgetPeriod;
  amount: string;
  note?: string | null;
}

export interface BudgetProgress extends BudgetRead {
  spent: string;
  remaining: string;
  percent_used: string;
}

export interface BudgetListResponse {
  budgets: BudgetRead[];
}

export interface BudgetProgressListResponse {
  budgets: BudgetProgress[];
}

export interface BudgetCreateRequest {
  category_id: string;
  period: BudgetPeriod;
  amount: string;
  note?: string | null;
}

export interface BudgetUpdateRequest {
  period?: BudgetPeriod;
  amount?: string;
  note?: string | null;
}

export type ThemePreference = "light" | "dark" | "system";

export interface BankTemplateMapping {
  date: string;
  description: string;
  amount: string;
}

export interface BankTemplateSetting {
  id: string;
  name: string;
  description?: string | null;
  mapping: BankTemplateMapping;
  is_default?: boolean;
}

export interface SettingsPayload {
  theme?: ThemePreference;
  bank_templates?: BankTemplateSetting[];
}

export interface SettingsResponse {
  settings: SettingsPayload;
}

export type WarmupStatus = "ready" | "starting" | "error";

export interface WarmupResponse {
  status: WarmupStatus;
  message?: string;
}
