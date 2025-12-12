import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

const LUCIDE_PREFIX = "lucide:";

export const categoryIconText = (icon: string | null | undefined) => {
  if (!icon) return "";
  if (icon.startsWith(LUCIDE_PREFIX)) return "";
  return icon;
};

export const formatCategoryLabel = (
  name: string,
  icon: string | null | undefined,
) => {
  const textIcon = categoryIconText(icon);
  return `${textIcon ? `${textIcon} ` : ""}${name}`;
};

export const renderCategoryIcon = (
  icon: string | null | undefined,
  name: string,
  className?: string,
) => {
  if (icon?.startsWith(LUCIDE_PREFIX)) {
    const key = icon.slice(LUCIDE_PREFIX.length);
    const IconComp = (
      LucideIcons as unknown as Record<string, LucideIcon | undefined>
    )[key];
    if (IconComp) {
      const Icon = IconComp as LucideIcon;
      return <Icon className={className ?? "h-5 w-5 text-slate-700"} />;
    }
  }

  if (icon) {
    return <span className={className ?? "text-xl leading-none"}>{icon}</span>;
  }

  return (
    <div
      className={
        className ??
        "flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-700"
      }
    >
      {name.charAt(0)}
    </div>
  );
};
