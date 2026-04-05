import type {
  TaxTotalSummaryResponse,
  TotalOverviewResponse,
  YearlyOverviewResponse,
} from "@/types/api";

type EconomySummaryOptions = {
  totalOverview: TotalOverviewResponse;
  yearlyOverview: YearlyOverviewResponse;
  taxTotalSummary?: TaxTotalSummaryResponse | null;
  currencyCode?: string;
  ownerName?: string;
  generatedAt?: Date;
};

const MONEY_LOCALE = "en-US";
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const toNumber = (value: string | number | null | undefined) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatMoney = (
  value: string | number | null | undefined,
  currencyCode: string,
) => {
  if (value === null || value === undefined || value === "") return "n/a";
  return `${currencyCode} ${toNumber(value).toLocaleString(MONEY_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatPercent = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "n/a";
  return `${toNumber(value).toLocaleString(MONEY_LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
};

const sharePercent = (
  part: string | number | null | undefined,
  total: string | number | null | undefined,
) => {
  const totalValue = toNumber(total);
  if (totalValue <= 0) return null;
  return (toNumber(part) / totalValue) * 100;
};

const formatCount = (value: number | null | undefined) =>
  toNumber(value).toLocaleString(MONEY_LOCALE, {
    maximumFractionDigits: 0,
  });

const formatDate = (value: string | null | undefined) => {
  if (!value) return "n/a";
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return value;
  return asDate.toISOString().slice(0, 10);
};

const formatDateTime = (value: Date) => value.toISOString();

const formatMonth = (month: number) => monthNames[Math.max(0, month - 1)] ?? "";

const formatAccountType = (value: string) => {
  switch (value) {
    case "debt":
      return "Debt";
    case "investment":
      return "Investment";
    default:
      return "Cash / Operating";
  }
};

const escapeCell = (value: unknown) =>
  String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .trim();

const renderTable = (
  headers: string[],
  rows: string[][],
  emptyMessage = "No data available.",
) => {
  if (!rows.length) return `${emptyMessage}\n`;
  return [
    `| ${headers.map(escapeCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ].join("\n");
};

const renderBulletList = (items: string[], emptyMessage = "None.") => {
  if (!items.length) return `- ${emptyMessage}`;
  return items.map((item) => `- ${item}`).join("\n");
};

const sumNumbers = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "economy-summary";

const getNetWorthTrend = (
  points: TotalOverviewResponse["net_worth_series"],
  currencyCode: string,
) => {
  if (!points.length) return null;

  const sorted = [...points]
    .map((point) => ({
      ...point,
      time: new Date(point.date).getTime(),
    }))
    .filter((point) => Number.isFinite(point.time))
    .sort((a, b) => a.time - b.time);

  const latest = sorted.at(-1);
  if (!latest) return null;

  const twelveMonthsAgo = new Date(latest.time);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const previous = sorted
    .filter((point) => point.time <= twelveMonthsAgo.getTime())
    .at(-1);

  return {
    latestDate: formatDate(latest.date),
    latestNetWorth: formatMoney(latest.net_worth, currencyCode),
    trailing12mDelta: previous
      ? formatMoney(
          toNumber(latest.net_worth) - toNumber(previous.net_worth),
          currencyCode,
        )
      : "n/a",
    trailing12mStart: previous ? formatDate(previous.date) : null,
  };
};

export const buildEconomySummaryMarkdown = ({
  totalOverview,
  yearlyOverview,
  taxTotalSummary,
  currencyCode,
  ownerName,
  generatedAt = new Date(),
}: EconomySummaryOptions) => {
  const resolvedCurrency = currencyCode?.toUpperCase() || "SEK";
  const currentYear = yearlyOverview.year;
  const currentYearLabel = formatDate(totalOverview.as_of).startsWith(
    String(currentYear),
  )
    ? `${currentYear} year-to-date`
    : String(currentYear);
  const currentYearNetWorthByMonth = new Map(
    (yearlyOverview.net_worth ?? []).map((point) => [
      formatDate(point.date).slice(0, 7),
      point.net_worth,
    ]),
  );
  const netWorthTrend = getNetWorthTrend(
    totalOverview.net_worth_series ?? [],
    resolvedCurrency,
  );
  const totalInsights = totalOverview.insights ?? [];
  const yearlyInsights = yearlyOverview.insights ?? [];
  const annualHistory = [...(totalOverview.yearly ?? [])].sort(
    (a, b) => b.year - a.year,
  );
  const accounts = [...(totalOverview.accounts ?? [])].sort((a, b) => {
    const balanceDiff =
      Math.abs(toNumber(b.current_balance)) -
      Math.abs(toNumber(a.current_balance));
    if (balanceDiff !== 0) return balanceDiff;
    return a.name.localeCompare(b.name);
  });
  const expenseCategories = [...(yearlyOverview.category_breakdown ?? [])].sort(
    (a, b) => toNumber(b.total) - toNumber(a.total),
  );
  const incomeCategories = [
    ...(yearlyOverview.income_category_breakdown ?? []),
  ].sort((a, b) => toNumber(b.total) - toNumber(a.total));
  const expenseSources = [...(yearlyOverview.expense_sources ?? [])].sort(
    (a, b) => toNumber(b.total) - toNumber(a.total),
  );
  const incomeSources = [...(yearlyOverview.income_sources ?? [])].sort(
    (a, b) => toNumber(b.total) - toNumber(a.total),
  );
  const topMerchants = [...(yearlyOverview.top_merchants ?? [])].sort(
    (a, b) => toNumber(b.amount) - toNumber(a.amount),
  );
  const largestTransactions = [
    ...(yearlyOverview.largest_transactions ?? []),
  ].sort((a, b) => Math.abs(toNumber(b.amount)) - Math.abs(toNumber(a.amount)));
  const currentYearExpenseTotal = toNumber(yearlyOverview.stats.total_expense);
  const lifetimeExpenseTotal = toNumber(totalOverview.kpis.lifetime_expense);
  const lifetimeExpenseCategories = [
    ...(totalOverview.expense_categories_lifetime ?? []),
  ].sort((a, b) => toNumber(b.total) - toNumber(a.total));
  const expenseCategoryChanges = [
    ...(totalOverview.expense_category_changes_yoy ?? []),
  ].sort((a, b) => Math.abs(toNumber(b.delta)) - Math.abs(toNumber(a.delta)));
  const topLifetimeExpenseCategory = lifetimeExpenseCategories[0];
  const topLifetimeExpenseCategoryShare = sharePercent(
    topLifetimeExpenseCategory?.total,
    lifetimeExpenseTotal,
  );
  const biggestExpenseCategoryIncrease = expenseCategoryChanges
    .filter((entry) => toNumber(entry.delta) > 0)
    .sort((a, b) => toNumber(b.delta) - toNumber(a.delta))[0];
  const biggestExpenseCategoryDecrease = expenseCategoryChanges
    .filter((entry) => toNumber(entry.delta) < 0)
    .sort((a, b) => toNumber(a.delta) - toNumber(b.delta))[0];
  const topFiveExpenseCategoriesShare = sharePercent(
    sumNumbers(
      expenseCategories.slice(0, 5).map((entry) => toNumber(entry.total)),
    ),
    currentYearExpenseTotal,
  );
  const topExpenseCategory = expenseCategories[0];
  const topExpenseCategoryShare = sharePercent(
    topExpenseCategory?.total,
    currentYearExpenseTotal,
  );
  const topThreeExpenseCategoriesShare = sharePercent(
    sumNumbers(
      expenseCategories.slice(0, 3).map((entry) => toNumber(entry.total)),
    ),
    currentYearExpenseTotal,
  );
  const filename = `finance-tracker-${slugify(ownerName || "economy")}-${formatDate(
    totalOverview.as_of,
  )}.md`;

  const sections = [
    "# Finance Tracker Economy Summary",
    "",
    "This markdown file is intended to give another LLM enough context to discuss the current economy without opening the app.",
    "",
    `- Generated at: ${formatDateTime(generatedAt)}`,
    `- Data as of: ${formatDate(totalOverview.as_of)}`,
    `- Reporting focus: ${currentYearLabel}`,
    `- Currency: ${resolvedCurrency}`,
    ...(ownerName ? [`- Profile: ${ownerName}`] : []),
    "",
    "## Snapshot",
    `- Current net worth: ${formatMoney(totalOverview.kpis.net_worth, resolvedCurrency)}`,
    `- Cash balance: ${formatMoney(totalOverview.kpis.cash_balance, resolvedCurrency)}`,
    `- Investments value: ${formatMoney(totalOverview.kpis.investments_value, resolvedCurrency)}`,
    `- Debt total: ${formatMoney(totalOverview.kpis.debt_total, resolvedCurrency)}`,
    `- Lifetime income: ${formatMoney(totalOverview.kpis.lifetime_income, resolvedCurrency)}`,
    `- Lifetime expense: ${formatMoney(totalOverview.kpis.lifetime_expense, resolvedCurrency)}`,
    `- Lifetime saved: ${formatMoney(totalOverview.kpis.lifetime_saved, resolvedCurrency)}`,
    `- Lifetime savings rate: ${formatPercent(totalOverview.kpis.lifetime_savings_rate_pct)}`,
    ...(netWorthTrend
      ? [
          `- Latest net worth point: ${netWorthTrend.latestNetWorth} on ${netWorthTrend.latestDate}`,
          `- Trailing 12-month net worth change: ${netWorthTrend.trailing12mDelta}${netWorthTrend.trailing12mStart ? ` since ${netWorthTrend.trailing12mStart}` : ""}`,
        ]
      : []),
    "",
    `## Current Year (${currentYearLabel})`,
    `- Total income: ${formatMoney(yearlyOverview.stats.total_income, resolvedCurrency)}`,
    `- Total expense: ${formatMoney(yearlyOverview.stats.total_expense, resolvedCurrency)}`,
    `- Net savings: ${formatMoney(yearlyOverview.stats.net_savings, resolvedCurrency)}`,
    `- Savings rate: ${formatPercent(yearlyOverview.stats.savings_rate_pct)}`,
    `- Average monthly spend: ${formatMoney(yearlyOverview.stats.avg_monthly_spend, resolvedCurrency)}`,
    `- Biggest income month: ${formatMonth(yearlyOverview.stats.biggest_income_month.month)} (${formatMoney(yearlyOverview.stats.biggest_income_month.amount, resolvedCurrency)})`,
    `- Biggest expense month: ${formatMonth(yearlyOverview.stats.biggest_expense_month.month)} (${formatMoney(yearlyOverview.stats.biggest_expense_month.amount, resolvedCurrency)})`,
    `- Current-year savings indicator: saved ${formatMoney(yearlyOverview.savings.saved, resolvedCurrency)} from ${formatMoney(yearlyOverview.savings.income, resolvedCurrency)} income and ${formatMoney(yearlyOverview.savings.expense, resolvedCurrency)} expense`,
    ...(taxTotalSummary
      ? [
          `- Net tax paid year-to-date: ${formatMoney(taxTotalSummary.totals.net_tax_paid_ytd, resolvedCurrency)}`,
          `- Net tax paid last 12 months: ${formatMoney(taxTotalSummary.totals.net_tax_paid_last_12m, resolvedCurrency)}`,
        ]
      : []),
    "",
    "## Expense Category Insights",
    `- Current-year expense categories tracked: ${formatCount(expenseCategories.length)}`,
    `- Lifetime expense categories tracked: ${formatCount(lifetimeExpenseCategories.length)}`,
    `- Largest expense category: ${topExpenseCategory ? `${topExpenseCategory.name} (${formatMoney(topExpenseCategory.total, resolvedCurrency)}, ${formatPercent(topExpenseCategoryShare)})` : "n/a"}`,
    `- Top 3 expense categories share of current-year spend: ${formatPercent(topThreeExpenseCategoriesShare)}`,
    `- Top 5 expense categories share of current-year spend: ${formatPercent(topFiveExpenseCategoriesShare)}`,
    `- Largest lifetime expense category: ${topLifetimeExpenseCategory ? `${topLifetimeExpenseCategory.name} (${formatMoney(topLifetimeExpenseCategory.total, resolvedCurrency)}, ${formatPercent(topLifetimeExpenseCategoryShare)})` : "n/a"}`,
    `- Biggest year-over-year increase in expense category: ${biggestExpenseCategoryIncrease ? `${biggestExpenseCategoryIncrease.name} (${formatMoney(biggestExpenseCategoryIncrease.delta, resolvedCurrency)}, ${formatPercent(biggestExpenseCategoryIncrease.delta_pct)})` : "n/a"}`,
    `- Biggest year-over-year decrease in expense category: ${biggestExpenseCategoryDecrease ? `${biggestExpenseCategoryDecrease.name} (${formatMoney(biggestExpenseCategoryDecrease.delta, resolvedCurrency)}, ${formatPercent(biggestExpenseCategoryDecrease.delta_pct)})` : "n/a"}`,
    "",
    "### Current-year insights",
    renderBulletList(
      yearlyInsights,
      "No current-year insights were returned by the API.",
    ),
    "",
    "### All-time insights",
    renderBulletList(
      totalInsights,
      "No all-time insights were returned by the API.",
    ),
    "",
    "## Annual History",
    renderTable(
      ["Year", "Income", "Expense", "Net", "Savings rate"],
      annualHistory.map((entry) => [
        String(entry.year),
        formatMoney(entry.income, resolvedCurrency),
        formatMoney(entry.expense, resolvedCurrency),
        formatMoney(entry.net, resolvedCurrency),
        formatPercent(entry.savings_rate_pct),
      ]),
      "No yearly history available.",
    ),
    "",
    "## Accounts",
    renderTable(
      [
        "Account",
        "Type",
        "Current balance",
        "Operating income",
        "Operating expense",
        "Net transfers",
        "First transaction",
      ],
      accounts.map((account) => [
        account.name,
        formatAccountType(account.account_type),
        formatMoney(account.current_balance, resolvedCurrency),
        formatMoney(account.operating_income, resolvedCurrency),
        formatMoney(account.operating_expense, resolvedCurrency),
        formatMoney(account.net_transfers, resolvedCurrency),
        formatDate(account.first_transaction_date),
      ]),
      "No accounts available.",
    ),
    "",
    "## Current-Year Monthly Flow",
    renderTable(
      ["Month", "Income", "Expense", "Net", "Ending net worth"],
      (yearlyOverview.monthly ?? []).map((entry) => [
        formatMonth(entry.month),
        formatMoney(entry.income, resolvedCurrency),
        formatMoney(entry.expense, resolvedCurrency),
        formatMoney(entry.net, resolvedCurrency),
        formatMoney(
          currentYearNetWorthByMonth.get(formatDate(entry.date).slice(0, 7)),
          resolvedCurrency,
        ),
      ]),
      "No monthly flow available.",
    ),
    "",
    "## Current-Year Account Flows",
    renderTable(
      [
        "Account",
        "Type",
        "Start balance",
        "End balance",
        "Change",
        "Income",
        "Expense",
        "Transfers in",
        "Transfers out",
      ],
      (yearlyOverview.account_flows ?? [])
        .slice()
        .sort(
          (a, b) => Math.abs(toNumber(b.change)) - Math.abs(toNumber(a.change)),
        )
        .map((entry) => [
          entry.name,
          formatAccountType(entry.account_type),
          formatMoney(entry.start_balance, resolvedCurrency),
          formatMoney(entry.end_balance, resolvedCurrency),
          formatMoney(entry.change, resolvedCurrency),
          formatMoney(entry.income, resolvedCurrency),
          formatMoney(entry.expense, resolvedCurrency),
          formatMoney(entry.transfers_in, resolvedCurrency),
          formatMoney(entry.transfers_out, resolvedCurrency),
        ]),
      "No account flow data available.",
    ),
    "",
    "## Current-Year Expense Categories",
    renderTable(
      ["Category", "Total", "Share of spend", "Transactions"],
      expenseCategories.map((entry) => [
        entry.name,
        formatMoney(entry.total, resolvedCurrency),
        formatPercent(sharePercent(entry.total, currentYearExpenseTotal)),
        formatCount(entry.transaction_count),
      ]),
      "No expense categories available.",
    ),
    "",
    "## Lifetime Expense Categories",
    renderTable(
      [
        "Category",
        "Lifetime total",
        "Share of lifetime expense",
        "Transactions",
      ],
      lifetimeExpenseCategories.map((entry) => [
        entry.name,
        formatMoney(entry.total, resolvedCurrency),
        formatPercent(sharePercent(entry.total, lifetimeExpenseTotal)),
        formatCount(entry.transaction_count),
      ]),
      "No lifetime expense category data available.",
    ),
    "",
    "## Expense Category Changes YoY",
    renderTable(
      ["Category", "Current amount", "Previous amount", "Delta", "Delta %"],
      expenseCategoryChanges.map((entry) => [
        entry.name,
        formatMoney(entry.amount, resolvedCurrency),
        formatMoney(entry.prev_amount, resolvedCurrency),
        formatMoney(entry.delta, resolvedCurrency),
        formatPercent(entry.delta_pct),
      ]),
      "No year-over-year expense category changes available.",
    ),
    "",
    "## Current-Year Income Categories",
    renderTable(
      ["Category", "Total", "Transactions"],
      incomeCategories.map((entry) => [
        entry.name,
        formatMoney(entry.total, resolvedCurrency),
        formatCount(entry.transaction_count),
      ]),
      "No income categories available.",
    ),
    "",
    "## Current-Year Expense Sources",
    renderTable(
      ["Source", "Total", "Share of spend", "Transactions"],
      expenseSources.map((entry) => [
        entry.source,
        formatMoney(entry.total, resolvedCurrency),
        formatPercent(sharePercent(entry.total, currentYearExpenseTotal)),
        formatCount(entry.transaction_count),
      ]),
      "No expense sources available.",
    ),
    "",
    "## Current-Year Income Sources",
    renderTable(
      ["Source", "Total", "Transactions"],
      incomeSources.map((entry) => [
        entry.source,
        formatMoney(entry.total, resolvedCurrency),
        formatCount(entry.transaction_count),
      ]),
      "No income sources available.",
    ),
    "",
    "## Current-Year Top Merchants",
    renderTable(
      ["Merchant", "Amount", "Share of spend", "Transactions"],
      topMerchants.map((entry) => [
        entry.merchant,
        formatMoney(entry.amount, resolvedCurrency),
        formatPercent(sharePercent(entry.amount, currentYearExpenseTotal)),
        formatCount(entry.transaction_count),
      ]),
      "No merchant summary available.",
    ),
    "",
    "## Current-Year Largest Transactions",
    renderTable(
      ["Date", "Merchant", "Category", "Amount"],
      largestTransactions.map((entry) => [
        formatDate(entry.occurred_at),
        entry.merchant,
        entry.category_name,
        formatMoney(entry.amount, resolvedCurrency),
      ]),
      "No large transactions available.",
    ),
    "",
    "## Debt Overview",
    `- Total current debt: ${formatMoney(totalOverview.debt.total_current, resolvedCurrency)}`,
    `- Change since previous year-end: ${formatMoney(totalOverview.debt.change_since_prev_year_end, resolvedCurrency)}`,
    `- Debt to income (latest year): ${formatPercent(totalOverview.debt.debt_to_income_latest_year)}`,
    "",
    renderTable(
      ["Debt account", "Current debt", "Previous year-end debt", "Delta"],
      (totalOverview.debt.accounts ?? [])
        .slice()
        .sort((a, b) => toNumber(b.current_debt) - toNumber(a.current_debt))
        .map((entry) => [
          entry.name,
          formatMoney(entry.current_debt, resolvedCurrency),
          formatMoney(entry.prev_year_end_debt, resolvedCurrency),
          formatMoney(entry.delta, resolvedCurrency),
        ]),
      "No debt accounts available.",
    ),
    "",
    "## Investments",
    `- Current investment value: ${formatMoney(
      totalOverview.investments?.accounts_latest?.reduce(
        (sum, entry) => sum + toNumber(entry.value),
        0,
      ),
      resolvedCurrency,
    )}`,
    `- Lifetime contributions: ${formatMoney(totalOverview.investments?.contributions_lifetime, resolvedCurrency)}`,
    `- Lifetime withdrawals: ${formatMoney(totalOverview.investments?.withdrawals_lifetime, resolvedCurrency)}`,
    `- Lifetime net contributions: ${formatMoney(totalOverview.investments?.net_contributions_lifetime, resolvedCurrency)}`,
    `- Current-year investment start value: ${formatMoney(yearlyOverview.investments_summary.start_value, resolvedCurrency)}`,
    `- Current-year investment end value: ${formatMoney(yearlyOverview.investments_summary.end_value, resolvedCurrency)}`,
    `- Current-year investment change: ${formatMoney(yearlyOverview.investments_summary.change, resolvedCurrency)}`,
    `- Current-year investment change pct: ${formatPercent(yearlyOverview.investments_summary.change_pct)}`,
    `- Current-year contributions: ${formatMoney(yearlyOverview.investments_summary.contributions, resolvedCurrency)}`,
    `- Current-year withdrawals: ${formatMoney(yearlyOverview.investments_summary.withdrawals, resolvedCurrency)}`,
    "",
    renderTable(
      ["Investment account", "Start value", "End value", "Change"],
      (yearlyOverview.investments_summary.accounts ?? [])
        .slice()
        .sort((a, b) => toNumber(b.end_value) - toNumber(a.end_value))
        .map((entry) => [
          entry.account_name,
          formatMoney(entry.start_value, resolvedCurrency),
          formatMoney(entry.end_value, resolvedCurrency),
          formatMoney(entry.change, resolvedCurrency),
        ]),
      "No investment account summary available.",
    ),
    "",
    "## Taxes",
    ...(taxTotalSummary
      ? [
          `- Total payments: ${formatMoney(taxTotalSummary.totals.total_payments, resolvedCurrency)}`,
          `- Total refunds: ${formatMoney(taxTotalSummary.totals.total_refunds, resolvedCurrency)}`,
          `- Net tax paid all time: ${formatMoney(taxTotalSummary.totals.net_tax_paid_all_time, resolvedCurrency)}`,
          `- Net tax paid last 12 months: ${formatMoney(taxTotalSummary.totals.net_tax_paid_last_12m, resolvedCurrency)}`,
          renderTable(
            ["Year", "Payments", "Refunds", "Net tax paid"],
            (taxTotalSummary.yearly ?? [])
              .slice()
              .sort((a, b) => b.year - a.year)
              .map((entry) => [
                String(entry.year),
                formatMoney(entry.payments, resolvedCurrency),
                formatMoney(entry.refunds, resolvedCurrency),
                formatMoney(entry.net_tax_paid, resolvedCurrency),
              ]),
            "No tax history available.",
          ),
        ]
      : ["Tax totals could not be loaded for this export."]),
    "",
    "## Notes",
    "- Income and expense totals exclude transfers unless explicitly listed in account-flow sections.",
    "- Current-year values are year-to-date if the current year is still in progress.",
    "- This file is intended as a handoff context for analysis, planning, and financial discussion with another LLM.",
    "",
  ];

  return {
    filename,
    content: sections.join("\n"),
  };
};

export const downloadMarkdownFile = (filename: string, content: string) => {
  const blob = new Blob([content], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
