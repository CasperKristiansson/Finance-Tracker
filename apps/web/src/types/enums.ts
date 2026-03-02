/* eslint-disable no-redeclare */

export const AccountType = {
  NORMAL: "normal",
  DEBT: "debt",
  INVESTMENT: "investment",
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const CategoryType = {
  INCOME: "income",
  EXPENSE: "expense",
  ADJUSTMENT: "adjustment",
  LOAN: "loan",
  INTEREST: "interest",
} as const;
export type CategoryType = (typeof CategoryType)[keyof typeof CategoryType];

export const TransactionType = {
  INCOME: "income",
  EXPENSE: "expense",
  TRANSFER: "transfer",
  ADJUSTMENT: "adjustment",
  INVESTMENT_EVENT: "investment_event",
} as const;
export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const InterestCompound = {
  DAILY: "daily",
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;
export type InterestCompound =
  (typeof InterestCompound)[keyof typeof InterestCompound];

export const LoanEventType = {
  DISBURSEMENT: "disbursement",
  PAYMENT_PRINCIPAL: "payment_principal",
  PAYMENT_INTEREST: "payment_interest",
  INTEREST_ACCRUAL: "interest_accrual",
  FEE: "fee",
} as const;
export type LoanEventType = (typeof LoanEventType)[keyof typeof LoanEventType];

export const TaxEventType = {
  PAYMENT: "payment",
  REFUND: "refund",
} as const;
export type TaxEventType = (typeof TaxEventType)[keyof typeof TaxEventType];

export type BankImportType = "circle_k_mastercard" | "seb" | "swedbank";

export type ThemePreference = "light" | "dark" | "system";

export type WarmupStatus = "ready" | "starting" | "error";
