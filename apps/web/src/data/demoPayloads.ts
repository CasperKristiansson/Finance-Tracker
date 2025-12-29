import type {
  AccountListResponse,
  BudgetProgressListResponse,
  CashflowForecastResponse,
  CategoryListResponse,
  GoalListResponse,
  ImportCategorySuggestResponse,
  ImportPreviewResponse,
  InvestmentHoldingRead,
  InvestmentMetricsResponse,
  InvestmentOverviewResponse,
  InvestmentSnapshotListResponse,
  InvestmentTransactionListResponse,
  LoanEventRead,
  LoanScheduleRead,
  MonthlyReportEntry,
  NetWorthHistoryResponse,
  NetWorthProjectionResponse,
  QuarterlyReportEntry,
  SubscriptionSummaryResponse,
  TaxEventListResponse,
  TaxSummaryResponse,
  TaxTotalSummaryResponse,
  TotalReportRead,
  TotalOverviewResponse,
  TransactionListResponse,
  YearlyCategoryDetailResponse,
  YearlyOverviewResponse,
  YearlyReportEntry,
} from "@/types/api";
import {
  AccountType,
  BudgetPeriod,
  CategoryType,
  InterestCompound,
  LoanEventType,
  TaxEventType,
  TransactionType,
} from "@/types/enums";

const formatDate = (date: string) => new Date(date).toISOString();
const nowIso = new Date().toISOString();
const demoYear = new Date().getFullYear();
const pad2 = (value: number) => String(value).padStart(2, "0");
const monthIso = (year: number, monthIndex: number) =>
  new Date(Date.UTC(year, monthIndex, 1)).toISOString();
const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);
const toMoney = (value: number) => value.toFixed(2);
const scaleSeries = (values: number[], factor: number) =>
  values.map((value) => Math.round(value * factor));
const demoMonthIndex = new Date().getMonth();
const demoMonth = (offset: number) =>
  pad2(Math.max(0, Math.min(11, demoMonthIndex + offset)) + 1);
const demoDate = (offset: number, day: number) =>
  formatDate(`${demoYear}-${demoMonth(offset)}-${pad2(day)}`);

const buildLinearSeries = (start: number, end: number, count: number) => {
  if (count <= 1) return [Math.round(end)];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, idx) =>
    Math.round(start + step * idx),
  );
};

const buildMonthlyReport = (
  year: number,
  income: number[],
  expense: number[],
): MonthlyReportEntry[] =>
  income.map((value, idx) => {
    const exp = expense[idx] ?? 0;
    return {
      period: `${year}-${pad2(idx + 1)}`,
      income: toMoney(value),
      expense: toMoney(exp),
      net: toMoney(value - exp),
    };
  });

const buildQuarterlyReport = (
  year: number,
  monthly: MonthlyReportEntry[],
): QuarterlyReportEntry[] => {
  const quarters = Array.from({ length: 4 }, (_, idx) => idx + 1);
  return quarters.map((quarter) => {
    const slice = monthly.slice((quarter - 1) * 3, quarter * 3);
    const income = slice.reduce((acc, row) => acc + Number(row.income), 0);
    const expense = slice.reduce((acc, row) => acc + Number(row.expense), 0);
    return {
      year,
      quarter,
      income: toMoney(income),
      expense: toMoney(expense),
      net: toMoney(income - expense),
    };
  });
};

const buildYearlyReport = (
  years: number[],
  currentIncome: number,
  currentExpense: number,
): YearlyReportEntry[] =>
  years.map((year, idx) => {
    if (year === demoYear) {
      return {
        year,
        income: toMoney(currentIncome),
        expense: toMoney(currentExpense),
        net: toMoney(currentIncome - currentExpense),
      };
    }
    const incomeFactor = 0.72 + idx * 0.05;
    const expenseFactor = 0.64 + idx * 0.045;
    const income = Math.round(currentIncome * incomeFactor);
    const expense = Math.round(currentExpense * expenseFactor);
    return {
      year,
      income: toMoney(income),
      expense: toMoney(expense),
      net: toMoney(income - expense),
    };
  });

