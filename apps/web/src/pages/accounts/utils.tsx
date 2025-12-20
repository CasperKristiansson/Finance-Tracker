import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AccountType } from "@/types/api";

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);

export const formatAccountType = (type: AccountType) => {
  switch (type) {
    case AccountType.DEBT:
      return "Debt";
    case AccountType.INVESTMENT:
      return "Investment";
    default:
      return "Cash";
  }
};

export const renderAccountIcon = (
  icon: string | null | undefined,
  name: string,
) => {
  if (icon?.startsWith("lucide:")) {
    const key = icon.slice("lucide:".length);
    const IconComp = (
      LucideIcons as unknown as Record<string, LucideIcon | undefined>
    )[key];
    if (IconComp) {
      const Icon = IconComp as LucideIcon;
      return (
        <Icon className="h-8 w-8 rounded-full border border-slate-100 bg-white p-1 text-slate-700" />
      );
    }
  }
  if (icon) {
    return (
      <img
        src={`/${icon}`}
        alt={name}
        className="h-8 w-8 rounded-full border border-slate-100 bg-white object-contain p-1"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
      {name.charAt(0)}
    </div>
  );
};

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
