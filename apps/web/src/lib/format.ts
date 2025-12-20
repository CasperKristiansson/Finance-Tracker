export type CurrencyFormatOptions = {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: Intl.NumberFormatOptions["notation"];
  signDisplay?: Intl.NumberFormatOptions["signDisplay"];
};

const defaultCurrencyOptions: Required<
  Pick<CurrencyFormatOptions, "currency" | "locale">
> = {
  currency: "SEK",
  locale: "sv-SE",
};

const normalizeNumber = (value: number) => (Number.isFinite(value) ? value : 0);

const SETTINGS_STORAGE_KEY = "finance-tracker-settings";

const readPreferredCurrency = () => {
  if (typeof window === "undefined") return defaultCurrencyOptions.currency;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaultCurrencyOptions.currency;
    const parsed = JSON.parse(raw) as { currencyCode?: string };
    return parsed.currencyCode || defaultCurrencyOptions.currency;
  } catch (error) {
    console.warn("Unable to read cached currency preference", error);
    return defaultCurrencyOptions.currency;
  }
};

export const currency = (rawValue: number, options?: CurrencyFormatOptions) => {
  const value = normalizeNumber(rawValue);
  const locale = options?.locale ?? defaultCurrencyOptions.locale;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: options?.currency ?? readPreferredCurrency(),
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits:
      options?.maximumFractionDigits ?? options?.minimumFractionDigits ?? 0,
    notation: options?.notation,
    signDisplay: options?.signDisplay,
  }).format(value);
};

export const compactCurrency = (
  rawValue: number,
  options?: Omit<CurrencyFormatOptions, "notation">,
) => {
  const value = normalizeNumber(rawValue);
  const locale = options?.locale ?? defaultCurrencyOptions.locale;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: options?.currency ?? readPreferredCurrency(),
    notation: "compact",
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits:
      options?.maximumFractionDigits ?? options?.minimumFractionDigits ?? 1,
    signDisplay: options?.signDisplay,
  }).format(value);
};

export type PercentFormatOptions = {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  signDisplay?: Intl.NumberFormatOptions["signDisplay"];
};

export const percent = (value: number, options?: PercentFormatOptions) => {
  const locale = options?.locale ?? defaultCurrencyOptions.locale;
  return `${normalizeNumber(value).toLocaleString(locale, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
    signDisplay: options?.signDisplay,
  })}%`;
};

export type DateFormatOptions = Intl.DateTimeFormatOptions & {
  locale?: string;
};

const toDate = (value: string | number | Date) =>
  value instanceof Date ? value : new Date(value);

export const formatDate = (
  value: string | number | Date,
  options?: DateFormatOptions,
) => {
  const { locale: localeOverride, ...formatOptions } = options ?? {};
  const locale = localeOverride ?? defaultCurrencyOptions.locale;
  return toDate(value).toLocaleDateString(locale, formatOptions);
};

export const formatDateTime = (
  value: string | number | Date,
  options?: DateFormatOptions,
) => {
  const { locale: localeOverride, ...formatOptions } = options ?? {};
  const locale = localeOverride ?? defaultCurrencyOptions.locale;
  return toDate(value).toLocaleString(locale, formatOptions);
};

export const monthLabel = (dateString: string | Date) =>
  formatDate(dateString, { month: "short" });

export const monthName = (year: number, month: number) =>
  formatDate(Date.UTC(year, month - 1, 1), { month: "long" });

export const monthAndYear = (
  value: string | number | Date,
  options?: { monthStyle?: "short" | "long" } & Pick<
    DateFormatOptions,
    "locale"
  >,
) =>
  formatDate(value, {
    month: options?.monthStyle ?? "short",
    year: "numeric",
    locale: options?.locale,
  });
