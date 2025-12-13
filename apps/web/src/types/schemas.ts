import { z } from "zod";
import {
  AccountType,
  BudgetPeriod,
  CategoryType,
  InterestCompound,
  LoanEventType,
  TransactionStatus,
  TransactionType,
} from "./enums";

export const money = z.union([z.coerce.number(), z.string()]);
export const optionalMoney = money.optional();
export const nullableMoney = money.nullable().optional();
export const nullableString = z.string().nullable().optional();
export const dateString = z.string(); // keep loose to match API
export const numeric = z.coerce.number();
export const optionalNumeric = numeric.optional();
export const nullableNumeric = numeric.nullable().optional();

export const loanCreateRequestSchema = z.object({
  account_id: z.string(),
  origin_principal: z.string(),
  current_principal: z.string(),
  interest_rate_annual: z.string(),
  interest_compound: z.nativeEnum(InterestCompound),
  minimum_payment: z.string().nullable().optional(),
  expected_maturity_date: z.string().nullable().optional(),
});

export const loanUpdateRequestSchema = z.object({
  origin_principal: z.string().optional(),
  current_principal: z.string().optional(),
  interest_rate_annual: z.string().optional(),
  interest_compound: z.nativeEnum(InterestCompound).optional(),
  minimum_payment: z.string().nullable().optional(),
  expected_maturity_date: z.string().nullable().optional(),
});

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

export const accountCreateRequestSchema = z.object({
  name: z.string(),
  account_type: z.nativeEnum(AccountType),
  is_active: z.boolean().optional(),
  icon: z.string().nullable().optional(),
  loan: loanCreateRequestSchema
    .omit({ account_id: true })
    .nullable()
    .optional(),
});

export const accountUpdateRequestSchema = z.object({
  name: z.string().optional(),
  is_active: z.boolean().optional(),
  icon: z.string().nullable().optional(),
});

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  account_type: z.nativeEnum(AccountType),
  is_active: z.boolean(),
  icon: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  loan: loanSchema.nullable().optional(),
});

export const accountWithBalanceSchema = accountSchema.extend({
  balance: z.string(),
  last_reconciled_at: z.string().nullable().optional(),
  reconciliation_gap: z.string().nullable().optional(),
  needs_reconciliation: z.boolean().nullable().optional(),
});

export const accountListSchema = z.object({
  accounts: z.array(accountWithBalanceSchema),
});

export const reconcileAccountRequestSchema = z.object({
  captured_at: dateString,
  reported_balance: z.string(),
  description: z.string().optional(),
  category_id: z.string().nullable().optional(),
});

export const reconcileAccountResponseSchema = z.object({
  account_id: z.string(),
  reported_balance: z.string(),
  ledger_balance: z.string(),
  delta_posted: z.string(),
  snapshot_id: z.string(),
  transaction_id: z.string().nullable().optional(),
  captured_at: dateString,
});

export const loanScheduleEntrySchema = z.object({
  period: numeric,
  due_date: dateString,
  payment_amount: z.string(),
  interest_amount: z.string(),
  principal_amount: z.string(),
  remaining_principal: z.string(),
});

export const loanScheduleSchema = z.object({
  account_id: z.string(),
  loan_id: z.string(),
  generated_at: dateString,
  as_of_date: dateString,
  schedule: z.array(loanScheduleEntrySchema),
});

export const loanEventSchema = z.object({
  id: z.string(),
  loan_id: z.string(),
  transaction_id: z.string(),
  transaction_leg_id: z.string().nullable().optional(),
  event_type: z.nativeEnum(LoanEventType),
  amount: z.string(),
  occurred_at: dateString,
});

export const loanEventsResponseSchema = z.object({
  events: z.array(loanEventSchema),
});

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  category_type: z.nativeEnum(CategoryType),
  color_hex: nullableString,
  icon: nullableString,
  is_archived: z.boolean(),
});

