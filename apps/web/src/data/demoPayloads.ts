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

const getYearFactor = (year: number) => {
  if (year === demoYear) return 1;
  if (year === demoYear - 1) return 0.92;
  const offset = year - demoYear;
  if (offset > 0) return 1 + offset * 0.06;
  return Math.max(0.58, 1 + offset * 0.08);
};

const getSeriesForYear = (year: number) => {
  if (year === demoYear) {
    return {
      income: demoMonthlyIncome,
      expense: demoMonthlyExpense,
    };
  }
  if (year === demoYear - 1) {
    return {
      income: demoMonthlyIncomePrev,
      expense: demoMonthlyExpensePrev,
    };
  }
  const factor = getYearFactor(year);
  return {
    income: scaleSeries(demoMonthlyIncome, factor),
    expense: scaleSeries(demoMonthlyExpense, Math.max(0.55, factor * 0.92)),
  };
};

const expenseCategoryWeights = [
  { id: "cat-exp-rent", name: "Housing", weight: 0.36 },
  { id: "cat-exp-groceries", name: "Groceries", weight: 0.2 },
  { id: "cat-exp-entertainment", name: "Entertainment", weight: 0.16 },
  { id: "cat-exp-transport", name: "Transport", weight: 0.12 },
  { id: null, name: "Other", weight: 0.16 },
];

const incomeCategoryWeights = [
  { id: "cat-income-salary", name: "Salary", weight: 0.85 },
  { id: null, name: "Other income", weight: 0.15 },
];

const getCategoryMeta = (id: string | null, name: string) => {
  if (!id) return { name, icon: null, color_hex: "#94a3b8" };
  const found = demoCategories.categories.find((cat) => cat.id === id);
  return {
    name: found?.name ?? name,
    icon: found?.icon ?? null,
    color_hex: found?.color_hex ?? "#94a3b8",
  };
};

const buildCategoryBreakdown = (
  totals: number[],
  weights: Array<{ id: string | null; name: string; weight: number }>,
) =>
  weights.map((weight) => {
    const meta = getCategoryMeta(weight.id, weight.name);
    const monthly = totals.map((value) => toMoney(value * weight.weight));
    const total = totals.reduce((sum, value) => sum + value * weight.weight, 0);
    return {
      category_id: weight.id,
      name: meta.name,
      total: toMoney(total),
      monthly,
      icon: meta.icon,
      color_hex: meta.color_hex,
      transaction_count: Math.max(6, Math.round(total / 15000)),
    };
  });

const buildCategoryTotals = (
  total: number,
  weights: Array<{ id: string | null; name: string; weight: number }>,
) =>
  weights.map((weight) => {
    const meta = getCategoryMeta(weight.id, weight.name);
    const amount = total * weight.weight;
    return {
      category_id: weight.id,
      name: meta.name,
      total: toMoney(amount),
      icon: meta.icon,
      color_hex: meta.color_hex,
      transaction_count: Math.max(6, Math.round(amount / 15000)),
    };
  });

const buildMonthlyTotals = (year: number) => {
  const series = getSeriesForYear(year);
  return {
    income: series.income.map((value) => Number(value)),
    expense: series.expense.map((value) => Number(value)),
  };
};

export const getDemoMonthlyReport = (year: number): MonthlyReportEntry[] => {
  const series = getSeriesForYear(year);
  return buildMonthlyReport(year, series.income, series.expense);
};

export const getDemoQuarterlyReport = (year: number): QuarterlyReportEntry[] =>
  buildQuarterlyReport(year, getDemoMonthlyReport(year));

export const getDemoYearlyReport = (): YearlyReportEntry[] => demoYearlyReport;

