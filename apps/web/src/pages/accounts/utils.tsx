export { formatAccountType, renderAccountIcon } from "@/lib/account-display";

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);

export const sparklinePath = (
  values: number[],
  width: number,
  height: number,
) => {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const xStep = (width - pad * 2) / (values.length - 1);

  return values
    .map((value, idx) => {
      const x = pad + idx * xStep;
      const y = pad + (1 - (value - min) / range) * (height - pad * 2);
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

export const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "");