export const demoCategories: CategoryListResponse = {
  categories: [
    {
      id: "cat-income-salary",
      name: "Salary",
      category_type: CategoryType.INCOME,
      color_hex: "#0ea5e9",
      icon: "badge-dollar",
      is_archived: false,
      created_at: formatDate("2018-01-01"),
      updated_at: nowIso,
      transaction_count: 80,
      last_used_at: nowIso,
      lifetime_total: "7800000.00",
      recent_months: [
        { period: "2024-11", total: "610000.00" },
        { period: "2024-12", total: "640000.00" },
      ],
    },
    {
      id: "cat-exp-rent",
      name: "Housing",
      category_type: CategoryType.EXPENSE,
      color_hex: "#f59e0b",
      icon: "home",
      is_archived: false,
      created_at: formatDate("2018-01-05"),
      updated_at: nowIso,
      transaction_count: 70,
      last_used_at: formatDate("2024-12-01"),
      lifetime_total: "-2800000.00",
      recent_months: [
        { period: "2024-11", total: "-320000.00" },
        { period: "2024-12", total: "-320000.00" },
      ],
    },
    {
      id: "cat-exp-groceries",
      name: "Groceries",
      category_type: CategoryType.EXPENSE,
      color_hex: "#22c55e",
      icon: "shopping-bag",
      is_archived: false,
      created_at: formatDate("2018-02-10"),
      updated_at: nowIso,
      transaction_count: 200,
      last_used_at: formatDate("2024-12-27"),
      lifetime_total: "-520000.00",
      recent_months: [
        { period: "2024-11", total: "-42000.00" },
        { period: "2024-12", total: "-40500.00" },
      ],
    },
    {
      id: "cat-exp-entertainment",
      name: "Entertainment",
      category_type: CategoryType.EXPENSE,
      color_hex: "#a855f7",
      icon: "sparkles",
      is_archived: false,
      created_at: formatDate("2019-03-12"),
      updated_at: nowIso,
      transaction_count: 110,
      last_used_at: formatDate("2024-12-22"),
      lifetime_total: "-210000.00",
      recent_months: [
        { period: "2024-11", total: "-18500.00" },
        { period: "2024-12", total: "-21500.00" },
      ],
    },
    {
      id: "cat-exp-transport",
      name: "Transport",
      category_type: CategoryType.EXPENSE,
      color_hex: "#3b82f6",
      icon: "tram-front",
      is_archived: false,
      created_at: formatDate("2020-02-20"),
      updated_at: nowIso,
      transaction_count: 140,
      last_used_at: formatDate("2024-12-19"),
      lifetime_total: "-260000.00",
      recent_months: [
        { period: "2024-11", total: "-21000.00" },
        { period: "2024-12", total: "-22400.00" },
      ],
    },
  ],
};