const buildAccountFlows = (year: number) => {
  const { income, expense } = buildMonthlyTotals(year);
  const incomeTotal = sum(income);
  const expenseTotal = sum(expense);
  const accountWeights = [
    {
      id: "acc-checking",
      incomeWeight: 0.65,
      expenseWeight: 0.55,
      transferInWeight: 0.1,
      transferOutWeight: 0.18,
    },
    {
      id: "acc-savings",
      incomeWeight: 0.1,
      expenseWeight: 0.05,
      transferInWeight: 0.25,
      transferOutWeight: 0.08,
    },
    {
      id: "acc-card",
      incomeWeight: 0.05,
      expenseWeight: 0.25,
      transferInWeight: 0.02,
      transferOutWeight: 0.05,
    },
    {
      id: "acc-mortgage",
      incomeWeight: 0,
      expenseWeight: 0.15,
      transferInWeight: 0.1,
      transferOutWeight: 0.02,
    },
    {
      id: "acc-brokerage",
      incomeWeight: 0.2,
      expenseWeight: 0,
      transferInWeight: 0.2,
      transferOutWeight: 0,
    },
  ];

  return accountWeights
    .map((weights) => {
      const account = demoAccounts.accounts.find(
        (acc) => acc.id === weights.id,
      );
      if (!account) return null;
      const monthlyIncome = income.map((value) => value * weights.incomeWeight);
      const monthlyExpense = expense.map(
        (value) => value * weights.expenseWeight,
      );
      const monthlyTransfersIn = income.map(
        (value) => value * weights.transferInWeight,
      );
      const monthlyTransfersOut = expense.map(
        (value) => value * weights.transferOutWeight,
      );
      const monthlyChange = monthlyIncome.map(
        (value, idx) =>
          value -
          monthlyExpense[idx] +
          monthlyTransfersIn[idx] -
          monthlyTransfersOut[idx],
      );
      const netOperating = monthlyIncome.reduce(
        (acc, value, idx) => acc + value - monthlyExpense[idx],
        0,
      );
      const netTransfers = monthlyTransfersIn.reduce(
        (acc, value, idx) => acc + value - monthlyTransfersOut[idx],
        0,
      );
      const change = netOperating + netTransfers;
      const endBalance = Number(account.balance) || 0;
      const startBalance = endBalance - change;

      return {
        account_id: account.id,
        name: account.name,
        account_type: account.account_type,
        start_balance: toMoney(startBalance),
        end_balance: toMoney(endBalance),
        change: toMoney(change),
        income: toMoney(incomeTotal * weights.incomeWeight),
        expense: toMoney(expenseTotal * weights.expenseWeight),
        transfers_in: toMoney(incomeTotal * weights.transferInWeight),
        transfers_out: toMoney(expenseTotal * weights.transferOutWeight),
        net_operating: toMoney(netOperating),
        net_transfers: toMoney(netTransfers),
        monthly_income: monthlyIncome.map(toMoney),
        monthly_expense: monthlyExpense.map(toMoney),
        monthly_transfers_in: monthlyTransfersIn.map(toMoney),
        monthly_transfers_out: monthlyTransfersOut.map(toMoney),
        monthly_change: monthlyChange.map(toMoney),
      };
    })
    .filter((flow): flow is NonNullable<typeof flow> => Boolean(flow));
};

const buildInvestmentsSummary = (year: number) => {
  const yearOffset = year - demoYear;
  const startValue = Math.max(800000, 3200000 + yearOffset * 240000);
  const endValue = Math.max(1000000, startValue + 620000 + yearOffset * 40000);
  const contributions = Math.max(200000, 920000 + yearOffset * 60000);
  const withdrawals = Math.max(50000, 180000 + yearOffset * 20000);
  const monthlyValues = buildLinearSeries(startValue, endValue, 12).map(
    toMoney,
  );

  return {
    as_of: nowIso,
    start_value: toMoney(startValue),
    end_value: toMoney(endValue),
    change: toMoney(endValue - startValue),
    change_pct: toMoney(((endValue - startValue) / startValue) * 100),
    contributions: toMoney(contributions),
    withdrawals: toMoney(withdrawals),
    net_contributions: toMoney(contributions - withdrawals),
    monthly_values: monthlyValues,
    accounts: [
      {
        account_name: "Global Brokerage",
        start_value: toMoney(startValue * 0.92),
        end_value: toMoney(endValue),
        change: toMoney(endValue - startValue * 0.92),
      },
    ],
  };
};

