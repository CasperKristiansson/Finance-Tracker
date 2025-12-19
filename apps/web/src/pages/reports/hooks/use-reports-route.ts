import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { PageRoutes } from "@/data/routes";

import type { ReportMode } from "../reports-types";

const YEAR_OPTIONS_COUNT = 11;
const MIN_YEAR = 1900;
const MAX_YEAR = 3000;

export const useReportsRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ year?: string }>();

  const isTotalRoute = location.pathname.startsWith(PageRoutes.reportsTotal);
  const isYearlyRoute = location.pathname.startsWith(PageRoutes.reportsYearly);
  const routeMode: ReportMode = isTotalRoute ? "total" : "yearly";

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const year = useMemo(
    () => (isYearlyRoute ? Number(params.year) || currentYear : currentYear),
    [currentYear, isYearlyRoute, params.year],
  );

  const yearOptions = useMemo(() => {
    const latest = new Date().getFullYear();
    return Array.from({ length: YEAR_OPTIONS_COUNT }, (_, idx) => latest - idx);
  }, []);

  useEffect(() => {
    if (!isYearlyRoute) return;
    const parsed = Number(params.year);
    const isValidYear =
      Number.isFinite(parsed) && parsed > MIN_YEAR && parsed < MAX_YEAR;

    if (!isValidYear) {
      navigate(`${PageRoutes.reportsYearly}/${currentYear}`, { replace: true });
    }
  }, [currentYear, isYearlyRoute, navigate, params.year]);

  const [totalWindowPreset, setTotalWindowPreset] = useState<
    "all" | "10" | "5" | "3"
  >("all");

  return {
    routeMode,
    year,
    yearOptions,
    isTotalRoute,
    isYearlyRoute,
    totalWindowPreset,
    setTotalWindowPreset,
  };
};
