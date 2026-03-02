import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountType } from "@/types/api";

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
  className?: string,
) => {
  const iconClassName =
    className ??
    "h-8 w-8 rounded-full border border-slate-100 bg-white p-1 text-slate-700";
  const imageClassName =
    className ??
    "h-8 w-8 rounded-full border border-slate-100 bg-white object-contain p-1";
  const fallbackClassName = className
    ? cn("flex items-center justify-center rounded-full", className)
    : "flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700";

  if (icon?.startsWith("lucide:")) {
    const key = icon.slice("lucide:".length);
    const IconComp = (
      LucideIcons as unknown as Record<string, LucideIcon | undefined>
    )[key];
    if (IconComp) {
      const Icon = IconComp as LucideIcon;
      return <Icon className={iconClassName} />;
    }
  }
  if (icon) {
    return <img src={`/${icon}`} alt={name} className={imageClassName} />;
  }
  return <div className={fallbackClassName}>{name.charAt(0)}</div>;
};