export const demoAccounts: AccountListResponse = {
  accounts: [
    {
      id: "acc-checking",
      name: "Everyday Checking",
      account_type: AccountType.NORMAL,
      is_active: true,
      icon: "wallet",
      bank_import_type: null,
      created_at: formatDate("2020-01-02"),
      updated_at: nowIso,
      balance: "85000.32",
      last_reconciled_at: formatDate("2024-12-27"),
      reconciliation_gap: "0",
      needs_reconciliation: false,
    },
    {
      id: "acc-savings",
      name: "High-Yield Savings",
      account_type: AccountType.NORMAL,
      is_active: true,
      icon: "piggy-bank",
      bank_import_type: null,
      created_at: formatDate("2020-01-15"),
      updated_at: nowIso,
      balance: "520000.75",
      last_reconciled_at: formatDate("2024-12-22"),
      reconciliation_gap: "0",
      needs_reconciliation: false,
    },
    {
      id: "acc-card",
      name: "Travel Rewards Card",
      account_type: AccountType.DEBT,
      is_active: true,
      icon: "credit-card",
      bank_import_type: "circle_k_mastercard",
      created_at: formatDate("2022-02-01"),
      updated_at: nowIso,
      balance: "-11000.45",
      last_reconciled_at: formatDate("2024-12-24"),
      reconciliation_gap: "0",
      needs_reconciliation: false,
    },
    {
      id: "acc-mortgage",
      name: "Home Mortgage",
      account_type: AccountType.DEBT,
      is_active: true,
      icon: "home",
      bank_import_type: null,
      created_at: formatDate("2019-06-01"),
      updated_at: nowIso,
      balance: "-520000.00",
      last_reconciled_at: formatDate("2024-12-20"),
      reconciliation_gap: "0",
      needs_reconciliation: false,
      loan: {
        id: "loan-mortgage",
        account_id: "acc-mortgage",
        origin_principal: "600000.00",
        current_principal: "520000.00",
        interest_rate_annual: "3.45",
        interest_compound: InterestCompound.MONTHLY,
        minimum_payment: "3200.00",
        expected_maturity_date: formatDate("2047-12-01"),
        created_at: formatDate("2019-06-01"),
        updated_at: nowIso,
      },
    },
    {
      id: "acc-brokerage",
      name: "Global Brokerage",
      account_type: AccountType.INVESTMENT,
      is_active: true,
      icon: "line-chart",
      bank_import_type: null,
      created_at: formatDate("2018-03-15"),
      updated_at: nowIso,
      balance: "4700000.00",
      last_reconciled_at: nowIso,
      reconciliation_gap: "0",
      needs_reconciliation: false,
    },
  ],
};

export const demoBudgets: BudgetProgressListResponse = {
  budgets: [
    {
      id: "budget-groceries",
      category_id: "cat-exp-groceries",
      period: BudgetPeriod.MONTHLY,
      amount: "38000.00",
      note: "Family groceries",
      spent: "30580.45",
      remaining: "7419.55",
      percent_used: "80.48",
    },
    {
      id: "budget-entertainment",
      category_id: "cat-exp-entertainment",
      period: BudgetPeriod.MONTHLY,
      amount: "15000.00",
      note: "Streaming, concerts, nights out",
      spent: "11175.20",
      remaining: "3824.80",
      percent_used: "74.50",
    },
    {
      id: "budget-transport",
      category_id: "cat-exp-transport",
      period: BudgetPeriod.MONTHLY,
      amount: "12000.00",
      note: "Transit & fuel",
      spent: "9240.00",
      remaining: "2760.00",
      percent_used: "77.00",
    },
  ],
};