export const getDemoYearlyOverview = (year: number): YearlyOverviewResponse => {
  const { income, expense } = buildMonthlyTotals(year);
  const monthly = income.map((incomeValue, idx) => {
    const exp = expense[idx] ?? 0;
    return {
      date: monthIso(year, idx),
      month: idx + 1,
      income: toMoney(incomeValue),
      expense: toMoney(exp),
      net: toMoney(incomeValue - exp),
    };
  });

  const totalIncome = sum(income);
  const totalExpense = sum(expense);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome
    ? toMoney((netSavings / totalIncome) * 100)
    : "0";

  const netWorthStart = demoNetWorthByYear.get(year - 1) ?? 900000;
  let netWorth = netWorthStart;
  const netWorthSeries = monthly.map((row) => {
    netWorth += Number(row.net) * 0.85;
    return { date: row.date, net_worth: toMoney(netWorth) };
  });

  const baseDebt = Math.max(240000, 520000 - (year - demoYear) * 14000);
  const debtSeries = monthly.map((row, idx) => ({
    date: row.date,
    debt: toMoney(Math.max(0, baseDebt - idx * 1500)),
  }));

  const expenseCategories = buildCategoryBreakdown(
    expense,
    expenseCategoryWeights,
  );
  const incomeCategories = buildCategoryBreakdown(
    income,
    incomeCategoryWeights,
  );

  const biggestIncome = income.reduce(
    (best, value, idx) =>
      value > best.amount ? { month: idx + 1, amount: value } : best,
    { month: 1, amount: income[0] ?? 0 },
  );
  const biggestExpense = expense.reduce(
    (best, value, idx) =>
      value > best.amount ? { month: idx + 1, amount: value } : best,
    { month: 1, amount: expense[0] ?? 0 },
  );

  const previousSeries = buildMonthlyTotals(year - 1);
  const prevExpenseCategories = buildCategoryBreakdown(
    previousSeries.expense,
    expenseCategoryWeights,
  );

  const categoryChanges = expenseCategories.map((category, idx) => {
    const prev = prevExpenseCategories[idx];
    const amount = Number(category.total);
    const prevAmount = Number(prev?.total ?? 0);
    const delta = amount - prevAmount;
    return {
      category_id: category.category_id,
      name: category.name,
      amount: category.total,
      prev_amount: toMoney(prevAmount),
      delta: toMoney(delta),
      delta_pct: prevAmount ? toMoney((delta / prevAmount) * 100) : null,
    };
  });

  const accountFlows = buildAccountFlows(year);

  return {
    year,
    monthly,
    net_worth: netWorthSeries,
    debt: debtSeries,
    savings: {
      income: toMoney(totalIncome),
      expense: toMoney(totalExpense),
      saved: toMoney(netSavings),
      savings_rate_pct: savingsRate,
    },
    stats: {
      total_income: toMoney(totalIncome),
      total_expense: toMoney(totalExpense),
      net_savings: toMoney(netSavings),
      savings_rate_pct: savingsRate,
      avg_monthly_spend: toMoney(totalExpense / 12),
      biggest_income_month: {
        month: biggestIncome.month,
        amount: toMoney(biggestIncome.amount),
      },
      biggest_expense_month: {
        month: biggestExpense.month,
        amount: toMoney(biggestExpense.amount),
      },
    },
    category_breakdown: expenseCategories,
    income_category_breakdown: incomeCategories,
    top_merchants: [
      { merchant: "Krogers Market", amount: "42500.00", transaction_count: 14 },
      { merchant: "SJ Rail", amount: "23800.00", transaction_count: 8 },
      {
        merchant: "Nordic Utilities",
        amount: "19500.00",
        transaction_count: 5,
      },
    ],
    largest_transactions: demoTransactionsResponse.transactions.map((tx) => ({
      id: tx.id,
      occurred_at: tx.occurred_at,
      merchant: tx.description || "Transaction",
      amount: toMoney(
        tx.legs.reduce((total, leg) => total + Math.abs(Number(leg.amount)), 0),
      ),
      category_id: tx.category_id ?? undefined,
      category_name:
        demoCategories.categories.find((cat) => cat.id === tx.category_id)
          ?.name ?? "Uncategorized",
      notes: tx.notes ?? undefined,
    })),
    category_changes: categoryChanges,
    investments_summary: buildInvestmentsSummary(year),
    debt_overview: [
      {
        account_id: "acc-mortgage",
        name: "Home Mortgage",
        start_debt: toMoney(baseDebt + 12000),
        end_debt: toMoney(baseDebt - 1500 * 11),
        delta: toMoney(-1500 * 11 - 12000),
        monthly_debt: debtSeries.map((row) => row.debt),
      },
    ],
    account_flows: accountFlows,
    income_sources: [
      {
        source: "Payroll",
        total: toMoney(totalIncome * 0.85),
        monthly: income.map((value) => toMoney(value * 0.85)),
        transaction_count: 12,
      },
      {
        source: "Investment income",
        total: toMoney(totalIncome * 0.15),
        monthly: income.map((value) => toMoney(value * 0.15)),
        transaction_count: 8,
      },
    ],
    expense_sources: [
      {
        source: "Housing",
        total: toMoney(totalExpense * 0.36),
        monthly: expense.map((value) => toMoney(value * 0.36)),
        transaction_count: 12,
      },
      {
        source: "Lifestyle",
        total: toMoney(totalExpense * 0.32),
        monthly: expense.map((value) => toMoney(value * 0.32)),
        transaction_count: 24,
      },
    ],
    insights: [
      `Net savings grew ${savingsRate}% year-to-date.`,
      "Travel and entertainment peaked in late summer.",
      "Investment contributions are pacing ahead of last year.",
    ],
  };
};

