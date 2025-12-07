import { z } from "zod";
import {
  AccountType,
  BudgetPeriod,
  CategoryType,
  InterestCompound,
  TransactionStatus,
  TransactionType,
} from "./api";

const money = z.union([z.string(), z.number()]);
const optionalMoney = money.optional();
const nullableString = z.string().nullable().optional();
const dateString = z.string(); // keep loose to match API

export const loanSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  origin_principal: z.string(),
  current_principal: z.string(),
  interest_rate_annual: z.string(),
  interest_compound: z.nativeEnum(InterestCompound),
  minimum_payment: z.string().nullable().optional(),
  expected_maturity_date: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  account_type: z.nativeEnum(AccountType),
  is_active: z.boolean(),
  icon: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  balance: z.string().optional(),
  loan: loanSchema.nullable().optional(),
  last_reconciled_at: z.string().nullable().optional(),
  reconciliation_gap: z.string().nullable().optional(),
  needs_reconciliation: z.boolean().nullable().optional(),
});

export const accountListSchema = z.object({
  accounts: z.array(accountSchema),
});

export type AccountSchema = z.infer<typeof accountSchema>;
export type AccountListSchema = z.infer<typeof accountListSchema>;

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  category_type: z.nativeEnum(CategoryType),
  color_hex: nullableString,
  icon: nullableString,
  is_archived: z.boolean(),
});

export const categoryListSchema = z.object({
  categories: z.array(categorySchema),
});

export const budgetSchema = z.object({
  id: z.string(),
  category_id: z.string(),
  period: z.nativeEnum(BudgetPeriod),
  amount: z.string(),
  note: nullableString,
});

export const budgetProgressSchema = budgetSchema.extend({
  spent: z.string(),
  remaining: z.string(),
  percent_used: z.string(),
});

export const budgetProgressListSchema = z.object({
  budgets: z.array(budgetProgressSchema),
});

const transactionLegSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  amount: z.string(),
});

export const transactionSchema = z.object({
  id: z.string(),
  category_id: nullableString,
  subscription_id: nullableString,
  transaction_type: z.nativeEnum(TransactionType),
  description: nullableString,
  notes: nullableString,
  external_id: nullableString,
  occurred_at: dateString,
  posted_at: dateString,
  created_at: dateString,
  updated_at: dateString,
  status: z.nativeEnum(TransactionStatus),
  legs: z.array(transactionLegSchema),
});

export const transactionListSchema = z.object({
  transactions: z.array(transactionSchema),
  running_balances: z.record(z.string(), z.string()).optional(),
});

export const monthlyReportSchema = z.object({
  results: z.array(
    z.object({
      period: z.string(),
      income: z.string(),
      expense: z.string(),
      net: z.string(),
    }),
  ),
});

export const yearlyReportSchema = z.object({
  results: z.array(
    z.object({
      year: z.number(),
      income: z.string(),
      expense: z.string(),
      net: z.string(),
    }),
  ),
});

export const quarterlyReportSchema = z.object({
  results: z.array(
    z.object({
      year: z.number(),
      quarter: z.number(),
      income: z.string(),
      expense: z.string(),
      net: z.string(),
    }),
  ),
});

export const totalReportSchema = z.object({
  income: z.string(),
  expense: z.string(),
  net: z.string(),
  generated_at: z.string().optional(),
});

export const netWorthHistorySchema = z.object({
  points: z.array(
    z.object({
      period: z.string(),
      net_worth: z.string(),
    }),
  ),
});

export const subscriptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  matcher_text: z.string(),
  matcher_amount_tolerance: z.number().nullable().optional(),
  matcher_day_of_month: z.number().nullable().optional(),
  category_id: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const subscriptionSummarySchema = subscriptionSchema.extend({
  current_month_spend: optionalMoney,
  trailing_three_month_spend: optionalMoney,
  trailing_twelve_month_spend: optionalMoney,
  trend: z.array(money),
  last_charge_at: z.string().nullable().optional(),
  category_name: z.string().nullable().optional(),
});

export const subscriptionSummaryResponseSchema = z.object({
  subscriptions: z.array(subscriptionSummarySchema),
});
