import type { MouseHandlerDataParam } from "recharts";

export const getActiveChartDataIndex = (
  state: MouseHandlerDataParam | null | undefined,
) => {
  const rawIndex = state?.activeTooltipIndex ?? state?.activeIndex;
  const index =
    typeof rawIndex === "number"
      ? rawIndex
      : typeof rawIndex === "string"
        ? Number(rawIndex)
        : Number.NaN;

  return Number.isInteger(index) && index >= 0 ? index : undefined;
};

export const getActiveChartDatum = <T>(
  data: readonly T[],
  state: MouseHandlerDataParam | null | undefined,
) => {
  const index = getActiveChartDataIndex(state);
  return index === undefined ? undefined : data[index];
};
