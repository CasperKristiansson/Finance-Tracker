import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

type AccountIconProps = {
  icon: string | null | undefined;
  name: string;
};

export const AccountIcon = ({ icon, name }: AccountIconProps) => {
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
