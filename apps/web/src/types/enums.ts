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

export enum TaxEventType {
  PAYMENT = "payment",
  REFUND = "refund",
}

export type BankImportType = "circle_k_mastercard" | "seb" | "swedbank";

export type ThemePreference = "light" | "dark" | "system";

export type WarmupStatus = "ready" | "starting" | "error";
