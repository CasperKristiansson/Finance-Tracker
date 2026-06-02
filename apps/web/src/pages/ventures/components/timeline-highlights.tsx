import { CalendarDays } from "lucide-react";
import React, { useMemo } from "react";
import { EmptyState } from "@/components/composed/empty-state";
import type { VentureCompanyDetail } from "@/features/ventures/venturesSlice";
import { formatVentureDate, titleCase } from "@/pages/ventures/utils/format";

type TimelineHighlightsProps = {
  detail: VentureCompanyDetail;
};

export const TimelineHighlights: React.FC<TimelineHighlightsProps> = ({
  detail,
}) => {
  const events = useMemo(
    () =>
      [...detail.timeline]
        .sort((left, right) => right.event_date.localeCompare(left.event_date))
        .slice(0, 5),
    [detail.timeline],
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-teal-700" />
        <h2 className="text-base font-semibold text-slate-950">
          Timeline highlights
        </h2>
      </div>

      {events.length ? (
        <div className="relative space-y-4 pl-5 before:absolute before:top-1 before:bottom-1 before:left-1.5 before:w-px before:bg-teal-700/25">
          {events.map((event) => (
            <div key={event.id} className="relative">
              <span className="absolute top-1.5 -left-[22px] h-3 w-3 rounded-full border-2 border-white bg-teal-700 shadow-sm" />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-950">
                  {event.title}
                </p>
                <p className="text-xs text-slate-500">
                  {formatVentureDate(event.event_date)}
                </p>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {titleCase(event.event_type)}
              </p>
              {event.description ? (
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                  {event.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No timeline events"
          description="Major company events will appear here once recorded."
          icon={<CalendarDays className="h-5 w-5" />}
        />
      )}
    </section>
  );
};