export const demoTransactionsResponse: TransactionListResponse = {
  transactions: [
    {
      id: "tx-salary",
      category_id: "cat-income-salary",
      subscription_id: null,
      transaction_type: TransactionType.INCOME,
      description: "Monthly salary and bonus",
      notes: null,
      external_id: "payroll-2024-12",
      occurred_at: demoDate(0, 26),
      posted_at: demoDate(0, 26),
      created_at: demoDate(0, 26),
      updated_at: demoDate(0, 26),
      legs: [
        {
          id: "leg-salary-checking",
          account_id: "acc-checking",
          amount: "95000.00",
        },
        {
          id: "leg-salary-savings",
          account_id: "acc-savings",
          amount: "32000.00",
        },
      ],
    },
    {
      id: "tx-mortgage",
      category_id: "cat-exp-rent",
      subscription_id: null,
      transaction_type: TransactionType.EXPENSE,
      description: "Mortgage Payment - December",
      notes: null,
      external_id: "mortgage-2024-12",
      occurred_at: demoDate(0, 1),
      posted_at: demoDate(0, 1),
      created_at: demoDate(0, 1),
      updated_at: demoDate(0, 1),
      legs: [
        {
          id: "leg-mortgage-checking",
          account_id: "acc-checking",
          amount: "-3200.00",
        },
        {
          id: "leg-mortgage-mortgage",
          account_id: "acc-mortgage",
          amount: "3200.00",
        },
      ],
    },
    {
      id: "tx-groceries",
      category_id: "cat-exp-groceries",
      subscription_id: null,
      transaction_type: TransactionType.EXPENSE,
      description: "Groceries - Local Market",
      notes: "Weekly essentials",
      external_id: "groceries-2024-12-22",
      occurred_at: demoDate(0, 12),
      posted_at: demoDate(0, 12),
      created_at: demoDate(0, 12),
      updated_at: demoDate(0, 12),
      legs: [
        {
          id: "leg-groceries-checking",
          account_id: "acc-checking",
          amount: "-1389.44",
        },
      ],
    },
    {
      id: "tx-savings",
      category_id: null,
      subscription_id: null,
      transaction_type: TransactionType.TRANSFER,
      description: "Transfer to savings",
      notes: "Monthly surplus",
      external_id: "transfer-2024-12-29",
      occurred_at: demoDate(0, 27),
      posted_at: demoDate(0, 27),
      created_at: demoDate(0, 27),
      updated_at: demoDate(0, 27),
      legs: [
        {
          id: "leg-transfer-out",
          account_id: "acc-checking",
          amount: "-35000.00",
        },
        {
          id: "leg-transfer-in",
          account_id: "acc-savings",
          amount: "35000.00",
        },
      ],
    },
    {
      id: "tx-travel",
      category_id: "cat-exp-entertainment",
      subscription_id: null,
      transaction_type: TransactionType.EXPENSE,
      description: "Weekend getaway",
      notes: "Train + hotel",
      external_id: "travel-2024-12-15",
      occurred_at: demoDate(-1, 18),
      posted_at: demoDate(-1, 18),
      created_at: demoDate(-1, 18),
      updated_at: demoDate(-1, 18),
      legs: [
        { id: "leg-travel-card", account_id: "acc-card", amount: "-1850.45" },
      ],
    },
  ],
  running_balances: {
    "acc-checking": "85000.32",
    "acc-savings": "520000.75",
    "acc-card": "-11000.45",
    "acc-mortgage": "-520000.00",
    "acc-brokerage": "4700000.00",
  },
};

const demoMonthlyIncome = [
  118000, 120000, 122000, 125000, 128000, 130000, 133000, 135000, 138000,
  140000, 145000, 155000,
];
const demoMonthlyExpense = [
  72000, 74000, 76000, 78000, 80000, 82000, 85000, 83000, 86000, 87000, 89000,
  92000,
];
const demoMonthlyIncomePrev = scaleSeries(demoMonthlyIncome, 0.92);
const demoMonthlyExpensePrev = scaleSeries(demoMonthlyExpense, 0.9);
const demoMonthlyReport = buildMonthlyReport(
  demoYear,
  demoMonthlyIncome,
  demoMonthlyExpense,
);
const demoMonthlyReportPrev = buildMonthlyReport(
  demoYear - 1,
  demoMonthlyIncomePrev,
  demoMonthlyExpensePrev,
);
const demoQuarterlyReport = buildQuarterlyReport(demoYear, demoMonthlyReport);
const demoYears = Array.from({ length: 7 }, (_, idx) => demoYear - 6 + idx);
const demoYearlyReport = buildYearlyReport(
  demoYears,
  sum(demoMonthlyIncome),
  sum(demoMonthlyExpense),
);
const demoTotalIncome = sum(demoYearlyReport.map((row) => Number(row.income)));
const demoTotalExpense = sum(
  demoYearlyReport.map((row) => Number(row.expense)),
);
const demoNetWorthPoints = (() => {
  let netWorth = 900000;
  return demoYearlyReport.map((row) => {
    netWorth += Number(row.net) * 0.8;
    return { period: `${row.year}-12`, net_worth: toMoney(netWorth) };
  });
})();
const demoNetWorthByYear = new Map<number, number>(
  demoNetWorthPoints.map((point) => [
    Number(point.period.slice(0, 4)),
    Number(point.net_worth),
  ]),
);

