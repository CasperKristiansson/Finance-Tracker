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

export interface CategoryRead {
  id: string;
  name: string;
  category_type: CategoryType;
  color_hex?: string | null;
  is_archived: boolean;
}

export interface TransactionLegRead {
  id: string;
  account_id: string;
  amount: string;
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

export interface ImportJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  file_name?: string;
  error_message?: string | null;
  created_at?: string;
  completed_at?: string | null;
}

export interface AccountListResponse {
  accounts: AccountWithBalance[];
}

export interface CategoryListResponse {
  categories: CategoryRead[];
}

export interface TransactionListResponse {
  transactions: TransactionRead[];
}