export const getDemoYearlyCategoryDetail = (
  year: number,
  categoryId: string,
  flow: "expense" | "income",
): YearlyCategoryDetailResponse => {
  const { income, expense } = buildMonthlyTotals(year);
  const weights =
    flow === "income" ? incomeCategoryWeights : expenseCategoryWeights;
  const match = weights.find((weight) => weight.id === categoryId) ?? {
    id: categoryId,
    name: "Category",
    weight: 0.15,
  };
  const totals = flow === "income" ? income : expense;
  const monthly = totals.map((value, idx) => ({
    date: monthIso(year, idx),
    month: idx + 1,
    amount: toMoney(value * match.weight),
  }));

  return {
    year,
    category_id: categoryId,
    category_name: getCategoryMeta(categoryId, match.name).name,
    monthly,
    top_merchants: [
      { merchant: "Nordic Market", amount: "12400.00", transaction_count: 8 },
      { merchant: "Urban Goods", amount: "9800.00", transaction_count: 5 },
    ],
  };
};

export const getDemoTotalOverview = (): TotalOverviewResponse => {
  const years = demoYearlyReport.map((row) => row.year);
  const lastYear = years[years.length - 1] ?? demoYear;
  const prevYear = years[years.length - 2] ?? demoYear - 1;
  const lastYearTotals = getDemoYearlyOverview(lastYear);
  const prevYearTotals = getDemoYearlyOverview(prevYear);
  const yearly = demoYearlyReport.map((row) => ({
    ...row,
    savings_rate_pct: toMoney(
      Number(row.income) > 0 ? (Number(row.net) / Number(row.income)) * 100 : 0,
    ),
  }));

  const netWorthSeries = demoNetWorthPoints.map((point) => ({
    date: periodToDate(point.period),
    net_worth: point.net_worth,
  }));

  const totalIncome = sum(demoYearlyReport.map((row) => Number(row.income)));
  const totalExpense = sum(demoYearlyReport.map((row) => Number(row.expense)));
  const cashBalance = demoAccounts.accounts
    .filter((acc) => acc.account_type === AccountType.NORMAL)
    .reduce((sum, acc) => sum + Number(acc.balance), 0);
  const debtTotal = demoAccounts.accounts
    .filter((acc) => acc.account_type === AccountType.DEBT)
    .reduce((sum, acc) => sum + Math.abs(Number(acc.balance)), 0);

  const expenseLifetime = buildCategoryTotals(
    demoYearlyReport.reduce((sum, row) => sum + Number(row.expense), 0),
    expenseCategoryWeights,
  );
  const incomeLifetime = buildCategoryTotals(
    demoYearlyReport.reduce((sum, row) => sum + Number(row.income), 0),
    incomeCategoryWeights,
  );

  const expenseMixByYear = demoYearlyReport.map((row) => ({
    year: row.year,
    categories: buildCategoryTotals(
      Number(row.expense),
      expenseCategoryWeights,
    ),
  }));

  const incomeMixByYear = demoYearlyReport.map((row) => ({
    year: row.year,
    categories: buildCategoryTotals(Number(row.income), incomeCategoryWeights),
  }));

  const buildHeatmap = (
    weights: Array<{ id: string | null; name: string; weight: number }>,
  ) => ({
    years,
    rows: weights.map((weight) => {
      const meta = getCategoryMeta(weight.id, weight.name);
      const totals = demoYearlyReport.map((row) =>
        toMoney(Number(row.expense) * weight.weight),
      );
      return {
        category_id: weight.id,
        name: meta.name,
        icon: meta.icon,
        color_hex: meta.color_hex,
        totals,
      };
    }),
  });

  const expenseHeatmap = buildHeatmap(expenseCategoryWeights);
  const incomeHeatmap = {
    years,
    rows: incomeCategoryWeights.map((weight) => {
      const meta = getCategoryMeta(weight.id, weight.name);
      const totals = demoYearlyReport.map((row) =>
        toMoney(Number(row.income) * weight.weight),
      );
      return {
        category_id: weight.id,
        name: meta.name,
        icon: meta.icon,
        color_hex: meta.color_hex,
        totals,
      };
    }),
  };

  const expenseChanges = lastYearTotals.category_breakdown.map(
    (category, idx) => {
      const prev = prevYearTotals.category_breakdown[idx];
      const amount = Number(category.total);
      const prevAmount = Number(prev?.total ?? 0);
      const delta = amount - prevAmount;
      return {
        category_id: category.category_id,
        name: category.name,
        amount: category.total,
        prev_amount: toMoney(prevAmount),
        delta: toMoney(delta),
        delta_pct: prevAmount ? toMoney((delta / prevAmount) * 100) : null,
      };
    },
  );

  const incomeChanges = lastYearTotals.income_category_breakdown.map(
    (category, idx) => {
      const prev = prevYearTotals.income_category_breakdown[idx];
      const amount = Number(category.total);
      const prevAmount = Number(prev?.total ?? 0);
      const delta = amount - prevAmount;
      return {
        category_id: category.category_id,
        name: category.name,
        amount: category.total,
        prev_amount: toMoney(prevAmount),
        delta: toMoney(delta),
        delta_pct: prevAmount ? toMoney((delta / prevAmount) * 100) : null,
      };
    },
  );

  const accounts = lastYearTotals.account_flows.map((flow) => ({
    account_id: flow.account_id,
    name: flow.name,
    account_type: flow.account_type,
    current_balance:
      demoAccounts.accounts.find((acc) => acc.id === flow.account_id)
        ?.balance ?? flow.end_balance,
    operating_income: flow.income,
    operating_expense: flow.expense,
    net_operating: flow.net_operating,
    transfers_in: flow.transfers_in,
    transfers_out: flow.transfers_out,
    net_transfers: flow.net_transfers,
    first_transaction_date: formatDate("2019-01-01"),
  }));

  return {
    as_of: nowIso,
    kpis: {
      net_worth: demoReportPayloads.netWorth.points.at(-1)?.net_worth ?? "0",
      cash_balance: toMoney(cashBalance),
      debt_total: toMoney(debtTotal),
      investments_value: demoAccounts.accounts.find(
        (acc) => acc.account_type === AccountType.INVESTMENT,
      )?.balance,
      lifetime_income: toMoney(totalIncome),
      lifetime_expense: toMoney(totalExpense),
      lifetime_saved: toMoney(totalIncome - totalExpense),
      lifetime_savings_rate_pct: toMoney(
        totalIncome ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
      ),
    },
    net_worth_series: netWorthSeries,
    monthly_income_expense: getDemoMonthlyReport(demoYear).map((row) => ({
      date: periodToDate(row.period),
      income: row.income,
      expense: row.expense,
    })),
    yearly,
    best_year: demoYearlyReport.reduce(
      (best, row) => (Number(row.net) > Number(best.net) ? row : best),
      demoYearlyReport[0],
    )?.year,
    worst_year: demoYearlyReport.reduce(
      (worst, row) => (Number(row.net) < Number(worst.net) ? row : worst),
      demoYearlyReport[0],
    )?.year,
    expense_categories_lifetime: expenseLifetime,
    income_categories_lifetime: incomeLifetime,
    expense_category_mix_by_year: expenseMixByYear,
    income_category_mix_by_year: incomeMixByYear,
    expense_category_heatmap_by_year: expenseHeatmap,
    income_category_heatmap_by_year: incomeHeatmap,
    expense_category_changes_yoy: expenseChanges,
    income_category_changes_yoy: incomeChanges,
    income_sources_lifetime: [
      {
        source: "Payroll",
        total: toMoney(totalIncome * 0.82),
        transaction_count: 92,
      },
      {
        source: "Investments",
        total: toMoney(totalIncome * 0.18),
        transaction_count: 26,
      },
    ],
    expense_sources_lifetime: [
      {
        source: "Housing",
        total: toMoney(totalExpense * 0.36),
        transaction_count: 84,
      },
      {
        source: "Lifestyle",
        total: toMoney(totalExpense * 0.28),
        transaction_count: 132,
      },
    ],
    income_source_changes_yoy: [
      {
        source: "Payroll",
        amount: toMoney(Number(yearly.at(-1)?.income ?? 0) * 0.82),
        prev_amount: toMoney(Number(yearly.at(-2)?.income ?? 0) * 0.8),
        delta: toMoney(Number(yearly.at(-1)?.income ?? 0) * 0.02),
        delta_pct: toMoney(2.4),
      },
    ],
    expense_source_changes_yoy: [
      {
        source: "Housing",
        amount: toMoney(Number(yearly.at(-1)?.expense ?? 0) * 0.36),
        prev_amount: toMoney(Number(yearly.at(-2)?.expense ?? 0) * 0.34),
        delta: toMoney(Number(yearly.at(-1)?.expense ?? 0) * 0.02),
        delta_pct: toMoney(2.1),
      },
    ],
    accounts,
    investments: {
      series: demoInvestmentOverview.portfolio.series.map((point) => ({
        date: point.date,
        value: String(point.value),
      })),
      yearly: demoInvestmentOverview.portfolio.series.map((point) => ({
        year: Number(point.date.slice(0, 4)),
        end_value: String(point.value),
        contributions: "420000.00",
        withdrawals: "-120000.00",
        net_contributions: "300000.00",
        implied_return: "8.2",
      })),
      contributions_lifetime: "4200000.00",
      withdrawals_lifetime: "-450000.00",
      net_contributions_lifetime: "3750000.00",
      accounts_latest: [
        { account_name: "Global Brokerage", value: "4700000.00" },
      ],
    },
    debt: {
      total_current: toMoney(debtTotal),
      total_prev_year_end: toMoney(debtTotal + 24000),
      change_since_prev_year_end: toMoney(-24000),
      debt_to_income_latest_year: toMoney(34.5),
      series: netWorthSeries.map((point) => ({
        date: point.date,
        debt: toMoney(debtTotal - 20000),
      })),
      accounts: [
        {
          account_id: "acc-mortgage",
          name: "Home Mortgage",
          current_debt: "520000.00",
          prev_year_end_debt: "540000.00",
          delta: "-20000.00",
        },
        {
          account_id: "acc-card",
          name: "Travel Rewards Card",
          current_debt: "11000.45",
          prev_year_end_debt: "13000.00",
          delta: "-1999.55",
        },
      ],
    },
    insights: [
      "Net worth reached an all-time high this quarter.",
      "Spending on housing stabilized while lifestyle spend grew slightly.",
      "Investment contributions remained consistent across years.",
    ],
  };
};

