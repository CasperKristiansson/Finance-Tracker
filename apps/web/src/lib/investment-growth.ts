export const INVESTMENT_GROWTH_LABEL = "Investment growth";
export const INVESTMENT_LOSS_LABEL = "Investment loss";
export const INVESTMENT_GROWTH_ID = "__investment_growth__";
export const INVESTMENT_LOSS_ID = "__investment_loss__";
export const INVESTMENT_GROWTH_COLOR = "#6366f1";
export const INVESTMENT_LOSS_COLOR = "#be123c";

export const isSyntheticInvestmentId = (id: string | null | undefined) =>
  id === INVESTMENT_GROWTH_ID || id === INVESTMENT_LOSS_ID;

export const isSyntheticInvestmentLabel = (label: string | null | undefined) =>
  label === INVESTMENT_GROWTH_LABEL || label === INVESTMENT_LOSS_LABEL;

export const splitInvestmentGrowth = (
  rawValue: number | string | null | undefined,
) => {
  const value = Number(rawValue ?? 0);
  const growth = Number.isFinite(value) ? value : 0;
  return {
    growth,
    incomeLike: growth > 0 ? growth : 0,
    expenseLike: growth < 0 ? Math.abs(growth) : 0,
  };
};

export const applyInvestmentGrowth = (
  income: number,
  expense: number,
  rawGrowth: number | string | null | undefined,
  includeInvestmentGrowth: boolean,
) => {
  const { growth, incomeLike, expenseLike } = splitInvestmentGrowth(rawGrowth);
  const adjustedIncome = includeInvestmentGrowth ? income + incomeLike : income;
  const adjustedExpense = includeInvestmentGrowth
    ? expense + expenseLike
    : expense;
  return {
    income: adjustedIncome,
    expense: adjustedExpense,
    net: adjustedIncome - adjustedExpense,
    investmentMarketGrowth: growth,
    investmentIncomeLike: incomeLike,
    investmentExpenseLike: expenseLike,
  };
};

export const syntheticInvestmentCategory = (rawGrowth: number) => {
  const { incomeLike, expenseLike } = splitInvestmentGrowth(rawGrowth);
  if (incomeLike > 0) {
    return {
      id: INVESTMENT_GROWTH_ID,
      name: INVESTMENT_GROWTH_LABEL,
      total: incomeLike,
      color: INVESTMENT_GROWTH_COLOR,
      source: INVESTMENT_GROWTH_LABEL,
      txCount: 0,
      monthly: [] as Array<{ month: string; total: number }>,
    };
  }
  if (expenseLike > 0) {
    return {
      id: INVESTMENT_LOSS_ID,
      name: INVESTMENT_LOSS_LABEL,
      total: expenseLike,
      color: INVESTMENT_LOSS_COLOR,
      source: INVESTMENT_LOSS_LABEL,
      txCount: 0,
      monthly: [] as Array<{ month: string; total: number }>,
    };
  }
  return null;
};
