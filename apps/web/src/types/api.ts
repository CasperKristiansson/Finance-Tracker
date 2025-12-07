import type {
  AccountType,
  BankImportType,
  BudgetPeriod,
  CategoryType,
  InterestCompound,
  TransactionStatus,
  TransactionType,
} from "./enums";

export * from "./enums";
export type {
  AccountListResponse,
  AccountRead,
  AccountWithBalance,
  BudgetListResponse,
  BudgetProgress,
  BudgetProgressListResponse,
  BudgetRead,
  CashflowForecastPoint,
  CashflowForecastResponse,
  CategoryListResponse,
  CategoryRead,
  GoalListResponse,
  GoalRead,
  ImportBatch,
  ImportError,
  ImportFileRead,
  ImportListResponse,
  ImportRowRead,
  ImportSession,
  ImportSessionResponse,
  InvestmentHoldingRead,
  InvestmentMetricsResponse,
  InvestmentPerformance,
  InvestmentSnapshot,
  InvestmentSnapshotListResponse,
  InvestmentSnapshotResponse,
  InvestmentTransactionListResponse,
  InvestmentTransactionRead,
  LoanEventRead,
  LoanRead,
  LoanScheduleEntry,
  LoanScheduleRead,
  MonthlyReportEntry,
  NetWorthHistoryResponse,
  NetWorthPoint,
  NetWorthProjectionPoint,
  NetWorthProjectionResponse,
  NordnetParseResponse,
  QuarterlyReportEntry,
  SettingsPayload,
  SettingsResponse,
  SubscriptionListResponse,
  SubscriptionRead,
  SubscriptionSummaryRead,
  SubscriptionSummaryResponse,
  TotalReportRead,
  TransactionLegRead,
  TransactionListResponse,
  TransactionRead,
  WarmupResponse,
  YearlyReportEntry,
} from "./schemas";

export interface NordnetParseRequest {
  raw_text: string;
  manual_payload?: Record<string, unknown>;
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

export interface AccountCreateRequest {
  name: string;
  account_type: AccountType;
  is_active?: boolean;
  icon?: string | null;
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
  name?: string;
  is_active?: boolean;
  icon?: string | null;
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

export interface ImportFileUpload {
  filename: string;
  content_base64: string;
  account_id?: string;
  bank_type: BankImportType;
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

export interface GoalCreateRequest {
  name: string;
  target_amount: string;
  target_date?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  subscription_id?: string | null;
  note?: string | null;
}

export type GoalUpdateRequest = Partial<GoalCreateRequest>;