export const getDemoCashflowForecast = (
  days: number,
  lookbackDays = 180,
  model = "ensemble",
): CashflowForecastResponse => {
  const startingBalance = 185000;
  const averageDaily = 1200;
  const points = Array.from({ length: days }, (_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() + idx);
    const baseline = startingBalance + averageDaily * idx;
    const delta = averageDaily + (idx % 5 === 0 ? -1800 : 800);
    const balance = baseline + delta * 0.6;
    return {
      date: date.toISOString(),
      balance: toMoney(balance),
      delta: toMoney(delta),
      low: toMoney(balance - 5500),
      high: toMoney(balance + 6200),
      baseline: toMoney(baseline),
      weekday_component: toMoney((idx % 7) * 120),
      monthday_component: toMoney((idx % 28) * 80),
    };
  });

  return {
    starting_balance: toMoney(startingBalance),
    average_daily: toMoney(averageDaily),
    threshold: "0",
    alert_below_threshold_at: null,
    points,
    model,
    lookback_days: lookbackDays,
    residual_std: "1200",
    weekday_averages: ["920", "1150", "1240", "1180", "1320", "980", "760"],
    monthday_averages: Array.from({ length: 31 }, (_, idx) =>
      idx % 6 === 0 ? "-820" : "680",
    ),
  };
};