const periodToDate = (period: string) => {
  const [year, month] = period.split("-");
  const monthIndex = Number(month) - 1;
  if (!year || !Number.isFinite(monthIndex)) return nowIso;
  return monthIso(Number(year), monthIndex);
};

export const demoReportPayloads: {
  monthly: MonthlyReportEntry[];
  yearly: YearlyReportEntry[];
  quarterly: QuarterlyReportEntry[];
  total: TotalReportRead;
  netWorth: NetWorthHistoryResponse;
} = {
  monthly: demoMonthlyReport,
  yearly: demoYearlyReport,
  quarterly: demoQuarterlyReport,
  total: {
    income: toMoney(demoTotalIncome),
    expense: toMoney(demoTotalExpense),
    net: toMoney(demoTotalIncome - demoTotalExpense),
    generated_at: nowIso,
  },
  netWorth: {
    points: demoNetWorthPoints,
  },
};

export const demoInvestmentSnapshots: InvestmentSnapshotListResponse = {
  snapshots: [
    {
      id: "snap-2024-12-30",
      provider: "nordnet",
      report_type: "positions",
      account_name: "Nordnet ISA",
      snapshot_date: "2024-12-30",
      portfolio_value: "4700000.00",
      raw_text: "Demo snapshot payload",
      parsed_payload: { currency: "SEK" },
      cleaned_payload: { notes: "demo" },
      bedrock_metadata: null,
      created_at: formatDate("2024-12-30"),
      updated_at: formatDate("2024-12-30"),
      holdings: [
        {
          id: "holding-tech",
          snapshot_id: "snap-2024-12-30",
          snapshot_date: "2024-12-30",
          account_name: "Nordnet ISA",
          name: "Global Tech ETF",
          isin: "SE0000001",
          holding_type: "equity",
          currency: "SEK",
          quantity: 12400,
          price: "152.5",
          value_sek: "1891000.00",
          notes: null,
        },
        {
          id: "holding-bonds",
          snapshot_id: "snap-2024-12-30",
          snapshot_date: "2024-12-30",
          account_name: "Nordnet ISA",
          name: "Nordic Bond",
          isin: "SE0000002",
          holding_type: "bond",
          currency: "SEK",
          quantity: 8600,
          price: "112.1",
          value_sek: "963000.00",
          notes: "Stable income",
        },
        {
          id: "holding-cash",
          snapshot_id: "snap-2024-12-30",
          snapshot_date: "2024-12-30",
          account_name: "Nordnet ISA",
          name: "Cash",
          isin: null,
          holding_type: "cash",
          currency: "SEK",
          quantity: null,
          price: null,
          value_sek: "1846000.00",
          notes: "Reserve for opportunities",
        },
      ],
    },
  ],
};

export const demoInvestmentTransactions: InvestmentTransactionListResponse = {
  transactions: [
    {
      id: "inv-tx-dividend",
      snapshot_id: "snap-2024-12-30",
      occurred_at: "2024-12-15",
      transaction_type: "dividend",
      description: "Tech ETF dividend",
      holding_name: "Global Tech ETF",
      isin: "SE0000001",
      account_name: "Nordnet ISA",
      quantity: null,
      amount_sek: "36000.00",
      currency: "SEK",
      fee_sek: "0",
      notes: "Quarterly distribution",
    },
    {
      id: "inv-tx-buy",
      snapshot_id: "snap-2024-12-30",
      occurred_at: "2024-12-10",
      transaction_type: "buy",
      description: "Added to Nordic Bond",
      holding_name: "Nordic Bond",
      isin: "SE0000002",
      account_name: "Nordnet ISA",
      quantity: "1400",
      amount_sek: "151000.00",
      currency: "SEK",
      fee_sek: "25.00",
      notes: "",
    },
  ],
};

