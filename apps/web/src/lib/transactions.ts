import {
  TaxEventType,
  TransactionType,
  type TransactionRead,
} from "@/types/api";

type TaxAware = Pick<TransactionRead, "transaction_type" | "tax_event">;

const baseTypeLabel: Record<TransactionType, string> = {
  [TransactionType.INCOME]: "Income",
  [TransactionType.EXPENSE]: "Expense",
  [TransactionType.TRANSFER]: "Transfer",
  [TransactionType.ADJUSTMENT]: "Adjustment",
  [TransactionType.INVESTMENT_EVENT]: "Investment",
};

const typeTone: Record<TransactionType, string> = {
  [TransactionType.INCOME]: "bg-emerald-100 text-emerald-800",
  [TransactionType.EXPENSE]: "bg-rose-100 text-rose-800",
  [TransactionType.TRANSFER]: "bg-slate-100 text-slate-700",
  [TransactionType.ADJUSTMENT]: "bg-amber-100 text-amber-800",
  [TransactionType.INVESTMENT_EVENT]: "bg-indigo-100 text-indigo-800",
};

export const isTaxEvent = (tx: TaxAware) => Boolean(tx.tax_event);

export const getDisplayTransactionType = (tx: TaxAware): TransactionType => {
  const eventType = tx.tax_event?.event_type;
  if (eventType === TaxEventType.REFUND) return TransactionType.INCOME;
  if (eventType === TaxEventType.PAYMENT) return TransactionType.EXPENSE;
  return tx.transaction_type;
};

export const getTransactionTypeLabel = (tx: TaxAware): string => {
  const eventType = tx.tax_event?.event_type;
  if (eventType) return "Tax";
  const displayType = getDisplayTransactionType(tx);
  return baseTypeLabel[displayType] ?? tx.transaction_type;
};

export const getTransactionTone = (tx: TaxAware): string => {
  if (tx.tax_event) return "bg-yellow-100 text-yellow-800";
  const displayType = getDisplayTransactionType(tx);
  return typeTone[displayType];
};

export const getTransactionBadge = (tx: TaxAware) => ({
  label: getTransactionTypeLabel(tx),
  toneClass: getTransactionTone(tx),
});

export const taxAdjustedAmountHint = (
  tx: Pick<TransactionRead, "transaction_type" | "legs" | "tax_event">,
) => {
  const largest = tx.legs.reduce<null | number>((best, leg) => {
    const numeric = Number(leg.amount);
    if (!Number.isFinite(numeric)) return best;
    if (best === null) return numeric;
    return Math.abs(numeric) > Math.abs(best) ? numeric : best;
  }, null);

  const value = largest ?? 0;
  const displayType = getDisplayTransactionType(tx);

  if (displayType === TransactionType.INCOME) return Math.abs(value);
  if (displayType === TransactionType.EXPENSE) return -Math.abs(value);
  if (displayType === TransactionType.TRANSFER) return Math.abs(value);
  return value;
};

export type { TaxAware };