export const getDemoNetWorthProjection = (
  months: number,
): NetWorthProjectionResponse => {
  const current = Number(
    demoReportPayloads.netWorth.points.at(-1)?.net_worth ?? 1800000,
  );
  const points = Array.from({ length: months }, (_, idx) => {
    const date = new Date();
    date.setMonth(date.getMonth() + idx);
    const base = current + idx * 42000;
    return {
      date: date.toISOString(),
      net_worth: toMoney(base),
      low: toMoney(base - 85000),
      high: toMoney(base + 95000),
    };
  });
  const methods = {
    conservative: points.map((point) => ({
      ...point,
      net_worth: toMoney(Number(point.net_worth) * 0.96),
    })),
    aggressive: points.map((point) => ({
      ...point,
      net_worth: toMoney(Number(point.net_worth) * 1.04),
    })),
  };

  return {
    current: toMoney(current),
    cagr: "8.4",
    points,
    recommended_method: "hybrid",
    methods,
    insights: [
      "Projected net worth crosses 3.0M SEK in 12 months.",
      "Investment growth contributes ~60% of gains.",
      "Scenario spread narrows after month 18.",
    ],
  };
};

export const demoGoals: GoalListResponse = {
  goals: [
    {
      id: "goal-1",
      name: "Family vacation",
      target_amount: "120000.00",
      target_date: formatDate("2025-06-30"),
      category_id: "cat-exp-entertainment",
      account_id: "acc-savings",
      subscription_id: null,
      note: "Summer trip to Lofoten",
      created_at: formatDate("2024-01-15"),
      updated_at: nowIso,
      current_amount: "68000.00",
      progress_pct: 56.67,
    },
    {
      id: "goal-2",
      name: "Home renovation",
      target_amount: "350000.00",
      target_date: formatDate("2026-12-31"),
      category_id: "cat-exp-rent",
      account_id: "acc-savings",
      subscription_id: null,
      note: "Kitchen and deck refresh",
      created_at: formatDate("2023-08-01"),
      updated_at: nowIso,
      current_amount: "145000.00",
      progress_pct: 41.43,
    },
  ],
};