export const categoryCreateRequestSchema = z.object({
  name: z.string(),
  category_type: z.nativeEnum(CategoryType),
  color_hex: nullableString,
  icon: nullableString,
});

export const categoryUpdateRequestSchema = z.object({
  name: z.string().optional(),
  category_type: z.nativeEnum(CategoryType).optional(),
  color_hex: nullableString,
  icon: nullableString,
  is_archived: z.boolean().optional(),
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

export const budgetListSchema = z.object({
  budgets: z.array(budgetSchema),
});

export const budgetCreateRequestSchema = z.object({
  category_id: z.string(),
  period: z.nativeEnum(BudgetPeriod),
  amount: z.string(),
  note: nullableString,
});

export const budgetUpdateRequestSchema = z.object({
  period: z.nativeEnum(BudgetPeriod).optional(),
  amount: z.string().optional(),
  note: nullableString,
});

export const transactionLegSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  amount: z.string(),
});

export const transactionLegCreateSchema = transactionLegSchema.omit({
  id: true,
});

export const transactionCreateSchema = z.object({
  category_id: nullableString,
  subscription_id: nullableString,
  description: nullableString,
  notes: nullableString,
  external_id: nullableString,
  occurred_at: dateString,
  posted_at: z.string().nullable().optional(),
  transaction_type: z.nativeEnum(TransactionType).optional(),
  status: z.nativeEnum(TransactionStatus).optional(),
  legs: z.array(transactionLegCreateSchema),
});

export const transactionUpdateRequestSchema = z.object({
  description: nullableString,
  notes: nullableString,
  occurred_at: dateString.optional(),
  posted_at: z.string().nullable().optional(),
  category_id: nullableString,
  subscription_id: nullableString,
  status: z.nativeEnum(TransactionStatus).optional(),
});

