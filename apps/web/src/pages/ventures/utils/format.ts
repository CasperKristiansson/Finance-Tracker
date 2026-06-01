import { PageRoutes } from "@/data/routes";
import { compactCurrency, formatDate, percent } from "@/lib/format";

export const toFiniteNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatVentureSek = (value: string | number | null | undefined) =>
  compactCurrency(toFiniteNumber(value), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });

export const formatVenturePercent = (
  value: string | number | null | undefined,
  emptyLabel = "No ownership",
) =>
  value === null || value === undefined
    ? emptyLabel
    : percent(toFiniteNumber(value), { maximumFractionDigits: 1 });

export const titleCase = (value: string | null | undefined) =>
  (value ?? "")
    .split(/[_ -]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

export const formatVentureDate = (
  value: string | null | undefined,
  fallback = "No date",
) =>
  value
    ? formatDate(value, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : fallback;

export const ventureCompanyPath = (companyId: string) =>
  PageRoutes.ventureCompany.replace(":companyId", companyId);

export const initialsForName = (name: string) => {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
};

export const statusTheme = (status: string | null | undefined) =>
  ({
    idea: {
      badge: "border-sky-200 bg-sky-50 text-sky-700",
      border: "border-sky-200",
      icon: "bg-sky-600 text-white",
      edge: "#0284c7",
      soft: "bg-sky-50 text-sky-700",
    },
    ongoing: {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      border: "border-emerald-200",
      icon: "bg-teal-700 text-white",
      edge: "#0f766e",
      soft: "bg-emerald-50 text-emerald-700",
    },
    stale: {
      badge: "border-amber-200 bg-amber-50 text-amber-800",
      border: "border-amber-200",
      icon: "bg-amber-600 text-white",
      edge: "#d97706",
      soft: "bg-amber-50 text-amber-800",
    },
    exited: {
      badge: "border-orange-200 bg-orange-50 text-orange-800",
      border: "border-orange-200",
      icon: "bg-orange-600 text-white",
      edge: "#ea580c",
      soft: "bg-orange-50 text-orange-800",
    },
    failed: {
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      border: "border-rose-200",
      icon: "bg-rose-600 text-white",
      edge: "#e11d48",
      soft: "bg-rose-50 text-rose-700",
    },
  })[status ?? ""] ?? {
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    border: "border-slate-200",
    icon: "bg-slate-700 text-white",
    edge: "#64748b",
    soft: "bg-slate-50 text-slate-700",
  };