export const demoSubscriptions: SubscriptionSummaryResponse = {
  subscriptions: [
    {
      id: "sub-1",
      name: "Nordic Stream",
      matcher_text: "NORDIC STREAM",
      matcher_amount_tolerance: 25,
      matcher_day_of_month: 3,
      category_id: "cat-exp-entertainment",
      is_active: true,
      created_at: formatDate("2022-02-01"),
      updated_at: nowIso,
      current_month_spend: "199.00",
      trailing_three_month_spend: "597.00",
      trailing_twelve_month_spend: "2388.00",
      trend: ["199.00", "199.00", "199.00", "199.00", "199.00", "199.00"],
      last_charge_at: demoDate(0, 3),
      category_name: "Entertainment",
    },
    {
      id: "sub-2",
      name: "GymPlus",
      matcher_text: "GYMPLUS",
      matcher_amount_tolerance: 50,
      matcher_day_of_month: 12,
      category_id: "cat-exp-entertainment",
      is_active: true,
      created_at: formatDate("2021-04-15"),
      updated_at: nowIso,
      current_month_spend: "499.00",
      trailing_three_month_spend: "1497.00",
      trailing_twelve_month_spend: "5988.00",
      trend: ["499.00", "499.00", "499.00", "499.00", "499.00", "499.00"],
      last_charge_at: demoDate(0, 12),
      category_name: "Entertainment",
    },
    {
      id: "sub-3",
      name: "Morning Coffee Club",
      matcher_text: "COFFEE CLUB",
      matcher_amount_tolerance: 15,
      matcher_day_of_month: 20,
      category_id: "cat-exp-groceries",
      is_active: false,
      created_at: formatDate("2020-10-10"),
      updated_at: nowIso,
      current_month_spend: "129.00",
      trailing_three_month_spend: "387.00",
      trailing_twelve_month_spend: "1548.00",
      trend: ["129.00", "129.00", "129.00", "129.00", "129.00", "129.00"],
      last_charge_at: demoDate(-1, 20),
      category_name: "Groceries",
    },
  ],
};

