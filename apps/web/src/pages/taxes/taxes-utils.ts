import { formatDate } from "@/lib/format";
import { TaxEventType } from "@/types/api";

export type TaxEventFormValues = {
  event_type: TaxEventType;
  account_id: string;
  occurred_at: string;
  amount: string;
  description: string;
  note: string;
};

const TAX_EVENT_DEFAULT_DESCRIPTION = "Skatteverket";

export const TAX_EVENTS_PAGE_SIZE = 100;

export const taxEventTone: Record<TaxEventType, string> = {
  [TaxEventType.PAYMENT]: "bg-rose-100 text-rose-800",
  [TaxEventType.REFUND]: "bg-emerald-100 text-emerald-800",
};

export const monthLabel = (year: number, month: number) =>
  formatDate(Date.UTC(year, month - 1, 1), {
    month: "short",
  });

export const isoDate = (value: string) => value.slice(0, 10);

export const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
};

export const formatDisplayDate = (iso: string) =>
  formatDate(iso, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const yearRangeIso = (year: number) => ({
  start: new Date(Date.UTC(year, 0, 1)).toISOString(),
  end: new Date(Date.UTC(year + 1, 0, 1)).toISOString(),
});

export const getDefaultTaxEventFormValues = (): TaxEventFormValues => ({
  event_type: TaxEventType.PAYMENT,
  account_id: "",
  occurred_at: new Date().toISOString().slice(0, 10),
  amount: "",
  description: TAX_EVENT_DEFAULT_DESCRIPTION,
  note: "",
});