export const demoInvestmentMetrics: InvestmentMetricsResponse = {
  performance: {
    total_value: "4700000.00",
    invested: "3900000.00",
    realized_pl: "180000.00",
    unrealized_pl: "620000.00",
    twr: 12.4,
    irr: 10.9,
    as_of: "2024-12-30",
    benchmarks: [
      {
        symbol: "OMXS30",
        change_pct: 6.2,
        series: [
          ["2024-10-01", 0],
          ["2024-12-30", 6.2],
        ],
      },
    ],
  },
  snapshots: demoInvestmentSnapshots.snapshots,
  holdings: (demoInvestmentSnapshots.snapshots[0]?.holdings ??
    []) as unknown as InvestmentHoldingRead[],
  transactions: demoInvestmentTransactions.transactions,
};

export const demoInvestmentOverview: InvestmentOverviewResponse = {
  portfolio: {
    start_date: "2018-01-01",
    as_of: "2024-12-30",
    current_value: "4700000.00",
    series: [
      { date: "2019-12-31", value: "720000.00" },
      { date: "2021-12-31", value: "1800000.00" },
      { date: "2023-12-31", value: "3100000.00" },
      { date: "2024-12-30", value: "4700000.00" },
    ],
    cashflow_series: [
      {
        period: "2024-03-31",
        added: "300000.00",
        withdrawn: "0",
        net: "300000.00",
      },
      {
        period: "2024-06-30",
        added: "240000.00",
        withdrawn: "-60000.00",
        net: "180000.00",
      },
      {
        period: "2024-09-30",
        added: "260000.00",
        withdrawn: "-90000.00",
        net: "170000.00",
      },
      {
        period: "2024-12-30",
        added: "360000.00",
        withdrawn: "-120000.00",
        net: "240000.00",
      },
    ],
    cashflow: {
      added_30d: "140000.00",
      withdrawn_30d: "-25000.00",
      net_30d: "115000.00",
      added_ytd: "1160000.00",
      withdrawn_ytd: "-295000.00",
      net_ytd: "865000.00",
      added_12m: "1160000.00",
      withdrawn_12m: "-295000.00",
      net_12m: "865000.00",
      added_since_start: "4200000.00",
      withdrawn_since_start: "-450000.00",
      net_since_start: "3750000.00",
    },
    growth_12m_ex_transfers: { amount: "520000.00", pct: 12.5 },
    growth_since_start_ex_transfers: { amount: "1900000.00", pct: 68.0 },
  },
  accounts: [
    {
      account_id: "acc-invest",
      name: "Nordnet ISA",
      icon: "line-chart",
      start_date: "2018-01-01",
      as_of: "2024-12-30",
      current_value: "4700000.00",
      series: [
        { date: "2024-06-30", value: "4100000.00" },
        { date: "2024-09-30", value: "4300000.00" },
        { date: "2024-12-30", value: "4700000.00" },
      ],
      cashflow_12m_added: "1160000.00",
      cashflow_12m_withdrawn: "-295000.00",
      cashflow_since_start_added: "4200000.00",
      cashflow_since_start_withdrawn: "-450000.00",
      cashflow_since_start_net: "3750000.00",
      growth_12m_ex_transfers: { amount: "520000.00", pct: 12.5 },
      growth_since_start_ex_transfers: { amount: "1900000.00", pct: 68.0 },
    },
  ],
  recent_cashflows: [
    {
      occurred_at: "2024-12-12",
      account_id: "acc-invest",
      account_name: "Nordnet ISA",
      direction: "deposit",
      amount_sek: "120000.00",
      description: "Monthly contribution",
      transaction_id: "inv-cf-1",
    },
    {
      occurred_at: "2024-12-05",
      account_id: "acc-invest",
      account_name: "Nordnet ISA",
      direction: "withdrawal",
      amount_sek: "-25000.00",
      description: "Fee adjustment",
      transaction_id: "inv-cf-2",
    },
  ],
};