export const getDemoTaxSummary = (year: number): TaxSummaryResponse => {
  const monthly = Array.from({ length: 12 }, (_, idx) => {
    const base = 8200 + idx * 120;
    return {
      month: idx + 1,
      net_tax_paid: toMoney(base),
    };
  });
  const total = monthly.reduce((sum, row) => sum + Number(row.net_tax_paid), 0);
  const largest = monthly.reduce(
    (best, row) =>
      Number(row.net_tax_paid) > Number(best.net_tax_paid) ? row : best,
    monthly[0],
  );
  return {
    year,
    monthly,
    totals: {
      net_tax_paid_ytd: toMoney(total),
      net_tax_paid_last_12m: toMoney(total),
      largest_month: largest.month,
      largest_month_value: largest.net_tax_paid,
    },
  };
};

export const demoTaxTotalSummary: TaxTotalSummaryResponse = {
  yearly: demoYearlyReport.map((row) => {
    const payments = Number(row.expense) * 0.09;
    const refunds = Number(row.expense) * 0.01;
    return {
      year: row.year,
      payments: toMoney(payments),
      refunds: toMoney(refunds),
      net_tax_paid: toMoney(payments - refunds),
    };
  }),
  totals: {
    total_payments: toMoney(
      demoYearlyReport.reduce(
        (sum, row) => sum + Number(row.expense) * 0.09,
        0,
      ),
    ),
    total_refunds: toMoney(
      demoYearlyReport.reduce(
        (sum, row) => sum + Number(row.expense) * 0.01,
        0,
      ),
    ),
    net_tax_paid_all_time: toMoney(
      demoYearlyReport.reduce(
        (sum, row) => sum + Number(row.expense) * 0.08,
        0,
      ),
    ),
    net_tax_paid_ytd: toMoney(
      Number(demoYearlyReport.at(-1)?.expense ?? 0) * 0.08,
    ),
    net_tax_paid_last_12m: toMoney(
      Number(demoYearlyReport.at(-1)?.expense ?? 0) * 0.08,
    ),
    largest_year: demoYear,
    largest_year_value: toMoney(
      Number(demoYearlyReport.at(-1)?.expense ?? 0) * 0.08,
    ),
  },
};

export const demoTaxEvents: TaxEventListResponse = {
  events: [
    {
      id: "tax-evt-1",
      transaction_id: "tax-tx-1",
      occurred_at: demoDate(0, 10),
      description: "Q4 estimated payment",
      event_type: TaxEventType.PAYMENT,
      authority: "Skatteverket",
      note: "Paid early",
      account_id: "acc-checking",
      account_name: "Everyday Checking",
      amount: "9800.00",
    },
    {
      id: "tax-evt-2",
      transaction_id: "tax-tx-2",
      occurred_at: demoDate(-1, 4),
      description: "Annual refund",
      event_type: TaxEventType.REFUND,
      authority: "Skatteverket",
      note: "Auto-deposited",
      account_id: "acc-checking",
      account_name: "Everyday Checking",
      amount: "4200.00",
    },
  ],
};