export const transactionStatusUpdateSchema = z.object({
  status: z.nativeEnum(TransactionStatus),
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
  running_balances: z.record(z.string(), z.string()).default({}),
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

export const totalOverviewSchema = z.object({
  as_of: z.string(),
  kpis: z.object({
    net_worth: z.string(),
    cash_balance: z.string(),
    debt_total: z.string(),
    investments_value: z.string().nullable().optional(),
    lifetime_income: z.string(),
    lifetime_expense: z.string(),
    lifetime_saved: z.string(),
    lifetime_savings_rate_pct: z.string().nullable().optional(),
  }),
  net_worth_series: z.array(
    z.object({
      date: z.string(),
      net_worth: z.string(),
    }),
  ),
  yearly: z.array(
    z.object({
      year: z.number(),
      income: z.string(),
      expense: z.string(),
      net: z.string(),
      savings_rate_pct: z.string().nullable().optional(),
    }),
  ),
  best_year: z.number().nullable().optional(),
  worst_year: z.number().nullable().optional(),
  expense_categories_lifetime: z.array(
    z.object({
      category_id: z.string().nullable().optional(),
      name: z.string(),
      total: z.string(),
      icon: z.string().nullable().optional(),
      color_hex: z.string().nullable().optional(),
      transaction_count: z.number(),
    }),
  ),
  income_categories_lifetime: z.array(
    z.object({
      category_id: z.string().nullable().optional(),
      name: z.string(),
      total: z.string(),
      icon: z.string().nullable().optional(),
      color_hex: z.string().nullable().optional(),
      transaction_count: z.number(),
    }),
  ),
  expense_category_mix_by_year: z.array(
    z.object({
      year: z.number(),
      categories: z.array(
        z.object({
          category_id: z.string().nullable().optional(),
          name: z.string(),
          total: z.string(),
          icon: z.string().nullable().optional(),
          color_hex: z.string().nullable().optional(),
          transaction_count: z.number(),
        }),
      ),
    }),
  ),
  income_category_mix_by_year: z.array(
    z.object({
      year: z.number(),
      categories: z.array(
        z.object({
          category_id: z.string().nullable().optional(),
          name: z.string(),
          total: z.string(),
          icon: z.string().nullable().optional(),
          color_hex: z.string().nullable().optional(),
          transaction_count: z.number(),
        }),
      ),
    }),
  ),
  expense_category_changes_yoy: z.array(
    z.object({
      category_id: z.string().nullable().optional(),
      name: z.string(),
      amount: z.string(),
      prev_amount: z.string(),
      delta: z.string(),
      delta_pct: z.string().nullable().optional(),
    }),
  ),
  income_category_changes_yoy: z.array(
    z.object({
      category_id: z.string().nullable().optional(),
      name: z.string(),
      amount: z.string(),
      prev_amount: z.string(),
      delta: z.string(),
      delta_pct: z.string().nullable().optional(),
    }),
  ),
  income_sources_lifetime: z.array(
    z.object({
      source: z.string(),
      total: z.string(),
      transaction_count: z.number(),
    }),
  ),
  expense_sources_lifetime: z.array(
    z.object({
      source: z.string(),
      total: z.string(),
      transaction_count: z.number(),
    }),
  ),
  income_source_changes_yoy: z.array(
    z.object({
      source: z.string(),
      amount: z.string(),
      prev_amount: z.string(),
      delta: z.string(),
      delta_pct: z.string().nullable().optional(),
    }),
  ),
  expense_source_changes_yoy: z.array(
    z.object({
      source: z.string(),
      amount: z.string(),
      prev_amount: z.string(),
      delta: z.string(),
      delta_pct: z.string().nullable().optional(),
    }),
  ),
  accounts: z.array(
    z.object({
      account_id: z.string(),
      name: z.string(),
      account_type: z.nativeEnum(AccountType),
      current_balance: z.string(),
      operating_income: z.string(),
      operating_expense: z.string(),
      net_operating: z.string(),
      transfers_in: z.string(),
      transfers_out: z.string(),
      net_transfers: z.string(),
      first_transaction_date: z.string().nullable().optional(),
    }),
  ),
  investments: z
    .object({
      series: z.array(
        z.object({
          date: z.string(),
          value: z.string(),
        }),
      ),
      yearly: z.array(
        z.object({
          year: z.number(),
          end_value: z.string(),
          contributions: z.string(),
          withdrawals: z.string(),
          net_contributions: z.string(),
          implied_return: z.string().nullable().optional(),
        }),
      ),
      contributions_lifetime: z.string(),
      withdrawals_lifetime: z.string(),
      net_contributions_lifetime: z.string(),
      accounts_latest: z.array(
        z.object({
          account_name: z.string(),
          value: z.string(),
        }),
      ),
    })
    .nullable()
    .optional(),
  debt: z.object({
    total_current: z.string(),
    total_prev_year_end: z.string().nullable().optional(),
    change_since_prev_year_end: z.string().nullable().optional(),
    debt_to_income_latest_year: z.string().nullable().optional(),
    series: z.array(
      z.object({
        date: z.string(),
        debt: z.string(),
      }),
    ),
    accounts: z.array(
      z.object({
        account_id: z.string(),
        name: z.string(),
        current_debt: z.string(),
        prev_year_end_debt: z.string().nullable().optional(),
        delta: z.string().nullable().optional(),
      }),
    ),
  }),
  insights: z.array(z.string()),
});

export const netWorthHistorySchema = z.object({
  points: z.array(
    z.object({
      period: z.string(),
      net_worth: z.string(),
    }),
  ),
});

export const yearlyOverviewSchema = z.object({
  year: z.number(),
  monthly: z.array(
    z.object({
      date: z.string(),
      month: z.number(),
      income: z.string(),
      expense: z.string(),
      net: z.string(),
    }),
  ),
  net_worth: z.array(
    z.object({
      date: z.string(),
      net_worth: z.string(),
    }),
  ),
  debt: z.array(
    z.object({
      date: z.string(),
      debt: z.string(),
    }),
  ),
  savings: z.object({
    income: z.string(),
    expense: z.string(),
    saved: z.string(),
    savings_rate_pct: z.string().nullable().optional(),
  }),
  stats: z.object({
    total_income: z.string(),
    total_expense: z.string(),
    net_savings: z.string(),
    savings_rate_pct: z.string().nullable().optional(),
    avg_monthly_spend: z.string(),
    biggest_income_month: z.object({
      month: z.number(),
      amount: z.string(),
    }),
    biggest_expense_month: z.object({
      month: z.number(),
      amount: z.string(),
    }),
  }),
  category_breakdown: z.array(
    z.object({
      category_id: z.string().nullable().optional(),
      name: z.string(),
      total: z.string(),
      monthly: z.array(z.string()),
      icon: z.string().nullable().optional(),
      color_hex: z.string().nullable().optional(),
      transaction_count: z.number(),
    }),
  ),
  income_category_breakdown: z.array(
    z.object({
      category_id: z.string().nullable().optional(),
      name: z.string(),
      total: z.string(),
      monthly: z.array(z.string()),
      icon: z.string().nullable().optional(),
      color_hex: z.string().nullable().optional(),
      transaction_count: z.number(),
    }),
  ),
  top_merchants: z.array(
    z.object({
      merchant: z.string(),
      amount: z.string(),
      transaction_count: z.number(),
    }),
  ),
  largest_transactions: z.array(
    z.object({
      id: z.string(),
      occurred_at: z.string(),
      merchant: z.string(),
      amount: z.string(),
      category_id: z.string().nullable().optional(),
      category_name: z.string(),
      notes: z.string().nullable().optional(),
    }),
  ),
  category_changes: z.array(
    z.object({
      category_id: z.string().nullable().optional(),
      name: z.string(),
      amount: z.string(),
      prev_amount: z.string(),
      delta: z.string(),
      delta_pct: z.string().nullable().optional(),
    }),
  ),
  investments_summary: z.object({
    as_of: z.string(),
    start_value: z.string(),
    end_value: z.string(),
    change: z.string(),
    change_pct: z.string().nullable().optional(),
    contributions: z.string(),
    withdrawals: z.string(),
    net_contributions: z.string(),
    monthly_values: z.array(z.string()),
    accounts: z.array(
      z.object({
        account_name: z.string(),
        start_value: z.string(),
        end_value: z.string(),
        change: z.string(),
      }),
    ),
  }),
  debt_overview: z.array(
    z.object({
      account_id: z.string(),
      name: z.string(),
      start_debt: z.string(),
      end_debt: z.string(),
      delta: z.string(),
      monthly_debt: z.array(z.string()),
    }),
  ),
  account_flows: z.array(
    z.object({
      account_id: z.string(),
      name: z.string(),
      account_type: z.nativeEnum(AccountType),
      start_balance: z.string(),
      end_balance: z.string(),
      change: z.string(),
      income: z.string(),
      expense: z.string(),
      transfers_in: z.string(),
      transfers_out: z.string(),
      net_operating: z.string(),
      net_transfers: z.string(),
      monthly_income: z.array(z.string()),
      monthly_expense: z.array(z.string()),
      monthly_transfers_in: z.array(z.string()),
      monthly_transfers_out: z.array(z.string()),
      monthly_change: z.array(z.string()),
    }),
  ),
  income_sources: z.array(
    z.object({
      source: z.string(),
      total: z.string(),
      monthly: z.array(z.string()),
      transaction_count: z.number(),
    }),
  ),
  expense_sources: z.array(
    z.object({
      source: z.string(),
      total: z.string(),
      monthly: z.array(z.string()),
      transaction_count: z.number(),
    }),
  ),
  insights: z.array(z.string()),
});

export const yearlyCategoryDetailSchema = z.object({
  year: z.number(),
  category_id: z.string(),
  category_name: z.string(),
  monthly: z.array(
    z.object({
      date: z.string(),
      month: z.number(),
      amount: z.string(),
    }),
  ),
  top_merchants: z.array(
    z.object({
      merchant: z.string(),
      amount: z.string(),
      transaction_count: z.number(),
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
  current_month_spend: money,
  trailing_three_month_spend: money,
  trailing_twelve_month_spend: money,
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

export const bankImportTypeSchema = z.enum([
  "circle_k_mastercard",
  "seb",
  "swedbank",
] as const);

export const importErrorSchema = z.object({
  row_number: numeric,
  message: z.string(),
});

export const importFileUploadSchema = z.object({
  filename: z.string(),
  content_base64: z.string(),
  account_id: z.string().optional(),
  bank_type: bankImportTypeSchema,
});

export const importExampleTransactionSchema = z.object({
  description: z.string(),
  amount: z.string(),
  category_hint: z.string(),
});

export const importCreateRequestSchema = z.object({
  files: z.array(importFileUploadSchema).min(1),
  note: z.string().optional(),
  examples: z.array(importExampleTransactionSchema).optional(),
});

export const importFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  account_id: z.string().optional(),
  row_count: numeric,
  error_count: numeric,
  status: z.string(),
  bank_type: bankImportTypeSchema,
  preview_rows: z.array(z.record(z.string(), z.unknown())).default([]),
  errors: z.array(importErrorSchema).default([]),
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
  files: z.array(importFileSchema).default([]),
});

export const importSessionSchema = importBatchSchema.extend({
  rows: z.array(importRowSchema).default([]),
});

export const importListResponseSchema = z.object({
  imports: z.array(importBatchSchema),
});

export const importSessionResponseSchema = z.object({
  import_session: importSessionSchema,
});

export const importCommitRowSchema = z.object({
  row_id: z.string(),
  category_id: nullableString,
  account_id: nullableString,
  transfer_account_id: nullableString,
  description: nullableString,
  amount: nullableString,
  occurred_at: nullableString,
  subscription_id: nullableString,
  delete: z.boolean().optional(),
});

export const importCommitRequestSchema = z.object({
  rows: z.array(importCommitRowSchema),
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
    snapshot_id: z.string().nullable().optional(),
    occurred_at: z.string(),
    transaction_type: z.string().nullable().optional(),
    description: nullableString,
    holding_name: nullableString,
    isin: nullableString,
    account_name: nullableString,
    quantity: nullableMoney,
    amount_sek: money,
    currency: nullableString,
    fee_sek: nullableMoney,
    notes: nullableString,
  })
  .passthrough();

export const investmentTransactionListSchema = z.object({
  transactions: z.array(investmentTransactionSchema),
});

const benchmarkSchema = z.object({
  symbol: z.string(),
  change_pct: nullableNumeric,
  series: z.array(z.tuple([z.string(), z.number()])).default([]),
});

export const investmentPerformanceSchema = z.object({
  total_value: money,
  invested: money,
  realized_pl: money,
  unrealized_pl: money,
  twr: nullableNumeric,
  irr: nullableNumeric,
  as_of: dateString,
  benchmarks: z.array(benchmarkSchema).default([]),
});

export const investmentMetricsResponseSchema = z.object({
  performance: investmentPerformanceSchema,
  snapshots: z.array(investmentSnapshotSchema).default([]),
  holdings: z.array(investmentHoldingSchema).default([]),
  transactions: z.array(investmentTransactionSchema).default([]),
});

export const nordnetParseRequestSchema = z.object({
  raw_text: z.string(),
  manual_payload: z.record(z.string(), z.unknown()).optional(),
});

export const nordnetParseResponseSchema = z.object({
  report_type: nullableString,
  snapshot_date: nullableString,
  portfolio_value: nullableMoney,
  parsed_payload: z.record(z.string(), z.unknown()),
});

export const nordnetSnapshotCreateRequestSchema = z.object({
  raw_text: z.string(),
  parsed_payload: z.record(z.string(), z.unknown()).optional(),
  manual_payload: z.record(z.string(), z.unknown()).optional(),
  snapshot_date: z.string().optional(),
  account_name: nullableString,
  report_type: nullableString,
  portfolio_value: nullableMoney,
  use_bedrock: z.boolean().optional(),
  bedrock_model_id: z.string().nullable().optional(),
  bedrock_max_tokens: z.union([z.number(), z.string()]).nullable().optional(),
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

export const goalCreateRequestSchema = z.object({
  name: z.string(),
  target_amount: z.string(),
  target_date: nullableString,
  category_id: nullableString,
  account_id: nullableString,
  subscription_id: nullableString,
  note: nullableString,
});

export const goalUpdateRequestSchema = goalCreateRequestSchema.partial();

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

export const cashflowForecastPointSchema = z.object({
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

export const netWorthProjectionPointSchema = z.object({
  date: z.string(),
  net_worth: money,
});

export const netWorthProjectionResponseSchema = z.object({
  current: money,
  cagr: nullableMoney,
  points: z.array(netWorthProjectionPointSchema),
});

export const authSessionSchema = z.object({
  email: z.string().min(1),
  accessToken: z.string().min(1),
  idToken: z.string().min(1),
  refreshToken: z.string().optional().default(""),
  isDemo: z.boolean().optional(),
  approved: z.boolean().optional().default(false),
});

export type LoanCreateRequest = z.infer<typeof loanCreateRequestSchema>;
export type LoanUpdateRequest = z.infer<typeof loanUpdateRequestSchema>;
export type LoanRead = z.infer<typeof loanSchema>;
export type AccountCreateRequest = z.infer<typeof accountCreateRequestSchema>;
export type AccountUpdateRequest = z.infer<typeof accountUpdateRequestSchema>;
export type AccountRead = z.infer<typeof accountSchema>;
export type AccountWithBalance = z.infer<typeof accountWithBalanceSchema>;
export type AccountListResponse = z.infer<typeof accountListSchema>;
export type LoanScheduleEntry = z.infer<typeof loanScheduleEntrySchema>;
export type LoanScheduleRead = z.infer<typeof loanScheduleSchema>;
export type LoanEventRead = z.infer<typeof loanEventSchema>;
export type CategoryCreateRequest = z.infer<typeof categoryCreateRequestSchema>;
export type CategoryUpdateRequest = z.infer<typeof categoryUpdateRequestSchema>;
export type CategoryRead = z.infer<typeof categorySchema>;
export type CategoryListResponse = z.infer<typeof categoryListSchema>;
export type BudgetCreateRequest = z.infer<typeof budgetCreateRequestSchema>;
export type BudgetUpdateRequest = z.infer<typeof budgetUpdateRequestSchema>;
export type BudgetRead = z.infer<typeof budgetSchema>;
export type BudgetProgress = z.infer<typeof budgetProgressSchema>;
export type BudgetListResponse = z.infer<typeof budgetListSchema>;
export type BudgetProgressListResponse = z.infer<
  typeof budgetProgressListSchema
>;
export type TransactionLegCreate = z.infer<typeof transactionLegCreateSchema>;
export type TransactionLegRead = z.infer<typeof transactionLegSchema>;
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateRequest = z.infer<
  typeof transactionUpdateRequestSchema
>;
export type TransactionRead = z.infer<typeof transactionSchema>;
export type TransactionListResponse = z.infer<typeof transactionListSchema>;
export type MonthlyReportEntry = z.infer<
  typeof monthlyReportSchema
>["results"][number];
export type YearlyReportEntry = z.infer<
  typeof yearlyReportSchema
>["results"][number];
export type QuarterlyReportEntry = z.infer<
  typeof quarterlyReportSchema
>["results"][number];
export type TotalReportRead = z.infer<typeof totalReportSchema>;
export type TotalOverviewResponse = z.infer<typeof totalOverviewSchema>;
export type NetWorthPoint = z.infer<
  typeof netWorthHistorySchema
>["points"][number];
export type NetWorthHistoryResponse = z.infer<typeof netWorthHistorySchema>;
export type YearlyOverviewResponse = z.infer<typeof yearlyOverviewSchema>;
export type YearlyCategoryDetailResponse = z.infer<
  typeof yearlyCategoryDetailSchema
>;
export type SubscriptionRead = z.infer<typeof subscriptionSchema>;
export type SubscriptionSummaryRead = z.infer<typeof subscriptionSummarySchema>;
export type SubscriptionSummaryResponse = z.infer<
  typeof subscriptionSummaryResponseSchema
>;
export type SubscriptionListResponse = z.infer<typeof subscriptionListSchema>;
export type ImportError = z.infer<typeof importErrorSchema>;
export type ImportFileRead = z.infer<typeof importFileSchema>;
export type ImportRowRead = z.infer<typeof importRowSchema>;
export type ImportBatch = z.infer<typeof importBatchSchema>;
export type ImportListResponse = z.infer<typeof importListResponseSchema>;
export type ImportSession = z.infer<typeof importSessionSchema>;
export type ImportSessionResponse = z.infer<typeof importSessionResponseSchema>;
export type ImportFileUpload = z.infer<typeof importFileUploadSchema>;
export type ImportExampleTransaction = z.infer<
  typeof importExampleTransactionSchema
>;
export type ImportCreateRequest = z.infer<typeof importCreateRequestSchema>;
export type ImportCommitRow = z.infer<typeof importCommitRowSchema>;
export type ImportCommitRequest = z.infer<typeof importCommitRequestSchema>;
export type InvestmentHoldingRead = z.infer<typeof investmentHoldingSchema>;
export type InvestmentSnapshot = z.infer<typeof investmentSnapshotSchema>;
export type InvestmentSnapshotResponse = z.infer<
  typeof investmentSnapshotResponseSchema
>;
export type InvestmentSnapshotListResponse = z.infer<
  typeof investmentSnapshotListResponseSchema
>;
export type InvestmentTransactionRead = z.infer<
  typeof investmentTransactionSchema
>;
export type InvestmentTransactionListResponse = z.infer<
  typeof investmentTransactionListSchema
>;
export type InvestmentPerformance = z.infer<typeof investmentPerformanceSchema>;
export type InvestmentMetricsResponse = z.infer<
  typeof investmentMetricsResponseSchema
>;
export type NordnetParseRequest = z.infer<typeof nordnetParseRequestSchema>;
export type NordnetParseResponse = z.infer<typeof nordnetParseResponseSchema>;
export type NordnetSnapshotCreateRequest = z.infer<
  typeof nordnetSnapshotCreateRequestSchema
>;
export type GoalRead = z.infer<typeof goalSchema>;
export type GoalListResponse = z.infer<typeof goalListSchema>;
export type GoalCreateRequest = z.infer<typeof goalCreateRequestSchema>;
export type GoalUpdateRequest = z.infer<typeof goalUpdateRequestSchema>;
export type SettingsPayload = z.infer<typeof settingsPayloadSchema>;
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
export type WarmupResponse = z.infer<typeof warmupResponseSchema>;
export type CashflowForecastPoint = z.infer<typeof cashflowForecastPointSchema>;
export type CashflowForecastResponse = z.infer<
  typeof cashflowForecastResponseSchema
>;
export type NetWorthProjectionPoint = z.infer<
  typeof netWorthProjectionPointSchema
>;
export type NetWorthProjectionResponse = z.infer<
  typeof netWorthProjectionResponseSchema
>;