export const demoImportPreview: ImportPreviewResponse = {
  files: [
    {
      id: "file-1",
      filename: "december.csv",
      account_id: "acc-checking",
      bank_import_type: "seb",
      row_count: 2,
      error_count: 0,
      errors: [],
      preview_rows: [
        { description: "Coffee Shop", amount: "-145.20" },
        { description: "Salary", amount: "127000.00" },
      ],
    },
  ],
  rows: [
    {
      id: "row-1",
      file_id: "file-1",
      row_index: 0,
      account_id: "acc-checking",
      occurred_at: "2024-12-21",
      amount: "-145.20",
      description: "Coffee Shop",
      suggested_category_id: "cat-exp-entertainment",
      suggested_category_name: "Entertainment",
      suggested_confidence: 0.72,
      suggested_reason: "Matches recent cafe spend",
      suggested_subscription_id: null,
      suggested_subscription_name: null,
      suggested_subscription_confidence: null,
      suggested_subscription_reason: null,
      transfer_match: null,
      rule_applied: false,
      rule_type: null,
      rule_summary: null,
    },
    {
      id: "row-2",
      file_id: "file-1",
      row_index: 1,
      account_id: "acc-checking",
      occurred_at: "2024-12-28",
      amount: "127000.00",
      description: "Salary",
      suggested_category_id: "cat-income-salary",
      suggested_category_name: "Salary",
      suggested_confidence: 0.98,
      suggested_reason: "Recurring payroll reference detected",
      suggested_subscription_id: null,
      suggested_subscription_name: null,
      suggested_subscription_confidence: null,
      suggested_subscription_reason: null,
      transfer_match: null,
      rule_applied: false,
      rule_type: null,
      rule_summary: null,
    },
  ],
  accounts: [
    {
      account_id: "acc-checking",
      recent_transactions: [
        {
          id: "tx-recent-coffee",
          occurred_at: "2024-12-14",
          description: "Coffee Shop",
          category_id: "cat-exp-entertainment",
          category_name: "Entertainment",
        },
      ],
      similar_transactions: [
        {
          id: "tx-similar-payroll",
          occurred_at: "2024-11-28",
          description: "Salary",
          category_id: "cat-income-salary",
          category_name: "Salary",
        },
      ],
      similar_by_row: [
        { row_id: "row-1", transaction_ids: ["tx-recent-coffee"] },
        { row_id: "row-2", transaction_ids: ["tx-similar-payroll"] },
      ],
    },
  ],
};

export const demoImportSuggestions: ImportCategorySuggestResponse = {
  suggestions: [
    {
      id: "row-1",
      category_id: "cat-exp-entertainment",
      confidence: 0.72,
      reason: "Matches cafe merchants from history",
    },
    {
      id: "row-2",
      category_id: "cat-income-salary",
      confidence: 0.98,
      reason: "Consistent payroll memo and amount",
    },
  ],
};

export const demoLoanSchedules: Record<string, LoanScheduleRead> = {
  "acc-mortgage": {
    account_id: "acc-mortgage",
    loan_id: "loan-mortgage",
    generated_at: formatDate("2024-12-01"),
    as_of_date: formatDate("2024-12-01"),
    schedule: [
      {
        period: 1,
        due_date: "2025-01-01",
        payment_amount: "3200.00",
        interest_amount: "1490.00",
        principal_amount: "1710.00",
        remaining_principal: "518290.00",
      },
      {
        period: 2,
        due_date: "2025-02-01",
        payment_amount: "3200.00",
        interest_amount: "1485.00",
        principal_amount: "1715.00",
        remaining_principal: "516575.00",
      },
    ],
  },
};

export const demoLoanEvents: Record<string, LoanEventRead[]> = {
  "acc-mortgage": [
    {
      id: "loan-evt-1",
      loan_id: "loan-mortgage",
      transaction_id: "tx-loan-1",
      transaction_leg_id: null,
      event_type: LoanEventType.PAYMENT_PRINCIPAL,
      amount: "-1710.00",
      occurred_at: "2025-01-01",
    },
    {
      id: "loan-evt-2",
      loan_id: "loan-mortgage",
      transaction_id: "tx-loan-2",
      transaction_leg_id: null,
      event_type: LoanEventType.INTEREST_ACCRUAL,
      amount: "1490.00",
      occurred_at: "2025-01-01",
    },
  ],
};
