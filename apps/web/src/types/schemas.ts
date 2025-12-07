import { z } from "zod";
import {
  AccountType,
  BudgetPeriod,
  CategoryType,
  InterestCompound,
  TransactionStatus,
  TransactionType,
} from "./api";

const money = z.union([z.coerce.number(), z.string()]);
const optionalMoney = money.optional();
const nullableMoney = money.nullable().optional();
const nullableString = z.string().nullable().optional();
const dateString = z.string(); // keep loose to match API
const numeric = z.coerce.number();
const optionalNumeric = numeric.optional();

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

export const subscriptionListSchema = z.object({
  subscriptions: z.array(subscriptionSchema),
});

const bankImportTypeSchema = z.enum([
  "circle_k_mastercard",
  "seb",
  "swedbank",
] as const);

export const importErrorSchema = z.object({
  row_number: numeric,
  message: z.string(),
});

export const importFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  account_id: z.string().optional(),
  row_count: numeric,
  error_count: numeric,
  status: z.string(),
  bank_type: bankImportTypeSchema,
  preview_rows: z.array(z.record(z.string(), z.unknown())).optional(),
  errors: z.array(importErrorSchema).optional(),
});

export const importRowSchema = z
  .object({
    id: z.string(),
    file_id: z.string(),
    row_index: numeric,
    data: z.record(z.string(), z.unknown()),
    suggested_category: nullableString,
    suggested_confidence: optionalNumeric.nullable(),
    suggested_reason: nullableString,
    suggested_subscription_id: nullableString,
    suggested_subscription_name: nullableString,
    suggested_subscription_confidence: optionalNumeric.nullable(),
    suggested_subscription_reason: nullableString,
    transfer_match: z.record(z.string(), z.string()).nullable().optional(),
    rule_applied: z.boolean().nullable().optional(),
    rule_type: nullableString,
    rule_summary: nullableString,
  })
  .passthrough();

export const importBatchSchema = z.object({
  id: z.string(),
  source_name: nullableString,
  note: nullableString,
  created_at: z.string(),
  updated_at: z.string(),
  file_count: numeric,
  total_rows: numeric,
  total_errors: numeric,
  status: z.string(),
  files: z.array(importFileSchema).optional(),
});

export const importSessionSchema = importBatchSchema.extend({
  rows: z.array(importRowSchema),
});

export const importListResponseSchema = z.object({
  imports: z.array(importBatchSchema),
});

export const importSessionResponseSchema = z.object({
  import_session: importSessionSchema,
});

export const investmentHoldingSchema = z
  .object({
    id: z.string(),
    snapshot_id: z.string(),
    snapshot_date: z.string(),
    account_name: nullableString,
    name: z.string(),
    isin: nullableString,
    holding_type: nullableString,
    currency: nullableString,
    quantity: nullableMoney,
    price: nullableMoney,
    value_sek: nullableMoney,
    notes: nullableString,
  })
  .passthrough();

export const investmentSnapshotSchema = z.object({
  id: z.string(),
  provider: z.string(),
  report_type: nullableString,
  account_name: nullableString,
  snapshot_date: z.string(),
  portfolio_value: nullableMoney,
  raw_text: z.string(),
  parsed_payload: z.record(z.string(), z.unknown()),
  cleaned_payload: z.record(z.string(), z.unknown()).nullable().optional(),
  bedrock_metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  holdings: z.array(investmentHoldingSchema).nullable().optional(),
});

export const investmentSnapshotResponseSchema = z.object({
  snapshot: investmentSnapshotSchema,
});

export const investmentSnapshotListResponseSchema = z.object({
  snapshots: z.array(investmentSnapshotSchema),
});

export const investmentTransactionSchema = z
  .object({
    id: z.string(),
    occurred_at: z.string(),
    description: nullableString,
    account_name: nullableString,
    asset: nullableString,
    amount: money,
    transaction_type: nullableString,
    holding_name: nullableString,
    amount_sek: nullableMoney,
  })
  .passthrough();

export const investmentTransactionListSchema = z.object({
  transactions: z.array(investmentTransactionSchema),
});

export const investmentPerformanceSchema = z.object({
  portfolio_value: nullableMoney,
  change_absolute: nullableMoney,
  change_percent: nullableMoney,
  by_asset: z
    .union([
      z.array(z.record(z.string(), z.unknown())),
      z.record(z.string(), z.unknown()),
    ])
    .optional(),
  timeseries: z.array(z.record(z.string(), z.unknown())).optional(),
  total_value: nullableMoney,
  invested: nullableMoney,
  realized_pl: nullableMoney,
  unrealized_pl: nullableMoney,
  twr: nullableMoney,
  irr: nullableMoney,
  benchmark_change_pct: nullableMoney,
});

export const investmentMetricsResponseSchema = z.object({
  performance: investmentPerformanceSchema.optional(),
  snapshots: z.array(investmentSnapshotSchema).optional(),
  holdings: z.array(investmentHoldingSchema).optional(),
  transactions: z.array(investmentTransactionSchema).optional(),
});

export const nordnetParseResponseSchema = z.object({
  report_type: nullableString,
  snapshot_date: nullableString,
  portfolio_value: nullableMoney,
  parsed_payload: z.record(z.string(), z.unknown()),
});

export const goalSchema = z.object({
  id: z.string(),
  name: z.string(),
  target_amount: money,
  target_date: nullableString,
  category_id: nullableString,
  account_id: nullableString,
  subscription_id: nullableString,
  note: nullableString,
  created_at: z.string(),
  updated_at: z.string(),
  current_amount: money,
  progress_pct: numeric,
});

export const goalListSchema = z.object({
  goals: z.array(goalSchema),
});

export const settingsPayloadSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  first_name: nullableString,
  last_name: nullableString,
});

export const settingsResponseSchema = z.object({
  settings: settingsPayloadSchema,
});

export const warmupResponseSchema = z.object({
  status: z.enum(["ready", "starting", "error"]),
  message: nullableString,
});

const cashflowForecastPointSchema = z.object({
  date: z.string(),
  balance: money,
});

export const cashflowForecastResponseSchema = z.object({
  starting_balance: money,
  average_daily: money,
  threshold: money,
  alert_below_threshold_at: nullableString,
  points: z.array(cashflowForecastPointSchema),
});

const netWorthProjectionPointSchema = z.object({
  date: z.string(),
  net_worth: money,
});

export const netWorthProjectionResponseSchema = z.object({
  current: money,
  cagr: nullableMoney,
  points: z.array(netWorthProjectionPointSchema),
});
